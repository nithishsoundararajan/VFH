import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverDownloadService, ExportFormat } from '@/lib/services/download-service';

interface DownloadParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: DownloadParams) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const resolvedParams = await params;

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'zip') as ExportFormat;
    const includeSource = searchParams.get('includeSource') === 'true';
    const includeDocs = searchParams.get('includeDocs') === 'true';
    const includeTests = searchParams.get('includeTests') === 'true';

    // Validate format
    if (!['zip', 'tar.gz', 'individual'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid export format. Supported formats: zip, tar.gz, individual' },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', resolvedParams.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user owns the project or has shared access
    const hasAccess = project.user_id === user.id;
    if (!hasAccess) {
      // Check for shared access
      const { data: sharedAccess } = await supabase
        .from('shared_projects')
        .select('id')
        .eq('project_id', resolvedParams.id)
        .eq('shared_with', user.id)
        .or('expires_at.is.null,expires_at.gt.now()')
        .single();

      if (!sharedAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Download the project
    const { data: downloadData, error: downloadError } = await serverDownloadService.downloadProject({
      projectId: resolvedParams.id,
      format,
      includeSource,
      includeDocs,
      includeTests
    });

    if (downloadError) {
      return NextResponse.json(
        { error: downloadError },
        { status: 500 }
      );
    }

    if (!downloadData) {
      return NextResponse.json(
        { error: 'Failed to generate download' },
        { status: 500 }
      );
    }

    // Log successful download request
    await supabase.from('generation_logs').insert({
      project_id: resolvedParams.id,
      log_level: 'info',
      message: `Download requested: ${format} format`
    });

    return NextResponse.json({
      success: true,
      download: downloadData,
      project: {
        id: project.id,
        name: project.name,
        status: project.status
      }
    });

  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: DownloadParams) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const resolvedParams = await params;

    const body = await request.json();
    const { format = 'zip', expiresIn = 3600 } = body;

    // Validate format
    if (!['zip', 'tar.gz', 'individual'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid export format' },
        { status: 400 }
      );
    }

    // Validate expiration time (max 24 hours)
    if (expiresIn > 24 * 60 * 60) {
      return NextResponse.json(
        { error: 'Maximum expiration time is 24 hours' },
        { status: 400 }
      );
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', resolvedParams.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const hasAccess = project.user_id === user.id;
    if (!hasAccess) {
      const { data: sharedAccess } = await supabase
        .from('shared_projects')
        .select('id')
        .eq('project_id', resolvedParams.id)
        .eq('shared_with', user.id)
        .or('expires_at.is.null,expires_at.gt.now()')
        .single();

      if (!sharedAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Generate download link
    const { data: linkData, error: linkError } = await serverDownloadService.generateDownloadLink(
      resolvedParams.id,
      format,
      expiresIn
    );

    if (linkError) {
      return NextResponse.json(
        { error: linkError },
        { status: 500 }
      );
    }

    if (!linkData) {
      return NextResponse.json(
        { error: 'Failed to generate download link' },
        { status: 500 }
      );
    }

    // Log link generation
    await supabase.from('generation_logs').insert({
      project_id: resolvedParams.id,
      log_level: 'info',
      message: `Download link generated (expires: ${linkData.expiresAt.toISOString()})`
    });

    return NextResponse.json({
      success: true,
      link: linkData,
      project: {
        id: project.id,
        name: project.name
      }
    });

  } catch (error) {
    console.error('Download link API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverDownloadService } from '@/lib/services/download-service';

interface FilesParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: FilesParams) {
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

    const { searchParams } = new URL(request.url);
    const includeSource = searchParams.get('includeSource') !== 'false';
    const includeDocs = searchParams.get('includeDocs') !== 'false';
    const includeTests = searchParams.get('includeTests') === 'true';

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
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
        .eq('project_id', params.id)
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

    // Get individual file URLs
    const { data: fileUrls, error: filesError } = await serverDownloadService.getIndividualFileUrls(
      params.id,
      { includeSource, includeDocs, includeTests }
    );

    if (filesError) {
      return NextResponse.json(
        { error: filesError },
        { status: 500 }
      );
    }

    if (!fileUrls) {
      return NextResponse.json(
        { error: 'No files found' },
        { status: 404 }
      );
    }

    // Log file list request
    await supabase.from('generation_logs').insert({
      project_id: params.id,
      log_level: 'info',
      message: `Individual files list requested (${fileUrls.length} files)`
    });

    return NextResponse.json({
      success: true,
      files: fileUrls,
      project: {
        id: project.id,
        name: project.name,
        status: project.status
      },
      summary: {
        totalFiles: fileUrls.length,
        totalSize: fileUrls.reduce((sum, file) => sum + file.size, 0),
        expiresAt: fileUrls[0]?.expiresAt
      }
    });

  } catch (error) {
    console.error('Individual files API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
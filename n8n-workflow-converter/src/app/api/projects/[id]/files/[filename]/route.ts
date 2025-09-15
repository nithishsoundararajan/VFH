import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverFileStorage } from '@/lib/services/file-storage-service';

interface FileParams {
  params: {
    id: string;
    filename: string;
  };
}

export async function GET(request: NextRequest, { params }: FileParams) {
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

    const filename = decodeURIComponent(params.filename);

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

    // List files to find the requested file
    const { data: files, error: listError } = await serverFileStorage.listFiles(
      'generated-projects',
      `${project.user_id}/${project.id}`
    );

    if (listError || !files) {
      return NextResponse.json(
        { error: 'Failed to list project files' },
        { status: 500 }
      );
    }

    // Find the specific file
    const targetFile = files.find(file => 
      file.name === filename || 
      file.path.endsWith(filename) ||
      file.path.includes(filename)
    );

    if (!targetFile) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get signed URL for the file
    const { data: signedUrl, error: urlError } = await serverFileStorage.getSignedUrl(
      'generated-projects',
      targetFile.path,
      3600 // 1 hour expiry
    );

    if (urlError || !signedUrl) {
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    // Record download in history
    await supabase.from('download_history').insert({
      user_id: user.id,
      project_id: params.id,
      format: 'individual',
      file_name: targetFile.name,
      file_size: targetFile.size,
      downloaded_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });

    // Log file download
    await supabase.from('generation_logs').insert({
      project_id: params.id,
      log_level: 'info',
      message: `Individual file downloaded: ${targetFile.name}`
    });

    // Check if this is a direct download request
    const { searchParams } = new URL(request.url);
    const direct = searchParams.get('direct') === 'true';

    if (direct) {
      // Redirect to the signed URL for direct download
      return NextResponse.redirect(signedUrl);
    }

    // Return download information
    return NextResponse.json({
      success: true,
      file: {
        name: targetFile.name,
        size: targetFile.size,
        contentType: targetFile.contentType,
        downloadUrl: signedUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      },
      project: {
        id: project.id,
        name: project.name
      }
    });

  } catch (error) {
    console.error('Individual file download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
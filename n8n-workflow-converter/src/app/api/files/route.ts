import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverFileStorage } from '@/lib/services/file-storage-service';

export async function GET(request: NextRequest) {
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
    const bucket = searchParams.get('bucket');
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!bucket || !['workflow-files', 'generated-projects', 'user-uploads'].includes(bucket)) {
      return NextResponse.json(
        { error: 'Invalid bucket specified' },
        { status: 400 }
      );
    }

    // Build path based on user and optional project
    let path = user.id;
    if (projectId) {
      path = `${user.id}/${projectId}`;
    }

    // List files in the user's directory
    const { data: files, error: listError } = await serverFileStorage.listFiles(
      bucket,
      path,
      {
        limit,
        offset,
        sortBy: { column: 'updated_at', order: 'desc' }
      }
    );

    if (listError) {
      return NextResponse.json(
        { error: listError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      files: files || [],
      pagination: {
        limit,
        offset,
        total: files?.length || 0
      }
    });

  } catch (error) {
    console.error('File listing API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const bucket = searchParams.get('bucket');
    const path = searchParams.get('path');
    const projectId = searchParams.get('projectId');

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'Missing bucket or path parameters' },
        { status: 400 }
      );
    }

    // Verify user owns this file
    if (!path.startsWith(user.id)) {
      return NextResponse.json(
        { error: 'Unauthorized file access' },
        { status: 403 }
      );
    }

    // Delete file from storage
    const { error: deleteError } = await serverFileStorage.deleteFile(bucket, path);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError },
        { status: 500 }
      );
    }

    // Update project if this was a workflow file
    if (projectId && bucket === 'workflow-files') {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          workflow_file_path: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to update project after file deletion:', updateError);
      }

      // Log file deletion
      await supabase.from('generation_logs').insert({
        project_id: projectId,
        log_level: 'info',
        message: `File deleted from ${bucket}: ${path}`
      });
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('File deletion API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
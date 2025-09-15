import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverDownloadService } from '@/lib/services/download-service';

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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate limit
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Maximum limit is 100' },
        { status: 400 }
      );
    }

    // Get download history
    const { data: history, error: historyError } = await serverDownloadService.getDownloadHistory(
      user.id,
      limit
    );

    if (historyError) {
      return NextResponse.json(
        { error: historyError },
        { status: 500 }
      );
    }

    // Get additional project details for the history entries
    const projectIds = [...new Set(history?.map(entry => entry.projectId) || [])];
    
    let projectDetails = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, description, status')
        .in('id', projectIds);

      if (projects) {
        projectDetails = projects.reduce((acc, project) => {
          acc[project.id] = project;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Enhance history with project details
    const enhancedHistory = history?.map(entry => ({
      ...entry,
      project: projectDetails[entry.projectId] || null
    })) || [];

    return NextResponse.json({
      history: enhancedHistory,
      pagination: {
        limit,
        offset,
        total: enhancedHistory.length,
        hasMore: enhancedHistory.length === limit
      }
    });

  } catch (error) {
    console.error('Download history API error:', error);
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
    const entryId = searchParams.get('id');
    const olderThan = searchParams.get('olderThan'); // ISO date string

    if (entryId) {
      // Delete specific entry
      const { error: deleteError } = await supabase
        .from('download_history')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to delete download history entry' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Download history entry deleted'
      });

    } else if (olderThan) {
      // Delete entries older than specified date
      const cutoffDate = new Date(olderThan);
      if (isNaN(cutoffDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }

      const { data, error: deleteError } = await supabase
        .from('download_history')
        .delete()
        .eq('user_id', user.id)
        .lt('downloaded_at', cutoffDate.toISOString())
        .select('id');

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to delete download history entries' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${data?.length || 0} download history entries`,
        deletedCount: data?.length || 0
      });

    } else {
      // Delete all entries for user
      const { data, error: deleteError } = await supabase
        .from('download_history')
        .delete()
        .eq('user_id', user.id)
        .select('id');

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to clear download history' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Cleared all download history (${data?.length || 0} entries)`,
        deletedCount: data?.length || 0
      });
    }

  } catch (error) {
    console.error('Download history deletion API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
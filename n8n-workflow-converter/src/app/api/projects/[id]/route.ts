import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, validateProjectAccess } from '@/lib/auth/middleware';
import { createClient } from '@/lib/supabase/server';

async function getHandler(req: AuthenticatedRequest, context?: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { user } = req;
    
    if (!context?.params?.id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    const projectId = context.params.id;

    // Validate project access
    const hasAccess = await validateProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get project details
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

async function putHandler(req: AuthenticatedRequest, context?: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { user } = req;
    
    if (!context?.params?.id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    const projectId = context.params.id;
    const body = await req.json();

    // Validate project access
    const hasAccess = await validateProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    const { name, description } = body;

    // Update project
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: AuthenticatedRequest, context?: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { user } = req;
    
    if (!context?.params?.id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    const projectId = context.params.id;

    // Validate project access
    const hasAccess = await validateProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Delete project (this will cascade to related records due to foreign key constraints)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
export const DELETE = withAuth(deleteHandler);
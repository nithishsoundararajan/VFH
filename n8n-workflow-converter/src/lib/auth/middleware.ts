import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

export async function withAuth<T = any>(
  handler: (req: AuthenticatedRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T) => {
    try {
      const supabase = await createClient();
      
      // Get the authorization header
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      // Extract the token
      const token = authHeader.substring(7);
      
      // Verify the token and get user
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      // Add user to request object
      (req as AuthenticatedRequest).user = user;
      
      // Call the handler with the authenticated request
      return handler(req as AuthenticatedRequest, context);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      );
    }
  };
}

export async function getAuthenticatedUser(req: NextRequest): Promise<User | null> {
  try {
    const supabase = await createClient();
    
    // Try to get user from session first (for server-side rendering)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      return user;
    }

    // If no session user, try authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token);
    
    if (error || !tokenUser) {
      return null;
    }

    return tokenUser;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

export function createAuthResponse(error: string, status: number = 401) {
  return NextResponse.json({ error }, { status });
}

// Helper function to validate user permissions
export async function validateUserAccess(
  userId: string, 
  resourceUserId: string
): Promise<boolean> {
  return userId === resourceUserId;
}

// Helper function to check if user owns a project
export async function validateProjectAccess(
  userId: string, 
  projectId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.user_id === userId;
  } catch (error) {
    console.error('Error validating project access:', error);
    return false;
  }
}
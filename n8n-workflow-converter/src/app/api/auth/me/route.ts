import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { createClient } from '@/lib/supabase/server';

async function handler(req: AuthenticatedRequest) {
  try {
    const supabase = await createClient();
    const { user } = req;

    // Get user profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If profile doesn't exist, create it
    if (!profile) {
      const newProfile = {
        id: user.id,
        email: user.email || '',
        full_name: null,
        avatar_url: null,
      };

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          profile: createdProfile,
        },
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        profile,
      },
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);
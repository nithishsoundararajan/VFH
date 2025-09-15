import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { createClient } from '@/lib/supabase/server';

async function putHandler(req: AuthenticatedRequest) {
  try {
    const supabase = await createClient();
    const { user } = req;
    const body = await req.json();

    const { full_name } = body;

    // Update profile
    const updateData = {
      full_name: full_name?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      // If profile doesn't exist, create it
      if (error.code === 'PGRST116') {
        const newProfile = {
          id: user.id,
          email: user.email || '',
          full_name: full_name?.trim() || null,
          avatar_url: null,
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) throw createError;

        return NextResponse.json({ profile: createdProfile });
      }
      throw error;
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export const PUT = withAuth(putHandler);
import { NextRequest, NextResponse } from 'next/server';

// This endpoint explains why automatic setup isn't available
export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: 'Automatic database setup is not available',
    message: 'For security reasons, database schema changes must be done manually through the Supabase dashboard. Please follow the manual setup instructions.',
    reason: 'Supabase does not allow executing arbitrary SQL from client applications for security purposes.'
  }, { status: 400 });
}
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Check if environment variables are properly configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || 
      supabaseUrl === 'your_supabase_project_url' || 
      supabaseAnonKey === 'your_supabase_anon_key') {
    
    // If accessing auth routes or API routes, show configuration error
    if (request.nextUrl.pathname.startsWith('/auth') || 
        request.nextUrl.pathname.startsWith('/api') ||
        request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/profile')) {
      
      return NextResponse.redirect(new URL('/setup-required', request.url));
    }
    
    // For other routes, continue without Supabase
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Refresh session if expired - required for Server Components
    await supabase.auth.getUser();

    return supabaseResponse;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // If there's an error with Supabase, redirect to setup page
    if (request.nextUrl.pathname.startsWith('/auth') || 
        request.nextUrl.pathname.startsWith('/api') ||
        request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/profile')) {
      
      return NextResponse.redirect(new URL('/setup-required', request.url));
    }
    
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

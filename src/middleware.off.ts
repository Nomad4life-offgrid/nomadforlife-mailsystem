import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Routes die authenticatie vereisen.
 * De (admin) route-group in Next.js App Router voegt geen URL-segment toe,
 * dus admin-routes staan op /dashboard, /campaigns, /contacts, etc.
 */
const PROTECTED_PATHS = [
  '/dashboard',
  '/campaigns',
  '/contacts',
  '/templates',
  '/segments',
  '/logs',
  '/consent',
  '/settings',
  '/send',
]

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Publieke routes: /subscribe, /unsubscribe, /optin, /login, /api/*, etc.
  if (!isProtected(pathname)) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
}
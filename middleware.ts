import { NextRequest, NextResponse } from 'next/server'

async function getExpectedToken(): Promise<string | null> {
  const id = process.env.ADMIN_ID || 'admin'
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return null
  const data = new TextEncoder().encode(`${id}:${pass}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through non-page requests
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Admin routes — enforce cookie auth, redirect to /login
  if (pathname.startsWith('/admin')) {
    const expectedToken = await getExpectedToken()
    const cookie = req.cookies.get('admin_auth')?.value
    if (!expectedToken || cookie !== expectedToken) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Redirect old /ko/* URLs to root
  if (pathname === '/ko' || pathname.startsWith('/ko/')) {
    const rest = pathname.replace(/^\/ko/, '') || '/'
    return NextResponse.redirect(new URL(rest, req.url), 301)
  }

  // Redirect old /en/* URLs to root
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.replace(/^\/en/, '') || '/'
    return NextResponse.redirect(new URL(rest, req.url), 301)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

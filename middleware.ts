import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
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

  // Admin routes — bypass locale redirect, enforce cookie auth
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next()
    const cookie = req.cookies.get('admin_auth')?.value
    const pass = process.env.ADMIN_PASSWORD
    if (!pass || cookie !== pass) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    return NextResponse.next()
  }

  // Already has /ko prefix
  if (pathname === '/ko' || pathname.startsWith('/ko/')) {
    const res = NextResponse.next()
    res.headers.set('x-locale', 'ko')
    return res
  }

  // Redirect /en/* to /ko/*
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.replace(/^\/en/, '')
    req.nextUrl.pathname = `/ko${rest}`
    const res = NextResponse.redirect(req.nextUrl)
    res.headers.set('x-locale', 'ko')
    return res
  }

  // Redirect bare paths to /ko/...
  req.nextUrl.pathname = `/ko${pathname}`
  const res = NextResponse.redirect(req.nextUrl)
  res.headers.set('x-locale', 'ko')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

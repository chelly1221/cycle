import { NextRequest, NextResponse } from 'next/server'

const locales = ['en', 'ko']

function getLocale(req: NextRequest): 'en' | 'ko' {
  const al = req.headers.get('accept-language') ?? ''
  const primary = al.split(',')[0].split(';')[0].trim().toLowerCase()
  return primary.startsWith('ko') ? 'ko' : 'en'
}

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

  // Already has a locale prefix
  const matchedLocale = locales.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  )
  if (matchedLocale) {
    const res = NextResponse.next()
    res.headers.set('x-locale', matchedLocale)
    return res
  }

  // Redirect to locale-prefixed path
  const locale = getLocale(req)
  req.nextUrl.pathname = `/${locale}${pathname}`
  const res = NextResponse.redirect(req.nextUrl)
  res.headers.set('x-locale', locale)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

import Script from 'next/script'
import './globals.css'
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Noto_Sans_KR, Noto_Sans_SC, Noto_Sans_TC } from 'next/font/google'
import Link from 'next/link'
import Image from 'next/image'
import { getDictionary } from '@/lib/i18n'
import { isAuthedServer } from '@/lib/auth'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const notoKR = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-kr' })
const notoSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-sc' })
const notoTC = Noto_Sans_TC({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-tc' })

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDictionary()
  return {
    title: {
      default: d.meta.defaultTitle,
      template: d.meta.titleTemplate,
    },
    description: d.meta.description,
    openGraph: {
      type: 'website',
      siteName: d.meta.siteName,
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [d, loggedIn] = await Promise.all([getDictionary(), Promise.resolve(isAuthedServer())])

  return (
    <html lang="ko">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1163834974598586"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-WVCBW7RWZ3" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-WVCBW7RWZ3');`}
        </Script>
      </head>
      <body className={`${sans.variable} ${mono.variable} ${notoKR.variable} ${notoSC.variable} ${notoTC.variable} bg-black text-white antialiased`}>
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-900 bg-black/80 backdrop-blur-sm">
          <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt={d.nav.brand}
                width={120}
                height={40}
                className="h-9 w-auto object-contain"
                priority
              />
            </Link>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/rides" className="hover:text-white transition-colors" aria-label={d.nav.rides}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="17.5" r="3.5" />
                  <circle cx="18.5" cy="17.5" r="3.5" />
                  <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 12l4.5-2 3 5.5M7 17l2.5-7h4" />
                </svg>
              </Link>
              <Link href="/videos" className="hover:text-white transition-colors" aria-label={d.nav.videos}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
                </svg>
              </Link>
              <Link href="/photos" className="hover:text-white transition-colors" aria-label={d.nav.photos}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </Link>
              <Link href="/dashboard" className="hover:text-white transition-colors" aria-label={d.nav.ledger}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="12" width="4" height="9" rx="1" />
                  <rect x="10" y="7" width="4" height="14" rx="1" />
                  <rect x="17" y="3" width="4" height="18" rx="1" />
                </svg>
              </Link>
              {loggedIn && (
                <a
                  href="/api/logout"
                  className="hover:text-white transition-colors"
                  aria-label="로그아웃"
                  title="로그아웃"
                >
                  {/* logout icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </a>
              )}
            </div>
          </nav>
        </header>
        <main className="pt-16">{children}</main>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Link from 'next/link'
import Image from 'next/image'
import { getDictionary, type Locale } from '@/lib/i18n'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale }
}): Promise<Metadata> {
  const d = await getDictionary(params.locale)
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

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: Locale }
}) {
  const d = await getDictionary(params.locale)
  const { locale } = params

  return (
    <div className={`${sans.variable} ${mono.variable} bg-black text-white antialiased`}>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-900 bg-black/80 backdrop-blur-sm">
        <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center">
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
            <Link href={`/${locale}/rides`} className="hover:text-white transition-colors">
              {d.nav.rides}
            </Link>
            <Link href={`/${locale}/dashboard`} className="hover:text-white transition-colors">
              {d.nav.ledger}
            </Link>
          </div>
        </nav>
      </header>
      <main className="pt-16">{children}</main>
    </div>
  )
}

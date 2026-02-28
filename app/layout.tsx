import { headers } from 'next/headers'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = headers().get('x-locale') ?? 'en'
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  )
}

import { headers } from 'next/headers'

export default function NotFound() {
  const locale = headers().get('x-locale') ?? 'en'
  const isKo = locale === 'ko'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-strava font-mono text-xs tracking-widest">404</p>
      <h1 className="text-3xl font-bold text-white">
        {isKo ? '도로를 찾을 수 없습니다' : 'Road not found'}
      </h1>
      <a href={`/${locale}`} className="text-gray-400 hover:text-white text-sm underline">
        {isKo ? '아카이브로 돌아가기' : 'Back to the archive'}
      </a>
    </div>
  )
}

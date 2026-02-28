'use client'

import { useEffect, useState } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [t, setT] = useState({ heading: 'Something went wrong', button: 'Try again' })

  useEffect(() => {
    console.error(error)
    if (document.documentElement.lang === 'ko') {
      setT({ heading: '오류가 발생했습니다', button: '다시 시도' })
    }
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="text-2xl font-bold text-white">{t.heading}</h2>
      <p className="text-gray-500 text-sm max-w-md">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-strava text-white rounded text-sm hover:bg-orange-600 transition-colors"
      >
        {t.button}
      </button>
    </div>
  )
}

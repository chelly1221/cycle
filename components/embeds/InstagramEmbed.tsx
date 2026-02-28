'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

interface Props {
  url: string
  className?: string
  fallbackLabel?: string
}

export default function InstagramEmbed({ url, className, fallbackLabel = 'View on Instagram' }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const accessToken = process.env.NEXT_PUBLIC_INSTAGRAM_ACCESS_TOKEN
    if (!accessToken) {
      setError(true)
      return
    }
    const endpoint = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${accessToken}&omitscript=true`

    fetch(endpoint)
      .then((r) => r.json())
      .then((data: { html?: string }) => {
        if (data.html) setHtml(data.html)
        else setError(true)
      })
      .catch(() => setError(true))
  }, [url])

  if (error) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-strava underline text-sm">
        {fallbackLabel}
      </a>
    )
  }

  if (!html) {
    return <div className="h-96 bg-gray-800 animate-pulse rounded-lg" />
  }

  return (
    <>
      <Script src="//www.instagram.com/embed.js" strategy="lazyOnload" />
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}

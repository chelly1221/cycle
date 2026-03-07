import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

let fontData: ArrayBuffer | null = null
async function getFont(): Promise<ArrayBuffer> {
  if (fontData) return fontData
  const res = await fetch(
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.subset.woff'
  )
  fontData = await res.arrayBuffer()
  return fontData
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      country: true,
      distanceM: true,
      elevationM: true,
      movingTimeSec: true,
      startedAt: true,
    },
  })

  if (!ride) {
    return new Response('Not found', { status: 404 })
  }

  const distKm = (ride.distanceM / 1000).toFixed(1)
  const elevM = Math.round(ride.elevationM).toLocaleString()
  const hours = Math.floor(ride.movingTimeSec / 3600)
  const mins = Math.floor((ride.movingTimeSec % 3600) / 60)
  const duration = `${hours}h ${mins}m`
  const dateStr = new Date(ride.startedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const font = await getFont()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 70px',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          fontFamily: 'Pretendard',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              color: '#fc4c02',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            {ride.country ?? ''} · {dateStr}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 16,
              maxWidth: 900,
            }}
          >
            {ride.name}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 60 }}>
          {[
            { v: `${distKm} km`, l: '거리' },
            { v: `${elevM} m`, l: '고도' },
            { v: duration, l: '이동 시간' },
          ].map(({ v, l }) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 42, fontWeight: 700 }}>{v}</div>
              <div style={{ display: 'flex', fontSize: 16, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 14,
            color: '#555',
          }}
        >
          3chan의 자전거 여행
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Pretendard',
          data: font,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  )
}

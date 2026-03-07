import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const ride = await db.ride.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      polyline: true,
      startedAt: true,
      elevationProfile: true,
    },
  })

  if (!ride || !ride.polyline) {
    return new Response('Not found', { status: 404 })
  }

  // Decode polyline server-side
  const polylineUtil = await import('polyline-encoded') as any
  const decoder = polylineUtil.default || polylineUtil
  const coords: [number, number][] = decoder.decode(ride.polyline)

  // Build elevation lookup from elevationProfile if available
  const elevProfile = ride.elevationProfile as { distance: number; altitude: number }[] | null
  let elevations: number[] = []
  if (elevProfile && elevProfile.length > 0) {
    // Interpolate elevation for each coordinate point
    const totalPoints = coords.length
    const totalDist = elevProfile[elevProfile.length - 1].distance
    for (let i = 0; i < totalPoints; i++) {
      const frac = totalPoints > 1 ? i / (totalPoints - 1) : 0
      const targetDist = frac * totalDist
      // Find surrounding elevation profile points
      let lo = 0
      let hi = elevProfile.length - 1
      for (let j = 0; j < elevProfile.length - 1; j++) {
        if (elevProfile[j].distance <= targetDist && elevProfile[j + 1].distance >= targetDist) {
          lo = j
          hi = j + 1
          break
        }
      }
      const range = elevProfile[hi].distance - elevProfile[lo].distance
      const t = range > 0 ? (targetDist - elevProfile[lo].distance) / range : 0
      const alt = elevProfile[lo].altitude + t * (elevProfile[hi].altitude - elevProfile[lo].altitude)
      elevations.push(Math.round(alt * 10) / 10)
    }
  }

  const time = ride.startedAt.toISOString()
  const name = ride.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="cycle.3chan.kr">
  <metadata>
    <name>${name}</name>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
`

  for (let i = 0; i < coords.length; i++) {
    const [lat, lon] = coords[i]
    const ele = elevations[i] !== undefined ? `\n        <ele>${elevations[i]}</ele>` : ''
    gpx += `      <trkpt lat="${lat}" lon="${lon}">${ele}
      </trkpt>
`
  }

  gpx += `    </trkseg>
  </trk>
</gpx>`

  const filename = `${ride.name.replace(/[^a-zA-Z0-9가-힣\s-]/g, '').replace(/\s+/g, '-')}.gpx`

  return new Response(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

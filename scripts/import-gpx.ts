/**
 * Import GPS data from Strava bulk export into database.
 * Parses both GPX (.gpx) and FIT (.fit.gz) files.
 * Uses activities.csv to map filenames → Strava Activity IDs.
 * Updates rides with:
 *   - polylineDetail: high-res encoded polyline from GPS track
 *   - elevationProfile: JSON array of {distance (km), altitude (m)} sampled ~every 200m
 *
 * Usage: DATABASE_URL="postgresql://..." npx ts-node --skip-project --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/import-gpx.ts
 */

import 'dotenv/config'
import fs from 'fs'
import zlib from 'zlib'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const polyline = require('polyline-encoded')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FitParser = require('fit-file-parser').default
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ARCHIVE_DIR = path.join(__dirname, '..', 'archive')
const ACTIVITIES_DIR = path.join(ARCHIVE_DIR, 'activities')
const SAMPLE_INTERVAL_M = 200

// ── Haversine distance (metres) ──────────────────────────────────────
function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── TrackPoint type ──────────────────────────────────────────────────
interface TrackPoint {
  lat: number
  lon: number
  ele: number
}

// ── Parse activities.csv → filename-to-stravaId map ──────────────────
function buildFileToIdMap(): Map<string, string> {
  const csvPath = path.join(ARCHIVE_DIR, 'activities.csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const lines = raw.split('\n')
  const map = new Map<string, string>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Activity ID is always the first field (no commas in it)
    const firstComma = line.indexOf(',')
    if (firstComma === -1) continue
    const activityId = line.substring(0, firstComma)

    // Find filename field - look for "activities/" pattern in the line
    const fnMatch = line.match(/activities\/(\d+)\.(gpx|fit\.gz)/)
    if (fnMatch) {
      const filename = `${fnMatch[1]}.${fnMatch[2]}`
      map.set(filename, activityId)
    }
  }

  return map
}

// ── Parse GPX XML → trackpoints ──────────────────────────────────────
function parseGpx(xml: string): TrackPoint[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })
  const doc = parser.parse(xml)

  const trk = doc?.gpx?.trk
  if (!trk) return []

  const segs = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg]
  const points: TrackPoint[] = []

  for (const seg of segs) {
    if (!seg?.trkpt) continue
    const pts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt]
    for (const pt of pts) {
      const lat = parseFloat(pt['@_lat'])
      const lon = parseFloat(pt['@_lon'])
      const ele = pt.ele != null ? parseFloat(String(pt.ele)) : 0
      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({ lat, lon, ele: isNaN(ele) ? 0 : ele })
      }
    }
  }
  return points
}

// ── Parse FIT buffer → trackpoints ───────────────────────────────────
function parseFit(buf: Buffer): Promise<TrackPoint[]> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, mode: 'list' })
    parser.parse(buf, (err: Error | null, data: any) => {
      if (err) return reject(err)
      const points: TrackPoint[] = []
      if (data.records) {
        for (const rec of data.records) {
          if (rec.position_lat != null && rec.position_long != null) {
            points.push({
              lat: rec.position_lat,
              lon: rec.position_long,
              ele: rec.enhanced_altitude ?? rec.altitude ?? 0,
            })
          }
        }
      }
      resolve(points)
    })
  })
}

// ── Build elevation profile ──────────────────────────────────────────
function buildElevationProfile(
  points: TrackPoint[],
): { distance: number; altitude: number }[] {
  if (points.length === 0) return []

  const profile: { distance: number; altitude: number }[] = []
  let cumDist = 0
  let lastSampledDist = -SAMPLE_INTERVAL_M

  profile.push({ distance: 0, altitude: Math.round(points[0].ele) })
  lastSampledDist = 0

  for (let i = 1; i < points.length; i++) {
    const d = haversine(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat, points[i].lon,
    )
    cumDist += d

    if (cumDist - lastSampledDist >= SAMPLE_INTERVAL_M) {
      profile.push({
        distance: Math.round(cumDist / 100) / 10,
        altitude: Math.round(points[i].ele),
      })
      lastSampledDist = cumDist
    }
  }

  const lastPt = points[points.length - 1]
  const lastDist = Math.round(cumDist / 100) / 10
  if (profile[profile.length - 1].distance !== lastDist) {
    profile.push({
      distance: lastDist,
      altitude: Math.round(lastPt.ele),
    })
  }

  return profile
}

// ── Encode trackpoints as polyline ───────────────────────────────────
function encodePolyline(points: TrackPoint[]): string {
  const coords: [number, number][] = points.map((p) => [p.lat, p.lon])
  return polyline.encode(coords)
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  // Build filename → Activity ID mapping from CSV
  const fileToId = buildFileToIdMap()
  console.log(`CSV mapping: ${fileToId.size} entries`)

  const allFiles = fs.readdirSync(ACTIVITIES_DIR)
  const gpxFiles = allFiles.filter((f) => f.endsWith('.gpx'))
  const fitFiles = allFiles.filter((f) => f.endsWith('.fit.gz'))

  console.log(`Found ${gpxFiles.length} GPX + ${fitFiles.length} FIT.GZ = ${gpxFiles.length + fitFiles.length} total files`)

  // Skip rides that already have polylineDetail
  const alreadyDone = await prisma.ride.findMany({
    where: { polylineDetail: { not: null } },
    select: { stravaId: true },
  })
  const doneSet = new Set(alreadyDone.map((r) => r.stravaId.toString()))
  console.log(`Already processed: ${doneSet.size} rides (will skip)\n`)

  let updated = 0
  let skipped = 0
  let notFound = 0
  let noGps = 0
  let errors = 0

  const entries: { file: string; ext: 'gpx' | 'fit.gz' }[] = [
    ...gpxFiles.map((f) => ({ file: f, ext: 'gpx' as const })),
    ...fitFiles.map((f) => ({ file: f, ext: 'fit.gz' as const })),
  ]

  for (const { file, ext } of entries) {
    // Resolve Strava Activity ID: for GPX files the filename IS the ID,
    // for FIT.GZ files we need the CSV mapping
    let stravaId: string

    if (ext === 'gpx') {
      // GPX filename = strava activity ID (confirmed from earlier run)
      const csvId = fileToId.get(file)
      stravaId = csvId || path.basename(file, '.gpx')
    } else {
      const csvId = fileToId.get(file)
      if (!csvId) {
        // No CSV mapping found
        skipped++
        continue
      }
      stravaId = csvId
    }

    // Skip if already processed
    if (doneSet.has(stravaId)) continue

    const filePath = path.join(ACTIVITIES_DIR, file)

    // Check if ride exists in DB
    let ride: { id: any; name: any } | null
    try {
      ride = await prisma.ride.findFirst({
        where: { stravaId: BigInt(stravaId) },
        select: { id: true, name: true },
      })
    } catch {
      notFound++
      continue
    }

    if (!ride) {
      notFound++
      continue
    }

    try {
      let points: TrackPoint[]

      if (ext === 'gpx') {
        const xml = fs.readFileSync(filePath, 'utf-8')
        points = parseGpx(xml)
      } else {
        const gz = fs.readFileSync(filePath)
        const buf = zlib.gunzipSync(gz)
        points = await parseFit(buf)
      }

      if (points.length < 2) {
        noGps++
        continue
      }

      const detail = encodePolyline(points)
      const elevation = buildElevationProfile(points)

      await prisma.ride.update({
        where: { id: ride.id },
        data: {
          polylineDetail: detail,
          elevationProfile: elevation,
        },
      })

      console.log(
        `  OK [${ext.padEnd(6)}]: ${stravaId} - ${ride.name} (${points.length} pts, ${elevation.length} elev)`,
      )
      updated++
    } catch (e: any) {
      console.error(`  ERR [${ext}]: ${stravaId} - ${ride.name ?? '?'} - ${e.message}`)
      errors++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Updated:        ${updated}`)
  console.log(`No GPS points:  ${noGps}`)
  console.log(`Not in DB:      ${notFound}`)
  console.log(`No CSV mapping: ${skipped}`)
  console.log(`Errors:         ${errors}`)
  console.log(`Previously done:${doneSet.size}`)
  console.log(`Total with GPS: ${doneSet.size + updated}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

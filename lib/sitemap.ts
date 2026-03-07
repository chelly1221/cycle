import { db } from './db'
import { RideType } from '@prisma/client'
import { writeFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://cycle.3chan.kr'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function generateSitemap(): Promise<void> {
  const rides = await db.ride.findMany({
    where: { type: { notIn: [RideType.OTHER] } },
    select: { slug: true, country: true, updatedAt: true },
    orderBy: { startedAt: 'desc' },
  })

  const staticPages = [
    { loc: BASE_URL, changefreq: 'weekly', priority: '1.0' },
    { loc: `${BASE_URL}/rides`, changefreq: 'daily', priority: '0.9' },
    { loc: `${BASE_URL}/dashboard`, changefreq: 'daily', priority: '0.8' },
    { loc: `${BASE_URL}/photos`, changefreq: 'weekly', priority: '0.6' },
    { loc: `${BASE_URL}/videos`, changefreq: 'weekly', priority: '0.6' },
  ]

  const urls = staticPages.map(
    (p) =>
      `<url><loc>${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
  )

  for (const r of rides) {
    if (!r.country || !r.slug) continue
    const country = r.country.toLowerCase().replace(/\s+/g, '-')
    const loc = escapeXml(`${BASE_URL}/rides/${country}/${r.slug}`)
    const lastmod = r.updatedAt.toISOString().split('T')[0]
    urls.push(
      `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  writeFileSync(join(process.cwd(), 'public', 'sitemap.xml'), xml, 'utf-8')
  console.log(`[Sitemap] Generated ${urls.length} URLs`)
}

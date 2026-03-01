# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Personal Cycling Archive of the World

A data-driven personal cycling portfolio. Not a blog — a living archive. The site auto-syncs from Strava, embeds YouTube ride films and Instagram photos, and visualises cumulative global stats with an interactive world map.

**Tagline:** "Documenting the world's roads, one climb at a time."

**Stack:** Next.js (App Router) · TypeScript · PostgreSQL (self-hosted) · Docker · Prisma ORM · Tailwind CSS

---

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint

# Database
npx prisma migrate dev        # Apply migrations in development
npx prisma migrate deploy     # Apply migrations in production
npx prisma studio             # Open Prisma data browser
npx prisma generate           # Regenerate Prisma client after schema changes

# Docker (local PostgreSQL)
docker compose up -d          # Start PostgreSQL container
docker compose down           # Stop containers
docker compose logs db        # View DB logs

# Strava sync (manual trigger)
npm run sync:strava           # Pull latest activities from Strava API into DB
```

---

## Architecture

### Directory Structure (planned)
```
/app                     # Next.js App Router pages and layouts
  /page.tsx              # Home — hero video, global live stats, world map
  /rides                 # World Rides section
    /[country]/[slug]    # Individual ride page
  /dashboard             # Cycling Dashboard ("The Ledger")
  /api
    /strava/callback     # OAuth callback from Strava
    /strava/sync         # Webhook or cron endpoint to pull activities
/components              # Reusable UI components
  /map                   # Leaflet.js world map (country fill + heatmap)
  /charts                # Recharts / Chart.js elevation profiles & yearly charts
  /embeds                # YouTube, Instagram, Strava embed wrappers
/lib
  /strava.ts             # Strava API client (OAuth token refresh, activity fetch)
  /db.ts                 # Prisma client singleton
  /stats.ts              # Aggregate query helpers (totals, country breakdown, climbs)
/prisma
  /schema.prisma         # DB schema — rides, segments, countries, tokens
/scripts
  /sync-strava.ts        # Standalone script: fetch Strava activities → upsert DB
docker-compose.yml       # PostgreSQL + Next.js app services
Dockerfile               # Multi-stage production build
```

### Key Data Flow

**Strava → Database → Dashboard**
1. User completes a ride on Strava.
2. `scripts/sync-strava.ts` (or a cron job calling `/api/strava/sync`) fetches new activities via the Strava API v3.
3. **Only cycling activities are synced** — non-cycling sports (Run, Walk, Swim, etc.) are filtered out by `isCyclingActivity()` in `lib/sync-helpers.ts`. Allowed Strava types: Ride, VirtualRide, MountainBikeRide, EBikeRide, GravelRide, Handcycle.
4. Activities are upserted into PostgreSQL via Prisma (`rides` table).
5. `/dashboard` reads aggregated stats from the DB using `lib/stats.ts` helpers.

**Strava OAuth**
- Strava Client ID / Secret are stored in DB (`site_settings` table), managed via admin dashboard (`/admin`).
- OAuth flow: `/api/strava/auth` reads credentials from DB → redirects to Strava → callback at `/api/strava/callback` → stores tokens in DB.
- Token refresh is handled automatically in `lib/strava.ts` before each API call.
- `STRAVA_REDIRECT_URI` is hardcoded to `https://cycle.3chan.kr/api/strava/callback` in `lib/strava.ts`.

### Core DB Tables (Prisma schema shape)
- `rides` — Strava activity data (distance, elevation, moving_time, country, type, polyline, etc.)
- `strava_tokens` — OAuth refresh/access token storage
- `media` — YouTube URLs and Instagram post URLs linked to a ride

### Activity Type Filtering
- **Sync**: Only cycling sports are synced from Strava (`isCyclingActivity()` in `lib/sync-helpers.ts`). Non-cycling (Run, Walk, Swim, etc.) are skipped.
- **All queries**: `lib/stats.ts` excludes `RideType.OTHER` from every query via shared `CYCLING_ONLY` filter.
- **Country-specific queries** (country breakdown, country timeline): additionally exclude `RideType.VIRTUAL_RIDE` via `OUTDOOR_ONLY` filter.
- **Homepage & rides list**: also exclude `OTHER` (and `VIRTUAL_RIDE` for outdoor views).

### Locale
The site is **Korean-only** (`ko`). All user-facing routes live under `/ko/...`. Middleware redirects `/` and `/en/*` to `/ko/...`. The root `<html lang>` is hardcoded to `ko`. There is no English dictionary — `lib/i18n/ko.ts` is the sole translation file.

### Pages
| Route | Purpose |
|---|---|
| `/ko` | Cinematic hero, live global totals, interactive Leaflet world map |
| `/ko/rides` | Grid of all rides, filterable by country / type |
| `/ko/rides/[country]/[slug]` | Single ride: elevation chart, Mapbox/Leaflet route, YouTube embed, story, stats |
| `/ko/dashboard` | Cumulative stats, country visit timeline, country breakdown, top climbs, yearly chart |

### Map
- **Leaflet.js** for the world map — countries fill/highlight based on rides ridden.
- Strava heatmap can be embedded via iframe for the global road overlay.
- Per-ride route rendered from the encoded polyline stored in `rides.polyline`.

### Charts
- Elevation profiles: Recharts `AreaChart` from per-km elevation data.
- Yearly/monthly breakdown: Recharts `BarChart` or `LineChart`.

### Embeds
- YouTube: standard `<iframe>` embed with `youtube-nocookie.com`.
- Instagram: official oEmbed API (`https://graph.facebook.com/v18.0/instagram_oembed`).
- Strava activity: Strava embed widget iframe.

---

## Deployment

**Everything is deployed via Docker Compose** — both the Next.js app and PostgreSQL run as services in the same `docker-compose.yml`. There is no separate hosting; `docker compose up` is the entire deployment.

```bash
# First-time or after code changes — build and start all services
docker compose up -d --build

# View logs
docker compose logs -f app
docker compose logs -f db

# Stop all services
docker compose down

# Push schema to DB manually (normally runs automatically on app start)
docker compose exec app node node_modules/prisma/build/index.js db push --skip-generate
```

The `DATABASE_URL` uses `db` as the hostname (the Docker Compose service name):
`postgresql://cycle_user:cycle_pass@db:5432/cycle`

For **local development** (without Docker), start just the DB and run Next.js locally:
```bash
docker compose up -d db   # Start only PostgreSQL
npm run dev               # Run Next.js dev server
```

---

## Production URL

**Base URL:** `https://cycle.3chan.kr`

All server-side redirects (OAuth callbacks, logout, etc.) must use this domain, not `request.url` (which resolves to `0.0.0.0` inside Docker). API routes use `NEXT_PUBLIC_BASE_URL` env var with fallback to `https://cycle.3chan.kr`.

## Environment Variables

```
DATABASE_URL=postgresql://cycle_user:cycle_pass@db:5432/cycle
NEXT_PUBLIC_BASE_URL=https://cycle.3chan.kr   # Base URL for server-side redirects
STRAVA_CLIENT_ID=              # Optional — prefer DB via admin dashboard
STRAVA_CLIENT_SECRET=          # Optional — prefer DB via admin dashboard
INSTAGRAM_ACCESS_TOKEN=        # For oEmbed API calls (server-side)
NEXT_PUBLIC_INSTAGRAM_ACCESS_TOKEN=  # For oEmbed API calls (client-side)
SYNC_SECRET=                   # Bearer token to protect /api/strava/sync
ADMIN_PASSWORD=                # Password for /admin panel
```

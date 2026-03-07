'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CountryBreakdown } from '@/lib/stats'

const GLOBE_RADIUS = 1.0
const MAX_PITCH = Math.PI / 2.2

// ── Korea target (lat 36, lng 127.5) ─────────────────────────────────────────
const KOREA_LAT = 36
const KOREA_LNG = 127.5
const KOREA_TARGET_Z = 1.2

// Globe position of Korea
const kPhi   = (90 - KOREA_LAT) * Math.PI / 180
const kTheta = (KOREA_LNG + 180) * Math.PI / 180
const kx = -Math.sin(kPhi) * Math.cos(kTheta)
const ky =  Math.cos(kPhi)
const kz =  Math.sin(kPhi) * Math.sin(kTheta)

// Euler XYZ: R = R_X(rotX) * R_Y(rotY)
// rotY: maximise z_world = -sin(rotY)*kx + cos(rotY)*kz → atan2(-kx, kz)
// rotX: centre Korea vertically (y_world = 0) → atan2(ky, √(kx²+kz²))
const KOREA_TARGET_ROT_Y = Math.atan2(-kx, kz)
const KOREA_TARGET_ROT_X = Math.atan2(ky, Math.sqrt(kx * kx + kz * kz))

type Ring = [number, number][]

interface GeoFeature {
  properties?: { ISO_A2?: string; ADMIN?: string; name?: string }
  geometry: { type: string; coordinates: Ring[] | Ring[][] }
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

function latLngToXYZ(lat: number, lng: number, r: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return {
    x: -r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  }
}

function xyzToLatLng(x: number, y: number, z: number) {
  const r = Math.sqrt(x * x + y * y + z * z)
  const phi = Math.acos(Math.max(-1, Math.min(1, y / r)))
  const lat = 90 - phi * (180 / Math.PI)
  const theta = Math.atan2(z, -x)
  const lng = theta * (180 / Math.PI) - 180
  return { lat, lng }
}

// ── Point-in-polygon (ray casting, 2-D lat/lng) ───────────────────────────────

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function hitTestCountry(lng: number, lat: number, features: GeoFeature[]): { code: string; name: string } | null {
  for (const feature of features) {
    const code: string | undefined = feature.properties?.ISO_A2
    if (!code || code === '-99') continue
    const name: string = feature.properties?.ADMIN || feature.properties?.name || code
    const geom = feature.geometry
    let found = false
    if (geom.type === 'Polygon') {
      found = pointInRing(lng, lat, (geom.coordinates as Ring[])[0])
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates as Ring[][]) {
        if (pointInRing(lng, lat, poly[0])) { found = true; break }
      }
    }
    if (found) return { code, name }
  }
  return null
}

// ── Smoothstep easing ─────────────────────────────────────────────────────────

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface RideLineData {
  coords: [number, number][]
  name: string
  distanceKm: number
  elevationM: number
  movingTimeSec: number
  startedAt: string   // ISO string
  country: string | null
  url: string
  elevationProfile?: { distance: number; altitude: number }[]
}

function MiniElevationChart({ data }: { data: { distance: number; altitude: number }[] }) {
  if (data.length < 2) return null
  const W = 260, H = 56
  const minAlt = Math.min(...data.map(d => d.altitude))
  const maxAlt = Math.max(...data.map(d => d.altitude))
  const maxDist = data[data.length - 1].distance
  const altRange = maxAlt - minAlt || 1
  const pts = data.map(d => [
    (d.distance / maxDist) * W,
    H - ((d.altitude - minAlt) / altRange) * (H - 4),
  ] as [number, number])
  const linePts = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `M0,${H} ${pts.map(([x, y]) => `L${x},${y}`).join(' ')} L${W},${H} Z`
  return (
    <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
      <div className="flex justify-between text-[9px] text-gray-600 mb-1 font-mono">
        <span>{Math.round(minAlt)}m</span>
        <span>{Math.round(maxAlt)}m</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[56px]">
        <defs>
          <linearGradient id="sElevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fc5200" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#fc5200" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sElevGrad)" />
        <polyline points={linePts} fill="none" stroke="#fc5200" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDate(iso: string) {
  const [y, mo, d] = iso.split('T')[0].split('-')
  return `${y}년 ${Number(mo)}월 ${Number(d)}일`
}

interface Props {
  visitedCountries: CountryBreakdown[]
  rideLines?: RideLineData[]
  label: string
  tagline: string
  subtitle: string
  statItems: { value: string; label: string; unit?: string; hideMobile?: boolean }[]
  tooltipLabels: { rides: string; km: string }
}

export default function GlobeScene({
  visitedCountries,
  rideLines,
  label,
  tagline,
  subtitle,
  statItems,
  tooltipLabels,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const textOverlayRef = useRef<HTMLDivElement>(null)
  const sidebarRef   = useRef<HTMLDivElement>(null)

  // Block wheel events from bubbling out of the sidebar to the globe
  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const stop = (e: WheelEvent) => e.stopPropagation()
    el.addEventListener('wheel', stop)
    return () => el.removeEventListener('wheel', stop)
  }, [])

  const router    = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const [selectedRide, setSelectedRide] = useState<RideLineData | null>(null)
  const setSelectedRideRef = useRef(setSelectedRide)
  setSelectedRideRef.current = setSelectedRide

  // Called by the close button to reset the selected line's glow from React side
  const clearSelectedLineRef = useRef<() => void>(() => {})

  // Media fetched on demand when a ride is selected
  type MediaItem = { id: string; type: string; url: string; title: string | null; thumbnailUrl: string | null }
  const [sidebarMedia, setSidebarMedia] = useState<MediaItem[]>([])
  useEffect(() => {
    if (!selectedRide) { setSidebarMedia([]); return }
    const slug = selectedRide.url.split('/').pop()
    fetch(`/api/rides/${slug}/media`)
      .then(r => r.json())
      .then(d => setSidebarMedia(d.media ?? []))
      .catch(() => setSidebarMedia([]))
  }, [selectedRide])

  // Keep latest prop values accessible inside the effect closure without
  // re-running the entire Three.js setup on prop changes.
  const tooltipLabelsRef = useRef(tooltipLabels)
  tooltipLabelsRef.current = tooltipLabels

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let mounted  = true
    let animId   = 0
    let cleanupFn: (() => void) | undefined

    // ── Mobile detection ─────────────────────────────────────────────────────
    const isMobile = container.clientWidth < 768

    // ── Shared mutable state (closure) ────────────────────────────────────────
    let isDragging  = false
    let lastX       = 0
    let lastY       = 0
    let velX        = 0
    let velY        = 0
    let hoveredCode: string | null = null

    // ── Intro skip: if already visited today, go straight to interactive mode ─
    const today = new Date().toISOString().split('T')[0]
    let seenToday = false
    try { seenToday = localStorage.getItem('globe_intro_date') === today } catch {}

    // On page reload (Ctrl+R / Ctrl+Shift+R), always replay the intro
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navEntry?.type === 'reload') seenToday = false

    let rotX    = seenToday ? KOREA_TARGET_ROT_X : 0
    let rotY    = seenToday ? KOREA_TARGET_ROT_Y : 0
    let targetZ = seenToday ? KOREA_TARGET_Z : 4.5
    let currentZ= seenToday ? KOREA_TARGET_Z : 4.5

    // ── Intro state ──────────────────────────────────────────────────────────
    // Phases: text → orient (rotate to Korea + zoom) → done
    let introPhase: 'text' | 'orient' | 'done' = seenToday ? 'done' : 'text'
    let orientStartRotY = 0
    let orientStartRotX = 0
    const introStart = performance.now()

    const visitedMap = new Map(
      visitedCountries
        .filter(c => c.countryCode)
        .map(c => [c.countryCode!, c]),
    )
    const visitedCodes = new Set(visitedMap.keys())

    ;(async () => {
      const THREE           = await import('three')
      const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
      const { RenderPass }     = await import('three/examples/jsm/postprocessing/RenderPass.js')
      const { UnrealBloomPass }= await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
      const { OutputPass }     = await import('three/examples/jsm/postprocessing/OutputPass.js')

      if (!mounted) return

      const W = container.clientWidth
      const H = container.clientHeight

      // ── Renderer ──────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: !isMobile })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
      renderer.setSize(W, H)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0
      container.appendChild(renderer.domElement)
      const canvas = renderer.domElement
      canvas.style.cursor = seenToday ? 'grab' : 'default'
      canvas.style.touchAction = 'none'  // prevent pull-to-refresh on mobile

      // Skip intro animation — hide text overlay immediately
      if (seenToday) {
        const el = textOverlayRef.current
        if (el) el.style.opacity = '0'
      }

      // ── Scene / Camera ─────────────────────────────────────────────────────
      const scene  = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000)
      camera.position.z = currentZ

      // ── Lighting ───────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x222233, 1.0))
      const sun = new THREE.DirectionalLight(0x6688cc, 2.0)
      sun.position.set(5, 3, 5)
      scene.add(sun)

      // ── Space Background ──────────────────────────────────────────────────

      // A. Clock for animation timing
      const clock = new THREE.Clock()
      let lastRenderTime = 0

      // B. Nebula background (desktop only) — low-poly sphere rendered from inside
      if (!isMobile) {
        const nebulaMat = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          vertexShader: `
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vPos;
            float hash(vec3 p) {
              p = fract(p * 0.3183099 + vec3(0.1));
              p *= 17.0;
              return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }
            float noise(vec3 x) {
              vec3 i = floor(x);
              vec3 f = fract(x);
              f = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                    mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                    mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),
                f.z);
            }
            float fbm(vec3 p) {
              float v = 0.0, a = 0.5;
              for (int i = 0; i < 4; i++) { v += a*noise(p); p *= 2.0; a *= 0.5; }
              return v;
            }
            void main() {
              vec3  dir  = normalize(vPos);
              float n    = fbm(dir * 3.5 + vec3(1.3, 2.7, 0.5));
              float n2   = fbm(dir * 5.0 + vec3(0.2, 1.5, 3.1));
              float band = smoothstep(0.3, 0.7, n) * smoothstep(0.3, 0.7, n2);
              vec3 purple = vec3(0.15, 0.05, 0.25);
              vec3 blue   = vec3(0.04, 0.08, 0.22);
              vec3 teal   = vec3(0.03, 0.18, 0.22);
              vec3 col = mix(blue, purple, n);
              col = mix(col, teal, n2 * 0.4);
              col *= band * 0.5;
              gl_FragColor = vec4(col, band * 0.35);
            }
          `,
        })
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(70, 32, 32), nebulaMat))
      }

      // C. Main Starfield — ShaderMaterial with per-vertex colour + twinkle
      const starUniforms = { uTime: { value: 0 } }
      const starCount    = isMobile ? 3000 : 6000
      const starPos      = new Float32Array(starCount * 3)
      const starSizes    = new Float32Array(starCount)
      const starColors   = new Float32Array(starCount * 3)
      const starTwinkle  = new Float32Array(starCount)
      for (let i = 0; i < starCount; i++) {
        const r     = 80 + Math.random() * 20
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(2 * Math.random() - 1)
        starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
        starPos[i * 3 + 1] = r * Math.cos(phi)
        starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
        const isBright = Math.random() < 0.07
        starSizes[i]   = isBright ? 2.5 + Math.random() * 2.5 : 0.6 + Math.random() * 1.2
        const roll = Math.random()
        if (roll < 0.15) {               // OB-type: blue-white
          starColors[i * 3]     = 0.75 + Math.random() * 0.25
          starColors[i * 3 + 1] = 0.85 + Math.random() * 0.15
          starColors[i * 3 + 2] = 1.0
        } else if (roll < 0.65) {        // GF-type: white-yellow
          starColors[i * 3]     = 1.0
          starColors[i * 3 + 1] = 0.95 + Math.random() * 0.05
          starColors[i * 3 + 2] = 0.85 + Math.random() * 0.15
        } else {                         // KM-type: orange-red
          starColors[i * 3]     = 1.0
          starColors[i * 3 + 1] = 0.50 + Math.random() * 0.35
          starColors[i * 3 + 2] = 0.20 + Math.random() * 0.30
        }
        starTwinkle[i] = Math.random() * Math.PI * 2
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      starGeo.setAttribute('aSize',    new THREE.BufferAttribute(starSizes, 1))
      starGeo.setAttribute('aColor',   new THREE.BufferAttribute(starColors, 3))
      starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(starTwinkle, 1))
      scene.add(new THREE.Points(starGeo, new THREE.ShaderMaterial({
        uniforms: starUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `
          attribute float aSize;
          attribute vec3  aColor;
          attribute float aTwinkle;
          uniform float   uTime;
          varying vec3 vColor;
          void main() {
            vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float twinkle = 0.78 + 0.22 * sin(uTime * 1.3 + aTwinkle);
            gl_PointSize = aSize * twinkle * (280.0 / -mv.z);
            gl_Position  = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            vec2  uv = gl_PointCoord - 0.5;
            float d  = length(uv);
            float a  = smoothstep(0.5, 0.1, d);
            gl_FragColor = vec4(vColor, a);
          }
        `,
      })))

      // D. Milky Way band — great circle tilted 0.60 rad with Gaussian spread
      const mwCount  = isMobile ? 1500 : 4000
      const mwPos    = new Float32Array(mwCount * 3)
      const mwSizes  = new Float32Array(mwCount)
      const mwColors = new Float32Array(mwCount * 3)
      {
        const galN = new THREE.Vector3(0, Math.cos(0.60), Math.sin(0.60)).normalize()
        const galR = new THREE.Vector3(1, 0, 0)
        const galU = new THREE.Vector3().crossVectors(galN, galR).normalize()
        for (let i = 0; i < mwCount; i++) {
          const phi    = Math.random() * Math.PI * 2
          const u1     = Math.max(Math.random(), 1e-10)
          const gauss  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random())
          const spread = gauss * 0.18
          const r      = 82 + Math.random() * 16
          const base   = new THREE.Vector3()
            .addScaledVector(galR, Math.cos(phi))
            .addScaledVector(galU, Math.sin(phi))
            .normalize()
          const dir = new THREE.Vector3()
            .addScaledVector(base, Math.cos(spread))
            .addScaledVector(galN, Math.sin(spread))
            .normalize()
          mwPos[i * 3]     = dir.x * r
          mwPos[i * 3 + 1] = dir.y * r
          mwPos[i * 3 + 2] = dir.z * r
          mwSizes[i]         = 0.25 + Math.random() * 0.55
          mwColors[i * 3]     = 0.85 + Math.random() * 0.15
          mwColors[i * 3 + 1] = 0.88 + Math.random() * 0.12
          mwColors[i * 3 + 2] = 0.95 + Math.random() * 0.05
        }
      }
      const mwGeo = new THREE.BufferGeometry()
      mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3))
      mwGeo.setAttribute('aSize',    new THREE.BufferAttribute(mwSizes, 1))
      mwGeo.setAttribute('aColor',   new THREE.BufferAttribute(mwColors, 3))
      scene.add(new THREE.Points(mwGeo, new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `
          attribute float aSize;
          attribute vec3  aColor;
          varying vec3 vColor;
          void main() {
            vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (280.0 / -mv.z);
            gl_Position  = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            vec2  uv = gl_PointCoord - 0.5;
            float d  = length(uv);
            float a  = smoothstep(0.5, 0.1, d) * 0.55;
            gl_FragColor = vec4(vColor, a);
          }
        `,
      })))

      // E. Shooting Stars
      type ShootingStar = {
        line: any  // THREE.Line (dynamically imported)
        progress: number
        speed: number
        start: any // THREE.Vector3
        dir: any   // THREE.Vector3
        headLen: number
        totalDist: number
      }
      const shootingStars: ShootingStar[] = []
      let nextShootAt = 4 + Math.random() * 5

      function spawnStar() {
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(2 * Math.random() - 1)
        const R     = 85
        const start = new THREE.Vector3(
          R * Math.sin(phi) * Math.cos(theta),
          R * Math.cos(phi),
          R * Math.sin(phi) * Math.sin(theta),
        )
        const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta))
        const dir     = tangent.clone()
        dir.y -= 0.4
        dir.normalize()
        const headLen   = 5 + Math.random() * 8
        const totalDist = headLen + 10
        const speed     = 25 + Math.random() * 30
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
        const mat  = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        const line = new THREE.Line(geo, mat)
        scene.add(line)
        shootingStars.push({ line, progress: 0, speed, start, dir, headLen, totalDist })
      }

      function tickShootingStars(dt: number, totalT: number) {
        if (totalT >= nextShootAt && shootingStars.length < 4) {
          spawnStar()
          nextShootAt = totalT + 5 + Math.random() * 9
        }
        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const ss = shootingStars[i]
          ss.progress += ss.speed * dt
          const tailDist = Math.max(0, ss.progress - ss.headLen)
          if (tailDist >= ss.totalDist) {
            scene.remove(ss.line)
            ss.line.geometry.dispose()
            ;(ss.line.material as any).dispose()
            shootingStars.splice(i, 1)
            continue
          }
          const tailPos = ss.start.clone().addScaledVector(ss.dir, tailDist)
          const headPos = ss.start.clone().addScaledVector(ss.dir, ss.progress)
          const pos = ss.line.geometry.attributes.position
          pos.setXYZ(0, tailPos.x, tailPos.y, tailPos.z)
          pos.setXYZ(1, headPos.x, headPos.y, headPos.z)
          pos.needsUpdate = true
          const t = ss.progress / ss.totalDist
          let opacity = 1.0
          if (t < 0.2) opacity = t / 0.2
          if (t > 0.7) opacity = (1.0 - t) / 0.3
          ;(ss.line.material as any).opacity = Math.max(0, Math.min(1, opacity))
        }
      }

      // ── Globe sphere — Phong + Fresnel rim (no separate atmosphere mesh) ──
      const sphereSegs = isMobile ? 48 : 64
      const globeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, sphereSegs, sphereSegs),
        new THREE.ShaderMaterial({
          uniforms: {
            baseColor:  { value: new THREE.Color(0x0a1628) },
            rimColor:   { value: new THREE.Color(0x88ccff) },
            lightDir:   { value: new THREE.Vector3(5, 3, 5).normalize() },
            lightColor: { value: new THREE.Color(0x6688cc) },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              vNormal  = normalize(normalMatrix * normal);
              vec4 mv  = modelViewMatrix * vec4(position, 1.0);
              vViewDir = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform vec3 baseColor;
            uniform vec3 rimColor;
            uniform vec3 lightDir;
            uniform vec3 lightColor;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              // Diffuse
              float diff = max(dot(vNormal, lightDir), 0.0);
              vec3  lit  = (vec3(0.08, 0.10, 0.20) + lightColor * diff * 0.7) * baseColor;
              // Specular (Blinn-Phong)
              vec3  h    = normalize(lightDir + vViewDir);
              float spec = pow(max(dot(vNormal, h), 0.0), 40.0) * 0.35;
              vec3  sCol = vec3(0.07, 0.14, 0.28) * spec;
              // Fresnel rim — tight, subtle blue glow at limb
              float rim  = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 7.0);
              vec3  rCol = rimColor * rim * 0.6;
              gl_FragColor = vec4(lit + sCol + rCol, 1.0);
            }
          `,
        }),
      )
      scene.add(globeMesh)

      // ── GeoJSON country borders (uniform dim color) ─────────────────────
      let geojsonFeatures: GeoFeature[] = []

      try {
        const res     = await fetch('/data/countries.geojson')
        if (!mounted) return
        const geojson = await res.json()
        geojsonFeatures = geojson.features

        const R = GLOBE_RADIUS + 0.001
        const borderMat = new THREE.LineBasicMaterial({ color: 0x334455, opacity: 0.35, transparent: true })

        const processRing = (coords: [number, number][]) => {
          const points = coords.map(([lng, lat]) => {
            const { x, y, z } = latLngToXYZ(lat, lng, R)
            return new THREE.Vector3(x, y, z)
          })
          const geo = new THREE.BufferGeometry().setFromPoints(points)
          globeMesh.add(new THREE.Line(geo, borderMat))
        }

        for (const feature of geojson.features) {
          const geom = feature.geometry
          if (geom.type === 'Polygon') {
            for (const ring of geom.coordinates as Ring[]) processRing(ring)
          } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.coordinates as Ring[][])
              for (const ring of poly) processRing(ring)
          }
        }
      } catch {
        // GeoJSON unavailable — globe renders without borders
      }

      // ── Ride polylines (individual lines for hover interaction) ──────────
      type RideLineRef = { mat: InstanceType<typeof THREE.LineBasicMaterial>; data: RideLineData }
      const rideLineMap = new Map<object, RideLineRef>()
      const rideLineObjects: object[] = []
      let hoveredRideRef: RideLineRef | null = null
      let selectedLineRef: RideLineRef | null = null

      // Reset a line to its resting color (orange if selected, pink if not)
      const resetLineColor = (ref: RideLineRef) => {
        if (ref === selectedLineRef) {
          ref.mat.color.setHex(0xffffff) // white glow — same as hover, persists
          ref.mat.opacity = 1.0
        } else {
          ref.mat.color.setHex(0xff6b8a)
          ref.mat.opacity = 0.55
        }
      }

      // Expose deselect logic so the React close button can reset the glow
      clearSelectedLineRef.current = () => {
        if (selectedLineRef) {
          selectedLineRef.mat.color.setHex(0xff6b8a)
          selectedLineRef.mat.opacity = 0.55
          selectedLineRef = null
        }
      }

      if (rideLines && rideLines.length > 0) {
        const R_RIDE = GLOBE_RADIUS + 0.002

        for (const ride of rideLines) {
          const mat = new THREE.LineBasicMaterial({
            color: 0xff6b8a,
            opacity: 0.55,
            transparent: true,
          })
          const points = ride.coords.map(([lat, lng]) => {
            const { x, y, z } = latLngToXYZ(lat, lng, R_RIDE)
            return new THREE.Vector3(x, y, z)
          })
          const geo = new THREE.BufferGeometry().setFromPoints(points)
          const line = new THREE.Line(geo, mat)
          globeMesh.add(line)
          rideLineMap.set(line, { mat, data: ride })
          rideLineObjects.push(line)
        }
      }

      // ── Bloom post-processing ──────────────────────────────────────────────
      const composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      if (!isMobile) {
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.5, 0.3))
      }
      composer.addPass(new OutputPass())

      // ── Raycaster ─────────────────────────────────────────────────────────
      const raycaster    = new THREE.Raycaster()
      const mouse        = new THREE.Vector2()
      const globeSphere  = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS)

      // ── Helper: update tooltip DOM directly (no React re-render) ─────────
      const tt = tooltipRef.current
      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      const showTooltip = (cx: number, cy: number, html: string) => {
        if (!tt) return
        const rect = canvas.getBoundingClientRect()
        tt.innerHTML = html
        tt.style.left    = `${cx - rect.left + 16}px`
        tt.style.top     = `${cy - rect.top  - 10}px`
        tt.style.display = 'block'
      }
      const hideTooltip = () => { if (tt) tt.style.display = 'none' }

      // ── Fade out text overlay on first interaction ────────────────────────
      let textHidden = false
      const fadeOutText = () => {
        if (textHidden) return
        textHidden = true
        const el = textOverlayRef.current
        if (el) {
          el.style.transition = 'opacity 0.6s ease'
          el.style.opacity = '0'
        }
      }

      // ── Event handlers ─────────────────────────────────────────────────────

      const onPointerDown = (e: PointerEvent) => {
        if (introPhase !== 'done') return
        fadeOutText()
        isDragging = true
        lastX = e.clientX
        lastY = e.clientY
        velX  = 0
        velY  = 0
        canvas.setPointerCapture(e.pointerId)
        canvas.style.cursor = 'grabbing'
        hideTooltip()
        // hoveredRideRef is reset on actual drag movement, not here,
        // so that onClick can still read it for a plain click.
      }

      const onPointerMove = (e: PointerEvent) => {
        if (introPhase !== 'done') return

        if (isDragging) {
          // Clear ride hover as soon as the pointer actually moves (real drag)
          if (hoveredRideRef) {
            resetLineColor(hoveredRideRef)
            hoveredRideRef = null
          }
          const dx = e.clientX - lastX
          const dy = e.clientY - lastY
          // Scale sensitivity with zoom level — cubic curve keeps zoom-in
          // precise while making zoom-out significantly more responsive.
          // currentZ range: 1.2 (fully zoomed in) → 4.5 (fully zoomed out)
          const zNorm = currentZ / 4.5           // 0.27 … 1.0
          const sensitivity = 0.0004 * zNorm * zNorm * zNorm * 22
          velX  = dx * sensitivity
          velY  = dy * sensitivity
          rotY += velX
          rotX  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rotX + velY))
          lastX = e.clientX
          lastY = e.clientY
          return
        }

        // ── Hover: ride lines → country ──────────────────────────────────────
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)

        const hitPt = new THREE.Vector3()
        const hit   = raycaster.ray.intersectSphere(globeSphere, hitPt)

        if (hit) {
          // ── Check ride polylines via screen-space proximity ───────────────
          // 3D raycasting against Line objects is unreliable (back-face hits,
          // matrixWorld timing). Instead, project line vertices to screen space
          // and find the closest one to the cursor.
          if (rideLineObjects.length > 0) {
            const mx = e.clientX - rect.left
            const my = e.clientY - rect.top
            const THRESHOLD_SQ = 64 // 8px radius
            let closestRef: RideLineRef | null = null
            let closestDistSq = THRESHOLD_SQ

            for (const [lineObj, ref] of Array.from(rideLineMap.entries())) {
              const positions = (lineObj as any).geometry.attributes.position
              const count: number = positions.count
              const step = Math.max(1, Math.floor(count / 24))
              const mw = (lineObj as any).matrixWorld

              for (let i = 0; i < count; i += step) {
                const wp = new THREE.Vector3(
                  positions.getX(i), positions.getY(i), positions.getZ(i),
                ).applyMatrix4(mw)

                if (wp.z <= 0) continue // back side of globe — skip

                const ndc = wp.project(camera)
                const sx = (ndc.x + 1) / 2 * rect.width
                const sy = (1 - ndc.y) / 2 * rect.height
                const dx = sx - mx
                const dy = sy - my
                const dSq = dx * dx + dy * dy
                if (dSq < closestDistSq) { closestDistSq = dSq; closestRef = ref }
              }
            }

            if (closestRef) {
              if (hoveredRideRef && hoveredRideRef !== closestRef) {
                resetLineColor(hoveredRideRef)
              }
              closestRef.mat.color.setHex(0xffffff)
              closestRef.mat.opacity = 1.0
              hoveredRideRef = closestRef
              hoveredCode = null
              canvas.style.cursor = 'pointer'
              showTooltip(
                e.clientX, e.clientY,
                `<strong>${esc(closestRef.data.name)}</strong><br/><span style="color:#9ca3af">${closestRef.data.distanceKm.toLocaleString()}km · ${closestRef.data.elevationM.toLocaleString()}m</span>`,
              )
              return
            }
          }

          // Reset ride hover when not on a line
          if (hoveredRideRef) {
            resetLineColor(hoveredRideRef)
            hoveredRideRef = null
          }

          // ── Country hover (fallback) ─────────────────────────────────────
          const local = globeMesh.worldToLocal(hitPt.clone())
          const { lat, lng } = xyzToLatLng(local.x, local.y, local.z)
          const found = hitTestCountry(lng, lat, geojsonFeatures)

          if (found) {
            hoveredCode = found.code
            const isVisited = visitedCodes.has(found.code)
            canvas.style.cursor = isVisited ? 'pointer' : 'default'

            const data = visitedMap.get(found.code)
            const labels = tooltipLabelsRef.current
            if (data) {
              showTooltip(
                e.clientX, e.clientY,
                `<strong>${esc(found.name)}</strong><br/><span style="color:#9ca3af">${data.rides} ${labels.rides} · ${data.distanceKm.toLocaleString()} ${labels.km}</span>`,
              )
            } else {
              showTooltip(e.clientX, e.clientY, `<strong>${esc(found.name)}</strong>`)
            }
          } else {
            hoveredCode = null
            canvas.style.cursor = 'grab'
            hideTooltip()
          }
        } else {
          if (hoveredRideRef) {
            resetLineColor(hoveredRideRef)
            hoveredRideRef = null
          }
          hoveredCode = null
          canvas.style.cursor = 'grab'
          hideTooltip()
        }
      }

      const onPointerUp = () => {
        if (introPhase !== 'done') return
        isDragging = false
        canvas.style.cursor = (hoveredCode && visitedCodes.has(hoveredCode)) ? 'pointer' : 'grab'
      }

      const onClick = () => {
        if (introPhase !== 'done') return
        if (hoveredRideRef) {
          // Reset previous selection
          if (selectedLineRef && selectedLineRef !== hoveredRideRef) {
            selectedLineRef.mat.color.setHex(0xff6b8a)
            selectedLineRef.mat.opacity = 0.55
          }
          // Apply selected glow (white, same as hover) and persist it
          hoveredRideRef.mat.color.setHex(0xffffff)
          hoveredRideRef.mat.opacity = 1.0
          selectedLineRef = hoveredRideRef
          setSelectedRideRef.current(hoveredRideRef.data)
          return
        }
        if (hoveredCode && visitedCodes.has(hoveredCode)) {
          routerRef.current.push('/rides')
        }
      }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        if (introPhase !== 'done') return
        fadeOutText()
        targetZ = Math.max(1.2, Math.min(4.5, targetZ + e.deltaY * 0.003))
      }

      const onResize = () => {
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        composer.setSize(w, h)
      }

      canvas.addEventListener('pointerdown',  onPointerDown)
      canvas.addEventListener('pointermove',  onPointerMove)
      canvas.addEventListener('pointerup',    onPointerUp)
      canvas.addEventListener('pointercancel',onPointerUp)
      canvas.addEventListener('click',        onClick)
      container.addEventListener('wheel',     onWheel, { passive: false })
      window.addEventListener('resize',       onResize)

      // ── Animate ────────────────────────────────────────────────────────────
      function animate() {
        animId = requestAnimationFrame(animate)

        // Space animation timing (separate from intro `elapsed`)
        const spaceT = clock.getElapsedTime()
        const dt = spaceT - lastRenderTime
        lastRenderTime = spaceT
        starUniforms.uTime.value = spaceT
        if (introPhase === 'done') tickShootingStars(dt, spaceT)

        const elapsed = (performance.now() - introStart) / 1000

        if (introPhase === 'text') {
          // Slow auto-rotate, camera stays far
          rotY += 0.0008
          camera.position.z = 4.5

          if (elapsed >= 4.5) {
            introPhase = 'orient'
            orientStartRotY = rotY
            orientStartRotX = rotX
          }
        } else if (introPhase === 'orient') {
          // Rotate to face Korea AND zoom in simultaneously
          const t = Math.min((elapsed - 4.5) / 1.5, 1) // 0→1 over 1.5 seconds
          const ease = smoothstep(t)

          rotY = orientStartRotY + (KOREA_TARGET_ROT_Y - orientStartRotY) * ease
          rotX = orientStartRotX + (KOREA_TARGET_ROT_X - orientStartRotX) * ease
          camera.position.z = 4.5 + (KOREA_TARGET_Z - 4.5) * ease

          if (t >= 1) {
            currentZ = KOREA_TARGET_Z
            introPhase = 'done'
            targetZ = KOREA_TARGET_Z
            canvas.style.cursor = 'grab'
            try { localStorage.setItem('globe_intro_date', today) } catch {}
          }
        } else {
          // ── Interactive mode — drag inertia, axis stays vertical ──────────
          if (!isDragging) {
            velX *= 0.92
            velY *= 0.92
            rotY += velX
            rotX  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rotX + velY))
          }

          // Smooth zoom
          currentZ += (targetZ - currentZ) * 0.1
          camera.position.z = currentZ
        }

        globeMesh.rotation.copy(new THREE.Euler(rotX, rotY, 0, 'XYZ'))
        composer.render()
      }
      animate()

      // ── Cleanup ────────────────────────────────────────────────────────────
      cleanupFn = () => {
        cancelAnimationFrame(animId)
        window.removeEventListener('resize',        onResize)
        canvas.removeEventListener('pointerdown',   onPointerDown)
        canvas.removeEventListener('pointermove',   onPointerMove)
        canvas.removeEventListener('pointerup',     onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('click',         onClick)
        container.removeEventListener('wheel',      onWheel)
        shootingStars.forEach(ss => {
          scene.remove(ss.line)
          ss.line.geometry.dispose()
          ;(ss.line.material as any).dispose()
        })
        composer.dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement)
        }
      }
    })()

    return () => {
      mounted = false
      cancelAnimationFrame(animId)
      cleanupFn?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedCountries, rideLines])

  return (
    <div ref={containerRef} className="relative w-full h-[calc(100dvh-4rem)] bg-black overflow-hidden">

      {/* Country tooltip — updated via direct DOM manipulation */}
      <div
        ref={tooltipRef}
        style={{ display: 'none' }}
        className="absolute z-30 pointer-events-none
                   bg-black/80 backdrop-blur-sm text-white text-sm
                   px-3 py-2 rounded border border-gray-700 whitespace-nowrap"
      />

      {/* Text overlay — cinematic fade-in sequence */}
      <div ref={textOverlayRef} className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4 md:pb-24">
        <p
          className="text-strava font-mono text-[10px] md:text-xs tracking-[0.3em] uppercase mb-3 md:mb-4"
          style={{ opacity: 0, animation: 'fadeInUp 0.8s ease forwards', animationDelay: '0.8s' }}
        >
          {label}
        </p>
        <h1
          className="text-3xl sm:text-5xl md:text-7xl font-bold text-white text-center mb-4 md:mb-6 drop-shadow-2xl"
          style={{ opacity: 0, animation: 'fadeInUp 0.8s ease forwards', animationDelay: '2.0s' }}
        >
          {tagline}
        </h1>
        <p
          className="text-gray-400 text-sm md:text-lg text-center"
          style={{ opacity: 0, animation: 'fadeInUp 0.8s ease forwards', animationDelay: '3.2s' }}
        >
          {subtitle}
        </p>
      </div>

      {/* Bottom stats strip */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none
                    bg-gradient-to-t from-black/90 to-transparent"
        style={{ opacity: 0, animation: 'fadeInUp 0.8s ease forwards', animationDelay: '4.0s' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 md:py-6 grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 text-center">
          {statItems.map(({ value, label: statLabel, unit, hideMobile }) => (
            <div key={statLabel} className={hideMobile ? 'hidden md:block' : ''}>
              <p className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-white leading-tight">
                {value}
                {unit && <span className="text-xs sm:text-sm md:text-base font-normal text-gray-400 ml-0.5">{unit}</span>}
              </p>
              <p className="text-[9px] md:text-xs text-gray-500 uppercase tracking-wider mt-1 leading-tight">{statLabel}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ride detail sidebar ──────────────────────────────────────────────── */}
      <div
        ref={sidebarRef}
        className={`absolute right-0 top-0 h-full z-20 flex flex-col
                    w-72 sm:w-80
                    bg-black/90 backdrop-blur-md border-l border-white/10
                    transition-transform duration-300 ease-out
                    ${selectedRide ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedRide && (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 p-5 pt-6 border-b border-white/10 flex-shrink-0">
              <div className="flex-1 min-w-0">
                {selectedRide.country && (
                  <p className="text-[10px] font-mono text-strava tracking-[0.2em] uppercase mb-1">
                    {selectedRide.country}
                  </p>
                )}
                <h2 className="text-white font-bold text-sm leading-snug">
                  {selectedRide.name}
                </h2>
                <p className="text-gray-500 text-xs mt-1">
                  {fmtDate(selectedRide.startedAt)}
                </p>
              </div>
              <button
                onClick={() => { clearSelectedLineRef.current(); setSelectedRide(null) }}
                className="flex-shrink-0 text-gray-500 hover:text-white text-xl leading-none mt-0.5 transition-colors"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10 flex-shrink-0">
              {[
                { value: selectedRide.distanceKm.toLocaleString(), unit: 'km' },
                { value: selectedRide.elevationM.toLocaleString(), unit: 'm 고도' },
                { value: fmtTime(selectedRide.movingTimeSec), unit: '이동' },
              ].map(({ value, unit }) => (
                <div key={unit} className="py-4 text-center">
                  <p className="text-lg font-mono font-bold text-white">{value}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{unit}</p>
                </div>
              ))}
            </div>

            {/* Elevation profile */}
            {selectedRide.elevationProfile && selectedRide.elevationProfile.length >= 2 && (
              <MiniElevationChart data={selectedRide.elevationProfile} />
            )}

            {/* Scrollable media + button area */}
            <div className="flex-1 overflow-y-auto">
              {/* YouTube & photos */}
              {sidebarMedia.length > 0 && (
                <div className="p-4 space-y-3 border-b border-white/10">
                  {sidebarMedia.map(m => {
                    if (m.type === 'YOUTUBE') {
                      const vid = m.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1]
                      if (!vid) return null
                      return (
                        <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
                           className="block relative rounded overflow-hidden group">
                          <img
                            src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`}
                            alt={m.title ?? ''}
                            className="w-full object-cover aspect-video"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/55 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                              <svg className="w-4 h-4 text-black ml-0.5" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4 2l10 6-10 6z"/>
                              </svg>
                            </div>
                          </div>
                          {m.title && (
                            <p className="absolute bottom-0 left-0 right-0 px-2 py-1.5
                                          text-[11px] text-white bg-black/60 truncate">
                              {m.title}
                            </p>
                          )}
                        </a>
                      )
                    }
                    if ((m.type === 'STRAVA_PHOTO' || m.type === 'INSTAGRAM') && m.thumbnailUrl) {
                      return (
                        <img key={m.id} src={m.thumbnailUrl} alt={m.title ?? ''}
                             className="w-full rounded object-cover" />
                      )
                    }
                    return null
                  })}
                </div>
              )}

              {/* Navigate button */}
              <div className="p-5">
                <button
                  onClick={() => router.push(selectedRide.url)}
                  className="w-full py-3 text-sm font-medium text-white
                             bg-white/10 hover:bg-white/20 rounded
                             border border-white/20 transition-colors"
                >
                  라이드 전체 보기 →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

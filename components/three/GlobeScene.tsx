'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CountryBreakdown } from '@/lib/stats'
import MediaPinPanel, { type MediaPin, type MediaPanelLabels } from './MediaPinPanel'

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

interface Props {
  visitedCountries: CountryBreakdown[]
  rideLines?: [number, number][][]
  mediaPins?: MediaPin[]
  mediaPanelLabels?: MediaPanelLabels
  label: string
  tagline: string
  subtitle: string
  statItems: { value: string; label: string; unit?: string; hideMobile?: boolean }[]
  locale: string
  tooltipLabels: { rides: string; km: string }
}

export default function GlobeScene({
  visitedCountries,
  rideLines,
  mediaPins,
  mediaPanelLabels,
  label,
  tagline,
  subtitle,
  statItems,
  locale,
  tooltipLabels,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)

  const [selectedPin, setSelectedPin] = useState<MediaPin | null>(null)
  const selectedPinRef = useRef<MediaPin | null>(null)

  const handlePanelClose = useCallback(() => {
    setSelectedPin(null)
    selectedPinRef.current = null
  }, [])

  const router    = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  // Keep latest prop values accessible inside the effect closure without
  // re-running the entire Three.js setup on prop changes.
  const localeRef        = useRef(locale)
  const tooltipLabelsRef = useRef(tooltipLabels)
  localeRef.current        = locale
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
    let rotX        = 0     // pitch — locked upright (north always on top)
    let rotY        = 0     // yaw
    let targetZ     = 4.5
    let currentZ    = 4.5
    let hoveredCode: string | null = null
    let hoveredPin: MediaPin | null = null

    // ── Intro state ──────────────────────────────────────────────────────────
    // Phases: text → orient (rotate to Korea + zoom) → tour (auto country cycle) → done
    let introPhase: 'text' | 'orient' | 'tour' | 'done' = 'text'
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
      canvas.style.cursor = 'default'
      canvas.style.touchAction = 'none'  // prevent pull-to-refresh on mobile

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

      // ── Ride polylines ────────────────────────────────────────────────────
      if (rideLines && rideLines.length > 0) {
        const R_RIDE = GLOBE_RADIUS + 0.002
        const rideMat = new THREE.LineBasicMaterial({
          color: 0xff6b8a,
          opacity: 0.6,
          transparent: true,
        })

        for (const coords of rideLines) {
          const points = coords.map(([lat, lng]) => {
            const { x, y, z } = latLngToXYZ(lat, lng, R_RIDE)
            return new THREE.Vector3(x, y, z)
          })
          const geo = new THREE.BufferGeometry().setFromPoints(points)
          globeMesh.add(new THREE.Line(geo, rideMat))
        }
      }

      // ── Media Pin Markers (4-point star sprite) ────────────────────────────
      const markerStars: any[] = []     // THREE.Sprite[]
      const markerHitMeshes: any[] = []
      let markerFadeProgress = 0
      const STAR_SIZE = 0.018

      if (mediaPins && mediaPins.length > 0) {
        // Draw 4-point star on canvas
        const starCanvas = document.createElement('canvas')
        starCanvas.width = 64
        starCanvas.height = 64
        const ctx = starCanvas.getContext('2d')!
        ctx.clearRect(0, 0, 64, 64)
        ctx.fillStyle = '#ff6b8a'
        ctx.beginPath()
        const cx = 32, cy = 32, outer = 28, inner = 6
        for (let p = 0; p < 4; p++) {
          const angle = (p * Math.PI) / 2 - Math.PI / 2
          const midAngle = angle + Math.PI / 4
          ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
          ctx.lineTo(cx + Math.cos(midAngle) * inner, cy + Math.sin(midAngle) * inner)
        }
        ctx.closePath()
        ctx.fill()
        const starTexture = new THREE.CanvasTexture(starCanvas)

        for (let i = 0; i < mediaPins.length; i++) {
          const pin = mediaPins[i]
          const pos = latLngToXYZ(pin.lat, pin.lng, GLOBE_RADIUS + 0.003)

          const mat = new THREE.SpriteMaterial({
            map: starTexture,
            transparent: true,
            opacity: 0,
            depthTest: false,
            sizeAttenuation: false,
          })
          const sprite = new THREE.Sprite(mat)
          sprite.position.set(pos.x, pos.y, pos.z)
          sprite.scale.set(STAR_SIZE, STAR_SIZE, 1)
          sprite.userData.pinIndex = i
          globeMesh.add(sprite)
          markerStars.push(sprite)

          // Invisible hit sphere for raycasting
          const hitGeo = new THREE.SphereGeometry(0.02, 6, 6)
          const hitMat = new THREE.MeshBasicMaterial({ visible: false })
          const hitMesh = new THREE.Mesh(hitGeo, hitMat)
          hitMesh.position.set(pos.x, pos.y, pos.z)
          hitMesh.userData.mediaPin = pin
          hitMesh.userData.pinIndex = i
          globeMesh.add(hitMesh)
          markerHitMeshes.push(hitMesh)
        }
      }

      // ── Tour stops: group mediaPins by country, pick representative pin ───
      type TourStop = { pin: MediaPin; targetRotY: number; targetRotX: number }
      const tourStops: TourStop[] = []

      if (mediaPins && mediaPins.length > 0) {
        const byCountry = new Map<string, MediaPin>()
        for (const pin of mediaPins) {
          const cc = pin.countryCode || 'unknown'
          if (!byCountry.has(cc)) byCountry.set(cc, pin)
        }
        for (const pin of Array.from(byCountry.values())) {
          const phi = (90 - pin.lat) * Math.PI / 180
          const theta = (pin.lng + 180) * Math.PI / 180
          const px = -Math.sin(phi) * Math.cos(theta)
          const py = Math.cos(phi)
          const pz = Math.sin(phi) * Math.sin(theta)
          tourStops.push({
            pin,
            targetRotY: Math.atan2(-px, pz),
            targetRotX: Math.atan2(py, Math.sqrt(px * px + pz * pz)),
          })
        }
      }

      // ── Tour state (closure vars) ──────────────────────────────────────────
      let tourIndex = 0
      let tourPhase: 'move' | 'show' = 'move'
      let tourRotStartY = 0
      let tourRotStartX = 0
      let tourRotDeltaY = 0          // shortest-path delta for rotY
      let tourRotDeltaX = 0          // delta for rotX
      let tourPhaseStart = 0
      const TOUR_MOVE_SEC = 1.8      // rotation + zoom breathe combined
      const TOUR_SHOW_SEC = 4.0
      const TOUR_ZOOM_IN = 1.2       // close-up when showing panel
      const TOUR_ZOOM_BUMP = 0.5     // how much to zoom out at midpoint

      /** Normalize angle delta to [-π, π] for shortest rotation */
      function shortestDelta(from: number, to: number): number {
        let d = to - from
        d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
        return d
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
      const showTooltip = (cx: number, cy: number, html: string) => {
        if (!tt) return
        const rect = canvas.getBoundingClientRect()
        tt.innerHTML = html
        tt.style.left    = `${cx - rect.left + 16}px`
        tt.style.top     = `${cy - rect.top  - 10}px`
        tt.style.display = 'block'
      }
      const hideTooltip = () => { if (tt) tt.style.display = 'none' }

      // ── Tour cancel helper ──────────────────────────────────────────────────
      const cancelTour = () => {
        introPhase = 'done'
        setSelectedPin(null)
        selectedPinRef.current = null
        targetZ = currentZ
        canvas.style.cursor = 'grab'
      }

      // ── Event handlers ─────────────────────────────────────────────────────

      const onPointerDown = (e: PointerEvent) => {
        if (introPhase === 'tour') { cancelTour(); return }
        if (introPhase !== 'done') return
        if (selectedPinRef.current) return // panel open, suppress drag
        isDragging = true
        lastX = e.clientX
        lastY = e.clientY
        velX  = 0
        velY  = 0
        canvas.setPointerCapture(e.pointerId)
        canvas.style.cursor = 'grabbing'
        hideTooltip()
      }

      const onPointerMove = (e: PointerEvent) => {
        if (introPhase !== 'done') return

        if (isDragging) {
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

        // ── Hover: check media pin markers first, then globe → country ─────
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)

        // Check media pin hit meshes first
        if (markerHitMeshes.length > 0) {
          const pinHits = raycaster.intersectObjects(markerHitMeshes, false)
          if (pinHits.length > 0) {
            const pin = pinHits[0].object.userData.mediaPin as MediaPin
            hoveredPin = pin
            hoveredCode = null
            canvas.style.cursor = 'pointer'
            showTooltip(
              e.clientX, e.clientY,
              `<strong>${pin.rideName}</strong><br/><span style="color:#ff6b8a">&#9654; Media</span>`,
            )
            return
          }
        }
        hoveredPin = null

        const hitPt = new THREE.Vector3()
        const hit   = raycaster.ray.intersectSphere(globeSphere, hitPt)

        if (hit) {
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
                `<strong>${found.name}</strong><br/><span style="color:#9ca3af">${data.rides} ${labels.rides} · ${data.distanceKm.toLocaleString()} ${labels.km}</span>`,
              )
            } else {
              showTooltip(e.clientX, e.clientY, `<strong>${found.name}</strong>`)
            }
          } else {
            hoveredCode = null
            canvas.style.cursor = 'grab'
            hideTooltip()
          }
        } else {
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
        if (introPhase === 'tour') { cancelTour(); return }
        if (introPhase !== 'done') return
        if (selectedPinRef.current) return // panel open, ignore globe clicks
        if (hoveredPin) {
          selectedPinRef.current = hoveredPin
          setSelectedPin(hoveredPin)
          hideTooltip()
          return
        }
        if (hoveredCode && visitedCodes.has(hoveredCode)) {
          routerRef.current.push(`/${localeRef.current}/rides`)
        }
      }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        if (introPhase === 'tour') cancelTour()
        if (introPhase !== 'done') return
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
        if (introPhase === 'done' || introPhase === 'tour') tickShootingStars(dt, spaceT)

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
            if (tourStops.length > 0) {
              introPhase = 'tour'
              tourIndex = 0
              tourPhase = 'move'
              tourRotStartY = rotY
              tourRotStartX = rotX
              tourRotDeltaY = shortestDelta(rotY, tourStops[0].targetRotY)
              tourRotDeltaX = shortestDelta(rotX, tourStops[0].targetRotX)
              tourPhaseStart = performance.now()
            } else {
              introPhase = 'done'
              targetZ = KOREA_TARGET_Z
              canvas.style.cursor = 'grab'
            }
          }
        } else if (introPhase === 'tour') {
          // ── Auto country tour: move (rotate+zoom) → show ──────────────
          const now = performance.now()
          const phaseElapsed = (now - tourPhaseStart) / 1000
          const stop = tourStops[tourIndex]

          if (tourPhase === 'move') {
            // Rotation + zoom breathe happen simultaneously
            const t = Math.min(phaseElapsed / TOUR_MOVE_SEC, 1)
            const ease = smoothstep(t)

            // Rotate via shortest path
            rotY = tourRotStartY + tourRotDeltaY * ease
            rotX = tourRotStartX + tourRotDeltaX * ease

            // Zoom: breathe out at midpoint, back to ZOOM_IN at end
            // sin(π*t) peaks at 0.5 → gentle bump outward during move
            const breathe = Math.sin(Math.PI * t)
            currentZ = TOUR_ZOOM_IN + TOUR_ZOOM_BUMP * breathe
            camera.position.z = currentZ

            if (t >= 1) {
              tourPhase = 'show'
              currentZ = TOUR_ZOOM_IN
              camera.position.z = currentZ
              tourPhaseStart = now
              selectedPinRef.current = stop.pin
              setSelectedPin(stop.pin)
            }
          } else {
            // tourPhase === 'show' — display panel at close-up
            camera.position.z = currentZ
            if (phaseElapsed >= TOUR_SHOW_SEC) {
              setSelectedPin(null)
              selectedPinRef.current = null
              tourIndex = (tourIndex + 1) % tourStops.length
              const next = tourStops[tourIndex]
              tourPhase = 'move'
              tourRotStartY = rotY
              tourRotStartX = rotX
              tourRotDeltaY = shortestDelta(rotY, next.targetRotY)
              tourRotDeltaX = shortestDelta(rotX, next.targetRotX)
              tourPhaseStart = now
            }
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

        // ── Media pin marker animation (4-point stars) ────────────────────
        if (markerStars.length > 0 && (introPhase === 'done' || introPhase === 'tour')) {
          markerFadeProgress = Math.min(1, markerFadeProgress + dt * 1.25)
          const fadeIn = smoothstep(markerFadeProgress)
          for (let i = 0; i < markerStars.length; i++) {
            const star = markerStars[i]
            const phase = i * 0.5
            // Twinkle: opacity oscillates between 0.3 and 0.8
            const twinkle = 0.55 + 0.25 * Math.sin(spaceT * 2.2 + phase)
            star.material.opacity = fadeIn * twinkle
            // Slow rotation
            star.material.rotation = spaceT * 0.5 + phase
            // Gentle scale pulse
            const pulse = 1 + 0.2 * Math.sin(spaceT * 1.5 + phase * 1.3)
            const s = STAR_SIZE * pulse
            star.scale.set(s, s, 1)
          }
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
        markerStars.forEach(s => {
          s.material.map?.dispose()
          s.material.dispose()
        })
        markerHitMeshes.forEach(m => {
          m.geometry.dispose()
          m.material.dispose()
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
  }, [visitedCountries, rideLines, mediaPins])

  return (
    <div ref={containerRef} className="relative w-full h-[calc(100dvh-4rem)] bg-black overflow-hidden">

      {/* Media pin panel overlay */}
      {selectedPin && mediaPanelLabels && (
        <MediaPinPanel
          pin={selectedPin}
          onClose={handlePanelClose}
          locale={locale}
          labels={mediaPanelLabels}
        />
      )}

      {/* Country tooltip — updated via direct DOM manipulation */}
      <div
        ref={tooltipRef}
        style={{ display: 'none' }}
        className="absolute z-30 pointer-events-none
                   bg-black/80 backdrop-blur-sm text-white text-sm
                   px-3 py-2 rounded border border-gray-700 whitespace-nowrap"
      />

      {/* Text overlay — cinematic fade-in sequence */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4 md:pb-24">
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
    </div>
  )
}

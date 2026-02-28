'use client'

import { useEffect, useRef } from 'react'
import type { CountryBreakdown } from '@/lib/stats'

interface Props {
  visitedCountries: CountryBreakdown[]
  tooltipLabels?: { rides: string; km: string }
}

const DEFAULT_TOOLTIP = { rides: 'rides', km: 'km' }

export default function WorldMap({ visitedCountries, tooltipLabels = DEFAULT_TOOLTIP }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const visitedCodes = new Set(visitedCountries.map((c) => c.countryCode).filter(Boolean))

  useEffect(() => {
    if (!mapRef.current) return

    let mapInstance: import('leaflet').Map | null = null
    let mounted = true

    ;(async () => {
      const L = (await import('leaflet')).default

      if (!mounted || !mapRef.current) return

      mapInstance = L.map(mapRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapInstance)

      const geoRes = await fetch('/data/countries.geojson')
      if (!geoRes.ok || !mounted) return
      const geoJson = await geoRes.json()

      if (!mounted) return

      L.geoJSON(geoJson, {
        style: (feature) => {
          const code = feature?.properties?.ISO_A2
          const visited = visitedCodes.has(code)
          return {
            fillColor: visited ? '#ff6b8a' : '#2a2a2a',
            fillOpacity: visited ? 0.6 : 0.3,
            color: visited ? '#ff6b8a' : '#444',
            weight: visited ? 1.5 : 0.5,
          }
        },
        onEachFeature: (feature, layer) => {
          const code = feature?.properties?.ISO_A2
          const country = visitedCountries.find((c) => c.countryCode === code)
          if (country) {
            layer.bindTooltip(
              `<strong>${country.country}</strong><br/>${country.rides} ${tooltipLabels.rides} · ${country.distanceKm.toLocaleString()} ${tooltipLabels.km}`,
              { sticky: true }
            )
          }
        },
      }).addTo(mapInstance)
    })()

    return () => {
      mounted = false
      mapInstance?.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mapRef} className="w-full h-[500px] rounded-lg" />
}

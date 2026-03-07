"use client";

import { useEffect, useRef } from "react";

interface Props {
  polyline: string;
  className?: string;
}

export default function RideMap({ polyline, className }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || !polyline) return;

    let mapInstance: import("leaflet").Map | null = null;
    let mounted = true;

    (async () => {
      try {
        const L = (await import("leaflet")).default;

        if (!mounted || !mapRef.current) return;

        // polyline-encoded decode: returns [[lat, lng], ...]
        const polylineUtil = (await import("polyline-encoded")) as any;
        const decoder = polylineUtil.default || polylineUtil;
        const coords = decoder.decode(polyline) as [number, number][];

        mapInstance = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
        });

        L.control.attribution({ prefix: false })
          .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>')
          .addTo(mapInstance);

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { attribution: "" }
        ).addTo(mapInstance);

        const route = L.polyline(coords, {
          color: "#ff6b8a",
          weight: 3,
          opacity: 0.9,
        }).addTo(mapInstance);

        mapInstance.fitBounds(route.getBounds(), { padding: [40, 40] });
      } catch (err) {
        console.error("[RideMap] Failed to initialize:", err);
      }
    })();

    return () => {
      mounted = false;
      mapInstance?.remove();
    };
  }, [polyline]);

  return (
    <div ref={mapRef} className={className ?? "w-full h-96 rounded-lg"} />
  );
}

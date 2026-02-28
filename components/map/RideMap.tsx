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
      const L = (await import("leaflet")).default;

      if (!mounted || !mapRef.current) return;

      // polyline-encoded decode: returns [[lat, lng], ...]
      const { decode } = await import("polyline-encoded");
      const coords = decode(polyline) as [number, number][];

      mapInstance = L.map(mapRef.current, { zoomControl: true });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { attribution: "© OpenStreetMap contributors © CARTO" }
      ).addTo(mapInstance);

      const route = L.polyline(coords, {
        color: "#ff6b8a",
        weight: 3,
        opacity: 0.9,
      }).addTo(mapInstance);

      mapInstance.fitBounds(route.getBounds(), { padding: [40, 40] });
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

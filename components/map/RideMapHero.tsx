"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface StatItem {
  v: string;
  u: string;
  l: string;
}

interface Props {
  polyline: string;
  elevationData: { distance: number; altitude: number }[];
  name: string;
  country: string;
  date: string;
  stats: StatItem[];
  elevationLabel: string;
  kmSuffix: string;
}

export default function RideMapHero({
  polyline,
  elevationData,
  name,
  country,
  date,
  stats,
  elevationLabel,
  kmSuffix,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<[number, number][]>([]);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const progressRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [cursorKm, setCursorKm] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  // Init map
  useEffect(() => {
    if (!mapRef.current || !polyline) return;

    let mounted = true;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (!mounted || !mapRef.current) return;

        const polylineUtil = (await import("polyline-encoded")) as any;
        const decoder = polylineUtil.default || polylineUtil;
        const coords = decoder.decode(polyline) as [number, number][];
        coordsRef.current = coords;
        leafletRef.current = L;

        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
        });

        L.control
          .attribution({ prefix: false })
          .addAttribution(
            '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>'
          )
          .addTo(map);

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { attribution: "" }
        ).addTo(map);

        const route = L.polyline(coords, {
          color: "#ff6b8a",
          weight: 3,
          opacity: 0.9,
        }).addTo(map);

        map.fitBounds(route.getBounds(), { padding: [60, 60] });

        // Place marker at start
        const marker = L.circleMarker(coords[0], {
          radius: 6,
          color: "#fff",
          fillColor: "#fc4c02",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } catch (err) {
        console.error("[RideMapHero] Failed to initialize:", err);
      }
    })();

    return () => {
      mounted = false;
      cancelAnimationFrame(animRef.current);
      mapInstanceRef.current?.remove();
    };
  }, [polyline]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;

    const coords = coordsRef.current;
    if (coords.length < 2) return;

    const totalSteps = coords.length;
    const durationMs = Math.max(10000, Math.min(30000, totalSteps * 15));
    let startTime: number | null = null;
    const startProgress = progressRef.current;

    const tick = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const remaining = 1 - startProgress;
      const frac = Math.min(startProgress + (elapsed / durationMs) * remaining, 1);
      progressRef.current = frac;

      const idx = Math.min(Math.floor(frac * (totalSteps - 1)), totalSteps - 1);
      const pos = coords[idx];

      if (markerRef.current && pos) {
        markerRef.current.setLatLng(pos);
      }

      // Update elevation cursor
      if (elevationData.length > 0) {
        const kmFrac = frac * elevationData[elevationData.length - 1].distance;
        setCursorKm(Math.round(kmFrac * 10) / 10);
      }

      setProgress(frac);

      if (frac < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };

    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [playing, elevationData]);

  const handlePlay = useCallback(() => {
    if (progressRef.current >= 1) {
      // Reset first
      progressRef.current = 0;
      setProgress(0);
      setCursorKm(null);
      const coords = coordsRef.current;
      if (markerRef.current && coords[0]) {
        markerRef.current.setLatLng(coords[0]);
      }
    }
    setPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    cancelAnimationFrame(animRef.current);
    progressRef.current = 0;
    setProgress(0);
    setCursorKm(null);
    const coords = coordsRef.current;
    if (markerRef.current && coords[0]) {
      markerRef.current.setLatLng(coords[0]);
    }
  }, []);

  return (
    <div className="relative w-full">
      {/* Map */}
      <div ref={mapRef} className="w-full h-[70vh] min-h-[480px]" />

      {/* Gradient overlay at top for readability */}
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none z-[400]" />

      {/* Header + stats overlay */}
      <div className="absolute top-0 left-0 right-0 z-[401] px-4 md:px-8 pt-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-strava text-xs font-mono uppercase tracking-widest mb-2">
            {country} · {date}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg mb-5 font-ride-title">
            {name}
          </h1>
          <div className="flex gap-6 md:gap-10">
            {stats.map(({ v, u, l }) => (
              <div key={l} className="min-w-0">
                <p className="text-xl md:text-2xl font-mono font-bold text-white leading-tight drop-shadow">
                  {v}
                  {u && <span className="text-xs text-gray-300 ml-0.5">{u}</span>}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Replay controls */}
      <div className="absolute bottom-4 right-4 z-[401] flex items-center gap-2">
        {!playing ? (
          <button
            onClick={handlePlay}
            className="flex items-center gap-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-gray-700/50"
            title="재생"
          >
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M0 0l12 7-12 7z"/></svg>
            {progress > 0 && progress < 1 ? '계속' : '재생'}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-gray-700/50"
            title="일시정지"
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect x="0" y="0" width="3" height="12"/><rect x="7" y="0" width="3" height="12"/></svg>
            일시정지
          </button>
        )}
        {progress > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-gray-400 hover:text-white px-2.5 py-1.5 rounded-full text-xs transition-colors border border-gray-700/50"
            title="초기화"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1v4h4M11 6a5 5 0 10-1.5 3.5"/></svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-[401] h-0.5 bg-gray-800/50">
          <div
            className="h-full bg-strava transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Bottom gradient into elevation chart */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-[400]" />

      {/* Elevation chart fused to map bottom */}
      {elevationData.length > 0 && (
        <div className="w-full bg-black/80 backdrop-blur-sm border-t border-gray-900/50">
          <div className="w-full">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart
                data={elevationData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b8a" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ff6b8a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="distance"
                  tickFormatter={(v) => `${v}`}
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => `${v}m`}
                  tick={{ fill: "#666", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,0.85)",
                    border: "1px solid #333",
                    color: "#fff",
                    fontSize: 12,
                    borderRadius: 6,
                  }}
                  formatter={(value: number) => [`${value}m`, elevationLabel]}
                  labelFormatter={(label) => `${label}${kmSuffix}`}
                />
                {cursorKm !== null && (
                  <ReferenceLine
                    x={cursorKm}
                    stroke="#fc4c02"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="altitude"
                  stroke="#ff6b8a"
                  strokeWidth={1.5}
                  fill="url(#elevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

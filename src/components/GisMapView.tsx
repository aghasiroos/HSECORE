import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HeatRecord } from '../types';
import { Layers, Wind, Navigation } from 'lucide-react';

const safeFixed = (val: any, decimals = 1, fallback = '--'): string => {
  const num = Number(val);
  return !isNaN(num) && val !== null && val !== undefined ? num.toFixed(decimals) : fallback;
};

interface GisMapViewProps {
  activeRecord: HeatRecord | null;
  isFa: boolean;
  mapLayer: 'google-satellite' | 'google-roadmap' | 'google-hybrid' | 'terrain';
  setMapLayer: (layer: 'google-satellite' | 'google-roadmap' | 'google-hybrid' | 'terrain') => void;
  showRiskZones: boolean;
  showWindVectors: boolean;
  showWorkers: boolean;
  showIncidentLayer: boolean;
  showHeatStressLayer: boolean;
  industrialSites: Array<{ name: string; nameFa: string; lat: number; lon: number }>;
  onSelectLocation: (lat: number, lon: number, name: string) => void;
}

export const GisMapView: React.FC<GisMapViewProps> = ({
  activeRecord,
  isFa,
  mapLayer,
  setMapLayer,
  showRiskZones,
  showWindVectors,
  showWorkers,
  showIncidentLayer,
  showHeatStressLayer,
  industrialSites,
  onSelectLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Default coordinates fallback (Bandar Imam Khomeini SEZ)
  const defaultLat = activeRecord?.lat ?? 30.471003;
  const defaultLon = activeRecord?.lon ?? 49.090324;

  // 1. Tile Source Switcher Configuration
  const getTileConfig = (layer: typeof mapLayer) => {
    switch (layer) {
      case 'google-satellite':
        return {
          url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          attribution: '&copy; Google Maps Satellite',
          maxZoom: 20
        };
      case 'google-roadmap':
        return {
          url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          attribution: '&copy; Google Maps',
          maxZoom: 20
        };
      case 'google-hybrid':
        return {
          url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          attribution: '&copy; Google Maps Hybrid',
          maxZoom: 20
        };
      case 'terrain':
        return {
          url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
          attribution: '&copy; Google Maps Terrain',
          maxZoom: 20
        };
      default:
        return {
          url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          attribution: '&copy; Google Maps Satellite',
          maxZoom: 20
        };
    }
  };

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLon],
        zoom: 13,
        zoomControl: false,
      });

      // Add zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add base tile layer
      const cfg = getTileConfig(mapLayer);
      const tileLayer = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Group for dynamic overlays and markers
      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;

      // Map Click Handler to select coordinates
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setClickCoords({ lat, lon: lng });
        onSelectLocation(lat, lng, isFa ? `موقعیت انتخاب‌شده (${safeFixed(lat, 4)}, ${safeFixed(lng, 4)})` : `Selected Loc (${safeFixed(lat, 4)}, ${safeFixed(lng, 4)})`);
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 3. Update Tile Layer on mapLayer change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const cfg = getTileConfig(mapLayer);

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  }, [mapLayer]);

  // 4. Update Map view & Markers when activeRecord or overlays change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const currentLat = activeRecord?.lat ?? defaultLat;
    const currentLon = activeRecord?.lon ?? defaultLon;

    map.panTo([currentLat, currentLon], { animate: true });

    // A. Active Station Marker
    const activePulseHtml = `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-amber-400 opacity-75"></span>
        <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white font-extrabold shadow-lg border-2 border-white text-xs">
          📍
        </div>
      </div>
    `;

    const activeIcon = L.divIcon({
      html: activePulseHtml,
      className: 'custom-active-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const activeMarker = L.marker([currentLat, currentLon], { icon: activeIcon });
    
    const popupContent = `
      <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; padding: 4px; min-width: 195px;">
        <div style="font-weight: 800; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          ${activeRecord?.loc || (isFa ? "ایستگاه پایش زنده" : "Live Station")}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; color: #475569;">
          <div><b>${isFa ? "دما:" : "Temp:"}</b> ${safeFixed(activeRecord?.tempC, 1)}°C</div>
          <div><b>${isFa ? "رطوبت:" : "Hum:"}</b> ${activeRecord?.hum !== undefined ? activeRecord.hum : '--'}%</div>
          <div><b>${isFa ? "شاخص گرما:" : "HI:"}</b> <span style="color: #2563eb; font-weight: bold;">${activeRecord?.hiDisplay || safeFixed(activeRecord?.hi, 1)}°C</span></div>
          <div><b>${isFa ? "تخمین WBGT:" : "WBGT:"}</b> <span style="color: #059669; font-weight: bold;">${activeRecord?.wbgt !== undefined ? safeFixed(activeRecord.wbgt, 1) + '°C' : '--'}</span></div>
          <div><b>${isFa ? "سرعت باد:" : "Wind:"}</b> ${activeRecord?.wind !== undefined ? activeRecord.wind : '--'} km/h</div>
          <div><b>${isFa ? "منبع:" : "Source:"}</b> ${activeRecord?.provider || 'MET Norway'}</div>
        </div>
        <div style="margin-top: 6px; padding: 3px 6px; background-color: #fef3c7; color: #92400e; border-radius: 6px; font-size: 10px; font-weight: bold; text-align: center;">
          ${activeRecord?.cat || (isFa ? "پایش زنده فعال" : "Active Monitoring")}
        </div>
      </div>
    `;

    activeMarker.bindPopup(popupContent).addTo(group);

    // B. Industrial Sites Overlay
    industrialSites.forEach((site) => {
      if (site.lat === currentLat && site.lon === currentLon) return;

      const siteHtml = `
        <div class="flex items-center gap-1 bg-slate-900/90 text-amber-400 px-2.5 py-1 rounded-full border border-blue-500/40 shadow-md text-[10px] font-bold whitespace-nowrap cursor-pointer hover:scale-105 transition">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>${isFa ? site.nameFa : site.name}</span>
        </div>
      `;

      const siteIcon = L.divIcon({
        html: siteHtml,
        className: 'custom-site-marker',
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });

      const m = L.marker([site.lat, site.lon], { icon: siteIcon });
      m.on('click', () => {
        onSelectLocation(site.lat, site.lon, isFa ? site.nameFa : site.name);
      });
      m.addTo(group);
    });

    // C. Risk Zones (Industrial Sectors / Process Units)
    if (showRiskZones) {
      const zoneRadius = 800; // meters
      const dangerCircle = L.circle([currentLat, currentLon], {
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.15,
        radius: zoneRadius,
        weight: 1.5,
        dashArray: '4, 4',
      });
      dangerCircle.bindTooltip(isFa ? "محدوده فرآیندی پایش استرس گرمایی (شعاع ۸۰۰ متر)" : "Heat Stress Process Zone (800m Radius)").addTo(group);
    }

    // D. Personnel / Workers Overlay
    if (showWorkers) {
      const workerOffsets = [
        { dLat: 0.002, dLon: 0.003, name: "تیم ۱ - نگهداشت مخازن", code: "W-101", status: "نرمال" },
        { dLat: -0.0015, dLon: -0.002, name: "تیم ۲ - واحدهای عملیاتی", code: "W-102", status: "هشدار" },
        { dLat: 0.003, dLon: -0.001, name: "تیم ۳ - گشت ایمنی HSE", code: "W-103", status: "نرمال" },
      ];

      workerOffsets.forEach((w) => {
        const wLat = currentLat + w.dLat;
        const wLon = currentLon + w.dLon;

        const workerHtml = `
          <div class="bg-slate-800 text-white px-2 py-0.5 rounded-md border border-slate-600 text-[9px] font-bold flex items-center gap-1 shadow-sm">
            <span class="w-1.5 h-1.5 rounded-full ${w.status === 'هشدار' ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse"></span>
            <span>${w.code}</span>
          </div>
        `;

        const wIcon = L.divIcon({
          html: workerHtml,
          className: 'custom-worker-marker',
          iconSize: [60, 20],
          iconAnchor: [30, 10],
        });

        const wm = L.marker([wLat, wLon], { icon: wIcon });
        wm.bindPopup(`<b>${w.name}</b><br/>موقعیت آنلاین پرسنل<br/>وضعیت: ${w.status}`).addTo(group);
      });
    }

    // E. Heat Stress Contours / Heat Overlay
    if (showHeatStressLayer && activeRecord) {
      const hi = activeRecord.hi || 30;
      const heatColor = hi >= 40 ? '#dc2626' : hi >= 35 ? '#2563eb' : '#eab308';
      const heatCircle = L.circle([currentLat, currentLon], {
        color: heatColor,
        fillColor: heatColor,
        fillOpacity: 0.25,
        radius: 400,
        weight: 2,
      });
      heatCircle.bindTooltip(`${isFa ? "کانتور دمای حسی:" : "HI Contour:"} ${safeFixed(hi, 1)}°C`).addTo(group);
    }

  }, [activeRecord, mapLayer, showRiskZones, showWorkers, showHeatStressLayer, industrialSites, isFa]);

  // Center / Reset Map
  const handleResetCenter = () => {
    if (mapInstanceRef.current && activeRecord) {
      mapInstanceRef.current.setView([activeRecord.lat, activeRecord.lon], 14, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden rounded-3xl">
      {/* Top Floating Map Layer Selector Banner */}
      <div className="absolute top-3 left-3 right-14 z-[1000] flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/60 shadow-xl text-white text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="font-extrabold text-[11px]">
            {isFa ? "منبع نقشه زنده GIS:" : "Live GIS Map Source:"}
          </span>
        </div>

        {/* Map Source Selector Buttons */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setMapLayer('google-satellite')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
              mapLayer === 'google-satellite'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            {isFa ? "🛰️ ماهواره گوگل" : "🛰️ Google Satellite"}
          </button>

          <button
            type="button"
            onClick={() => setMapLayer('google-roadmap')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
              mapLayer === 'google-roadmap'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            {isFa ? "🗺️ نقشه گوگل" : "🗺️ Google Street"}
          </button>

          <button
            type="button"
            onClick={() => setMapLayer('google-hybrid')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
              mapLayer === 'google-hybrid'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            {isFa ? "🔀 ترکیبی گوگل" : "🔀 Google Hybrid"}
          </button>
        </div>

        {/* Center Button */}
        <button
          type="button"
          onClick={handleResetCenter}
          className="bg-slate-800 hover:bg-slate-700 text-amber-400 p-1.5 rounded-xl transition border border-slate-700 flex items-center gap-1 text-[10px] font-bold cursor-pointer"
          title={isFa ? "تمرکز روی موقعیت فعال" : "Center Active Site"}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isFa ? "مرکز" : "Center"}</span>
        </button>
      </div>

      {/* Main Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      {/* Bottom Floating Info Badge */}
      <div className="absolute bottom-3 right-3 left-3 z-[1000] pointer-events-none flex justify-between items-end">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-800 text-slate-200 text-xs shadow-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <div className="font-extrabold text-[11px] text-white">
              {activeRecord?.loc || (isFa ? "ایستگاه بدون نام" : "Station")}
            </div>
            <div className="text-[10px] text-slate-400 dir-ltr font-mono">
              Lat: {safeFixed(activeRecord?.lat, 5)} | Lon: {safeFixed(activeRecord?.lon, 5)}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto bg-amber-500/90 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-blue-400">
          {isFa ? "💡 راهنما: برای دریافت پایش هواشناسی روی هر نقطه کلیک کنید" : "💡 Click anywhere to sample telemetry"}
        </div>
      </div>
    </div>
  );
};

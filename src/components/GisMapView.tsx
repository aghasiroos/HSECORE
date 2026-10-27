import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HeatRecord } from '../types';
import { Layers, Navigation } from 'lucide-react';

const safeFixed = (val: any, decimals = 1, fallback = '--'): string => {
  const num = Number(val);
  return !isNaN(num) && val !== null && val !== undefined ? num.toFixed(decimals) : fallback;
};

interface GisMapViewProps {
  activeRecord: HeatRecord | null;
  isFa: boolean;
  isVisible?: boolean;
  mapLayer: 'google-satellite' | 'google-roadmap' | 'google-hybrid' | 'terrain';
  setMapLayer: (layer: 'google-satellite' | 'google-roadmap' | 'google-hybrid' | 'terrain') => void;
  showWeatherLayer?: boolean;
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
  isVisible = true,
  mapLayer,
  setMapLayer,
  showWeatherLayer = true,
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
  const hadZeroSizeRef = useRef<boolean>(true);
  const [, setClickCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Default coordinates fallback (Bandar Imam Khomeini SEZ)
  const defaultLat = activeRecord?.lat ?? 30.471003;
  const defaultLon = activeRecord?.lon ?? 49.090324;
  const latestCoordsRef = useRef<{ lat: number; lon: number }>({ lat: defaultLat, lon: defaultLon });
  latestCoordsRef.current = {
    lat: activeRecord?.lat ?? defaultLat,
    lon: activeRecord?.lon ?? defaultLon,
  };

  // 1. Tile Source Switcher Configuration (with multi-subdomain + fallback URL)
  const getTileConfig = (layer: typeof mapLayer) => {
    switch (layer) {
      case 'google-satellite':
        return {
          url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Google Maps Satellite',
          maxZoom: 20,
        };
      case 'google-roadmap':
        return {
          url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; Google Maps',
          maxZoom: 20,
        };
      case 'google-hybrid':
        return {
          url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Google Maps Hybrid',
          maxZoom: 20,
        };
      case 'terrain':
        return {
          url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; Google Maps Terrain',
          maxZoom: 20,
        };
      default:
        return {
          url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Google Maps Satellite',
          maxZoom: 20,
        };
    }
  };

  const createResilientTileLayer = (layerType: typeof mapLayer, map: L.Map) => {
    const cfg = getTileConfig(layerType);
    let fallbackActivated = false;
    let errorCount = 0;

    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: true,
      crossOrigin: true,
    });

    layer.on('tileerror', () => {
      errorCount += 1;
      if (!fallbackActivated && errorCount >= 4 && mapInstanceRef.current === map) {
        fallbackActivated = true;
        const fallbackLayer = L.tileLayer(cfg.fallbackUrl, {
          attribution: cfg.attribution,
          maxZoom: 19,
          keepBuffer: 4,
          updateWhenIdle: false,
        });
        if (tileLayerRef.current === layer) {
          map.removeLayer(layer);
          fallbackLayer.addTo(map);
          tileLayerRef.current = fallbackLayer;
        }
      }
    });

    return layer;
  };

  // 2. Initialize Leaflet Map & ResizeObserver
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!mapInstanceRef.current) {
      const rect = container.getBoundingClientRect();
      hadZeroSizeRef.current = rect.width < 50 || rect.height < 50;

      const map = L.map(container, {
        center: [defaultLat, defaultLon],
        zoom: 14,
        zoomControl: false,
        preferCanvas: true,
      });

      // Add zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add base tile layer
      const tileLayer = createResilientTileLayer(mapLayer, map).addTo(map);
      tileLayerRef.current = tileLayer;

      // Group for dynamic overlays and markers
      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;

      // Map Click Handler to select coordinates
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setClickCoords({ lat, lon: lng });
        onSelectLocation(
          lat,
          lng,
          isFa
            ? `موقعیت انتخاب‌شده (${safeFixed(lat, 4)}, ${safeFixed(lng, 4)})`
            : `Selected Loc (${safeFixed(lat, 4)}, ${safeFixed(lng, 4)})`
        );
      });

      mapInstanceRef.current = map;
    }

    // Observe container size changes (crucial when switching from hidden tab to visible grid)
    const syncMapDimensions = () => {
      const map = mapInstanceRef.current;
      const el = mapContainerRef.current;
      if (!map || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        map.invalidateSize({ animate: false, pan: false });
        if (hadZeroSizeRef.current) {
          hadZeroSizeRef.current = false;
          const { lat, lon } = latestCoordsRef.current;
          map.setView([lat, lon], map.getZoom() || 14, { animate: false });
        }
      } else {
        hadZeroSizeRef.current = true;
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(syncMapDimensions);
      });
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', syncMapDimensions);

    return () => {
      window.removeEventListener('resize', syncMapDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2b. Force invalidateSize & re-center when tab becomes visible
  useEffect(() => {
    if (!isVisible || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const { lat, lon } = latestCoordsRef.current;

    const refreshLayout = () => {
      if (!mapInstanceRef.current) return;
      map.invalidateSize({ animate: false, pan: false });
      map.setView([lat, lon], map.getZoom() || 14, { animate: false });
    };

    const rafId = requestAnimationFrame(refreshLayout);
    const t1 = window.setTimeout(refreshLayout, 120);
    const t2 = window.setTimeout(refreshLayout, 380);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isVisible]);

  // 3. Update Tile Layer on mapLayer change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = createResilientTileLayer(mapLayer, map).addTo(map);
    tileLayerRef.current = newTileLayer;
    map.invalidateSize({ animate: false, pan: false });
  }, [mapLayer]);

  // 4. Update Map view & Markers when activeRecord or overlays change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const currentLat = activeRecord?.lat ?? defaultLat;
    const currentLon = activeRecord?.lon ?? defaultLon;

    const containerRect = mapContainerRef.current?.getBoundingClientRect();
    if (containerRect && containerRect.width > 50 && containerRect.height > 50) {
      map.invalidateSize({ animate: false, pan: false });
      map.setView([currentLat, currentLon], map.getZoom() || 14, { animate: true });
    }

    // A. Weather Radar Overlay (پوشش رادار هواشناسی)
    if (showWeatherLayer) {
      const radarOuter = L.circle([currentLat, currentLon], {
        color: '#0ea5e9',
        fillColor: '#38bdf8',
        fillOpacity: 0.08,
        radius: 1350,
        weight: 1,
        dashArray: '6, 6',
      });
      radarOuter
        .bindTooltip(
          isFa
            ? `پوشش رادار هواشناسی (بارش: ${safeFixed((activeRecord as any)?.precip ?? 0, 1)} mm | ابرناکی: ${(activeRecord as any)?.cloud ?? 0}%)`
            : `Weather Radar Coverage (Precip: ${safeFixed((activeRecord as any)?.precip ?? 0, 1)} mm | Cloud: ${(activeRecord as any)?.cloud ?? 0}%)`
        )
        .addTo(group);
    }

    // B. Active Station Marker
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

    // C. Industrial Sites Overlay
    industrialSites.forEach((site) => {
      if (Math.abs(site.lat - currentLat) < 0.0001 && Math.abs(site.lon - currentLon) < 0.0001) return;

      const siteHtml = `
        <div class="flex items-center gap-1 bg-slate-900/90 text-amber-400 px-2.5 py-1 rounded-full border border-blue-500/40 shadow-md text-[10px] font-bold whitespace-nowrap cursor-pointer hover:scale-105 transition">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>${isFa ? site.nameFa : site.name}</span>
        </div>
      `;

      const siteIcon = L.divIcon({
        html: siteHtml,
        className: 'custom-site-marker',
        iconSize: [140, 24],
        iconAnchor: [70, 12],
      });

      const m = L.marker([site.lat, site.lon], { icon: siteIcon });
      m.on('click', () => {
        onSelectLocation(site.lat, site.lon, isFa ? site.nameFa : site.name);
      });
      m.addTo(group);
    });

    // D. Risk Zones (Industrial Sectors / Process Units)
    if (showRiskZones) {
      const zoneRadius = 800; // meters
      const dangerCircle = L.circle([currentLat, currentLon], {
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.14,
        radius: zoneRadius,
        weight: 1.5,
        dashArray: '4, 4',
      });
      dangerCircle
        .bindTooltip(isFa ? "محدوده فرآیندی پایش استرس گرمایی (شعاع ۸۰۰ متر)" : "Heat Stress Process Zone (800m Radius)")
        .addTo(group);
    }

    // E. Personnel / Workers Overlay
    if (showWorkers) {
      const workerOffsets = [
        { dLat: 0.0022, dLon: 0.0032, name: "تیم ۱ - نگهداشت مخازن", code: "W-101", status: "نرمال" },
        { dLat: -0.0018, dLon: -0.0024, name: "تیم ۲ - واحدهای عملیاتی", code: "W-102", status: "هشدار" },
        { dLat: 0.0031, dLon: -0.0015, name: "تیم ۳ - گشت ایمنی HSE", code: "W-103", status: "نرمال" },
      ];

      workerOffsets.forEach((w) => {
        const wLat = currentLat + w.dLat;
        const wLon = currentLon + w.dLon;

        const workerHtml = `
          <div class="bg-slate-800 text-white px-2 py-0.5 rounded-md border border-slate-600 text-[9px] font-bold flex items-center gap-1 shadow-sm whitespace-nowrap">
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
        wm.bindPopup(
          `<div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right;"><b>${w.name}</b><br/>موقعیت آنلاین پرسنل<br/>وضعیت: ${w.status}</div>`
        ).addTo(group);
      });
    }

    // F. Incident & Hazard Reports Layer (محل ثبت حوادث و گزارشات)
    if (showIncidentLayer) {
      const incidents = [
        {
          dLat: 0.0014,
          dLon: -0.0034,
          code: 'INC-204',
          titleFa: 'گزارش تنش حرارتی - سکوی بارگیری',
          titleEn: 'Heat Exhaustion Alert - Loading Bay',
          severity: 'high',
        },
        {
          dLat: -0.0029,
          dLon: 0.0021,
          code: 'INC-198',
          titleFa: 'شبه‌حادثه دمای سطحی بالا - کمپرسور B',
          titleEn: 'High Surface Temp Near-Miss - Compressor B',
          severity: 'medium',
        },
      ];

      incidents.forEach((inc) => {
        const iLat = currentLat + inc.dLat;
        const iLon = currentLon + inc.dLon;
        const badgeBg = inc.severity === 'high' ? 'bg-rose-600 border-rose-300' : 'bg-amber-600 border-amber-300';

        const incHtml = `
          <div class="${badgeBg} text-white px-2 py-0.5 rounded-md border text-[9px] font-extrabold flex items-center gap-1 shadow-md whitespace-nowrap">
            <span>⚠️</span>
            <span>${inc.code}</span>
          </div>
        `;

        const incIcon = L.divIcon({
          html: incHtml,
          className: 'custom-incident-marker',
          iconSize: [68, 22],
          iconAnchor: [34, 11],
        });

        L.marker([iLat, iLon], { icon: incIcon })
          .bindPopup(
            `<div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; font-size: 11px;">
              <b style="color:#e11d48;">${inc.code}</b><br/>
              ${isFa ? inc.titleFa : inc.titleEn}
            </div>`
          )
          .addTo(group);
      });
    }

    // G. Heat Stress Contours / Heat Overlay (کنتورهای استرس گرمایی OSHA)
    if (showHeatStressLayer) {
      const hi = activeRecord?.hi ?? 32;
      const heatColor = hi >= 40 ? '#dc2626' : hi >= 35 ? '#f97316' : '#eab308';
      const heatCircle = L.circle([currentLat, currentLon], {
        color: heatColor,
        fillColor: heatColor,
        fillOpacity: 0.22,
        radius: 420,
        weight: 2,
      });
      heatCircle
        .bindTooltip(`${isFa ? "کانتور دمای حسی (OSHA):" : "OSHA HI Contour:"} ${safeFixed(hi, 1)}°C`)
        .addTo(group);
    }

    // H. Dynamic Wind Vectors (جریان باد دینامیکی)
    if (showWindVectors) {
      const windDeg = Number(activeRecord?.windDir ?? 310);
      const windSpeed = safeFixed(activeRecord?.wind ?? 14, 1);
      const vectorOffsets = [
        { dLat: 0.0042, dLon: 0.0042 },
        { dLat: -0.0042, dLon: 0.0042 },
        { dLat: 0.0042, dLon: -0.0042 },
        { dLat: -0.0042, dLon: -0.0042 },
      ];

      vectorOffsets.forEach((v) => {
        const vLat = currentLat + v.dLat;
        const vLon = currentLon + v.dLon;
        const windHtml = `
          <div class="bg-sky-950/85 text-sky-300 px-1.5 py-0.5 rounded-full border border-sky-400/50 text-[9px] font-bold flex items-center gap-1 shadow-sm whitespace-nowrap">
            <span style="display:inline-block; transform: rotate(${windDeg}deg);">↑</span>
            <span>${windSpeed} km/h</span>
          </div>
        `;
        const windIcon = L.divIcon({
          html: windHtml,
          className: 'custom-wind-marker',
          iconSize: [74, 20],
          iconAnchor: [37, 10],
        });
        L.marker([vLat, vLon], { icon: windIcon })
          .bindTooltip(
            isFa
              ? `بردار جریان باد: ${windSpeed} km/h (${windDeg}°)`
              : `Wind Vector: ${windSpeed} km/h (${windDeg}°)`
          )
          .addTo(group);
      });
    }
  }, [
    activeRecord,
    mapLayer,
    showWeatherLayer,
    showRiskZones,
    showWorkers,
    showIncidentLayer,
    showHeatStressLayer,
    showWindVectors,
    industrialSites,
    isFa,
  ]);

  // Center / Reset Map
  const handleResetCenter = () => {
    if (mapInstanceRef.current) {
      const targetLat = activeRecord?.lat ?? defaultLat;
      const targetLon = activeRecord?.lon ?? defaultLon;
      mapInstanceRef.current.invalidateSize({ animate: false, pan: false });
      mapInstanceRef.current.setView([targetLat, targetLon], 14, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[600px] flex-1 flex flex-col overflow-hidden rounded-3xl">
      {/* Top Floating Map Layer Selector Banner */}
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="absolute top-3 left-3 right-14 z-[1000] flex flex-wrap items-center justify-between gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/60 shadow-xl text-white text-xs"
      >
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

      {/* Main Map Canvas (strictly LTR so Leaflet tile grid coordinates never invert in RTL UI) */}
      <div
        ref={mapContainerRef}
        dir="ltr"
        className="w-full h-full flex-1 min-h-[580px] z-0 bg-slate-900"
      />

      {/* Bottom Floating Info Badge */}
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="absolute bottom-3 right-3 left-3 z-[1000] pointer-events-none flex justify-between items-end gap-2"
      >
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-800 text-slate-200 text-xs shadow-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <div className="font-extrabold text-[11px] text-white">
              {activeRecord?.loc || (isFa ? "ایستگاه بدون نام" : "Station")}
            </div>
            <div dir="ltr" className="text-[10px] text-slate-400 font-mono text-left">
              Lat: {safeFixed(activeRecord?.lat ?? defaultLat, 5)} | Lon: {safeFixed(activeRecord?.lon ?? defaultLon, 5)}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto bg-amber-500/90 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-amber-300">
          {isFa ? "💡 راهنما: برای دریافت پایش هواشناسی روی هر نقطه کلیک کنید" : "💡 Click anywhere to sample telemetry"}
        </div>
      </div>
    </div>
  );
};

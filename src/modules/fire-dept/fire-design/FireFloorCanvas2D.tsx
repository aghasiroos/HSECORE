import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Ruler,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Printer,
  CheckCircle2,
  Move,
  History,
  Layers,
  Crosshair,
} from 'lucide-react';
import type {
  CalibrationLine,
  CoverageMapCell,
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignLayout,
  FloorCalculationResult,
  PlacedSuppressionItem,
} from './types';
import { fireDesignApi, printHtmlSafely } from './fireDesignApi';
import {
  computeCoverageGrid,
  detectOverDensityConflicts,
  ENGINEERING_DISCLAIMER_FA,
} from './nfpaEngine';

interface Props {
  isFa: boolean;
  canWrite: boolean;
  canApprove: boolean;
  building: FireDesignBuilding;
  floor: FireDesignFloor;
  calc: FloorCalculationResult;
  placedItems: PlacedSuppressionItem[];
  activeRevisionStatus?: string;
  floorRevisions?: FireDesignLayout[];
  onLoadRevision?: (rev: FireDesignLayout) => void;
  onChangePlacedItems: (items: PlacedSuppressionItem[]) => void;
  onFloorPlanUploaded: (patch: Partial<FireDesignFloor>) => Promise<void>;
  onSaveRevision: () => Promise<void>;
  onApproveRevision?: () => Promise<void>;
}

type ToolMode =
  | 'SELECT_MOVE'
  | 'CALIBRATE'
  | 'MEASURE'
  | 'ADD_SPRINKLER'
  | 'ADD_EXTINGUISHER'
  | 'ADD_EXISTING_EXT'
  | 'ADD_HYDRANT'
  | 'ADD_DETECTOR'
  | 'ADD_PULL_STATION'
  | 'ADD_CLEAN_NOZZLE';

type CoverageOverlayMode = 'OFF' | 'COMBINED' | 'SPRINKLER' | 'EXTINGUISHER' | 'HYDRANT' | 'ALARM' | 'CLEAN_AGENT';

export default function FireFloorCanvas2D({
  isFa,
  canWrite,
  canApprove,
  building,
  floor,
  calc,
  placedItems,
  activeRevisionStatus,
  floorRevisions = [],
  onLoadRevision,
  onChangePlacedItems,
  onFloorPlanUploaded,
  onSaveRevision,
  onApproveRevision,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = useState<ToolMode>('SELECT_MOVE');
  const [zoom, setZoom] = useState(1);
  const [showProposed, setShowProposed] = useState(true);
  const [showExisting, setShowExisting] = useState(true);
  const [showCoverageRadii, setShowCoverageRadii] = useState(true);
  const [showBlindSpots, setShowBlindSpots] = useState(true);
  const [coverageMode, setCoverageMode] = useState<CoverageOverlayMode>('OFF');
  const [inspectedCell, setInspectedCell] = useState<CoverageMapCell | null>(null);
  const [showRevisionsDrawer, setShowRevisionsDrawer] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Uploaded plan image preview
  const [planBgUrl, setPlanBgUrl] = useState<string | null>(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [planStatusMsg, setPlanStatusMsg] = useState<string | null>(null);

  // 2-point scale calibration
  const [calibP1, setCalibP1] = useState<{ xM: number; yM: number } | null>(null);
  const [calibP2, setCalibP2] = useState<{ xM: number; yM: number } | null>(null);
  const [calibDistanceM, setCalibDistanceM] = useState<string>('10');

  // Point-to-point ruler measurement
  const [measureP1, setMeasureP1] = useState<{ xM: number; yM: number } | null>(null);
  const [measureP2, setMeasureP2] = useState<{ xM: number; yM: number } | null>(null);

  const [savingRev, setSavingRev] = useState(false);

  const L = Math.max(4, floor.lengthM || 20);
  const W = Math.max(4, floor.widthM || 15);

  // Canvas coordinate system: 1 meter = pxPerMeter (scaled nicely into ~900px viewBox)
  const pxPerMeter = 840 / Math.max(L, W);
  const vbWidth = L * pxPerMeter;
  const vbHeight = W * pxPerMeter;

  useEffect(() => {
    let activeUrl: string | null = null;
    let cancelled = false;
    if (floor.floorPlanFileId) {
      fireDesignApi
        .fetchFloorPlanImageUrl(floor.floorPlanFileId, floor.floorPlanMimeType)
        .then((res) => {
          if (cancelled) {
            URL.revokeObjectURL(res.objectUrl);
            return;
          }
          activeUrl = res.objectUrl;
          setPlanBgUrl(res.objectUrl);
        })
        .catch(() => {
          setPlanBgUrl(null);
        });
    } else {
      setPlanBgUrl(null);
    }
    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [floor.floorPlanFileId, floor.floorPlanMimeType]);

  const clientToMeters = (clientX: number, clientY: number): { xM: number; yM: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;
    const xM = Math.max(0.2, Math.min(L - 0.2, Number((normX * L).toFixed(2))));
    const yM = Math.max(0.2, Math.min(W - 0.2, Number((normY * W).toFixed(2))));
    return { xM, yM };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingId) return;
    const pt = clientToMeters(e.clientX, e.clientY);
    if (!pt) return;

    if (tool === 'CALIBRATE') {
      if (!calibP1 || (calibP1 && calibP2)) {
        setCalibP1(pt);
        setCalibP2(null);
      } else {
        setCalibP2(pt);
      }
      return;
    }

    if (tool === 'MEASURE') {
      if (!measureP1 || (measureP1 && measureP2)) {
        setMeasureP1(pt);
        setMeasureP2(null);
      } else {
        setMeasureP2(pt);
      }
      return;
    }

    if (!canWrite) return;

    if (tool === 'ADD_SPRINKLER') {
      const nextNum = placedItems.filter((p) => p.kind.startsWith('SPRINKLER')).length + 1;
      const newItem: PlacedSuppressionItem = {
        id: `sp-man-${Date.now()}`,
        kind: 'SPRINKLER_PROPOSED',
        systemType: 'SPRINKLER_NFPA13',
        origin: 'PROPOSED',
        code: `SP-${floor.floorCode}-${String(nextNum).padStart(2, '0')}`,
        label: `اسپرینکلر دستی #${nextNum}`,
        xM: pt.xM,
        yM: pt.yM,
        coverageRadiusM: Number((calc.sprinkler.maxSpacingM / 1.414).toFixed(2)),
        kFactor: calc.sprinkler.kFactor,
        sprinklerHeadType: calc.sprinkler.recommendedHeadLabelFa,
      };
      onChangePlacedItems([...placedItems, newItem]);
      setSelectedId(newItem.id);
      return;
    }

    if (tool === 'ADD_EXTINGUISHER' || tool === 'ADD_EXISTING_EXT') {
      const isExisting = tool === 'ADD_EXISTING_EXT';
      const nextNum = placedItems.filter((p) => p.kind.startsWith('EXTINGUISHER')).length + 1;
      const newItem: PlacedSuppressionItem = {
        id: `ext-man-${Date.now()}`,
        kind: isExisting ? 'EXTINGUISHER_EXISTING' : 'EXTINGUISHER_PROPOSED',
        systemType: 'EXTINGUISHER_NFPA10',
        origin: isExisting ? 'EXISTING' : 'PROPOSED',
        code: `${isExisting ? 'EX' : 'FE'}-${floor.floorCode}-${String(nextNum).padStart(2, '0')}`,
        label: isExisting ? `کپسول موجود #${nextNum}` : `کپسول پیشنهادی #${nextNum}`,
        xM: pt.xM,
        yM: pt.yM,
        coverageRadiusM: Number(Math.min(18, calc.extinguisher.maxTravelDistanceClassAM).toFixed(1)),
        agentType: calc.extinguisher.recommendedPrimaryAgent,
        capacityLabel: '۶ کیلوگرم',
      };
      onChangePlacedItems([...placedItems, newItem]);
      setSelectedId(newItem.id);
      return;
    }

    if (tool === 'ADD_HYDRANT') {
      const nextNum = placedItems.filter((p) => p.kind.startsWith('HYDRANT') || p.kind === 'HOSE_BOX').length + 1;
      const newItem: PlacedSuppressionItem = {
        id: `hyd-man-${Date.now()}`,
        kind: 'HYDRANT_HOSE_PROPOSED',
        systemType: 'STANDPIPE_HYDRANT_NFPA14',
        origin: 'PROPOSED',
        code: `HB-${floor.floorCode}-${String(nextNum).padStart(2, '0')}`,
        label: `جعبه آتش‌نشانی / هیدرانت #${nextNum}`,
        xM: pt.xM,
        yM: pt.yM,
        coverageRadiusM: 36,
        capacityLabel: 'شیلنگ ۳۰m',
      };
      onChangePlacedItems([...placedItems, newItem]);
      setSelectedId(newItem.id);
      return;
    }

    if (tool === 'ADD_DETECTOR') {
      const nextNum = placedItems.filter((p) => p.kind.startsWith('DETECTOR')).length + 1;
      const newItem: PlacedSuppressionItem = {
        id: `det-man-${Date.now()}`,
        kind: 'DETECTOR_SMOKE',
        systemType: 'FIRE_ALARM_NFPA72',
        origin: 'PROPOSED',
        code: `SD-${floor.floorCode}-${String(nextNum).padStart(2, '0')}`,
        label: `دتکتور دود اعلام حریق #${nextNum}`,
        xM: pt.xM,
        yM: pt.yM,
        coverageRadiusM: 6.4,
      };
      onChangePlacedItems([...placedItems, newItem]);
      setSelectedId(newItem.id);
      return;
    }

    if (tool === 'ADD_PULL_STATION') {
      const nextNum = placedItems.filter((p) => p.kind === 'PULL_STATION').length + 1;
      const newItem: PlacedSuppressionItem = {
        id: `mcp-man-${Date.now()}`,
        kind: 'PULL_STATION',
        systemType: 'FIRE_ALARM_NFPA72',
        origin: 'PROPOSED',
        code: `MCP-${floor.floorCode}-${String(nextNum).padStart(2, '0')}`,
        label: `شستی اعلام حریق #${nextNum}`,
        xM: pt.xM,
        yM: pt.yM,
        coverageRadiusM: 30,
      };
      onChangePlacedItems([...placedItems, newItem]);
      setSelectedId(newItem.id);
      return;
    }

    if (tool === 'ADD_CLEAN_NOZZLE') {
      const nextNum = placedItems.filter((p) => p.kind === 'CLEAN_AGENT_NOZZLE').length + 1;
      const newItem: PlacedSuppressionItem = {
        id: `ca-man-${Date.now()}`,
        kind: 'CLEAN_AGENT_NOZZLE',
        systemType: 'CLEAN_AGENT_NFPA2001',
        origin: 'PROPOSED',
        code: `FM-${floor.floorCode}-${String(nextNum).padStart(2, '0')}`,
        label: `نازل گاز پاک #${nextNum}`,
        xM: pt.xM,
        yM: pt.yM,
        coverageRadiusM: 4.5,
      };
      onChangePlacedItems([...placedItems, newItem]);
      setSelectedId(newItem.id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId || !canWrite) return;
    const pt = clientToMeters(e.clientX, e.clientY);
    if (!pt) return;
    onChangePlacedItems(
      placedItems.map((it) => (it.id === draggingId ? { ...it, xM: pt.xM, yM: pt.yM } : it))
    );
  };

  const handlePointerUp = () => {
    if (draggingId) setDraggingId(null);
  };

  const handleApplyCalibration = async () => {
    if (!calibP1 || !calibP2) return;
    const realDist = Number(calibDistanceM);
    if (!realDist || realDist <= 0) return;

    const currentDrawnDist = Math.hypot(calibP2.xM - calibP1.xM, calibP2.yM - calibP1.yM);
    if (currentDrawnDist <= 0.05) return;

    const ratio = realDist / currentDrawnDist;
    const newLengthM = Number((L * ratio).toFixed(2));
    const newWidthM = Number((W * ratio).toFixed(2));
    const newAreaSqm = Number((newLengthM * newWidthM).toFixed(2));
    const calLine: CalibrationLine = {
      x1Px: calibP1.xM * pxPerMeter,
      y1Px: calibP1.yM * pxPerMeter,
      x2Px: calibP2.xM * pxPerMeter,
      y2Px: calibP2.yM * pxPerMeter,
      realDistanceMeters: realDist,
    };

    await onFloorPlanUploaded({
      lengthM: newLengthM,
      widthM: newWidthM,
      areaSqm: newAreaSqm,
      calibrationLine: calLine,
      scaleMetersPerPixel: Number((realDist / Math.hypot(calLine.x2Px - calLine.x1Px, calLine.y2Px - calLine.y1Px)).toFixed(5)),
    });
    setPlanStatusMsg(`مقیاس نقشه کالیبره شد: ابعاد جدید ${newLengthM} × ${newWidthM} متر (${newAreaSqm} m²)`);
    setCalibP1(null);
    setCalibP2(null);
    setTool('SELECT_MOVE');
  };

  const handlePlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPlan(true);
    setPlanStatusMsg(null);
    try {
      const uploaded = await fireDesignApi.uploadFloorPlanFile(file, floor.id);
      const preview = await fireDesignApi.fetchFloorPlanImageUrl(uploaded.fileId, uploaded.mimeType);
      setPlanBgUrl(preview.objectUrl);
      await onFloorPlanUploaded({
        floorPlanFileId: uploaded.fileId,
        floorPlanFileName: uploaded.originalName,
        floorPlanMimeType: uploaded.mimeType,
        floorPlanWidthPx: preview.widthPx,
        floorPlanHeightPx: preview.heightPx,
      });
      setPlanStatusMsg(`نقشه «${uploaded.originalName}» بارگذاری شد. برای کالیبراسیون مقیاس، ابزار خط‌کش را انتخاب کنید.`);
    } catch (err: any) {
      setPlanStatusMsg(err?.message || 'خطا در بارگذاری نقشه پلان');
    } finally {
      setUploadingPlan(false);
      e.target.value = '';
    }
  };

  const handleAutoPlace = () => {
    const existingPinned = placedItems.filter((p) => p.origin === 'EXISTING');
    onChangePlacedItems([...existingPinned, ...calc.suggestedItems]);
    setSelectedId(null);
  };

  const handlePrintMapPdf = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);

    printHtmlSafely(`<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8" />
<title>نقشه جانمایی اطفای حریق - ${building.name} - ${floor.floorLabel}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; margin: 20px; color: #0f172a; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
  .meta { font-size: 12px; line-height: 1.7; }
  .map-box { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
  .map-box svg { max-width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; }
  th { background: #f1f5f9; }
  .disclaimer { margin-top: 14px; padding: 8px; border: 1px solid #f59e0b; background: #fffbeb; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin:0 0 4px 0;">نقشه مهندسی جانمایی سیستم‌های اطفای حریق (NFPA 13 / NFPA 10)</h2>
      <div class="meta">ساختمان: <strong>${building.name} (${building.code})</strong> | واحد: ${building.unitName} | طبقه: <strong>${floor.floorLabel}</strong></div>
    </div>
    <div class="meta" style="text-align:left;">
      <div>ابعاد: ${floor.lengthM} × ${floor.widthM} m (${floor.areaSqm} m²)</div>
      <div>گروه خطر: ${calc.hazardGroupLabelFa}</div>
    </div>
  </div>
  <div class="map-box">${svgString}</div>
  <table>
    <thead>
      <tr><th>کد</th><th>تجهیز</th><th>وضعیت</th><th>X (m)</th><th>Y (m)</th><th>شعاع (m)</th><th>مشخصات</th></tr>
    </thead>
    <tbody>
      ${placedItems
        .map(
          (p) =>
            `<tr><td>${p.code}</td><td>${p.label}</td><td>${p.origin === 'EXISTING' ? 'موجود' : 'پیشنهادی'}</td><td>${p.xM}</td><td>${p.yM}</td><td>${p.coverageRadiusM}</td><td>${p.capacityLabel || p.sprinklerHeadType || '-'}</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="disclaimer">${ENGINEERING_DISCLAIMER_FA}</div>
</body>
</html>`);
  };

  const selectedItem = placedItems.find((p) => p.id === selectedId) || null;

  const visibleItems = placedItems.filter((p) => {
    if (p.origin === 'PROPOSED' && !showProposed) return false;
    if (p.origin === 'EXISTING' && !showExisting) return false;
    return true;
  });

  const overDensity = detectOverDensityConflicts(placedItems);

  const coverageCells: CoverageMapCell[] =
    coverageMode === 'OFF'
      ? []
      : computeCoverageGrid({
          building,
          floor,
          calc,
          placedItems,
          filters: {
            sprinkler: coverageMode === 'COMBINED' || coverageMode === 'SPRINKLER',
            extinguisher: coverageMode === 'COMBINED' || coverageMode === 'EXTINGUISHER',
            hydrant: coverageMode === 'HYDRANT',
            alarm: coverageMode === 'ALARM',
            cleanAgent: coverageMode === 'CLEAN_AGENT',
          },
        });

  const coverageCounts = {
    GREEN: coverageCells.filter((c) => c.status === 'GREEN').length,
    RED: coverageCells.filter((c) => c.status === 'RED').length,
    YELLOW: coverageCells.filter((c) => c.status === 'YELLOW').length,
    GRAY: coverageCells.filter((c) => c.status === 'GRAY').length,
  };

  const measuredMeters =
    measureP1 && measureP2
      ? Math.hypot(measureP2.xM - measureP1.xM, measureP2.yM - measureP1.yM).toFixed(2)
      : null;

  return (
    <div className="space-y-4" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handlePlanUpload}
            className="hidden"
          />
          {canWrite && (
            <button
              type="button"
              disabled={uploadingPlan}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingPlan ? 'در حال پردازش...' : 'بارگذاری نقشه (PDF / تصویر)'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setTool('SELECT_MOVE')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
              tool === 'SELECT_MOVE'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>انتخاب / جابجایی</span>
          </button>

          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => {
                  setTool('CALIBRATE');
                  setCalibP1(null);
                  setCalibP2(null);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'CALIBRATE'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>کالیبراسیون مقیاس</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTool('MEASURE');
                  setMeasureP1(null);
                  setMeasureP2(null);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'MEASURE'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>اندازه‌گیری فاصله</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_SPRINKLER')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_SPRINKLER'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ اسپرینکلر</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_EXTINGUISHER')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_EXTINGUISHER'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ کپسول</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_EXISTING_EXT')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_EXISTING_EXT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ کپسول موجود</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_HYDRANT')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_HYDRANT'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ هوزباکس</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_DETECTOR')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_DETECTOR'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ دتکتور</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_PULL_STATION')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_PULL_STATION'
                    ? 'bg-rose-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ شستی</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('ADD_CLEAN_NOZZLE')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  tool === 'ADD_CLEAN_NOZZLE'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ نازل گازی</span>
              </button>

              <button
                type="button"
                onClick={handleAutoPlace}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>چیدمان خودکار NFPA</span>
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-pointer"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs font-bold px-1.5">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-pointer"
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-pointer"
            title="بازنشانی بزرگ‌نمایی"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowRevisionsDrawer((v) => !v)}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>نسخه‌ها ({floorRevisions.length})</span>
          </button>

          <button
            type="button"
            onClick={handlePrintMapPdf}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>خروجی PDF نقشه</span>
          </button>

          {canWrite && (
            <button
              type="button"
              disabled={savingRev}
              onClick={async () => {
                setSavingRev(true);
                try {
                  await onSaveRevision();
                } finally {
                  setSavingRev(false);
                }
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingRev ? 'در حال ثبت...' : 'ذخیره نسخه جانمایی'}</span>
            </button>
          )}

          {canApprove && onApproveRevision && activeRevisionStatus !== 'APPROVED' && (
            <button
              type="button"
              onClick={onApproveRevision}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تایید نهایی طرح</span>
            </button>
          )}
        </div>
      </div>

      {/* Smart Coverage Map Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 ml-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>نقشه هوشمند پوشش ۴‌رنگ:</span>
          </span>
          {(
            [
              { id: 'OFF', label: 'خاموش' },
              { id: 'COMBINED', label: 'ترکیبی (اسپرینکلر + کپسول)' },
              { id: 'SPRINKLER', label: 'اسپرینکلر (NFPA 13)' },
              { id: 'EXTINGUISHER', label: 'خاموش‌کننده (NFPA 10)' },
              { id: 'HYDRANT', label: 'هیدرانت / هوزباکس (NFPA 14)' },
              { id: 'ALARM', label: 'اعلام حریق (NFPA 72)' },
              { id: 'CLEAN_AGENT', label: 'گاز پاک (NFPA 2001)' },
            ] as { id: CoverageOverlayMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setCoverageMode(m.id);
                setInspectedCell(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                coverageMode === m.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {coverageMode !== 'OFF' && (
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px] font-bold">
            <span className="text-emerald-600">سبز (منطبق): {coverageCounts.GREEN}</span>
            <span className="text-rose-600">قرمز (نقطه کور): {coverageCounts.RED}</span>
            <span className="text-amber-600">زرد (بررسی مهندسی): {coverageCounts.YELLOW}</span>
            <span className="text-slate-500">خاکستری (خارج از ارزیابی): {coverageCounts.GRAY}</span>
          </div>
        )}
      </div>

      {/* Point-to-Point Measurement Bar */}
      {tool === 'MEASURE' && (
        <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-300 dark:border-cyan-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-cyan-900 dark:text-cyan-200">
            {!measureP1
              ? 'ابزار خط‌کش: روی نقطه اول در نقشه کلیک کنید.'
              : !measureP2
                ? 'روی نقطه دوم کلیک کنید تا فاصله دقیق (متر) محاسبه شود.'
                : `فاصله اندازه‌گیری‌شده: ${measuredMeters} متر`}
          </span>
          {(measureP1 || measureP2) && (
            <button
              type="button"
              onClick={() => {
                setMeasureP1(null);
                setMeasureP2(null);
              }}
              className="px-2.5 py-1 bg-cyan-700 text-white rounded-lg font-bold cursor-pointer"
            >
              پاک کردن خط‌کش
            </button>
          )}
        </div>
      )}

      {/* Over-density Cold Soldering warning */}
      {overDensity.count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 font-bold">
          هشدار تراکم بیش‌ازحد (Cold Soldering): {overDensity.count} جفت اسپرینکلر با فاصله کمتر از ۱.۸ متر روی نقشه قرار دارند (با حلقه نارنجی مشخص شده‌اند).
        </div>
      )}

      {/* Calibration helper bar */}
      {tool === 'CALIBRATE' && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-bold text-amber-900 dark:text-amber-200">
            {!calibP1
              ? 'مرحله ۱: روی نقطه شروع یک ضلع یا دیوار با اندازه معلوم در نقشه کلیک کنید.'
              : !calibP2
                ? 'مرحله ۲: اکنون روی نقطه پایان آن ضلع کلیک کنید.'
                : 'مرحله ۳: طول واقعی خط رسم‌شده به متر را وارد و تایید کنید:'}
          </div>
          {calibP1 && calibP2 && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min={0.5}
                value={calibDistanceM}
                onChange={(e) => setCalibDistanceM(e.target.value)}
                className="w-24 px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-400 rounded-lg font-mono text-xs"
              />
              <span>متر</span>
              <button
                type="button"
                onClick={handleApplyCalibration}
                className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold cursor-pointer"
              >
                اعمال مقیاس واقعی
              </button>
            </div>
          )}
        </div>
      )}

      {planStatusMsg && (
        <div className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-xl text-xs font-bold">
          {planStatusMsg}
        </div>
      )}

      {/* Main Split: 2D Interactive SVG Map + Right Side Inspector / Legend */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-9 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-auto p-4 min-h-[520px] flex items-center justify-center">
          <div style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: 'none' }} className="transition-all">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              onClick={handleSvgClick}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-auto bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-inner select-none"
              style={{ cursor: tool === 'SELECT_MOVE' ? 'default' : 'crosshair' }}
            >
              {/* Uploaded Architectural Floor Plan */}
              {planBgUrl && (
                <image
                  href={planBgUrl}
                  x={0}
                  y={0}
                  width={vbWidth}
                  height={vbHeight}
                  preserveAspectRatio="none"
                  opacity={0.78}
                />
              )}

              {/* Architectural 1m / 2m Grid */}
              <defs>
                <pattern
                  id="fd-grid-pattern"
                  width={pxPerMeter * 2}
                  height={pxPerMeter * 2}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${pxPerMeter * 2} 0 L 0 0 0 ${pxPerMeter * 2}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeOpacity={planBgUrl ? 0.25 : 0.35}
                    strokeWidth={0.75}
                  />
                </pattern>
              </defs>
              <rect x={0} y={0} width={vbWidth} height={vbHeight} fill="url(#fd-grid-pattern)" />

              {/* Smart 4-Color Coverage Heatmap Grid */}
              {coverageMode !== 'OFF' &&
                coverageCells.map((cell, idx) => {
                  const fillColor =
                    cell.status === 'GREEN'
                      ? '#10b981'
                      : cell.status === 'RED'
                        ? '#ef4444'
                        : cell.status === 'YELLOW'
                          ? '#f59e0b'
                          : '#94a3b8';
                  return (
                    <rect
                      key={`covcell-${idx}`}
                      x={cell.xM * pxPerMeter}
                      y={cell.yM * pxPerMeter}
                      width={cell.widthM * pxPerMeter}
                      height={cell.heightM * pxPerMeter}
                      fill={fillColor}
                      fillOpacity={cell.status === 'RED' ? 0.36 : 0.28}
                      stroke={fillColor}
                      strokeOpacity={0.45}
                      strokeWidth={0.6}
                      onClick={(ev) => {
                        if (tool === 'SELECT_MOVE') {
                          ev.stopPropagation();
                          setInspectedCell(cell);
                        }
                      }}
                    />
                  );
                })}

              {/* Separated Internal Spaces */}
              {(floor.spaces || []).map((sp) => (
                <g key={sp.id}>
                  <rect
                    x={sp.xM * pxPerMeter}
                    y={sp.yM * pxPerMeter}
                    width={sp.widthM * pxPerMeter}
                    height={sp.heightM * pxPerMeter}
                    fill={sp.hasCriticalElectronics ? '#f59e0b' : '#3b82f6'}
                    fillOpacity={0.09}
                    stroke={sp.hasCriticalElectronics ? '#d97706' : '#3b82f6'}
                    strokeDasharray="5 3"
                    strokeWidth={1.2}
                  />
                  <text
                    x={(sp.xM + sp.widthM / 2) * pxPerMeter}
                    y={(sp.yM + 1.1) * pxPerMeter}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="bold"
                    fill="#1e293b"
                  >
                    {sp.name}
                  </text>
                </g>
              ))}

              {/* Structural Obstacles (Walls, Beams, Shafts) */}
              {(floor.obstacles || []).map((ob) => (
                <g key={ob.id}>
                  <rect
                    x={ob.xM * pxPerMeter}
                    y={ob.yM * pxPerMeter}
                    width={Math.max(4, ob.widthM * pxPerMeter)}
                    height={Math.max(4, ob.heightM * pxPerMeter)}
                    fill={ob.type === 'SHAFT' ? '#334155' : '#475569'}
                    fillOpacity={0.8}
                    stroke="#0f172a"
                    strokeWidth={1}
                  />
                </g>
              ))}

              {/* Uncovered / Blind Spot Zones */}
              {showBlindSpots &&
                coverageMode === 'OFF' &&
                calc.uncoveredZones.map((bz) => (
                  <g key={bz.id}>
                    <rect
                      x={bz.xM * pxPerMeter}
                      y={bz.yM * pxPerMeter}
                      width={bz.widthM * pxPerMeter}
                      height={bz.heightM * pxPerMeter}
                      fill="#f43f5e"
                      fillOpacity={0.2}
                      stroke="#e11d48"
                      strokeDasharray="6 4"
                      strokeWidth={1.6}
                    />
                    <text
                      x={(bz.xM + bz.widthM / 2) * pxPerMeter}
                      y={(bz.yM + bz.heightM / 2) * pxPerMeter}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="bold"
                      fill="#be123c"
                    >
                      نقطه کور ({bz.system === 'SPRINKLER' ? 'اسپرینکلر' : 'خاموش‌کننده'})
                    </text>
                  </g>
                ))}

              {/* Coverage Radii */}
              {showCoverageRadii &&
                visibleItems.map((item) => {
                  const cx = item.xM * pxPerMeter;
                  const cy = item.yM * pxPerMeter;
                  const rPx = item.coverageRadiusM * pxPerMeter;
                  const isSp = item.kind.startsWith('SPRINKLER');
                  const isExt = item.kind.startsWith('EXTINGUISHER');
                  const isHyd = item.kind.startsWith('HYDRANT') || item.kind === 'HOSE_BOX' || item.kind.startsWith('FOAM');
                  const isDet = item.kind.startsWith('DETECTOR');
                  if (!isSp && !isExt && !isHyd && !isDet && item.kind !== 'CLEAN_AGENT_NOZZLE') return null;
                  return (
                    <circle
                      key={`cov-${item.id}`}
                      cx={cx}
                      cy={cy}
                      r={rPx}
                      fill={isSp ? '#0ea5e9' : isHyd ? '#2563eb' : isDet ? '#f59e0b' : item.origin === 'EXISTING' ? '#10b981' : '#ef4444'}
                      fillOpacity={isSp ? 0.08 : 0.04}
                      stroke={isSp ? '#0284c7' : isHyd ? '#1d4ed8' : isDet ? '#d97706' : item.origin === 'EXISTING' ? '#059669' : '#dc2626'}
                      strokeOpacity={0.32}
                      strokeDasharray={isSp ? '3 3' : '6 4'}
                      strokeWidth={1}
                      pointerEvents="none"
                    />
                  );
                })}

              {/* Equipment Symbols (NFPA Differentiated Existing vs Proposed & Multi-System) */}
              {visibleItems.map((item) => {
                const cx = item.xM * pxPerMeter;
                const cy = item.yM * pxPerMeter;
                const isSelected = item.id === selectedId;
                const isExisting = item.origin === 'EXISTING';
                const isSprinkler = item.kind.startsWith('SPRINKLER');
                const isValve = item.kind === 'RISER_VALVE';
                const isCleanNozzle = item.kind === 'CLEAN_AGENT_NOZZLE' || item.kind === 'CLEAN_AGENT_CYLINDER';
                const isHydrant = item.kind.startsWith('HYDRANT') || item.kind === 'HOSE_BOX';
                const isFoam = item.kind.startsWith('FOAM_MONITOR');
                const isDetector = item.kind.startsWith('DETECTOR');
                const isPull = item.kind === 'PULL_STATION' || item.kind === 'HORN_STROBE' || item.kind === 'FACP_PANEL';
                const isOverDense = overDensity.conflictingIds.includes(item.id);

                return (
                  <g
                    key={item.id}
                    transform={`translate(${cx}, ${cy})`}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      setSelectedId(item.id);
                      if (tool === 'SELECT_MOVE' && canWrite) {
                        setDraggingId(item.id);
                      }
                    }}
                    style={{ cursor: tool === 'SELECT_MOVE' && canWrite ? 'grab' : 'pointer' }}
                  >
                    {isOverDense && (
                      <circle r={13} fill="none" stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="3 2" />
                    )}
                    {isSelected && (
                      <circle r={16} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="3 2" />
                    )}

                    {isSprinkler ? (
                      <>
                        <circle
                          r={8}
                          fill={isExisting ? '#10b981' : '#0284c7'}
                          stroke="#ffffff"
                          strokeWidth={1.6}
                        />
                        <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#ffffff" strokeWidth={1.4} />
                      </>
                    ) : isValve ? (
                      <polygon
                        points="-9,-7 9,7 9,-7 -9,7"
                        fill="#6366f1"
                        stroke="#ffffff"
                        strokeWidth={1.3}
                      />
                    ) : isCleanNozzle ? (
                      <polygon
                        points="0,-9 8,-4 8,4 0,9 -8,4 -8,-4"
                        fill="#8b5cf6"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    ) : isHydrant ? (
                      <>
                        <rect x={-8} y={-8} width={16} height={16} rx={2.5} fill={isExisting ? '#059669' : '#1d4ed8'} stroke="#ffffff" strokeWidth={1.5} />
                        <text y={3.5} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill="#ffffff">H</text>
                      </>
                    ) : isFoam ? (
                      <>
                        <polygon points="0,-10 10,0 0,10 -10,0" fill="#0891b2" stroke="#ffffff" strokeWidth={1.5} />
                        <text y={3.5} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">F</text>
                      </>
                    ) : isDetector ? (
                      <>
                        <circle r={7.5} fill="#d97706" stroke="#ffffff" strokeWidth={1.5} />
                        <text y={3} textAnchor="middle" fontSize={8.5} fontWeight="bold" fill="#ffffff">D</text>
                      </>
                    ) : isPull ? (
                      <>
                        <rect x={-7} y={-7} width={14} height={14} rx={2} fill="#be123c" stroke="#ffffff" strokeWidth={1.5} />
                        <text y={3} textAnchor="middle" fontSize={8.5} fontWeight="bold" fill="#ffffff">M</text>
                      </>
                    ) : (
                      <polygon
                        points="0,-10 9,8 -9,8"
                        fill={isExisting ? '#059669' : '#dc2626'}
                        stroke="#ffffff"
                        strokeWidth={1.6}
                      />
                    )}

                    <text
                      y={-12}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight="bold"
                      fill="#0f172a"
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      paintOrder="stroke"
                    >
                      {item.code}
                    </text>
                  </g>
                );
              })}

              {/* Calibration Line Preview */}
              {calibP1 && (
                <circle cx={calibP1.xM * pxPerMeter} cy={calibP1.yM * pxPerMeter} r={5} fill="#d97706" />
              )}
              {calibP1 && calibP2 && (
                <line
                  x1={calibP1.xM * pxPerMeter}
                  y1={calibP1.yM * pxPerMeter}
                  x2={calibP2.xM * pxPerMeter}
                  y2={calibP2.yM * pxPerMeter}
                  stroke="#d97706"
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                />
              )}

              {/* Point-to-Point Measurement Line Preview */}
              {measureP1 && (
                <circle cx={measureP1.xM * pxPerMeter} cy={measureP1.yM * pxPerMeter} r={5} fill="#0891b2" />
              )}
              {measureP1 && measureP2 && (
                <g>
                  <line
                    x1={measureP1.xM * pxPerMeter}
                    y1={measureP1.yM * pxPerMeter}
                    x2={measureP2.xM * pxPerMeter}
                    y2={measureP2.yM * pxPerMeter}
                    stroke="#0891b2"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                  />
                  <circle cx={measureP2.xM * pxPerMeter} cy={measureP2.yM * pxPerMeter} r={5} fill="#0891b2" />
                  <text
                    x={((measureP1.xM + measureP2.xM) / 2) * pxPerMeter}
                    y={((measureP1.yM + measureP2.yM) / 2) * pxPerMeter - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="bold"
                    fill="#0e7490"
                    stroke="#ffffff"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {measuredMeters} m
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Right Panel: Layers, Legend, and Selected Equipment Properties */}
        <div className="xl:col-span-3 space-y-4">
          {/* Layer Toggles & Legend */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h4 className="font-black text-xs text-slate-900 dark:text-white">لایه‌ها و راهنمای علائم NFPA</h4>

            <div className="space-y-1.5 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  {showProposed ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>تجهیزات پیشنهادی طراحی</span>
                </span>
                <input type="checkbox" checked={showProposed} onChange={(e) => setShowProposed(e.target.checked)} />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  {showExisting ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>تجهیزات موجود</span>
                </span>
                <input type="checkbox" checked={showExisting} onChange={(e) => setShowExisting(e.target.checked)} />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>نمایش شعاع پوشش و پیمایش</span>
                <input
                  type="checkbox"
                  checked={showCoverageRadii}
                  onChange={(e) => setShowCoverageRadii(e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>نمایش نقاط کور (Blind Spots)</span>
                <input type="checkbox" checked={showBlindSpots} onChange={(e) => setShowBlindSpots(e.target.checked)} />
              </label>
            </div>

            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700 space-y-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-sky-600 inline-block shrink-0" />
                <span>دایره آبی + ضربدر: اسپرینکلر پیشنهادی</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 inline-block shrink-0" />
                <span>سبز: تجهیز موجود نصب‌شده</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-red-600 inline-block shrink-0" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
                <span>مثلث قرمز: خاموش‌کننده دستی پیشنهادی</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-violet-600 inline-block shrink-0 rounded-xs" />
                <span>شش‌ضلعی بنفش: نازل گاز پاک FM-200</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-rose-500/30 border border-rose-600 border-dashed inline-block shrink-0" />
                <span>هاشور قرمز: نقطه کور / خارج از پوشش</span>
              </div>
            </div>
          </div>

          {/* Selected Item Editor */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h4 className="font-black text-xs text-slate-900 dark:text-white">مشخصات نقطه انتخاب‌شده</h4>
            {selectedItem ? (
              <div className="space-y-2.5 text-xs">
                <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedItem.code}</div>
                <input
                  disabled={!canWrite}
                  value={selectedItem.label}
                  onChange={(e) =>
                    onChangePlacedItems(
                      placedItems.map((p) => (p.id === selectedItem.id ? { ...p, label: e.target.value } : p))
                    )
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">X (متر)</label>
                    <input
                      type="number"
                      step="0.2"
                      disabled={!canWrite}
                      value={selectedItem.xM}
                      onChange={(e) =>
                        onChangePlacedItems(
                          placedItems.map((p) =>
                            p.id === selectedItem.id ? { ...p, xM: Number(e.target.value) } : p
                          )
                        )
                      }
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Y (متر)</label>
                    <input
                      type="number"
                      step="0.2"
                      disabled={!canWrite}
                      value={selectedItem.yM}
                      onChange={(e) =>
                        onChangePlacedItems(
                          placedItems.map((p) =>
                            p.id === selectedItem.id ? { ...p, yM: Number(e.target.value) } : p
                          )
                        )
                      }
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedItem.mountingNote || 'برای جابجایی، آیکون را روی نقشه بکشید و رها کنید.'}
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangePlacedItems(placedItems.filter((p) => p.id !== selectedItem.id));
                      setSelectedId(null);
                    }}
                    className="w-full py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف این نقطه از نقشه</span>
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                روی هر نماد در نقشه کلیک کنید تا مختصات، کد تجهیز و توضیحات نصب آن نمایش داده و ویرایش شود.
              </p>
            )}
          </div>

          {/* Cell Coverage Inspector (when Heatmap clicked) */}
          {inspectedCell && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white">جزئیات سلول نقشه پوشش</h4>
                <span className="font-mono text-[11px] font-bold">
                  ({inspectedCell.xM}, {inspectedCell.yM}) m
                </span>
              </div>
              <div className="font-bold">
                وضعیت:{' '}
                <span
                  className={
                    inspectedCell.status === 'GREEN'
                      ? 'text-emerald-600'
                      : inspectedCell.status === 'RED'
                        ? 'text-rose-600'
                        : inspectedCell.status === 'YELLOW'
                          ? 'text-amber-600'
                          : 'text-slate-500'
                  }
                >
                  {inspectedCell.status === 'GREEN'
                    ? 'پوشش کامل (سبز)'
                    : inspectedCell.status === 'RED'
                      ? 'نقطه کور / خطا (قرمز)'
                      : inspectedCell.status === 'YELLOW'
                        ? 'نیازمند بررسی مهندسی (زرد)'
                        : 'خارج از محدوده / داده ناقص (خاکستری)'}
                </span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                {inspectedCell.reasonsFa.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="text-[11px] font-mono text-slate-500 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-700">
                {inspectedCell.nearestSprinklerM != null && (
                  <div>فاصله تا نزدیک‌ترین اسپرینکلر: {inspectedCell.nearestSprinklerM} m</div>
                )}
                {inspectedCell.nearestExtinguisherM != null && (
                  <div>پیمایش تا نزدیک‌ترین کپسول: {inspectedCell.nearestExtinguisherM} m</div>
                )}
                {inspectedCell.nearestHydrantM != null && (
                  <div>فاصله تا نزدیک‌ترین هیدرانت: {inspectedCell.nearestHydrantM} m</div>
                )}
                {inspectedCell.nearestDetectorM != null && (
                  <div>فاصله تا نزدیک‌ترین دتکتور: {inspectedCell.nearestDetectorM} m</div>
                )}
              </div>
            </div>
          )}

          {/* Revision History Drawer */}
          {showRevisionsDrawer && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white">تاریخچه نسخه‌های جانمایی طبقه</h4>
                <button
                  type="button"
                  onClick={() => setShowRevisionsDrawer(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  بستن
                </button>
              </div>
              {floorRevisions.length === 0 ? (
                <p className="text-[11px] text-slate-500">هنوز نسخه‌ای برای این طبقه ذخیره نشده است.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {floorRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          Rev.{rev.revision} · {rev.status === 'APPROVED' ? 'تاییدشده' : 'پیش‌نویس'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {rev.calculatedBy || '-'} · NFPA 13 ({rev.nfpa13Edition})
                        </div>
                      </div>
                      {onLoadRevision && (
                        <button
                          type="button"
                          onClick={() => onLoadRevision(rev)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          بازیابی روی نقشه
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

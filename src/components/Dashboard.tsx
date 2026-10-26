import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HsiGauge } from './dashboard/HsiGauge';
import { 
  DashboardCardManagerModal, 
  DASHBOARD_AVAILABLE_CARDS,
  DashboardCardDefinition
} from './dashboard/DashboardCardManagerModal';
import { DashboardChartCustomizer } from './dashboard/DashboardChartCustomizer';
import { DashboardPtwChart } from './dashboard/DashboardPtwChart';
import { DashboardHealthChart } from './dashboard/DashboardHealthChart';
import { DashboardRiskChart } from './dashboard/DashboardRiskChart';
import { DashboardWarningsTrendChart } from './dashboard/DashboardWarningsTrendChart';
import { DashboardFiveSTrendChart } from './dashboard/DashboardFiveSTrendChart';
import { DashboardTrainingChart } from './dashboard/DashboardTrainingChart';
import { DashboardAnomaliesChart } from './dashboard/DashboardAnomaliesChart';
import { DashboardPtwAuditChart } from './dashboard/DashboardPtwAuditChart';
import { DashboardSafetyInspectionChart } from './dashboard/DashboardSafetyInspectionChart';
import { DashboardFireDeptChart } from './dashboard/DashboardFireDeptChart';
import { 
  useDashboardMetrics, 
  CardLayoutItem, 
  DEFAULT_DASHBOARD_CARDS_LAYOUT 
} from '../hooks/useDashboardMetrics';
import { 
  Thermometer, 
  Droplets, 
  AlertTriangle, 
  AlertOctagon,
  Bell, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2,
  RotateCcw,
  Plus,
  X,
  Clock,
  Activity,
  Sparkles,
  ShieldAlert,
  Flame,
  ArrowRight,
  GripVertical,
  Save,
  Maximize2,
  Minimize2,
  Layers,
  FileCheck,
  HeartPulse,
  RefreshCw,
  LayoutGrid,
  GraduationCap,
  FileCheck2,
  ClipboardCheck,
  SlidersHorizontal,
  ArrowUpDown,
  Move,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { HeatRecord, TrirSeriesPoint, WarningRecord, UserProfile, NotificationEntry } from '../types';

interface DashboardProps {
  heatRecord: HeatRecord | null;
  trirSeries: TrirSeriesPoint[];
  trirTarget: number;
  warnings: WarningRecord[];
  onNavigate?: (tab: any) => void;
  language: 'en' | 'fa';
  currentUser: UserProfile;
}

const Dashboard: React.FC<DashboardProps> = React.memo(({
  heatRecord,
  trirSeries: fallbackTrirSeries,
  trirTarget: fallbackTrirTarget,
  warnings: fallbackWarnings,
  onNavigate,
  language,
  currentUser
}) => {
  const isFa = language === 'fa';

  // Role check: Only system administrator can edit, reorder, resize, and save layout to database
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase().replace(/\s+|_/g, '');
    return role === 'ADMIN' || role === 'ADMINISTRATOR';
  }, [currentUser]);

  // Hook to fetch live metrics & layout directly from database
  const {
    metrics,
    layout,
    loading: isMetricsLoading,
    refetch,
    saveLayout,
    resetLayout,
    isSaving,
    setLayout
  } = useDashboardMetrics(currentUser?.id || currentUser?.username);

  // Layout items state
  const [cardsLayout, setCardsLayout] = useState<CardLayoutItem[]>(() => {
    return layout.cards && layout.cards.length > 0 ? layout.cards : DEFAULT_DASHBOARD_CARDS_LAYOUT;
  });

  useEffect(() => {
    if (layout.cards && layout.cards.length > 0) {
      setCardsLayout(layout.cards);
    }
  }, [layout.cards]);

  // Edit / Personalize Mode state (available to authenticated users)
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveAsGlobalDefault, setSaveAsGlobalDefault] = useState(false);
  const [isCardManagerOpen, setIsCardManagerOpen] = useState(false);

  // Drag and Drop reordering state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Interactive Drag-to-Resize State
  const [resizingCard, setResizingCard] = useState<{
    cardId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startColSpan: number;
    corner: 'bottom-left' | 'bottom-right';
    currentColSpan: number;
    currentHeight: number;
  } | null>(null);

  const gridRef = React.useRef<HTMLDivElement>(null);

  // --- Dynamic Live Metrics Data (from database with fallback) ---
  const activeSeries: TrirSeriesPoint[] = useMemo(() => {
    if (metrics?.trir?.series && metrics.trir.series.length > 0) {
      return metrics.trir.series as any;
    }
    return fallbackTrirSeries;
  }, [metrics?.trir?.series, fallbackTrirSeries]);

  const activeTrirTarget = metrics?.trir?.target ?? fallbackTrirTarget;
  const currentIncidentsCount = metrics?.incidents?.rolling12m ?? 0;
  const prevIncidentsCount = metrics?.incidents?.prev12m ?? 0;
  const incidentTrend = metrics?.incidents?.trendDirection ?? 'flat';
  const incidentPercentChange = metrics?.incidents?.percentChange ?? 0;
  const totalSafeHours = metrics?.trir?.totalSafeManHours ?? 0;
  const activeWrittenWarningsCount = metrics?.warnings?.active ?? fallbackWarnings.length;
  const currentRollingTrir = metrics?.trir?.currentRolling ?? 0;

  // ── EXACT CLIMATE DATA EXTRACTION FROM HEAT STRESS MONITOR MODULE ──
  const activeClimateRecord: HeatRecord | null = useMemo(() => {
    // 1. Primary Source: exact active record from Heat Stress Monitor prop
    if (heatRecord && heatRecord.tempC !== undefined && !isNaN(heatRecord.tempC)) {
      return heatRecord;
    }
    // 2. Secondary Source: aggregated metrics climate
    if (metrics?.climate && metrics.climate.tempC !== undefined) {
      return {
        id: 'live-climate',
        ts: metrics.climate.observedAt || metrics.climate.fetchedAt || new Date().toISOString(),
        persianDate: new Date().toLocaleDateString('fa-IR'),
        tempC: metrics.climate.tempC,
        hum: metrics.climate.hum,
        hi: metrics.climate.hi ?? metrics.climate.tempC,
        hiDisplay: metrics.climate.hiDisplay ?? String((metrics.climate.hi ?? metrics.climate.tempC).toFixed(1)),
        offChart: metrics.climate.offChart ?? false,
        wbgt: metrics.climate.wbgt,
        wbgtShade: metrics.climate.wbgtShade,
        globeTemp: metrics.climate.globeTemp,
        dewPoint: metrics.climate.dewPoint,
        wetBulb: metrics.climate.wetBulb,
        cat: metrics.climate.cat || 'Normal',
        subLevel: metrics.climate.subLevel || null,
        loc: metrics.climate.loc || 'ایستگاه پایش اقلیمی',
        supervisor: 'واحد پایش HSE',
        department: 'Site Operations',
        source: metrics.climate.source || 'ایستگاه هواشناسی',
        aqi: metrics.climate.aqi,
        observedAt: metrics.climate.observedAt,
        fetchedAt: metrics.climate.fetchedAt,
        isStale: metrics.climate.isStale,
      } as HeatRecord;
    }
    return heatRecord;
  }, [heatRecord, metrics?.climate]);

  // Save layout directly to database (per-user or global default)
  const handleSaveLayoutToDb = useCallback(async () => {
    try {
      const isGlobal = isAdmin && saveAsGlobalDefault;
      const res = await saveLayout(
        cardsLayout, 
        currentUser.username || currentUser.fullName || 'User',
        currentUser.id || currentUser.username,
        isGlobal
      );
      toast.success(
        isFa 
          ? (isGlobal 
              ? 'چیدمان سازمانی در پایگاه داده ذخیره و برای همه کاربران اعمال گردید.' 
              : 'چیدمان اختصاصی شما با موفقیت در پایگاه داده ذخیره شد.')
          : (res?.message || 'Dashboard layout saved successfully to database.')
      );
      setIsEditMode(false);
    } catch (err: any) {
      toast.error(
        isFa 
          ? `خطا در ذخیره چیدمان: ${err.message || 'عدم دسترسی یا خطای سرور'}` 
          : `Failed to save layout: ${err.message}`
      );
    }
  }, [cardsLayout, currentUser, isFa, saveLayout, isAdmin, saveAsGlobalDefault]);

  // Toggle card visibility
  const handleToggleCard = useCallback((cardId: string) => {
    setCardsLayout(prev => {
      const next = prev.map(c => c.id === cardId ? { ...c, visible: !c.visible } : c);
      return next;
    });
  }, []);

  // Remove card from view
  const handleRemoveCard = useCallback((cardId: string, cardTitle: string) => {
    setCardsLayout(prev => prev.map(c => c.id === cardId ? { ...c, visible: false } : c));
    toast.success(
      isFa 
        ? `کارت «${cardTitle}» مخفی شد (قابل بازیابی از بخش مدیریت کارت‌ها)` 
        : `Card "${cardTitle}" hidden`,
      { duration: 2500, icon: '🗑️' }
    );
  }, [isFa]);

  // Change Card Column Span with delta
  const handleChangeColSpan = useCallback((cardId: string, delta: 1 | -1) => {
    setCardsLayout(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const spans: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12> = [3, 4, 5, 6, 8, 12];
      const currentSpan = c.colSpan || 3;
      const idx = spans.indexOf(currentSpan as any);
      let newIdx = idx !== -1 ? idx + delta : 0;
      if (newIdx < 0) newIdx = 0;
      if (newIdx >= spans.length) newIdx = spans.length - 1;
      return { ...c, colSpan: spans[newIdx] };
    }));
  }, []);

  // Set exact column span (شاخصی‌سازی عرض)
  const handleSetColSpan = useCallback((cardId: string, span: number) => {
    setCardsLayout(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      return { ...c, colSpan: Math.max(3, Math.min(12, span)) as any };
    }));
  }, []);

  // Set card height preset or pixel size (شاخصی‌سازی ارتفاع)
  const handleSetHeightPreset = useCallback((cardId: string, heightPreset: 'compact' | 'normal' | 'expanded') => {
    setCardsLayout(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const cardDef = DASHBOARD_AVAILABLE_CARDS.find(d => d.id === cardId);
      const isKpi = cardDef?.category === 'kpi';
      let pxHeight = isKpi ? 140 : 260;
      if (heightPreset === 'compact') pxHeight = isKpi ? 140 : 220;
      if (heightPreset === 'normal') pxHeight = isKpi ? 180 : 340;
      if (heightPreset === 'expanded') pxHeight = isKpi ? 260 : 500;

      return { 
        ...c, 
        height: heightPreset,
        customHeight: pxHeight
      };
    }));
  }, []);

  // Reset to default canonical layout (calls resetLayout in database)
  const handleResetToDefaults = useCallback(async () => {
    try {
      await resetLayout(currentUser.id || currentUser.username);
      setCardsLayout(DEFAULT_DASHBOARD_CARDS_LAYOUT);
      toast.success(
        isFa 
          ? 'چیدمان داشبورد با موفقیت به حالت پیش‌فرض سازمانی بازنشانی شد.' 
          : 'Dashboard layout reset to enterprise defaults.'
      );
    } catch (err: any) {
      toast.error(isFa ? 'خطا در بازنشانی چیدمان' : 'Failed to reset layout');
    }
  }, [resetLayout, currentUser, isFa]);

  // Show all cards
  const handleSelectAllCards = useCallback(() => {
    setCardsLayout(prev => prev.map(c => ({ ...c, visible: true })));
    toast.success(isFa ? 'کلیه کارت‌ها فعال گردیدند.' : 'All cards activated.');
  }, [isFa]);

  // Interactive Drag-to-Resize pointer handlers
  const handleStartResize = useCallback((
    e: React.MouseEvent | React.TouchEvent, 
    cardId: string, 
    corner: 'bottom-left' | 'bottom-right'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget as HTMLElement;
    const cardElement = targetEl.closest('.dashboard-card-wrapper') as HTMLElement;
    if (!cardElement || !gridRef.current) return;

    const cardRect = cardElement.getBoundingClientRect();
    const currentCard = cardsLayout.find(c => c.id === cardId);
    const cardDef = DASHBOARD_AVAILABLE_CARDS.find(c => c.id === cardId);
    const startColSpan = currentCard?.colSpan || cardDef?.defaultColSpan || 3;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setResizingCard({
      cardId,
      startX: clientX,
      startY: clientY,
      startWidth: cardRect.width,
      startHeight: cardRect.height,
      startColSpan,
      corner,
      currentColSpan: startColSpan,
      currentHeight: Math.round(cardRect.height)
    });
  }, [cardsLayout]);

  // Global mousemove/touchmove and mouseup/touchend for fluid resizing
  useEffect(() => {
    if (!resizingCard) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!gridRef.current || !resizingCard) return;

      if ('touches' in e && e.cancelable) {
        e.preventDefault();
      }

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - resizingCard.startX;
      const deltaY = clientY - resizingCard.startY;

      const gridRect = gridRef.current.getBoundingClientRect();
      const colWidth = gridRect.width / 12;

      // In RTL: pulling bottom-left handle (moving left = negative deltaX) increases width.
      // Pulling bottom-right handle (positive deltaX) increases width.
      const deltaWidth = resizingCard.corner === 'bottom-left' ? -deltaX : deltaX;
      const newWidth = Math.max(colWidth * 2.2, resizingCard.startWidth + deltaWidth);

      // Clamp new column span between 3 and 12
      let newColSpan = Math.round(newWidth / colWidth);
      if (newColSpan < 3) newColSpan = 3;
      if (newColSpan > 12) newColSpan = 12;

      // Minimum height: 130px for KPIs, 220px for charts/other panels
      const cardDef = DASHBOARD_AVAILABLE_CARDS.find(c => c.id === resizingCard.cardId);
      const minH = cardDef?.category === 'kpi' ? 130 : 220;
      const maxH = 750;

      let newHeight = Math.round(resizingCard.startHeight + deltaY);
      if (newHeight < minH) newHeight = minH;
      if (newHeight > maxH) newHeight = maxH;

      setResizingCard(prev => prev ? {
        ...prev,
        currentColSpan: newColSpan,
        currentHeight: newHeight
      } : null);
    };

    const handlePointerUp = () => {
      if (!resizingCard) return;

      // Commit the updated width and height to cardsLayout
      setCardsLayout(prev => prev.map(c => {
        if (c.id !== resizingCard.cardId) return c;
        return {
          ...c,
          colSpan: resizingCard.currentColSpan as any,
          customHeight: resizingCard.currentHeight,
          height: 'custom'
        };
      }));

      setResizingCard(null);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [resizingCard]);

  // Drag & Drop Handlers (Supported for any user in Edit Mode)
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (!isEditMode) return;
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
  };

  const handleDragOver = (e: React.DragEvent, targetCardId: string) => {
    if (!isEditMode || !draggedCardId || draggedCardId === targetCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCardId !== targetCardId) {
      setDragOverCardId(targetCardId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetCardId: string) => {
    if (!isEditMode || !draggedCardId || draggedCardId === targetCardId) return;
    e.preventDefault();

    setCardsLayout(prev => {
      const list = [...prev];
      const draggedIdx = list.findIndex(c => c.id === draggedCardId);
      const targetIdx = list.findIndex(c => c.id === targetCardId);

      if (draggedIdx === -1 || targetIdx === -1) return prev;

      const [removed] = list.splice(draggedIdx, 1);
      list.splice(targetIdx, 0, removed);

      return list.map((item, index) => ({ ...item, order: index }));
    });

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  // Formatting Utilities
  const fmtNum = useCallback((n: number | undefined, dec = 1) => {
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString(isFa ? 'fa-IR' : 'en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }, [isFa]);

  const fmtInt = useCallback((n: number | undefined) => {
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString(isFa ? 'fa-IR' : 'en-US');
  }, [isFa]);

  // ── Exact Heat Category Translation according to OSHA Standard ──
  const getHeatCategoryInfo = (hi: number | undefined, catStr?: string) => {
    const val = hi ?? 25;
    if (val < 27) {
      return { text: isFa ? 'عادی (بدون خطر)' : 'Normal (Safe)', color: 'text-emerald-500', isCritical: false };
    } else if (val < 32) {
      return { text: isFa ? '۱. احتیاط (Caution)' : 'I - Caution', color: 'text-amber-500', isCritical: false };
    } else if (val < 39) {
      return { text: isFa ? '۲. احتیاط شدید (Extreme Caution)' : 'II - Extreme Caution', color: 'text-orange-500', isCritical: true };
    } else if (val < 50) {
      return { text: isFa ? '۳. خطر ۱ (Danger)' : 'III - Danger', color: 'text-rose-500', isCritical: true };
    } else if (val < 54) {
      return { text: isFa ? '۴. خطر ۲ (Extreme Danger)' : 'IV - Extreme Danger', color: 'text-red-600', isCritical: true };
    } else {
      return { text: isFa ? '۵. خطر شدید (توقف کار)' : 'V - Severe (Stop Work)', color: 'text-red-700', isCritical: true };
    }
  };

  const heatCatInfo = activeClimateRecord ? getHeatCategoryInfo(activeClimateRecord.hi, activeClimateRecord.cat) : getHeatCategoryInfo(25);

  // Sorted list of visible cards according to user's layout
  const sortedVisibleCards = useMemo(() => {
    const list = [...cardsLayout];
    list.sort((a, b) => a.order - b.order);
    return list.filter(c => c.visible);
  }, [cardsLayout]);

  // Helper to get ColSpan classes
  const getColSpanClasses = (span: number) => {
    switch (span) {
      case 12: return 'col-span-12';
      case 11: return 'col-span-12 xl:col-span-11';
      case 10: return 'col-span-12 xl:col-span-10';
      case 9: return 'col-span-12 lg:col-span-8 xl:col-span-9';
      case 8: return 'col-span-12 lg:col-span-8';
      case 7: return 'col-span-12 lg:col-span-6 xl:col-span-7';
      case 6: return 'col-span-12 lg:col-span-6';
      case 5: return 'col-span-12 md:col-span-6 xl:col-span-5';
      case 4: return 'col-span-12 md:col-span-6 xl:col-span-4';
      case 3:
      default: return 'col-span-12 sm:col-span-6 lg:col-span-3';
    }
  };

  // Helper to get Priority Badge
  const getPriorityBadge = (cardId: string) => {
    const def = DASHBOARD_AVAILABLE_CARDS.find(d => d.id === cardId);
    const priority = def?.priority || 3;

    if (priority === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span>{isFa ? 'اولویت ۱ (حیاتی)' : 'P1 (Critical)'}</span>
        </span>
      );
    }
    if (priority === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <span>{isFa ? 'اولویت ۲ (استراتژیک)' : 'P2 (High)'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        <span>{isFa ? 'اولویت ۳ (عملیاتی)' : 'P3'}</span>
      </span>
    );
  };

  // Helper to resolve card destination module
  const getCardTargetTab = useCallback((cardId: string): string => {
    switch (cardId) {
      // 1. Incidents & TRIR
      case 'kpi-incidents':
      case 'card-incident-chart':
      case 'kpi-trir-target':
      case 'kpi-safe-hours':
        return 'hse-ms';

      // 2. Permits (PTW)
      case 'kpi-permits':
      case 'card-ptw-chart':
        return 'permit';

      // 3. PTW Audit
      case 'kpi-ptw-audit-rate':
      case 'card-ptw-audit-chart':
        return 'ptw-audit';

      // 4. Training
      case 'kpi-training-rate':
      case 'card-training-chart':
        return 'training';

      // 5. Warnings & Anomalies
      case 'kpi-anomalies-count':
      case 'card-anomalies-chart':
      case 'kpi-warnings':
      case 'card-warnings-trend':
        return 'warnings';

      // 6. System Notifications & Alerts Console
      case 'card-notifications':
        return 'system';

      // 7. Safety Unit & Checklists
      case 'kpi-safety-inspection-rate':
      case 'card-safety-inspection-chart':
        return 'safety-unit';

      // 8. Heat Stress & SCADA
      case 'card-hsi-gauge':
      case 'kpi-heat-index':
      case 'kpi-wbgt':
        return 'heat';

      // 9. Occupational Health & 5S
      case 'kpi-health-rate':
      case 'card-health-chart':
      case 'kpi-5s-score':
      case 'card-5s-trend':
        return 'health-env';

      // 10. Fire Department
      case 'kpi-fire-readiness':
      case 'card-fire-dept-chart':
        return 'fire-dept';

      // 11. Risk Management
      case 'kpi-risk-high':
      case 'card-risk-matrix':
        return 'risk';

      default:
        return '';
    }
  }, []);

  const getModuleTitle = useCallback((tab: string) => {
    if (isFa) {
      switch (tab) {
        case 'hse-ms': return 'پایش نرخ رویدادها و شاخص TRIR';
        case 'heat': return 'پایش استرس حرارتی و اقلیمی';
        case 'permit': return 'صدور و مدیریت پروانه کار (PTW)';
        case 'ptw-audit': return 'ممیزی پروانه‌های کار (PTW Audit)';
        case 'training': return 'مدیریت آموزش و توانمندسازی HSE';
        case 'warnings': return 'اخطارهای ایمنی و گزارشات ناهنجاری';
        case 'system': return 'اعلان‌ها و هشدارهای سیستم';
        case 'safety-unit': return 'واحد ایمنی و بازرسی‌های فنی';
        case 'fire-dept': return 'واحد آتش‌نشانی و تجهیزات اطفاء';
        case 'health-env': return 'بهداشت شغلی، طب کار و نظام آراستگی (5S)';
        case 'risk': return 'شناسایی خطرات و ارزیابی ریسک';
        case 'incidents': return 'ثبت و بررسی حوادث';
        default: return 'ماژول مربوطه';
      }
    } else {
      switch (tab) {
        case 'hse-ms': return 'Incident Rates & TRIR';
        case 'heat': return 'Heat Stress Monitor';
        case 'permit': return 'Work Permit (PTW)';
        case 'ptw-audit': return 'PTW Audit';
        case 'training': return 'HSE Training';
        case 'warnings': return 'Safety Warnings & Anomalies';
        case 'system': return 'System Alerts & Notifications';
        case 'safety-unit': return 'Safety Unit & Inspections';
        case 'fire-dept': return 'Fire Department';
        case 'health-env': return 'Occupational Health & 5S';
        case 'risk': return 'Risk Assessment';
        case 'incidents': return 'Incidents Investigation';
        default: return 'Module';
      }
    }
  }, [isFa]);

  const handleCardClick = useCallback((cardId: string) => {
    if (isAdmin && isEditMode) return;
    if (cardId === 'card-quick-actions') return; // Quick actions has its own internal buttons
    const targetTab = getCardTargetTab(cardId);
    if (targetTab && onNavigate) {
      if (cardId === 'card-notifications') {
        try {
          sessionStorage.setItem('hse_system_settings_active_subtab', 'notifications');
        } catch {}
        window.dispatchEvent(new CustomEvent('hse-navigate-subtab', {
          detail: { tab: 'system', subItem: 'notifications' }
        }));
      }
      onNavigate(targetTab);
    }
  }, [isAdmin, isEditMode, getCardTargetTab, onNavigate]);

  // ── RENDER INDIVIDUAL CARD BY ID (Complete 100% Coverage for all 29 Card IDs) ──
  const renderCardContent = (cardId: string) => {
    const targetTab = getCardTargetTab(cardId);
    const isClickable = !isEditMode && Boolean(targetTab && onNavigate && cardId !== 'card-quick-actions');

    switch (cardId) {
      // 1. KPI: Rolling 12M Incidents
      case 'kpi-incidents':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-blue-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'حوادث ۱۲ ماهه رولینگ' : 'Rolling 12M Incidents'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-slate-800 dark:text-slate-100 leading-none">
                {fmtInt(currentIncidentsCount)}
              </h4>
              <div className={`flex items-center text-xs font-bold ${incidentTrend === 'down' ? 'text-emerald-500' : incidentTrend === 'up' ? 'text-red-500' : 'text-slate-400'}`}>
                {incidentTrend === 'up' ? <TrendingUp className="w-4 h-4 mr-0.5" /> : incidentTrend === 'down' ? <TrendingDown className="w-4 h-4 mr-0.5" /> : null}
                <span className="text-sm font-black">{fmtNum(Math.abs(incidentPercentChange), 0)}%</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'دوره مشابه قبل:' : 'Prev Period:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(prevIncidentsCount)}</strong>
            </div>
          </div>
        );

      // 2. KPI: Target TRIR Benchmark
      case 'kpi-trir-target':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-indigo-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'شاخص TRIR رولینگ' : 'Rolling TRIR'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-indigo-600 dark:text-indigo-400 leading-none">
                {fmtNum(currentRollingTrir, 2)}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'حد مجاز سالانه (Target):' : 'Annual Target:'}</span>
              <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-black">{fmtNum(activeTrirTarget, 2)}</strong>
            </div>
          </div>
        );

      // 3. KPI: Safe Man-Hours Worked
      case 'kpi-safe-hours':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-teal-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'مجموع کارکرد بدون حادثه' : 'Safe Man-Hours'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-teal-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400 leading-none">
                {fmtInt(totalSafeHours)}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'نفر-ساعت ثبت‌شده ۱۲ ماه' : '12M Recorded'}</span>
              <span className="text-emerald-600 font-bold">{isFa ? 'ایمن' : 'Safe'}</span>
            </div>
          </div>
        );

      // 4. KPI: Active Work Permits (PTW)
      case 'kpi-permits':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-amber-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'پروانه‌های کار فعال (PTW)' : 'Active Work Permits'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-amber-600 dark:text-amber-400 leading-none">
                {fmtInt(metrics?.permits?.active ?? 0)}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'در انتظار تایید:' : 'Pending:'}</span>
              <strong className="font-mono text-amber-600 font-black">{fmtInt(metrics?.permits?.pending ?? 0)}</strong>
            </div>
          </div>
        );

      // 5. KPI: Training Pass Rate
      case 'kpi-training-rate':
        const trainingTotalCount = (metrics?.training?.totalCourses || 0) + (metrics?.training?.totalAttendances || 0);
        const displayTrainingRate = trainingTotalCount > 0 ? `${metrics?.training?.passRate ?? 0}%` : (isFa ? '۰%' : '0%');
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-blue-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'نرخ قبولی آموزش HSE' : 'Training Pass Rate'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-blue-600 dark:text-blue-400 leading-none">
                {displayTrainingRate}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'پرسنل آموزش‌دیده:' : 'Trained:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(metrics?.training?.trainedPersonnel ?? 0)}</strong>
            </div>
          </div>
        );

      // 6. KPI: Open Anomalies Count
      case 'kpi-anomalies-count':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-rose-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'ناهنجاری‌ها و انحرافات باز' : 'Open Anomalies'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-rose-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-rose-600 dark:text-rose-400 leading-none">
                {fmtInt(metrics?.anomalies?.open ?? 0)}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'کل پرونده‌های ثبت‌شده:' : 'Total:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(metrics?.anomalies?.total ?? 0)}</strong>
            </div>
          </div>
        );

      // 7. KPI: PTW Audit Rate
      case 'kpi-ptw-audit-rate':
        const auditedPermits = metrics?.permits?.auditedCount ?? 0;
        const displayPtwAuditRate = auditedPermits > 0 ? `${metrics?.permits?.auditComplianceRate ?? 0}%` : (isFa ? '۰%' : '0%');
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-indigo-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'انطباق ممیزی پروانه کار' : 'PTW Audit Rate'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-indigo-600 dark:text-indigo-400 leading-none">
                {displayPtwAuditRate}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <FileCheck2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'مجوزهای ممیزی‌شده:' : 'Audited:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(auditedPermits)}</strong>
            </div>
          </div>
        );

      // 8. KPI: Safety Inspection Rate
      case 'kpi-safety-inspection-rate':
        const totalInspections = metrics?.safetyInspections?.total ?? 0;
        const displayInspectionRate = totalInspections > 0 ? `${metrics?.safetyInspections?.passRate ?? 0}%` : (isFa ? '۰%' : '0%');
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-sky-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'انطباق چک‌لیست‌های ایمنی' : 'Checklist Pass Rate'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-sky-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-sky-600 dark:text-sky-400 leading-none">
                {displayInspectionRate}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600">
                <ClipboardCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'کل بازرسی‌های فنی:' : 'Total:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(totalInspections)}</strong>
            </div>
          </div>
        );

      // 9. SCADA: Heat Stress Index Gauge (STRICTLY PRESERVED VISUAL APPEARANCE)
      case 'card-hsi-gauge':
        return (
          <div className="flex flex-col justify-center h-full" id="dashboard-quick-weather">
            <HsiGauge heatRecord={activeClimateRecord} isFa={isFa} onNavigate={onNavigate} />
          </div>
        );

      // 10. CHART: Incident Occurrences & TRIR Trend Chart (Customizable)
      case 'card-incident-chart':
        return (
          <DashboardChartCustomizer 
            trirSeries={activeSeries}
            trirTarget={activeTrirTarget}
            isFa={isFa}
            onNavigate={onNavigate}
            onRemoveCard={isAdmin && isEditMode ? () => handleRemoveCard('card-incident-chart', isFa ? 'نمودار روند حوادث' : 'Incident Trend') : undefined}
          />
        );

      // 11. CHART: HSE Training Management Chart
      case 'card-training-chart':
        return (
          <DashboardTrainingChart 
            trainingData={metrics?.training}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 12. CHART: Anomalies & Unsafe Conditions Chart
      case 'card-anomalies-chart':
        return (
          <DashboardAnomaliesChart 
            anomaliesData={metrics?.anomalies}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 13. CHART: PTW Audits & Quality Compliance Chart
      case 'card-ptw-audit-chart':
        return (
          <DashboardPtwAuditChart 
            ptwData={metrics?.permits}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 14. CHART: Safety Unit Checklists & Technical Inspections Chart
      case 'card-safety-inspection-chart':
        return (
          <DashboardSafetyInspectionChart 
            inspectionData={metrics?.safetyInspections}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 15. CHART: Fire Department & Equipment Readiness Chart
      case 'card-fire-dept-chart':
        return (
          <DashboardFireDeptChart 
            fireData={metrics?.fireSafety}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 16. CHART: Occupational Health Unit & Medical Exams Chart
      case 'card-health-chart':
        return (
          <DashboardHealthChart 
            healthData={metrics?.health}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 17. CHART: Work Permits (PTW) Distribution Chart
      case 'card-ptw-chart':
        return (
          <DashboardPtwChart 
            permitsData={metrics?.permits}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 18. CHART: Safety Risk Matrix Chart
      case 'card-risk-matrix':
        return (
          <DashboardRiskChart 
            risksData={metrics?.risks}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 19. CHART: Safety Warnings & Non-Conformities Status Chart
      case 'card-warnings-trend':
        return (
          <DashboardWarningsTrendChart 
            warningsData={metrics?.warnings}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 20. CHART: 5S Housekeeping & Fire Safety Index Chart
      case 'card-5s-trend':
        return (
          <DashboardFiveSTrendChart 
            fiveSData={metrics?.fiveS}
            fireData={metrics?.fireSafety}
            isFa={isFa}
            onNavigate={onNavigate}
          />
        );

      // 21. KPI: Active Heat Index (Matching Heat Stress Module Exactly)
      case 'kpi-heat-index':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-blue-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'شاخص استرس گرمایی (Heat Index)' : 'Active Heat Index'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-slate-800 dark:text-slate-100 leading-none">
                {activeClimateRecord ? `${fmtNum(activeClimateRecord.hi, 1)}°C` : '—'}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Thermometer className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs font-bold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span className="text-slate-500">{isFa ? 'رده ایمنی:' : 'Level:'}</span>
              <span className={`font-black ${heatCatInfo.color}`}>{heatCatInfo.text}</span>
            </div>
          </div>
        );

      // 22. KPI: Humidity & WBGT (Matching Heat Stress Module Exactly)
      case 'kpi-wbgt':
        const wbgtVal = activeClimateRecord?.wbgt || (activeClimateRecord?.tempC ? activeClimateRecord.tempC * 0.85 : undefined);
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-sky-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'دمای تر محیطی (WBGT) و رطوبت' : 'Humidity & WBGT'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-sky-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-slate-800 dark:text-slate-100 leading-none">
                {wbgtVal ? `${fmtNum(wbgtVal, 1)}°C` : '—'}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                <Droplets className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span className="flex items-center gap-1">
                <span>{isFa ? 'دمای محیط:' : 'Temp:'}</span>
                <strong className="text-slate-700 dark:text-slate-200 font-mono font-black">{activeClimateRecord ? `${fmtNum(activeClimateRecord.tempC, 1)}°C` : '—'}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span>{isFa ? 'رطوبت:' : 'RH:'}</span>
                <strong className="text-slate-700 dark:text-slate-200 font-mono font-black">{activeClimateRecord ? `${activeClimateRecord.hum}%` : '—'}</strong>
              </span>
            </div>
          </div>
        );

      // 23. KPI: Occupational Health Fitness Rate
      case 'kpi-health-rate':
        const totalExamsCount = metrics?.health?.totalExams ?? 0;
        const displayHealthRate = totalExamsCount > 0 ? `${metrics?.health?.fitnessPercentage ?? 0}%` : (isFa ? '۰%' : '0%');
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-emerald-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'نرخ سلامت شغلی طب کار' : 'Health Fitness Rate'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                {displayHealthRate}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <HeartPulse className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'کل معاینات دوره‌ای:' : 'Total Exams:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(totalExamsCount)}</strong>
            </div>
          </div>
        );

      // 24. KPI: Fire Equipment Readiness
      case 'kpi-fire-readiness':
        const totalFireAssets = metrics?.fireSafety?.total ?? 0;
        const displayFireRate = totalFireAssets > 0 ? `${metrics?.fireSafety?.readinessRate ?? 0}%` : (isFa ? '۰%' : '0%');
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-orange-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'آمادگی تجهیزات اطفای حریق' : 'Fire Readiness'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-orange-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-orange-600 dark:text-orange-400 leading-none">
                {displayFireRate}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Flame className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'تجهیزات بازرسی‌شده:' : 'Inspected:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(metrics?.fireSafety?.operational ?? 0)}</strong>
            </div>
          </div>
        );

      // 25. KPI: 5S Housekeeping Score
      case 'kpi-5s-score':
        const totalFiveSAudits = metrics?.fiveS?.total ?? 0;
        const displayFiveSScore = totalFiveSAudits > 0 ? `${metrics?.fiveS?.averageScore ?? 0}` : '۰';
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-pink-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'امتیاز نظام آراستگی (5S)' : '5S Score'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-pink-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-pink-600 dark:text-pink-400 leading-none">
                {displayFiveSScore} <span className="text-sm font-normal text-slate-400">/ ۱۰۰</span>
              </h4>
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-600">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'ممیزی‌های ثبت‌شده:' : 'Audits:'}</span>
              <strong className="font-mono text-slate-700 dark:text-slate-200 font-black">{fmtInt(totalFiveSAudits)}</strong>
            </div>
          </div>
        );

      // 26. KPI: Critical High Risks
      case 'kpi-risk-high':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-red-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'ارزیابی‌های ریسک بحرانی و بالا' : 'Critical High Risks'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-red-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-red-600 dark:text-red-400 leading-none">
                {fmtInt(metrics?.risks?.high ?? 0)}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'نیازمند اقدام فوری' : 'Action Required'}</span>
              <span className="text-red-500 font-black">{isFa ? 'بحرانی' : 'Urgent'}</span>
            </div>
          </div>
        );

      // 27. KPI: Active Written Warnings
      case 'kpi-warnings':
        return (
          <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-300 h-full min-h-[140px] ${isClickable ? 'hover:border-violet-400 hover:shadow-md cursor-pointer group/kpi' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-slate-850 dark:text-slate-200 text-sm font-black tracking-tight">
                  {isFa ? 'اخطارهای کتبی فعال ایمنی' : 'Active Written Warnings'}
                </p>
                {isClickable && <ArrowRight className="w-3.5 h-3.5 text-violet-500 opacity-0 group-hover/kpi:opacity-100 transition-opacity shrink-0" />}
              </div>
              {getPriorityBadge(cardId)}
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <h4 className="text-3xl sm:text-4xl font-black font-mono text-slate-800 dark:text-slate-100 leading-none">
                {fmtInt(activeWrittenWarningsCount)}
              </h4>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
              <span>{isFa ? 'پرونده‌های باز سایت:' : 'Open Cases:'}</span>
              <strong className="text-slate-700 dark:text-slate-200 font-mono font-black">{fmtInt(activeWrittenWarningsCount)}</strong>
            </div>
          </div>
        );

      // 28. NOTIFICATIONS: Critical Alerts Console
      case 'card-notifications':
        return (
          <div 
            onClick={() => isClickable && handleCardClick(cardId)}
            className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3 h-full min-h-[260px] max-h-[380px] w-full max-w-full overflow-hidden ${isClickable ? 'hover:border-amber-400 hover:shadow-md cursor-pointer' : ''}`} 
            id="dashboard-notifications"
          >
            <div className="space-y-3 overflow-hidden flex flex-col flex-1 min-h-0 w-full">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0 w-full">
                <h3 className="font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2 text-base truncate min-w-0">
                  <Bell className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="truncate">{isFa ? 'اعلان‌ها و هشدارهای سیستم' : 'System Alerts & Notifications'}</span>
                </h3>
                {getPriorityBadge(cardId)}
              </div>

              <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0 w-full">
                {metrics?.notifications && metrics.notifications.length > 0 ? (
                  metrics.notifications.slice(0, 6).map((notif: any) => (
                    <div key={notif.id || notif.notifId} className="p-2.5 bg-red-500/5 hover:bg-red-500/10 transition-colors rounded-xl border border-red-500/20 space-y-1 overflow-hidden shrink-0 w-full max-w-full">
                      <div className="flex items-center justify-between text-[9px] font-bold w-full">
                        <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 rounded font-black uppercase shrink-0">
                          {isFa ? 'بحرانی' : 'CRITICAL'}
                        </span>
                        <span className="text-slate-400 font-mono shrink-0 dir-ltr text-[9px]">
                          {new Date(notif.createdAt || notif.ts || Date.now()).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight line-clamp-1 truncate w-full">{notif.title}</h5>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold line-clamp-2 break-words w-full overflow-hidden">{notif.body}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-7 text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl my-auto w-full">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1 animate-pulse" />
                    <p className="font-black text-slate-800 dark:text-slate-100 text-[11px]">{isFa ? 'سیستم در وضعیت کاملاً ایمن است' : 'System is fully safe'}</p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{isFa ? 'هیچ هشدار اضطراری فعالی نیست.' : 'No active critical alerts.'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-[9px] text-slate-400 font-mono font-bold flex items-center justify-between shrink-0 mt-auto">
              <span className="truncate">{isFa ? 'کنسول پایش اتوماتیک HSECORE' : 'Automated HSECORE Live Console'}</span>
              {isClickable && <span className="text-blue-500 text-[10px] font-bold flex items-center gap-1 shrink-0">{isFa ? 'مشاهده هشدارها' : 'View Alerts'} &larr;</span>}
            </div> 
          </div>
        );

      // 29. QUICK ACTIONS: Shortcuts Panel
      case 'card-quick-actions':
        return (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
                  {isFa ? 'اقدامات سریع و دسترسی به ثبت اطلاعات' : 'Managerial Quick Actions & Shortcuts'}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('incidents')}
                className="p-4 bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200/80 dark:border-red-800/60 rounded-2xl text-start transition cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                  <ArrowRight className="w-4 h-4" />
                </div>
                <h5 className="font-black text-slate-800 dark:text-slate-100 text-sm">{isFa ? 'ثبت و گزارش حادثه جدید' : 'Report Incident'}</h5>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed">
                  {isFa ? 'ثبت سریع رخدادهای LTI، شبه‌حوادث و گزارش اولیه' : 'Record LTI events and near misses'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('training')}
                className="p-4 bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-start transition cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <GraduationCap className="w-5 h-5" />
                  <ArrowRight className="w-4 h-4" />
                </div>
                <h5 className="font-black text-slate-800 dark:text-slate-100 text-sm">{isFa ? 'ثبت دوره و آزمون آموزش' : 'Register Training'}</h5>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed">
                  {isFa ? 'ثبت جلسات آموزشی، آزمون‌ها و گواهینامه‌ها' : 'Log training sessions and certificates'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('safety-unit')}
                className="p-4 bg-sky-50/70 hover:bg-sky-100/70 dark:bg-sky-950/30 dark:hover:bg-sky-900/40 border border-sky-200/80 dark:border-sky-800/60 rounded-2xl text-start transition cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
                  <ClipboardCheck className="w-5 h-5" />
                  <ArrowRight className="w-4 h-4" />
                </div>
                <h5 className="font-black text-slate-800 dark:text-slate-100 text-sm">{isFa ? 'تکمیل چک‌لیست ایمنی' : 'Fill Safety Checklist'}</h5>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed">
                  {isFa ? 'ثبت بازرسی داربست، جرثقیل، برق و تجهیزات' : 'Inspect scaffolding, cranes & electrical'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('warnings')}
                className="p-4 bg-purple-50/70 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 border border-purple-200/80 dark:border-purple-800/60 rounded-2xl text-start transition cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                  <AlertTriangle className="w-5 h-5" />
                  <ArrowRight className="w-4 h-4" />
                </div>
                <h5 className="font-black text-slate-800 dark:text-slate-100 text-sm">{isFa ? 'صدور اخطار کتبی و ناهنجاری' : 'Issue Safety Warning'}</h5>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-relaxed">
                  {isFa ? 'ثبت تخلفات ایمنی، ناهنجاری‌ها و انحرافات' : 'Issue contractor non-conformity notices'}
                </p>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300" id="dashboard-container" dir={isFa ? 'rtl' : 'ltr'}>
      {/* ── TOP MANAGERIAL EXECUTIVE TOOLBAR (Auto-Layout, Auto-Sizing & Priority Controls) ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'داشبورد جامع مدیریتی HSECORE (کلیه واحدها و ماژول‌ها)' : 'Executive Management Dashboard HSECORE'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {isFa ? 'پایش جامع مدیریت آموزش، گزارشات ناهنجاری، ممیزی پروانه کار، بهداشت، آتش‌نشانی و ایمنی (چک‌لیست‌ها)' : 'Integrated analytics for Training, Anomalies, PTW Audits, Occupational Health, Fire Dept & Safety Checklists'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Custom Layout Indicator Badge */}
          {layout.isUserCustom && (
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hidden sm:inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>{isFa ? 'چیدمان اختصاصی شما' : 'Custom Layout'}</span>
            </span>
          )}

          {/* Live Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title={isFa ? 'تازه‌سازی داده‌ها از پایگاه داده' : 'Refresh Metrics'}
            aria-label="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isMetricsLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Toggle Edit & Personalize Mode */}
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              isEditMode
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{isEditMode ? (isFa ? 'پایان تنظیمات' : 'Exit Edit') : (isFa ? 'تنظیم ابعاد و چیدمان' : 'Customize Cards')}</span>
          </button>

          {/* Add & Manage Cards Button */}
          <button
            type="button"
            onClick={() => setIsCardManagerOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
            id="manage-dashboard-cards-btn"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'مدیریت کارت‌ها' : 'Manage Cards'}</span>
          </button>

          {/* Save to Database Button */}
          <button
            type="button"
            onClick={handleSaveLayoutToDb}
            disabled={isSaving}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
            title={isFa ? 'ذخیره دائمی چیدمان در سرور' : 'Save Layout Permanently to Server'}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره در سرور' : 'Save Layout')}</span>
          </button>

          {/* Reset Layout to Default */}
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title={isFa ? 'بازنشانی چیدمان به پیش‌فرض سازمانی' : 'Reset to Default Layout'}
            aria-label="Reset layout"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Mode Instruction Banner */}
      {isEditMode && (
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-emerald-500/10 border border-amber-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm block text-amber-900 dark:text-amber-100">
                {isFa 
                  ? 'حالت شخصی‌سازی طول و عرض و تنظیم اندازه کارت‌ها (Drag to Resize) فعال است' 
                  : 'Card Dimension Customization & Drag-to-Resize Mode Active'}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {isFa 
                  ? 'اندازه هر کارت را با کشیدن گوشه پایین (Drag to Resize) تغییر دهید یا از دکمه‌های طول و عرض بالای کارت استفاده کنید. کارت‌ها را با درگ جابه‌جا کنید و در پایان ذخیره نمایید.' 
                  : 'Resize cards by dragging their bottom corners or using dimension buttons. Drag cards to reorder, then save to server.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            {isAdmin && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={saveAsGlobalDefault}
                  onChange={(e) => setSaveAsGlobalDefault(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>{isFa ? 'پیش‌فرض کل سازمان' : 'Global Default'}</span>
              </label>
            )}

            <button
              type="button"
              onClick={handleSaveLayoutToDb}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره در سرور' : 'Save Layout')}</span>
            </button>

            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5"
              title={isFa ? 'بازنشانی چیدمان به پیش‌فرض' : 'Reset to Defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isFa ? 'بازنشانی پیش‌فرض' : 'Reset'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isFa ? 'پایان تنظیمات' : 'Done'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── UNIFIED RESPONSIVE GRID (Auto-Sized, Overlap-Free & Priority-Ordered) ── */}
      <div 
        ref={gridRef}
        className="grid grid-cols-12 auto-rows-auto gap-4 items-stretch relative" 
        id="dashboard-dynamic-grid"
      >
        {sortedVisibleCards.map((cardItem) => {
          const cardDef = DASHBOARD_AVAILABLE_CARDS.find(c => c.id === cardItem.id);
          const defaultColSpan = cardDef?.defaultColSpan || 3;
          
          const isResizingThis = resizingCard?.cardId === cardItem.id;
          const activeColSpan = isResizingThis 
            ? resizingCard.currentColSpan 
            : (cardItem.colSpan || defaultColSpan);
            
          const activeCardHeight = isResizingThis 
            ? resizingCard.currentHeight 
            : (cardItem.customHeight || undefined);

          const colSpanClass = getColSpanClasses(activeColSpan);
          const isDraggingThis = draggedCardId === cardItem.id;
          const isDragOverThis = dragOverCardId === cardItem.id;

          const targetTab = getCardTargetTab(cardItem.id);
          const isClickable = !isEditMode && Boolean(targetTab && onNavigate && cardItem.id !== 'card-quick-actions');
          const moduleTitle = targetTab ? getModuleTitle(targetTab) : '';

          return (
            <div
              key={cardItem.id}
              data-card-id={cardItem.id}
              draggable={isEditMode && !isResizingThis}
              onDragStart={(e) => handleDragStart(e, cardItem.id)}
              onDragOver={(e) => handleDragOver(e, cardItem.id)}
              onDrop={(e) => handleDrop(e, cardItem.id)}
              onDragEnd={handleDragEnd}
              onClick={() => isClickable && handleCardClick(cardItem.id)}
              title={isClickable ? (isFa ? `کلیک جهت هدایت به ماژول ${moduleTitle}` : `Click to navigate to ${moduleTitle}`) : undefined}
              className={`dashboard-card-wrapper ${colSpanClass} relative group transition-all duration-150 flex flex-col ${
                isDraggingThis ? 'opacity-40 scale-98 ring-2 ring-blue-500 rounded-2xl' : ''
              } ${
                isDragOverThis ? 'ring-2 ring-emerald-500 scale-101 rounded-2xl shadow-lg' : ''
              } ${
                isResizingThis ? 'ring-2 ring-blue-500 rounded-2xl shadow-2xl z-30' : ''
              } ${
                isClickable ? 'cursor-pointer' : ''
              }`}
              style={{
                minHeight: activeCardHeight ? `${activeCardHeight}px` : undefined,
              }}
            >
              {/* Card Management & Dimension Controls in Edit Mode */}
              {isEditMode && (
                <div className="absolute top-2 start-2 end-2 z-30 flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-xl text-white opacity-95 group-hover:opacity-100 transition shadow-lg border border-slate-700/60">
                  {/* Left: Drag Handle & Title */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="p-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-white" title={isFa ? 'جابه‌جایی کارت' : 'Drag to reorder'}>
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-100 truncate max-w-[110px] sm:max-w-[150px]">
                      {isFa ? cardDef?.titleFa : cardDef?.titleEn}
                    </span>
                  </div>

                  {/* Middle: Dimension indicator badge (شاخصی‌سازی طول و عرض) */}
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-mono font-bold">
                    <span>عرض: {activeColSpan} ستون ({Math.round((activeColSpan / 12) * 100)}%)</span>
                    <span className="text-slate-400">|</span>
                    <span>طول: {activeCardHeight ? `${activeCardHeight}px` : (cardDef?.category === 'kpi' ? '۱۴۰px' : '۳۴۰px')}</span>
                  </div>

                  {/* Right: Quick Width & Height controls & Remove */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Width decrement / increment */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleChangeColSpan(cardItem.id, -1); }}
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                      title={isFa ? 'کاهش عرض کارت' : 'Decrease width'}
                    >
                      <Minimize2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleChangeColSpan(cardItem.id, 1); }}
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                      title={isFa ? 'افزایش عرض کارت' : 'Increase width'}
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>

                    {/* Height Presets Quick Buttons */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetHeightPreset(cardItem.id, 'compact'); }}
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition cursor-pointer ${cardItem.height === 'compact' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                      title={isFa ? 'ارتفاع فشرده' : 'Compact height'}
                    >
                      {isFa ? 'فشرده' : 'Sm'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetHeightPreset(cardItem.id, 'normal'); }}
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition cursor-pointer ${(!cardItem.height || cardItem.height === 'normal') ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                      title={isFa ? 'ارتفاع استاندارد' : 'Normal height'}
                    >
                      {isFa ? 'عادی' : 'Md'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetHeightPreset(cardItem.id, 'expanded'); }}
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition cursor-pointer ${cardItem.height === 'expanded' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                      title={isFa ? 'ارتفاع بلند' : 'Expanded height'}
                    >
                      {isFa ? 'بلند' : 'Lg'}
                    </button>

                    {/* Hide Card */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveCard(cardItem.id, isFa ? (cardDef?.titleFa || cardItem.id) : (cardDef?.titleEn || cardItem.id)); }}
                      className="p-1 text-red-400 hover:text-red-200 hover:bg-red-950/60 rounded transition cursor-pointer ms-0.5"
                      title={isFa ? 'مخفی‌سازی کارت' : 'Hide card'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Drag-to-Resize Corner Handles (In Edit Mode) */}
              {isEditMode && (
                <>
                  {/* Primary Corner Handle (Bottom-Left in RTL) */}
                  <div
                    onMouseDown={(e) => handleStartResize(e, cardItem.id, 'bottom-left')}
                    onTouchStart={(e) => handleStartResize(e, cardItem.id, 'bottom-left')}
                    className="absolute bottom-2 start-2 z-40 p-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xl cursor-nesw-resize touch-none select-none flex items-center gap-1 text-[10px] font-black border border-blue-300/40 hover:scale-105 active:scale-95 transition-all group/resize"
                    title={isFa ? 'کشیدن جهت تغییر طول و عرض کارت (Drag to Resize)' : 'Drag to Resize Card'}
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline-block font-sans text-[9px]">{isFa ? 'تغییر سایز' : 'Resize'}</span>
                  </div>

                  {/* Secondary Corner Handle (Bottom-Right) */}
                  <div
                    onMouseDown={(e) => handleStartResize(e, cardItem.id, 'bottom-right')}
                    onTouchStart={(e) => handleStartResize(e, cardItem.id, 'bottom-right')}
                    className="absolute bottom-2 end-2 z-40 p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white shadow-md cursor-nwse-resize touch-none select-none flex items-center justify-center border border-slate-700 hover:scale-105"
                    title={isFa ? 'تغییر اندازه از گوشه راست' : 'Resize from right corner'}
                  >
                    <Maximize2 className="w-3 h-3" />
                  </div>
                </>
              )}

              {/* Active Real-Time Floating Indicator while Resizing */}
              {isResizingThis && (
                <div className="absolute bottom-11 start-2 z-50 px-3 py-1.5 rounded-xl bg-slate-950/95 text-white font-mono text-xs font-black shadow-2xl border border-blue-400/50 flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95">
                  <span className="text-blue-400">📐</span>
                  <span>عرض: {resizingCard.currentColSpan} ستون ({Math.round((resizingCard.currentColSpan / 12) * 100)}%)</span>
                  <span className="text-slate-400">|</span>
                  <span>طول: {resizingCard.currentHeight}px</span>
                </div>
              )}

              {/* Render Card's Live Content */}
              <div className={`h-full flex-1 flex flex-col ${isEditMode ? 'pt-9 pb-8' : ''}`}>
                {renderCardContent(cardItem.id)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CARD MANAGER & PRIORITIZATION MODAL ── */}
      <DashboardCardManagerModal
        isOpen={isCardManagerOpen}
        onClose={() => setIsCardManagerOpen(false)}
        cardsLayout={cardsLayout}
        onToggleCard={handleToggleCard}
        onResetToDefaults={handleResetToDefaults}
        onSelectAll={handleSelectAllCards}
        onSaveToDatabase={handleSaveLayoutToDb}
        onChangeColSpan={(cardId, span) => handleSetColSpan(cardId, span)}
        onChangeHeightPreset={(cardId, preset) => handleSetHeightPreset(cardId, preset)}
        isFa={isFa}
        isAdmin={isAdmin}
      />
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;

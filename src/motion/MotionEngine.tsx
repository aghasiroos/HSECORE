import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';

/**
 * HSECORE Advanced Central Motion Engine
 * Style: Professional Hybrid Motion (Advanced & Cinematic)
 * Canonical Motion Design Tokens:
 * - Module Transition : 350–550ms (380ms enter / 140ms exit)
 * - Tab Transition    : 250–350ms (260ms enter / 110ms exit)
 * - Theme Transition  : 400–600ms (460ms radial reveal / coordinated fallback)
 * - Card Morph        : 350–500ms (420ms)
 * - Hover             : 200–300ms (220ms)
 * - Modal / Dialog    : 250–400ms (280ms)
 * - Submenu           : 200–300ms (240ms)
 * - Icons             : 200–350ms (240ms)
 */
export const HSE_MOTION_CONFIG = {
  durations: {
    micro: 0.20,
    hover: 0.22,
    icon: 0.24,
    submenu: 0.24,
    tab: 0.26,
    modal: 0.28,
    page: 0.38,
    cardMorph: 0.42,
    theme: 0.46,
    exit: 0.14,
  },
  durationsMs: {
    micro: 200,
    hover: 220,
    icon: 240,
    submenu: 240,
    tab: 260,
    modal: 280,
    page: 380,
    cardMorph: 420,
    theme: 460,
    exit: 140,
  },
  easings: {
    standard: [0.22, 1, 0.36, 1] as const,
    smooth: [0.16, 1, 0.3, 1] as const,
    easeInOut: [0.4, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
} as const;

export type MotionPerformanceTier = 'cinematic' | 'balanced' | 'reduced';

export interface ThemeToggleOrigin {
  x: number;
  y: number;
}

export interface HseCardMorphOrigin {
  targetKey: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  accentColor?: string;
  title?: string;
  timestamp: number;
}

const HSE_MODULE_ORDER = [
  'dashboard',
  'heat',
  'hse-ms',
  'reports',
  'safety-unit',
  'fire-dept',
  'health-env',
  'psm',
  'permit',
  'ptw-audit',
  'risk',
  'ppe',
  'incidents',
  'warnings',
  'non-conformances',
  'personnel-history',
  'training',
  'documents',
  'pending-documents',
  'process-management',
  'notifications',
  'ai-assistant',
  'system',
  'user-mgmt',
  'profile',
];

function detectMotionPerformanceTier(): MotionPerformanceTier {
  if (typeof window === 'undefined') return 'cinematic';
  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return 'reduced';
    }
    const nav = navigator as any;
    const cores = typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : 8;
    const memory = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : 8;
    const saveData = Boolean(nav?.connection?.saveData);
    if (saveData || cores <= 2 || memory <= 2) {
      return 'balanced';
    }
  } catch {
    return 'cinematic';
  }
  return 'cinematic';
}

// Lightweight shared bridge to avoid prop-drilling & prevent concurrent overlap
let pendingCardMorphOrigin: HseCardMorphOrigin | null = null;
let activeThemeTransitionFlag = false;
let activePageTransitionFlag = false;

export function registerCardMorphOrigin(origin: Omit<HseCardMorphOrigin, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  pendingCardMorphOrigin = {
    ...origin,
    timestamp: Date.now(),
  };
}

export function consumeCardMorphOrigin(targetKey: string): HseCardMorphOrigin | null {
  if (!pendingCardMorphOrigin) return null;
  const age = Date.now() - pendingCardMorphOrigin.timestamp;
  if (pendingCardMorphOrigin.targetKey === targetKey && age < 1200) {
    const match = pendingCardMorphOrigin;
    pendingCardMorphOrigin = null;
    return match;
  }
  if (age >= 1200) {
    pendingCardMorphOrigin = null;
  }
  return null;
}

export function setThemeTransitionActive(active: boolean): void {
  activeThemeTransitionFlag = active;
}

export function isThemeTransitionActive(): boolean {
  return activeThemeTransitionFlag;
}

export function setPageTransitionActive(active: boolean): void {
  activePageTransitionFlag = active;
}

export function isPageTransitionActive(): boolean {
  return activePageTransitionFlag;
}

interface HseMotionContextValue {
  tier: MotionPerformanceTier;
  triggerCardMorph: (origin: Omit<HseCardMorphOrigin, 'timestamp'>) => void;
}

const HseMotionContext = createContext<HseMotionContextValue>({
  tier: 'cinematic',
  triggerCardMorph: registerCardMorphOrigin,
});

export function useHseMotion(): HseMotionContextValue {
  return useContext(HseMotionContext);
}

interface HseMotionProviderProps {
  children: React.ReactNode;
}

/**
 * Top-level Advanced Motion Provider:
 * - Applies MotionConfig reducedMotion="user"
 * - Detects hardware capabilities and sets <html data-motion-tier="...">
 * - Coordinates shared card morph & transition locks
 */
export const HseMotionProvider: React.FC<HseMotionProviderProps> = ({ children }) => {
  const [tier, setTier] = useState<MotionPerformanceTier>(() => detectMotionPerformanceTier());

  useEffect(() => {
    const updateTier = () => {
      const next = detectMotionPerformanceTier();
      setTier(next);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-motion-tier', next);
      }
    };

    updateTier();

    if (typeof window === 'undefined') {
      return;
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event?.reason?.message || event?.reason || '');
      if (
        msg.includes('Transition was aborted') ||
        msg.includes('DOM update timed out') ||
        msg.includes('skipTransition')
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    if (typeof window.matchMedia !== 'function') {
      return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', updateTier);
      return () => {
        mq.removeEventListener('change', updateTier);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  const contextValue = useMemo<HseMotionContextValue>(
    () => ({
      tier,
      triggerCardMorph: registerCardMorphOrigin,
    }),
    [tier]
  );

  return (
    <HseMotionContext.Provider value={contextValue}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </HseMotionContext.Provider>
  );
};

interface ModuleStageTransitionProps {
  moduleKey: string;
  isFa?: boolean;
  isFullHeight?: boolean;
  scrollContainerId?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Cinematic Multi-Stage Module Transition Wrapper (#app-main-stage):
 * - Directional + Depth + Scale + Fade (380ms enter / 140ms exit in cinematic tier)
 * - Continuous Card-to-Page Morph overlay when navigated from a Dashboard card
 * - Preserves & restores per-module scroll offset cleanly without blocking API/DOM mount
 */
export const ModuleStageTransition: React.FC<ModuleStageTransitionProps> = ({
  moduleKey,
  isFa = true,
  isFullHeight = false,
  scrollContainerId = 'app-main-stage',
  className = '',
  children,
}) => {
  const prefersReduced = useReducedMotion();
  const { tier } = useHseMotion();
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const prevModuleKeyRef = useRef<string>(moduleKey);
  const directionRef = useRef<number>(1);
  const [activeMorph, setActiveMorph] = useState<HseCardMorphOrigin | null>(null);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  if (prevModuleKeyRef.current !== moduleKey) {
    const prevIdx = HSE_MODULE_ORDER.indexOf(prevModuleKeyRef.current);
    const nextIdx = HSE_MODULE_ORDER.indexOf(moduleKey);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      directionRef.current = nextIdx > prevIdx ? 1 : -1;
    } else {
      directionRef.current = 1;
    }
  }

  // Handle Card-to-Page Morph & scroll restoration when moduleKey changes
  useEffect(() => {
    const prevKey = prevModuleKeyRef.current;
    let morphTimer: number | null = null;

    if (prevKey !== moduleKey) {
      const morphOrigin = tier !== 'reduced' ? consumeCardMorphOrigin(moduleKey) : null;
      const scrollEl = document.getElementById(scrollContainerId);

      if (morphOrigin && scrollEl) {
        const containerRect = scrollEl.getBoundingClientRect();
        setTargetRect({
          top: containerRect.top,
          left: containerRect.left,
          width: containerRect.width,
          height: Math.min(containerRect.height, window.innerHeight - containerRect.top - 24),
        });
        setActiveMorph(morphOrigin);
        morphTimer = window.setTimeout(() => {
          setActiveMorph(null);
          setTargetRect(null);
        }, HSE_MOTION_CONFIG.durationsMs.cardMorph);
      } else {
        setActiveMorph(null);
        setTargetRect(null);
      }

      if (scrollEl) {
        const savedTop = scrollPositionsRef.current.get(moduleKey) ?? 0;
        requestAnimationFrame(() => {
          if (!isFullHeight) {
            scrollEl.scrollTo({ top: savedTop, behavior: 'auto' });
          }
        });
      }

      prevModuleKeyRef.current = moduleKey;
    }

    return () => {
      if (morphTimer) {
        window.clearTimeout(morphTimer);
      }
    };
  }, [moduleKey, isFullHeight, scrollContainerId, tier]);

  // Continuously capture scroll position of active module cleanly via passive listener
  useEffect(() => {
    if (isFullHeight) return;
    const scrollEl = document.getElementById(scrollContainerId);
    if (!scrollEl) return;

    const handleScroll = () => {
      scrollPositionsRef.current.set(moduleKey, scrollEl.scrollTop);
    };

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollPositionsRef.current.set(moduleKey, scrollEl.scrollTop);
      scrollEl.removeEventListener('scroll', handleScroll);
    };
  }, [moduleKey, isFullHeight, scrollContainerId]);

  const wrapperClass = isFullHeight
    ? `flex-1 h-full min-h-0 flex flex-col overflow-hidden ${className}`.trim()
    : `w-full ${className}`.trim();

  if (prefersReduced || tier === 'reduced') {
    return (
      <div key={moduleKey} className={wrapperClass}>
        {children}
      </div>
    );
  }

  const isBalanced = tier === 'balanced';
  const enterDuration = isBalanced ? 0.24 : HSE_MOTION_CONFIG.durations.page;
  const exitDuration = isBalanced ? 0.10 : HSE_MOTION_CONFIG.durations.exit;
  const morphDuration = isBalanced ? 0.24 : HSE_MOTION_CONFIG.durations.cardMorph;
  const rtlSign = isFa ? -1 : 1;
  const xOffset = isFullHeight ? 0 : directionRef.current * rtlSign * 14;
  const yOffset = isFullHeight ? 0 : 12;

  return (
    <>
      {/* Continuous Card-to-Page Morph Overlay */}
      {activeMorph && targetRect && (
        <motion.div
          key={`morph-${activeMorph.timestamp}`}
          aria-hidden="true"
          className="fixed z-40 pointer-events-none rounded-2xl border backdrop-blur-[2px]"
          style={{
            borderColor: activeMorph.accentColor || 'rgba(59, 130, 246, 0.45)',
            background: `linear-gradient(135deg, ${activeMorph.accentColor || 'rgba(59, 130, 246, 0.14)'}, rgba(16, 185, 129, 0.05))`,
            boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.22)',
          }}
          initial={{
            top: activeMorph.rect.top,
            left: activeMorph.rect.left,
            width: activeMorph.rect.width,
            height: activeMorph.rect.height,
            opacity: 0.85,
            scale: 1,
          }}
          animate={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            opacity: 0,
            scale: 1,
          }}
          transition={{
            duration: morphDuration,
            ease: HSE_MOTION_CONFIG.easings.standard,
          }}
        />
      )}

      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => setPageTransitionActive(false)}
      >
        <motion.div
          key={moduleKey}
          onAnimationStart={() => setPageTransitionActive(true)}
          onAnimationComplete={() => setPageTransitionActive(false)}
          initial={{
            opacity: 0,
            x: xOffset,
            y: yOffset,
            scale: isFullHeight ? 1 : 0.985,
          }}
          animate={{
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            x: isFullHeight ? 0 : -xOffset * 0.5,
            y: isFullHeight ? 0 : -6,
            scale: isFullHeight ? 1 : 0.992,
            transition: {
              duration: exitDuration,
              ease: HSE_MOTION_CONFIG.easings.exit,
            },
          }}
          transition={{
            duration: enterDuration,
            ease: HSE_MOTION_CONFIG.easings.standard,
          }}
          className={wrapperClass}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

interface SubViewTransitionProps {
  viewKey: string;
  isFa?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Multi-Stage Unified transition wrapper for Sub-modules & Tabs:
 * - RTL-aware Fade + Horizontal Slide + Subtle Depth Scale (260ms enter / 110ms exit)
 * - Immediate interactive DOM mount with zero data/API delay
 */
export const SubViewTransition: React.FC<SubViewTransitionProps> = ({
  viewKey,
  isFa = true,
  className = '',
  children,
}) => {
  const prefersReduced = useReducedMotion();
  const { tier } = useHseMotion();

  if (prefersReduced || tier === 'reduced') {
    return <div className={className}>{children}</div>;
  }

  const slideX = isFa ? -12 : 12;
  const enterDur = tier === 'balanced' ? 0.18 : HSE_MOTION_CONFIG.durations.tab;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, x: slideX, scale: 0.992 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{
          opacity: 0,
          x: -slideX * 0.4,
          transition: {
            duration: 0.11,
            ease: HSE_MOTION_CONFIG.easings.exit,
          },
        }}
        transition={{
          duration: enterDur,
          ease: HSE_MOTION_CONFIG.easings.standard,
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

interface AnimatedCounterProps {
  value: number;
  formatter?: (val: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Smooth statistical counter interpolation that ALWAYS settles to the exact true value.
 * Never mutates underlying data and cleans up animation frames cleanly.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  formatter,
  durationMs = 420,
  className = '',
}) => {
  const { tier } = useHseMotion();
  const prefersReduced = useReducedMotion();
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeTarget);
  const previousValueRef = useRef<number>(safeTarget);

  useEffect(() => {
    if (prefersReduced || tier === 'reduced' || !Number.isFinite(safeTarget)) {
      previousValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const fromValue = previousValueRef.current;
    if (fromValue === safeTarget) {
      setDisplayValue(safeTarget);
      return;
    }

    const actualDuration = tier === 'balanced' ? Math.min(durationMs, 260) : durationMs;
    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / actualDuration);
      // Smooth Ease-Out Cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromValue + (safeTarget - fromValue) * eased;

      if (progress < 1) {
        setDisplayValue(current);
        rafId = requestAnimationFrame(step);
      } else {
        previousValueRef.current = safeTarget;
        setDisplayValue(safeTarget);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      previousValueRef.current = safeTarget;
    };
  }, [safeTarget, durationMs, tier, prefersReduced]);

  const formattedText = formatter
    ? formatter(displayValue === safeTarget ? safeTarget : Number.isInteger(safeTarget) ? Math.round(displayValue) : displayValue)
    : String(Number.isInteger(safeTarget) ? Math.round(displayValue) : displayValue.toFixed(1));

  return <span className={`tabular-nums ${className}`.trim()}>{formattedText}</span>;
};

interface HseSkeletonProps {
  className?: string;
}

/**
 * Shimmer skeleton block respecting light/dark themes and reduced-motion.
 */
export const HseSkeleton: React.FC<HseSkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return <div className={`hse-skeleton rounded-xl ${className}`} aria-hidden="true" />;
};

interface ModuleSkeletonFallbackProps {
  isFa?: boolean;
}

/**
 * Clean enterprise skeleton placeholder during lazy module chunk loading.
 */
export const ModuleSkeletonFallback: React.FC<ModuleSkeletonFallbackProps> = ({ isFa = true }) => {
  return (
    <div
      className="space-y-4 animate-fade-in select-none"
      dir={isFa ? 'rtl' : 'ltr'}
      role="status"
      aria-label={isFa ? 'در حال بارگذاری ماژول' : 'Loading module'}
    >
      {/* Top Banner Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <HseSkeleton className="w-11 h-11 rounded-xl shrink-0" />
          <div className="space-y-2">
            <HseSkeleton className="h-4 w-48 sm:w-64" />
            <HseSkeleton className="h-3 w-36 sm:w-48" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HseSkeleton className="h-9 w-24 rounded-xl" />
          <HseSkeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 min-h-[140px]"
          >
            <div className="flex items-center justify-between">
              <HseSkeleton className="h-3.5 w-28" />
              <HseSkeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <HseSkeleton className="h-8 w-20" />
              <HseSkeleton className="w-10 h-10 rounded-xl" />
            </div>
            <HseSkeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      {/* Content / Chart / Table Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 min-h-[260px]">
          <div className="flex items-center justify-between">
            <HseSkeleton className="h-4 w-44" />
            <HseSkeleton className="h-7 w-24 rounded-lg" />
          </div>
          <HseSkeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3 min-h-[260px]">
          <HseSkeleton className="h-4 w-32" />
          <HseSkeleton className="h-14 w-full rounded-xl" />
          <HseSkeleton className="h-14 w-full rounded-xl" />
          <HseSkeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
};

interface PsmSubmoduleSkeletonProps {
  title?: string;
}

/**
 * Focused skeleton loader for database-backed modules during initial fetch.
 */
export const PsmSubmoduleSkeleton: React.FC<PsmSubmoduleSkeletonProps> = () => {
  return (
    <div className="space-y-4 animate-fade-in select-none" aria-hidden="true">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
          >
            <div className="flex justify-between items-center">
              <HseSkeleton className="h-3.5 w-24" />
              <HseSkeleton className="h-8 w-8 rounded-lg" />
            </div>
            <HseSkeleton className="h-7 w-16" />
            <HseSkeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <HseSkeleton className="h-5 w-52" />
        <HseSkeleton className="h-12 w-full rounded-xl" />
        <HseSkeleton className="h-12 w-full rounded-xl" />
        <HseSkeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
};

export interface HseThemeToggleButtonProps {
  themeMode: 'light' | 'dark';
  onToggle: (origin?: ThemeToggleOrigin) => void;
  isFa?: boolean;
  variant?: 'sidebar' | 'header' | 'login' | 'rail';
  id?: string;
  className?: string;
}

/**
 * Unified Theme Toggle Button with smooth Sun <-> Moon Rotation, Scale, Cross-Fade & Subtle Glow.
 * Emits exact click origin coordinates for View Transition API radial Light/Dark Reveal.
 */
export const HseThemeToggleButton: React.FC<HseThemeToggleButtonProps> = ({
  themeMode,
  onToggle,
  isFa = true,
  variant = 'sidebar',
  id,
  className = '',
}) => {
  const isDark = themeMode === 'dark';
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const titleText = isDark
    ? isFa
      ? 'تغییر به حالت روشن'
      : 'Switch to Light Mode'
    : isFa
    ? 'تغییر به حالت تاریک'
    : 'Switch to Dark Mode';

  const variantClasses =
    variant === 'login'
      ? 'w-9 h-9 rounded-full bg-slate-900/45 hover:bg-slate-900/70 backdrop-blur-md border border-white/20 hover:border-sky-400/60 text-white shadow-sm flex items-center justify-center shrink-0 cursor-pointer'
      : variant === 'header'
      ? 'p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-amber-50/80 dark:hover:bg-slate-700/90 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 shadow-2xs flex items-center justify-center shrink-0 cursor-pointer'
      : variant === 'rail'
      ? 'w-8 h-8 mx-auto rounded-xl text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer'
      : 'p-1.5 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-center shrink-0 cursor-pointer';

  const sunColorClass =
    variant === 'login' ? 'text-amber-300' : 'text-amber-500 dark:text-amber-400';
  const moonColorClass =
    variant === 'login' ? 'text-sky-100' : 'text-sky-500 dark:text-amber-400';

  const showSunActive = variant === 'login' ? isDark : !isDark;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const origin: ThemeToggleOrigin =
        e.clientX > 0 || e.clientY > 0
          ? { x: e.clientX, y: e.clientY }
          : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

      setIsSwitching(true);
      if (switchTimerRef.current) {
        window.clearTimeout(switchTimerRef.current);
      }
      switchTimerRef.current = window.setTimeout(() => {
        setIsSwitching(false);
        switchTimerRef.current = null;
      }, HSE_MOTION_CONFIG.durationsMs.theme);

      onToggle(origin);
    },
    [onToggle]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      data-switching={isSwitching ? 'true' : 'false'}
      title={titleText}
      aria-label={titleText}
      aria-pressed={isDark}
      id={id}
      className={`hse-theme-toggle-btn ${variantClasses} ${className}`.trim()}
    >
      <span className="hse-theme-icon-stage" aria-hidden="true">
        <Sun
          className={`hse-theme-icon-sun ${sunColorClass} ${
            showSunActive ? 'hse-theme-icon-active' : 'hse-theme-icon-inactive-sun'
          }`}
        />
        <Moon
          className={`hse-theme-icon-moon ${moonColorClass} ${
            !showSunActive ? 'hse-theme-icon-active' : 'hse-theme-icon-inactive-moon'
          }`}
        />
      </span>
    </button>
  );
};

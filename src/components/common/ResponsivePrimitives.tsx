import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Centralized HSECORE Responsive Breakpoint Standards (Mobile-First)
 * Single source of truth for all current and future modules.
 */
export const HSE_BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  '3xl': 1920,
} as const;

export type HseBreakpointKey = keyof typeof HSE_BREAKPOINTS;

export interface ResponsiveViewportState {
  width: number;
  breakpoint: HseBreakpointKey;
  isMobile: boolean; // < 768px
  isCompactMobile: boolean; // < 480px
  isTablet: boolean; // 768px .. 1023px
  isDesktop: boolean; // >= 1024px
}

function computeViewportState(width: number): ResponsiveViewportState {
  let breakpoint: HseBreakpointKey = 'xs';
  if (width >= HSE_BREAKPOINTS['3xl']) breakpoint = '3xl';
  else if (width >= HSE_BREAKPOINTS['2xl']) breakpoint = '2xl';
  else if (width >= HSE_BREAKPOINTS.xl) breakpoint = 'xl';
  else if (width >= HSE_BREAKPOINTS.lg) breakpoint = 'lg';
  else if (width >= HSE_BREAKPOINTS.md) breakpoint = 'md';
  else if (width >= HSE_BREAKPOINTS.sm) breakpoint = 'sm';

  return {
    width,
    breakpoint,
    isMobile: width < HSE_BREAKPOINTS.md,
    isCompactMobile: width < 480,
    isTablet: width >= HSE_BREAKPOINTS.md && width < HSE_BREAKPOINTS.lg,
    isDesktop: width >= HSE_BREAKPOINTS.lg,
  };
}

/**
 * Shared viewport hook aligned with Tailwind & HSECORE breakpoints.
 */
export function useResponsiveViewport(): ResponsiveViewportState {
  const [state, setState] = useState<ResponsiveViewportState>(() =>
    computeViewportState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId = 0;
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setState(computeViewportState(window.innerWidth));
      });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return state;
}

/**
 * Reusable Mobile-First Page Header Primitive
 */
export interface ResponsivePageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const ResponsivePageHeader: React.FC<ResponsivePageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className = '',
}) => (
  <div
    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 min-w-0 ${className}`}
  >
    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white leading-snug break-words">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-start sm:justify-end">
        {actions}
      </div>
    )}
  </div>
);

/**
 * Reusable Mobile-First Scrollable Tab Bar Primitive
 */
export interface ResponsiveTabItem<T extends string = string> {
  key: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface ResponsiveTabBarProps<T extends string = string> {
  tabs: ResponsiveTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
}

export function ResponsiveTabBar<T extends string = string>({
  tabs,
  activeKey,
  onChange,
  className = '',
}: ResponsiveTabBarProps<T>) {
  return (
    <div
      role="tablist"
      className={`hse-tabs-scroll gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs sm:text-[13px] whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium border border-transparent'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== '' && (
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Reusable Mobile-First Form Grid Primitive
 */
export interface ResponsiveFormGridProps {
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveFormGrid: React.FC<ResponsiveFormGridProps> = ({
  columns = 3,
  children,
  className = '',
}) => {
  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return <div className={`grid ${colClass} gap-3 sm:gap-4 min-w-0 ${className}`}>{children}</div>;
};

/**
 * Reusable Table Wrapper supporting both Mobile Card Transformation & Horizontal Scroll
 */
export interface ResponsiveTableWrapperProps {
  mode?: 'auto' | 'scroll';
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveTableWrapper: React.FC<ResponsiveTableWrapperProps> = ({
  mode = 'auto',
  children,
  className = '',
}) => (
  <div
    data-hse-table-wrapper={mode}
    className={`hse-table-scroll-wrap rounded-2xl border border-slate-200/80 dark:border-slate-800 ${className}`}
  >
    {children}
  </div>
);

/**
 * Reusable Mobile-First Accessible Modal Shell Primitive
 */
export interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  isFa?: boolean;
  children: React.ReactNode;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'lg',
  footer,
  isFa = true,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass =
    size === 'sm'
      ? 'max-w-md'
      : size === 'md'
      ? 'max-w-xl'
      : size === 'xl'
      ? 'max-w-5xl'
      : size === 'full'
      ? 'max-w-7xl'
      : 'max-w-3xl';

  return (
    <div
      data-hse-modal-backdrop="true"
      className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${sizeClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-w-[36px] min-h-[36px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer flex items-center justify-center"
              aria-label={isFa ? 'بستن پنجره' : 'Close dialog'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">{children}</div>
        {footer && (
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-wrap items-center justify-end gap-2 shrink-0 hse-pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Central Automatic Responsive DOM Enhancer
// Connects ALL existing and future modules to the central Design System:
// 1. Auto-enhances standard semantic data <table> elements into RTL Mobile Cards
//    on viewports < 768px (zero data loss, zero per-module duplication).
// 2. Ensures complex/matrix tables always get a safe touch scroll wrapper.
// 3. Ensures all modal overlays get safe mobile viewport containment.
// ============================================================================

function isPrintOrHiddenContainer(el: Element): boolean {
  return Boolean(
    el.closest(
      '[data-print-view], .print-only, .print-sheet, .no-card-table, [data-hse-table-mode="native"], [data-hse-table-wrapper="scroll"], .hidden'
    )
  );
}

function enhanceTableElement(table: HTMLTableElement) {
  if (isPrintOrHiddenContainer(table)) {
    table.removeAttribute('data-hse-card-table');
    return;
  }

  // Skip nested tables inside another table
  if (table.parentElement?.closest('table')) {
    return;
  }

  const parent = table.parentElement;
  if (parent) {
    const parentStyle = parent.className || '';
    const hasScrollClass =
      parentStyle.includes('overflow-x-auto') ||
      parentStyle.includes('overflow-auto') ||
      parentStyle.includes('hse-table-scroll-wrap');
    if (!hasScrollClass && parent.tagName !== 'BODY' && parent.id !== 'root') {
      parent.classList.add('hse-table-scroll-wrap');
    }
  }

  const thead = table.tHead;
  const tbody = table.tBodies?.[0];
  if (!thead || !tbody) {
    table.setAttribute('data-hse-scroll-table', 'true');
    return;
  }

  // Only transform single-row simple headers (skip multi-tier engineering/print matrices)
  if (thead.rows.length !== 1) {
    table.setAttribute('data-hse-scroll-table', 'true');
    return;
  }

  const headerCells = Array.from(thead.rows[0].cells);
  if (headerCells.length < 2 || headerCells.length > 14) {
    table.setAttribute('data-hse-scroll-table', 'true');
    return;
  }

  const hasComplexHeader = headerCells.some((cell) => cell.colSpan > 1 || cell.rowSpan > 1);
  if (hasComplexHeader) {
    table.setAttribute('data-hse-scroll-table', 'true');
    return;
  }

  // Inspect body rows to avoid turning inline spreadsheet forms or merged-cell matrices into cards
  const bodyRows = Array.from(tbody.rows);
  let hasComplexBody = false;
  for (let i = 0; i < Math.min(bodyRows.length, 25); i++) {
    const row = bodyRows[i];
    const cells = Array.from(row.cells);
    // Allow single full-width empty state row (colSpan === headerCells.length)
    if (cells.length === 1 && cells[0].colSpan >= 2) continue;

    if (cells.length !== headerCells.length) {
      hasComplexBody = true;
      break;
    }
    if (cells.some((c) => c.colSpan > 1 || c.rowSpan > 1 || c.querySelector('table'))) {
      hasComplexBody = true;
      break;
    }
    // Skip editable grid/spreadsheet rows with >= 3 text/number inputs in one row
    const editableInputs = row.querySelectorAll(
      'input:not([type="checkbox"]):not([type="radio"]), select, textarea'
    );
    if (editableInputs.length >= 3) {
      hasComplexBody = true;
      break;
    }
  }

  if (hasComplexBody) {
    table.removeAttribute('data-hse-card-table');
    table.setAttribute('data-hse-scroll-table', 'true');
    return;
  }

  // Extract clean header labels
  const labels = headerCells.map((th) =>
    (th.innerText || th.textContent || '').replace(/\s+/g, ' ').trim()
  );

  table.setAttribute('data-hse-card-table', 'true');
  table.removeAttribute('data-hse-scroll-table');
  if (parent) {
    parent.classList.add('hse-card-table-parent');
  }

  // Stamp data-label & action-cell hints on all body cells
  for (let r = 0; r < bodyRows.length; r++) {
    const cells = Array.from(bodyRows[r].cells);
    if (cells.length === 1 && cells[0].colSpan >= 2) continue;

    for (let c = 0; c < cells.length; c++) {
      const td = cells[c];
      const label = labels[c] || '';
      if (td.getAttribute('data-label') !== label) {
        td.setAttribute('data-label', label);
      }

      const isActionCol =
        /عملیات|اقدام|اقدامات|کنترل|مدیریت|actions?/i.test(label) ||
        (c === cells.length - 1 && td.querySelectorAll('button, a').length >= 1 && !td.textContent?.trim().replace(/\s/g, '').length);

      if (isActionCol) {
        td.setAttribute('data-hse-cell-actions', 'true');
      } else if (td.hasAttribute('data-hse-cell-actions')) {
        td.removeAttribute('data-hse-cell-actions');
      }
    }
  }
}

function enhanceModalBackdrops(root: ParentNode) {
  const fixedOverlays = root.querySelectorAll<HTMLElement>('.fixed.inset-0');
  fixedOverlays.forEach((overlay) => {
    if (overlay.hasAttribute('data-hse-modal-backdrop')) return;
    const cls = overlay.className || '';
    if (
      cls.includes('pointer-events-none') ||
      cls.includes('z-[9990]') ||
      overlay.id === 'app-main-sidebar' ||
      overlay.getAttribute('aria-hidden') === 'true'
    ) {
      return;
    }
    // Check that it actually wraps a dialog/panel child
    if (overlay.children.length > 0 && (cls.includes('flex') || cls.includes('grid'))) {
      overlay.setAttribute('data-hse-modal-backdrop', 'true');
    }
  });
}

export const ResponsiveAutoEnhancer: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let rafId = 0;

    const runEnhancementPass = () => {
      rafId = 0;
      const stage = document.getElementById('app-main-stage');
      if (stage) {
        stage.querySelectorAll('table').forEach((t) => enhanceTableElement(t));
      }
      // Also enhance tables inside portaled modals on document.body
      document.body
        .querySelectorAll<HTMLTableElement>('[role="dialog"] table, [data-hse-modal-backdrop="true"] table')
        .forEach((t) => enhanceTableElement(t));

      enhanceModalBackdrops(document.body);
    };

    const schedulePass = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(runEnhancementPass);
    };

    // Initial pass
    schedulePass();

    const observer = new MutationObserver(() => {
      schedulePass();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
};

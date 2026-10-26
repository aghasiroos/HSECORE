import React, { useState, useEffect, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * Universal hook for submodule full-screen mode in Health & Environment.
 * Matches NonPeriodicExams standard: full viewport overlay, Escape key support,
 * clean responsive container classes, and smooth transitions.
 */
export function useSubmoduleFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: isFullscreen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: false } }));
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const containerClassName = isFullscreen
    ? 'fixed inset-0 z-50 overflow-y-auto w-full h-full min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 font-sans pb-16 transition-all duration-300'
    : 'relative w-full min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 font-sans pb-16 transition-all duration-300';

  return {
    isFullscreen,
    setIsFullscreen,
    toggleFullscreen,
    containerClassName
  };
}

export interface FullscreenToggleBtnProps {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
  activeColor?: string;
  titleFullscreen?: string;
  titleExit?: string;
}

/**
 * Standardized Fullscreen Toggle Button matching NonPeriodicExams styling.
 */
export const FullscreenToggleBtn: React.FC<FullscreenToggleBtnProps> = ({
  isFullscreen,
  onToggle,
  className = '',
  activeColor = 'text-emerald-600',
  titleFullscreen = 'نمایش تمام‌صفحه',
  titleExit = 'خروج از حالت تمام‌صفحه'
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0 ${className}`}
      title={isFullscreen ? titleExit : titleFullscreen}
      aria-label={isFullscreen ? titleExit : titleFullscreen}
    >
      {isFullscreen ? (
        <Minimize2 className={`w-4 h-4 ${activeColor}`} />
      ) : (
        <Maximize2 className="w-4 h-4" />
      )}
    </button>
  );
};

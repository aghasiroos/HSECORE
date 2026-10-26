import React from 'react';

export interface HseCoreBrandTextProps {
  className?: string;
  size?: 'sm' | 'md' | 'sidebar' | 'lg' | 'xl' | '2xl' | '3xl';
  textColor?: string;
  themeAdapt?: boolean;
  titleOverride?: string;
  /** When true, only "HSE" is rendered (e.g. for collapsed sidebar) */
  showHseOnly?: boolean;
}

/**
 * Official HSECORE Brand Typography Component
 * Requirements:
 * - Generously enlarged dimensions with aesthetic balance and golden proportions
 * - "HSE" in deep navy/slate (adapting to bright crisp white in dark mode)
 * - "CORE" in vibrant HSE green (emerald/green-500)
 * - Distinctive circular emblem for "O" of CORE with HSE leaf & delicate vein
 * - Perfectly scaled typography using Eras Bold ITC / Arial Black with exact optical balance
 */
export const HseCoreBrandText: React.FC<HseCoreBrandTextProps> = ({
  className = '',
  size = 'sidebar',
  textColor,
  themeAdapt = true,
  titleOverride,
  showHseOnly = false,
}) => {
  // If user entered a custom title other than HSECORE / HSE-MS
  if (titleOverride && titleOverride !== 'HSECORE' && titleOverride !== 'HSE-MS') {
    return (
      <span 
        className={`font-black tracking-tight select-none truncate ${textColor || 'text-slate-900 dark:text-white'} ${className}`} 
        dir="ltr"
      >
        {titleOverride}
      </span>
    );
  }

  // Size variations tuned with generous, visually impactful dimensions:
  // - 'sm': compact previews (text-xl sm:text-2xl)
  // - 'md': standard medium (text-2xl sm:text-3xl)
  // - 'sidebar': Specially tuned for bold, elegant header presence:
  //              text-[30px] sm:text-[34px] xl:text-[36px]
  // - 'lg': large (text-3xl sm:text-[40px])
  // - 'xl': extra large for login hero (text-4xl sm:text-5xl lg:text-[56px])
  // - '2xl': giant display (text-5xl sm:text-6xl lg:text-7xl)
  // - '3xl': billboard (text-6xl sm:text-7xl lg:text-8xl)
  const sizeClasses: Record<string, string> = {
    sm: 'text-lg sm:text-xl tracking-tight',
    md: 'text-xl sm:text-2xl tracking-tight',
    sidebar: 'text-[22px] sm:text-[23px] lg:text-[24px] xl:text-[25px] tracking-tight leading-none',
    lg: 'text-2xl sm:text-3xl tracking-tight',
    xl: 'text-4xl sm:text-5xl lg:text-[56px] tracking-tight leading-none',
    '2xl': 'text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-none',
    '3xl': 'text-6xl sm:text-7xl lg:text-8xl tracking-tight leading-none'
  };

  const resolvedSizeClass = sizeClasses[size] || sizeClasses.sidebar;

  // "HSE" color:
  // In themeAdapt mode: slate-900 / white in dark mode
  // In non-themeAdapt mode: pure white (e.g., login hero screen)
  const hseColorClass = textColor || (themeAdapt ? 'text-slate-900 dark:text-white' : 'text-white');

  // "CORE" color:
  // Rich emerald green (emerald-600 in light mode for crisp contrast, emerald-400 in dark mode for vivid glow)
  const coreTextColorClass = themeAdapt 
    ? 'text-emerald-600 dark:text-emerald-400' 
    : 'text-emerald-400';

  // Circular emblem styling for the "O" inside CORE
  const emblemBgClass = themeAdapt
    ? 'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-slate-950 shadow-md ring-1 ring-emerald-500/30'
    : 'bg-emerald-400 text-slate-950 shadow-md ring-1 ring-white/20';

  const emblemStrokeClass = themeAdapt
    ? 'stroke-white dark:stroke-slate-950'
    : 'stroke-slate-950';

  return (
    <span 
      className={`font-black inline-flex flex-row flex-nowrap items-center leading-none select-none whitespace-nowrap font-eras-bold transition-transform px-1 ${resolvedSizeClass} ${className}`}
      style={{ fontFamily: '"Eras Bold ITC", "Eras ITC", "Eras Bold", "Eras", "Arial Black", sans-serif' }}
      dir="ltr"
    >
      {/* HSE Part */}
      <span 
        className={`leading-none shrink-0 font-eras-bold transition-colors ${showHseOnly ? 'px-0.5' : ''} ${hseColorClass}`}
        style={{ fontFamily: '"Eras Bold ITC", "Eras ITC", "Eras Bold", "Eras", "Arial Black", sans-serif' }}
      >
        HSE
      </span>

      {/* CORE Part in Green (rendered when showHseOnly is false) */}
      {!showHseOnly && (
        <span 
          className={`inline-flex flex-row flex-nowrap items-center leading-none shrink-0 font-eras-bold transition-colors ${coreTextColorClass}`}
          style={{ fontFamily: '"Eras Bold ITC", "Eras ITC", "Eras Bold", "Eras", "Arial Black", sans-serif' }}
        >
          {/* Letter C */}
          <span 
            className="leading-none shrink-0 font-eras-bold ml-[1.5px]"
            style={{ fontFamily: '"Eras Bold ITC", "Eras ITC", "Eras Bold", "Eras", "Arial Black", sans-serif' }}
          >
            C
          </span>

          {/* Circular Emblem for "O" containing HSE Leaf with Vein - mathematically aligned to cap-height */}
          <span 
            className={`relative inline-flex items-center justify-center w-[0.82em] h-[0.82em] rounded-full mx-[2.5px] shrink-0 self-center transition-all ${emblemBgClass}`}
            style={{ verticalAlign: 'middle' }}
            title="HSE Core Emblem"
          >
            <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="currentColor">
              {/* Organic leaf body */}
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              {/* Center leaf vein */}
              <path 
                d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" 
                fill="none" 
                strokeWidth="1.85" 
                strokeLinecap="round" 
                className={emblemStrokeClass}
              />
            </svg>
          </span>

          {/* Letters RE */}
          <span 
            className="leading-none shrink-0 font-eras-bold pr-1"
            style={{ fontFamily: '"Eras Bold ITC", "Eras ITC", "Eras Bold", "Eras", "Arial Black", sans-serif' }}
          >
            RE
          </span>
        </span>
      )}
    </span>
  );
};

export default HseCoreBrandText;

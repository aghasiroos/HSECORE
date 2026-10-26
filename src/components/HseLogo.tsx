import React from 'react';
import {
  useSystemBranding,
  getFormalHeaderBranding,
  getSidebarNavBranding,
  getLoginScreenBranding,
  OFFICIAL_HSECORE_LOGO_URL,
  resolveOfficialLogoUrl
} from '../utils/systemBrandingHelper';

export interface HseLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'hero';
  className?: string;
  showShadow?: boolean;
  variant?: 'badge' | 'plain' | 'white-card';
  forceDefault?: boolean;
  altText?: string;
  overrideLogoUrl?: string | null;
  overrideAspectRatio?: 'contain' | 'cover' | 'natural';
  target?: 'header' | 'sidebar' | 'nav' | 'login' | 'global';
}

export const HseLogo: React.FC<HseLogoProps> = ({
  size = 'md',
  className = '',
  showShadow = true,
  variant = 'badge',
  forceDefault = false,
  altText = 'HSECORE Logo',
  overrideLogoUrl,
  overrideAspectRatio,
  target = 'global'
}) => {
  const { branding } = useSystemBranding();

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
    '3xl': 'w-28 h-28',
    hero: 'w-36 h-36 md:w-44 md:h-44'
  };

  // Determine logo URL and aspect ratio from unified branding source
  let targetedUrl: string = OFFICIAL_HSECORE_LOGO_URL;
  let targetedAspect: 'contain' | 'cover' | 'natural' = 'contain';

  if (target === 'login') {
    const lConf = getLoginScreenBranding(branding);
    targetedUrl = lConf.logoUrl;
    targetedAspect = lConf.aspectRatio as any;
  } else if (target === 'sidebar' || target === 'nav') {
    const sConf = getSidebarNavBranding(branding);
    targetedUrl = sConf.logoUrl;
    targetedAspect = sConf.aspectRatio as any;
  } else if (target === 'header') {
    const hConf = getFormalHeaderBranding(branding);
    targetedUrl = hConf.logoUrl;
    targetedAspect = hConf.aspectRatio as any;
  } else {
    targetedUrl = resolveOfficialLogoUrl(branding?.logoUrl);
    targetedAspect = branding?.aspectRatioMode || 'contain';
  }

  const effectiveLogoUrl = forceDefault
    ? OFFICIAL_HSECORE_LOGO_URL
    : overrideLogoUrl !== undefined && overrideLogoUrl !== null
      ? resolveOfficialLogoUrl(overrideLogoUrl)
      : resolveOfficialLogoUrl(targetedUrl);

  const isOfficialDefault = effectiveLogoUrl === OFFICIAL_HSECORE_LOGO_URL;
  const effectiveAspectRatio = isOfficialDefault
    ? 'contain'
    : (overrideAspectRatio || targetedAspect || 'contain');

  const isCircle = target === 'login' || variant === 'badge';
  const objectFitClass = effectiveAspectRatio === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform duration-200 select-none ${
        sizeClasses[size]
      } ${
        variant === 'white-card'
          ? 'bg-white rounded-2xl p-1 shadow-md border border-slate-100 dark:border-slate-800'
          : isCircle
            ? 'rounded-full overflow-hidden bg-white'
            : 'rounded-xl overflow-hidden bg-white'
      } ${showShadow && variant !== 'white-card' && !isCircle ? 'shadow-md shadow-emerald-500/15' : ''} ${className}`}
    >
      <img
        src={effectiveLogoUrl}
        alt={altText}
        draggable={false}
        referrerPolicy="no-referrer"
        className={`w-full h-full ${objectFitClass} select-none block`}
        style={{
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      />
    </div>
  );
};

export default HseLogo;

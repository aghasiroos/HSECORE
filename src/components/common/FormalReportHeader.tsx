import React from 'react';
import { useSystemBranding, getFormalHeaderBranding } from '../../utils/systemBrandingHelper';
import { HseLogo } from '../HseLogo';

export interface FormalReportHeaderProps {
  /** Document / Form main title in Persian (e.g. چک‌لیست بازرسی روزانه جرثقیل و بالابرها) */
  title?: string;
  /** Alias for title */
  docTitle?: string;
  /** Optional subtitle or English title */
  subtitle?: string;
  /** Standard document code (e.g. HSE-FO-SAF-024) */
  docCode?: string;
  /** Revision number (e.g. 02 or بازنگری ۰۱) */
  revision?: string;
  /** Effective / Revision date (e.g. 1404/05/20) */
  docDate?: string;
  /** Alias for docDate */
  issueDate?: string;
  /** Page number / count string (e.g. صفحه ۱ از ۱) */
  pageInfo?: string;
  /** Document security / classification level */
  classification?: string;
  /** Site / Complex location name */
  siteName?: string;
  /** Unit / Department specific title */
  departmentName?: string;
  /** Custom logo position override: 'right' | 'center' | 'left' */
  logoPositionOverride?: 'right' | 'center' | 'left';
  /** Custom logo URL override for live staged preview */
  logoUrlOverride?: string | null;
  /** Custom aspect ratio override */
  aspectRatioOverride?: 'contain' | 'cover' | 'natural';
  /** Custom Org Name Fa override */
  orgTitleFaOverride?: string;
  /** Custom Org Name En override */
  orgTitleEnOverride?: string;
  /** Extra class names */
  className?: string;
  /** Is Persian locale */
  isFa?: boolean;
}

export const FormalReportHeader: React.FC<FormalReportHeaderProps> = ({
  title,
  docTitle,
  subtitle,
  docCode = 'HSE-FO-GEN-01',
  revision = '01',
  docDate,
  issueDate,
  pageInfo = 'صفحه ۱ از ۱',
  classification = 'سند رسمی داخلی',
  siteName,
  departmentName = 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)',
  logoPositionOverride,
  logoUrlOverride,
  aspectRatioOverride,
  orgTitleFaOverride,
  orgTitleEnOverride,
  className = '',
  isFa = true
}) => {
  const effectiveTitle = title || docTitle || 'فرم استاندارد HSE';
  const effectiveDate = docDate || issueDate;
  const { branding } = useSystemBranding();
  const formalBranding = getFormalHeaderBranding(branding);
  const effectivePosition = logoPositionOverride || formalBranding.position || 'right';
  const effectiveLogoUrl = logoUrlOverride !== undefined ? logoUrlOverride : formalBranding.logoUrl;
  const effectiveAspectRatio = aspectRatioOverride || formalBranding.aspectRatio || 'contain';

  const orgTitleFa = orgTitleFaOverride || branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)';
  const orgTitleEn = orgTitleEnOverride || branding.organizationNameEn || 'HSECORE - The Core of HSE Management';
  const subTitleText = subtitle || branding.subTitleFa;

  const renderLogoBox = (size: 'sm' | 'md' | 'lg' = 'md') => {
    const hasCustomLogo = Boolean(effectiveLogoUrl);

    return (
      <div className="flex items-center justify-center shrink-0 w-full h-full">
        {hasCustomLogo && effectiveLogoUrl ? (
          <div 
            className="flex items-center justify-center p-1 bg-white rounded-lg border border-slate-200/80 print:border-none w-full max-h-16"
            style={{ minWidth: '60px' }}
          >
            <img
              src={effectiveLogoUrl}
              alt={orgTitleFa}
              referrerPolicy="no-referrer"
              className={`max-h-14 sm:max-h-16 max-w-full object-${effectiveAspectRatio} select-none`}
              style={{ 
                imageRendering: 'auto',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            />
          </div>
        ) : (
          <div className="p-1 bg-white rounded-xl border border-slate-200/80 shadow-xs print:border-none">
            <HseLogo size="lg" forceDefault={true} showShadow={false} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`w-full border-2 border-slate-900 bg-white text-slate-900 p-3.5 sm:p-4 rounded-2xl print:rounded-none print:border-2 print:border-black print:p-3 mb-4 shadow-xs select-none ${className}`}
      style={{
        direction: 'rtl',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* 3-Column Formal Standard Header: Right Section (Logo Only) | Center Title Section | Left Metadata Section */}
      <div className="grid grid-cols-12 gap-3 items-center">
        
        {/* Right Section: ONLY Logo (No Text) */}
        <div className="col-span-3 sm:col-span-3 flex items-center justify-center border-l border-slate-300 pl-3 print:border-black">
          {effectivePosition === 'right' && renderLogoBox()}
        </div>

        {/* Center Section: Document Title & Subtitle */}
        <div className="col-span-6 sm:col-span-6 text-center px-2 flex flex-col items-center justify-center">
          {effectivePosition === 'center' && (
            <div className="mb-1.5 flex justify-center w-full">
              {renderLogoBox('sm')}
            </div>
          )}
          <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight leading-snug">
            {effectiveTitle}
          </h1>
          {subTitleText && (
            <h2 className="text-[11px] sm:text-xs font-bold text-blue-900 print:text-black mt-0.5">
              {subTitleText}
            </h2>
          )}
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 print:bg-transparent rounded-md border border-slate-300 print:border-black text-slate-700 print:text-black">
              {classification}
            </span>
          </div>
        </div>

        {/* Left Section: Document Code, Revision, Date, Page Info & Logo (if logoPosition is left) */}
        <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-3 border-r border-slate-300 pr-3 print:border-black">
          <div className="text-left font-mono text-[10px] sm:text-xs space-y-1 text-slate-800 print:text-black w-full">
            <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 print:border-slate-400">
              <span className="text-[9px] text-slate-500 print:text-black font-sans">{isFa ? 'کد فرم:' : 'Doc No:'}</span>
              <strong className="text-slate-900 font-black tracking-wider text-[11px]">{docCode}</strong>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 print:border-slate-400">
              <span className="text-[9px] text-slate-500 print:text-black font-sans">{isFa ? 'ویرایش / بازنگری:' : 'Revision:'}</span>
              <strong className="text-slate-900">{revision}</strong>
            </div>
            {effectiveDate && (
              <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 print:border-slate-400">
                <span className="text-[9px] text-slate-500 print:text-black font-sans">{isFa ? 'تاریخ صدور:' : 'Date:'}</span>
                <strong className="text-slate-900">{effectiveDate}</strong>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-slate-500 print:text-black font-sans">{isFa ? 'شماره صفحه:' : 'Page:'}</span>
              <span className="text-[10px] text-slate-600 print:text-black font-sans">{pageInfo}</span>
            </div>
          </div>

          {effectivePosition === 'left' && renderLogoBox()}
        </div>

      </div>
    </div>
  );
};

export default FormalReportHeader;

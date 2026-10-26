import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  X, 
  ShieldAlert, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  User, 
  AlertTriangle,
  History,
  Send
} from 'lucide-react';
import { WarningRecord, UserProfile } from '../../types';
import { useSystemBranding } from '../../utils/systemBrandingHelper';
import { HseLogo } from '../HseLogo';
import { printService } from '../../services/printService';
import { PrintDocumentSignaturesBox } from '../referral/PrintDocumentSignaturesBox';
import { CreateReferralModal } from '../referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from '../referral/DocumentWorkflowTrackerModal';
import { getCurrentUser } from '../../utils/authHelper';
import { normalizeDigits } from '../../utils/textNormalization';

interface WarningNoticePrintModalProps {
  warning: WarningRecord;
  allWarnings?: WarningRecord[];
  currentUser?: UserProfile | null;
  onClose: () => void;
  isFa?: boolean;
}

// 📚 Full list of Persian ordinals (حروف کامل فارسی بدون استفاده از ارقام یا پسوند عددی)
const PERSIAN_ORDINALS = [
  'اولین',
  'دومین',
  'سومین',
  'چهارمین',
  'پنجمین',
  'ششمین',
  'هفتمین',
  'هشتمین',
  'نهمین',
  'دهمین',
  'یازدهمین',
  'دوازدهمین',
  'سیزدهمین',
  'چهاردهمین',
  'پانزدهمین',
  'شانزدهمین',
  'هفدهمین',
  'هجدهمین',
  'نوزدهمین',
  'بیستمین',
  'بیست و یکمین',
  'بیست و دومین',
  'بیست و سومین',
  'بیست و چهارمین',
  'بیست و پنجمین',
  'بیست و ششمین',
  'بیست و هفتمین',
  'بیست و هشتمین',
  'بیست و نهمین',
  'سی‌امین'
];

/**
 * Converts any repetition input (e.g. '1', '1مین', '2', 'دوم', etc.) or array index
 * into 100% pure Persian words with NO digits or numeric characters.
 */
export function toPurePersianOrdinal(input?: string | number, fallbackIndex: number = 0): string {
  const defaultFallback = PERSIAN_ORDINALS[fallbackIndex] || 'اولین';
  if (input === undefined || input === null) return defaultFallback;

  const raw = String(input).trim();
  if (!raw) return defaultFallback;

  // Direct word matches
  if (/^اول(ین)?(\s*بار)?$/i.test(raw)) return 'اولین';
  if (/^دوم(ین)?(\s*بار)?$/i.test(raw)) return 'دومین';
  if (/^سوم(ین)?(\s*بار)?$/i.test(raw)) return 'سومین';
  if (/^چهارم(ین)?(\s*بار)?$/i.test(raw)) return 'چهارمین';
  if (/^پنجم(ین)?(\s*بار)?$/i.test(raw)) return 'پنجمین';
  if (/^ششم(ین)?(\s*بار)?$/i.test(raw)) return 'ششمین';
  if (/^هفتم(ین)?(\s*بار)?$/i.test(raw)) return 'هفتمین';
  if (/^هشتم(ین)?(\s*بار)?$/i.test(raw)) return 'هشتمین';
  if (/^نهم(ین)?(\s*بار)?$/i.test(raw)) return 'نهمین';
  if (/^دهم(ین)?(\s*بار)?$/i.test(raw)) return 'دهمین';
  if (/^یازدهم(ین)?(\s*بار)?$/i.test(raw)) return 'یازدهمین';
  if (/^دوازدهم(ین)?(\s*بار)?$/i.test(raw)) return 'دوازدهمین';

  // Extract digits (including Persian / Arabic numerals)
  const normalizedDigits = normalizeDigits(raw, true);

  const digitMatch = normalizedDigits.match(/\d+/);
  if (digitMatch) {
    const num = parseInt(digitMatch[0], 10);
    if (num >= 1 && num <= PERSIAN_ORDINALS.length) {
      return PERSIAN_ORDINALS[num - 1];
    }
  }

  // Strip all numbers and clean
  const lettersOnly = raw.replace(/[0-9۰-۹٠-٩\-_ـ]/g, '').trim();
  if (lettersOnly) {
    if (lettersOnly.endsWith('بار')) {
      const stripped = lettersOnly.replace(/بار$/, '').trim();
      if (stripped) return stripped.endsWith('ین') ? stripped : `${stripped}ین`;
    }
    return lettersOnly.endsWith('ین') ? lettersOnly : `${lettersOnly}ین`;
  }

  return defaultFallback;
}

export default function WarningNoticePrintModal({
  warning: w,
  allWarnings = [],
  currentUser: propUser,
  onClose,
  isFa = true
}: WarningNoticePrintModalProps) {
  const { branding } = useSystemBranding();

  // Page orientation state: 'landscape' | 'portrait' (Standard A5)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showHistoryInPrint, setShowHistoryInPrint] = useState<boolean>(true);

  // Referral and Workflow Modals
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false);
  const [showTrackerModal, setShowTrackerModal] = useState<boolean>(false);
  const activeUser = useMemo(() => {
    if (propUser) return propUser;
    try {
      if (typeof getCurrentUser === 'function') {
        const u = getCurrentUser();
        if (u) return u;
      }
      const stored = sessionStorage.getItem('hse_current_user');
      if (stored) return JSON.parse(stored);
      const remember = localStorage.getItem('hse_remember_user');
      if (remember) return JSON.parse(remember);
    } catch {}
    return null;
  }, [propUser]);

  // Find all distinct previous warnings for this recipient (excluding current notice & removing duplicates)
  const previousWarnings = useMemo(() => {
    const normalizeNum = (num?: string) => (num || '').trim().toLowerCase().replace(/\s+/g, '');
    const currentNum = normalizeNum(w.number);
    const currentId = w.id ? String(w.id).trim() : '';
    const currentRecipientName = (w.name || '').trim().toLowerCase();
    const currentPersonnelCode = (w.personnelCode || '').trim();

    // Step 1: Filter to recipient's records and strictly exclude the current warning
    const matching = allWarnings.filter(item => {
      // Exclude current warning by ID
      if (currentId && item.id && String(item.id).trim() === currentId) {
        return false;
      }

      // Exclude current warning by notice number (case-insensitive & trimmed)
      const itemNum = normalizeNum(item.number);
      if (currentNum && itemNum && itemNum === currentNum) {
        return false;
      }

      // Exclude identical current warning content (same recipient, date and violation reason)
      if (
        String(item.day).trim() === String(w.day).trim() &&
        String(item.month).trim() === String(w.month).trim() &&
        String(item.year).trim() === String(w.year).trim() &&
        (item.reason || '').trim().toLowerCase() === (w.reason || '').trim().toLowerCase() &&
        (item.name || '').trim().toLowerCase() === currentRecipientName
      ) {
        return false;
      }

      // Match recipient: by personnelCode (if available)
      if (currentPersonnelCode && item.personnelCode && item.personnelCode.trim() !== '') {
        return item.personnelCode.trim() === currentPersonnelCode;
      }

      // Fallback match: recipient full name
      if (currentRecipientName && item.name && item.name.trim() !== '') {
        return item.name.trim().toLowerCase() === currentRecipientName;
      }

      return false;
    });

    // Step 2: Sort chronologically ascending (earlier warnings first)
    matching.sort((a, b) => {
      const yA = Number(a.year) || 0;
      const yB = Number(b.year) || 0;
      if (yA !== yB) return yA - yB;
      const mA = Number(a.month) || 0;
      const mB = Number(b.month) || 0;
      if (mA !== mB) return mA - mB;
      return (Number(a.day) || 0) - (Number(b.day) || 0);
    });

    // Step 3: Deduplicate records so no duplicate notice is ever shown
    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();
    const seenContent = new Set<string>();
    const deduped: WarningRecord[] = [];

    for (const item of matching) {
      const idKey = item.id ? String(item.id).trim() : null;
      const numKey = normalizeNum(item.number);
      const contentKey = `${item.year}-${item.month}-${item.day}-${(item.reason || '').trim().toLowerCase()}-${(item.unit || '').trim().toLowerCase()}`;

      // Skip duplicates by database ID
      if (idKey && seenIds.has(idKey)) continue;

      // Skip duplicates by official notice number
      if (numKey && seenNumbers.has(numKey)) continue;

      // Skip duplicates by exact date + reason + unit
      if (seenContent.has(contentKey)) continue;

      if (idKey) seenIds.add(idKey);
      if (numKey) seenNumbers.add(numKey);
      seenContent.add(contentKey);
      deduped.push(item);
    }

    return deduped;
  }, [allWarnings, w]);

  // Dynamic repetition calculation in 100% pure Persian words with NO digits
  const getRepetitionLabel = () => {
    if (w.repetitionText && w.repetitionText.trim()) {
      return toPurePersianOrdinal(w.repetitionText.trim(), previousWarnings.length);
    }
    // Number of prior distinct warnings + 1 for current notice
    return toPurePersianOrdinal(undefined, previousWarnings.length);
  };

  const repetitionStr = getRepetitionLabel();
  const companyName = branding?.organizationNameFa?.includes('رجال') 
    ? branding.organizationNameFa 
    : 'مجتمع پتروشیمی رجال';
  const persianDate = `${w.day} ${w.month} ${w.year}`;

  const handlePrint = () => {
    printService.printElement('warning-notice-sheet', {
      title: `حکم انضباطی و اخطار کتبی HSE - ${w.number || ''} - ${w.name || ''}`,
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      pageSize: 'A4',
      documentCode: w.number,
      documentDate: persianDate,
      isFa: true,
      autoPrint: true
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-start print:bg-white print:static print:inset-auto print:overflow-visible print:block print:p-0 print:m-0"
      dir="rtl"
    >
      {/* 🖨️ Top Floating Toolbar (Hidden when printing) */}
      <header className="sticky top-0 left-0 right-0 z-60 w-full bg-slate-900/95 border-b border-slate-800 text-white px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white">
                {isFa ? 'فرم سازمانی ابلاغ اخطار کتبی HSE (قالب رنگی رسمی A5 - کارت پرسنلی)' : 'Official HSE Warning Notice (Personnel Card Blue A5)'}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black bg-blue-600/30 text-blue-300 border border-blue-400/40">
                {w.number}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 hidden sm:block">
              {isFa ? 'طراحی شده با قاب رسمی آبی نفتی سازمانی، حذف نوشته کنار لوگو، بدون خط عمودی میان صادرکننده و رئیس HSE' : 'Corporate royal blue framed notice layout'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Orientation Toggle: A5 Landscape vs A5 Portrait */}
          <div className="hidden sm:flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                orientation === 'landscape' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {isFa ? 'A5 افقی (پیشنهادی)' : 'A5 Landscape'}
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                orientation === 'portrait' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              {isFa ? 'A5 عمودی' : 'A5 Portrait'}
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
              className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
              title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-slate-300 px-1">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(130, prev + 10))}
              className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
              title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              title={isFa ? 'اندازه پیش‌فرض' : 'Reset Zoom'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggle Prior Infractions History Table */}
          <button
            type="button"
            onClick={() => setShowHistoryInPrint(prev => !prev)}
            className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              showHistoryInPrint
                ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isFa ? 'نمایش یا پنهان‌سازی سوابق قبلی اخطارها در فرم چاپی' : 'Toggle prior warnings table in printout'}
          >
            <History className="w-3.5 h-3.5" />
            <span>
              {isFa ? `سوابق قبلی (${previousWarnings.length})` : `Prior History (${previousWarnings.length})`}
            </span>
          </button>

          {/* Main Print / Save PDF Button */}
          <button
            type="button"
            onClick={() => setShowReferralModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer"
            title={isFa ? 'ارجاع سند جهت بررسی، تأیید و امضا' : 'Refer Document'}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isFa ? 'ارجاع سند' : 'Refer'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTrackerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs border border-slate-600 shadow-md transition cursor-pointer"
            title={isFa ? 'رهگیری گردش کار، امضاها و ممیزی' : 'Workflow Tracker'}
          >
            <History className="w-3.5 h-3.5 text-blue-300" />
            <span>{isFa ? 'گردش کار' : 'Workflow'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ فرم / خروجی PDF' : 'Print / Save PDF'}</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title={isFa ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 📄 Printable Document Root Container */}
      <main className="w-full flex-1 flex justify-center py-4 px-2 sm:px-4 print:p-0 print:m-0 print:w-full print:block">
        
        {/* Dynamic A5 Printable Sheet: calibrated to strictly fit on A5 sheet with Royal Blue Frame */}
        <article
          id="warning-notice-sheet"
          className={`bg-white text-slate-900 border-[3px] border-[#1b365d] shadow-2xl print:border-[3px] print:border-[#1b365d] print:shadow-none print:rounded-none print:p-0 print:m-0 transition-transform origin-top flex flex-col justify-between overflow-hidden ${
            orientation === 'landscape'
              ? 'w-[210mm] max-w-[210mm] min-h-[148mm] p-[6mm] text-[11px]'
              : 'w-[148mm] max-w-[148mm] min-h-[210mm] p-[5mm] text-[10.5px]'
          }`}
          style={{
            transform: `scale(${zoomLevel / 100})`,
            colorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            boxSizing: 'border-box'
          }}
        >
          {/* Inner Formal Security Border (Dual Frame like Personnel ID Badge) */}
          <div className={`w-full h-full flex flex-col justify-between border border-[#1b365d] bg-white overflow-hidden ${
            orientation === 'portrait' ? 'p-2 space-y-1.5' : 'p-2.5 sm:p-3 space-y-2'
          }`}>
            
            {/* 🏷️ 1. Master Official Header Table with Blue Accents */}
            <div className="border-2 border-[#1b365d] overflow-hidden bg-white shrink-0">
              <div className={`grid items-stretch divide-x divide-[#1b365d] divide-x-reverse ${
                orientation === 'portrait' 
                  ? 'grid-cols-12' 
                  : 'grid-cols-12'
              }`}>
                
                {/* Right Column: Emblem ONLY - Cleanly centered with NO text next to it */}
                <div className={`p-1.5 sm:p-2 flex items-center justify-center bg-blue-50/40 ${
                  orientation === 'portrait' ? 'col-span-3' : 'col-span-3'
                }`}>
                  <HseLogo size={orientation === 'portrait' ? 'lg' : 'xl'} showShadow={false} />
                </div>

                {/* Center Column: Formal Corporate Title */}
                <div className={`p-1.5 sm:p-2 text-center flex flex-col justify-center space-y-0.5 ${
                  orientation === 'portrait' ? 'col-span-5' : 'col-span-6'
                }`}>
                  <h1 className={`font-black text-[#1b365d] tracking-tight ${
                    orientation === 'portrait' ? 'text-[11.5px]' : 'text-[13px]'
                  }`}>
                    {companyName}
                  </h1>
                  <h2 className={`font-black text-slate-800 ${
                    orientation === 'portrait' ? 'text-[10px]' : 'text-[11px]'
                  }`}>
                    مرکز بهداشت، ایمنی و محیط زیست (HSE)
                  </h2>
                  <div className="mt-0.5 pt-0.5 border-t border-blue-200">
                    <span className={`font-black text-rose-800 ${
                      orientation === 'portrait' ? 'text-[10px] leading-tight block' : 'text-[11.5px]'
                    }`}>
                      برگه رسمی اخطار کتبی و تذکر انضباطی رعایت الزامات ایمنی
                    </span>
                  </div>
                </div>

                {/* Left Column: Official Metadata (Auto-aligned with no wrapped lines) */}
                <div className={`p-1.5 sm:p-2 text-right flex flex-col justify-center bg-blue-50/40 font-bold text-slate-800 ${
                  orientation === 'portrait' 
                    ? 'col-span-4 space-y-0.5 text-[8.5px]' 
                    : 'col-span-3 space-y-1 text-[10px]'
                }`}>
                  <div className="flex justify-between items-center border-b border-blue-200/90 pb-0.5 gap-1">
                    <span className="text-slate-600 shrink-0 whitespace-nowrap text-[8.5px]">شماره ابلاغیه:</span>
                    <span className="font-mono font-black text-rose-800 text-[10.5px] shrink-0 whitespace-nowrap">{w.number}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-blue-200/90 pb-0.5 gap-1">
                    <span className="text-slate-600 shrink-0 whitespace-nowrap text-[8.5px]">تاریخ صدور:</span>
                    <span className="font-mono font-bold text-slate-900 text-[9px] shrink-0 whitespace-nowrap">{persianDate}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-blue-200/90 pb-0.5 gap-1">
                    <span className="text-slate-600 shrink-0 whitespace-nowrap text-[8.5px]">نوع اخطار:</span>
                    <span className="font-bold text-slate-900 text-[8.5px] shrink-0 whitespace-nowrap">
                      {w.type === 'فردی' ? 'فردی (پرسنلی)' : 'واحدی (پیمانکار)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-600 shrink-0 whitespace-nowrap text-[8.5px]">طبقه‌بندی:</span>
                    <span className="font-bold text-[#1b365d] text-[8.5px] shrink-0 whitespace-nowrap">محرمانه - انضباطی</span>
                  </div>
                </div>

              </div>
            </div>

            {/* ⚠️ 2. Mandated Warning Sentence (Strict Formal Text with Blue Header) */}
            <div className="border-2 border-[#1b365d] overflow-hidden bg-white shrink-0">
              <div className="bg-[#1b365d] text-white px-2.5 py-1 border-b border-[#1b365d] flex items-center justify-between">
                <span className="text-[10.5px] font-black flex items-center gap-1.5 text-white">
                  <AlertTriangle className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                  <span>متن ابلاغیه رسمی و تذکر قانونی رعایت مقررات ایمنی</span>
                </span>
                <span className="text-[8.5px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-xs shrink-0 whitespace-nowrap">
                  الزام‌آور و بازدارنده
                </span>
              </div>

              <div className={`bg-white ${
                orientation === 'portrait' ? 'p-2.5 space-y-2' : 'p-3 sm:p-3.5 space-y-2.5'
              }`}>
                {/* Mandated statement - Fully balanced, baseline-aligned, zero orphan periods */}
                {w.noticeText && w.noticeText.trim() ? (
                  <p className={`text-slate-950 font-medium text-justify leading-relaxed ${
                    orientation === 'portrait' 
                      ? 'text-[10.5px] leading-[25px]' 
                      : 'text-[11.5px] leading-[28px]'
                  }`}>
                    {w.noticeText}
                  </p>
                ) : (
                  <p className={`text-slate-950 font-normal text-justify ${
                    orientation === 'portrait' 
                      ? 'text-[10.5px] leading-[25px]' 
                      : 'text-[11.5px] leading-[28px]'
                  }`}>
                    <span>جناب آقای </span>
                    <span className="inline-flex items-center align-baseline px-2 py-0.5 mx-0.5 font-black text-slate-950 bg-slate-100 border border-slate-300 rounded-xs text-[10.5px] leading-tight whitespace-nowrap shadow-2xs">
                      {w.name || '................................'}
                    </span>
                    <span> واحد / پیمانکار </span>
                    <span className="inline-flex items-center align-baseline px-2 py-0.5 mx-0.5 font-black text-slate-950 bg-slate-100 border border-slate-300 rounded-xs text-[10.5px] leading-tight whitespace-nowrap shadow-2xs">
                      {w.unit || '................................'}
                    </span>
                    <span> بدینوسیله برای </span>
                    <span className="inline-flex items-center align-baseline px-2 py-0.5 mx-0.5 font-black text-rose-800 bg-rose-50 border border-rose-300 rounded-xs text-[10.5px] leading-tight whitespace-nowrap shadow-2xs">
                      {repetitionStr}
                    </span>
                    <span> بار به دلیل </span>
                    <span className="inline font-black text-rose-950 bg-amber-50/90 border border-amber-300/90 px-1.5 py-0.5 mx-0.5 rounded-xs text-[10.5px] leading-tight align-baseline shadow-2xs [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                      « {w.reason || 'تخلف از دستورالعمل‌ها و مقررات ایمنی مجتمع'} »
                    </span>
                    <span>
                      {' '}به شما اخطار داده می‌شود تا نسبت به عدم تکرار مورد فوق و رعایت مقررات بهداشت، ایمنی و محیط زیست مطابق با دستورالعمل مجتمع پتروشیمی رجال اقدام فرمایید.
                    </span>
                  </p>
                )}

                {/* Statutory Formal Note */}
                <div className="text-[8.5px] sm:text-[9px] font-medium text-slate-700 bg-blue-50/50 border border-blue-200 p-1.5 rounded-xs flex items-start gap-1.5 leading-relaxed">
                  <span className="font-black text-[#1b365d] shrink-0 whitespace-nowrap">تبصره انضباطی:</span>
                  <span className="text-justify">
                    این ابلاغیه در پرونده سوابق پرسنلی / پیمانکاری نامبرده بایگانی گردیده و در صورت تکرار هرگونه نقض الزامات HSE، پرونده وفق آیین‌نامه انضباطی مجتمع به کمیته انضباطی کار و مراجع ذیصلاح ارجاع و مشمول کسر امتیاز و اقدامات قانونی خواهد شد.
                  </span>
                </div>
              </div>
            </div>

            {/* 📜 3. Comprehensive Prior Infraction History Table (سوابق سال‌ها و دفعات گذشته) */}
            {showHistoryInPrint && (
              <div className="border-2 border-[#1b365d] overflow-hidden bg-white shrink-0">
                <div className="bg-[#1b365d] text-white px-2.5 py-1 border-b border-[#1b365d] flex items-center justify-between gap-2 overflow-hidden">
                  <span className="text-[9.5px] sm:text-[10px] font-black flex items-center gap-1.5 text-white min-w-0 truncate">
                    <History className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                    <span className="truncate">
                      {orientation === 'portrait'
                        ? 'سوابق اخطارهای قبلی ثبت‌شده در سامانه HSE'
                        : 'سوابق اخطارهای قبلی ثبت‌شده در سنوات و دفعات گذشته (تاریخ اخطار و علت تخلف)'}
                    </span>
                  </span>
                  <span className="text-[8.5px] font-bold text-blue-100 bg-blue-900/80 border border-blue-400/40 px-2 py-0.5 rounded-xs shrink-0 whitespace-nowrap">
                    {previousWarnings.length > 0 
                      ? `${previousWarnings.length} سابقه پیشین` 
                      : 'فاقد سابقه قبلی در بایگانی'}
                  </span>
                </div>

                {previousWarnings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className={`w-full border-collapse ${
                      orientation === 'portrait' ? 'text-[8.5px]' : 'text-[9.5px]'
                    }`}>
                      <thead>
                        <tr className="bg-blue-50/80 text-[#1b365d] border-b border-blue-200 font-black">
                          <th className="p-1 border-l border-blue-200 w-7 text-center">ردیف</th>
                          <th className="p-1 border-l border-blue-200 w-20 text-center">شماره اخطار</th>
                          <th className="p-1 border-l border-blue-200 w-20 text-center">تاریخ اخطار</th>
                          <th className="p-1 border-l border-blue-200 w-16 text-center">نوبت</th>
                          <th className="p-1 border-l border-blue-200 w-24 text-right pr-2">واحد / پیمانکار</th>
                          <th className="p-1 text-right pr-2">علت اخطار و شرح تخلف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousWarnings.map((prev, idx) => (
                          <tr key={prev.id || idx} className="border-b border-blue-100 last:border-0 hover:bg-blue-50/20">
                            <td className="p-1 border-l border-blue-200 text-center font-mono font-bold text-slate-700">{idx + 1}</td>
                            <td className="p-1 border-l border-blue-200 text-center font-mono font-bold text-rose-800">{prev.number}</td>
                            <td className="p-1 border-l border-blue-200 text-center font-mono text-slate-900 font-bold whitespace-nowrap">
                              {prev.day} {prev.month} {prev.year}
                            </td>
                            <td className="p-1 border-l border-blue-200 text-center font-bold text-[#1b365d]">
                              {toPurePersianOrdinal(prev.repetitionText, idx)}
                            </td>
                            <td className="p-1 border-l border-blue-200 pr-2 font-medium text-slate-800">
                              {prev.unit || '—'}
                            </td>
                            <td className="p-1 pr-2 text-slate-900 font-medium leading-tight">
                              {prev.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-2 text-center text-slate-600 text-[8.5px] sm:text-[9.5px] bg-slate-50/60 font-medium leading-relaxed">
                    در بایگانی سامانه HSE مجتمع، سابقه اخطار انضباطی قبلی برای نامبرده ثبت نگردیده است (این حکم به عنوان اولین سابقه در پرونده درج می‌گردد).
                  </div>
                )}
              </div>
            )}

            {/* ✍️ 4. Unified Legal Signatures & Approval Matrix */}
            <div className="shrink-0">
              <PrintDocumentSignaturesBox
                documentType="WARNING"
                documentId={w.id}
                isFa={isFa}
                title={isFa ? 'تاییدات، امضاها و احراز اصالت الکترونیکی سند اخطار انضباطی' : 'Warning Official Signatures & Matrix'}
                fallbackSignatories={[
                  { roleTitle: 'صادرکننده اخطار', subTitle: 'کارشناس / افسر ناظر HSE', defaultName: w.issuerName || 'کارشناس ناظر HSE' },
                  { roleTitle: 'مرکز HSE', subTitle: 'مجتمع پتروشیمی رجال', defaultName: 'مرکز ایمنی' },
                  { roleTitle: 'مدیریت مجتمع', subTitle: 'مجتمع پتروشیمی رجال', defaultName: 'مدیریت مجتمع' }
                ]}
              />
            </div>

            {/* 🏷️ 5. Master Footer (Auto-adapting in one line with no overflow) */}
            <div className="border-t border-blue-300 pt-1 flex items-center justify-between text-[8px] sm:text-[8.5px] text-slate-600 font-sans gap-2 overflow-hidden shrink-0">
              <div className="truncate min-w-0">
                <span className="font-bold text-[#1b365d] whitespace-nowrap">
                  {branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-bold shrink-0 whitespace-nowrap">
                <span>کد: HSE-FRM-WRN-01</span>
                <span className="text-slate-300">|</span>
                <span>بازنگری: ۰۵</span>
                <span className="text-slate-300">|</span>
                <span className="font-mono font-black text-[#1b365d]">صفحه ۱ از ۱</span>
              </div>
            </div>

          </div>
        </article>
      </main>

      {/* Global Print-Specific CSS for Strict A5 Sizing and Personnel Card Blue Frame */}
      <style>{`
        @media print {
          @page {
            size: A5 ${orientation};
            margin: 5mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #warning-notice-sheet {
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 100% !important;
            max-height: 100% !important;
            box-shadow: none !important;
            border: 3px solid #1b365d !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          header, footer, nav, .print\\:hidden {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      {/* UNIFIED REFERRAL MODAL */}
      {showReferralModal && (
        <CreateReferralModal
          documentType="WARNING"
          documentId={w.id}
          documentNumber={w.number}
          documentTitle={`اخطار انضباطی ${w.name} - ${w.reason}`}
          currentUser={activeUser}
          isFa={isFa}
          onClose={() => setShowReferralModal(false)}
          onSuccess={() => {
            setShowReferralModal(false);
            alert(isFa ? 'اخطار با موفقیت به کارتابل کاربر مقصد ارجاع گردید.' : 'Warning referred successfully.');
          }}
        />
      )}

      {/* UNIFIED WORKFLOW TRACKER MODAL */}
      {showTrackerModal && (
        <DocumentWorkflowTrackerModal
          documentType="WARNING"
          documentId={w.id}
          documentNumber={w.number}
          documentTitle={`اخطار انضباطی ${w.name} - ${w.reason}`}
          currentUser={activeUser}
          isFa={isFa}
          onClose={() => setShowTrackerModal(false)}
        />
      )}
    </div>
  );
}

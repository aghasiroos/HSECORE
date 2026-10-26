import React, { useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  HardHat, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  CheckCircle2, 
  AlertOctagon, 
  Truck, 
  Info,
  Calendar,
  Clock,
  MapPin,
  Camera,
  Layers,
  FileCheck,
  Check,
  HelpCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { printService } from '../../../services/printService';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import { HseLogo } from '../../../components/HseLogo';
import { OperationalSafetyInspection, SafetyChecklistInspectionItem } from '../types';
import { 
  normalizeInspectionType, 
  getPeriodicIntervalLabel, 
  calculateNextInspectionDate,
  isMachineryChecklist 
} from '../../../utils/inspectionScheduleHelper';

interface OperationalChecklistPrintModalProps {
  inspection: OperationalSafetyInspection;
  onClose: () => void;
  isFa?: boolean;
}

export default function OperationalChecklistPrintModal({
  inspection,
  onClose,
  isFa = true
}: OperationalChecklistPrintModalProps) {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const { branding } = useSystemBranding();
  
  // Interactive UI state for preview mode
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [colorTheme, setColorTheme] = useState<'mono' | 'color'>('mono');
  const [showPdfHint, setShowPdfHint] = useState<boolean>(false);

  const insp = inspection;

  // Dynamic Form Code based on template
  const getDocumentCode = () => {
    const typeId = (insp.checklistTypeId || 'gen').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `HSE-FO-SAF-${typeId.substring(0, 4) || 'GEN'}-01`;
  };

  const handlePrint = () => {
    if (printContainerRef.current) {
      printService.printElement(printContainerRef.current, {
        title: `چک‌لیست بازرسی ایمنی - ${insp.checklistTypeNameFa || insp.title || ''} - ${insp.id || ''}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: getDocumentCode(),
        documentDate: insp.inspectionDate,
        isFa: isFa,
        autoPrint: true
      });
    } else {
      window.print();
    }
  };

  // Calculate stats dynamically
  const totalItems = insp.items?.length || insp.totalItems || 0;
  const passedCount = insp.passedCount ?? insp.items?.filter(i => i.verdict === 'pass').length ?? 0;
  const failedCount = insp.failedCount ?? insp.items?.filter(i => i.verdict === 'fail').length ?? 0;
  const warningCount = insp.warningCount ?? insp.items?.filter(i => i.verdict === 'warning').length ?? 0;
  const naCount = insp.naCount ?? insp.items?.filter(i => i.verdict === 'na').length ?? 0;
  const scorePercent = insp.scorePercent ?? (totalItems > 0 ? Math.round((passedCount / (totalItems - naCount || 1)) * 100) : 100);

  // Generate verification payload for QR Code
  const qrVerificationData = JSON.stringify({
    docId: insp.id,
    type: insp.checklistTypeNameFa || insp.title,
    date: insp.inspectionDate,
    unit: insp.unit,
    inspector: insp.inspectorName,
    score: `${scorePercent}%`,
    status: insp.status === 'COMPLETED' ? 'APPROVED' : 'ACTION_REQUIRED',
    system: 'HSE-Enterprise-Portal'
  });

  // Extract all photos (general + item defects)
  const allGeneralPhotos = insp.photos || [];
  const allItemPhotos = (insp.items || []).flatMap(it => 
    (it.photos || []).map(p => ({
      ...p,
      itemTitle: it.title,
      verdict: it.verdict
    }))
  );
  const totalPhotosCount = allGeneralPhotos.length + allItemPhotos.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/90 backdrop-blur-md flex flex-col items-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible font-sans">
      
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Interactive Control Toolbar (Screen Only - Hidden in Print) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-2 z-50 w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 bg-slate-900/95 text-white backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 print:hidden mb-4 animate-in fade-in slide-in-from-top-2">
        
        {/* Left Actions: Print & PDF */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
            title="چاپ مستقیم روی برگ A4 استاندارد یا خروجی PDF"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ رسمی فرم A4' : 'Print Formal A4 Form'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer border border-slate-700"
            title="راهنمای ذخیره فایل PDF بدون حاشیه اضافی"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>{isFa ? 'ذخیره PDF' : 'Save PDF'}</span>
          </button>

          {/* Color Mode / Theme Switcher */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setColorTheme('mono')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                colorTheme === 'mono'
                  ? 'bg-slate-700 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-black" />
              <span>{isFa ? 'تک‌رنگ ممیزی (سیاه‌وسفید)' : 'Audit Mono'}</span>
            </button>
            <button
              type="button"
              onClick={() => setColorTheme('color')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                colorTheme === 'color'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-400 to-emerald-400" />
              <span>{isFa ? 'رنگی سازمانی' : 'Corporate Color'}</span>
            </button>
          </div>
        </div>

        {/* Right Actions: Zoom & Close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700 gap-1 text-slate-300">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(prev - 10, 60))}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-300 hover:text-white cursor-pointer"
              title="کوچک‌نمایی"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold px-1 text-slate-200 min-w-[40px] text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(prev + 10, 150))}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-300 hover:text-white cursor-pointer"
              title="بزرگ‌نمایی"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white cursor-pointer"
              title="اندازه ۱۰۰٪ واقعی A4"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer border border-rose-500/30"
          >
            <X className="w-4 h-4" />
            <span>{isFa ? 'بستن' : 'Close'}</span>
          </button>
        </div>
      </div>

      {/* PDF Guidance Toast */}
      {showPdfHint && (
        <div className="sticky top-18 z-50 max-w-2xl bg-slate-850 text-slate-200 border border-blue-500/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md mb-3 flex items-start gap-3 text-xs print:hidden animate-in fade-in">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-black text-blue-300 mb-0.5">{isFa ? 'راهنمای چاپ در قطع A4 و ذخیره PDF:' : 'A4 Print & PDF Guide:'}</div>
            <div className="leading-relaxed text-[11px]">
              {isFa ? (
                <>در پنجره چاپ مرورگر، مقصد را روی <strong>«Save as PDF»</strong> قرار داده، اندازه کاغذ را <strong>A4</strong>، جهت را <strong>Portrait (عمودی)</strong>، گزینه‌های <strong>«Background Graphics»</strong> را فعال و حاشیه (Margins) را روی <strong>«None / حداقل»</strong> تنظیم فرمایید.</>
              ) : (
                <>Select <strong>"Save as PDF"</strong>, Paper size <strong>A4</strong>, Layout <strong>Portrait</strong>, enable <strong>"Background Graphics"</strong> and set Margins to <strong>"None"</strong>.</>
              )}
            </div>
          </div>
          <button 
            onClick={() => setShowPdfHint(false)}
            className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Strict CSS Print Directives for High-Precision A4 Output */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 7mm 6mm 7mm;
          }
          *, *:before, *:after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-family: IRANSans, Vazirmatn, system-ui, -apple-system, sans-serif !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            transform: none !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          table {
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        }
      `}</style>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* The Printable A4 Sheet Document */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div 
        ref={printContainerRef}
        dir="rtl"
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        className={`print-container w-full max-w-[210mm] bg-white text-black p-5 sm:p-7 shadow-2xl rounded-2xl transition-transform duration-200 border border-slate-300 print:p-0 print:border-none print:shadow-none print:rounded-none ${
          colorTheme === 'mono' ? 'print-theme-mono' : 'print-theme-color'
        }`}
      >

        {/* ── 1. FORMAL DOCUMENT HEADER (سربرگ رسمی سازمانی با استاندارد ممیزی) ── */}
        <div className="border-2 border-black rounded-lg overflow-hidden mb-3">
          <div className="grid grid-cols-12 divide-x-2 divide-x-reverse divide-black bg-white">
            
            {/* Right/Start: Official Logo (Only Logo, No Text) */}
            <div className="col-span-3 p-1.5 flex items-center justify-center text-center bg-slate-50/50">
              <div className="w-full h-16 sm:h-18 flex items-center justify-center p-1 bg-white rounded-lg">
                {branding.logoUrl ? (
                  <img 
                    src={branding.logoUrl} 
                    alt="Organization Logo" 
                    className="max-h-full max-w-full object-contain select-none"
                  />
                ) : (
                  <HseLogo size="md" target="header" showShadow={false} />
                )}
              </div>
            </div>

            {/* Center: Formal Document Title & Subtitle */}
            <div className="col-span-6 p-2 flex flex-col items-center justify-center text-center">
              <span className="text-[8.5px] font-bold text-slate-600 tracking-wider">
                {isFa ? 'سامانه یکپارچه نظارت و بازرسی‌های میدانی HSE' : 'INTEGRATED HSE AUDIT & INSPECTION SYSTEM'}
              </span>
              <h1 className="text-sm sm:text-base font-black text-black my-1">
                {insp.checklistTypeNameFa || insp.title}
              </h1>
              <div className="flex items-center justify-center gap-3 text-[9px] font-bold text-slate-800">
                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-mono">
                  {getDocumentCode()}
                </span>
                <span>{isFa ? 'شماره بازنگری: ۰۳' : 'Rev: 03'}</span>
                <span>{isFa ? 'کد طبقه‌بندی: رسمی / ممیزی' : 'Classification: Official'}</span>
              </div>
            </div>

            {/* Left: Metadata & Verification QR Code */}
            <div className="col-span-3 p-1.5 flex items-center justify-between gap-1.5 bg-slate-50/50 text-[8.5px]">
              <div className="space-y-0.5 text-right flex-1">
                <div><span className="text-slate-600">{isFa ? 'شماره سند:' : 'Doc No:'}</span> <strong className="font-mono text-[9px]">{insp.id}</strong></div>
                <div><span className="text-slate-600">{isFa ? 'تاریخ بازرسی:' : 'Date:'}</span> <strong className="font-mono">{insp.inspectionDate}</strong></div>
                <div><span className="text-slate-600">{isFa ? 'ساعت ثبت:' : 'Time:'}</span> <strong className="font-mono">{insp.inspectionTime || '-'}</strong></div>
                <div><span className="text-slate-600">{isFa ? 'صفحه:' : 'Page:'}</span> <strong className="font-mono">۱ از ۱</strong></div>
              </div>
              <div className="p-1 bg-white border border-black rounded shrink-0 shadow-2xs" title="اسکن اصالت گزارش">
                <QRCodeSVG value={qrVerificationData} size={44} level="M" />
              </div>
            </div>

          </div>
        </div>

        {/* ── 2. INSPECTION CONTEXT & SITE SPECIFICATIONS (مشخصات و موقعیت بازرسی) ── */}
        <div className="border border-black rounded-md overflow-hidden mb-3 text-[9.5px]">
          <div className="bg-slate-200/90 text-black px-2.5 py-1 font-black border-b border-black flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{isFa ? 'الف) مشخصات موقعیت، زمان‌بندی و هویت بازرسی میدانی' : 'A) Inspection Site, Timing & Identity'}</span>
            </div>
            <span className="text-[8.5px] font-mono text-slate-700 font-bold">
              {isFa ? `نوع بازرسی: ${insp.inspectionType === 'PERIODIC' ? 'دوره‌ای برنامه‌ریزی‌شده' : 'پیش/پس از عملیات یا موردی'}` : `Type: ${insp.inspectionType}`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-reverse divide-y sm:divide-y-0 divide-slate-400 bg-white">
            
            <div className="p-1.5 border-l border-slate-300">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'سایت / مجتمع:' : 'Site / Plant:'}</span>
              <strong className="text-black text-[10px]">{insp.site || 'مجتمع اصلی'}</strong>
            </div>

            <div className="p-1.5 border-l border-slate-300">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'واحد عملیاتی:' : 'Operating Unit:'}</span>
              <strong className="text-black text-[10px]">{insp.unit || '-'}</strong>
            </div>

            <div className="p-1.5 border-l border-slate-300">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'موقعیت دقیق استقرار / تجهیز:' : 'Exact Location / Tag:'}</span>
              <strong className="text-black text-[10px] truncate block">{insp.areaLocation || '-'}</strong>
            </div>

            <div className="p-1.5">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'پروانه کار / مجوز متصل:' : 'Permit / Linked ID:'}</span>
              <strong className="text-black font-mono text-[9px]">{insp.permitNumber || insp.relatedOperationId || (insp.relatedOperationTitle ? insp.relatedOperationTitle : 'فاقد پروانه متصل')}</strong>
            </div>

          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-reverse divide-y sm:divide-y-0 divide-slate-400 bg-slate-50/50 border-t border-slate-300">
            
            <div className="p-1.5 border-l border-slate-300">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'کارشناس / بازرس ایمنی:' : 'Safety Inspector:'}</span>
              <strong className="text-black text-[10px]">{insp.inspectorName || '-'}</strong>
            </div>

            <div className="p-1.5 border-l border-slate-300">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'شماره پرسنلی بازرس:' : 'Inspector Code:'}</span>
              <strong className="text-black font-mono text-[9.5px]">{insp.inspectorCode || '-'}</strong>
            </div>

            <div className="p-1.5 border-l border-slate-300">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'دوره تناوب بازرسی:' : 'Interval Frequency:'}</span>
              <strong className="text-black text-[9.5px]">
                {normalizeInspectionType(insp.inspectionType) === 'PERIODIC' 
                  ? getPeriodicIntervalLabel(insp.periodicInterval, isFa) 
                  : (isFa ? 'قبل از شروع کار / موردی' : 'Pre-Op / Adhoc')}
              </strong>
            </div>

            <div className="p-1.5">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'موعد سررسید بازرسی بعدی:' : 'Next Due Date:'}</span>
              <strong className="text-blue-900 font-mono text-[9.5px]">
                {normalizeInspectionType(insp.inspectionType) === 'PERIODIC'
                  ? (insp.nextInspectionDate || calculateNextInspectionDate(insp.inspectionDate, 'PERIODIC', insp.periodicInterval || 'MONTHLY'))
                  : '-'}
              </strong>
            </div>

          </div>
        </div>

        {/* ── 3. MACHINERY & TECHNICAL SPECIFICATIONS (در صورت وجود ماشین‌آلات یا تجهیز) ── */}
        {(insp.machineryTonnage || insp.machinerySpecs || insp.machineryType || insp.machineryTagNumber || isMachineryChecklist(insp.checklistTypeId, insp.checklistTypeNameFa)) && (
          <div className="border border-black rounded-md overflow-hidden mb-3 text-[9px] bg-white">
            <div className="bg-amber-100/90 text-amber-950 px-2.5 py-0.5 font-black border-b border-black flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3 h-3 text-amber-800" />
                <span>{isFa ? 'ب) مشخصات فنی، تناژ و استاندارد باربرداری ماشین‌آلات و تجهیزات حساس' : 'B) Machinery Specifications & SWL Capacity'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-reverse divide-slate-300 p-1 bg-white">
              <div className="p-1 border-l border-slate-300">
                <span className="text-slate-600 block text-[8px]">{isFa ? 'نوع دستگاه / ماشین:' : 'Machinery Type:'}</span>
                <strong className="text-black">{insp.machineryType || insp.checklistTypeNameFa}</strong>
              </div>
              <div className="p-1 border-l border-slate-300">
                <span className="text-slate-600 block text-[8px]">{isFa ? 'مدل و مشخصات فنی:' : 'Model/Specs:'}</span>
                <strong className="text-black">{insp.machinerySpecs || '-'}</strong>
              </div>
              <div className="p-1 border-l border-slate-300">
                <span className="text-slate-600 block text-[8px]">{isFa ? 'ظرفیت باربرداری مجاز (SWL):' : 'Safe Working Load (SWL):'}</span>
                <strong className="text-black font-mono font-bold">{insp.machineryTonnage || '-'}</strong>
              </div>
              <div className="p-1">
                <span className="text-slate-600 block text-[8px]">{isFa ? 'شماره تگ / پلاک شناسایی:' : 'Tag / Plate ID:'}</span>
                <strong className="text-black font-mono font-bold">{insp.machineryTagNumber || '-'}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. EXECUTIVE SUMMARY & KPI CARDS (خلاصه شاخص‌ها و وضعیت انطباق) ── */}
        <div className="border border-black rounded-md overflow-hidden mb-3 text-[9px] bg-slate-50">
          <div className="grid grid-cols-5 divide-x-2 divide-x-reverse divide-black text-center font-bold">
            
            <div className="p-1.5 bg-white">
              <span className="text-slate-600 block text-[8px]">{isFa ? 'کل بندهای کنترل‌شده' : 'Total Items'}</span>
              <strong className="text-xs font-mono text-black">{totalItems}</strong>
            </div>

            <div className="p-1.5 bg-white">
              <span className="text-emerald-800 block text-[8px]">{isFa ? '✓ موارد منطبق (تایید)' : '✓ Passed'}</span>
              <strong className="text-xs font-mono text-emerald-900">{passedCount}</strong>
            </div>

            <div className="p-1.5 bg-white">
              <span className="text-rose-800 block text-[8px]">{isFa ? '✗ عدم انطباق (نواقص)' : '✗ Defects'}</span>
              <strong className="text-xs font-mono text-rose-900">{failedCount}</strong>
            </div>

            <div className="p-1.5 bg-white">
              <span className="text-amber-800 block text-[8px]">{isFa ? '⚠ هشدار / نامرتبط' : '⚠ Warning/NA'}</span>
              <strong className="text-xs font-mono text-amber-900">{warningCount + naCount}</strong>
            </div>

            <div className={`p-1.5 ${scorePercent >= 80 ? 'bg-emerald-100/90 text-emerald-950' : 'bg-rose-100/90 text-rose-950'}`}>
              <span className="block text-[8px] font-black">{isFa ? 'درصد انطباق نهایی' : 'Compliance Rate'}</span>
              <strong className="text-sm font-black font-mono">{scorePercent}٪</strong>
              <div className="text-[7.5px] font-bold">
                {scorePercent >= 85 ? (isFa ? 'مطلوب و مورد تایید' : 'Fully Compliant') : (isFa ? 'مشروط / نیازمند اصلاح' : 'Action Required')}
              </div>
            </div>

          </div>
        </div>

        {/* ── 5. MAIN CHECKLIST ITEMS TABLE (جدول اصلی بندهای کنترلی - DYNAMIC) ── */}
        <div className="mb-3">
          <div className="text-[10px] font-black text-black mb-1 flex items-center justify-between">
            <span>{isFa ? 'ج) جدول ارزیابی تفصیلی بندهای کنترلی و شواهد عدم انطباق (Audit Checklist Details):' : 'C) Detailed Audit Checklist Items & Compliance Criteria:'}</span>
            <span className="text-[8.5px] font-normal text-slate-600">
              {isFa ? `تعداد کل ردیف‌ها: ${insp.items?.length || 0} بند` : `Total: ${insp.items?.length || 0} items`}
            </span>
          </div>

          <table className="w-full text-right border-collapse border-2 border-black text-[8.5px]">
            <thead>
              <tr className="bg-slate-200 text-black border-b-2 border-black font-black">
                <th className="border border-black p-1.5 w-7 text-center">#</th>
                <th className="border border-black p-1.5 w-[38%]">{isFa ? 'شرح بند کنترلی و الزام ایمنی' : 'Checklist Item & Requirement'}</th>
                <th className="border border-black p-1.5 w-[14%] text-center">{isFa ? 'مرجع / استاندارد' : 'Standard Ref'}</th>
                <th className="border border-black p-1.5 w-16 text-center">{isFa ? 'وضعیت' : 'Verdict'}</th>
                <th className="border border-black p-1.5">{isFa ? 'شرح مشاهدات، نواقص و اقدامات اصلاحی لازم' : 'Findings, Defects & Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black bg-white">
              {insp.items && insp.items.length > 0 ? (
                insp.items.map((it: SafetyChecklistInspectionItem, idx: number) => {
                  const isFail = it.verdict === 'fail';
                  const isWarn = it.verdict === 'warning';
                  const isPass = it.verdict === 'pass';
                  const isNa = it.verdict === 'na';

                  return (
                    <tr 
                      key={it.itemId || idx} 
                      className={`border-b border-black ${
                        isFail ? 'bg-rose-50/70 font-semibold' : isWarn ? 'bg-amber-50/70' : (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                      }`}
                    >
                      <td className="border border-black p-1 text-center font-mono font-bold text-slate-800">
                        {idx + 1}
                      </td>

                      <td className="border border-black p-1.5">
                        <div className="font-bold text-black text-[9px] leading-snug">{it.title}</div>
                        {it.category && (
                          <div className="text-[7.5px] text-slate-600 mt-0.5">
                            {isFa ? 'دسته‌بندی:' : 'Cat:'} <strong>{it.category}</strong>
                          </div>
                        )}
                      </td>

                      <td className="border border-black p-1 text-center font-mono text-[8px] text-slate-700">
                        {it.standardRef || (isFa ? 'استاندارد HSE' : 'HSE Std')}
                      </td>

                      <td className="border border-black p-1 text-center font-black">
                        {isPass && (
                          <div className="inline-flex items-center justify-center gap-1 text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-700 text-[8px]">
                            <span>✓</span>
                            <span>{isFa ? 'تایید' : 'PASS'}</span>
                          </div>
                        )}
                        {isFail && (
                          <div className="inline-flex items-center justify-center gap-1 text-rose-900 bg-rose-200/90 px-1.5 py-0.5 rounded border border-rose-800 text-[8px] font-black">
                            <span>✗</span>
                            <span>{isFa ? 'نقص' : 'FAIL'}</span>
                          </div>
                        )}
                        {isWarn && (
                          <div className="inline-flex items-center justify-center gap-1 text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded border border-amber-800 text-[8px]">
                            <span>⚠</span>
                            <span>{isFa ? 'هشدار' : 'WARN'}</span>
                          </div>
                        )}
                        {isNa && (
                          <div className="text-slate-500 font-mono text-[8px]">
                            {isFa ? 'نامرتبط' : 'N/A'}
                          </div>
                        )}
                      </td>

                      <td className="border border-black p-1.5 leading-tight">
                        {it.comment ? (
                          <div className="text-slate-900 text-[8.5px]">
                            <span className="font-bold text-black">{isFa ? 'یافته:' : 'Finding:'} </span>
                            {it.comment}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[8px]">-</span>
                        )}

                        {it.correctiveActionRequired && (
                          <div className="text-rose-800 font-bold text-[7.5px] mt-0.5 flex items-center gap-1">
                            <span>●</span>
                            <span>{isFa ? 'اقدام اصلاحی و رفع نقص الزامی است.' : 'Corrective Action Required'}</span>
                          </div>
                        )}

                        {it.photos && it.photos.length > 0 && (
                          <div className="mt-1 text-[7.5px] text-blue-700 font-bold flex items-center gap-1">
                            <Camera className="w-2.5 h-2.5" />
                            <span>{it.photos.length} {isFa ? 'تصویر مستند پیوست شد' : 'photo(s) attached'}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-500">
                    {isFa ? 'هیچ بندی برای این چک‌لیست ثبت نشده است.' : 'No items recorded.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 6. ATTACHED PHOTO EVIDENCE & AUDIT DOCUMENTATION (مستندات تصویری) ── */}
        {totalPhotosCount > 0 && (
          <div className="page-break-avoid border border-black rounded-md overflow-hidden mb-3 text-[9px] bg-white">
            <div className="bg-slate-200 text-black px-2.5 py-1 font-black border-b border-black flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>{isFa ? 'د) مستندات و شواهد تصویری پیوست‌شده به چک‌لیست (Photo Evidence):' : 'D) Photo Evidence & Audit Attachments:'}</span>
              </div>
              <span className="text-[8px] font-mono text-slate-700 font-bold">
                {totalPhotosCount} {isFa ? 'مورد تصویر پیوست' : 'Photos'}
              </span>
            </div>

            <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/50">
              {/* General Photos */}
              {allGeneralPhotos.map((photo, pIdx) => (
                <div key={photo.id || pIdx} className="border border-black rounded overflow-hidden bg-white p-1 flex flex-col justify-between">
                  <div className="h-24 w-full bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                    <img 
                      src={photo.url} 
                      alt={photo.caption || 'Photo'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pt-1 text-[7.5px]">
                    <div className="font-bold text-black truncate">{photo.caption || (isFa ? `تصویر بازرسی ${pIdx + 1}` : `Photo ${pIdx + 1}`)}</div>
                    <div className="text-slate-500 font-mono flex items-center justify-between text-[7px] mt-0.5">
                      <span>{photo.uploadedAt || insp.inspectionDate}</span>
                      <span>{photo.uploadedBy || insp.inspectorName}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Item Defect Photos */}
              {allItemPhotos.map((itemPhoto, ipIdx) => (
                <div key={itemPhoto.id || ipIdx} className="border border-black rounded overflow-hidden bg-white p-1 flex flex-col justify-between">
                  <div className="h-24 w-full bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                    <img 
                      src={itemPhoto.url} 
                      alt={itemPhoto.caption || itemPhoto.itemTitle} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pt-1 text-[7.5px]">
                    <span className={`text-[6.5px] font-black px-1 py-0.2 rounded inline-block truncate max-w-full ${itemPhoto.verdict === 'fail' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {itemPhoto.itemTitle}
                    </span>
                    <div className="font-bold text-black truncate text-[7.5px] mt-0.5">{itemPhoto.caption || (isFa ? 'شاهد نقص بند' : 'Defect photo')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. FINDINGS, IMMEDIATE ACTIONS & CAPA (مشاهدات، اقدامات فوری و اصلاحی) ── */}
        <div className="page-break-avoid border border-black rounded-md overflow-hidden mb-3 text-[9px] bg-white">
          <div className="bg-slate-200 text-black px-2.5 py-1 font-black border-b border-black">
            <span>{isFa ? 'هـ) جمع‌بندی مشاهدات، اقدامات فوری و اقدامات اصلاحی پیشنهادی (CAPA):' : 'E) Summary Findings, Immediate Actions & Recommended CAPA:'}</span>
          </div>

          <div className="p-2 space-y-1.5 divide-y divide-slate-300 text-[8.5px]">
            <div className="pb-1">
              <span className="font-bold text-black block">{isFa ? '۱. خلاصه مشاهدات و ارزیابی ریسک میدانی:' : '1. Summary Findings & Risk Assessment:'}</span>
              <p className="text-slate-800 mt-0.5 leading-relaxed">
                {insp.findingsSummary || (isFa ? 'مورد خاصی خارج از بندهای چک‌لیست گزارش نشده و شرایط عملیاتی مطابق استانداردهای ایمنی مورد بررسی قرار گرفت.' : 'No abnormal conditions beyond checklist items reported.')}
              </p>
            </div>

            <div className="pt-1.5 pb-1">
              <span className="font-bold text-black block">{isFa ? '۲. اقدامات فوری و کنترلی انجام‌شده در محل:' : '2. Immediate Actions Taken on Site:'}</span>
              <p className="text-slate-800 mt-0.5 leading-relaxed">
                {insp.immediateActionsTaken || (isFa ? 'تذکرات شفاهی ایمنی به مجری ابلاغ گردید و نواقص جزئی در حضور کارشناس ایمنی برطرف شد.' : 'Verbal safety instructions issued.')}
              </p>
            </div>

            <div className="pt-1.5">
              <span className="font-bold text-black block">{isFa ? '۳. اقدامات اصلاحی و پیشگیرانه پیشنهادی (CAPA):' : '3. Recommended Corrective & Preventive Actions (CAPA):'}</span>
              <p className="text-slate-800 mt-0.5 leading-relaxed font-semibold">
                {insp.recommendedCapa || (isFa ? 'پایش مداوم در دوره‌های بعدی بازرسی، الزام رعایت کامل PPE و صدور مجدد تگ ایمنی پس از تایید نهایی.' : 'Continuous monitoring during next cycles.')}
              </p>
            </div>
          </div>
        </div>

        {/* ── 8. FORMAL APPROVALS & SIGNATURES (تأیید و امضاهای ۳ سطحی رسمی سازمانی) ── */}
        <div className="page-break-avoid border-2 border-black rounded-lg overflow-hidden bg-white mb-2">
          <div className="bg-slate-200 text-black px-2.5 py-1 font-black border-b border-black text-[9.5px]">
            <span>{isFa ? 'و) تاییدات، اصالت سند و امضاهای مجاز سازمانی (۳ جایگاه یکپارچه)' : 'F) Verification & Authorized Signatures (3-Tier Standard)'}</span>
          </div>

          <div className="grid grid-cols-3 divide-x-2 divide-x-reverse divide-black text-[8px]">
            
            {/* 1. کارشناس / نماینده واحد */}
            <div className="p-2.5 flex flex-col justify-between min-h-[105px] bg-slate-50/40">
              <div>
                <div className="font-black text-black text-[9.5px]">{isFa ? '۱. کارشناس / نماینده واحد:' : '1. Unit Expert / Inspector:'}</div>
                <div className="text-slate-700 mt-1 truncate">
                  <span>{isFa ? 'نام:' : 'Name:'}</span> <strong className="text-black text-[9px]">{insp.inspectorName || '-'}</strong>
                </div>
                <div className="text-slate-700">
                  <span>{isFa ? 'کد پرسنلی:' : 'Code:'}</span> <strong className="font-mono">{insp.inspectorCode || '-'}</strong>
                </div>
                <div className="text-slate-700 truncate">
                  <span>{isFa ? 'زمان امضا:' : 'Time:'}</span> <strong className="font-mono">{insp.inspectionDate} {insp.inspectionTime || '۱۰:۰۰'}</strong>
                </div>
              </div>

              <div className="mt-3 pt-1 border-t border-slate-400 flex items-center justify-between text-[7px] text-slate-500 font-bold">
                <span>{isFa ? 'محل امضا و اثر دیجیتال' : 'Signature Seal'}</span>
                <span className="font-mono text-emerald-800">VERIFIED</span>
              </div>
            </div>

            {/* 2. سرپرست / مسئول واحد */}
            <div className="p-2.5 flex flex-col justify-between min-h-[105px] bg-slate-50/40">
              <div>
                <div className="font-black text-black text-[9.5px]">{isFa ? '۲. سرپرست / مسئول واحد:' : '2. Unit Supervisor / Lead:'}</div>
                <div className="text-slate-700 mt-1 truncate">
                  <span>{isFa ? 'نام و سمت:' : 'Name:'}</span> <strong className="text-black text-[9px]">{insp.supervisorName || '—'}</strong>
                </div>
                <div className="text-slate-700">
                  <span>{isFa ? 'کد پرسنلی:' : 'Code:'}</span> <strong className="font-mono">{insp.supervisorCode || '-'}</strong>
                </div>
                <div className="text-slate-700 truncate">
                  <span>{isFa ? 'تاریخ تایید:' : 'Date:'}</span> <strong className="font-mono">{insp.inspectionDate}</strong>
                </div>
              </div>

              <div className="mt-3 pt-1 border-t border-slate-400 flex items-center justify-between text-[7px] text-slate-500 font-bold">
                <span>{isFa ? 'تایید سرپرستی و هماهنگی' : 'Supervisor Sign'}</span>
                <span className="font-mono text-amber-800">CHECKED</span>
              </div>
            </div>

            {/* 3. رئیس مرکز HSE */}
            <div className="p-2.5 flex flex-col justify-between min-h-[105px] bg-slate-50/40">
              <div>
                <div className="font-black text-black text-[9.5px]">{isFa ? '۳. رئیس مرکز HSE:' : '3. Head of HSE Center:'}</div>
                <div className="text-slate-700 mt-1 truncate">
                  <span>{isFa ? 'نام و سمت:' : 'Name:'}</span> <strong className="text-black text-[9px]">{insp.hseManagerName || '—'}</strong>
                </div>
                <div className="text-slate-700">
                  <span>{isFa ? 'کد پرسنلی:' : 'Code:'}</span> <strong className="font-mono">{insp.hseManagerCode || '-'}</strong>
                </div>
                <div className="text-slate-700 truncate">
                  <span>{isFa ? 'تصویب:' : 'Verdict:'}</span> <strong className="text-emerald-900 font-bold">{insp.status === 'COMPLETED' ? (isFa ? 'تایید نهایی' : 'Approved') : (isFa ? 'مشروط' : 'Conditional')}</strong>
                </div>
              </div>

              <div className="mt-3 pt-1 border-t border-slate-400 flex items-center justify-between text-[7px] text-slate-500 font-bold">
                <span>{isFa ? 'محل امضا، مهر و تایید نهایی' : 'Final Seal'}</span>
                <span className="font-mono text-blue-900">APPROVED</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── 9. OFFICIAL FOOTER (پاورقی رسمی استاندارد HSE) ── */}
        <div className="flex items-center justify-between text-[7.5px] text-slate-600 border-t border-slate-400 pt-1 font-mono">
          <div>
            <span>SYSTEM AUDIT ID: </span>
            <strong className="text-black">{insp.id}</strong>
          </div>
          <div className="text-center font-sans font-bold">
            {isFa ? 'این سند رسمی بوده و هرگونه امحاء یا دستکاری غیرمجاز آن پیگرد قانونی دارد - سامانه مدیریت جامع HSE' : 'Confidential HSE Audit Report - Unauthorized Copying Prohibited'}
          </div>
          <div>
            <span>GENERATED: </span>
            <span>{insp.inspectionDate}</span>
          </div>
        </div>

      </div>

    </div>
  );
}

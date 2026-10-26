import React, { useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  Flame, 
  ShieldCheck, 
  AlertTriangle, 
  HardHat, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  FileText, 
  Info,
  Check,
  Ban,
  Activity,
  Layers,
  Palette,
  CheckCircle2,
  AlertOctagon,
  FileSpreadsheet,
  FileCheck
} from 'lucide-react';
import { PtwAuditRecord } from '../types';
import { HseLogo } from '../../../components/HseLogo';
import { calculateAuditMetrics } from '../services/ptwAuditService';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import { printService } from '../../../services/printService';
import { PrintDocumentSignaturesBox } from '../../../components/referral/PrintDocumentSignaturesBox';

interface PtwAuditPrintViewProps {
  audit: PtwAuditRecord;
  onClose: () => void;
  isFa?: boolean;
}

export default function PtwAuditPrintView({
  audit,
  onClose,
  isFa = true
}: PtwAuditPrintViewProps) {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const { branding } = useSystemBranding();
  
  // Interactive UI state for preview mode
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [colorTheme, setColorTheme] = useState<'mono' | 'color'>('mono');
  const [showPdfHint, setShowPdfHint] = useState<boolean>(false);

  const handlePrint = () => {
    if (printContainerRef.current) {
      printService.printElement(printContainerRef.current, {
        title: `فرم رسمی ممیزی اجرای سیستم پروانه کار (PTW Audit) - ${audit.documentCode || audit.permitNumber || audit.id || ''}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: audit.documentCode || 'HSE-FO-PTW-AUDIT-01',
        documentDate: audit.auditDate,
        isFa: isFa,
        autoPrint: true
      });
    }
  };

  const p = audit;

  // Calculate comprehensive statistics including 30 inspection items + missed (NC) hazards, PPE, and precautions
  const metrics = calculateAuditMetrics(
    p.inspectionItems || [],
    p.environmentalHazards || [],
    p.requiredPpe || [],
    p.precautionsTaken || []
  );

  const totalItems = p.inspectionItems?.length || 30;
  const passItems = metrics.passedCount;
  const questionDefects = metrics.questionDefectsCount;
  const missedNcItems = metrics.totalMissedNcCount;
  const totalDefects = metrics.defectsCount;
  const naItems = metrics.naCount;
  const complianceRate = metrics.complianceScore;

  // Render Persian-only clean status (No P or O characters displayed)
  const renderStatusCell = (status: string) => {
    if (status === 'P' || status === 'PASS') {
      return (
        <div className="flex items-center justify-center gap-1 font-bold">
          <span className={`status-badge-pass inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-black leading-none ${
            colorTheme === 'color' 
              ? 'bg-emerald-600 text-white border border-emerald-700' 
              : 'bg-black text-white border border-black'
          }`}>
            ✓
          </span>
          <span className={`status-text-pass text-[8px] font-black ${
            colorTheme === 'color' ? 'text-emerald-800' : 'text-black'
          }`}>
            مطلوب
          </span>
        </div>
      );
    }
    if (status === 'O' || status === 'DEFECT') {
      return (
        <div className="flex items-center justify-center gap-1 font-black">
          <span className={`status-badge-defect inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-black leading-none ${
            colorTheme === 'color' 
              ? 'bg-rose-600 text-white border border-rose-700' 
              : 'bg-black text-white border border-black ring-1 ring-black'
          }`}>
            ✗
          </span>
          <span className={`status-text-defect text-[8px] font-black ${
            colorTheme === 'color' ? 'text-rose-700' : 'text-black font-extrabold underline'
          }`}>
            نامطلوب
          </span>
        </div>
      );
    }
    if (status === '-' || status === 'NA') {
      return (
        <div className="flex items-center justify-center gap-1 font-bold text-gray-500">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 border border-gray-400 rounded text-[9px] font-bold text-gray-700 bg-gray-100">
            –
          </span>
          <span className="text-[7.5px] text-gray-600 font-medium">نامرتبط</span>
        </div>
      );
    }
    return <span className="text-gray-400 font-mono text-[8px]">–</span>;
  };

  const getAttachedPermitLabel = () => {
    if (!p.hasAttachedPermit && (!p.attachedPermitType || p.attachedPermitType === 'NONE') && p.permitType !== 'CONFINED_SPACE') {
      return null;
    }
    const type = p.attachedPermitType || (p.permitType === 'CONFINED_SPACE' ? 'ConfinedSpace' : 'NONE');
    switch (type) {
      case 'ConfinedSpace':
        return 'ورود به فضای بسته (Confined Space)';
      case 'Excavation':
        return 'حفاری و خاکبرداری (Excavation)';
      case 'ProcessMechanical':
        return 'جداسازی و ایزولاسیون مکانیکی/فرآیندی';
      case 'ElectricalIsolation':
        return 'ایزولاسیون الکتریکی و قفل LOTO';
      case 'Radiation':
        return 'پرتونگاری و منابع رادیواکتیو (NDT)';
      case 'VehicleCrane':
        return 'ورود جرثقیل و ماشین‌آلات سنگین';
      case 'WorkingAtHeight':
        return 'کار در ارتفاع و داربست‌بندی';
      case 'Other':
        return p.attachedPermitTitleCustom || 'پروانه کار الحاقی و تکمیلی';
      default:
        return 'پروانه کار الحاقی';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/90 backdrop-blur-md flex flex-col items-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
      
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Interactive Control Toolbar (Screen Only - Hidden in Print) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-2 z-50 w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 bg-slate-900/95 text-white backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 print:hidden mb-4 animate-in fade-in slide-in-from-top-2">
        
        {/* Left Actions */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
            title="چاپ استاندارد فرم روی کاغذ A4 یا تولید خروجی PDF"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ رسمی فرم A4</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer border border-slate-700"
            title="راهنمای ذخیره فایل PDF بدون حاشیه اضافی"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>ذخیره PDF</span>
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
              <span>تک‌رنگ رسمی (سیاه و سفید بایگانی)</span>
            </button>
            <button
              type="button"
              onClick={() => setColorTheme('color')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                colorTheme === 'color'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-amber-500" />
              <span>چندرنگ سازمانی (پویا و رنگی)</span>
            </button>
          </div>

        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          
          {/* Zoom Controls */}
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
            <span>بستن</span>
          </button>

        </div>

      </div>

      {/* PDF Guidance Toast */}
      {showPdfHint && (
        <div className="sticky top-18 z-50 max-w-xl bg-slate-850 text-slate-200 border border-amber-500/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md mb-3 flex items-start gap-3 text-xs print:hidden animate-in fade-in">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-black text-amber-300 mb-0.5">راهنمای چاپ در قطع A4 و ذخیره PDF:</div>
            <div className="leading-relaxed">
              در پنجره باز شده چاپ مرورگر، مقصد را روی <strong>«Save as PDF»</strong> قرار داده، اندازه کاغذ را <strong>A4</strong>، جهت را <strong>Portrait (عمودی)</strong> و حاشیه (Margins) را روی <strong>«None / حداقل»</strong> تنظیم فرمایید.
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
            margin: 4mm 6mm 4mm 6mm;
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
          .print-hidden, .print-hidden-element, nav, aside, header, footer, button {
            display: none !important;
          }
          .a4-print-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            transform: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          table {
            page-break-inside: auto;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }

        /* Mono Theme Specifics */
        .theme-mono {
          --theme-border: #000000;
          --theme-header-bg: #f3f4f6;
          --theme-sub-bg: #f9fafb;
          --theme-accent: #000000;
          --theme-text-dark: #000000;
          --theme-text-muted: #374151;
        }

        /* Color Theme Specifics */
        .theme-color {
          --theme-border: #1e3a8a;
          --theme-header-bg: #eff6ff;
          --theme-sub-bg: #f8fafc;
          --theme-accent: #b45309;
          --theme-text-dark: #0f172a;
          --theme-text-muted: #475569;
        }
      `}</style>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Official A4 Sheet Canvas */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        className="transition-transform duration-200 origin-top flex justify-center w-full"
        style={{ transform: `scale(${zoomLevel / 100})` }}
      >
        <div
          ref={printContainerRef}
          dir="rtl"
          className={`a4-print-sheet w-full max-w-[210mm] bg-white text-black text-[8px] leading-tight font-sans p-2 sm:p-3 my-2 shadow-2xl print:shadow-none border-2 border-black selection:bg-none print:m-0 print:border-2 ${
            colorTheme === 'mono' ? 'theme-mono border-black' : 'theme-color border-blue-900'
          }`}
        >

          {/* ========================================================================= */}
          {/* 1. Official Corporate Header (سربرگ رسمی شرکتی و مشخصات سند) */}
          {/* ========================================================================= */}
          <div className={`border-2 p-1.5 mb-1 bg-white ${
            colorTheme === 'color' ? 'border-blue-900 shadow-xs' : 'border-black'
          }`}>
            
            <div className="flex items-center justify-between gap-2">
              
              {/* Logo / Company Emblem (Right - Logo Only) */}
              <div className="w-[20%] flex items-center justify-start">
                <div className={`border px-2 py-1 text-center bg-white flex items-center justify-center w-full rounded-xs h-14 ${
                  colorTheme === 'color' ? 'border-blue-900 bg-blue-50/50' : 'border-black'
                }`}>
                  <div className="h-full w-full flex items-center justify-center p-0.5 overflow-hidden">
                    {branding.logoUrl ? (
                      <img 
                        src={branding.logoUrl} 
                        alt="Logo" 
                        className="max-h-full max-w-full object-contain select-none"
                      />
                    ) : (
                      <HseLogo size="md" target="header" showShadow={false} />
                    )}
                  </div>
                </div>
              </div>

              {/* Central Title (Center) */}
              <div className="w-[49%] text-center">
                <div className={`text-[7.5px] font-black ${colorTheme === 'color' ? 'text-blue-900' : 'text-gray-800'}`}>
                  {branding.organizationNameFa || 'مدیریت بهداشت، ایمنی و محیط زیست (HSE)'}
                </div>
                <h1 className={`font-black text-[13.5px] tracking-tight leading-snug my-0.5 ${
                  colorTheme === 'color' ? 'text-blue-950' : 'text-black'
                }`}>
                  فرم ممیزی اجرای سیستم پروانه کار
                </h1>
                <h2 className={`font-black text-[10px] tracking-wider uppercase font-mono ${
                  colorTheme === 'color' ? 'text-amber-700' : 'text-black'
                }`}>
                  PTW System Audit & Compliance Form
                </h2>
              </div>

              {/* Document Quality Metadata Box (Left) */}
              <div className={`w-[28%] text-[7.5px] font-bold border p-1 space-y-0.5 rounded-xs ${
                colorTheme === 'color' ? 'border-blue-900 bg-blue-50/60' : 'border-black bg-gray-50/70 print:bg-white'
              }`}>
                <div className={`flex justify-between items-center border-b pb-0.5 ${colorTheme === 'color' ? 'border-blue-200' : 'border-black/40'}`}>
                  <span>کد سند:</span>
                  <span className="font-mono font-black">{p.documentCode || 'REG-HSE-FO-024'}</span>
                  <span className="mr-1">ویرایش:</span>
                  <span className="font-mono font-black">{p.revisionNumber || '00'}</span>
                </div>
                <div className={`flex justify-between items-center border-b pb-0.5 ${colorTheme === 'color' ? 'border-blue-200' : 'border-black/40'}`}>
                  <span>تاریخ:</span>
                  <span className="font-mono font-black">{p.auditDate}</span>
                  <span className="mr-1">ساعت:</span>
                  <span className="font-mono font-black">{p.auditTime || '00:00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>واحد:</span>
                  <span className="font-black truncate max-w-[90px]">{p.unitName} {p.subUnitName ? `(${p.subUnitName})` : ''}</span>
                  <span className="mr-1">شیفت:</span>
                  <span className="truncate">{p.shift}</span>
                </div>
              </div>

            </div>

            {/* ────────────────────────────────────────────────────────────────────────── */}
            {/* Permit Type & Attached Permit Specifications & Numbers */}
            {/* ────────────────────────────────────────────────────────────────────────── */}
            <div className={`mt-1.5 pt-1.5 border-t flex flex-wrap items-center justify-between text-[8px] font-bold px-1.5 gap-y-1 ${
              colorTheme === 'color' ? 'border-blue-900 bg-slate-50' : 'border-black bg-gray-50/50 print:bg-white'
            }`}>
              
              {/* Primary Permit Type */}
              <div className="flex items-center gap-2.5">
                <span className="font-black text-black">۱. نوع پروانه اصلی :</span>
                
                <div className="flex items-center gap-1">
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black ${
                    p.permitType === 'HOT' 
                      ? (colorTheme === 'color' ? 'bg-red-600 border-red-700 text-white' : 'bg-black border-black text-white') 
                      : 'bg-white border-black text-transparent'
                  }`}>
                    {p.permitType === 'HOT' ? '✓' : ''}
                  </span>
                  <span className={`font-black ${p.permitType === 'HOT' && colorTheme === 'color' ? 'text-red-700 font-extrabold' : ''}`}>
                    گرم (Hot Work)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black ${
                    p.permitType === 'COLD' || p.permitType === 'CONFINED_SPACE' 
                      ? (colorTheme === 'color' ? 'bg-blue-600 border-blue-700 text-white' : 'bg-black border-black text-white') 
                      : 'bg-white border-black text-transparent'
                  }`}>
                    {p.permitType === 'COLD' || p.permitType === 'CONFINED_SPACE' ? '✓' : ''}
                  </span>
                  <span className={`font-black ${(p.permitType === 'COLD' || p.permitType === 'CONFINED_SPACE') && colorTheme === 'color' ? 'text-blue-800 font-extrabold' : ''}`}>
                    سرد (Cold Work)
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono mr-1">
                  <span className="font-sans font-black text-[8px]">شماره پروانه اصلی:</span>
                  <span className={`px-2 py-0.5 border bg-white font-black text-[9px] tracking-wide rounded-xs ${
                    colorTheme === 'color' ? 'border-blue-900 text-blue-950 font-mono' : 'border-black'
                  }`}>
                    {p.permitNumber}
                  </span>
                </div>
              </div>

              {/* Supplementary / Attached Permit Details */}
              <div className={`flex items-center gap-1.5 border-r pr-2.5 ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>
                <span className="font-black text-black">۲. پروانه الحاقی :</span>
                {getAttachedPermitLabel() ? (
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[7.5px] font-black ${
                      colorTheme === 'color' ? 'bg-indigo-900 text-white' : 'bg-black text-white'
                    }`}>
                      {getAttachedPermitLabel()}
                    </span>
                    <span className="font-sans font-black text-[8px]">شماره:</span>
                    <span className={`px-1.5 py-0.5 border font-mono font-black text-[8.5px] bg-white rounded-xs ${
                      colorTheme === 'color' ? 'border-blue-900 text-blue-950' : 'border-black'
                    }`}>
                      {p.attachedPermitNumber || (p.permitType === 'CONFINED_SPACE' ? p.permitNumber : 'ثبت نشده')}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-600 font-normal">فاقد پروانه الحاقی (منفرد)</span>
                )}
              </div>

            </div>

            {/* ────────────────────────────────────────────────────────────────────────── */}
            {/* 4 Primary Signers Row */}
            {/* ────────────────────────────────────────────────────────────────────────── */}
            <div className={`mt-1 pt-1 border-t grid grid-cols-4 gap-1.5 text-[8px] px-1 bg-white ${
              colorTheme === 'color' ? 'border-blue-200' : 'border-black'
            }`}>
              <div className={`border-l pl-1 ${colorTheme === 'color' ? 'border-blue-200' : 'border-black/30'}`}>
                <span className="font-black text-gray-700">امضاء مسئول محوطه: </span>
                <span className="font-bold text-black">{p.signers?.areaResponsibleName || '................................'}</span>
              </div>
              <div className={`border-l pl-1 ${colorTheme === 'color' ? 'border-blue-200' : 'border-black/30'}`}>
                <span className="font-black text-gray-700">امضاء کشیک ارشد: </span>
                <span className="font-bold text-black">{p.signers?.seniorShiftSupervisorName || '................................'}</span>
              </div>
              <div className={`border-l pl-1 ${colorTheme === 'color' ? 'border-blue-200' : 'border-black/30'}`}>
                <span className="font-black text-gray-700">امضاء مجری کار: </span>
                <span className="font-bold text-black">{p.signers?.workPerformerName || '................................'}</span>
              </div>
              <div className={`px-1.5 py-0.5 border rounded-xs ${
                colorTheme === 'color' ? 'border-amber-500 bg-amber-50/80 text-slate-900' : 'border-black/60 bg-gray-100/70 print:bg-white'
              }`}>
                <span className="font-black">امضاء ایمنی در پرمیت: </span>
                <span className="font-black">{p.signers?.safetyUnitSignerName || '................................'}</span>
              </div>
            </div>

            {/* Work Description Row */}
            <div className={`mt-1 pt-1 border-t text-[8px] px-1 flex items-start gap-1 ${
              colorTheme === 'color' ? 'border-blue-200' : 'border-black'
            }`}>
              <span className="font-black shrink-0 text-black">شرح و دامنه کار :</span>
              <span className="font-normal text-gray-800 leading-tight">
                {p.workDescription || '..................................................................................................................................................................................................................................................'}
              </span>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* 2. Main Body Split: Right Side (30 Items Table) + Left Side (Sidebar Panels) */}
          {/* ========================================================================= */}
          <div className="flex gap-1.5 items-start">

            {/* ──────────────────────────────────────────────────────────────────────── */}
            {/* Right Side: 30-Item Inspection Table (68% Width) */}
            {/* ──────────────────────────────────────────────────────────────────────── */}
            <div className={`w-[68%] border-2 bg-white rounded-xs ${
              colorTheme === 'color' ? 'border-blue-900' : 'border-black'
            }`}>
              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className={`border-b-2 text-center font-black ${
                    colorTheme === 'color' 
                      ? 'border-blue-900 bg-blue-100/90 text-blue-950' 
                      : 'border-black bg-gray-100 print:bg-gray-100 text-black'
                  }`}>
                    <th className={`border-l py-1 px-0.5 w-[6%] ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>ردیف</th>
                    <th className={`border-l py-1 px-1.5 w-[55%] text-right ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>
                      مفاد بندهای بازرسی و الزامات سیستم پروانه کار
                    </th>
                    <th className={`border-l py-1 px-0.5 w-[16%] ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>
                      وضعیت انطباق
                    </th>
                    <th className="py-1 px-1.5 w-[23%] text-right">مشاهدات عینی و توضیحات</th>
                  </tr>
                </thead>
                <tbody>
                  {p.inspectionItems.map((item, idx) => {
                    const isDefect = item.status === 'O' || item.status === 'DEFECT';
                    return (
                      <tr 
                        key={item.id} 
                        className={`border-b leading-tight ${
                          colorTheme === 'color'
                            ? (isDefect 
                                ? 'bg-rose-50/70 font-bold border-rose-200' 
                                : (idx % 2 === 1 ? 'bg-slate-50/60 border-slate-200' : 'bg-white border-slate-200'))
                            : (isDefect 
                                ? 'bg-gray-200/80 font-bold border-black' 
                                : (idx % 2 === 1 ? 'bg-gray-50/60 border-black/40' : 'bg-white border-black/40'))
                        }`}
                      >
                        <td className={`border-l py-0.5 px-0.5 text-center font-mono font-bold ${
                          colorTheme === 'color' ? 'border-blue-900 text-slate-800' : 'border-black text-black'
                        }`}>
                          {item.questionNumber}
                        </td>
                        <td className={`border-l py-0.5 px-1.5 text-right text-[7.5px] leading-tight ${
                          colorTheme === 'color' ? 'border-blue-900' : 'border-black'
                        } ${isDefect ? 'text-black font-black' : 'text-gray-900 font-medium'}`}>
                          {item.questionFa}
                        </td>
                        <td className={`border-l py-0.5 px-0.5 text-center text-[7.5px] ${
                          colorTheme === 'color' ? 'border-blue-900' : 'border-black'
                        }`}>
                          {renderStatusCell(item.status)}
                        </td>
                        <td className="py-0.5 px-1.5 text-right text-[7px] text-black truncate max-w-[120px]">
                          {item.remarks || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ──────────────────────────────────────────────────────────────────────── */}
            {/* Left Side Panel: Legend, Hazards, PPE, Precautions (32% Width) */}
            {/* ──────────────────────────────────────────────────────────────────────── */}
            <div className={`w-[32%] shrink-0 border-2 text-[7px] p-1 space-y-1 bg-white rounded-xs ${
              colorTheme === 'color' ? 'border-blue-900' : 'border-black'
            }`}>
              
              {/* Assessment Legend (Without P / O) */}
              <div className={`border p-1 text-center rounded-xs ${
                colorTheme === 'color' ? 'border-blue-800 bg-blue-50/80' : 'border-black bg-gray-100 print:bg-gray-50'
              }`}>
                <div className={`font-black text-[8px] mb-0.5 ${colorTheme === 'color' ? 'text-blue-950' : 'text-black'}`}>
                  راهنمای وضعیت بازرسی ایمنی
                </div>
                <div className="grid grid-cols-3 gap-1 text-center font-black">
                  <div className={`border py-0.5 bg-white flex flex-col items-center justify-center rounded-xs ${
                    colorTheme === 'color' ? 'border-emerald-600 text-emerald-800' : 'border-black text-black'
                  }`}>
                    <span className="text-[8px]">✓ انطباق</span>
                    <span className="text-[7px] font-bold">مطلوب</span>
                  </div>
                  <div className={`border py-0.5 bg-white flex flex-col items-center justify-center rounded-xs ${
                    colorTheme === 'color' ? 'border-rose-600 text-rose-800' : 'border-black text-black font-extrabold'
                  }`}>
                    <span className="text-[8px]">✗ عدم انطباق</span>
                    <span className="text-[7px] font-bold">نامطلوب</span>
                  </div>
                  <div className={`border py-0.5 bg-white flex flex-col items-center justify-center rounded-xs text-gray-700 ${
                    colorTheme === 'color' ? 'border-gray-400' : 'border-black'
                  }`}>
                    <span className="text-[8px]">– عدم شمول</span>
                    <span className="text-[7px] font-bold">نامرتبط</span>
                  </div>
                </div>
              </div>

              {/* 1. شرایط خطرناک محیط (Environmental Hazards) */}
              <div className={`border p-1 rounded-xs ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>
                <div className={`font-black text-[8px] text-center border-b pb-0.5 mb-1 flex items-center justify-between px-1 ${
                  colorTheme === 'color' ? 'border-blue-800 bg-blue-100/70 text-blue-950' : 'border-black bg-gray-100 print:bg-gray-50 text-black'
                }`}>
                  <span>شرایط خطرناک محیط</span>
                  <span className="text-[6.5px] font-normal">
                    (✓ در پروانه | ⚠️ الزامیِ قیدنشده)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[6.5px]">
                  {p.environmentalHazards.map((haz) => {
                    const isSel = haz.selected;
                    const isMis = haz.missed;
                    return (
                      <div key={haz.id} className="flex items-center gap-1">
                        <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center text-[6.5px] font-black shrink-0 ${
                          isSel 
                            ? (colorTheme === 'color' ? 'bg-blue-700 border-blue-800 text-white' : 'bg-black border-black text-white') 
                            : isMis 
                            ? (colorTheme === 'color' ? 'bg-rose-600 border-rose-700 text-white font-extrabold' : 'bg-black border-black text-white ring-1 ring-black')
                            : 'bg-white border-black text-transparent'
                        }`}>
                          {isSel ? '✓' : isMis ? '⚠️' : ''}
                        </span>
                        <span className={`truncate ${
                          isMis 
                            ? 'font-black text-rose-800 underline' 
                            : isSel 
                            ? 'font-bold text-black' 
                            : 'text-gray-700'
                        } ${haz.isCustom ? 'italic' : ''}`}>
                          {haz.labelFa}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {p.environmentalHazards.some(h => h.missed) && (
                  <div className="mt-0.5 pt-0.5 border-t border-rose-300 text-[6.5px] text-rose-800 font-bold">
                    <span>⚠️ عدم انطباق خطر الزامی: </span>
                    <span>{p.environmentalHazards.filter(h => h.missed).map(h => h.labelFa).join('، ')}</span>
                  </div>
                )}
                {p.customOtherHazardsText && (
                  <div className="mt-0.5 pt-0.5 border-t border-gray-300 text-[6.5px]">
                    <span className="font-black">سایر خطرات: </span>
                    <span className="font-medium">{p.customOtherHazardsText}</span>
                  </div>
                )}
              </div>

              {/* 2. وسایل استحفاظی فردی مورد نیاز (Required PPE) */}
              <div className={`border p-1 rounded-xs ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>
                <div className={`font-black text-[8px] text-center border-b pb-0.5 mb-1 flex items-center justify-between px-1 ${
                  colorTheme === 'color' ? 'border-blue-800 bg-blue-100/70 text-blue-950' : 'border-black bg-gray-100 print:bg-gray-50 text-black'
                }`}>
                  <span>وسایل استحفاظی فردی (PPE)</span>
                  <span className="text-[6.5px] font-normal">
                    (✓ در پروانه | ⚠️ الزامیِ قیدنشده)
                  </span>
                </div>
                <div className="space-y-0.5 text-[6.5px]">
                  
                  {/* Helper for rendering PPE circle */}
                  {(() => {
                    const renderPpeDot = (id: string, label: string) => {
                      const item = p.requiredPpe.find(x => x.id === id);
                      const isSel = item?.selected;
                      const isMis = item?.missed;
                      return (
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full border flex items-center justify-center text-[5.5px] font-black shrink-0 ${
                            isSel 
                              ? (colorTheme === 'color' ? 'bg-blue-800 border-blue-900 text-white' : 'bg-black border-black text-white') 
                              : isMis 
                              ? (colorTheme === 'color' ? 'bg-rose-600 border-rose-700 text-white font-extrabold' : 'bg-black border-black text-white ring-1 ring-black')
                              : 'bg-white border-black text-transparent'
                          }`}>
                            {isSel ? '✓' : isMis ? '!' : ''}
                          </span>
                          <span className={`${
                            isMis 
                              ? 'font-black text-rose-800 underline' 
                              : isSel 
                              ? 'font-bold text-black' 
                              : 'text-gray-700'
                          }`}>
                            {label}
                          </span>
                        </div>
                      );
                    };

                    return (
                      <>
                        {/* Helmet & strap */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
                          {renderPpeDot('ppe_helmet', 'کلاه ایمنی')}
                          {renderPpeDot('ppe_helmet_strap', 'چانه بند کلاه')}
                        </div>

                        {/* Clothes */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
                          {renderPpeDot('ppe_work_clothes', 'لباس کار')}
                          {renderPpeDot('ppe_acid_suit', 'ضد اسید')}
                          {renderPpeDot('ppe_fire_suit', 'ضد حریق')}
                        </div>

                        {/* Shoes & Harness & Boots */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-0.5">
                          {renderPpeDot('ppe_safety_shoes', 'کفش ایمنی')}
                          {renderPpeDot('ppe_safety_harness', 'هارنس')}
                          {renderPpeDot('ppe_safety_boots', 'چکمه')}
                        </div>

                        {/* Masks */}
                        <div className="border-b border-gray-200 pb-0.5">
                          <div className="font-bold text-[6.5px]">ماسک تنفسی:</div>
                          <div className="grid grid-cols-2 gap-0.5 mt-0.5">
                            {renderPpeDot('ppe_dust_mask', 'ضدغبار')}
                            {renderPpeDot('ppe_half_mask', 'نیم صورت')}
                            {renderPpeDot('ppe_full_mask', 'تمام صورت')}
                            {renderPpeDot('ppe_ba_mask', 'دستگاه تنفسی BA')}
                          </div>
                        </div>

                        {/* Goggles */}
                        <div className="border-b border-gray-200 pb-0.5">
                          <div className="font-bold text-[6.5px]">عینک ایمنی:</div>
                          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                            {renderPpeDot('ppe_welding_goggles', 'جوشکاری')}
                            {renderPpeDot('ppe_grinding_goggles', 'سنگزنی')}
                            {renderPpeDot('ppe_uv_goggles', 'ضد UV')}
                          </div>
                        </div>

                        {/* Gloves */}
                        <div className="border-b border-gray-200 pb-0.5">
                          <div className="font-bold text-[6.5px]">دستکش کار:</div>
                          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                            {renderPpeDot('ppe_leather_gloves', 'چرمی')}
                            {renderPpeDot('ppe_fabric_gloves', 'پارچه‌ای')}
                            {renderPpeDot('ppe_pvc_gloves', 'PVC')}
                            {renderPpeDot('ppe_fireproof_gloves', 'نسوز')}
                            {renderPpeDot('ppe_acid_gloves', 'ضد اسید')}
                            {renderPpeDot('ppe_electrical_gloves', 'عایق برق')}
                          </div>
                        </div>

                        {/* Face Shield & Hearing */}
                        <div className="grid grid-cols-2 gap-1 border-b border-gray-200 pb-0.5">
                          <div>
                            <div className="font-bold text-[6.5px]">شیلد صورت:</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {renderPpeDot('ppe_grinding_shield', 'سنگزنی')}
                              {renderPpeDot('ppe_welding_shield', 'جوشکاری')}
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-[6.5px]">حفاظت گوش:</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {renderPpeDot('ppe_earplug', 'توگوشی')}
                              {renderPpeDot('ppe_earmuff', 'روگوشی')}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Custom Added PPE Items */}
                  {p.requiredPpe.filter(x => x.isCustom).length > 0 && (
                    <div className="pt-0.5 text-[6.5px]">
                      <div className="font-bold text-gray-800">سایر موارد PPE:</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.requiredPpe.filter(x => x.isCustom).map(customPpe => {
                          const isSel = customPpe.selected;
                          const isMis = customPpe.missed;
                          return (
                            <div key={customPpe.id} className="flex items-center gap-1 font-bold">
                              <span className={`w-2 h-2 rounded-full border flex items-center justify-center text-[5.5px] font-black ${
                                isSel 
                                  ? (colorTheme === 'color' ? 'bg-blue-800 border-blue-900 text-white' : 'bg-black border-black text-white') 
                                  : isMis 
                                  ? (colorTheme === 'color' ? 'bg-rose-600 border-rose-700 text-white' : 'bg-black border-black text-white')
                                  : 'bg-white border-black text-transparent'
                              }`}>
                                {isSel ? '✓' : isMis ? '!' : ''}
                              </span>
                              <span className={isMis ? 'text-rose-800 underline' : ''}>{customPpe.labelFa}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Highlight Missed PPEs (Non-compliance) */}
                  {p.requiredPpe.some(x => x.missed) && (
                    <div className="mt-0.5 pt-0.5 border-t border-rose-300 text-[6.5px] text-rose-800 font-bold">
                      <span>⚠️ عدم انطباق PPE الزامی: </span>
                      <span>{p.requiredPpe.filter(x => x.missed).map(x => x.labelFa).join('، ')}</span>
                    </div>
                  )}

                  {p.customOtherPpeText && (
                    <div className="pt-0.5 border-t border-gray-300 text-[6.5px]">
                      <span className="font-black">توضیحات PPE: </span>
                      <span>{p.customOtherPpeText}</span>
                    </div>
                  )}

                </div>
              </div>

              {/* 3. پیش بینی های در نظر گرفته شده (Precautions Taken) */}
              <div className={`border p-1 rounded-xs ${colorTheme === 'color' ? 'border-blue-900' : 'border-black'}`}>
                <div className={`font-black text-[8px] text-center border-b pb-0.5 mb-1 flex items-center justify-between px-1 ${
                  colorTheme === 'color' ? 'border-blue-800 bg-blue-100/70 text-blue-950' : 'border-black bg-gray-100 print:bg-gray-50 text-black'
                }`}>
                  <span>پیش بینی های در نظر گرفته شده</span>
                  <span className="text-[6.5px] font-normal">
                    (✓ در پروانه | ⚠️ الزامیِ قیدنشده)
                  </span>
                </div>
                <div className="space-y-0.5 text-[6.5px]">
                  {p.precautionsTaken.map((prec) => {
                    const isSel = prec.selected;
                    const isMis = prec.missed;
                    return (
                      <div key={prec.id} className="flex items-start gap-1">
                        <span className={`w-2 h-2 rounded-full border flex items-center justify-center text-[6px] font-black shrink-0 mt-0.5 ${
                          isSel 
                            ? (colorTheme === 'color' ? 'bg-amber-600 border-amber-700 text-white' : 'bg-black border-black text-white') 
                            : isMis 
                            ? (colorTheme === 'color' ? 'bg-rose-600 border-rose-700 text-white' : 'bg-black border-black text-white ring-1 ring-black')
                            : 'bg-white border-black text-transparent'
                        }`}>
                          {isSel ? '✓' : isMis ? '⚠️' : ''}
                        </span>
                        <span className={`leading-tight ${
                          isMis 
                            ? 'font-black text-rose-800 underline' 
                            : isSel 
                            ? 'font-bold text-black' 
                            : 'text-gray-700'
                        } ${prec.isCustom ? 'italic' : ''}`}>
                          {prec.labelFa}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {p.precautionsTaken.some(p => p.missed) && (
                  <div className="mt-0.5 pt-0.5 border-t border-rose-300 text-[6.5px] text-rose-800 font-bold">
                    <span>⚠️ عدم انطباق تمهیدات الزامی: </span>
                    <span>{p.precautionsTaken.filter(p => p.missed).map(p => p.labelFa).join('، ')}</span>
                  </div>
                )}
                {p.customOtherPrecautionsText && (
                  <div className="mt-0.5 pt-0.5 border-t border-gray-300 text-[6.5px]">
                    <span className="font-black">سایر تمهیدات: </span>
                    <span>{p.customOtherPrecautionsText}</span>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* ========================================================================= */}
          {/* 3. Executive Audit Summary, Non-Conformances & HSE Auditor Signature */}
          {/* ========================================================================= */}
          <div className={`mt-1 border-2 p-1.5 bg-white space-y-1 rounded-xs ${
            colorTheme === 'color' ? 'border-blue-900' : 'border-black'
          }`}>
            
            {/* Quantitative Score & Compliance Rate Strip */}
            <div className={`flex items-center justify-between border px-2 py-1 text-[7.5px] font-bold rounded-xs ${
              colorTheme === 'color' 
                ? 'border-blue-800 bg-blue-50/70 text-slate-900' 
                : 'border-black bg-gray-100 print:bg-gray-50 text-black'
            }`}>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-black">شاخص‌های انطباق ممیزی:</span>
                <span>بندهای ممیزی: <strong className="font-mono">{totalItems}</strong></span>
                <span>انطباق چک‌لیست: <strong className="font-mono text-emerald-700 font-black">{passItems}</strong></span>
                <span>نواقص چک‌لیست: <strong className="font-mono text-rose-700 font-black">{questionDefects}</strong></span>
                {missedNcItems > 0 && (
                  <span>عدم انطباق الزامات (PPE/خطرات/تمهیدات): <strong className="font-mono text-rose-700 font-black">{missedNcItems}</strong></span>
                )}
                <span>جمع کل عدم انطباق: <strong className="font-mono text-rose-700 font-black">{totalDefects}</strong></span>
                <span>عدم شمول: <strong className="font-mono">{naItems}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black">درصد سلامت و انطباق استاندارد:</span>
                <span className={`px-2 py-0.2 border bg-white font-mono font-black text-[9px] rounded-xs ${
                  colorTheme === 'color' ? 'border-blue-900 text-blue-950' : 'border-black text-black'
                }`}>
                  {complianceRate}%
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[7px] font-black ${
                  totalDefects === 0 
                    ? (colorTheme === 'color' ? 'bg-emerald-600 text-white' : 'bg-black text-white') 
                    : (colorTheme === 'color' ? 'bg-rose-600 text-white' : 'border border-black bg-gray-200 text-black')
                }`}>
                  {totalDefects === 0 ? 'انطباق کامل' : `دارای ${totalDefects} مورد عدم انطباق`}
                </span>
              </div>
            </div>

            {/* Findings & Non-Conformances Report */}
            <div>
              <div className="font-black text-[8px] mb-0.5 text-black">
                گزارش تفصیلی ممیزی اجرای سیستم پروانه کار و اقدامات اصلاحی لازم :
              </div>
              <div className={`text-[7.5px] min-h-[24px] leading-relaxed border p-1 rounded-xs ${
                colorTheme === 'color' ? 'border-blue-200 bg-slate-50/50 text-slate-950' : 'border-black bg-white text-black'
              }`}>
                {p.auditSummaryReport || 'کلیه موارد ۳۰ گانه چک‌لیست، ایزولاسیون‌ها و پیش‌بینی‌های ایمنی، بهداشت و آتش‌نشانی در محل بررسی گردید.'}
                {p.defectsAndNonConformances && (
                  <div className="mt-0.5 font-bold border-t border-dashed border-gray-400 pt-0.5 text-rose-800">
                    عدم انطباق‌ها و نواقص ثبت شده: {p.defectsAndNonConformances}
                  </div>
                )}
                {p.attachments && p.attachments.length > 0 && (
                  <div className="mt-0.5 font-bold border-t border-dashed border-gray-300 pt-0.5 text-slate-700 flex items-center justify-between">
                    <span>مستندات پیوست: {p.attachments.length} مورد تصویر/فایل PDF در سامانه ضمیمه شده است ({p.attachments.map(a => a.name).join('، ')})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Official Digital Signatures & Referral Workflow Matrix (If signed/referred) */}
            <PrintDocumentSignaturesBox
              documentType="PTW_AUDIT"
              documentId={p.id}
              isFa={isFa}
              fallbackSignatories={[
                { roleTitle: 'کارشناس / نماینده واحد', subTitle: 'ممیز و ارزیاب میدانی HSE', defaultName: p.hseAuditor?.auditorName || 'ممیز HSE' },
                { roleTitle: 'سرپرست / مسئول واحد', subTitle: 'سرپرست و مسئول محوطه پروانه', defaultName: p.signers?.areaResponsibleName || 'مسئول واحد/محوطه' },
                { roleTitle: 'رئیس مرکز HSE', subTitle: 'ریاست و تصویب نهایی ممیزی', defaultName: 'رئیس مرکز HSE' }
              ]}
            />

            {/* Official Signature: Only HSE Representative & Auditor (Left Aligned & Compact) */}
            <div className="pt-0.5 flex justify-end text-[7.5px]">
              <div className={`w-[260px] max-w-full border-2 p-1 bg-white text-center flex flex-col justify-between rounded-xs ${
                colorTheme === 'color' ? 'border-blue-900 bg-blue-50/20' : 'border-black'
              }`}>
                <div className={`font-black text-[8px] border-b pb-0.5 ${
                  colorTheme === 'color' ? 'border-blue-200 text-blue-950' : 'border-black/40 text-black'
                }`}>
                  کارشناس و ممیز واحد ایمنی (HSE)
                </div>
                <div className="font-black text-[8.5px] text-black py-1">
                  {p.hseAuditor?.auditorName || p.signers?.safetyUnitSignerName || 'نماینده واحد HSE'}
                </div>
                <div className={`text-[6.5px] font-bold border-t pt-0.5 flex items-center justify-between px-1 font-mono ${
                  colorTheme === 'color' ? 'border-blue-200 text-slate-700' : 'border-black/30 text-gray-800'
                }`}>
                  <span>تاریخ: {p.hseAuditor?.signedAt || p.auditDate}</span>
                  <span>ساعت: {p.auditTime || '00:00'}</span>
                  <span>تایید و امضاء ممیز HSE</span>
                </div>
              </div>
            </div>

            {/* Print Document Footer */}
            <div className={`flex items-center justify-between text-[6.5px] text-gray-700 pt-1 border-t font-mono ${
              colorTheme === 'color' ? 'border-blue-200' : 'border-black/40'
            }`}>
              <div>
                نسخه بایگانی رسمی مرکز HSE — سیستم مدیریت یکپارچه (IMS)
              </div>
              <div className="font-sans font-bold">
                شناسه یکتا سند: {p.id}
              </div>
              <div>
                صفحه ۱ از ۱
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}

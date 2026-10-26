import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Info
} from 'lucide-react';
import { WorkPermit, PermitCategory } from '../../types';
import { useSystemBranding } from '../../utils/systemBrandingHelper';
import HseLogo from '../HseLogo';
import { 
  SuppExcavation,
  SuppConfinedSpace,
  SuppElectricalIsolation,
  SuppProcessMechanical,
  SuppRadiation,
  SuppVehicleCrane
} from './supplementary';
import { printService } from '../../services/printService';
import { getReferralsForDocument } from '../../utils/referralHelper';
import { getPermitFieldConfigsSync } from './services/permitFieldConfigService';
import { COLD_INSPECTION_TEXTS, HOT_INSPECTION_TEXTS, ESD_ROWS_NAMES } from './PermitTypes';

interface PermitMasterPrintModalProps {
  permit: WorkPermit;
  isFa?: boolean;
  onClose: () => void;
}

export const PermitMasterPrintModal: React.FC<PermitMasterPrintModalProps> = ({
  permit,
  isFa = true,
  onClose
}) => {
  const { branding } = useSystemBranding();
  const [colorTheme, setColorTheme] = useState<'color' | 'mono'>('color');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showPdfHint, setShowPdfHint] = useState<boolean>(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const isHot = permit.permitCategory === 'Hot' || permit.permitType === 'Hot';
  const isCold = permit.permitCategory === 'Cold' || permit.permitType === 'Cold';
  const isSupplementary = !isHot && !isCold;

  const getCategoryTitle = (cat: PermitCategory | string) => {
    switch (cat) {
      case 'Hot': return { fa: 'پروانه کار گرم', en: 'HOT WORK PERMIT' };
      case 'Cold': return { fa: 'پروانه کار سرد', en: 'COLD WORK PERMIT' };
      case 'Excavation': return { fa: 'پروانه کار الحاقی حفاری', en: 'EXCAVATION CERTIFICATE' };
      case 'ProcessMechanical': return { fa: 'پروانه کار الحاقی جداسازی فرآیندی و مکانیکی', en: 'PROCESS & MECHANICAL ISOLATION' };
      case 'ConfinedSpace': return { fa: 'پروانه کار الحاقی ورود به فضای بسته', en: 'CONFINED SPACE ENTRY CERTIFICATE' };
      case 'ElectricalIsolation': return { fa: 'پروانه کار الحاقی جداسازی الکتریکی', en: 'ELECTRICAL ISOLATION CERTIFICATE' };
      case 'Radiation': return { fa: 'پروانه کار الحاقی منابع پرتوزا', en: 'RADIATION WORK CERTIFICATE' };
      case 'VehicleCrane': return { fa: 'پروانه کار الحاقی ورود جرثقیل و ماشین‌آلات', en: 'CRANE & VEHICLE ENTRY CERTIFICATE' };
      default: return { fa: 'پروانه کار رسمی', en: 'WORK PERMIT' };
    }
  };

  const catTitle = getCategoryTitle(permit.permitCategory);

  // Styling based on theme (Mono / Color)
  const isMono = colorTheme === 'mono';

  const headerTitleColor = isMono
    ? 'text-black font-black'
    : isHot
    ? 'text-red-700 font-black'
    : isCold
    ? 'text-blue-800 font-black'
    : 'text-slate-900 font-black';

  const tableHeaderBg = isMono
    ? 'bg-slate-100 text-black border-slate-900'
    : isHot
    ? 'bg-red-50 text-red-950 border-slate-900'
    : isCold
    ? 'bg-blue-50 text-blue-950 border-slate-900'
    : 'bg-slate-100 text-slate-900 border-slate-900';

  const sectionHeaderBg = isMono
    ? 'bg-slate-200 text-black border-b-2 border-slate-900'
    : isHot
    ? 'bg-red-100/90 text-red-950 border-b-2 border-slate-900'
    : isCold
    ? 'bg-blue-100/90 text-blue-950 border-b-2 border-slate-900'
    : 'bg-slate-200 text-slate-950 border-b-2 border-slate-900';

  const inspectionTexts = isHot ? HOT_INSPECTION_TEXTS : COLD_INSPECTION_TEXTS;
  const esdRowsNames = ESD_ROWS_NAMES;

  const ppeList = [
    { id: 'helmet', label: 'کلاه ایمنی' },
    { id: 'chinStrap', label: 'چانه‌بند کلاه' },
    { id: 'workClothes', label: 'لباس کار' },
    { id: 'acidSuit', label: 'لباس ضد اسید' },
    { id: 'aluminumSuit', label: 'لباس آلومینیومی نسوز' },
    { id: 'safetyShoes', label: 'کفش ایمنی' },
    { id: 'gogglesCutting', label: 'عینک برشکاری' },
    { id: 'gogglesGrinding', label: 'عینک سنگ‌زنی' },
    { id: 'gogglesUv', label: 'عینک UV' },
    { id: 'glovesLeather', label: 'دستکش چرمی' },
    { id: 'glovesCloth', label: 'دستکش پارچه‌ای' },
    { id: 'glovesPvc', label: 'دستکش PVC' },
    { id: 'glovesRefractory', label: 'دستکش نسوز' },
    { id: 'glovesAcid', label: 'دستکش ضد اسید' },
    { id: 'glovesElectrical', label: 'دستکش عایق برق' },
    { id: 'glovesAbrasion', label: 'دستکش ضد سایش' },
    { id: 'glovesCut', label: 'دستکش ضد برش' },
    { id: 'faceShieldGrinding', label: 'شیلد سنگ‌زنی' },
    { id: 'faceShieldWelding', label: 'شیلد جوشکاری' },
    { id: 'scbaMask', label: 'ماسک SCBA' },
    { id: 'earPlugs', label: 'گوش‌گیر (ایرپلاگ)' },
    { id: 'earMuffs', label: 'روگوشی (ایرماف)' },
    { id: 'antiShockHarness', label: 'کمربند و هارنس آنتی‌شوک' },
    { id: 'boots', label: 'چکمه ایمنی' },
    { id: 'maskDust', label: 'ماسک ضد غبار' },
    { id: 'maskHalf', label: 'ماسک نیم‌صورت' },
    { id: 'maskFull', label: 'ماسک تمام‌صورت' }
  ];

  const hazardList = [
    { id: 'flammable', label: 'قابل اشتعال' },
    { id: 'explosive', label: 'قابل انفجار' },
    { id: 'toxic', label: 'مواد سمی' },
    { id: 'corrosive', label: 'مواد خورنده' },
    { id: 'radiation', label: 'تشعشع پرتوزا' },
    { id: 'height', label: 'کار در ارتفاع' },
    { id: 'electrocution', label: 'برق‌گرفتگی' },
    { id: 'hotSurface', label: 'سطح داغ' },
    { id: 'pressurizedVessel', label: 'ظروف تحت فشار' },
    { id: 'dust', label: 'گرد و غبار' },
    { id: 'rain', label: 'بارانی' },
    { id: 'strongWind', label: 'باد شدید' },
    { id: 'wetMoist', label: 'خیس و مرطوب' },
    { id: 'slipperySurface', label: 'سطح لغزنده' }
  ];

  const handlePrint = () => {
    if (printContainerRef.current) {
      printService.printElement(printContainerRef.current, {
        title: `پروانه کار ایمن (PTW) - ${permit.serialNumber || ''} - ${permit.permitType || ''}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: permit.serialNumber,
        documentDate: permit.createdDate,
        isFa: true,
        autoPrint: true
      });
    } else {
      window.print();
    }
  };

  const handleSavePdf = () => {
    handlePrint();
  };

  // Helper to check if an item is checked
  const isPpeChecked = (id: string) => {
    if (!permit.ppeRequired) return false;
    return permit.ppeRequired.includes(id);
  };

  const isHazardChecked = (id: string) => {
    if (!permit.hazards) return false;
    return permit.hazards.includes(id);
  };

  const getInspectionValue = (idx: number): 'بله' | 'خیر' | 'لازم نیست' => {
    if (permit.inspections && (permit.inspections as any)[idx]) {
      return (permit.inspections as any)[idx];
    }
    // Default fallback based on standard safety defaults
    if (idx === 1 || idx === 2 || idx === 4 || idx === 5) return 'بله';
    if (idx === 7 || idx === 10) return 'لازم نیست';
    return 'بله';
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden font-sans text-slate-900"
      dir="rtl"
    >
      {/* =========================================================================
          TOP CONTROL BAR (Hidden during print)
         ========================================================================= */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg print:hidden">
        {/* Left: Title & Serial */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-black text-white">
                چاپ رسمی پروانه کار با فرم اصلی ثبت (Master Official PTW)
              </h2>
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-bold ${
                isHot ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 
                isCold ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 
                'bg-amber-500/20 text-amber-300 border border-blue-500/30'
              }`}>
                {permit.serialNumber}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {catTitle.fa} ({catTitle.en}) - تاریخ ثبت: {permit.createdDate?.slice(0, 10) || '۱۴۰۳/۰۸/۱۵'}
            </p>
          </div>
        </div>

        {/* Center: Format Switcher (Black & White vs Color) */}
        <div className="flex items-center gap-2 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setColorTheme('mono')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              colorTheme === 'mono'
                ? 'bg-slate-600 text-white shadow font-black ring-1 ring-white/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="فرمت تک‌رنگ استاندارد برای چاپ سیاه و سفید، کاهش مصرف جوهر و بایگانی رسمی"
          >
            <div className="w-3 h-3 rounded-full bg-slate-200 border border-black" />
            <span>سیاه و سفید (تک‌رنگ بایگانی)</span>
          </button>

          <button
            type="button"
            onClick={() => setColorTheme('color')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              colorTheme === 'color'
                ? 'bg-blue-600 text-white shadow font-black ring-1 ring-blue-300/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="فرمت چندرنگ سازمانی با کادرهای رنگی تفکیک‌شده و نشان‌های رسمی"
          >
            <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-red-500 via-amber-400 to-blue-500" />
            <span>رنگی (چندرنگ سازمانی)</span>
          </button>
        </div>

        {/* Right: Actions (Print, PDF, Zoom, Close) */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-slate-300 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(prev - 10, 60))}
              className="p-1 hover:bg-slate-700 rounded transition text-slate-300 hover:text-white"
              title="کوچک‌نمایی"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-bold px-1 min-w-[36px] text-center text-slate-200">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(prev + 10, 150))}
              className="p-1 hover:bg-slate-700 rounded transition text-slate-300 hover:text-white"
              title="بزرگ‌نمایی"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
              title="اندازه ۱۰۰٪ واقعی A4"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* PDF Download Guide Button */}
          <button
            type="button"
            onClick={handleSavePdf}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition"
            title="ذخیره با فرمت PDF"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">ذخیره PDF</span>
          </button>

          {/* Master Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/30 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ پروانه</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* PDF Saving Helper Toast / Banner */}
      {showPdfHint && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md print:hidden animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              💡 راهنما: در پنجره چاپ مرورگر، گزینه «Destination / مقصد» را روی <strong>«Save as PDF / ذخیره به صورت PDF»</strong> و اندازه کاغذ را روی <strong>A4</strong> قرار دهید.
            </span>
          </div>
          <button 
            onClick={() => setShowPdfHint(false)}
            className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] hover:bg-amber-700"
          >
            متوجه شدم
          </button>
        </div>
      )}

      {/* =========================================================================
          PRINTABLE DOCUMENT CANVAS CONTAINER
         ========================================================================= */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/90 dark:bg-slate-950 flex justify-center custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
        <div 
          ref={printContainerRef}
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
          className={`w-full max-w-5xl bg-white text-slate-900 shadow-lg rounded-none p-0 my-2 print:my-0 print:p-0 print:shadow-none print:w-full print:max-w-none ${
            isMono ? 'grayscale-print-theme' : ''
          }`}
        >
          {/* If it's a supplementary permit, render its dedicated master layout */}
          {isSupplementary ? (
            <div className="space-y-4">
              {permit.permitCategory === 'Excavation' && <SuppExcavation />}
              {permit.permitCategory === 'ConfinedSpace' && <SuppConfinedSpace />}
              {permit.permitCategory === 'ElectricalIsolation' && <SuppElectricalIsolation />}
              {permit.permitCategory === 'ProcessMechanical' && <SuppProcessMechanical />}
              {permit.permitCategory === 'Radiation' && <SuppRadiation />}
              {permit.permitCategory === 'VehicleCrane' && <SuppVehicleCrane />}

              {/* Verified Badge & Footer Bar */}
              <div className="mt-4 pt-4 border-t-2 border-slate-900 flex items-center justify-between text-[10px] font-bold">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span>تاییدیه الکترونیکی واحد ایمنی، بهداشت و محیط زیست (HSE)</span>
                </div>
                <div className="font-mono text-slate-600">
                  PTW-SERIAL: {permit.serialNumber} | وضعیت: {permit.status === 'Active' ? 'فعال در سایت' : permit.status}
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
                PRIMARY MASTER PERMIT FORM (HOT & COLD WORK PERMIT)
                Full 10-section Petrokimi Rejal standard permit layout
               ========================================================================= */
            <div className="text-xs border-2 border-slate-900 divide-y-2 divide-slate-900 bg-white print-exact">
              {/* -------------------------------------------------------------
                  1. HEADER BLOCK: Logo, Company & Title, Serial & Date
                 ------------------------------------------------------------- */}
              <div className={`grid grid-cols-12 text-center font-bold ${
                isMono ? 'bg-white' : ''
              }`}>
                {/* Logo Column */}
                <div className="col-span-3 border-l-2 border-slate-900 p-2 flex items-center justify-center min-h-[68px] bg-white">
                  {branding.logoUrl ? (
                    <img 
                      src={branding.logoUrl} 
                      alt="Official Logo" 
                      className={`max-h-14 max-w-full object-contain select-none ${isMono ? 'filter grayscale contrast-125' : ''}`}
                      style={{
                        height: `${branding.logoHeightPrintMm || 16}mm`,
                        imageRendering: 'auto'
                      }}
                    />
                  ) : (
                    <HseLogo size="md" forceDefault={true} showShadow={false} />
                  )}
                </div>

                {/* Title Column */}
                <div className={`col-span-5 border-l-2 border-slate-900 p-2 sm:p-3 flex flex-col items-center justify-center ${tableHeaderBg}`}>
                  <div className="text-base sm:text-lg font-extrabold text-slate-900">
                    {branding.organizationNameFa || 'شرکت پتروشیمی رجال'}
                  </div>
                  <div className={`text-xs sm:text-sm md:text-base font-extrabold mt-1 tracking-tight ${headerTitleColor}`}>
                    {isHot ? 'پروانه کار گرم HOT WORK PERMIT' : 'پروانه کار سرد COLD WORK PERMIT'}
                  </div>
                  <div className="text-[10px] text-slate-700 font-bold mt-0.5">
                    {isHot ? 'کارهای همراه با شعله باز، جوشکاری، برشکاری و جرقه‌زا' : 'تعمیرات مکانیکی، عمومی و بدون جرقه'}
                  </div>
                </div>

                {/* Metadata Column */}
                <div className="col-span-4 p-2 text-right text-[10.5px] space-y-1 flex flex-col justify-center bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-700">شماره پروانه کار:</span>
                    <span className="font-mono font-black text-xs text-blue-900">{permit.serialNumber}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-700">تاریخ اجرای کار:</span>
                    <span className="font-mono font-bold">{permit.day ? `${permit.year || 1403}/${permit.month || '08'}/${permit.day}` : permit.createdDate?.slice(0, 10) || '۱۴۰۳/۰۸/۱۵'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-700">ساعت شروع / پایان:</span>
                    <span className="font-mono font-bold">{permit.startHour || '08:00'} الی {permit.endHour || '16:00'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">وضعیت سند:</span>
                    <span className={`px-2 py-0.5 rounded font-black text-[9.5px] ${
                      isMono ? 'bg-slate-900 text-white' :
                      permit.status === 'Active' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
                    }`}>
                      {permit.status === 'Active' ? 'صادر شده / معتبر' : permit.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  2. SUB-HEADER INFO ROWS: Unit, Equipment, WO, Purpose, Description
                 ------------------------------------------------------------- */}
              <div className="p-2.5 space-y-2 text-[11px] bg-slate-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-1 border-b sm:border-b-0 border-slate-200 pb-1 sm:pb-0">
                    <span className="font-bold shrink-0 text-slate-800">واحد عملیاتی:</span>
                    <span className="font-bold text-slate-950 px-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">{permit.location || 'واحد تقطیر و فرآیند'}</span>
                  </div>
                  <div className="flex items-center gap-1 border-b sm:border-b-0 border-slate-200 pb-1 sm:pb-0">
                    <span className="font-bold shrink-0 text-slate-800">شماره تجهیز:</span>
                    <span className="font-mono font-bold text-slate-950 px-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">{permit.equipmentName || 'V-101 / خط لوله اصلی'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold shrink-0 text-slate-800">شماره دستور کار (WO):</span>
                    <span className="font-mono font-bold text-slate-950 px-1 bg-white border border-slate-200 rounded px-1.5 py-0.5">{permit.woNumber || 'WO-1403-9941'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200">
                  <span className="font-bold shrink-0 text-slate-800">به منظور:</span>
                  <div className="flex items-center gap-4 font-bold text-slate-700">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-slate-200 ${permit.maintenanceType === 'OH' ? 'text-black font-black border-slate-900 bg-slate-100' : ''}`}>
                      <span className={`inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 ${permit.maintenanceType === 'OH' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                        {permit.maintenanceType === 'OH' ? '✓' : ''}
                      </span>
                      OH (اورهال)
                    </span>
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-slate-200 ${permit.maintenanceType === 'PM' || !permit.maintenanceType ? 'text-black font-black border-slate-900 bg-slate-100' : ''}`}>
                      <span className={`inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 ${permit.maintenanceType === 'PM' || !permit.maintenanceType ? 'bg-black text-white font-black' : 'bg-white'}`}>
                        {permit.maintenanceType === 'PM' || !permit.maintenanceType ? '✓' : ''}
                      </span>
                      PM (پیشگیرانه)
                    </span>
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-slate-200 ${permit.maintenanceType === 'EM' ? 'text-black font-black border-slate-900 bg-slate-100' : ''}`}>
                      <span className={`inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 ${permit.maintenanceType === 'EM' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                        {permit.maintenanceType === 'EM' ? '✓' : ''}
                      </span>
                      EM (اضطراری)
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1 pt-1 border-t border-slate-200">
                  <span className="font-bold shrink-0 text-slate-800">شرح کامل کار:</span>
                  <span className="font-bold text-slate-900 leading-relaxed bg-white border border-slate-200 rounded px-2 py-1 flex-1">{permit.description || 'تعمیرات، جوشکاری و بررسی سلامت اتصالات'}</span>
                </div>

                <div className="flex items-center gap-1 pt-1 border-t border-slate-200">
                  <span className="font-bold shrink-0 text-slate-800">ماشین‌آلات مورد نیاز (جرثقیل، لیفتراک و...):</span>
                  <span className="font-medium text-slate-900 bg-white border border-slate-200 rounded px-2 py-0.5 flex-1">{permit.machineryRequired || 'جرثقیل ۲۵ تن کارگاهی و دستگاه موتور جوش'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-200">
                  <span className="font-bold shrink-0 text-slate-800">نوع تجهیزات و ابزار مورد استفاده:</span>
                  <div className="flex items-center gap-3 text-[10.5px]">
                    <span className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5">
                      <span className="inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 bg-black text-white font-bold text-[9px]">✓</span>
                      برقی
                    </span>
                    <span className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5">
                      <span className="inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 bg-black text-white font-bold text-[9px]">✓</span>
                      مکانیکی
                    </span>
                    <span className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5">
                      <span className={`inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 ${isHot ? 'bg-black text-white font-bold text-[9px]' : 'bg-white'}`}>
                        {isHot ? '✓' : ''}
                      </span>
                      شعله‌افکن / جوش
                    </span>
                  </div>
                </div>

                {/* Attached Permits Grid */}
                <div className="border-t-2 border-slate-300 pt-2 space-y-1.5">
                  <div className="font-extrabold text-slate-900">پروانه‌های الحاقی و تکمیلی (Attached Certificates):</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 border border-black rounded text-center leading-2.5 ${permit.attachedPermits?.excavation ? 'bg-black text-white font-black text-[8px]' : 'bg-white'}`}>
                          {permit.attachedPermits?.excavation ? '✓' : ''}
                        </span>
                        <span className="font-bold">حفاری</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">{permit.attachedPermits?.excavationSerial || '---'}</span>
                    </div>

                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 border border-black rounded text-center leading-2.5 ${permit.attachedPermits?.confinedSpace ? 'bg-black text-white font-black text-[8px]' : 'bg-white'}`}>
                          {permit.attachedPermits?.confinedSpace ? '✓' : ''}
                        </span>
                        <span className="font-bold">ورود به فضای بسته</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">{permit.attachedPermits?.confinedSpaceSerial || '---'}</span>
                    </div>

                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 border border-black rounded text-center leading-2.5 ${permit.attachedPermits?.radiation ? 'bg-black text-white font-black text-[8px]' : 'bg-white'}`}>
                          {permit.attachedPermits?.radiation ? '✓' : ''}
                        </span>
                        <span className="font-bold">پرتونگاری</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">---</span>
                    </div>

                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 border border-black rounded text-center leading-2.5 ${permit.attachedPermits?.electrical ? 'bg-black text-white font-black text-[8px]' : 'bg-white'}`}>
                          {permit.attachedPermits?.electrical ? '✓' : ''}
                        </span>
                        <span className="font-bold">جداسازی الکتریکی</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">{permit.attachedPermits?.electricalSerial || '---'}</span>
                    </div>

                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 border border-black rounded text-center leading-2.5 ${permit.attachedPermits?.lifting ? 'bg-black text-white font-black text-[8px]' : 'bg-white'}`}>
                          {permit.attachedPermits?.lifting ? '✓' : ''}
                        </span>
                        <span className="font-bold">ورود ماشین‌آلات</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">---</span>
                    </div>

                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 border border-black rounded text-center leading-2.5 ${permit.attachedPermits?.processIsolation ? 'bg-black text-white font-black text-[8px]' : 'bg-white'}`}>
                          {permit.attachedPermits?.processIsolation ? '✓' : ''}
                        </span>
                        <span className="font-bold">جداسازی فرآیندی</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">---</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  3. INSPECTIONS TABLE (Full 13 / 14 Items)
                 ------------------------------------------------------------- */}
              <div className="bg-white">
                <div className={`p-2 font-black text-[11px] flex items-center justify-between ${sectionHeaderBg}`}>
                  <span>بازرسی‌ها و الزامات ایمنی پیش از صدور پروانه (SAFETY INSPECTIONS):</span>
                  <span className="text-[10px] font-bold text-slate-700">تایید شده توسط واحد بهره‌برداری و HSE</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-100 font-bold">
                        <th className="p-1.5 border-l border-slate-800">شرح بند بازرسی و کنترل‌های پیش‌گیرانه ایمنی</th>
                        <th className="p-1.5 border-l border-slate-800 w-14 text-center">بله</th>
                        <th className="p-1.5 border-l border-slate-800 w-14 text-center">خیر</th>
                        <th className="p-1.5 w-20 text-center">لازم نیست</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {inspectionTexts.map((text, idx) => {
                        const num = idx + 1;
                        const val = getInspectionValue(num);
                        return (
                          <tr key={num} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                            <td className="p-1.5 border-l border-slate-800 leading-tight">
                              <span className="font-medium text-slate-900">{text}</span>
                              {num === 3 && (
                                <span className="text-[9.5px] text-slate-700 mr-2 font-bold inline-block bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                                  [ تخلیه شده: ✓ | Vent شده: ✓ | Purge نیتروژن: ✓ ]
                                </span>
                              )}
                              {num === 6 && (
                                <span className="text-[9.5px] text-blue-900 mr-2 font-mono font-bold inline-block bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  (Padlock LOTO: L-1403-88)
                                </span>
                              )}
                            </td>
                            <td className="p-1.5 border-l border-slate-800 text-center font-bold text-xs">
                              {val === 'بله' ? (
                                <span className="inline-block w-4 h-4 rounded bg-slate-900 text-white font-black text-[10px] leading-3.5">✓</span>
                              ) : '○'}
                            </td>
                            <td className="p-1.5 border-l border-slate-800 text-center font-bold text-xs">
                              {val === 'خیر' ? (
                                <span className="inline-block w-4 h-4 rounded bg-slate-900 text-white font-black text-[10px] leading-3.5">✓</span>
                              ) : '○'}
                            </td>
                            <td className="p-1.5 text-center font-bold text-xs">
                              {val === 'لازم نیست' ? (
                                <span className="inline-block w-4 h-4 rounded bg-slate-900 text-white font-black text-[10px] leading-3.5">✓</span>
                              ) : '○'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  4. PPE SECTION (وسایل استحفاظی فردی مورد نیاز)
                 ------------------------------------------------------------- */}
              <div className="bg-white">
                <div className={`p-2 font-black text-[11px] flex items-center justify-between ${sectionHeaderBg}`}>
                  <span>وسایل استحفاظی فردی مورد نیاز (Required Personal Protective Equipment - PPE):</span>
                  <span className="text-[9.5px] text-slate-600 font-bold">استفاده در تمام مدت اجرای فعالیت الزامی است</span>
                </div>
                <div className="p-2.5 bg-slate-50/40">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {ppeList.map(item => {
                      const checked = isPpeChecked(item.id) || ['helmet', 'safetyShoes', 'workClothes', 'gogglesCutting', 'glovesLeather'].includes(item.id);
                      return (
                        <div key={item.id} className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border shadow-2xs ${
                          checked ? 'bg-white border-slate-900 text-slate-950 font-bold' : 'bg-slate-100/60 border-slate-200 text-slate-500'
                        }`}>
                          <span className={`inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 shrink-0 ${
                            checked ? 'bg-black text-white font-black text-[9px]' : 'bg-white'
                          }`}>
                            {checked ? '✓' : ''}
                          </span>
                          <span className="truncate">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  5. HAZARDS SECTION (شرایط خطرناک محیط کار)
                 ------------------------------------------------------------- */}
              <div className="bg-white">
                <div className={`p-2 font-black text-[11px] ${sectionHeaderBg}`}>
                  شرایط خطرناک محیط کار و ریسک‌های ارزیابی‌شده (Workplace Hazards):
                </div>
                <div className="p-2.5 bg-slate-50/40">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {hazardList.map(item => {
                      const checked = isHazardChecked(item.id) || (isHot && ['flammable', 'hotSurface', 'dust'].includes(item.id));
                      return (
                        <div key={item.id} className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border shadow-2xs ${
                          checked ? 'bg-white border-slate-900 text-slate-950 font-bold' : 'bg-slate-100/60 border-slate-200 text-slate-500'
                        }`}>
                          <span className={`inline-block w-3.5 h-3.5 border border-black rounded text-center leading-3 shrink-0 ${
                            checked ? 'bg-black text-white font-black text-[9px]' : 'bg-white'
                          }`}>
                            {checked ? '✓' : ''}
                          </span>
                          <span className="truncate">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  6. HOT WORK ESD & FIRE/GAS TABLE OR INSTRUCTIONS BOX
                 ------------------------------------------------------------- */}
              {isHot && (
                <div className="bg-white">
                  <div className={`p-2 font-black text-[10.5px] ${sectionHeaderBg}`}>
                    نیازهای مرتبط با سیستم‌های Fire & Gas و ESD (Safety Inhibit & Isolation Status):
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-[9.5px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-100 font-bold">
                          <th className="p-1 border-l border-slate-800 text-right px-2">سیستم ایمنی / تجهیز F&G</th>
                          <th className="p-1 border-l border-slate-800 w-10">Req</th>
                          <th className="p-1 border-l border-slate-800">Unit/Zone</th>
                          <th className="p-1 border-l border-slate-800">Inhibit Date</th>
                          <th className="p-1 border-l border-slate-800">Inhibit Time</th>
                          <th className="p-1 border-l border-slate-800">Inhibit Sign</th>
                          <th className="p-1 border-l border-slate-800">Active Date</th>
                          <th className="p-1 border-l border-slate-800">Active Time</th>
                          <th className="p-1">Active Sign</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {esdRowsNames.map((name, idx) => (
                          <tr key={name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="p-1 border-l border-slate-800 text-right font-bold px-2">{name}</td>
                            <td className="p-1 border-l border-slate-800 font-bold text-center">✓</td>
                            <td className="p-1 border-l border-slate-800 font-mono">Unit 102</td>
                            <td className="p-1 border-l border-slate-800 font-mono">1403/08/15</td>
                            <td className="p-1 border-l border-slate-800 font-mono">07:45</td>
                            <td className="p-1 border-l border-slate-800 font-mono text-[9px] text-emerald-800 font-bold">Approved</td>
                            <td className="p-1 border-l border-slate-800 font-mono">1403/08/15</td>
                            <td className="p-1 border-l border-slate-800 font-mono">16:15</td>
                            <td className="p-1 font-mono text-[9px] text-emerald-800 font-bold">Completed</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  7. GAS TESTING LOG (نتایج سنجش گازها)
                 ------------------------------------------------------------- */}
              <div className="bg-white">
                <div className={`p-2 font-black text-[10.5px] flex items-center justify-between ${sectionHeaderBg}`}>
                  <span>آزمایش گازها و سنجش اتمسفر (Gas Test Log & Atmospheric Monitoring):</span>
                  <div className="flex items-center gap-3 text-[9.5px] font-bold">
                    <span>گازهای قابل انفجار: ✓</span>
                    <span>اکسیژن: ✓</span>
                    <span>گازهای سمی: ✓</span>
                    <span>نوبت سنجش: متناوب هر ۶۰ دقیقه</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-[9.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-100 font-bold">
                        <th className="p-1 border-l border-slate-800 text-right px-2">نام آزمایش‌کننده گاز (Gas Tester) / شماره گواهینامه</th>
                        <th className="p-1 border-l border-slate-800 w-12">O₂ (%)</th>
                        <th className="p-1 border-l border-slate-800 w-12">LEL (%)</th>
                        <th className="p-1 border-l border-slate-800 w-14">CO (ppm)</th>
                        <th className="p-1 border-l border-slate-800 w-12">CO₂ (%)</th>
                        <th className="p-1 border-l border-slate-800 w-14">H₂S (ppm)</th>
                        <th className="p-1 border-l border-slate-800 w-14">NH₂ (ppm)</th>
                        <th className="p-1 border-l border-slate-800 w-14">SO₂ (ppm)</th>
                        <th className="p-1 w-16">ساعت (Time)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr className="bg-white">
                        <td className="p-1.5 border-l border-slate-800 text-right px-2 font-bold">
                          {permit.gasTest?.testerName || '—'}
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          {permit.gasTest?.o2 ?? '—'}{permit.gasTest?.o2 !== undefined ? '%' : ''}
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          {permit.gasTest?.lel ?? '—'}{permit.gasTest?.lel !== undefined ? '%' : ''}
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          {permit.gasTest?.co ?? '—'}{permit.gasTest?.co !== undefined ? ' ppm' : ''}
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          0.0%
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          {permit.gasTest?.h2s ?? '—'}{permit.gasTest?.h2s !== undefined ? ' ppm' : ''}
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          0 ppm
                        </td>
                        <td className="p-1.5 border-l border-slate-800 font-mono font-bold text-emerald-800">
                          0 ppm
                        </td>
                        <td className="p-1.5 font-mono font-bold">
                          {permit.gasTest?.testTime || '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  7.5. CUSTOM DYNAMIC FORM FIELDS (فیلدهای سفارشی و متغیر پروانه)
                 ------------------------------------------------------------- */}
              {permit.customFields && Object.keys(permit.customFields).length > 0 && (
                <div className="bg-white">
                  <div className={`p-2 font-black text-[11px] flex items-center justify-between ${sectionHeaderBg}`}>
                    <span>الزامات، مشخصات و فیلدهای تکمیلی ثبت‌شده (Custom & Supplementary Specifications):</span>
                  </div>
                  <div className="p-2.5 bg-slate-50/40">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                      {Object.entries(permit.customFields).map(([key, val]) => {
                        if (val === undefined || val === null || val === '') return null;
                        const fieldDef = getPermitFieldConfigsSync().find(f => f.key === key || f.id === key);
                        const label = fieldDef?.labelFa || key;
                        const displayVal = typeof val === 'boolean' ? (val ? 'بله / تایید شده' : 'خیر') : String(val);
                        return (
                          <div key={key} className="bg-white border border-slate-300 rounded p-1.5 flex flex-col justify-between">
                            <span className="font-bold text-slate-700 text-[9.5px]">{label}:</span>
                            <span className="font-black text-slate-900 mt-0.5">{displayVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  8. FOUR DECLARATION SIGNATURE BOXES (ماتریس ۴ ستونه امضاهای صادرکنندگان مطابق با تصویر پیوست)
                 ------------------------------------------------------------- */}
              <div className="bg-white">
                <div className={`p-2 font-black text-[10.5px] text-center ${sectionHeaderBg}`}>
                  تعهدات، اظهارنامه‌ها و امضاهای مجاز صدور پروانه کار (Authorization & Issue Signatures):
                </div>
                <div className="grid grid-cols-4 border-b border-black text-[10px] bg-white text-black" dir="rtl">
                  {/* Column 1 (راست): کشیک ارشد تولید / صادر کننده */}
                  <div className="p-2.5 flex flex-col justify-between border-l border-black min-h-[145px]">
                    <div className="leading-relaxed text-center font-medium min-h-[46px] px-1 text-slate-900">
                      {permit.signatures4Tier?.issuer?.declarationText || 'اینجانب شخصاً بازرسی‌های لازم را انجام داده و شرایط را مناسب می‌دانم.'}
                    </div>
                    <div className="font-black text-center text-[10.5px] py-1 border-y border-black bg-slate-100 my-2 text-slate-950">
                      {permit.signatures4Tier?.issuer?.roleTitle || 'کشیک ارشد تولید / صادر کننده'}
                    </div>
                    <div className="space-y-1.5 mt-auto text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">نام و امضاء:</span>
                        <span className="font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.issuer?.name || permit.responsibles?.unitSupervisor || '........................'}
                        </span>
                      </div>
                      {permit.signatures4Tier?.issuer?.signatureImage && (
                        <div className="h-7 flex items-center justify-center my-0.5 border border-dashed border-slate-300">
                          <img src={permit.signatures4Tier.issuer.signatureImage} alt="امضا" className="max-h-6 max-w-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">ساعت تایید:</span>
                        <span className="font-mono font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.issuer?.time || '07:30'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: مسئول انجام کار */}
                  <div className="p-2.5 flex flex-col justify-between border-l border-black min-h-[145px]">
                    <div className="leading-relaxed text-center font-medium min-h-[46px] px-1 text-slate-900">
                      {permit.signatures4Tier?.executor?.declarationText || 'اینجانب با اطلاع کامل از احتیاط های لازم، پس از پایان‌کار مراتب را به مسئول محوطه اطلاع خواهم داد.'}
                    </div>
                    <div className="font-black text-center text-[10.5px] py-1 border-y border-black bg-slate-100 my-2 text-slate-950">
                      {permit.signatures4Tier?.executor?.roleTitle || 'مسئول انجام کار'}
                    </div>
                    <div className="space-y-1.5 mt-auto text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">نام و امضاء:</span>
                        <span className="font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.executor?.name || permit.responsibles?.jobExecutor || permit.qualifiedPersonnel || '........................'}
                        </span>
                      </div>
                      {permit.signatures4Tier?.executor?.signatureImage && (
                        <div className="h-7 flex items-center justify-center my-0.5 border border-dashed border-slate-300">
                          <img src={permit.signatures4Tier.executor.signatureImage} alt="امضا" className="max-h-6 max-w-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">ساعت تایید:</span>
                        <span className="font-mono font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.executor?.time || '07:45'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: مسئول محوطه */}
                  <div className="p-2.5 flex flex-col justify-between border-l border-black min-h-[145px]">
                    <div className="leading-relaxed text-center font-medium min-h-[46px] px-1 text-slate-900">
                      {permit.signatures4Tier?.areaSupervisor?.declarationText || 'اینجانب شخصاً بازرسی‌های فوق را انجام داده و شرایط را مناسب می‌دانم.'}
                    </div>
                    <div className="font-black text-center text-[10.5px] py-1 border-y border-black bg-slate-100 my-2 text-slate-950">
                      {permit.signatures4Tier?.areaSupervisor?.roleTitle || 'مسئول محوطه'}
                    </div>
                    <div className="space-y-1.5 mt-auto text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">نام و امضاء:</span>
                        <span className="font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.areaSupervisor?.name || permit.responsibles?.unitSupervisor || '........................'}
                        </span>
                      </div>
                      {permit.signatures4Tier?.areaSupervisor?.signatureImage && (
                        <div className="h-7 flex items-center justify-center my-0.5 border border-dashed border-slate-300">
                          <img src={permit.signatures4Tier.areaSupervisor.signatureImage} alt="امضا" className="max-h-6 max-w-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">ساعت تایید:</span>
                        <span className="font-mono font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.areaSupervisor?.time || '07:50'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 4 (چپ): واحد ایمنی */}
                  <div className="p-2.5 flex flex-col justify-between min-h-[145px]">
                    <div className="leading-relaxed text-center font-medium min-h-[46px] px-1 text-slate-900">
                      {permit.signatures4Tier?.safetyUnit?.declarationText || 'کلیه بازرسی ها و موارد ایمنی انجام گردید و مورد تایید می باشد'}
                    </div>
                    <div className="font-black text-center text-[10.5px] py-1 border-y border-black bg-slate-100 my-2 text-slate-950">
                      {permit.signatures4Tier?.safetyUnit?.roleTitle || 'واحد ایمنی'}
                    </div>
                    <div className="space-y-1.5 mt-auto text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">نام و امضاء:</span>
                        <span className="font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.safetyUnit?.name || permit.responsibles?.safetyUnit || permit.standByHse || '........................'}
                        </span>
                      </div>
                      {permit.signatures4Tier?.safetyUnit?.signatureImage && (
                        <div className="h-7 flex items-center justify-center my-0.5 border border-dashed border-slate-300">
                          <img src={permit.signatures4Tier.safetyUnit.signatureImage} alt="امضا" className="max-h-6 max-w-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">ساعت تایید:</span>
                        <span className="font-mono font-bold flex-1 text-center truncate mr-1">
                          {permit.signatures4Tier?.safetyUnit?.time || '08:00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Workflow & Digital Signatures (امضاهای دیجیتال ارجاع‌شوندگان در گردش کار) */}
                {(() => {
                  const referrals = getReferralsForDocument('PERMIT', permit.id || '');
                  const signedAssignees = referrals.flatMap(r => 
                    r.assignees.filter(a => (a.status === 'APPROVED' || a.status === 'SIGNED') && a.signatureImage)
                  );
                  if (signedAssignees.length === 0) return null;

                  return (
                    <div className="border-t border-slate-900 p-2.5 bg-slate-50/50">
                      <div className="font-black text-[10px] text-slate-900 mb-2 flex items-center justify-between">
                        <span>امضاها و تأییدیه‌های دیجیتال ثبت‌شده در گردش کار ارجاع (Referral Workflow Signatures):</span>
                        <span className="text-emerald-700 font-bold text-[9px]">تأیید اصالت دیجیتال ✓</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {signedAssignees.map((asg, idx) => (
                          <div key={idx} className="bg-white border border-slate-300 rounded p-2 text-[9.5px] space-y-1 shadow-2xs">
                            <div className="font-bold text-slate-900 truncate">{asg.userName}</div>
                            <div className="text-slate-500 text-[9px] truncate">{asg.userJobTitle || asg.userRole || 'پرسنل'}</div>
                            <div className="h-10 flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded my-1">
                              <img src={asg.signatureImage} alt="امضا" className="max-h-9 max-w-full object-contain" />
                            </div>
                            <div className="flex items-center justify-between text-[8.5px] text-slate-400 font-mono">
                              <span>{asg.signedAtPersian || '۱۴۰۵/۰۶/۲۳'}</span>
                              <span className="text-emerald-600 font-bold">امضا شد ✓</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* -------------------------------------------------------------
                  9. CLOSURE & WORK COMPLETION SECTION (خاتمه پروانه کار)
                 ------------------------------------------------------------- */}
              <div className="bg-white">
                <div className={`p-2 font-black text-[10.5px] flex items-center justify-between ${sectionHeaderBg}`}>
                  <span>خاتمه پروانه کار و تحویل نهایی محوطه (PERMIT CLOSURE & HANDOVER):</span>
                  <span className="text-[9.5px] font-bold text-slate-700 bg-white/70 px-2 py-0.5 rounded border border-slate-300">
                    وضعیت خاتمه: انجام شده و محوطه به حالت نرمال برگشته است
                  </span>
                </div>

                <div className="p-3 space-y-2.5 bg-slate-50/30">
                  {/* Closure Checklist Grid (All 6 Items) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[10px]">
                    {[
                      '۱- پرسنل درگیر در کار منطقه کاری را ترک کرده‌اند.',
                      '۲- تمامی تجهیزات و ماشین‌آلات به صورت ایمن در محل خود می‌باشند.',
                      '۳- ایزوله‌های عملیاتی و مکانیکی برداشته شده و خطوط نرمال شده‌اند.',
                      '۴- تجهیزات ایمنی برداشته شده‌اند.',
                      '۵- تجهیزات به حالت نرمال برگشته‌اند.',
                      '۶- عملیات تمیزکاری و جمع‌آوری پسماندها و ضایعات انجام شده است.'
                    ].map((txt, idx) => {
                      const num = idx + 1;
                      const checkVal = permit.closureDetails?.closureChecks?.[num];
                      const isYes = checkVal === 'بله' || !checkVal;
                      return (
                        <div key={num} className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-slate-200">
                          <span className={`w-3.5 h-3.5 border rounded text-center leading-3 font-bold text-[8.5px] ${
                            isYes ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-400'
                          }`}>
                            {checkVal === 'خیر' ? '✗' : (checkVal === 'لازم نیست' ? '-' : '✓')}
                          </span>
                          <span className="truncate">{txt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Closure Signatures 2 Boxes (تحویل‌دهنده مجری کار و تحویل‌گیرنده مسئول محوطه) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[10px]">
                    {/* Role 1: Executor */}
                    {(() => {
                      const execTier = permit.closureDetails?.signatures?.executor;
                      const execName = execTier?.name || permit.responsibles?.jobExecutor || permit.qualifiedPersonnel || '-';
                      const execTime = execTier?.time || permit.endHour || '16:00';
                      const execImg = execTier?.signatureImage;
                      return (
                        <div className="border border-slate-300 p-2 rounded-lg bg-white shadow-2xs space-y-1">
                          <div className="font-bold text-slate-800 text-[10px] pb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>۱. تحویل‌دهنده (مجری کار):</span>
                            <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[9px]">
                              ساعت: {execTime}
                            </span>
                          </div>
                          <div className="text-slate-900 font-bold truncate text-[10px]">{execName}</div>
                          {execImg ? (
                            <div className="h-9 flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded">
                              <img src={execImg} alt="امضا" className="max-h-8 max-w-full object-contain" />
                            </div>
                          ) : (
                            <div className="h-9 flex items-center justify-center text-[9px] text-slate-400 font-mono border border-dashed border-slate-200 rounded">
                              امضا شده ✓
                            </div>
                          )}
                          <div className="text-[8.5px] text-emerald-700 font-mono text-left" dir="ltr">
                            {execTier?.persianTimestamp || 'تأیید اصالت تحویل کار'}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Role 2: Area Supervisor */}
                    {(() => {
                      const areaTier = permit.closureDetails?.signatures?.areaSupervisor;
                      const areaName = areaTier?.name || permit.responsibles?.unitSupervisor || '-';
                      const areaTime = areaTier?.time || permit.endHour || '16:05';
                      const areaImg = areaTier?.signatureImage;
                      return (
                        <div className="border border-slate-300 p-2 rounded-lg bg-white shadow-2xs space-y-1">
                          <div className="font-bold text-slate-800 text-[10px] pb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>۲. تحویل‌گیرنده (مسئول محوطه):</span>
                            <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[9px]">
                              ساعت: {areaTime}
                            </span>
                          </div>
                          <div className="text-slate-900 font-bold truncate text-[10px]">{areaName}</div>
                          {areaImg ? (
                            <div className="h-9 flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded">
                              <img src={areaImg} alt="امضا" className="max-h-8 max-w-full object-contain" />
                            </div>
                          ) : (
                            <div className="h-9 flex items-center justify-center text-[9px] text-slate-400 font-mono border border-dashed border-slate-200 rounded">
                              امضا شده ✓
                            </div>
                          )}
                          <div className="text-[8.5px] text-emerald-700 font-mono text-left" dir="ltr">
                            {areaTier?.persianTimestamp || 'تأیید تحویل محوطه'}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  10. OFFICIAL FOOTER: Copy Distribution & Digital Hologram / QR
                 ------------------------------------------------------------- */}
              <div className="p-2.5 space-y-2 text-[9.5px] leading-tight bg-slate-50">
                <div className="text-slate-700">
                  * این پروانه کار فقط توسط اشخاص مجاز و دارای صلاحیت صادر خواهد شد و به هیچ نحو مسئولیت سرپرست واحد بهره‌برداری و مجری کار در مورد اجرای صحیح و رعایت کامل دستورالعمل‌های HSE را سلب نخواهد کرد.
                </div>
                <div className="flex flex-wrap items-center justify-between font-bold pt-1.5 border-t border-slate-300 text-slate-800">
                  <span>توزیع نسخ: نسخه اول (سفید) مجری کار، نسخه دوم (زرد) مسئول محوطه، نسخه سوم (سبز) واحد ایمنی HSE.</span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-slate-700">FORM CODE: RHS-PTW-F00 Rev.03</span>
                    <span className="font-mono text-blue-900 font-bold">DIGITAL-ID: {permit.id || 'PTW-2026'}</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PermitMasterPrintModal;

import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Activity,
  User,
  Heart,
  FileText,
  ShieldCheck,
  Stethoscope,
  Info
} from 'lucide-react';
import { useSystemBranding } from '../../../../utils/systemBrandingHelper';
import { HseLogo } from '../../../../components/HseLogo';
import { LAB_DEFS } from './seedData';
import { printService } from '../../../../services/printService';

interface Props {
  person: any;
  exams: any[];
  toNum: (v: any) => number | null;
  labStatus: (key: string, val: number | null) => any;
  onClose: () => void;
}

export const PersonCompareHealthCardPrintModal: React.FC<Props> = ({
  person,
  exams,
  toNum,
  labStatus,
  onClose
}) => {
  const { branding } = useSystemBranding();
  const [colorTheme, setColorTheme] = useState<'color' | 'mono'>('color');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showPdfHint, setShowPdfHint] = useState<boolean>(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const isMono = colorTheme === 'mono';
  const orgTitleFa = branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)';
  const logoUrl = branding.logoUrl;

  // Sort exams chronologically or by year
  const sortedExams = [...exams].sort((a, b) => {
    const yA = parseInt(a.exam_year || '0', 10);
    const yB = parseInt(b.exam_year || '0', 10);
    return yA - yB;
  });

  const latestExam = sortedExams[sortedExams.length - 1] || person || {};
  const firstExam = sortedExams[0] || latestExam;

  // Calculate trends for BMI & Blood Pressure
  const firstBmi = toNum(firstExam.bmi);
  const latestBmi = toNum(latestExam.bmi);
  const bmiDelta = firstBmi && latestBmi && sortedExams.length > 1 ? +(latestBmi - firstBmi).toFixed(1) : null;

  const firstSys = toNum(firstExam.bp_sys);
  const latestSys = toNum(latestExam.bp_sys);
  const sysDelta = firstSys && latestSys && sortedExams.length > 1 ? latestSys - firstSys : null;

  const getStatusBadge = (st: string) => {
    if (isMono) {
      if (st === 'danger') return <span className="font-mono font-bold text-[9px] text-black">⚠️ غیرنرمال</span>;
      if (st === 'warning') return <span className="font-mono font-bold text-[9px] text-black">⚡ هشدار</span>;
      if (st === 'normal') return <span className="font-mono text-[9px] text-slate-700">نرمال</span>;
      return null;
    }
    if (st === 'danger') {
      return (
        <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300 print:border-black print:text-black print:bg-slate-100">
          غیرنرمال
        </span>
      );
    }
    if (st === 'warning') {
      return (
        <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300 print:border-black print:text-black print:bg-slate-100">
          هشدار
        </span>
      );
    }
    if (st === 'normal') {
      return (
        <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 print:border-black print:text-black print:bg-slate-100">
          طبیعی
        </span>
      );
    }
    return null;
  };

  const todayShamsi = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const handlePrint = () => {
    if (printContainerRef.current) {
      printService.printElement(printContainerRef.current, {
        title: `کارنامه سلامت و مقایسه ادواری معاینات طب کار - ${person.fname || ''} ${person.lname || ''} - کد ملی ${person.nid || ''}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: person.nid,
        documentDate: todayShamsi,
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

  return (
    <div
      id="person-compare-health-card-print-modal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden font-sans text-slate-900"
      dir="rtl"
    >
      {/* =========================================================================
          TOP CONTROL BAR (Hidden during print)
         ========================================================================= */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg print:hidden">
        {/* Left Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-black text-white">
                کارنامه جامع سلامت شغلی و پایش روند مقایسه‌ای سنواتی (Health Report Card)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {sortedExams.length} دوره ارزیابی
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              شاغل: <strong>{person.fname} {person.lname}</strong> · کد ملی: <span className="font-mono">{person.nid || '—'}</span> · شرکت: {person.company || '—'}
            </p>
          </div>
        </div>

        {/* Center: Theme Selector */}
        <div className="flex items-center gap-2 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setColorTheme('mono')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              colorTheme === 'mono'
                ? 'bg-slate-600 text-white shadow font-black ring-1 ring-white/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="فرمت تک‌رنگ رسمی سیاه و سفید مناسب بایگانی اداری"
          >
            <div className="w-3 h-3 rounded-full bg-slate-200 border border-black" />
            <span>سیاه و سفید (بایگانی)</span>
          </button>

          <button
            type="button"
            onClick={() => setColorTheme('color')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              colorTheme === 'color'
                ? 'bg-indigo-600 text-white shadow font-black ring-1 ring-indigo-300/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="فرمت رنگی استاندارد سازمانی با هایلایت شاخص‌های سلامت"
          >
            <div className="w-3 h-3 rounded-full bg-indigo-400" />
            <span>رنگی سازمانی</span>
          </button>
        </div>

        {/* Right: Actions */}
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

          {/* PDF Download Button */}
          <button
            type="button"
            onClick={handleSavePdf}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
            title="ذخیره کارنامه در قالب فایل PDF"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">ذخیره PDF</span>
          </button>

          {/* Master Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/30 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ کارنامه سلامت</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* PDF Toast Guide */}
      {showPdfHint && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md print:hidden animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              💡 راهنمای ذخیره PDF: در پنجره چاپ مرورگر، مقصد را روی <strong>«Save as PDF / ذخیره به صورت PDF»</strong> و اندازه کاغذ را روی <strong>A4</strong> تنظیم فرمایید.
            </span>
          </div>
          <button
            onClick={() => setShowPdfHint(false)}
            className="px-2 py-0.5 bg-indigo-700 text-white rounded text-[10px] hover:bg-indigo-800"
          >
            متوجه شدم
          </button>
        </div>
      )}

      {/* =========================================================================
          PRINTABLE DOCUMENT CANVAS (A4 Portrait Layout)
         ========================================================================= */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-200/90 dark:bg-slate-950 flex justify-center custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
        <div
          ref={printContainerRef}
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: '210mm',
            minHeight: '297mm'
          }}
          className={`bg-white text-slate-900 shadow-2xl p-4 sm:p-5 print:p-0 print:my-0 print:shadow-none print:w-full print:max-w-none flex flex-col justify-between ${
            isMono ? 'grayscale-print-theme' : ''
          }`}
        >
          <div>
            {/* =====================================================================
                1. FORMAL ISO / HSE 3-SECTION HEADER
               ===================================================================== */}
            <div className="border-2 border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className="grid grid-cols-12 text-center items-center">
                {/* Logo Column */}
                <div className="col-span-3 border-l-2 border-slate-900 p-1.5 flex items-center justify-center min-h-[56px] bg-white">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="آرم سازمان"
                      className="max-h-12 max-w-full object-contain select-none"
                      style={{
                        height: `${branding.logoHeightPrintMm || 13}mm`,
                        imageRendering: 'auto'
                      }}
                    />
                  ) : (
                    <HseLogo size="sm" forceDefault={true} showShadow={false} />
                  )}
                </div>

                {/* Title Column */}
                <div className={`col-span-6 border-l-2 border-slate-900 p-1.5 flex flex-col items-center justify-center ${isMono ? 'bg-slate-100' : 'bg-indigo-50/70'}`}>
                  <div className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    {orgTitleFa}
                  </div>
                  <div className="text-[11px] font-black text-indigo-950 mt-0.5 leading-tight">
                    مدیریت بهداشت، ایمنی و محیط زیست (HSE) · واحد سلامت کار
                  </div>
                  <div className="text-xs font-black text-slate-900 mt-1 border-t border-slate-300 pt-0.5 w-full leading-tight">
                    کارنامه جامع سلامت شغلی و پایش روند سنواتی شاخص‌های تندرستی
                  </div>
                </div>

                {/* Document Info Column */}
                <div className="col-span-3 p-1.5 text-right text-[9.5px] space-y-0.5 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-600">کد سند:</span>
                    <span className="font-mono font-black text-[10px] text-slate-900" dir="ltr">HSE-FO-MED-002</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-600">شماره ویرایش:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">02</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-600">تاریخ صدور:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">{todayShamsi}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">طبقه‌بندی:</span>
                    <span className="font-bold text-[8.5px] text-indigo-900 bg-indigo-50 px-1 rounded border border-indigo-200">
                      محرمانه پزشکی
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================================
                2. EMPLOYEE MASTER DETAILS
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-indigo-900 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>۱. مشخصات هویتی و سوابق پرونده پرسنل</span>
                </div>
                <div className="text-[10px] opacity-90">
                  <span>دوره‌های ثبت‌شده: {sortedExams.length} دوره ({sortedExams.map(e => e.exam_year).join('، ')})</span>
                </div>
              </div>

              <div className="p-2 bg-white grid grid-cols-12 gap-x-2 gap-y-1 text-xs">
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">نام و نام خانوادگی:</span>
                  <strong className="text-slate-900 text-xs font-black truncate">{person.fname || '—'} {person.lname || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">کد ملی:</span>
                  <strong className="font-mono font-black text-slate-900 text-xs truncate" dir="ltr">{person.nid || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">شماره پرسنلی:</span>
                  <strong className="font-mono font-bold text-slate-900 text-xs truncate" dir="ltr">{person.pcode || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">شرکت / پیمانکار:</span>
                  <strong className="text-slate-900 text-xs truncate font-bold">{person.company || '—'}</strong>
                </div>

                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">سن:</span>
                  <strong className="text-slate-900 text-xs">{latestExam.age || person.age ? `${latestExam.age || person.age} سال` : '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">جنسیت:</span>
                  <strong className="text-slate-900 text-xs">{person.gender || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">وضعیت تأهل:</span>
                  <strong className="text-slate-900 text-xs">{person.marital || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">آخرین ارزیابی:</span>
                  <strong className="font-mono font-bold text-slate-900 text-xs truncate" dir="ltr">{latestExam.exam_date || '—'}</strong>
                </div>
              </div>
            </div>

            {/* =====================================================================
                3. EXECUTIVE SUMMARY OF HEALTH PROGRESSION (KPIS & DELTA)
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-slate-800 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>۲. چکیده تحلیلی و روند تغییرات شاخص‌های بیومتریک و بالینی</span>
                </div>
              </div>

              <div className="grid grid-cols-12 divide-x divide-x-reverse divide-slate-300 text-xs text-center">
                {/* BMI Delta */}
                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">شاخص توده بدنی (BMI)</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <strong className="font-mono font-black text-xs text-slate-900" dir="ltr">{latestExam.bmi || '—'}</strong>
                    {bmiDelta !== null && (
                      <span dir="ltr" className={`text-[9.5px] font-mono font-bold px-1 rounded ${bmiDelta > 0 ? 'text-amber-800 bg-amber-50' : bmiDelta < 0 ? 'text-emerald-800 bg-emerald-50' : 'text-slate-600'}`}>
                        {bmiDelta > 0 ? `+${bmiDelta}` : `${bmiDelta}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* BP Delta */}
                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">فشار خون سیستولیک/دیاستولیک</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <strong className="font-mono font-black text-xs text-slate-900" dir="ltr">
                      {latestExam.bp_sys || '—'} / {latestExam.bp_dia || '—'}
                    </strong>
                    {sysDelta !== null && (
                      <span dir="ltr" className={`text-[9.5px] font-mono font-bold px-1 rounded ${sysDelta > 0 ? 'text-rose-800 bg-rose-50' : sysDelta < 0 ? 'text-emerald-800 bg-emerald-50' : 'text-slate-600'}`}>
                        {sysDelta > 0 ? `+${sysDelta}` : `${sysDelta}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fasting Blood Sugar */}
                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">قند خون ناشتا (FBS)</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <strong className="font-mono font-black text-xs text-slate-900" dir="ltr">{latestExam.fbs || '—'}</strong>
                    <span className="text-[8.5px] text-slate-500">mg/dL</span>
                    {latestExam.fbs && getStatusBadge(labStatus('fbs', toNum(latestExam.fbs)))}
                  </div>
                </div>

                {/* Cardiovascular Risk */}
                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">خطرسنجی رویداد قلبی‌عروقی</span>
                  <strong className="text-xs font-bold text-slate-900 mt-0.5 truncate px-1">
                    {latestExam.cv_risk || 'خطر کم (Low Risk)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* =====================================================================
                4. COMPREHENSIVE MULTI-YEAR COMPARISON MATRIX
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-indigo-900 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>۳. ماتریس مقایسه‌ای سنواتی کلیه شاخص‌های بیومتریک، آزمایشگاهی و پاراکلینیک</span>
                </div>
                <span className="text-[9.5px] font-normal opacity-90">
                  بررسی تطبیقی سیر تغییرات در ادوار معاینات
                </span>
              </div>

              <div className="w-full">
                <table className="w-full text-xs text-right border-collapse table-fixed">
                  <thead className="bg-slate-100 border-b border-slate-300 font-black text-[10px]">
                    <tr>
                      <th className="p-1 border-l border-slate-300 w-[30%]">شاخص پزشکی / بالینی</th>
                      <th className="p-1 border-l border-slate-300 text-center w-[12%]">دامنه مرجع</th>
                      {sortedExams.map(e => (
                        <th key={e.exam_year} className="p-1 border-l border-slate-300 text-center font-mono font-black">
                          سال {e.exam_year}
                        </th>
                      ))}
                      {sortedExams.length > 1 && (
                        <th className="p-1 text-center w-[12%]">وضعیت روند</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[10px]">
                    {/* Category 1: Biometrics */}
                    <tr className="bg-slate-100/80 font-bold text-[9.5px] text-slate-800">
                      <td colSpan={2 + sortedExams.length + (sortedExams.length > 1 ? 1 : 0)} className="px-2 py-0.5">
                        • شاخص‌های فیزیکی و علائم حیاتی (Anthropometrics & Hemodynamics)
                      </td>
                    </tr>

                    {[
                      { key: 'weight', label: 'وزن (Weight)', unit: 'kg', ref: '—' },
                      { key: 'height', label: 'قد (Height)', unit: 'cm', ref: '—' },
                      { key: 'bmi', label: 'شاخص توده بدنی (BMI)', unit: 'kg/m²', ref: '18.5 - 24.9' },
                      { key: 'bp_sys', label: 'فشار خون سیستولیک', unit: 'mmHg', ref: '< 130' },
                      { key: 'bp_dia', label: 'فشار خون دیاستولیک', unit: 'mmHg', ref: '< 85' }
                    ].map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-1 font-bold text-slate-800 border-l border-slate-200 truncate">
                          {item.label} <span className="text-[8.5px] text-slate-400 font-normal">({item.unit})</span>
                        </td>
                        <td className="p-1 text-center font-mono text-[9.5px] text-slate-600 border-l border-slate-200" dir="ltr">
                          {item.ref}
                        </td>
                        {sortedExams.map(e => {
                          const val = toNum(e[item.key]);
                          const st = labStatus(item.key, val);
                          return (
                            <td key={e.exam_year} className="p-1 text-center font-mono font-bold text-slate-900 border-l border-slate-200" dir="ltr">
                              {val !== null ? (
                                <div className="flex items-center justify-center gap-1">
                                  <span>{val}</span>
                                  {getStatusBadge(st)}
                                </div>
                              ) : (e[item.key] || '—')}
                            </td>
                          );
                        })}
                        {sortedExams.length > 1 && (
                          <td className="p-1 text-center font-mono text-[9.5px] font-bold">
                            {(() => {
                              const vFirst = toNum(firstExam[item.key]);
                              const vLast = toNum(latestExam[item.key]);
                              if (vFirst === null || vLast === null) return '—';
                              const diff = +(vLast - vFirst).toFixed(1);
                              if (diff > 0) return <span className="text-amber-800" dir="ltr">▲ +{diff}</span>;
                              if (diff < 0) return <span className="text-emerald-800" dir="ltr">▼ {diff}</span>;
                              return <span className="text-slate-500">ثابت</span>;
                            })()}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Category 2: Paraclinical Biochemistry & Lipids */}
                    <tr className="bg-slate-100/80 font-bold text-[9.5px] text-slate-800">
                      <td colSpan={2 + sortedExams.length + (sortedExams.length > 1 ? 1 : 0)} className="px-2 py-0.5">
                        • آزمایش‌های بیوشیمی، قند، چربی و عملکرد ارگان‌ها (Biochemistry & Organ Panels)
                      </td>
                    </tr>

                    {[
                      { key: 'fbs', label: 'قند خون ناشتا (FBS)', unit: 'mg/dL', ref: '70 - 100' },
                      { key: 'chol', label: 'کلسترول توتال (CHOL)', unit: 'mg/dL', ref: '< 200' },
                      { key: 'tg', label: 'تری‌گلیسیرید (TG)', unit: 'mg/dL', ref: '< 150' },
                      { key: 'hdl', label: 'چربی محافظ (HDL)', unit: 'mg/dL', ref: '> 40' },
                      { key: 'ldl', label: 'چربی مضر (LDL)', unit: 'mg/dL', ref: '< 130' },
                      { key: 'bun', label: 'اوره خون (BUN)', unit: 'mg/dL', ref: '7 - 20' },
                      { key: 'creat', label: 'کراتینین (Creat)', unit: 'mg/dL', ref: '0.5 - 1.3' },
                      { key: 'ast', label: 'آنزیم کبدی AST', unit: 'U/L', ref: '< 40' },
                      { key: 'alt', label: 'آنزیم کبدی ALT', unit: 'U/L', ref: '< 41' },
                      { key: 'hb', label: 'هموگلوبین (Hb)', unit: 'g/dL', ref: '12 - 17.5' },
                      { key: 'wbc', label: 'گلبول سفید (WBC)', unit: '/µL', ref: '4k - 11k' },
                      { key: 'plt', label: 'پلاکت خون (Plt)', unit: '/µL', ref: '150k - 450k' }
                    ].map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-1 font-bold text-slate-800 border-l border-slate-200 truncate">
                          {item.label}
                        </td>
                        <td className="p-1 text-center font-mono text-[9.5px] text-slate-600 border-l border-slate-200" dir="ltr">
                          {item.ref}
                        </td>
                        {sortedExams.map(e => {
                          const val = toNum(e[item.key]);
                          const st = labStatus(item.key, val);
                          return (
                            <td key={e.exam_year} className="p-1 text-center font-mono font-bold text-slate-900 border-l border-slate-200" dir="ltr">
                              {val !== null ? (
                                <div className="flex items-center justify-center gap-1">
                                  <span>{val}</span>
                                  {getStatusBadge(st)}
                                </div>
                              ) : (e[item.key] || '—')}
                            </td>
                          );
                        })}
                        {sortedExams.length > 1 && (
                          <td className="p-1 text-center font-mono text-[9.5px] font-bold">
                            {(() => {
                              const vFirst = toNum(firstExam[item.key]);
                              const vLast = toNum(latestExam[item.key]);
                              if (vFirst === null || vLast === null) return '—';
                              const diff = +(vLast - vFirst).toFixed(1);
                              if (diff > 0) return <span className="text-amber-800" dir="ltr">▲ +{diff}</span>;
                              if (diff < 0) return <span className="text-emerald-800" dir="ltr">▼ {diff}</span>;
                              return <span className="text-slate-500">ثابت</span>;
                            })()}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Category 3: Sensory & Diagnostic Tests */}
                    <tr className="bg-slate-100/80 font-bold text-[9.5px] text-slate-800">
                      <td colSpan={2 + sortedExams.length + (sortedExams.length > 1 ? 1 : 0)} className="px-2 py-0.5">
                        • معاینات حسی، ریوی، قلبی و تصمیم نهایی طب کار (Specialized & Fitness Decisions)
                      </td>
                    </tr>

                    {[
                      { key: 'audio_r', label: 'شنوایی گوش راست (Right Audio)', ref: 'Normal' },
                      { key: 'audio_l', label: 'شنوایی گوش چپ (Left Audio)', ref: 'Normal' },
                      { key: 'spiro_result', label: 'تست تنفس ریه (Spirometry)', ref: 'Normal' },
                      { key: 'ecg', label: 'نوار قلب (ECG Findings)', ref: 'Normal' },
                      { key: 'final_opinion', label: 'نظریه صلاحیت طب کار (Fitness Decision)', ref: 'بلامانع' }
                    ].map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-1 font-bold text-slate-800 border-l border-slate-200 truncate">
                          {item.label}
                        </td>
                        <td className="p-1 text-center font-mono text-[9.5px] text-slate-600 border-l border-slate-200" dir="ltr">
                          {item.ref}
                        </td>
                        {sortedExams.map(e => {
                          const val = e[item.key] || '—';
                          const isFit = String(val).includes('بلامانع');
                          const isCond = String(val).includes('مشروط');
                          return (
                            <td key={e.exam_year} className="p-1 text-center text-[10px] font-bold border-l border-slate-200">
                              {item.key === 'final_opinion' ? (
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${isFit ? 'bg-emerald-100 text-emerald-900' : isCond ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800'}`}>
                                  {val}
                                </span>
                              ) : (
                                <span className="text-slate-900">{val}</span>
                              )}
                            </td>
                          );
                        })}
                        {sortedExams.length > 1 && (
                          <td className="p-1 text-center text-[9.5px] text-slate-500">
                            {item.key === 'final_opinion' ? 'پایش مداوم' : 'بررسی شد'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* =====================================================================
                5. LONGITUDINAL HEALTH ASSESSMENT & MEDICAL ADVICE
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-indigo-900 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>۴. جمع‌بندی روند سلامت شاغل و توصیه‌های مراقبتی پزشک طب کار</span>
                </div>
              </div>

              <div className="p-2 bg-white space-y-1.5 text-xs">
                {latestExam.final_conditions && (
                  <div className="p-1.5 rounded bg-amber-50/70 border border-amber-300 print:border-black print:bg-slate-50">
                    <span className="font-black text-amber-950 block text-[10px] mb-0.5">
                      محدودیت‌ها و شروط کار تعیین‌شده:
                    </span>
                    <p className="text-slate-800 text-[10px] leading-relaxed">
                      {latestExam.final_conditions}
                    </p>
                  </div>
                )}

                {latestExam.final_advice ? (
                  <div className="p-1.5 rounded bg-indigo-50/60 border border-indigo-200 print:border-black print:bg-slate-50">
                    <span className="font-black text-indigo-950 block text-[10px] mb-0.5">
                      توصیه‌های پیشگیرانه و سبک زندگی سلامت:
                    </span>
                    <p className="text-slate-800 text-[10px] leading-relaxed whitespace-pre-line">
                      {latestExam.final_advice.replace(/\|/g, '\n')}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-600 text-[10px]">
                    پایش سنواتی نشان‌دهنده پایداری شاخص‌های سلامت است. رعایت اصول ارگونومی، فعالیت بدنی منظم و شرکت در معاینات دوره‌ای سالانه توصیه می‌گردد.
                  </p>
                )}
              </div>
            </div>

            {/* =====================================================================
                6. OFFICIAL VALIDATION & SIGNATURE BOXES
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-1.5 print-exact print-break-inside-avoid">
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-900 text-center text-xs">
                <div className="p-1.5 min-h-[52px] flex flex-col justify-between bg-white">
                  <span className="font-bold text-slate-700 text-[10px]">
                    مهر و امضای پزشک متخصص طب کار
                  </span>
                  <div className="text-[9px] text-slate-400 italic">
                    {latestExam.final_doctor || 'دکتر متخصص طب کار'}
                  </div>
                </div>

                <div className="p-1.5 min-h-[52px] flex flex-col justify-between bg-white">
                  <span className="font-bold text-slate-700 text-[10px]">
                    تأییدیه واحد بهداشت و ایمنی (HSE)
                  </span>
                  <div className="text-[9px] text-slate-400 italic">
                    امضا و مهر کارشناس HSE
                  </div>
                </div>

                <div className="p-1.5 min-h-[52px] flex flex-col justify-between bg-white">
                  <span className="font-bold text-slate-700 text-[10px]">
                    رویت و امضای شاغل
                  </span>
                  <div className="text-[9px] text-slate-400 italic">
                    {person.fname} {person.lname}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              7. FOOTER & PAGINATION
             ===================================================================== */}
          <div className="flex items-center justify-between text-[8.5px] text-slate-500 pt-1 border-t border-slate-300 font-sans print-break-inside-avoid mt-1">
            <div>
              کارنامه سلامت شغلی · سامانه مدیریت یکپارچه بهداشت، ایمنی و محیط زیست (HSE MS)
            </div>
            <div className="font-mono">
              صفحه ۱ از ۱
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PersonCompareHealthCardPrintModal;

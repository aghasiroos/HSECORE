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
  Heart,
  Activity,
  FileText,
  User,
  Building2,
  Calendar,
  ShieldCheck,
  Stethoscope,
  Info
} from 'lucide-react';
import { useSystemBranding } from '../../../../utils/systemBrandingHelper';
import { HseLogo } from '../../../../components/HseLogo';
import { LAB_DEFS, BMI_CATS } from './seedData';
import { printService } from '../../../../services/printService';

interface Props {
  person: any;
  activeExam: any;
  allExamsForPerson: any[];
  selectedYear: string;
  toNum: (v: any) => number | null;
  splitMulti: (v: any) => string[];
  labStatus: (key: string, val: number | null) => any;
  onClose: () => void;
}

export const PersonnelDossierPrintModal: React.FC<Props> = ({
  person,
  activeExam,
  allExamsForPerson,
  selectedYear,
  toNum,
  splitMulti,
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

  const data = activeExam || person || {};
  const examYearLabel = data.exam_year || (selectedYear !== 'all' ? selectedYear : '۱۴۰۳');

  // Parse hazards
  const hazards = [
    ...(data.haz_phys ? splitMulti(data.haz_phys) : []),
    ...(data.haz_chem ? splitMulti(data.haz_chem) : []),
    ...(data.haz_bio ? splitMulti(data.haz_bio) : []),
    ...(data.haz_ergo ? splitMulti(data.haz_ergo) : []),
    ...(data.haz_psych ? splitMulti(data.haz_psych) : []),
    ...(data.haz_other ? splitMulti(data.haz_other) : [])
  ];

  // Helper for status badge rendering in print
  const getStatusBadge = (st: string) => {
    if (isMono) {
      if (st === 'danger') return <span className="font-mono font-bold text-[10px] text-black">⚠️ غیرنرمال (خطر)</span>;
      if (st === 'warning') return <span className="font-mono font-bold text-[10px] text-black">⚡ هشدار</span>;
      if (st === 'normal') return <span className="font-mono text-[10px] text-slate-700">نرمال</span>;
      return null;
    }
    if (st === 'danger') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300 print:border-black print:text-black print:bg-slate-100">
          غیرنرمال
        </span>
      );
    }
    if (st === 'warning') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300 print:border-black print:text-black print:bg-slate-100">
          هشدار
        </span>
      );
    }
    if (st === 'normal') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 print:border-black print:text-black print:bg-slate-100">
          طبیعی
        </span>
      );
    }
    return null;
  };

  const getOpinionBadge = (opinion: string) => {
    const op = String(opinion || '').trim();
    if (isMono) {
      return (
        <span className="px-3 py-1 text-xs font-black border-2 border-black rounded-md">
          نظریه نهایی: {op || 'نامشخص'}
        </span>
      );
    }
    if (op.includes('بلامانع')) {
      return (
        <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-400 font-black text-xs">
          ✅ سلامت کامل / بلامانع
        </span>
      );
    }
    if (op.includes('مشروط')) {
      return (
        <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-400 font-black text-xs">
          ⚠️ اشتغال مشروط با رعایت الزامات
        </span>
      );
    }
    if (op.includes('عدم صلاحیت')) {
      return (
        <span className="px-3 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-400 font-black text-xs">
          ⛔ عدم صلاحیت اشتغال در شغل فعلی
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs">
        {op || 'ثبت نشده'}
      </span>
    );
  };

  const todayShamsi = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const handlePrint = () => {
    if (printContainerRef.current) {
      printService.printElement(printContainerRef.current, {
        title: `شناسنامه و پرونده معاینات طب کار - ${data.name || person?.name || ''} - کد ${data.personnel_code || person?.personnel_code || ''}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: data.personnel_code || person?.personnel_code,
        documentDate: data.exam_date || todayShamsi,
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
      id="personnel-dossier-print-modal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden font-sans text-slate-900"
      dir="rtl"
    >
      {/* =========================================================================
          TOP CONTROL BAR (Hidden during print)
         ========================================================================= */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg print:hidden">
        {/* Left Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-600 text-white rounded-xl shadow-md">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-black text-white">
                نسخه رسمی و استاندارد پرونده سلامت پرسنل (Occupational Health Record)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                سال {examYearLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              پرسنل: <strong>{data.fname} {data.lname}</strong> · کد ملی: <span className="font-mono">{data.nid || '—'}</span> · شرکت: {data.company || '—'}
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
            title="فرمت رسمی تک‌رنگ و سیاه و سفید مناسب بایگانی اداری و چاپگرهای لیزری"
          >
            <div className="w-3 h-3 rounded-full bg-slate-200 border border-black" />
            <span>سیاه و سفید (بایگانی)</span>
          </button>

          <button
            type="button"
            onClick={() => setColorTheme('color')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              colorTheme === 'color'
                ? 'bg-teal-600 text-white shadow font-black ring-1 ring-teal-300/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="فرمت رنگی استاندارد با تفکیک رنگی شاخص‌های سلامت و نشان رسمی سازمان"
          >
            <div className="w-3 h-3 rounded-full bg-teal-400" />
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
            title="ذخیره سند در قالب فایل PDF استاندارد"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span className="hidden md:inline">ذخیره PDF</span>
          </button>

          {/* Master Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-500/30 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ پرونده</span>
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
        <div className="bg-teal-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md print:hidden animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              💡 راهنمای ذخیره PDF: در پنجره چاپ مرورگر، مقصد (Destination) را روی <strong>«Save as PDF / ذخیره به صورت PDF»</strong> و اندازه کاغذ را روی <strong>A4</strong> تنظیم فرمایید.
            </span>
          </div>
          <button
            onClick={() => setShowPdfHint(false)}
            className="px-2 py-0.5 bg-teal-700 text-white rounded text-[10px] hover:bg-teal-800"
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
                <div className={`col-span-6 border-l-2 border-slate-900 p-1.5 flex flex-col items-center justify-center ${isMono ? 'bg-slate-100' : 'bg-teal-50/70'}`}>
                  <div className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    {orgTitleFa}
                  </div>
                  <div className="text-[11px] font-black text-teal-950 dark:text-teal-950 mt-0.5 leading-tight">
                    مدیریت بهداشت، ایمنی و محیط زیست (HSE) · واحد طب کار
                  </div>
                  <div className="text-xs font-black text-slate-900 mt-1 border-t border-slate-300 pt-0.5 w-full leading-tight">
                    پرونده رسمی معاینات سلامت شغلی و طب کار دوره {examYearLabel}
                  </div>
                </div>

                {/* Document Info Column */}
                <div className="col-span-3 p-1.5 text-right text-[9.5px] space-y-0.5 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-600">کد سند:</span>
                    <span className="font-mono font-black text-[10px] text-slate-900" dir="ltr">HSE-FO-MED-001</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-600">شماره ویرایش:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">02</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                    <span className="font-bold text-slate-600">تاریخ چاپ:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">{todayShamsi}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">طبقه‌بندی:</span>
                    <span className="font-bold text-[8.5px] text-rose-900 bg-rose-50 px-1 rounded border border-rose-200">
                      محرمانه پزشکی
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================================
                2. EMPLOYEE IDENTIFICATION BOX
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-teal-800 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>۱. مشخصات فردی و اطلاعات هویتی شاغل</span>
                </div>
                <div className="text-[10px] opacity-90 flex items-center gap-1">
                  <span>شناسه:</span>
                  <span dir="ltr" className="font-mono font-bold">{data.personnel_id || data.id || '—'}</span>
                </div>
              </div>

              <div className="p-2 bg-white grid grid-cols-12 gap-x-2 gap-y-1 text-xs">
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">نام و نام خانوادگی:</span>
                  <strong className="text-slate-900 text-xs font-black truncate">{data.fname || '—'} {data.lname || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">کد ملی:</span>
                  <strong className="font-mono font-black text-slate-900 text-xs truncate" dir="ltr">{data.nid || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">شماره پرسنلی:</span>
                  <strong className="font-mono font-bold text-slate-900 text-xs truncate" dir="ltr">{data.pcode || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">شرکت / پیمانکار:</span>
                  <strong className="text-slate-900 text-xs truncate font-bold">{data.company || '—'}</strong>
                </div>

                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">سن:</span>
                  <strong className="text-slate-900 text-xs">{data.age ? `${data.age} سال` : '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">جنسیت:</span>
                  <strong className="text-slate-900 text-xs">{data.gender || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">وضعیت تأهل:</span>
                  <strong className="text-slate-900 text-xs">{data.marital || '—'}</strong>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 font-bold text-[10.5px] shrink-0">تاریخ معاینه:</span>
                  <strong className="font-mono font-bold text-slate-900 text-xs truncate" dir="ltr">{data.exam_date || '—'}</strong>
                </div>
              </div>
            </div>

            {/* =====================================================================
                3. OCCUPATIONAL HAZARDS & EXPOSURES
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-slate-800 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>۲. عوامل زیان‌آور محیط کار و شرایط ارگونومیک (Occupational Hazards)</span>
                </div>
                {data.occ_health_opinion && (
                  <span className="text-[10px] opacity-90 truncate max-w-[280px]">نظر بهداشت حرفه‌ای: {data.occ_health_opinion}</span>
                )}
              </div>

              <div className="p-1.5 bg-slate-50/70 text-xs">
                {hazards.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {hazards.map((h, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-bold text-[10px] text-slate-800"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10.5px] text-slate-500 italic">عامل زیان‌آور بحرانی برای این عنوان شغلی ثبت نشده است.</span>
                )}
              </div>
            </div>

            {/* =====================================================================
                4. BIOMETRICS, VITALS & CLINICAL FINDINGS
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-teal-800 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>۳. معاینات بالینی، علائم حیاتی و شاخص‌های بیومتریک</span>
                </div>
              </div>

              <div className="grid grid-cols-12 divide-x divide-x-reverse divide-slate-300 text-xs text-center">
                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">قد و وزن</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5 text-slate-900" dir="ltr">
                    <span className="font-mono font-bold text-xs">{data.height || '—'} <span className="text-[9px] text-slate-500 font-normal">cm</span></span>
                    <span className="text-slate-300">/</span>
                    <span className="font-mono font-bold text-xs">{data.weight || '—'} <span className="text-[9px] text-slate-500 font-normal">kg</span></span>
                  </div>
                </div>

                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">شاخص توده بدنی (BMI)</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <strong className="font-mono font-black text-slate-900 text-xs" dir="ltr">{data.bmi || '—'}</strong>
                    {data.bmi && getStatusBadge(labStatus('bmi', toNum(data.bmi)))}
                  </div>
                </div>

                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">فشار خون (سیستولیک / دیاستولیک)</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5" dir="ltr">
                    <strong className="font-mono font-black text-slate-900 text-xs">
                      {data.bp_sys || '—'} / {data.bp_dia || '—'}
                    </strong>
                    <span className="text-[8.5px] text-slate-500 font-sans">mmHg</span>
                  </div>
                </div>

                <div className="col-span-3 p-1.5 bg-white flex flex-col justify-center">
                  <span className="text-[9.5px] text-slate-500 font-bold">خطرسنجی ۱۰ ساله قلبی عروقی</span>
                  <strong className="font-bold text-slate-900 text-xs mt-0.5 truncate px-1">
                    {data.cv_risk || 'بررسی شده / خطر کم'}
                  </strong>
                </div>
              </div>

              {data.exam_notes && (
                <div className="border-t border-slate-200 p-1.5 bg-slate-50 text-xs">
                  <span className="font-bold text-slate-700 text-[10px] block mb-0.5">شرح حال، سوابق پزشکی و نشانه‌های بالینی ثبت‌شده:</span>
                  <p className="text-slate-800 text-[10px] leading-relaxed whitespace-pre-line">
                    {data.exam_notes.replace(/\|/g, ' · ')}
                  </p>
                </div>
              )}
            </div>

            {/* =====================================================================
                5. PARACLINICAL & BIOCHEMICAL LABS (Standard 14-Param Grid)
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-slate-800 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>۴. نتایج آزمایشگاهی و تست‌های پاراکلینیک (Laboratory Tests)</span>
                </div>
                <span className="text-[9.5px] font-normal opacity-90">
                  قند خون، چربی‌ها، عملکرد کبد، کلیه و هماتولوژی
                </span>
              </div>

              <table className="w-full text-xs text-right border-collapse table-fixed">
                <thead className="bg-slate-100 border-b border-slate-300 font-black text-[10px]">
                  <tr>
                    <th className="p-1 border-l border-slate-200 w-[18%]">آزمایش</th>
                    <th className="p-1 border-l border-slate-200 text-center w-[9%]">مقدار</th>
                    <th className="p-1 border-l border-slate-200 text-center w-[7%]">واحد</th>
                    <th className="p-1 border-l border-slate-200 text-center w-[9%]">دامنه مرجع</th>
                    <th className="p-1 border-l-2 border-slate-300 text-center w-[7%]">وضعیت</th>
                    <th className="p-1 border-l border-slate-200 w-[18%]">آزمایش</th>
                    <th className="p-1 border-l border-slate-200 text-center w-[9%]">مقدار</th>
                    <th className="p-1 border-l border-slate-200 text-center w-[7%]">واحد</th>
                    <th className="p-1 border-l border-slate-200 text-center w-[9%]">دامنه مرجع</th>
                    <th className="p-1 text-center w-[7%]">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10px]">
                  {[
                    [
                      { key: 'fbs', label: 'FBS (قند ناشتا)', ref: '70 - 100' },
                      { key: 'chol', label: 'Cholesterol (کلسترول)', ref: '< 200' }
                    ],
                    [
                      { key: 'hba1c', label: 'HbA1C (قند ۳ ماهه)', ref: '< 5.7' },
                      { key: 'tg', label: 'Triglycerides (TG)', ref: '< 150' }
                    ],
                    [
                      { key: 'bun', label: 'BUN (اوره خون)', ref: '7 - 20' },
                      { key: 'hdl', label: 'HDL (چربی مفید)', ref: '> 40' }
                    ],
                    [
                      { key: 'creat', label: 'Creatinine (کراتینین)', ref: '0.5 - 1.3' },
                      { key: 'ldl', label: 'LDL (چربی مضر)', ref: '< 130' }
                    ],
                    [
                      { key: 'ast', label: 'AST (SGOT)', ref: '< 40' },
                      { key: 'hb', label: 'Hemoglobin (Hb)', ref: '12 - 17.5' }
                    ],
                    [
                      { key: 'alt', label: 'ALT (SGPT)', ref: '< 41' },
                      { key: 'wbc', label: 'WBC (گلبول سفید)', ref: '4k - 11k' }
                    ],
                    [
                      { key: 'alp', label: 'ALP (فسفاتاز قلیایی)', ref: '64 - 306' },
                      { key: 'plt', label: 'Platelet (پلاکت)', ref: '150k - 450k' }
                    ]
                  ].map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {row.map((item, cIdx) => {
                        const val = toNum(data[item.key]);
                        const def = LAB_DEFS[item.key] || { unit: '—' };
                        const st = labStatus(item.key, val);
                        return (
                          <React.Fragment key={item.key}>
                            <td className="p-1 font-bold text-slate-800 border-l border-slate-200 truncate">
                              {item.label}
                            </td>
                            <td className="p-1 text-center font-mono font-bold text-slate-900 border-l border-slate-200" dir="ltr">
                              {val !== null ? val : (data[item.key] || '—')}
                            </td>
                            <td className="p-1 text-center text-slate-500 font-mono text-[9px] border-l border-slate-200" dir="ltr">
                              {def.unit}
                            </td>
                            <td className="p-1 text-center font-mono text-slate-600 text-[9px] border-l border-slate-200" dir="ltr">
                              {item.ref}
                            </td>
                            <td className={`p-1 text-center ${cIdx === 0 ? 'border-l-2 border-slate-300' : ''}`}>
                              {val !== null ? getStatusBadge(st) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Urinalysis & Screenings Bar */}
              <div className="bg-slate-50 border-t border-slate-300 p-1 text-[9.5px] grid grid-cols-6 divide-x divide-x-reverse divide-slate-200 text-center">
                <div className="px-0.5">
                  <span className="text-slate-500 font-bold block text-[8.5px]">Urine Prt</span>
                  <span className="font-mono font-bold text-slate-900 text-[9.5px]">{data.u_prt || 'Negative'}</span>
                </div>
                <div className="px-0.5">
                  <span className="text-slate-500 font-bold block text-[8.5px]">Urine Glu</span>
                  <span className="font-mono font-bold text-slate-900 text-[9.5px]">{data.u_glu || 'Negative'}</span>
                </div>
                <div className="px-0.5">
                  <span className="text-slate-500 font-bold block text-[8.5px]">Urine RBC</span>
                  <span className="font-mono font-bold text-slate-900 text-[9.5px]">{data.u_blood || data.u_rbc || 'Negative'}</span>
                </div>
                <div className="px-0.5">
                  <span className="text-slate-500 font-bold block text-[8.5px]">Urine WBC</span>
                  <span className="font-mono font-bold text-slate-900 text-[9.5px]">{data.u_wbc || '0-1'}</span>
                </div>
                <div className="px-0.5">
                  <span className="text-slate-500 font-bold block text-[8.5px]">Stool OB</span>
                  <span className="font-mono font-bold text-slate-900 text-[9.5px]">{data.stool_ob || 'Negative'}</span>
                </div>
                <div className="px-0.5">
                  <span className="text-slate-500 font-bold block text-[8.5px]">PSA (غربالگری)</span>
                  <span className="font-mono font-bold text-slate-900 text-[9.5px]" dir="ltr">{data.psa || '—'}</span>
                </div>
              </div>
            </div>

            {/* =====================================================================
                6. SPECIALIZED OCCUPATIONAL EXAMS (Vision, Hearing, Spiro, ECG)
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-teal-800 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>۵. ارزیابی اندام‌های حسی و تست‌های تخصصی طب کار</span>
                </div>
              </div>

              <div className="grid grid-cols-12 divide-x divide-x-reverse divide-slate-300 text-xs">
                {/* Optometry */}
                <div className="col-span-3 p-1.5 bg-white space-y-0.5">
                  <span className="font-bold text-slate-800 text-[10px] block border-b border-slate-200 pb-0.5">
                    👁️ بینایی‌سنجی (Optometry)
                  </span>
                  <div className="text-[9.5px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">دید دور راست/چپ:</span>
                      <span className="font-mono font-bold text-[9.5px]" dir="ltr">{data.vis_r_cor || data.vis_r_unc || '10/10'} / {data.vis_l_cor || data.vis_l_unc || '10/10'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">دید دوچشمی:</span>
                      <span className="font-mono font-bold text-[9.5px]" dir="ltr">{data.vis_both_cor || data.vis_both_unc || '10/10'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">عمق دید:</span>
                      <span className="font-mono font-bold text-[9.5px]" dir="ltr">{data.depth_perc || 'Normal'}</span>
                    </div>
                  </div>
                </div>

                {/* Audiometry */}
                <div className="col-span-3 p-1.5 bg-white space-y-0.5">
                  <span className="font-bold text-slate-800 text-[10px] block border-b border-slate-200 pb-0.5">
                    👂 شنوایی‌سنجی (Audiometry)
                  </span>
                  <div className="text-[9.5px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">گوش راست:</span>
                      <span className="font-bold text-slate-900 text-[9.5px]">{data.audio_r || 'Normal'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">گوش چپ:</span>
                      <span className="font-bold text-slate-900 text-[9.5px]">{data.audio_l || 'Normal'}</span>
                    </div>
                  </div>
                </div>

                {/* Spirometry */}
                <div className="col-span-3 p-1.5 bg-white space-y-0.5">
                  <span className="font-bold text-slate-800 text-[10px] block border-b border-slate-200 pb-0.5">
                    🌬️ اسپیرومتری ریه (Spirometry)
                  </span>
                  <div className="text-[9.5px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">نتیجه الگو:</span>
                      <span className="font-bold text-slate-900 text-[9.5px]">{data.spiro_result || 'Normal'}</span>
                    </div>
                    {data.spiro_notes && (
                      <div className="text-slate-600 text-[8.5px] truncate" title={data.spiro_notes}>
                        توضیح: {data.spiro_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* ECG & Mental Health */}
                <div className="col-span-3 p-1.5 bg-white space-y-0.5">
                  <span className="font-bold text-slate-800 text-[10px] block border-b border-slate-200 pb-0.5">
                    ❤️ نوار قلب و سلامت روان
                  </span>
                  <div className="text-[9.5px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">تفسیر ECG:</span>
                      <span className="font-bold text-slate-900 truncate text-[9.5px]" title={data.ecg}>{data.ecg || 'Normal'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[9px]">ارزیابی روان:</span>
                      <span className="font-bold text-slate-900 text-[9.5px]">{data.mmpi || 'مطلوب'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================================
                7. OCCUPATIONAL DISEASES, DIAGNOSES & SPECIALIST REFERRALS
               ===================================================================== */}
            {(data.dis_nonocc_known || data.dis_nonocc_new || data.dis_occ_known || data.dis_occ_new || data.ref1_type) && (
              <div className="border border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
                <div className={`px-2.5 py-0.5 text-xs font-black border-b border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-200 text-black' : 'bg-slate-800 text-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>۶. بیماری‌های تشخیص‌داده‌شده و ارجاعات تخصصی پزشکی</span>
                  </div>
                </div>
                <div className="p-1.5 bg-white text-xs space-y-1">
                  {(data.dis_nonocc_known || data.dis_nonocc_new) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-600 font-bold text-[10px] shrink-0">بیماری‌های غیرشغلی:</span>
                      <span className="font-bold text-slate-900 text-[10px]">
                        {[data.dis_nonocc_known, data.dis_nonocc_new].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  {(data.dis_occ_known || data.dis_occ_new) && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-rose-700 font-bold text-[10px] shrink-0">بیماری‌های ناشی از کار:</span>
                      <span className="font-bold text-rose-900 text-[10px]">
                        {[data.dis_occ_known, data.dis_occ_new].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  {data.ref1_type && (
                    <div className="flex items-center gap-2 pt-0.5 border-t border-slate-100">
                      <span className="text-slate-600 font-bold text-[10px]">ارجاع تخصصی ۱:</span>
                      <span className="font-bold text-slate-900 text-[10px]">{data.ref1_type} ({data.ref1_status || 'ثبت شده'})</span>
                      {data.ref2_type && (
                        <>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600 font-bold text-[10px]">ارجاع ۲:</span>
                          <span className="font-bold text-slate-900 text-[10px]">{data.ref2_type} ({data.ref2_status || 'ثبت شده'})</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =====================================================================
                8. FINAL OCCUPATIONAL HEALTH OPINION & DECISION
               ===================================================================== */}
            <div className="border-2 border-slate-900 rounded-md overflow-hidden mb-2 print-exact print-break-inside-avoid">
              <div className={`px-2.5 py-1 text-xs font-black border-b-2 border-slate-900 flex items-center justify-between ${isMono ? 'bg-slate-300 text-black' : 'bg-teal-900 text-white'}`}>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">۷. نظریه نهایی کمیسیون پزشکی و پزشک متخصص طب کار</span>
                </div>
                <div>{getOpinionBadge(data.final_opinion)}</div>
              </div>

              <div className="p-2 bg-white space-y-1.5 text-xs">
                {data.final_conditions && (
                  <div className="p-1.5 rounded bg-amber-50/80 border border-amber-300 print:border-black print:bg-slate-50">
                    <span className="font-black text-amber-950 block text-[10px] mb-0.5">
                      شروط کار، محدودیت‌ها و تعدیلات شغلی لازم:
                    </span>
                    <p className="text-slate-800 text-[10px] leading-relaxed">
                      {data.final_conditions}
                    </p>
                  </div>
                )}

                {data.final_advice && (
                  <div className="p-1.5 rounded bg-teal-50/60 border border-teal-200 print:border-black print:bg-slate-50">
                    <span className="font-black text-teal-950 block text-[10px] mb-0.5">
                      توصیه‌های پزشکی و بهداشتی به شاغل:
                    </span>
                    <p className="text-slate-800 text-[10px] leading-relaxed whitespace-pre-line">
                      {data.final_advice.replace(/\|/g, '\n')}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2 pt-1 border-t border-slate-200 text-[10px] items-center">
                  <div className="col-span-4 flex items-center gap-1 min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">پزشک معاینه‌کننده:</span>{' '}
                    <strong className="text-slate-900 font-black truncate">{data.final_doctor || '—'}</strong>
                  </div>
                  <div className="col-span-4 flex items-center gap-1 min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">اعتبار گواهی:</span>{' '}
                    <strong className="font-mono font-bold text-slate-900 truncate" dir="ltr">{data.final_valid_date || 'یکسال پس از معاینه'}</strong>
                  </div>
                  <div className="col-span-4 flex items-center gap-1 min-w-0">
                    <span className="text-slate-500 font-bold shrink-0">پیگیری دوره‌ای:</span>{' '}
                    <strong className="text-slate-900 font-bold truncate">{data.final_followup_needed || 'خیر'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================================
                9. OFFICIAL VERIFICATION, STAMPS & SIGNATURE BOXES
               ===================================================================== */}
            <div className="border border-slate-900 rounded-md overflow-hidden mb-1.5 print-exact print-break-inside-avoid">
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-900 text-center text-xs">
                <div className="p-1.5 min-h-[52px] flex flex-col justify-between bg-white">
                  <span className="font-bold text-slate-700 text-[10px]">
                    مهر و امضای پزشک متخصص طب کار
                  </span>
                  <div className="text-[9px] text-slate-400 italic">
                    {data.final_doctor || 'دکتر متخصص طب کار'}
                  </div>
                </div>

                <div className="p-1.5 min-h-[52px] flex flex-col justify-between bg-white">
                  <span className="font-bold text-slate-700 text-[10px]">
                    تأییدیه کارشناس بهداشت حرفه‌ای (HSE)
                  </span>
                  <div className="text-[9px] text-slate-400 italic">
                    امضا و مهر واحد HSE
                  </div>
                </div>

                <div className="p-1.5 min-h-[52px] flex flex-col justify-between bg-white">
                  <span className="font-bold text-slate-700 text-[10px]">
                    رویت و امضای شاغل / پرسنل
                  </span>
                  <div className="text-[9px] text-slate-400 italic">
                    {data.fname} {data.lname}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              10. FOOTER & PAGINATION
             ===================================================================== */}
          <div className="flex items-center justify-between text-[8.5px] text-slate-500 pt-1 border-t border-slate-300 font-sans print-break-inside-avoid mt-1">
            <div>
              سامانه جامع مدیریت بهداشت، ایمنی و محیط زیست (HSE MS) · نسخه چاپی معتبر و استاندارد
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

export default PersonnelDossierPrintModal;

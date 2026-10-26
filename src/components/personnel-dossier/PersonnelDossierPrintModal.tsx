import React, { useRef, useState, useMemo } from 'react';
import {
  Printer,
  Download,
  X,
  ShieldCheck,
  AlertTriangle,
  HardHat,
  GraduationCap,
  Heart,
  Award,
  FileText,
  UserCheck,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Check,
  CheckSquare,
  Send,
  ClipboardCheck,
  Building,
  Stamp
} from 'lucide-react';
import { ComprehensivePersonnelDossier } from '../../types/personnelDossierTypes';
import { printService } from '../../services/printService';
import { getSystemBrandingConfig } from '../../utils/systemBrandingHelper';
import { personnelDossierService } from '../../services/personnelDossierService';
import { HseLogo } from '../HseLogo';

interface PersonnelDossierPrintModalProps {
  dossier: ComprehensivePersonnelDossier;
  isFa: boolean;
  currentUser?: any;
  onClose: () => void;
  defaultSection?: string;
}

type DensityMode = 'auto' | 'spacious' | 'standard' | 'compact' | 'dense';

export default function PersonnelDossierPrintModal({
  dossier,
  isFa,
  currentUser,
  onClose,
  defaultSection = 'all'
}: PersonnelDossierPrintModalProps) {
  const [selectedSection, setSelectedSection] = useState<string>(defaultSection);
  const [densityMode, setDensityMode] = useState<DensityMode>('auto');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const branding = getSystemBrandingConfig();

  const p = dossier.personnel;
  const pCode = p.personnelCode || p.effectiveCode || '-';
  const fullName = p.fullName || `${p.firstName} ${p.lastName}`;
  const todayFa = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const nowTimeFa = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  const currentUserName = currentUser?.fullName || currentUser?.username || 'کاربر مجاز سامانه HSE';

  // Calculate total entries to determine intelligent dynamic density
  const totalEntriesCount = useMemo(() => {
    return (
      (dossier.medicalExams?.length || 0) +
      (dossier.occupationalRestrictions?.length || 0) +
      (dossier.trainingCourses?.length || 0) +
      (dossier.qualifications?.length || 0) +
      (dossier.workPermits?.length || 0) +
      (dossier.incidents?.length || 0) +
      (dossier.bbsObservations?.length || 0) +
      (dossier.riskAssessments?.length || 0) +
      (dossier.safetyInspections?.length || 0) +
      (dossier.healthEnvInspections?.length || 0) +
      (dossier.fiveSInspections?.length || 0) +
      (dossier.nonConformances?.length || 0) +
      (dossier.referrals?.length || 0) +
      (dossier.warnings?.length || 0) +
      (dossier.ppeIssuances?.length || 0)
    );
  }, [dossier]);

  // Computed density tier based on auto calculation or manual selection
  const effectiveDensity: 'spacious' | 'standard' | 'compact' | 'dense' = useMemo(() => {
    if (densityMode !== 'auto') return densityMode;
    if (selectedSection !== 'all') return 'standard';
    if (totalEntriesCount <= 6) return 'spacious';
    if (totalEntriesCount <= 16) return 'standard';
    if (totalEntriesCount <= 30) return 'compact';
    return 'dense';
  }, [densityMode, totalEntriesCount, selectedSection]);

  // Dynamic typography and spacing classes based on effective density
  const densityStyles = useMemo(() => {
    switch (effectiveDensity) {
      case 'spacious':
        return {
          baseText: 'text-[10pt] leading-normal',
          tableText: 'text-[9pt]',
          tablePadding: 'py-2 px-2.5',
          headerPadding: 'py-2 px-3',
          sectionSpacing: 'mb-4',
          cardPadding: 'p-3',
          kpiNumSize: 'text-base font-black',
        };
      case 'standard':
        return {
          baseText: 'text-[9.5pt] leading-normal',
          tableText: 'text-[8.5pt]',
          tablePadding: 'py-1.5 px-2',
          headerPadding: 'py-1.5 px-2.5',
          sectionSpacing: 'mb-3.5',
          cardPadding: 'p-2.5',
          kpiNumSize: 'text-sm font-black',
        };
      case 'compact':
        return {
          baseText: 'text-[9pt] leading-snug',
          tableText: 'text-[8pt]',
          tablePadding: 'py-1 px-1.5',
          headerPadding: 'py-1 px-2',
          sectionSpacing: 'mb-2.5',
          cardPadding: 'p-2',
          kpiNumSize: 'text-xs font-black',
        };
      case 'dense':
      default:
        return {
          baseText: 'text-[8.5pt] leading-tight',
          tableText: 'text-[7.5pt]',
          tablePadding: 'py-0.75 px-1.25',
          headerPadding: 'py-0.75 px-1.5',
          sectionSpacing: 'mb-2',
          cardPadding: 'p-1.5',
          kpiNumSize: 'text-xs font-black',
        };
    }
  }, [effectiveDensity]);

  const getSectionName = (sec: string) => {
    switch (sec) {
      case 'health': return 'طب کار، معاینات و محدودیت‌ها';
      case 'training': return 'آموزش و صلاحیت‌ها';
      case 'permits': return 'پروانه‌های کار ایمن (PTW)';
      case 'incidents': return 'حوادث، شبه‌حوادث و BBS';
      case 'risks': return 'ارزیابی‌های ریسک و بازرسی‌ها';
      case 'capa': return 'اقدامات اصلاحی و عدم انطباق‌ها (CAPA)';
      case 'referrals': return 'ارجاعات و امضاهای دیجیتال';
      case 'inspections': return 'بازرسی‌های بهداشت، محیط زیست و 5S';
      case 'warnings': return 'تذکرات و اخطارهای انضباطی';
      case 'ppe': return 'تجهیزات حفاظت فردی (PPE)';
      case 'warnings_ppe': return 'اخطارها و PPE';
      default: return 'کل پرونده ۳۶۰ درجه پرسنل';
    }
  };

  // Execute print via unified printService (opens clean preview and browser print dialog)
  const handlePrint = (sectionOverride?: string) => {
    const sec = sectionOverride || selectedSection;
    const secTitle = sec === 'all' ? 'پرونده جامع ۳۶۰ درجه پرسنل' : `بخش ${getSectionName(sec)}`;

    // Audit Logging
    personnelDossierService.logDossierAccess(p, currentUser, 'PRINT');

    printService.printElement('comprehensive-personnel-dossier-print-container', {
      title: `پرونده رسمی ۳۶۰ درجه - ${fullName} (کد ${pCode}) - ${secTitle}`,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '10mm 8mm',
      documentCode: `HSE-FO-DOSSIER-${pCode}`,
      documentDate: todayFa,
      isFa: true,
      autoPrint: true,
      customStyles: `
        @page {
          size: A4 portrait !important;
          margin: 10mm 8mm !important;
          @bottom-center {
            content: "صفحه " counter(page) " از " counter(pages);
            font-family: 'Vazirmatn', Tahoma, sans-serif;
            font-size: 8pt;
            color: #475569;
          }
        }
        body {
          direction: rtl !important;
          text-align: right !important;
          font-family: 'Vazirmatn', Tahoma, sans-serif !important;
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #comprehensive-personnel-dossier-print-container {
          width: 100% !important;
          max-width: 100% !important;
          min-height: auto !important;
          height: auto !important;
          background: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .print-break-avoid {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .print-row-avoid {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        thead {
          display: table-header-group !important;
        }
        tfoot {
          display: table-footer-group !important;
        }
        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      `
    });
  };

  const handlePdfExport = () => {
    personnelDossierService.logDossierAccess(p, currentUser, 'EXPORT_PDF');
    handlePrint();
  };

  // Fitness Status Label & Color
  const fitnessStatus = dossier.summary.fitnessStatusFa || 'نامشخص (معاینه ثبت نشده)';
  const isFit = fitnessStatus.includes('بلامانع') || fitnessStatus.includes('متناسب');
  const isConditional = fitnessStatus.includes('مشروط') || fitnessStatus.includes('محدودیت');
  const isUnfit = fitnessStatus.includes('نامناسب') || fitnessStatus.includes('رد');

  const fitnessColorClass = isFit
    ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
    : isConditional
    ? 'text-blue-800 bg-blue-50 border-blue-300'
    : isUnfit
    ? 'text-rose-800 bg-rose-50 border-rose-300'
    : 'text-slate-700 bg-slate-100 border-slate-300';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col overflow-hidden font-sans text-slate-900">
      
      {/* =========================================================================
          CONTROL TOPBAR (Always hidden in print)
         ========================================================================= */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg print:hidden select-none">
        
        {/* Left/Right Info in Topbar */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black flex items-center gap-2">
              <span>پیش‌نمایش و چاپ استاندارد A4 پرونده ۳۶۰ درجه پرسنل</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                کد: {pCode}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {fullName} | {p.unit || '-'} | {p.jobTitle || '-'}
            </p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Section Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400">محدوده:</span>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-blue-400 rounded-lg text-xs font-bold px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">تمام پرونده ۳۶۰ درجه (کامل سازمانی)</option>
              <option value="health">۱. طب کار، معاینات و محدودیت‌ها</option>
              <option value="training">۲. آموزش، گواهینامه‌ها و صلاحیت‌ها</option>
              <option value="permits">۳. پروانه‌های کار ایمن (PTW) و ممیزی‌ها</option>
              <option value="incidents">۴. حوادث، شبه‌حوادث و BBS</option>
              <option value="risks">۵. ارزیابی‌های ریسک و بازرسی‌ها</option>
              <option value="capa">۶. اقدامات اصلاحی و عدم انطباق‌ها (CAPA)</option>
              <option value="referrals">۷. ارجاعات و امضاهای دیجیتال</option>
              <option value="inspections">۸. بازرسی‌های بهداشت، محیط زیست و 5S</option>
              <option value="warnings">۹. تذکرات و اخطارهای انضباطی</option>
              <option value="ppe">۱۰. تجهیزات حفاظت فردی (PPE)</option>
            </select>
          </div>

          {/* Density Control */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400">تراکم محتوا:</span>
            <select
              value={densityMode}
              onChange={(e) => setDensityMode(e.target.value as DensityMode)}
              className="bg-slate-900 border border-slate-700 text-emerald-400 rounded-lg text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="auto">خودکار هوشمند ({effectiveDensity === 'spacious' ? 'جادار' : effectiveDensity === 'standard' ? 'استاندارد' : effectiveDensity === 'compact' ? 'فشرده' : 'تراکم بالا'})</option>
              <option value="spacious">جادار (اطلاعات کم)</option>
              <option value="standard">استاندارد (پیش‌فرض)</option>
              <option value="compact">فشرده (متوسط)</option>
              <option value="dense">بسیار فشرده (اطلاعات زیاد)</option>
            </select>
          </div>

          {/* Zoom Preview Controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
              className="p-1 hover:text-blue-400 text-slate-300 transition"
              title="بزرگنمایی کمتر"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-300 w-10 text-center">{previewZoom}%</span>
            <button
              onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
              className="p-1 hover:text-blue-400 text-slate-300 transition"
              title="بزرگنمایی بیشتر"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPreviewZoom(100)}
              className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
              title="اندازه واقعی ۱۰۰٪"
            >
              ۱۰۰٪
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint('all')}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            title="ارسال مستقیم به پرینتر یا پیش‌نمایش چاپ مرورگر"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ استاندارد A4</span>
          </button>

          <button
            onClick={handlePdfExport}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            title="ذخیره سند در قالب فایل PDF استاندارد"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">خروجی PDF</span>
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-400 flex items-center justify-center transition cursor-pointer border border-slate-700"
            title="بستن پنجره چاپ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN PRINT PREVIEW CONTAINER (Exact A4 Portrait Canvas)
         ========================================================================= */}
      <div className="flex-1 overflow-y-auto bg-slate-900/90 p-4 sm:p-8 flex flex-col items-center print:p-0 print:bg-white print:overflow-visible">
        
        <div
          className="w-full max-w-[210mm] flex flex-col items-center origin-top transition-transform"
          style={{
            transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
            transformOrigin: 'top center',
            marginBottom: previewZoom < 100 ? `-${(100 - previewZoom) * 4}px` : undefined
          }}
        >
          <div
            id="comprehensive-personnel-dossier-print-container"
            ref={printContainerRef}
            className={`w-full bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 print:border-none print:shadow-none print:max-w-none print:m-0 print:p-0 min-h-[297mm] h-auto flex flex-col ${densityStyles.baseText}`}
            style={{ 
              direction: 'rtl',
              minHeight: '297mm',
              height: 'auto',
              backgroundColor: '#ffffff',
              padding: '10mm 9mm'
            }}
          >
            {/* Internal Embedded Dedicated Print Stylesheet */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: A4 portrait !important;
                  margin: 10mm 8mm !important;
                  @bottom-center {
                    content: "صفحه " counter(page) " از " counter(pages);
                    font-family: 'Vazirmatn', Tahoma, sans-serif;
                    font-size: 8pt;
                    color: #475569;
                  }
                }
                html, body {
                  background: #ffffff !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #comprehensive-personnel-dossier-print-container {
                  width: 100% !important;
                  max-width: 100% !important;
                  min-height: auto !important;
                  height: auto !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  transform: none !important;
                  background: #ffffff !important;
                }
                .print-avoid-break {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
                .print-break-after-avoid {
                  break-after: avoid !important;
                  page-break-after: avoid !important;
                }
                tr {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
                thead {
                  display: table-header-group !important;
                }
                tfoot {
                  display: table-footer-group !important;
                }
                table {
                  background-color: #ffffff !important;
                }
              }
            `}} />

            {/* Master Repeating Table for Perfect A4 Multi-Page Support */}
            <table className="master-print-table w-full border-collapse border-none m-0 p-0 bg-white">
              <thead className="print-header-group bg-white">
                <tr className="bg-white">
                  <td className="border-none p-0 pb-2 bg-white">
                  {/* =========================================================================
                      1. OFFICIAL INSTITUTIONAL HEADER BAR (Repeats on every printed page)
                     ========================================================================= */}
                  <div className="border border-slate-900 rounded-lg p-2 mb-2 bg-slate-50 flex items-center justify-between gap-3 print-avoid-break">
                    
                    {/* Right: Organization Branding with Official System Logo */}
                    <div className="flex items-center gap-2.5">
                      <HseLogo size="lg" target="header" showShadow={false} />
                      <div>
                        <h1 className="text-[12px] font-black text-slate-950 leading-tight">
                          {branding.organizationNameFa || 'مرکز بهداشت، ایمنی و محیط زیست ( HSE )'}
                        </h1>
                        <p className="text-[9.5px] font-bold text-slate-700 leading-tight">
                          {branding.subTitleFa || 'سامانه جامع مدیریت بهداشت، ایمنی، محیط زیست و طب کار'}
                        </p>
                        <p className="text-[8px] text-slate-500 font-mono">
                          {branding.organizationNameEn || 'Health, Safety & Environment Directorate'}
                        </p>
                      </div>
                    </div>

                    {/* Center: Document Title */}
                    <div className="text-center px-2">
                      <span className="text-[8.5px] font-black text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200 inline-block">
                        فرم رسمی سازمانی A4
                      </span>
                      <h2 className="text-[12px] font-black text-slate-950 mt-0.5">
                        پرونده جامع ۳۶۰ درجه پرسنل
                      </h2>
                      <span className="text-[9px] font-bold text-slate-600 block">
                        {selectedSection === 'all' ? 'گزارش کامل سوابق یکپارچه شغلی و ایمنی' : getSectionName(selectedSection)}
                      </span>
                    </div>

                    {/* Left: Document Metadata */}
                    <div className="text-left text-[8px] font-mono border-r border-slate-300 pr-2 space-y-0.5 shrink-0">
                      <div><strong className="font-sans font-bold text-slate-800">کد سند:</strong> DOC-HSE-360</div>
                      <div><strong className="font-sans font-bold text-slate-800">نسخه:</strong> 03.00</div>
                      <div><strong className="font-sans font-bold text-slate-800">تاریخ:</strong> {todayFa}</div>
                      <div><strong className="font-sans font-bold text-slate-800">پرسنل:</strong> {pCode}</div>
                      <div><strong className="font-sans font-bold text-slate-800">کاربر:</strong> {currentUserName}</div>
                    </div>
                  </div>
                </td>
              </tr>
            </thead>

            <tbody className="bg-white">
              <tr className="bg-white">
                <td className="border-none p-0 bg-white">
                  {/* =========================================================================
                      2. MASTER PERSONNEL CARD (Exact visual match to image)
                     ========================================================================= */}
                  <div className="border border-slate-300 rounded-lg p-3 mb-2.5 bg-white shadow-xs print-avoid-break">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              
              {/* Right Side: Avatar + Name + Badges + Sub-row */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                
                {/* Official Avatar Box with Persian Initials & Green Verified Badge */}
                <div className="relative shrink-0">
                  {p.profilePhoto ? (
                    <img 
                      src={p.profilePhoto} 
                      alt={fullName} 
                      className="w-14 h-14 rounded-2xl object-cover border border-blue-200 shadow-sm" 
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm border border-blue-400/30">
                      {p.firstName?.[0] || 'آ'}{p.lastName?.[0] || 'س'}
                    </div>
                  )}
                  {/* Verified badge icon */}
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs" title="هویت تاییدشده سازمانی">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                </div>

                {/* Personnel Info Stack */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name and Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-slate-950 tracking-tight">
                      {fullName}
                    </h3>
                    
                    {/* Personnel Code Badge */}
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono font-black text-[11px]">
                      کد : {pCode}
                    </span>

                    {/* Job Title Badge */}
                    {p.jobTitle && (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px]">
                        {p.jobTitle}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Secondary summary line as shown in image */}
                  <div className="text-[10px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 font-medium">
                    <span className="font-bold text-slate-800">{p.unit || 'مرکز بهداشت، ایمنی و محیط زیست ( HSE )'}</span>
                    <span className="text-slate-300">|</span>
                    <span>کد ملی: <strong className="font-mono text-slate-900">{p.nationalCode || '5279930555'}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span>تماس: <strong className="font-mono text-slate-900">{p.phone || '09306904141'}</strong></span>
                    <span className="text-slate-300">|</span>
                    <span>تحصیلات: <strong className="text-slate-900">{p.education || 'کارشناسی ارشد'}</strong></span>
                  </div>

                  {/* Row 3: Complementary Administrative Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[9.5px]">
                    <div>
                      <span className="text-slate-400 block text-[8.5px]">نام پدر:</span>
                      <strong className="text-slate-800">{(p as any).fatherName || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[8.5px]">وضعیت استخدام:</span>
                      <strong className="text-slate-800">{(p as any).employmentStatus || p.status || 'رسمی / تمام‌وقت'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[8.5px]">محل خدمت / سایت:</span>
                      <strong className="text-slate-800">{p.workplace || (p as any).site || 'مجتمع اصلی'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[8.5px]">وضعیت تأهل / فرزند:</span>
                      <strong className="text-slate-800">{p.maritalStatus || 'متأهل'} {p.childrenCount ? `(${p.childrenCount} فرزند)` : ''}</strong>
                    </div>
                  </div>

                </div>

              </div>

              {/* Left Side: Fitness Status Pill Badge (Matching image) */}
              <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
                <span className="text-[9.5px] font-bold text-slate-500">وضعیت تناسب طب کار و سلامت:</span>
                <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-black text-[11px] shadow-xs ${fitnessColorClass}`}>
                  <Heart className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>{fitnessStatus}</span>
                </div>
              </div>

            </div>
          </div>

          {/* =========================================================================
              3. 6-METRIC KPI SUMMARY STRIP (Exact visual match to image)
             ========================================================================= */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3 print-avoid-break">
            
            {/* Card 1: Safety Score */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2 text-center flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 font-bold block mb-1">امتیاز ایمنی فردی</span>
              <div className="text-sm font-black text-indigo-700 font-mono">
                {dossier.summary.safetyScore} <span className="text-[10px] text-slate-400 font-normal">/ ۱۰۰</span>
              </div>
            </div>

            {/* Card 2: Training Hours */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2 text-center flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 font-bold block mb-1">ساعات آموزش HSE</span>
              <div className="text-sm font-black text-slate-900 font-mono">
                {dossier.summary.totalTrainingHours} <span className="text-[10px] text-slate-500 font-normal">ساعت</span>
              </div>
            </div>

            {/* Card 3: PTW Work Permits */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2 text-center flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 font-bold block mb-1">پروانه‌های کار (PTW)</span>
              <div className="text-sm font-black text-blue-700 font-mono">
                {dossier.summary.totalPermitsCount} <span className="text-[10px] text-emerald-600 font-normal">({dossier.workPermits.filter(w => w.status === 'Active' || w.status === 'Approved').length} فعال)</span>
              </div>
            </div>

            {/* Card 4: Occupational Restrictions */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2 text-center flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 font-bold block mb-1">محدودیت‌های شغلی</span>
              <div className="text-sm font-black text-slate-900 font-mono">
                {dossier.occupationalRestrictions.filter(r => r.status === 'ACTIVE').length} <span className="text-[10px] text-slate-500 font-normal">مورد فعال</span>
              </div>
            </div>

            {/* Card 5: Qualifications & Certificates */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2 text-center flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 font-bold block mb-1">صلاحیت و گواهینامه</span>
              <div className="text-sm font-black text-slate-900 font-mono">
                {dossier.summary.validCertificatesCount} <span className="text-[10px] text-emerald-600 font-normal">مجوز معتبر</span>
              </div>
            </div>

            {/* Card 6: Warnings / Incidents */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2 text-center flex flex-col justify-between">
              <span className="text-[9px] text-slate-500 font-bold block mb-1">اخطار / حوادث</span>
              <div className="text-sm font-black text-rose-700 font-mono">
                {dossier.summary.totalWarningsCount} <span className="text-slate-400 font-normal">/</span> {dossier.summary.totalIncidentsCount} <span className="text-[10px] text-slate-500 font-normal">ثبت‌شده</span>
              </div>
            </div>

          </div>

          {/* =========================================================================
              DOCUMENT BODY: STRUCTURED SECTIONS WITH AUTO-FIT TABLES
             ========================================================================= */}

          {/* SECTION 1: OCCUPATIONAL HEALTH & MEDICAL EXAMS */}
          {(selectedSection === 'all' || selectedSection === 'health') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30" />
                  <span>۱. سوابق معاینات طب کار، سلامت شغلی و تناسب</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.medicalExams.length} معاینه ثبت‌شده
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ معاینه</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28`}>نوع معاینه</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>مرکز و پزشک معتمد</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>شاخص‌ها (BP/BMI)</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>نظریه تناسب شغلی</th>
                    <th className={`${densityStyles.tablePadding}`}>توصیه‌ها و پیگیری</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.medicalExams.length > 0 ? (
                    dossier.medicalExams.map((exam, idx) => (
                      <tr key={exam.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-mono font-bold text-center`}>
                          {exam.examDate || `${exam.examYear}/--/--`}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300`}>
                          {exam.examType?.includes('دوره‌ای') ? 'معاینه ادواری سالیانه' : (exam.examType || 'بدو استخدام')}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300`}>
                          {exam.medicalCenter || 'مرکز طب کار مجتمع'} {exam.doctor ? `- دکتر ${exam.doctor}` : ''}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>
                          {exam.findings?.bloodPressure ? `BP: ${exam.findings.bloodPressure}` : ''} {exam.findings?.bmi ? `| BMI: ${exam.findings.bmi}` : '-'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-bold`}>
                          <span className={exam.status === 'fit' ? 'text-emerald-700' : exam.status === 'unfit' ? 'text-rose-700' : 'text-blue-700'}>
                            {exam.status === 'fit' ? 'بلامانع و متناسب' : exam.status === 'unfit' ? 'نامناسب (رد)' : 'مشروط با محدودیت'}
                          </span>
                        </td>
                        <td className={`${densityStyles.tablePadding} text-slate-700`}>
                          {exam.recommendations || exam.description || 'فاقد توصیه خاص'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-slate-400 font-medium bg-white">هیچ سابقه معاینه طب کاری در سامانه ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Occupational Restrictions Subtable */}
              {dossier.occupationalRestrictions.length > 0 && (
                <div className="mt-1.5">
                  <div className="text-[10px] font-black text-rose-800 flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>محدودیت‌های شغلی و تجویزهای پزشکی معتبر:</span>
                  </div>
                  <table className={`w-full text-right border-collapse border border-rose-200 bg-white ${densityStyles.tableText}`}>
                    <thead>
                      <tr className="bg-rose-50 text-rose-950 font-bold border-b border-rose-200">
                        <th className={`${densityStyles.tablePadding} border-r border-rose-200 w-7 text-center`}>#</th>
                        <th className={`${densityStyles.tablePadding} border-r border-rose-200`}>عنوان محدودیت</th>
                        <th className={`${densityStyles.tablePadding} border-r border-rose-200 w-28`}>دسته‌بندی</th>
                        <th className={`${densityStyles.tablePadding} border-r border-rose-200 w-36`}>بازه اعتبار</th>
                        <th className={`${densityStyles.tablePadding} border-r border-rose-200 w-28`}>پزشک صادرکننده</th>
                        <th className={`${densityStyles.tablePadding} border-r border-rose-200 w-24 text-center`}>وضعیت</th>
                        <th className={`${densityStyles.tablePadding}`}>توضیحات و دستورالعمل اجرایی</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {dossier.occupationalRestrictions.map((r, idx) => (
                        <tr key={r.id || idx} className="border-b border-rose-100 bg-white even:bg-rose-50/30 print-row-avoid">
                          <td className={`${densityStyles.tablePadding} border-r border-rose-200 text-center font-mono`}>{idx + 1}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-rose-200 font-bold text-rose-900`}>{r.title}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-rose-200`}>{r.category === 'PHYSICAL' ? 'فیزیکی و اسکلتی' : r.category === 'CHEMICAL' ? 'مواجهه با مواد شیمیایی' : 'شیفت کاری و ارگونومی'}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-rose-200 font-mono text-[8.5px]`}>{r.startDate} {r.endDate ? `تا ${r.endDate}` : '(دائمی)'}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-rose-200`}>{r.physicianName}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-rose-200 text-center font-bold text-rose-700`}>
                            {r.status === 'ACTIVE' ? 'فعال و لازم‌الاجرا' : 'خاتمه‌یافته'}
                          </td>
                          <td className={`${densityStyles.tablePadding} text-slate-700`}>{r.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: TRAINING, SAFETY INDUCTION & QUALIFICATIONS */}
          {(selectedSection === 'all' || selectedSection === 'training') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                  <span>۲. سوابق دوره‌های آموزشی HSE، القائات ایمنی و صلاحیت‌های شغلی</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.trainingCourses.length} دوره | {dossier.qualifications.length} صلاحیت
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>عنوان دوره آموزشی / القائات ایمنی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>کد دوره</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-20 text-center`}>مدت (ساعت)</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ برگزاری</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-36`}>مدرس / موسسه</th>
                    <th className={`${densityStyles.tablePadding} w-28 text-center`}>وضعیت آزمون و مدرک</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.trainingCourses.length > 0 ? (
                    dossier.trainingCourses.map((c, idx) => (
                      <tr key={c.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>{c.courseTitle || c.title || 'دوره ایمنی HSE'}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{c.courseCode || '-'}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono font-bold`}>{c.hours || 8}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{c.date || '1403/05/10'}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300`}>{c.trainer || 'واحد آموزش HSE مجتمع'}</td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold text-emerald-700`}>گواهینامه معتبر</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-slate-400 font-medium bg-white">هیچ دوره‌ای برای این پرسنل ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Special Qualifications Table */}
              {dossier.qualifications.length > 0 && (
                <div className="mt-1.5">
                  <div className="text-[10px] font-black text-blue-900 flex items-center gap-1 mb-1">
                    <Award className="w-3 h-3 text-blue-600" />
                    <span>صلاحیت‌های تخصصی، اپراتوری و پروانه‌های ویژه:</span>
                  </div>
                  <table className={`w-full text-right border-collapse border border-blue-200 bg-white ${densityStyles.tableText}`}>
                    <thead>
                      <tr className="bg-blue-50 text-blue-950 font-bold border-b border-blue-200">
                        <th className={`${densityStyles.tablePadding} border-r border-blue-200 w-7 text-center`}>#</th>
                        <th className={`${densityStyles.tablePadding} border-r border-blue-200`}>عنوان صلاحیت / گواهینامه</th>
                        <th className={`${densityStyles.tablePadding} border-r border-blue-200 w-32`}>شماره سریال مجوز</th>
                        <th className={`${densityStyles.tablePadding} border-r border-blue-200 w-32`}>مرجع صادرکننده</th>
                        <th className={`${densityStyles.tablePadding} border-r border-blue-200 w-24 text-center`}>تاریخ صدور</th>
                        <th className={`${densityStyles.tablePadding} border-r border-blue-200 w-24 text-center`}>سررسید انقضا</th>
                        <th className={`${densityStyles.tablePadding} w-24 text-center`}>وضعیت اعتبار</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {dossier.qualifications.map((q, idx) => (
                        <tr key={q.id || idx} className="border-b border-blue-100 bg-white even:bg-blue-50/30 print-row-avoid">
                          <td className={`${densityStyles.tablePadding} border-r border-blue-200 text-center font-mono`}>{idx + 1}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-blue-200 font-bold`}>{q.certificateName}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-blue-200 font-mono`}>{q.certificateNumber}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-blue-200`}>{q.issuingAuthority}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-blue-200 text-center font-mono`}>{q.issueDate}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-blue-200 text-center font-mono`}>{q.expiryDate || 'نامحدود'}</td>
                          <td className={`${densityStyles.tablePadding} text-center font-bold ${q.isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {q.isValid ? 'دارای اعتبار' : 'منقضی شده'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: WORK PERMITS (PTW) */}
          {(selectedSection === 'all' || selectedSection === 'permits') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>۳. سوابق پروانه‌های کار ایمن (PTW) صادرشده</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.workPermits.length} پروانه کار
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28`}>شماره سریال PTW</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>نوع پروانه کار</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28`}>نقش در مجوز</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>واحد و موقعیت عملیاتی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ صدور</th>
                    <th className={`${densityStyles.tablePadding} w-24 text-center`}>وضعیت نهایی</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.workPermits.length > 0 ? (
                    dossier.workPermits.map((wp, idx) => (
                      <tr key={wp.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-mono font-bold text-blue-900`}>{wp.serialNumber || wp.id}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300`}>{wp.permitType || 'مجوز کار گرم / عمومی'}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>مجری کار / سرپرست</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300`}>{wp.department || wp.location || 'سایت عملیاتی'}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{wp.createdDate || '-'}</td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold`}>
                          <span className={wp.status === 'Closed' || wp.status === 'Finished' ? 'text-slate-600' : 'text-emerald-700'}>
                            {wp.status === 'Closed' || wp.status === 'Finished' ? 'بسته شده' : 'تأیید و فعال'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-slate-400 font-medium bg-white">سابقه‌ای از پروانه‌های کار ایمن برای این پرسنل ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 4: INCIDENTS, ANOMALIES & BEHAVIORAL OBSERVATIONS (BBS) */}
          {(selectedSection === 'all' || selectedSection === 'incidents') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>۴. سوابق رویدادها، شبه‌حوادث، ناهنجاری‌ها و مشاهدات رفتاری (BBS)</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.incidents.length} رویداد | {dossier.bbsObservations.length} مشاهده BBS
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24`}>کد پیگیری</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>عنوان رویداد / ناهنجاری</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>دسته‌بندی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>نقش پرسنل</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ وقوع</th>
                    <th className={`${densityStyles.tablePadding} w-28 text-center`}>اقدام اصلاحی (CAPA)</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.incidents.length > 0 ? (
                    dossier.incidents.map((inc, idx) => (
                      <tr key={inc.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-mono font-bold text-rose-800`}>{inc.reportNumber || inc.id}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>{inc.title}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center`}>{inc.categoryFa || inc.category}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-bold text-slate-800`}>
                          {inc.reporterPersonnelCode === pCode ? 'گزارش‌دهنده' : 'فرد درگیر'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{inc.eventDate || (inc as any).date}</td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold text-emerald-700`}>اقدامات انجام شد</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-emerald-700 font-bold bg-white">
                        فاقد هرگونه سابقه حادثه، شبه‌حادثه یا آسیب شغلی (پرونده کاملاً پاک)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* BBS Observations Table */}
              {dossier.bbsObservations.length > 0 && (
                <div className="mt-1.5">
                  <div className="text-[10px] font-black text-indigo-900 flex items-center gap-1 mb-1">
                    <UserCheck className="w-3 h-3 text-indigo-600" />
                    <span>مشاهدات ایمنی بر پایه رفتار (BBS):</span>
                  </div>
                  <table className={`w-full text-right border-collapse border border-indigo-200 bg-white ${densityStyles.tableText}`}>
                    <thead>
                      <tr className="bg-indigo-50 text-indigo-950 font-bold border-b border-indigo-200">
                        <th className={`${densityStyles.tablePadding} border-r border-indigo-200 w-7 text-center`}>#</th>
                        <th className={`${densityStyles.tablePadding} border-r border-indigo-200 w-24 text-center`}>تاریخ</th>
                        <th className={`${densityStyles.tablePadding} border-r border-indigo-200 w-28`}>ناظر / مشاهده‌گر</th>
                        <th className={`${densityStyles.tablePadding} border-r border-indigo-200 w-28 text-center`}>نوع رفتار</th>
                        <th className={`${densityStyles.tablePadding} border-r border-indigo-200 w-32`}>موقعیت و واحد</th>
                        <th className={`${densityStyles.tablePadding}`}>شرح مشاهده و بازخورد ارائه‌شده</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {dossier.bbsObservations.map((b, idx) => (
                        <tr key={b.id || idx} className="border-b border-indigo-100 bg-white even:bg-indigo-50/30 print-row-avoid">
                          <td className={`${densityStyles.tablePadding} border-r border-indigo-200 text-center font-mono`}>{idx + 1}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-indigo-200 font-mono text-center`}>{b.observationDate}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-indigo-200 font-medium`}>{b.observerName}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-indigo-200 text-center font-bold`}>
                            <span className={b.behaviorType === 'SAFE' ? 'text-emerald-700' : 'text-rose-700'}>
                              {b.behaviorType === 'SAFE' ? 'رفتار ایمن و شایسته' : 'رفتار در معرض خطر'}
                            </span>
                          </td>
                          <td className={`${densityStyles.tablePadding} border-r border-indigo-200`}>{b.unit}</td>
                          <td className={`${densityStyles.tablePadding} text-slate-700`}>{b.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: RISK ASSESSMENTS & SAFETY INSPECTIONS */}
          {(selectedSection === 'all' || selectedSection === 'risks') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>۵. سوابق ارزیابی‌های ریسک و چک‌لیست‌های بازرسی ایمنی</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.riskAssessments.length + dossier.safetyInspections.length} مورد
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24`}>کد سند</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>عنوان ارزیابی / چک‌لیست</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>متدولوژی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>نقش پرسنل</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ</th>
                    <th className={`${densityStyles.tablePadding} w-24 text-center`}>سطح ریسک / امتیاز</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.riskAssessments.length > 0 || dossier.safetyInspections.length > 0 ? (
                    <>
                      {dossier.riskAssessments.map((a, idx) => (
                        <tr key={a.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-mono font-bold text-slate-900`}>{a.code}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>{a.title}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono font-bold text-blue-700`}>{a.method}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-bold text-slate-800`}>
                            {a.assessorName?.includes(fullName) ? 'ارزیاب اصلی' : 'عضو تیم ارزیابی'}
                          </td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{a.assessmentDate}</td>
                          <td className={`${densityStyles.tablePadding} text-center font-bold`}>
                            <span className={a.overallRiskLevel === 'LOW' ? 'text-emerald-700' : a.overallRiskLevel === 'MEDIUM' ? 'text-blue-700' : 'text-rose-700'}>
                              {a.overallRiskLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {dossier.safetyInspections.map((insp, idx) => (
                        <tr key={insp.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/50 print-row-avoid">
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{dossier.riskAssessments.length + idx + 1}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-mono text-slate-800`}>{insp.id}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>{insp.title || insp.checklistTypeNameFa}</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-bold text-emerald-700`}>چک‌لیست HSE</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-bold text-slate-800`}>بازرس / سرپرست</td>
                          <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{insp.inspectionDate}</td>
                          <td className={`${densityStyles.tablePadding} text-center font-mono font-bold text-emerald-700`}>{insp.scorePercent || 100}%</td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-slate-400 font-medium bg-white">سابقه‌ای در ارزیابی‌های ریسک یا چک‌لیست‌های عملیاتی ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 6: WARNINGS & DISCIPLINARY NOTICES */}
          {(selectedSection === 'all' || selectedSection === 'warnings' || selectedSection === 'warnings_ppe') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
                  <span>۶. سوابق تذکرات و اخطارهای انضباطی ایمنی</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.warnings.length} اخطار ثبت‌شده
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28`}>شماره ابلاغیه</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>موضوع و تخلف عدم انطباق ایمنی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>امتیاز منفی</th>
                    <th className={`${densityStyles.tablePadding} w-28 text-center`}>نوع اخطار / وضعیت</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.warnings.length > 0 ? (
                    dossier.warnings.map((w, idx) => (
                      <tr key={w.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-mono font-bold text-rose-700`}>{w.number || w.id}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>{w.reason || 'تذکر عدم رعایت پروتکل ایمنی'}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{w.year}/{w.month}/{w.day}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono font-bold text-rose-700`}>۵-</td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold text-slate-700`}>
                          {w.type === 'فردی' ? 'اخطار کتبی فردی' : 'اخطار واحدی'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-emerald-700 font-bold bg-white">
                        فاقد هرگونه اخطار، تذکر کتبی یا تخلف انضباطی ایمنی (انطباق ۱۰۰٪)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 7: PERSONAL PROTECTIVE EQUIPMENT (PPE) */}
          {(selectedSection === 'all' || selectedSection === 'ppe' || selectedSection === 'warnings_ppe') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-blue-400" />
                  <span>۷. سوابق تجهیزات حفاظت فردی (PPE) تحویل‌شده</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.ppeIssuances.length} قلم تحویلی
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>نام و مشخصات قلم تجهیزات</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-20 text-center`}>تعداد</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ تحویل</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>سررسید تعویض</th>
                    <th className={`${densityStyles.tablePadding} w-28 text-center`}>وضعیت تحویل</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.ppeIssuances.length > 0 ? (
                    dossier.ppeIssuances.map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>{item.ppeItemName}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono font-bold`}>{item.quantity || 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{item.issueDate}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{item.expiryDate || '-'}</td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold text-emerald-700`}>تحویل و ثبت شد</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-400 font-medium bg-white">سابقه‌ای از تحویل تجهیزات حفاظت فردی برای این پرسنل ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 8: SYSTEM CAPA & NON-CONFORMANCES */}
          {(selectedSection === 'all' || selectedSection === 'capa') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>۸. سوابق اقدامات اصلاحی و عدم انطباق‌های سازمانی (CAPA)</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.nonConformances?.length || 0} مورد منتسب
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>کد عدم‌انطباق</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>عنوان و شرح عدم انطباق</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>منبع / ماژول</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>مهلت سررسید</th>
                    <th className={`${densityStyles.tablePadding} w-28 text-center`}>وضعیت اقدام</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.nonConformances && dossier.nonConformances.length > 0 ? (
                    dossier.nonConformances.map((nc, idx) => (
                      <tr key={nc.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono font-bold text-blue-900`}>
                          {nc.code || `NC-${idx + 1}`}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>
                          <div>{nc.title || nc.description}</div>
                          {nc.actionPlan && <div className="text-[8px] text-slate-500 mt-0.5">طرح اقدام: {nc.actionPlan}</div>}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center`}>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[8px]">
                            {nc.sourceModule || 'HSE-Core'}
                          </span>
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>
                          {nc.dueDate || '-'}
                        </td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold`}>
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] ${
                            nc.status === 'Closed' || nc.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-rose-50 text-rose-800'
                          }`}>
                            {nc.status === 'Closed' || nc.status === 'Completed' ? 'تکمیل و بسته شده' : 'در حال پیگیری / باز'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-400 font-medium bg-white">عدم انطباق یا اقدام اصلاحی باز برای این پرسنل ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 9: REFERRALS & DIGITAL WORKFLOW SIGNATURES */}
          {(selectedSection === 'all' || selectedSection === 'referrals') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>۹. گردش اسناد، ارجاعات و امضاهای دیجیتال (کارتابل)</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {dossier.referrals?.length || 0} گردش سند
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>عنوان مدرک / فرم سازمانی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>نوع سند</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>ارسال‌کننده</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ ارجاع</th>
                    <th className={`${densityStyles.tablePadding} w-28 text-center`}>وضعیت گردش</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dossier.referrals && dossier.referrals.length > 0 ? (
                    dossier.referrals.map((ref, idx) => (
                      <tr key={ref.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>
                          <div>{ref.documentTitle || ref.subject || 'سند سازمانی'}</div>
                          {ref.notes && <div className="text-[8px] text-slate-500 font-normal mt-0.5">{ref.notes}</div>}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono text-[8.5px]`}>
                          {ref.documentType || 'سایر'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center`}>
                          {ref.senderName || 'سیستم HSE'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>
                          {ref.createdAt ? ref.createdAt.split('T')[0] : todayFa}
                        </td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold`}>
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] ${
                            ref.status === 'Completed' || ref.status === 'Signed' || ref.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-blue-50 text-blue-800'
                          }`}>
                            {ref.status === 'Completed' || ref.status === 'Signed' || ref.status === 'Approved' ? 'امضا و تایید شده' : 'در دست بررسی'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-400 font-medium bg-white">سابقه‌ای از گردش مدرک یا امضای ارجاعی برای این پرسنل ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 10: HEALTH, ENVIRONMENTAL & 5S INSPECTIONS */}
          {(selectedSection === 'all' || selectedSection === 'inspections') && (
            <div className={`${densityStyles.sectionSpacing} print-avoid-break bg-white`}>
              <div className="bg-slate-900 text-white px-2.5 py-1 text-[11px] font-black rounded-t-md flex items-center justify-between print-break-after-avoid">
                <div className="flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>۱۰. بازرسی‌های تخصصی ۵S، بهداشت حرفه‌ای و محیط زیست</span>
                </div>
                <span className="text-[9.5px] font-mono text-slate-300">
                  {(dossier.healthEnvInspections?.length || 0) + (dossier.fiveSInspections?.length || 0)} مورد بازرسی
                </span>
              </div>

              <table className={`w-full text-right border-collapse border border-slate-300 bg-white ${densityStyles.tableText}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-7 text-center`}>#</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>نوع بازرسی</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300`}>حوزه / واحد بازرسی‌شده</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-28 text-center`}>بازرس / مسئول</th>
                    <th className={`${densityStyles.tablePadding} border-r border-slate-300 w-24 text-center`}>تاریخ</th>
                    <th className={`${densityStyles.tablePadding} w-24 text-center`}>نمره / وضعیت</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {[...(dossier.healthEnvInspections || []), ...(dossier.fiveSInspections || [])].length > 0 ? (
                    [...(dossier.healthEnvInspections || []), ...(dossier.fiveSInspections || [])].map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-slate-200 bg-white even:bg-slate-50/40 print-row-avoid">
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>{idx + 1}</td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-bold text-indigo-900`}>
                          {item.zoneName || item.checklistTitle ? 'بهداشت و محیط زیست' : 'ممیزی نظام 5S'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 font-bold`}>
                          {item.department || item.unit || item.area || 'واحد عملیاتی'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center`}>
                          {item.inspectorName || item.auditorName || '-'}
                        </td>
                        <td className={`${densityStyles.tablePadding} border-r border-slate-300 text-center font-mono`}>
                          {item.date || item.inspectionDate || '-'}
                        </td>
                        <td className={`${densityStyles.tablePadding} text-center font-bold text-emerald-700 font-mono`}>
                          {item.score !== undefined ? `${item.score}%` : 'تایید نهایی'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-400 font-medium bg-white">سابقه‌ای از بازرسی‌های 5S و بهداشت/محیط زیست برای این پرسنل ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION 11: OFFICIAL VERIFICATION & ADMINISTRATIVE SIGN-OFF BLOCK */}
          <div className="mt-4 pt-3 border-t-2 border-slate-900 print-avoid-break bg-white">
            <div className="text-[10px] font-black text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Stamp className="w-4 h-4 text-blue-600" />
                <span>۱۱. تاییدات رسمی و امضاهای سازمانی اعتباربخشی پرونده ۳۶۰ درجه</span>
              </span>
              <span className="font-mono text-[8px] text-slate-500">
                شناسه امنیتی گزارش: VER-HSE-360-{pCode}-{todayFa.replace(/\//g, '')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-[8.5px]">
              
              {/* 1. Occupational Health Box */}
              <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50 flex flex-col justify-between min-h-[95px]">
                <div>
                  <strong className="block text-slate-900 font-black text-[9px] border-b border-slate-300 pb-1 mb-1.5">
                    مسئول طب کار و بهداشت حرفه‌ای
                  </strong>
                  <p className="text-slate-600 leading-tight">
                    تایید سلامت جسمانی، معاینات ادواری و انطباق محدودیت‌های شغلی پرسنل.
                  </p>
                </div>
                <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-slate-400 text-[8px]">
                  <span>نام و امضا: </span>
                  <span>تاریخ و مهر: </span>
                </div>
              </div>

              {/* 2. HSE Directorate Box */}
              <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50 flex flex-col justify-between min-h-[95px]">
                <div>
                  <strong className="block text-slate-900 font-black text-[9px] border-b border-slate-300 pb-1 mb-1.5">
                    مدیر / رئیس واحد بهداشت، ایمنی و محیط زیست (HSE)
                  </strong>
                  <p className="text-slate-600 leading-tight">
                    صحت‌سنجی سوابق پروانه‌های کار، آموزش‌ها، ارزیابی‌های ریسک و وضعیت ایمنی.
                  </p>
                </div>
                <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-slate-400 text-[8px]">
                  <span>نام و امضا: </span>
                  <span>تاریخ و مهر: </span>
                </div>
              </div>

              {/* 3. Human Resources Box */}
              <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50 flex flex-col justify-between min-h-[95px]">
                <div>
                  <strong className="block text-slate-900 font-black text-[9px] border-b border-slate-300 pb-1 mb-1.5">
                    مدیریت منابع انسانی و امور اداری
                  </strong>
                  <p className="text-slate-600 leading-tight">
                    انطباق اطلاعات هویتی و ثبت نهایی در پرونده پرسنلی الکترونیک سازمان.
                  </p>
                </div>
                <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-slate-400 text-[8px]">
                  <span>نام و امضا: </span>
                  <span>تاریخ و مهر: </span>
                </div>
              </div>

            </div>
          </div>

                </td>
              </tr>
            </tbody>

            {/* Master Repeating Footer for Multi-Page A4 Printout */}
            <tfoot className="print-footer-group bg-white">
              <tr className="bg-white">
                <td className="border-none p-0 pt-2.5 bg-white">
                  {/* =========================================================================
                      DOCUMENT FOOTER: ADMINISTRATIVE VERIFICATION & PAGE NUMBERING
                     ========================================================================= */}
                  <div className="pt-2 border-t-2 border-slate-900 print-avoid-break text-[8.5px] text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-1.5 font-mono bg-white">
                    <div className="flex items-center gap-1 font-sans font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>این سند الکترونیکی بر اساس پایگاه داده‌های سلامت، ایمنی و محیط زیست (HSE) صادر گردیده و دارای اعتبار رسمی سازمانی است.</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 font-bold shrink-0">
                      <span>DOC-HSE-360-A4</span>
                      <span>•</span>
                      <span>گزارش رسمی ۳۶۰ درجه پرسنل</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>

        </div>

        </div>

      </div>

    </div>
  );
}

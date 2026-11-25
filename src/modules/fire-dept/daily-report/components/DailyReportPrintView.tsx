import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { FireDailyReport } from '../types/dailyReportTypes';
import {
  fireDailyReportService,
  initFireDailyReportStorage,
  normalizeReport,
  buildInitialVehiclesStatus
} from '../services/dailyReportService';
import { getFleetVehicles } from '../../vehicles/hooks/useVehicleData';
import { useSystemBranding } from '../../../../utils/systemBrandingHelper';
import { HseLogo } from '../../../../components/HseLogo';
import { printService } from '../../../../services/printService';

interface DailyReportPrintViewProps {
  report: FireDailyReport;
  onClose: () => void;
  isFa?: boolean;
}

export default function DailyReportPrintView({
  report,
  onClose,
  isFa = true
}: DailyReportPrintViewProps) {
  const [liveReport, setLiveReport] = useState<FireDailyReport>(() => normalizeReport(report));
  const { branding } = useSystemBranding();

  // Keep report synchronized dynamically with the primary PostgreSQL database
  useEffect(() => {
    let active = true;
    setLiveReport(normalizeReport(report));

    const refreshFromDatabase = async () => {
      try {
        const dbList = await initFireDailyReportStorage();
        if (!active) return;
        const matched =
          dbList.find(item => item.id === report.id || item.reportNumber === report.reportNumber) ||
          fireDailyReportService.getReportById(report.id);
        if (matched) {
          setLiveReport(normalizeReport(matched));
        }
      } catch {
        // Fallback to current normalized prop
      }
    };

    void refreshFromDatabase();

    const handleReportUpdated = () => {
      const latest = fireDailyReportService.getReportById(report.id);
      if (latest && active) {
        setLiveReport(normalizeReport(latest));
      }
    };

    window.addEventListener('hse_fire_daily_reports_updated', handleReportUpdated);
    return () => {
      active = false;
      window.removeEventListener('hse_fire_daily_reports_updated', handleReportUpdated);
    };
  }, [report]);

  const p = liveReport;

  const handlePrint = () => {
    const printed = printService.printElement('fire-daily-report-sheet', {
      title: `گزارش روزانه ایستگاه آتش‌نشانی و امداد - ${p.reportNumber || ''} - ${p.reportDate || ''}`,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '5mm 6mm 7mm 6mm',
      documentCode: p.reportNumber,
      documentDate: p.reportDate,
      isFa: isFa,
      autoPrint: true,
      customStyles: `
        @page {
          size: A4 portrait !important;
          margin: 5mm 6mm 7mm 6mm !important;
        }
        @media screen {
          .print-sheet-wrapper {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            padding: 5mm 6mm !important;
            box-sizing: border-box !important;
          }
        }
        #fire-daily-report-sheet {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          min-height: auto !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
          box-sizing: border-box !important;
        }
        #fire-daily-report-sheet table {
          width: 100% !important;
          table-layout: fixed !important;
        }
        #fire-daily-report-sheet th,
        #fire-daily-report-sheet td {
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
      `
    });

    if (!printed) {
      window.print();
    }
  };

  // Convert vehicle status map or live fleet vehicles into formatted list
  const rawVehiclesMap =
    p.vehiclesStatus && Object.keys(p.vehiclesStatus).length > 0
      ? p.vehiclesStatus
      : buildInitialVehiclesStatus(getFleetVehicles(), false);

  const vehicleList = Object.entries(rawVehiclesMap || {}).map(([key, val]: any) => {
    const code = val?.vehicleCode || (key.startsWith('veh-') ? '' : key);
    const name = val?.vehicleName || val?.name || key;
    const plate = val?.plateNumber;
    const vehicleType = val?.vehicleType;
    const status = typeof val === 'string' ? val : val?.status || 'آماده به کار';
    const description = val?.description || '';
    return { key, code, name, plate, vehicleType, status, description };
  });

  const totalMainPermits =
    (Number(p.workPermitsIssued?.hotWork) || 0) + (Number(p.workPermitsIssued?.coldWork) || 0);

  const totalAttachedPermits =
    (Number(p.workPermitsIssued?.attachedPermits?.excavation) || 0) +
    (Number(p.workPermitsIssued?.attachedPermits?.confinedSpace ?? p.workPermitsIssued?.confinedSpace) || 0) +
    (Number(p.workPermitsIssued?.attachedPermits?.vehicleCrane) || 0) +
    (Number(p.workPermitsIssued?.attachedPermits?.radiation) || 0) +
    (Number(p.workPermitsIssued?.attachedPermits?.electricalIsolation) || 0) +
    (Number(p.workPermitsIssued?.attachedPermits?.processIsolation) || 0);

  const modalContent = (
    <div
      data-print-view="true"
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/90 backdrop-blur-md flex flex-col items-stretch justify-start print-sheet no-card-table print:bg-white print:static print:inset-auto print:overflow-visible print:block"
      dir="rtl"
    >
      {/* 🖨️ Top Action Bar (Hidden during Print) */}
      <header className="sticky top-0 left-0 right-0 z-60 w-full bg-slate-900/95 border-b border-slate-800 text-white px-4 sm:px-8 py-2.5 flex items-center justify-between shadow-xl print:hidden backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title={isFa ? 'بازگشت' : 'Back'}
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">{isFa ? 'بازگشت به سامانه' : 'Back'}</span>
          </button>
          <div className="h-5 w-px bg-slate-700 hidden sm:block"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white">
                {isFa ? 'فرم رسمی گزارش روزانه ایستگاه آتش‌نشانی (نسخه چاپی A4)' : 'Fire Station Daily Report (A4 Portrait)'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {p.reportNumber}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {isFa
                ? 'مرکز بهداشت، ایمنی و محیط زیست (HSE) و آتش‌نشانی - مجتمع پتروشیمی رجال'
                : 'HSE & Fire Department - Regal Petrochemical Complex'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black transition shadow-lg shadow-red-600/30 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ فرم رسمی / ذخیره PDF' : 'Print / Save PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title={isFa ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 📄 Printable A4 Vertical (Portrait) Document Root */}
      <main className="w-full flex-1 py-4 sm:py-6 px-2 sm:px-6 overflow-x-auto print:p-0 print:m-0 print:w-full print:overflow-visible print:block">
        {/* Exact A4 Vertical (Portrait) Paper Sheet (210mm × 297mm) */}
        <article
          id="fire-daily-report-sheet"
          data-print-view="true"
          dir="rtl"
          className="print-sheet no-card-table w-[210mm] min-w-[210mm] max-w-[210mm] min-h-[297mm] bg-white text-black px-[6mm] py-[5mm] rounded-xl shadow-2xl border border-slate-300 overflow-hidden print:overflow-visible print:shadow-none print:rounded-none print:p-0 print:m-0 print:min-w-0 print:max-w-none print:w-full print:min-h-0 print:border-none text-[8px] leading-tight font-sans select-none mx-auto box-border"
          style={{
            colorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          {/* Multi-page Repeating Structure using HTML Table */}
          <table className="w-full table-fixed border-collapse">
            {/* 🏷️ Repeating Formal Header on Every Page */}
            <thead>
              <tr>
                <td className="pb-1">
                  {/* Master Header Box */}
                  <div className="border-[1.8px] border-black px-3 py-1.5 bg-white text-black flex items-center justify-between">
                    {/* Right (Start in RTL): Date, Shift, Document Code */}
                    <div className="w-[30%] text-right font-bold space-y-0.5 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-black">تاریخ گزارش:</span>
                        <span className="font-mono text-[11.5px] font-black text-black border-b border-black pb-0.5 px-1.5">
                          {p.reportDate || '۱۴۰۴/--/--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[9.5px] text-gray-800">
                        <span>شیفت / نوبتکاری:</span>
                        <span className="font-bold text-black">
                          {p.shift === 'DAY' ? 'روزکار (DAY)' : p.shift === 'NIGHT' ? 'شب‌کار (NIGHT)' : 'چرخشی (ROTATING)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-gray-700">
                        <span>شماره سند:</span>
                        <span className="font-mono font-bold text-black">{p.reportNumber}</span>
                      </div>
                    </div>

                    {/* Center: Organization & Form Title */}
                    <div className="w-[44%] text-center space-y-0.5">
                      <h1 className="font-black text-[13px] leading-snug text-black">
                        {p.unitName || 'مرکز ایمنی ، بهداشت و محیط زیست مجتمع پتروشیمی رجال'}
                      </h1>
                      {p.subUnitName && (
                        <div className="text-[9.5px] font-bold text-gray-800">{p.subUnitName}</div>
                      )}
                      <h2 className="font-black text-[12px] text-black">
                        {p.stationName
                          ? p.stationName.includes('گزارش روزانه')
                            ? p.stationName
                            : p.stationName.includes('گزارش')
                            ? p.stationName
                            : `گزارش روزانه ${p.stationName}`
                          : 'گزارش روزانه ایستگاه آتش نشانی معین'}
                      </h2>
                    </div>

                    {/* Left (End in RTL): Strictly Logo Box */}
                    <div className="w-[26%] flex items-center justify-end">
                      <div className="border-[1.5px] border-black px-2.5 py-1 text-center bg-white flex items-center justify-center min-w-[92px] h-11 overflow-hidden">
                        {branding.logoUrl ? (
                          <img
                            src={branding.logoUrl}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain select-none"
                          />
                        ) : (
                          <HseLogo size="sm" target="header" showShadow={false} />
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </thead>

            {/* 📝 Main Body Sections - All 13 Sections Preserved in Compact Landscape Layout */}
            <tbody>
              <tr>
                <td className="space-y-1 pt-0.5">
                  {/* ========================================================================= */}
                  {/* Section 1: بازرسی‌ها و حوادث روزانه (Inspections & Daily Incidents) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۱. بازرسی‌ها و حوادث روزانه
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[8px]">
                      <colgroup>
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>تعداد بازرسی HSE</th>
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>تعداد بازرسی آتش‌نشانی</th>
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={3}>تعداد حوادث انسانی</th>
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={3}>تعداد حوادث ماشینی</th>
                          <th className="py-0.5 px-0.5" colSpan={3}>تعداد آتش‌سوزی</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7.5px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-0.5">جزئی</th>
                          <th className="border-l border-black py-0.5 px-0.5">قابل ثبت</th>
                          <th className="border-l border-black py-0.5 px-0.5">حاد</th>
                          <th className="border-l border-black py-0.5 px-0.5">جزئی</th>
                          <th className="border-l border-black py-0.5 px-0.5">قابل ثبت</th>
                          <th className="border-l border-black py-0.5 px-0.5">حاد</th>
                          <th className="border-l border-black py-0.5 px-0.5">جزئی</th>
                          <th className="border-l border-black py-0.5 px-0.5">قابل ثبت</th>
                          <th className="py-0.5 px-0.5">حاد</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold">
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.hseInspectionsCount ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.fireInspectionsCount ?? 0}</td>

                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.humanIncidents?.minor ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.humanIncidents?.recordable ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.humanIncidents?.severe ?? 0}</td>

                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.vehicleIncidents?.minor ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.vehicleIncidents?.recordable ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.vehicleIncidents?.severe ?? 0}</td>

                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.fireIncidents?.minor ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.fireIncidents?.recordable ?? 0}</td>
                          <td className="py-0.5 px-0.5 font-mono">{p.inspectionsAndIncidents?.fireIncidents?.severe ?? 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 2: مجوز های پروانه کار صادره (Work Permits Issued) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid space-y-0">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200 flex items-center justify-between px-2">
                      <span>۲. مجوز های پروانه کار صادره (PTW)</span>
                      <span className="font-mono text-[8px]">
                        مجموع پروانه‌های اصلی: {totalMainPermits} | مجموع پروانه‌های الحاقی: {totalAttachedPermits}
                      </span>
                    </div>

                    {/* جدول تفکیک پروانه‌های اصلی */}
                    <table className="w-full table-fixed text-center border-collapse text-[8px] border-b border-black">
                      <thead>
                        <tr className="bg-gray-100 border-b border-black font-bold">
                          <th className="border-l border-black py-0.5 px-1 w-1/3">کار گرم (Hot Work)</th>
                          <th className="border-l border-black py-0.5 px-1 w-1/3">کار سرد (Cold Work)</th>
                          <th className="py-0.5 px-1 w-1/3 bg-gray-200 font-black">مجموع پروانه‌های اصلی</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold font-mono text-[8px]">
                          <td className="border-l border-black py-0.5 px-1">{p.workPermitsIssued?.hotWork ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-1">{p.workPermitsIssued?.coldWork ?? 0}</td>
                          <td className="py-0.5 px-1 bg-gray-50 font-black">{totalMainPermits}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* جدول تفکیک پروانه‌های الحاقی */}
                    <table className="w-full table-fixed text-center border-collapse text-[7.5px] border-b border-black">
                      <colgroup>
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black font-bold text-[7.5px]">
                          <th className="border-l border-black py-0.5 px-0.5">حفاری</th>
                          <th className="border-l border-black py-0.5 px-0.5">ورود به فضا بسته</th>
                          <th className="border-l border-black py-0.5 px-0.5">ورود خودرو / جرثقیل</th>
                          <th className="border-l border-black py-0.5 px-0.5">منابع پرتوزا</th>
                          <th className="border-l border-black py-0.5 px-0.5">جداسازی الکتریکی</th>
                          <th className="border-l border-black py-0.5 px-0.5">جداسازی فرایندی/مکانیکی/ابزار دقیق</th>
                          <th className="py-0.5 px-0.5 bg-gray-200 font-black">مجموع الحاقی</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold font-mono text-[8px]">
                          <td className="border-l border-black py-0.5 px-0.5">{p.workPermitsIssued?.attachedPermits?.excavation ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.workPermitsIssued?.attachedPermits?.confinedSpace ?? p.workPermitsIssued?.confinedSpace ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.workPermitsIssued?.attachedPermits?.vehicleCrane ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.workPermitsIssued?.attachedPermits?.radiation ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.workPermitsIssued?.attachedPermits?.electricalIsolation ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.workPermitsIssued?.attachedPermits?.processIsolation ?? 0}</td>
                          <td className="py-0.5 px-0.5 bg-gray-50 font-black">{totalAttachedPermits}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* سنجه‌های تکمیلی و نظارتی مجوزها */}
                    <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                      <colgroup>
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '34%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 border-b border-black font-semibold text-[7.5px]">
                          <th className="border-l border-black py-0.5 px-0.5">GAS Testers (سنجش گاز آتش‌نشانی)</th>
                          <th className="border-l border-black py-0.5 px-0.5">Stand by (آماده‌باش استندبای)</th>
                          <th className="border-l border-black py-0.5 px-0.5">مجوزهای باطل یا متوقف شده</th>
                          <th className="py-0.5 px-1">یادداشت نظارتی مجوزها</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold text-[7.5px]">
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.workPermitsIssued?.gasTesters ?? 0} مورد</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono">{p.workPermitsIssued?.standby ?? 0} مورد</td>
                          <td className="border-l border-black py-0.5 px-0.5 font-mono text-red-700">{p.workPermitsIssued?.revokedPermits ?? 0} مورد</td>
                          <td className="py-0.5 px-1 text-right font-normal text-[7.5px] text-gray-800 break-words whitespace-normal">
                            {p.workPermitsIssued?.notes || 'کلیه مجوزها تحت نظارت مستقیم ایستگاه صادر گردیدند.'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 3: وضعیت سیستم‌های اطفای حریق آبی و شیرآلات (Water Suppression & Valves) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۳. وضعیت سیستم‌های اطفای حریق آبی و شیرآلات
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                      <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '11.3%' }} />
                        <col style={{ width: '11.3%' }} />
                        <col style={{ width: '11.3%' }} />
                        <col style={{ width: '11.3%' }} />
                        <col style={{ width: '11.4%' }} />
                        <col style={{ width: '11.4%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={4}>Deluge Valve (مخازن ذخیره)</th>
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>ON/OFF Valve (u20)</th>
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>ON/OFF Valve (u40)</th>
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>Rail hose (ریل هوز)</th>
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>Hydrants (هایدرانت‌ها)</th>
                          <th className="border-l border-black py-0.5 px-0.5" rowSpan={2}>Monitors (مانیتورها)</th>
                          <th className="py-0.5 px-0.5" rowSpan={2}>Fire Box (جعبه آتش‌نشانی)</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-0.5">FB-8001A</th>
                          <th className="border-l border-black py-0.5 px-0.5">FB-8001B</th>
                          <th className="border-l border-black py-0.5 px-0.5">FB-4501</th>
                          <th className="border-l border-black py-0.5 px-0.5">FB-4502</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-semibold text-[7.5px]">
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.delugeValves?.fb8001A || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.delugeValves?.fb8001B || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.delugeValves?.fb4501 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.delugeValves?.fb4502 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.onOffValveU20 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.onOffValveU40 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.railHose || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.hydrants || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.waterSuppressionAndValves?.monitors || 'سالم / نرمال'}</td>
                          <td className="py-0.5 px-0.5">{p.waterSuppressionAndValves?.fireBox || 'سالم / نرمال'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 4: وضعیت کپسول‌های اطفای حریق (Fire Extinguishers & Warehouse Cylinders) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۴. وضعیت کپسول‌های اطفای حریق و موجودی انبار
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                      <colgroup>
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.09%' }} />
                        <col style={{ width: '9.1%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={2}>تعداد پودری موجود سایت</th>
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={3}>تعداد گازکربنیک موجود سایت</th>
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={3}>کپسول‌های شارژ شده در انبار</th>
                          <th className="py-0.5 px-0.5" colSpan={3}>کپسول‌های شارژ نشده (نیازمند شارژ)</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7.5px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-0.5">6 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">40 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">6 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">30 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">10 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">40 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">6 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">CO2</th>
                          <th className="border-l border-black py-0.5 px-0.5">40 kg</th>
                          <th className="border-l border-black py-0.5 px-0.5">6 kg</th>
                          <th className="py-0.5 px-0.5">CO2</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold font-mono text-[8px]">
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.powderExisting?.kg6 ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.powderExisting?.kg40 ?? 0}</td>

                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.co2Existing?.kg6 ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.co2Existing?.kg30 ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.co2Existing?.kg10 ?? 0}</td>

                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.warehouseCharged?.kg40 ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.warehouseCharged?.kg6 ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.warehouseCharged?.co2 ?? 0}</td>

                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.warehouseUncharged?.kg40 ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.fireExtinguishers?.warehouseUncharged?.kg6 ?? 0}</td>
                          <td className="py-0.5 px-0.5">{p.fireExtinguishers?.warehouseUncharged?.co2 ?? 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 5: سیستم اطفاء FM200 و اعلام حریق (FM200 & Fire Alarm Systems) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۵. سیستم اطفاء FM200 و سیستم‌های اعلام حریق
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                      <colgroup>
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '12.5%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={2}>سیستم اطفاء FM 200</th>
                          <th className="py-0.5 px-0.5" colSpan={6}>تجهیزات سیستم‌های اعلام حریق</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-0.5">FM200 (Unit 51)</th>
                          <th className="border-l border-black py-0.5 px-0.5">FM200 (Unit 54)</th>
                          <th className="border-l border-black py-0.5 px-0.5">Call Point (شستی اعلام)</th>
                          <th className="border-l border-black py-0.5 px-0.5">دودیاب‌ها (Smoke)</th>
                          <th className="border-l border-black py-0.5 px-0.5">حرارت‌یاب (Heat)</th>
                          <th className="border-l border-black py-0.5 px-0.5">شعله‌یاب (Flame)</th>
                          <th className="border-l border-black py-0.5 px-0.5">آژیرها (Horns/Sirens)</th>
                          <th className="py-0.5 px-0.5">تابلو مرکزی (FACP Panel)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-semibold text-[7.5px]">
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.fm200?.unit51 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.fm200?.unit54 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.alarmSystems?.callPoints || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.alarmSystems?.smokeDetectors || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.alarmSystems?.heatDetectors || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.alarmSystems?.flameDetectors || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.alarmSystems?.hornsSirens || 'سالم / نرمال'}</td>
                          <td className="py-0.5 px-0.5">{p.gaseousAndAlarmSystems?.alarmSystems?.mainPanel || 'سالم / نرمال'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 6: وضعیت ناوگان خودروهای آتش‌نشانی و امداد (Fire & Rescue Fleet Status) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۶. وضعیت ناوگان خودروهای آتش‌نشانی و امداد
                    </div>
                    {vehicleList.length === 0 ? (
                      <div className="text-center py-1 text-[8px] text-gray-500">خودرویی در این شیفت ثبت نشده است</div>
                    ) : (
                      <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                        <colgroup>
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '17%' }} />
                          <col style={{ width: '17%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '30%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-100 border-b border-black print:bg-gray-100 font-bold">
                            <th className="border-l border-black py-0.5 px-0.5">کد خودرو</th>
                            <th className="border-l border-black py-0.5 px-1">نام و مدل خودرو</th>
                            <th className="border-l border-black py-0.5 px-1">نوع کاربری</th>
                            <th className="border-l border-black py-0.5 px-1">پلاک / شناسه</th>
                            <th className="border-l border-black py-0.5 px-1">وضعیت عملیاتی</th>
                            <th className="py-0.5 px-1">توضیحات، میزان آب، فوم، پمپ و سوخت</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehicleList.map((v, idx) => (
                            <tr key={v.key || idx} className="border-b border-gray-300 last:border-b-0 font-medium text-[7.5px]">
                              <td className="border-l border-black py-0.5 px-0.5 font-mono font-bold text-red-900">{v.code || '-'}</td>
                              <td className="border-l border-black py-0.5 px-1 font-bold text-right">{v.name}</td>
                              <td className="border-l border-black py-0.5 px-1">{v.vehicleType || '-'}</td>
                              <td className="border-l border-black py-0.5 px-1 font-mono">{v.plate || '-'}</td>
                              <td
                                className={`border-l border-black py-0.5 px-1 font-bold ${
                                  v.status === 'خارج از سرویس'
                                    ? 'text-red-700'
                                    : v.status === 'در حال تعمیر' || v.status === 'دارای نقص جزئی'
                                    ? 'text-amber-700'
                                    : 'text-black'
                                }`}
                              >
                                {v.status}
                              </td>
                              <td className="py-0.5 px-1 text-right text-gray-800">{v.description || 'آماده‌به‌کار و مخازن پر'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 7: وضعیت گازیاب‌های موجود در مجتمع (Fixed & Portable Gas Detectors) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۷. وضعیت گازیاب‌های ثابت و پرتابل مجتمع
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[7px]">
                      <colgroup>
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '8.5%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '10.5%' }} />
                        <col style={{ width: '7.5%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8.5%' }} />
                        <col style={{ width: '12.5%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100 text-[7.5px]">
                          <th className="border-l border-black py-0.5 px-0.5" colSpan={7}>گازیاب‌های ثابت واحدهای مجتمع</th>
                          <th className="py-0.5 px-0.5" colSpan={5}>گازیاب‌های متحرک و پرتابل</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-0.5">Unit 01</th>
                          <th className="border-l border-black py-0.5 px-0.5">Unit 20</th>
                          <th className="border-l border-black py-0.5 px-0.5">Unit 21</th>
                          <th className="border-l border-black py-0.5 px-0.5">Unit 40</th>
                          <th className="border-l border-black py-0.5 px-0.5">Utility</th>
                          <th className="border-l border-black py-0.5 px-0.5">مخازن ذخیره</th>
                          <th className="border-l border-black py-0.5 px-0.5">GD</th>

                          <th className="border-l border-black py-0.5 px-0.5">GAS ALERT.B.W</th>
                          <th className="border-l border-black py-0.5 px-0.5">MSA</th>
                          <th className="border-l border-black py-0.5 px-0.5">Cosmos</th>
                          <th className="border-l border-black py-0.5 px-0.5">Crowcon</th>
                          <th className="py-0.5 px-0.5">Crowcon Tripl Plus</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-semibold text-[7px]">
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.unit01 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.unit20 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.unit21 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.unit40 || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.utility || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.storageTanks || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.fixed?.gd || 'سالم / نرمال'}</td>

                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.portable?.gasAlertBW || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.portable?.msa || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.portable?.cosmos || 'سالم / نرمال'}</td>
                          <td className="border-l border-black py-0.5 px-0.5">{p.gasDetectorsStatus?.portable?.crowcon || 'سالم / نرمال'}</td>
                          <td className="py-0.5 px-0.5">{p.gasDetectorsStatus?.portable?.crowconTriplePlus || 'سالم / نرمال'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 8: ایرادات سیستم اعلام حریق (پنل‌های صنعتی و غیرصنعتی) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۸. ایرادات سیستم اعلام حریق (پنل‌های صنعتی و غیرصنعتی)
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[8px]">
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-1" colSpan={3}>ایرادات سیستم اعلام حریق (پنل صنعتی)</th>
                          <th className="py-0.5 px-1" colSpan={3}>ایرادات سیستم اعلام حریق (پنل غیر صنعتی)</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7.5px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-1 w-1/6">Fault (خطا)</th>
                          <th className="border-l border-black py-0.5 px-1 w-1/6">Fire (آلارم حریق)</th>
                          <th className="border-l border-black py-0.5 px-1 w-1/6">Warning (هشدار)</th>
                          <th className="border-l border-black py-0.5 px-1 w-1/6">Fault (خطا)</th>
                          <th className="border-l border-black py-0.5 px-1 w-1/6">Fire (آلارم حریق)</th>
                          <th className="py-0.5 px-1 w-1/6">Warning (هشدار)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold font-mono text-[8px]">
                          <td className="border-l border-black py-0.5 px-1">{p.alarmSystemFaults?.industrialPanel?.fault ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-1 text-red-600">{p.alarmSystemFaults?.industrialPanel?.fire ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-1 text-amber-600">{p.alarmSystemFaults?.industrialPanel?.warning ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-1">{p.alarmSystemFaults?.nonIndustrialPanel?.fault ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-1 text-red-600">{p.alarmSystemFaults?.nonIndustrialPanel?.fire ?? 0}</td>
                          <td className="py-0.5 px-1 text-amber-600">{p.alarmSystemFaults?.nonIndustrialPanel?.warning ?? 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 9: انجام بازرسی اولیه، حضور به‌صورت STANDBY و اسکورت تانکرها */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۹. انجام بازرسی اولیه، حضور به‌صورت STANDBY و اسکورت تانکرها
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[8px]">
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-1 w-1/3">تعداد اسکورت تانکر پروپیلن</th>
                          <th className="border-l border-black py-0.5 px-1 w-1/3">تعداد اسکورت تانکر پروپان</th>
                          <th className="py-0.5 px-1 w-1/3">ساعات استندبای عملیاتی (h)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-bold font-mono text-[8px]">
                          <td className="border-l border-black py-0.5 px-1">{p.standbyAndEscort?.propyleneTankerEscorts ?? 0}</td>
                          <td className="border-l border-black py-0.5 px-1">{p.standbyAndEscort?.propaneTankerEscorts ?? 0}</td>
                          <td className="py-0.5 px-1">{p.standbyAndEscort?.standbyHours ?? 0} ساعت</td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 10: نشت گازهای سمی و قابل اشتعال (Gas Leaks) */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[8.5px] print:bg-gray-200">
                      ۱۰. نشت گازهای سمی و قابل اشتعال
                    </div>
                    <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                      <colgroup>
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '34%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 border-b border-black print:bg-gray-100">
                          <th className="border-l border-black py-0.5 px-1" rowSpan={2}>نوع گاز</th>
                          <th className="border-l border-black py-0.5 px-1" rowSpan={2}>مقدار نشتی گاز (ppm)</th>
                          <th className="border-l border-black py-0.5 px-1" rowSpan={2}>جهت وزش باد</th>
                          <th className="border-l border-black py-0.5 px-1" rowSpan={2}>محل‌های انتشار نشتی گاز</th>
                          <th className="py-0.5 px-1" colSpan={3}>مدت زمان نشتی</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-black text-[7px] print:bg-gray-50">
                          <th className="border-l border-black py-0.5 px-0.5">زمان شروع</th>
                          <th className="border-l border-black py-0.5 px-0.5">زمان پایان</th>
                          <th className="py-0.5 px-0.5">مدت (دقیقه)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.gasLeaks && p.gasLeaks.length > 0 ? (
                          p.gasLeaks.map((leak, idx) => (
                            <tr key={leak.id || idx} className="border-b border-gray-300 last:border-b-0 font-medium text-[7.5px]">
                              <td className="border-l border-black py-0.5 px-1 font-bold">{leak.gasType}</td>
                              <td className="border-l border-black py-0.5 px-1 font-mono font-bold text-red-600">{leak.amountPpm}</td>
                              <td className="border-l border-black py-0.5 px-1">{leak.windDirection}</td>
                              <td className="border-l border-black py-0.5 px-1 text-right">{leak.leakLocations}</td>
                              <td className="border-l border-black py-0.5 px-0.5 font-mono">{leak.startTime}</td>
                              <td className="border-l border-black py-0.5 px-0.5 font-mono">{leak.endTime}</td>
                              <td className="py-0.5 px-0.5 font-mono font-bold">{leak.durationMinutes}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="text-[7.5px]">
                            <td className="border-l border-black py-0.5 px-1 text-gray-500">-</td>
                            <td className="border-l border-black py-0.5 px-1 text-gray-500 font-mono">0</td>
                            <td className="border-l border-black py-0.5 px-1 text-gray-500">-</td>
                            <td className="border-l border-black py-0.5 px-1 text-gray-500">موردی از نشت گاز در شیفت جاری ثبت و گزارش نگردید.</td>
                            <td className="border-l border-black py-0.5 px-0.5 text-gray-500">-</td>
                            <td className="border-l border-black py-0.5 px-0.5 text-gray-500">-</td>
                            <td className="py-0.5 px-0.5 text-gray-500 font-mono">0</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 11: شرح کار انجام شده در شیفت */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black px-2 py-0.5 font-bold text-[9px] print:bg-gray-200">
                      ۱۱. شرح کار انجام شده در شیفت :
                    </div>
                    <div className="p-1.5 min-h-[28px] whitespace-pre-line text-[8px] leading-snug text-black">
                      {p.workCompletedDescription ||
                        '۱. تست و کنترل آماده‌به‌کاری خودروهای ناوگان، پمپ‌ها و تجهیزات ارتباطی.\n۲. گشت و پایش عمومی محوطه فرآیندی، مشعل، مخازن ذخیره و نظارت بر فعالیت‌های گرم و سرد.'}
                    </div>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 12: نواقص و نیازمندی‌ها */}
                  {/* ========================================================================= */}
                  <section className="border border-black print-page-break-inside-avoid">
                    <div className="bg-gray-200 border-b border-black px-2 py-0.5 font-bold text-[9px] print:bg-gray-200">
                      ۱۲. نواقص و نیازمندی‌ها :
                    </div>
                    <div className="p-1.5 min-h-[24px] whitespace-pre-line text-[8px] leading-snug text-black">
                      {p.defectsAndNeeds || 'نقص فعالی گزارش نگردیده است و تمامی ادوات در وضعیت نرمال می‌باشند.'}
                    </div>
                  </section>

                  {/* ========================================================================= */}
                  {/* Section 13 (Optional): پارامترها و سنجه‌های داینامیک اختصاصی */}
                  {/* ========================================================================= */}
                  {p.dynamicCustomItems && p.dynamicCustomItems.length > 0 && (
                    <section className="border border-black print-page-break-inside-avoid">
                      <div className="bg-gray-200 border-b border-black text-center font-bold py-0.5 text-[9px] print:bg-gray-200 flex items-center justify-between px-2">
                        <span>۱۳. پارامترها و سنجه‌های داینامیک اختصاصی ثبت‌شده در شیفت</span>
                        <span className="font-mono text-[8.5px]">{p.dynamicCustomItems.length} سنجه فعال</span>
                      </div>
                      <table className="w-full table-fixed text-center border-collapse text-[7.5px]">
                        <colgroup>
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '22%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-100 border-b border-black font-bold">
                            <th className="border-l border-black py-0.5 px-0.5">ردیف</th>
                            <th className="border-l border-black py-0.5 px-0.5">بخش / رسته</th>
                            <th className="border-l border-black py-0.5 px-1">نام آیتم / سنجه</th>
                            <th className="border-l border-black py-0.5 px-0.5">نوع سنجه</th>
                            <th className="border-l border-black py-0.5 px-0.5">مقدار ثبت‌شده</th>
                            <th className="border-l border-black py-0.5 px-0.5">واحد</th>
                            <th className="py-0.5 px-1">یادداشت / استاندارد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.dynamicCustomItems.map((item, idx) => (
                            <tr key={item.id || idx} className="border-b border-gray-300 last:border-b-0 font-medium text-[7.5px]">
                              <td className="border-l border-black py-0.5 px-0.5 font-mono">{idx + 1}</td>
                              <td className="border-l border-black py-0.5 px-0.5 font-bold text-gray-800">{item.categoryFa || '-'}</td>
                              <td className="border-l border-black py-0.5 px-1 font-bold text-right">{item.nameFa}</td>
                              <td className="border-l border-black py-0.5 px-0.5 text-[7px] text-gray-700">
                                {item.itemType === 'status'
                                  ? 'وضعیت عملیاتی'
                                  : item.itemType === 'number'
                                  ? 'عددی'
                                  : item.itemType === 'text'
                                  ? 'متنی'
                                  : 'بولی'}
                              </td>
                              <td className="border-l border-black py-0.5 px-0.5 font-mono font-bold">
                                {item.itemType === 'status'
                                  ? item.statusValue || 'سالم'
                                  : item.itemType === 'number'
                                  ? item.numericValue ?? 0
                                  : item.itemType === 'boolean'
                                  ? item.numericValue
                                    ? 'فعال / OK'
                                    : 'غیرفعال'
                                  : item.textValue || '-'}
                              </td>
                              <td className="border-l border-black py-0.5 px-0.5 text-gray-700">{item.unit || '-'}</td>
                              <td className="py-0.5 px-1 text-right text-gray-700 text-[7px]">{item.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* ========================================================================= */}
                  {/* Signatures Footer: مشخصات و امضای نوبتکار روز و نوبتکار شب */}
                  {/* ========================================================================= */}
                  <footer className="border border-black grid grid-cols-2 text-center print-page-break-inside-avoid">
                    <div className="border-l border-black py-1.5 px-2 space-y-0.5">
                      <div className="font-bold text-[9.5px]">نوبتکار روز</div>
                      <div className="text-[9px] font-semibold text-black">
                        {p.signatures?.dayShiftOfficer?.name ? (
                          <>
                            <span className="font-bold">{p.signatures.dayShiftOfficer.name}</span>
                            {p.signatures.dayShiftOfficer.personnelCode && (
                              <span className="text-gray-700 text-[8.5px] mr-1.5 font-mono font-bold">
                                (کد پرسنلی: {p.signatures.dayShiftOfficer.personnelCode})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">امضا و تایید شیفت روز</span>
                        )}
                      </div>
                      {p.signatures?.dayShiftOfficer?.signed ? (
                        <div className="text-[8.5px] text-emerald-800 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>
                            امضا و تأیید الکترونیکی {p.signatures.dayShiftOfficer.time && `(ساعت ${p.signatures.dayShiftOfficer.time})`}
                          </span>
                        </div>
                      ) : (
                        <div className="h-3 border-b border-dashed border-gray-400 mx-10 mt-1"></div>
                      )}
                    </div>

                    <div className="py-1.5 px-2 space-y-0.5">
                      <div className="font-bold text-[9.5px]">نوبتکار شب</div>
                      <div className="text-[9px] font-semibold text-black">
                        {p.signatures?.nightShiftOfficer?.name ? (
                          <>
                            <span className="font-bold">{p.signatures.nightShiftOfficer.name}</span>
                            {p.signatures.nightShiftOfficer.personnelCode && (
                              <span className="text-gray-700 text-[8.5px] mr-1.5 font-mono font-bold">
                                (کد پرسنلی: {p.signatures.nightShiftOfficer.personnelCode})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">امضا و تایید شیفت شب</span>
                        )}
                      </div>
                      {p.signatures?.nightShiftOfficer?.signed ? (
                        <div className="text-[8.5px] text-emerald-800 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>
                            امضا و تأیید الکترونیکی {p.signatures.nightShiftOfficer.time && `(ساعت ${p.signatures.nightShiftOfficer.time})`}
                          </span>
                        </div>
                      ) : (
                        <div className="h-3 border-b border-dashed border-gray-400 mx-10 mt-1"></div>
                      )}
                    </div>
                  </footer>
                </td>
              </tr>
            </tbody>

            {/* 📑 Repeating Document Footer on Every Printed Page */}
            <tfoot>
              <tr>
                <td className="pt-1">
                  <div className="flex items-center justify-between gap-2 text-[7.5px] text-gray-600 border-t border-black pt-0.5 px-0.5">
                    <div className="font-bold truncate">سامانه جامع مدیریت HSE و آتش‌نشانی مجتمع پتروشیمی رجال</div>
                    <div className="font-mono shrink-0">کد سند: HSE-FR-FIR-001 | شماره گزارش: {p.reportNumber}</div>
                    <div className="shrink-0">وضعیت سند: {p.status === 'FINALIZED' ? 'ثبت نهایی شده' : 'پیش‌نویس عملیاتی'}</div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </article>
      </main>

      {/* Global Screen A4 Vertical Guard + Print Media Rules */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media screen {
            #fire-daily-report-sheet {
              width: 210mm !important;
              min-width: 210mm !important;
              max-width: 210mm !important;
              min-height: 297mm !important;
              box-sizing: border-box !important;
            }
          }
          #fire-daily-report-sheet table {
            width: 100% !important;
          }
          #fire-daily-report-sheet th,
          #fire-daily-report-sheet td {
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          @media print {
            @page {
              size: A4 portrait !important;
              margin: 5mm 6mm 7mm 6mm !important;
            }
            html, body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* Hide the main React application shell completely when printing directly */
            #root,
            #app-layout,
            #app-layout > header,
            #app-sidebar,
            #app-main-sidebar,
            #app-header,
            #app-footer,
            nav,
            aside,
            .no-print,
            .print\\:hidden {
              display: none !important;
            }
            #fire-daily-report-sheet {
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              min-height: auto !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
            }
            .print-page-break-inside-avoid {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            th, td, header, section, footer {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `
        }}
      />
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

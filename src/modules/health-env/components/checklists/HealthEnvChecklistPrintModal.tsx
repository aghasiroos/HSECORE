import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, X, CheckCircle2, AlertTriangle, MinusCircle, 
  Building2, Coffee, UtensilsCrossed, Ambulance, Bath,
  Calendar, MapPin, User, ShieldCheck, FileText, Paperclip,
  Check, ArrowRight, Download, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { HealthEnvInspection, HealthEnvChecklistType } from '../../types/checklistTypes';
import { useSystemBranding, getFormalHeaderBranding } from '../../../../utils/systemBrandingHelper';
import { FormalReportHeader } from '../../../../components/common/FormalReportHeader';
import { printService } from '../../../../services/printService';
import { PrintDocumentSignaturesBox } from '../../../../components/referral/PrintDocumentSignaturesBox';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inspection: HealthEnvInspection | null;
  autoPrintOnOpen?: boolean;
}

export default function HealthEnvChecklistPrintModal({ 
  isOpen, 
  onClose, 
  inspection,
  autoPrintOnOpen = true
}: Props) {
  const { branding } = useSystemBranding();
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const handlePrint = () => {
    if (!inspection) return;
    if (printContainerRef.current) {
      const ok = printService.printElement(printContainerRef.current, {
        title: `چک‌لیست بازرسی بهداشت و محیط زیست - ${inspection.checklistTypeNameFa || inspection.title || ''} - ${inspection.id || ''}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: inspection.id,
        documentDate: inspection.inspectionDate,
        isFa: true,
        autoPrint: true
      });
      if (!ok) {
        window.print();
      }
    } else {
      window.print();
    }
  };

  const handleSavePdf = () => {
    handlePrint();
  };

  // Automatically trigger print after modal opens so user gets instant print dialog
  useEffect(() => {
    if (isOpen && inspection && autoPrintOnOpen) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, inspection?.id, autoPrintOnOpen]);

  if (!isOpen || !inspection) return null;

  const getIcon = (type: HealthEnvChecklistType) => {
    switch (type) {
      case 'premises-buildings': return <Building2 className="w-5 h-5 text-indigo-700" />;
      case 'pantries-kitchenettes': return <Coffee className="w-5 h-5 text-amber-700" />;
      case 'restaurant-dining': return <UtensilsCrossed className="w-5 h-5 text-emerald-700" />;
      case 'ambulance-equipment': return <Ambulance className="w-5 h-5 text-rose-700" />;
      case 'workshop-restrooms': return <Bath className="w-5 h-5 text-sky-700" />;
      default: return <FileText className="w-5 h-5 text-slate-700" />;
    }
  };

  const failedItems = inspection.items.filter(i => i.verdict === 'fail');
  const todayFa = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const getIntervalLabel = (interval?: string) => {
    switch (interval) {
      case 'DAILY': return 'روزانه';
      case 'MONTHLY': return 'ماهانه';
      case 'QUARTERLY': return 'سه‌ماهه (فصلی)';
      case 'SEMI_ANNUAL': return 'شش‌ماهه';
      case 'ANNUAL': return 'سالانه';
      default: return 'ماهانه';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 print:p-0 print:bg-white print:static" dir="rtl">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:rounded-none print:border-none print:overflow-visible">
        
        {/* Controls Bar (Hidden during print) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white">
                برگه رسمی چک‌لیست عملیاتی بهداشت و محیط زیست
              </h3>
              <p className="text-[11px] text-slate-300">
                قالب استاندارد A4 و RTL منطبق با سربرگ، آرم و لوگوی رسمی سامانه
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-slate-300 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(prev - 10, 60))}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
                title="کوچک‌نمایی"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono px-1 font-bold min-w-[36px] text-center text-[11px]">{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(prev + 10, 140))}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
                title="بزرگ‌نمایی"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="p-1 hover:bg-slate-700 rounded transition cursor-pointer"
                title="اندازه ۱۰۰٪"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSavePdf}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="خروجی PDF"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>ذخیره PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              title="چاپ رسمی فرم A4 یا ارسال به چاپگر"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فرم رسمی A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div 
          ref={printContainerRef}
          id="health-env-checklist-print-container"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className="p-6 sm:p-8 overflow-y-auto space-y-5 text-right print:p-2 print:overflow-visible font-sans bg-white transition-transform duration-150"
        >
          {/* Custom Print Media Styles */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 8mm;
              }
              *, *:before, *:after {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                direction: rtl !important;
                text-align: right !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background: #ffffff !important;
              }
              #health-env-checklist-print-container {
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                transform: none !important;
              }
              .print-break-inside-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `}} />

          {/* 1. Official Institutional Header strictly following System Logo & Branding Tab */}
          <div className="print-break-inside-avoid">
            <FormalReportHeader
              isFa={true}
              title={inspection.checklistTypeNameFa || inspection.title}
              subtitle={`چک‌لیست بازرسی و نظارت بهداشت و محیط زیست (${inspection.title})`}
              docCode={inspection.id}
              revision="01"
              issueDate={inspection.inspectionDate}
              classification="سند رسمی بازرسی بهداشت و محیط زیست"
              siteName={inspection.site}
              departmentName={inspection.unit || 'واحد بهداشت، ایمنی و محیط زیست (HSE)'}
              className="print-break-inside-avoid mb-2"
            />
          </div>

          {/* Sub-Bar: Checklist Operational Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs print-break-inside-avoid">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                {getIcon(inspection.checklistTypeId)}
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">دسته‌بندی چک‌لیست:</span>
                <span className="font-black text-slate-900">{inspection.checklistTypeNameFa}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-500 block">عنوان ارزیابی:</span>
                <strong className="text-slate-800">{inspection.title}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">ساعت ثبت:</span>
                <strong className="font-mono text-teal-800">{inspection.inspectionTime || '-'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">تاریخ چاپ:</span>
                <strong className="font-mono text-slate-700">{todayFa}</strong>
              </div>
            </div>
          </div>

          {/* Metadata & Schedule Information Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 print-break-inside-avoid">
            <div>
              <span className="text-slate-500 block mb-0.5">سایت / مجتمع:</span>
              <strong className="text-slate-800">{inspection.site || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">واحد / اداره:</span>
              <strong className="text-slate-800">{inspection.unit || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">موقعیت / نام محل:</span>
              <strong className="text-slate-800">{inspection.areaLocation || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">شناسه / پلاک تجهیز:</span>
              <strong className="text-slate-800 font-mono">{inspection.equipmentOrFacilityCode || '-'}</strong>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">بازرس بهداشت:</span>
              <strong className="text-slate-800">{inspection.inspectorName || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">سرپرست ناظر:</span>
              <strong className="text-slate-800">{inspection.supervisorName || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">نوع زمان‌بندی:</span>
              <strong className="text-slate-800">
                {inspection.scheduleType === 'ADHOC' ? 'موردی (بر حسب نیاز)' : 'دوره‌ای و زمان‌بندی‌شده'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">
                {inspection.scheduleType === 'ADHOC' ? 'تناوب بازرسی:' : 'دوره و موعد بعدی:'}
              </span>
              <strong className="text-slate-800">
                {inspection.scheduleType === 'ADHOC' 
                  ? 'فاقد تکرار دوره‌ای اجباری'
                  : `${getIntervalLabel(inspection.periodicInterval)} ${inspection.nextInspectionDate ? `(موعد بعدی: ${inspection.nextInspectionDate})` : ''}`
                }
              </strong>
            </div>
          </div>

          {/* Score & KPI Summary Box */}
          <div className="grid grid-cols-4 gap-3 text-center print-break-inside-avoid">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 block font-bold">کل موارد بازرسی</span>
              <strong className="text-base font-black text-slate-800 font-mono">{inspection.totalItems}</strong>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <span className="text-[10px] text-emerald-700 block font-bold">موارد منطبق (مطلوب)</span>
              <strong className="text-base font-black text-emerald-800 font-mono">{inspection.passedCount}</strong>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <span className="text-[10px] text-rose-700 block font-bold">موارد عدم انطباق</span>
              <strong className="text-base font-black text-rose-800 font-mono">{inspection.failedCount}</strong>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
              <span className="text-[10px] text-teal-700 block font-bold">شاخص انطباق بهداشتی</span>
              <strong className="text-base font-black text-teal-800 font-mono">{inspection.scorePercent}%</strong>
            </div>
          </div>

          {/* Checklist Items Table */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-slate-800 border-r-4 border-teal-600 pr-2">
              ریز اقلام و چک‌لیست تفصیلی بازدید
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2 w-28">دسته‌بندی</th>
                    <th className="p-2">شرح مورد کنترلی و الزام بهداشتی</th>
                    <th className="p-2 w-24 text-center">وضعیت انطباق</th>
                    <th className="p-2 w-44">مشاهدات و توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {inspection.items.map((item, idx) => (
                    <tr key={item.itemId || idx} className={item.verdict === 'fail' ? 'bg-rose-50/40 print-break-inside-avoid' : 'print-break-inside-avoid'}>
                      <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-700 text-[11px]">{item.category}</td>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{item.title}</div>
                        {item.requirement && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.requirement}</div>
                        )}
                        {item.standardRef && (
                          <div className="text-[9px] font-mono text-teal-700 mt-0.5">استاندارد: {item.standardRef}</div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {item.verdict === 'pass' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> مطلوب
                          </span>
                        )}
                        {item.verdict === 'fail' && (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> نامطلوب
                          </span>
                        )}
                        {item.verdict === 'na' && (
                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                            <MinusCircle className="w-3.5 h-3.5" /> نامرتبط
                          </span>
                        )}
                        {!item.verdict && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="p-2 text-[11px] text-slate-700">
                        {item.defectDescription || item.comment || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Items / CAPA Table (if any defects) */}
          {failedItems.length > 0 && (
            <div className="print-break-inside-avoid">
              <h2 className="text-xs font-black text-rose-800 mb-2 border-r-4 border-rose-600 pr-2">
                فهرست نواقص، اقدامات اصلاحی پیشنهادی (CAPA) و مسئولین پیگیری
              </h2>
              <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/20">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-rose-100/70 text-rose-900 font-bold border-b border-rose-200">
                    <tr>
                      <th className="p-2 w-8 text-center">#</th>
                      <th className="p-2">شرح نقص بهداشتی</th>
                      <th className="p-2">اقدام اصلاحی لازم (CAPA)</th>
                      <th className="p-2 w-32">مسئول پیگیری</th>
                      <th className="p-2 w-24 text-center">مهلت اقدام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {failedItems.map((item, idx) => (
                      <tr key={item.itemId || idx}>
                        <td className="p-2 text-center text-rose-700 font-mono font-bold">{idx + 1}</td>
                        <td className="p-2 font-bold text-slate-900">{item.defectDescription || item.title}</td>
                        <td className="p-2 text-slate-800">{item.correctiveAction || item.comment || 'رفع نقص و بازبینی مجدد'}</td>
                        <td className="p-2 text-slate-700 font-medium">{item.responsiblePerson || 'مسئول واحد'}</td>
                        <td className="p-2 text-center font-mono text-rose-800 font-bold">{item.dueDate || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* General Findings & Notes */}
          {(inspection.findingsSummary || inspection.immediateActionsTaken || inspection.recommendedCapa) && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 print-break-inside-avoid">
              {inspection.findingsSummary && (
                <div>
                  <strong className="text-slate-800 block mb-0.5">خلاصه مشاهدات بازرسی:</strong>
                  <p className="text-slate-600 leading-relaxed">{inspection.findingsSummary}</p>
                </div>
              )}
              {inspection.immediateActionsTaken && (
                <div>
                  <strong className="text-slate-800 block mb-0.5">اقدامات فوری انجام‌شده حین بازدید:</strong>
                  <p className="text-slate-600 leading-relaxed">{inspection.immediateActionsTaken}</p>
                </div>
              )}
              {inspection.recommendedCapa && (
                <div>
                  <strong className="text-slate-800 block mb-0.5">توصیه‌های کلان و برنامه بهبود:</strong>
                  <p className="text-slate-600 leading-relaxed">{inspection.recommendedCapa}</p>
                </div>
              )}
            </div>
          )}

          {/* Attachments Section in Print */}
          {inspection.attachments && inspection.attachments.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 print-break-inside-avoid">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">
                <Paperclip className="w-4 h-4 text-teal-600" />
                <span>پیوست‌ها و اسناد منضم به چک‌لیست ({inspection.attachments.length} مورد)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {inspection.attachments.map((att) => (
                  <div key={att.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="truncate font-medium text-slate-800" title={att.name}>{att.name}</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                      {att.size ? `${Math.round(att.size / 1024)} KB` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Digital Signatures and Referral Matrix */}
          <div className="print-break-inside-avoid">
            <PrintDocumentSignaturesBox
              documentType="AUDIT_CHECKLIST"
              documentId={inspection.id}
              isFa={true}
              title="ماتریس گردش کار ارجاع، امضاها و تاییدات مسئولین"
              fallbackSignatories={[
                { 
                  roleTitle: 'کارشناس / نماینده واحد', 
                  subTitle: 'کارشناس بهداشت و محیط زیست', 
                  defaultName: inspection.inspectorName || 'کارشناس بهداشت' 
                },
                { 
                  roleTitle: 'سرپرست / مسئول واحد', 
                  subTitle: 'مسئول هماهنگی و رفع نقص', 
                  defaultName: inspection.supervisorName || 'سرپرست واحد' 
                },
                { 
                  roleTitle: 'رئیس مرکز HSE', 
                  subTitle: 'ریاست بهداشت، ایمنی و محیط زیست', 
                  defaultName: inspection.hseManagerName || inspection.approvedBy || 'رئیس مرکز HSE' 
                }
              ]}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

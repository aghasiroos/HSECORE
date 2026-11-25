import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { SafetyIncidentRecord } from '../../types';
import { useSystemBranding, getFormalHeaderBranding } from '../../utils/systemBrandingHelper';
import { HseLogo } from '../HseLogo';
import {
  RHS_F68_FACTOR_CATEGORIES,
  WORKFLOW_STAGE_META,
  computeRhsF68Rpn,
  getIncidentWorkflowStage,
} from '../../utils/rhsF68Config';
import { toPersianDigits } from '../../utils/jalaliDate';
import { printService } from '../../services/printService';

interface RhsF68PrintViewModalProps {
  incident: SafetyIncidentRecord;
  isOpen: boolean;
  onClose: () => void;
  isFa?: boolean;
}

const RHS_F68_PRINT_CUSTOM_CSS = `
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }
  #rhs-f68-a4-printable-sheet {
    width: 100% !important;
    max-width: 190mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'Vazirmatn', Tahoma, sans-serif !important;
    direction: rtl !important;
    text-align: right !important;
  }
  #rhs-f68-a4-printable-sheet table {
    width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
  }
  #rhs-f68-a4-printable-sheet td,
  #rhs-f68-a4-printable-sheet th {
    border-color: #000000 !important;
    color: #000000 !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  #rhs-f68-a4-printable-sheet .rhs-f68-section-band {
    background-color: #e2e8f0 !important;
    color: #000000 !important;
    border: 1.5px solid #000000 !important;
  }
  #rhs-f68-a4-printable-sheet .rhs-f68-cell-label {
    background-color: #f8fafc !important;
  }
  #rhs-f68-a4-printable-sheet .avoid-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
`;

export const RhsF68PrintViewModal: React.FC<RhsF68PrintViewModalProps> = ({
  incident,
  isOpen,
  onClose,
  isFa = true,
}) => {
  const { branding } = useSystemBranding();
  const formalBranding = getFormalHeaderBranding(branding);

  if (!isOpen) return null;

  const rhs = incident.rhsF68;
  const review = rhs?.hseUnitReview;
  const follow = rhs?.correctiveFollowUp;
  const conclusion = rhs?.finalConclusion;
  const factors = rhs?.eventFactors;

  const rpnCalc =
    rhs?.riskAssessment ||
    (incident.riskAssessment
      ? computeRhsF68Rpn(
          incident.riskAssessment.probability,
          incident.riskAssessment.severity,
          incident.riskAssessment.detection
        )
      : undefined);

  const stage = getIncidentWorkflowStage(incident);
  const stageMeta = WORKFLOW_STAGE_META[stage];

  const isUnsafeAct = incident.category === 'Unsafe Act';
  const isUnsafeCond = incident.category === 'Unsafe Condition';
  const isNearMiss = incident.category === 'Near Miss';
  const isLegacyCategory = !isUnsafeAct && !isUnsafeCond && !isNearMiss;

  const involvedList = rhs?.involvedPersonnel || [];
  const attachmentsList = rhs?.attachments || [];

  const fmt = (val?: string | number | null): string => {
    if (val === undefined || val === null) return '—';
    const str = String(val).trim();
    if (!str) return '—';
    return isFa ? toPersianDigits(str) : str;
  };

  const handlePrint = () => {
    printService.printElement('rhs-f68-a4-printable-sheet', {
      title: `RHS-F68-Rev01_${incident.reportNumber}`,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '8mm 10mm',
      documentCode: 'RHS – F68. REV.01',
      documentDate: rhs?.reportDate || incident.eventDate,
      isFa,
      autoPrint: true,
      customStyles: RHS_F68_PRINT_CUSTOM_CSS,
    });
  };

  const PaperCheckBox = ({ checked }: { checked?: boolean }) => (
    <span
      className={`inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-black leading-none ml-1 align-middle select-none ${
        checked ? 'bg-black text-white' : 'bg-white text-black'
      }`}
      aria-hidden="true"
    >
      {checked ? '✓' : ''}
    </span>
  );

  const firstFactorRow = RHS_F68_FACTOR_CATEGORIES.slice(0, 4);
  const secondFactorRow = RHS_F68_FACTOR_CATEGORIES.slice(4, 8);

  const renderFactorCell = (cat: (typeof RHS_F68_FACTOR_CATEGORIES)[number]) => {
    const catData = factors?.[cat.key];
    const selectedSet = new Set(catData?.selectedItems || []);
    const customSelectedItems = (catData?.selectedItems || []).filter(
      (item) => !cat.items.includes(item)
    );
    const note = catData?.customNote?.trim();

    return (
      <td
        key={cat.key}
        className="border border-black p-1 align-top w-1/4 text-[8.5px] leading-[1.32]"
      >
        <div className="font-black bg-slate-100 border-b border-black px-1 py-0.5 mb-1 text-[9px] text-center">
          {toPersianDigits(cat.titleFa)}
        </div>
        <div className="space-y-0.5">
          {cat.items.map((item) => {
            const isChecked = selectedSet.has(item);
            return (
              <div key={item} className="flex items-start gap-1">
                <PaperCheckBox checked={isChecked} />
                <span className={isChecked ? 'font-bold text-black' : 'text-slate-800'}>
                  {toPersianDigits(item)}
                </span>
              </div>
            );
          })}
          {customSelectedItems.map((customItem) => (
            <div key={customItem} className="flex items-start gap-1">
              <PaperCheckBox checked={true} />
              <span className="font-bold text-black">{toPersianDigits(customItem)}</span>
            </div>
          ))}
        </div>
        {note && (
          <div className="mt-1 pt-0.5 border-t border-dashed border-slate-500 text-[8px] text-slate-900">
            <span className="font-bold">توضیح: </span>
            {toPersianDigits(note)}
          </div>
        )}
      </td>
    );
  };

  const followStatusLabel = (status?: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'تایید و مختومه';
      case 'COMPLETED':
        return 'اجرا شده (در انتظار تایید)';
      case 'IN_PROGRESS':
        return 'در حال اجرا';
      default:
        return 'باز / در انتظار اقدام';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div
        className="bg-white rounded-2xl max-w-6xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden"
        dir="rtl"
      >
        {/* Top Action Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-rose-600 text-[11px] font-black font-mono">
              RHS – F68. REV.01
            </span>
            <div>
              <h3 className="text-sm font-black">
                {isFa
                  ? `پیش‌نمایش رسمی A4 — گزارش شماره ${fmt(incident.reportNumber)}`
                  : `Official A4 Print Preview — ${incident.reportNumber}`}
              </h3>
              <p className="text-[11px] text-slate-300">
                {isFa
                  ? 'قالب منطبق با فرم مرجع RHS-F68 Rev.01 برای چاپ مستقیم و ذخیره PDF استاندارد A4'
                  : 'Official RHS-F68 Rev.01 A4 portrait print/PDF template'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{isFa ? 'چاپ رسمی / ذخیره PDF (A4)' : 'Print / Save PDF (A4)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Paper Desk */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-200">
          <div className="mx-auto w-[210mm] min-w-[210mm] bg-white shadow-xl border border-slate-400 p-[8mm_10mm]">
            <div
              id="rhs-f68-a4-printable-sheet"
              dir="rtl"
              className="w-full bg-white text-black text-[9.5px] leading-[1.4] font-sans"
            >
              {/* ==================== HEADER BOX (RHS-F68 REV.01) ==================== */}
              <table className="w-full table-fixed border-collapse border-[1.5px] border-black mb-1.5 avoid-break">
                <tbody>
                  <tr>
                    {/* Right Cell: Organization Logo + Complex Name */}
                    <td className="border border-black w-[25%] p-1.5 text-center align-middle">
                      <div className="flex items-center justify-center min-h-[46px]">
                        {formalBranding.logoUrl ? (
                          <img
                            src={formalBranding.logoUrl}
                            alt={branding.organizationNameFa}
                            referrerPolicy="no-referrer"
                            className="max-h-12 max-w-full mx-auto object-contain"
                          />
                        ) : (
                          <HseLogo size="md" forceDefault={true} showShadow={false} />
                        )}
                      </div>
                      <div className="text-[8.5px] font-black mt-1 leading-tight">
                        {branding.organizationNameFa || 'مجتمع پتروشیمی / صنعتی'}
                      </div>
                    </td>

                    {/* Center Cell: Official Form Title */}
                    <td className="border border-black w-[47%] p-2 text-center align-middle">
                      <div className="text-[13px] font-black tracking-tight text-black">
                        فرم گزارش حادثه / شبه حادثه / رفتار و شرایط ناایمن
                      </div>
                      <div className="text-[9.5px] font-bold text-slate-800 mt-1">
                        Incident / Near Miss / Unsafe Act &amp; Unsafe Condition Report
                      </div>
                      <div className="text-[8.5px] font-bold text-slate-700 mt-1">
                        واحد بهداشت، ایمنی و محیط زیست (HSE)
                      </div>
                    </td>

                    {/* Left Cell: Document Metadata Table */}
                    <td className="border border-black w-[28%] p-0 align-top">
                      <table className="w-full table-fixed border-collapse text-[9px]">
                        <tbody>
                          <tr>
                            <td className="border-b border-black px-1.5 py-1 font-bold bg-slate-100 w-[42%]">
                              کد فرم:
                            </td>
                            <td className="border-b border-black px-1.5 py-1 font-mono font-black text-center">
                              RHS – F68
                            </td>
                          </tr>
                          <tr>
                            <td className="border-b border-black px-1.5 py-1 font-bold bg-slate-100">
                              بازنگری:
                            </td>
                            <td className="border-b border-black px-1.5 py-1 font-mono font-black text-center">
                              REV.01
                            </td>
                          </tr>
                          <tr>
                            <td className="border-b border-black px-1.5 py-1 font-bold bg-slate-100">
                              شماره گزارش:
                            </td>
                            <td className="border-b border-black px-1.5 py-1 font-mono font-black text-center">
                              {fmt(incident.reportNumber)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-1.5 py-1 font-bold bg-slate-100">تاریخ ثبت:</td>
                            <td className="px-1.5 py-1 font-mono font-bold text-center">
                              {fmt(rhs?.reportDate || incident.createdDate)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ==================== SECTION 1: REPORTER ==================== */}
              <div className="avoid-break mb-1.5">
                <div className="rhs-f68-section-band bg-slate-200 text-black text-center font-black py-1 text-[10px] border-[1.5px] border-b-0 border-black">
                  ۱- این بخش توسط گزارش‌دهنده تکمیل شود (Completed by Reporter)
                </div>
                <table className="w-full table-fixed border-collapse border-[1.5px] border-black">
                  <tbody>
                    {/* Report Type */}
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50"
                      >
                        <span className="font-black ml-3">نوع گزارش:</span>
                        <span className="inline-flex items-center ml-5 font-bold">
                          <PaperCheckBox checked={isUnsafeAct} /> رفتار ناایمن (Unsafe Act)
                        </span>
                        <span className="inline-flex items-center ml-5 font-bold">
                          <PaperCheckBox checked={isUnsafeCond} /> شرایط ناایمن (Unsafe Condition)
                        </span>
                        <span className="inline-flex items-center font-bold">
                          <PaperCheckBox checked={isNearMiss} /> شبه حادثه (Near Miss)
                        </span>
                        {isLegacyCategory && (
                          <span className="inline-flex items-center mr-4 font-bold">
                            <PaperCheckBox checked={true} /> {incident.categoryFa || incident.category}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Reporter Identification */}
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[17%]">
                        نام و نام خانوادگی:
                      </td>
                      <td className="border border-black p-1.5 font-bold w-[22%]">
                        {fmt(incident.reporterName)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[14%]">
                        شماره پرسنلی:
                      </td>
                      <td className="border border-black p-1.5 font-mono w-[15%]">
                        {fmt(incident.reporterPersonnelCode)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[10%]">
                        شرکت:
                      </td>
                      <td className="border border-black p-1.5 w-[22%]">
                        {fmt(rhs?.companyName || incident.companyName)}
                      </td>
                    </tr>

                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        واحد سازمانی:
                      </td>
                      <td className="border border-black p-1.5">{fmt(incident.department)}</td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        عنوان شغلی:
                      </td>
                      <td className="border border-black p-1.5" colSpan={2}>
                        {fmt(rhs?.reporterJobTitle || incident.reporterJobTitle)}
                      </td>
                      <td className="border border-black p-1.5 text-[8.5px]">
                        <span className="font-bold">وضعیت پرونده: </span>
                        <span>{stageMeta?.labelFa || incident.status}</span>
                      </td>
                    </tr>

                    {/* Subject & Location */}
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        موضوع گزارش:
                      </td>
                      <td colSpan={5} className="border border-black p-1.5 font-black">
                        {fmt(incident.title)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        واحد / محوطه:
                      </td>
                      <td className="border border-black p-1.5" colSpan={2}>
                        {fmt(incident.locationSite)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        محل دقیق وقوع:
                      </td>
                      <td className="border border-black p-1.5" colSpan={2}>
                        {fmt(rhs?.exactLocation || incident.exactLocation)}
                      </td>
                    </tr>

                    {/* Event Date & Time */}
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        تاریخ وقوع / مشاهده:
                      </td>
                      <td className="border border-black p-1.5 font-mono font-bold">
                        {fmt(incident.eventDate)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        ساعت وقوع / مشاهده:
                      </td>
                      <td className="border border-black p-1.5 font-mono font-bold">
                        {fmt(incident.eventTime)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        اقدام فوری:
                      </td>
                      <td className="border border-black p-1.5">
                        {fmt(incident.immediateActionTaken)}
                      </td>
                    </tr>

                    {/* Involved / Violating Personnel */}
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold align-top">
                        فرد / افراد خاطی و مرتبط:
                      </td>
                      <td colSpan={5} className="border border-black p-1">
                        {involvedList.length > 0 ? (
                          <table className="w-full table-fixed border-collapse text-[8.5px]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-black px-1 py-0.5 font-bold w-[28%]">
                                  نام و نام خانوادگی
                                </th>
                                <th className="border border-black px-1 py-0.5 font-bold w-[16%]">
                                  کد پرسنلی
                                </th>
                                <th className="border border-black px-1 py-0.5 font-bold w-[20%]">
                                  شرکت / پیمانکار
                                </th>
                                <th className="border border-black px-1 py-0.5 font-bold w-[18%]">
                                  سمت / واحد
                                </th>
                                <th className="border border-black px-1 py-0.5 font-bold w-[18%]">
                                  نقش در رویداد
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {involvedList.map((p, idx) => (
                                <tr key={p.id || idx}>
                                  <td className="border border-black px-1 py-0.5 font-bold">
                                    {fmt(p.fullName)}
                                  </td>
                                  <td className="border border-black px-1 py-0.5 font-mono text-center">
                                    {fmt(p.personnelCode)}
                                  </td>
                                  <td className="border border-black px-1 py-0.5">
                                    {fmt(p.company || (p.isContractor ? 'پیمانکار' : ''))}
                                  </td>
                                  <td className="border border-black px-1 py-0.5">
                                    {fmt(p.jobTitle || p.department)}
                                  </td>
                                  <td className="border border-black px-1 py-0.5">
                                    {fmt(p.roleInEvent)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <span className="px-1">{fmt(incident.injuredPersonName)}</span>
                        )}
                      </td>
                    </tr>

                    {/* Description */}
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold align-top">
                        شرح رویداد:
                      </td>
                      <td colSpan={5} className="border border-black p-1.5 align-top">
                        <div className="min-h-[42px] whitespace-pre-wrap">
                          {fmt(incident.description)}
                        </div>
                      </td>
                    </tr>

                    {/* Suggestions */}
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold align-top">
                        پیشنهادات گزارش‌دهنده:
                      </td>
                      <td colSpan={5} className="border border-black p-1.5 align-top">
                        <div className="min-h-[26px] whitespace-pre-wrap">
                          {fmt(rhs?.suggestions)}
                        </div>
                      </td>
                    </tr>

                    {/* Reporter Sign-off */}
                    <tr>
                      <td colSpan={4} className="border border-black p-1.5 align-middle">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px]">
                          <span>
                            <strong className="font-bold">نام و نام خانوادگی تنظیم‌کننده: </strong>
                            <span className="font-black">{fmt(incident.reporterName)}</span>
                          </span>
                          <span>
                            <strong className="font-bold">تاریخ امضا: </strong>
                            <span className="font-mono font-bold">
                              {fmt(
                                rhs?.reporterSignedDate || rhs?.reportDate || incident.eventDate
                              )}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td colSpan={2} className="border border-black p-1 text-center align-middle">
                        <div className="text-[8.5px] font-bold mb-0.5">امضا تنظیم‌کننده:</div>
                        <div className="min-h-[34px] flex items-center justify-center">
                          {rhs?.reporterSignature ? (
                            <img
                              src={rhs.reporterSignature}
                              alt="امضای گزارش‌دهنده"
                              className="max-h-9 mx-auto object-contain"
                            />
                          ) : (
                            <span className="text-slate-400 text-[8.5px]">محل امضا</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ==================== SECTION 2: HSE UNIT TRIAGE ==================== */}
              <div className="avoid-break mb-1.5">
                <div className="rhs-f68-section-band bg-slate-200 text-black text-center font-black py-1 text-[10px] border-[1.5px] border-b-0 border-black">
                  ۲- این قسمت توسط واحد HSE تکمیل گردد (رئیس واحد HSE)
                </div>
                <table className="w-full table-fixed border-collapse border-[1.5px] border-black">
                  <tbody>
                    <tr>
                      <td
                        colSpan={3}
                        className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold"
                      >
                        <span className="ml-3 font-black">وضعیت بازرسی:</span>
                        <span className="inline-flex items-center ml-4">
                          <PaperCheckBox checked={review?.inspectionStatus === 'INSPECTED'} />{' '}
                          بازرسی انجام شده است
                        </span>
                        <span className="inline-flex items-center">
                          <PaperCheckBox
                            checked={review?.inspectionStatus === 'NO_INSPECTION_NEEDED'}
                          />{' '}
                          نیاز به بازرسی ندارد
                        </span>
                      </td>
                      <td
                        colSpan={3}
                        className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold"
                      >
                        <span className="ml-3 font-black">درخواست اقدام اصلاحی:</span>
                        <span className="inline-flex items-center ml-4">
                          <PaperCheckBox checked={review?.actionRequired === true} /> درخواست
                          اقدام دارد
                        </span>
                        <span className="inline-flex items-center">
                          <PaperCheckBox checked={review?.actionRequired === false} /> درخواست
                          اقدام ندارد
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[17%]">
                        نتیجه بازرسی:
                      </td>
                      <td colSpan={5} className="border border-black p-1.5 whitespace-pre-wrap">
                        {fmt(review?.inspectionResult)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        کارشناس مربوطه:
                      </td>
                      <td colSpan={2} className="border border-black p-1.5 font-bold">
                        {fmt(review?.assignedExpertName)}
                        {review?.assignedExpertCode
                          ? ` (${fmt(review.assignedExpertCode)})`
                          : ''}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[15%]">
                        توضیحات رئیس HSE:
                      </td>
                      <td colSpan={2} className="border border-black p-1.5 whitespace-pre-wrap">
                        {fmt(review?.hseHeadNotes)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="border border-black p-1.5 align-middle">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px]">
                          <span>
                            <strong className="font-bold">نام رئیس HSE / جانشین رئیس: </strong>
                            <span className="font-black">{fmt(review?.hseHeadName)}</span>
                          </span>
                          <span>
                            <strong className="font-bold">تاریخ: </strong>
                            <span className="font-mono font-bold">
                              {fmt(review?.hseHeadSignedDate)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td colSpan={2} className="border border-black p-1 text-center align-middle">
                        <div className="text-[8.5px] font-bold mb-0.5">
                          امضا رئیس HSE / جانشین رئیس:
                        </div>
                        <div className="min-h-[34px] flex items-center justify-center">
                          {review?.hseHeadSignature ? (
                            <img
                              src={review.hseHeadSignature}
                              alt="امضای رئیس HSE"
                              className="max-h-9 mx-auto object-contain"
                            />
                          ) : (
                            <span className="text-slate-400 text-[8.5px]">محل امضا</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ==================== SECTION 3: 8 EVENT FACTORS & RISK (RPN) ==================== */}
              <div className="mb-1.5">
                <div className="rhs-f68-section-band bg-slate-200 text-black text-center font-black py-1 text-[10px] border-[1.5px] border-b-0 border-black">
                  ۳- کارشناس واحد HSE — مشخص نمودن فاکتورهای رویداد و ارزیابی ریسک (RPN)
                </div>

                {/* Fixed 4x2 Table showing ALL 8 Categories & Checkboxes strictly like official form */}
                <table className="w-full table-fixed border-collapse border-[1.5px] border-black mb-1.5">
                  <tbody>
                    <tr className="avoid-break">{firstFactorRow.map(renderFactorCell)}</tr>
                    <tr className="avoid-break">{secondFactorRow.map(renderFactorCell)}</tr>
                  </tbody>
                </table>

                {/* Risk Assessment / RPN Table (Exact 5-Column RTL RHS-F68 Rev.01 Layout) */}
                <table className="w-full table-fixed border-collapse border-[1.5px] border-black text-center avoid-break">
                  <tbody>
                    <tr className="bg-slate-100 font-black text-[9px]">
                      <th className="border border-black p-1.5 w-[22%]">ارزیابی ریسک</th>
                      <th className="border border-black p-1.5 w-[10%] font-mono">۱ - ۵</th>
                      <th className="border border-black p-1.5 w-[14%] font-mono">RPN</th>
                      <th className="border border-black p-1.5 w-[20%]">سطح ریسک</th>
                      <td
                        rowSpan={4}
                        className="border border-black p-1.5 w-[34%] bg-white text-right align-middle text-[8.5px] leading-[1.6]"
                      >
                        <div className="font-black text-center border-b border-black pb-0.5 mb-1 text-[8.5px]">
                          جدول تعیین سطح ریسک (P × S × D)
                        </div>
                        <div className="space-y-0.5 font-bold">
                          <div className="flex items-center gap-1">
                            <PaperCheckBox checked={rpnCalc?.riskLevel === 'E'} />
                            <span>({toPersianDigits('50-125')}) ریسک شدید یا بارز (E)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <PaperCheckBox checked={rpnCalc?.riskLevel === 'H'} />
                            <span>({toPersianDigits('25-49')}) ریسک بالا (H)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <PaperCheckBox checked={rpnCalc?.riskLevel === 'M'} />
                            <span>({toPersianDigits('11-24')}) ریسک متوسط (M)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <PaperCheckBox checked={rpnCalc?.riskLevel === 'L'} />
                            <span>({toPersianDigits('1-10')}) ریسک پایین (L)</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="text-[9px]">
                      <td className="border border-black p-1.5 font-bold bg-slate-50 text-right">
                        احتمال وقوع (P)
                      </td>
                      <td className="border border-black p-1.5 font-mono font-black text-[11px]">
                        {fmt(rpnCalc?.probability)}
                      </td>
                      <td
                        rowSpan={3}
                        className="border border-black p-1.5 font-mono font-black text-[14px] bg-slate-50 align-middle"
                      >
                        {fmt(rpnCalc?.rpn)}
                        {rpnCalc?.rpn ? (
                          <div className="text-[8px] font-normal text-slate-600 mt-0.5">
                            {fmt(rpnCalc.probability)}×{fmt(rpnCalc.severity)}×{fmt(rpnCalc.detection)}
                          </div>
                        ) : null}
                      </td>
                      <td
                        rowSpan={3}
                        className="border border-black p-1.5 font-sans font-black text-[10px] align-middle"
                      >
                        {rpnCalc?.riskLevelFa ? toPersianDigits(rpnCalc.riskLevelFa) : '—'}
                        {rpnCalc?.riskLevel ? (
                          <div className="font-mono text-[10px] mt-0.5">({rpnCalc.riskLevel})</div>
                        ) : null}
                      </td>
                    </tr>
                    <tr className="text-[9px]">
                      <td className="border border-black p-1.5 font-bold bg-slate-50 text-right">
                        شدت پیامد (S)
                      </td>
                      <td className="border border-black p-1.5 font-mono font-black text-[11px]">
                        {fmt(rpnCalc?.severity)}
                      </td>
                    </tr>
                    <tr className="text-[9px]">
                      <td className="border border-black p-1.5 font-bold bg-slate-50 text-right">
                        قابل تشخیص بودن (D)
                      </td>
                      <td className="border border-black p-1.5 font-mono font-black text-[11px]">
                        {fmt(rpnCalc?.detection)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ==================== SECTION 4: CORRECTIVE ACTIONS & FOLLOW-UP ==================== */}
              <div className="avoid-break mb-1.5">
                <div className="rhs-f68-section-band bg-slate-200 text-black text-center font-black py-1 text-[10px] border-[1.5px] border-b-0 border-black">
                  ۴- اقدامات اصلاحی و پیگیری (Corrective Actions &amp; Follow-up)
                </div>
                <table className="w-full table-fixed border-collapse border-[1.5px] border-black">
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[18%]">
                        شماره اقدام اصلاحی:
                      </td>
                      <td className="border border-black p-1.5 font-mono w-[15%]">
                        {fmt(follow?.correctiveActionNumber)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[17%]">
                        شماره درخواست کار:
                      </td>
                      <td className="border border-black p-1.5 font-mono w-[16%]">
                        {fmt(follow?.workOrderNumber)}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[14%]">
                        شماره نامه:
                      </td>
                      <td className="border border-black p-1.5 font-mono w-[20%]">
                        {fmt(follow?.letterNumber)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold align-top">
                        شرح اقدامات اتخاذ شده:
                      </td>
                      <td colSpan={5} className="border border-black p-1.5 align-top">
                        <div className="min-h-[30px] whitespace-pre-wrap">
                          {fmt(follow?.actionsTakenDescription)}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        تاریخ اقدام / سررسید:
                      </td>
                      <td className="border border-black p-1.5 font-mono" colSpan={2}>
                        <span>{fmt(follow?.actionDate)}</span>
                        {follow?.dueDate ? (
                          <span className="mr-2 font-sans text-[8.5px]">
                            (سررسید: <span className="font-mono">{fmt(follow.dueDate)}</span>)
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold">
                        واحد و مسئول اجرا:
                      </td>
                      <td className="border border-black p-1.5" colSpan={2}>
                        {fmt(follow?.responsibleUnit)}
                        {follow?.responsiblePerson
                          ? ` — ${fmt(follow.responsiblePerson)}`
                          : ''}
                        <span className="block text-[8px] text-slate-700 mt-0.5">
                          وضعیت: {followStatusLabel(follow?.followUpStatus)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold align-top">
                        نتایج اقدامات انجام شده:
                      </td>
                      <td colSpan={5} className="border border-black p-1.5 align-top">
                        <div className="min-h-[26px] whitespace-pre-wrap">
                          {fmt(follow?.actionResults)}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="border border-black p-1.5 align-middle">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px]">
                          <span>
                            <strong className="font-bold">نام کارشناس / افسر HSE: </strong>
                            <span className="font-black">{fmt(follow?.expertName)}</span>
                          </span>
                          <span>
                            <strong className="font-bold">تاریخ: </strong>
                            <span className="font-mono font-bold">
                              {fmt(follow?.expertSignedDate)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td colSpan={2} className="border border-black p-1 text-center align-middle">
                        <div className="text-[8.5px] font-bold mb-0.5">
                          امضا کارشناس / افسر HSE:
                        </div>
                        <div className="min-h-[34px] flex items-center justify-center">
                          {follow?.expertSignature ? (
                            <img
                              src={follow.expertSignature}
                              alt="امضای کارشناس HSE"
                              className="max-h-9 mx-auto object-contain"
                            />
                          ) : (
                            <span className="text-slate-400 text-[8.5px]">محل امضا</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ==================== SECTION 5: FINAL HSE HEAD CONCLUSION ==================== */}
              <div className="avoid-break mb-1.5">
                <div className="rhs-f68-section-band bg-slate-200 text-black text-center font-black py-1 text-[10px] border-[1.5px] border-b-0 border-black">
                  ۵- رئیس HSE — جمع‌بندی نهایی و اختتام پرونده (Final Conclusion)
                </div>
                <table className="w-full table-fixed border-collapse border-[1.5px] border-black">
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold w-[22%]">
                        تصمیم نهایی واحد HSE:
                      </td>
                      <td colSpan={3} className="border border-black p-1.5 font-bold">
                        <span className="inline-flex items-center ml-6">
                          <PaperCheckBox checked={conclusion?.decision === 'APPROVE_CLOSE'} />{' '}
                          تایید نهایی و اختتام پرونده
                        </span>
                        <span className="inline-flex items-center">
                          <PaperCheckBox
                            checked={conclusion?.decision === 'RETURN_FOR_REVISION'}
                          />{' '}
                          بازگشت جهت تکمیل / اصلاح
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1.5 rhs-f68-cell-label bg-slate-50 font-bold align-top">
                        توضیحات و جمع‌بندی نهایی:
                      </td>
                      <td colSpan={3} className="border border-black p-1.5 align-top">
                        <div className="min-h-[28px] whitespace-pre-wrap">
                          {fmt(conclusion?.conclusionNotes)}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-black p-1.5 align-middle w-[66%]">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px]">
                          <span>
                            <strong className="font-bold">نام رئیس HSE / جانشین رئیس: </strong>
                            <span className="font-black">{fmt(conclusion?.finalHseHeadName)}</span>
                          </span>
                          <span>
                            <strong className="font-bold">تاریخ تایید نهایی: </strong>
                            <span className="font-mono font-bold">
                              {fmt(conclusion?.finalApprovedDate)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td
                        colSpan={2}
                        className="border border-black p-1 text-center align-middle w-[34%]"
                      >
                        <div className="text-[8.5px] font-bold mb-0.5">
                          امضا و مهر رئیس HSE / جانشین رئیس:
                        </div>
                        <div className="min-h-[34px] flex items-center justify-center">
                          {conclusion?.finalHseHeadSignature ? (
                            <img
                              src={conclusion.finalHseHeadSignature}
                              alt="امضای نهایی رئیس HSE"
                              className="max-h-9 mx-auto object-contain"
                            />
                          ) : (
                            <span className="text-slate-400 text-[8.5px]">محل امضا و مهر</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ==================== ATTACHMENTS NOTE & FORM FOOTER ==================== */}
              {attachmentsList.length > 0 && (
                <div className="border border-black px-2 py-1 mb-1 text-[8.5px] bg-slate-50 avoid-break">
                  <strong className="font-black">مستندات و پیوست‌های دیجیتال پرونده ({toPersianDigits(attachmentsList.length)} فایل): </strong>
                  <span>{attachmentsList.map((a) => a.originalName).join(' ، ')}</span>
                </div>
              )}

              <div className="pt-1 border-t border-black flex items-center justify-between text-[8.5px] font-bold text-black avoid-break">
                <div>
                  کد فرم: <span className="font-mono font-black">RHS – F68</span>
                </div>
                <div>
                  شماره بازنگری: <span className="font-mono font-black">01</span>
                </div>
                <div>توزیع نسخ: ۱- مدیریت مجتمع  ۲- واحد HSE  ۳- واحد ذی‌ربط</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

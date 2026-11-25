import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { SafetyIncidentRecord } from '../../types';
import { useSystemBranding, getFormalHeaderBranding } from '../../utils/systemBrandingHelper';
import { toPersianDigits } from '../../utils/jalaliDate';
import { printService } from '../../services/printService';

interface RhsF28PrintViewModalProps {
  incident: SafetyIncidentRecord;
  isOpen: boolean;
  onClose: () => void;
  isFa?: boolean;
}

const RHS_F28_PRINT_CUSTOM_CSS = `
  @page {
    size: A4 portrait;
    margin: 9mm 10mm;
  }
  #rhs-f28-a4-printable-sheet {
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
  #rhs-f28-a4-printable-sheet .avoid-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
`;

export const RhsF28PrintViewModal: React.FC<RhsF28PrintViewModalProps> = ({
  incident,
  isOpen,
  onClose,
  isFa = true,
}) => {
  const { branding } = useSystemBranding();
  const formalBranding = getFormalHeaderBranding(branding);

  if (!isOpen) return null;

  const f28 = incident.rhsF28;

  const fmt = (val?: string | number | null, fallback = ''): string => {
    if (val === undefined || val === null) return fallback;
    const str = String(val).trim();
    if (!str) return fallback;
    return isFa ? toPersianDigits(str) : str;
  };

  const reportDateText = fmt(f28?.reportDate || incident.reportDate, '');
  const reportNumberText = fmt(incident.reportNumber, '');
  const reporterNameText = fmt(f28?.reporterName || incident.reporterName, '');
  const reporterCodeText = fmt(f28?.reporterPersonnelCode || incident.reporterPersonnelCode, '');
  const departmentText = fmt(f28?.department || incident.department, '');
  const obsDateText = fmt(f28?.observationDate || incident.eventDate, '');
  const obsTimeText = fmt(f28?.observationTime || incident.eventTime, '');
  const observationFull = obsDateText
    ? `${obsDateText}${obsTimeText ? `   ساعت ${obsTimeText}` : ''}`
    : obsTimeText;
  const locationText = [
    fmt(f28?.locationSite || incident.locationSite, ''),
    fmt(f28?.exactLocation || incident.exactLocation, ''),
  ]
    .filter(Boolean)
    .join(' — ');
  const isIncidentEvent = f28?.isIncidentEvent !== undefined ? Boolean(f28.isIncidentEvent) : true;

  const injuredNameText = fmt(f28?.injuredPersonName || incident.injuredPersonName, '');
  const injuredJobText = fmt(f28?.injuredPersonJobTitle, '');
  const injuredBodyText = fmt(f28?.injuredBodyPart, '');

  const descriptionText = fmt(f28?.description || incident.description, '');
  const damagesText = fmt(f28?.damagesOrInjuries, '');
  const actionsText = fmt(f28?.actionsTaken || incident.immediateActionTaken, '');
  const recommendationsText = fmt(f28?.recommendations, '');
  const otherNotesText = fmt(f28?.otherNotes, '');

  const hasCustomLogo =
    Boolean(formalBranding.logoUrl) && !String(formalBranding.logoUrl).includes('hsecore');

  const handlePrint = () => {
    printService.printElement('rhs-f28-a4-printable-sheet', {
      title: `RHS-F28-Rev01_${incident.reportNumber}`,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '9mm 10mm',
      documentCode: 'RHS - F28 - Rev 01',
      documentDate: f28?.reportDate || incident.eventDate,
      isFa,
      autoPrint: true,
      customStyles: RHS_F28_PRINT_CUSTOM_CSS,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden"
        dir="rtl"
      >
        {/* Modal Action Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-rose-600 text-[11px] font-black font-mono">
              RHS - F28 - Rev 01
            </span>
            <div>
              <h3 className="text-sm font-black">
                {isFa
                  ? `پیش‌نمایش رسمی A4 — گزارش حادثه / رویداد ${reportNumberText}`
                  : `Official A4 Print Preview — ${incident.reportNumber}`}
              </h3>
              <p className="text-[11px] text-slate-300">
                {isFa
                  ? 'قالب منطبق با فرم مرجع RHS-F28 Rev.01 مرکز بهداشت، ایمنی و محیط زیست پتروشیمی رجال'
                  : 'Official RHS-F28 Rev.01 A4 print template'}
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

        {/* Scrollable A4 Sheet Desk */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-200">
          <div className="mx-auto w-[210mm] min-w-[210mm] bg-white shadow-xl border border-slate-400 p-[9mm_10mm]">
            <div
              id="rhs-f28-a4-printable-sheet"
              dir="rtl"
              className="w-full bg-white text-black font-sans"
              style={{ color: '#000000' }}
            >
              {/* ==================== TOP HEADER (OUTSIDE MAIN BORDER) ==================== */}
              <div className="flex items-start justify-between gap-2 pb-2 avoid-break">
                {/* Right Side (RTL start): Petrochemical Logo + Form Code */}
                <div className="w-[26%] flex flex-col items-center justify-center text-center pt-0.5">
                  {hasCustomLogo && formalBranding.logoUrl ? (
                    <img
                      src={formalBranding.logoUrl}
                      alt={branding.organizationNameFa || 'پتروشیمی رجال'}
                      referrerPolicy="no-referrer"
                      className="max-h-[13mm] max-w-[42mm] object-contain mx-auto"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 select-none" dir="ltr">
                      <svg
                        viewBox="0 0 64 48"
                        className="w-11 h-9 text-black shrink-0"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 6C15.5 6 7 14 7 25c0 9.5 6.8 16.5 16.8 17.6-5.2-3.4-8.4-9.5-8.4-16.6 0-9.6 6.4-16.8 16-18.8C30.2 6.4 29.1 6 28 6Z"
                          fill="#111111"
                        />
                        <text
                          x="22"
                          y="34"
                          fontSize="26"
                          fontWeight="900"
                          fontFamily="Georgia, serif"
                          fill="#111111"
                        >
                          R
                        </text>
                      </svg>
                      <div className="text-left leading-none">
                        <div className="text-[7px] font-black tracking-wider text-black">
                          PETROCHEMICAL
                        </div>
                        <div className="text-[14px] font-black tracking-tight text-black">
                          egal
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="text-[9.5px] font-bold tracking-tight mt-1 text-black" dir="ltr">
                    RHS - F۲۸ - Rev ۰۱
                  </div>
                </div>

                {/* Center: Official Form Titles */}
                <div className="w-[48%] text-center pt-1">
                  <div className="text-[15px] font-black text-black leading-snug">
                    گزارش حادثه / رویداد
                  </div>
                  <div className="text-[12.5px] font-black text-black mt-1 leading-snug">
                    مرکز بهداشت ، ایمنی و محیط زیست پتروشیمی رجال
                  </div>
                </div>

                {/* Left Side (RTL end): Date & Number */}
                <div className="w-[26%] text-right pr-4 pt-1.5 text-[10.5px] font-bold leading-[1.9] text-black">
                  <div className="flex items-center gap-1">
                    <span>تاریخ :</span>
                    <span className="font-mono font-black tabular-nums">
                      {reportDateText || '......./....../.......'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>شماره :</span>
                    <span className="font-mono font-black tabular-nums">
                      {reportNumberText || ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* ==================== MAIN BORDERED BOX ==================== */}
              <div className="border-[2px] border-black w-full">
                {/* SECTION 1: METADATA HEADER STRIP */}
                <div className="border-b-[2px] border-black px-2.5 py-2 space-y-2.5 text-[10.5px] avoid-break">
                  {/* Row 1: 4 fields */}
                  <div className="grid grid-cols-12 gap-2 items-baseline">
                    <div className="col-span-3 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">تاریخ گزارش :</span>
                      <span className="font-mono font-bold tabular-nums">{reportDateText}</span>
                    </div>
                    <div className="col-span-3 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">گزارش دهنده :</span>
                      <span className="font-bold">{reporterNameText}</span>
                    </div>
                    <div className="col-span-3 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">شماره پرسنلی :</span>
                      <span className="font-mono font-bold tabular-nums">{reporterCodeText}</span>
                    </div>
                    <div className="col-span-3 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">واحد سازمانی :</span>
                      <span className="font-bold">{departmentText}</span>
                    </div>
                  </div>

                  {/* Row 2: Observation time & Location */}
                  <div className="grid grid-cols-12 gap-2 items-baseline">
                    <div className="col-span-4 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">زمان مشاهده :</span>
                      <span className="font-mono font-bold tabular-nums">{observationFull}</span>
                    </div>
                    <div className="col-span-8 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">مکان بروز :</span>
                      <span className="font-bold">{locationText}</span>
                    </div>
                  </div>

                  {/* Row 3: Event Checkbox */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold">رویداد ( حادثه )</span>
                    <span
                      className="inline-flex items-center justify-center w-[13px] h-[13px] border-[1.5px] border-black text-[10px] font-black leading-none select-none"
                      aria-hidden="true"
                    >
                      {isIncidentEvent ? '✓' : ''}
                    </span>
                  </div>

                  {/* Row 4: Injured person fields */}
                  <div className="grid grid-cols-12 gap-2 items-baseline">
                    <div className="col-span-5 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">نام و نام خانوادگی مصدوم:</span>
                      <span className="font-bold">{injuredNameText}</span>
                    </div>
                    <div className="col-span-3 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">شغل مصدوم :</span>
                      <span className="font-bold">{injuredJobText}</span>
                    </div>
                    <div className="col-span-4 flex items-baseline gap-1">
                      <span className="font-bold whitespace-nowrap">عضو حادثه دیده :</span>
                      <span className="font-bold">{injuredBodyText}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: شرح مورد */}
                <div className="border-b-[2px] border-black px-2.5 py-2 min-h-[33mm] avoid-break">
                  <div className="text-[11px] font-bold text-black">شرح مورد :</div>
                  <div className="mt-1.5 text-[10.5px] leading-[1.7] whitespace-pre-wrap text-black">
                    {descriptionText}
                  </div>
                </div>

                {/* SECTION 3: خسارات وارده / آسیب به فرد( افراد ) */}
                <div className="border-b-[2px] border-black px-2.5 py-2 min-h-[33mm] avoid-break">
                  <div className="text-[11px] font-bold text-black">
                    خسارات وارده / آسیب به فرد( افراد ) :
                  </div>
                  <div className="mt-1.5 text-[10.5px] leading-[1.7] whitespace-pre-wrap text-black">
                    {damagesText}
                  </div>
                </div>

                {/* SECTION 4: شرح اقدامات انجام شده */}
                <div className="border-b-[2px] border-black px-2.5 py-2 min-h-[33mm] avoid-break">
                  <div className="text-[11px] font-bold text-black">شرح اقدامات انجام شده :</div>
                  <div className="mt-1.5 text-[10.5px] leading-[1.7] whitespace-pre-wrap text-black">
                    {actionsText}
                  </div>
                </div>

                {/* SECTION 5: توصیه برای رفع و اصلاح / پیشگیری از بروز مجدد مورد */}
                <div className="border-b-[2px] border-black px-2.5 py-2 min-h-[30mm] avoid-break">
                  <div className="text-[11px] font-bold text-black">
                    توصیه برای رفع و اصلاح / پیشگیری از بروز مجدد مورد :
                  </div>
                  <div className="mt-1.5 text-[10.5px] leading-[1.7] whitespace-pre-wrap text-black">
                    {recommendationsText}
                  </div>
                </div>

                {/* SECTION 6: سایر توضیحات */}
                <div className="border-b-[2px] border-black px-2.5 py-2 min-h-[24mm] avoid-break">
                  <div className="text-[11px] font-bold text-black">سایر توضیحات :</div>
                  <div className="mt-1.5 text-[10.5px] leading-[1.7] whitespace-pre-wrap text-black">
                    {otherNotesText}
                  </div>
                </div>

                {/* SECTION 7: SIGNATURES (50% / 50% SPLIT) */}
                <div className="grid grid-cols-2 min-h-[32mm] avoid-break">
                  {/* Right Half: Reporter Signature */}
                  <div className="border-l-[2px] border-black px-3 py-2 flex flex-col justify-between">
                    <div className="text-[11px] font-bold text-black flex items-center justify-between gap-2">
                      <span>
                        گزارش دهنده:{' '}
                        {reporterNameText && (
                          <span className="font-normal mr-1">{reporterNameText}</span>
                        )}
                      </span>
                      {f28?.reporterSignedDate && (
                        <span className="text-[9px] font-mono tabular-nums">
                          {fmt(f28.reporterSignedDate)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-end pt-1">
                      {f28?.reporterSignature && (
                        <img
                          src={f28.reporterSignature}
                          alt="امضای گزارش‌دهنده"
                          className="max-h-[14mm] max-w-[44mm] object-contain mb-0.5"
                        />
                      )}
                      <span className="text-[11px] font-bold text-black">امضاء</span>
                    </div>
                  </div>

                  {/* Left Half: HSE Center Head Signature */}
                  <div className="px-3 py-2 flex flex-col justify-between">
                    <div className="text-[11px] font-bold text-black flex items-center justify-between gap-2">
                      <span>
                        رئیس مرکز ایمنی ، بهداشت و محیط زیست :{' '}
                        {f28?.hseCenterHeadName && (
                          <span className="font-normal mr-1">{fmt(f28.hseCenterHeadName)}</span>
                        )}
                      </span>
                      {f28?.hseCenterHeadSignedDate && (
                        <span className="text-[9px] font-mono tabular-nums">
                          {fmt(f28.hseCenterHeadSignedDate)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-end pt-1">
                      {f28?.hseCenterHeadSignature && (
                        <img
                          src={f28.hseCenterHeadSignature}
                          alt="امضای رئیس مرکز HSE"
                          className="max-h-[14mm] max-w-[44mm] object-contain mb-0.5"
                        />
                      )}
                      <span className="text-[11px] font-bold text-black">امضاء</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

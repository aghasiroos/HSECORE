import React from 'react';
import { Printer, X } from 'lucide-react';
import moment from 'moment-jalaali';
import HseLogo from '../../../components/HseLogo';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import { printService } from '../../../services/printService';
import { formatFileSize } from '../../../utils/fileHelpers';
import {
  HseDocumentItem,
  OTHER_TOPIC_CATEGORIES,
  PROMULGATION_STATUS_LABELS,
  evaluateDocumentExpiry,
} from '../types';

interface DocumentPrintModalProps {
  doc: HseDocumentItem | null;
  isFa: boolean;
  onClose: () => void;
}

const CATEGORY_TITLES: Record<string, { fa: string; en: string }> = {
  ORG_PROCEDURES: {
    fa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی',
    en: 'Organizational Instructions & Procedures',
  },
  EQUIPMENT_CERTIFICATES: {
    fa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات',
    en: 'Machinery & Equipment Certificates',
  },
  ORG_FORMS_CHECKLISTS: {
    fa: 'فرم‌ها و چک‌لیست‌های سازمانی',
    en: 'Organizational Forms & Checklists',
  },
  OTHER_HSE_DOCS: {
    fa: 'سایر مستندات مرتبط با HSE',
    en: 'Other HSE Related Documents',
  },
};

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({
  doc,
  isFa,
  onClose,
}) => {
  const { branding } = useSystemBranding();

  if (!doc) return null;

  const meta = doc.tabMetadata || {};
  const catMeta = CATEGORY_TITLES[doc.category] || CATEGORY_TITLES.ORG_PROCEDURES;
  const exp = evaluateDocumentExpiry(doc.expiryDate);

  const handlePrint = () => {
    printService.printElement('hse-doc-printable-card', {
      title: `${doc.documentNumber}-v${doc.version}-${doc.title}`,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '12mm 12mm',
      documentCode: `${doc.documentNumber} / v${doc.version}`,
      documentDate: doc.issueDate || moment().format('jYYYY/jMM/jDD'),
      isFa,
      autoPrint: true,
    });
  };

  const rows: { label: string; value?: string }[] = [
    { label: 'عنوان مستند', value: doc.title },
    { label: 'شماره / کد مدرک', value: doc.documentNumber },
    { label: 'گروه / تب', value: isFa ? catMeta.fa : catMeta.en },
    { label: 'واحد سازمانی مرتبط', value: doc.unitName },
    { label: 'تاریخ صدور / تدوین', value: doc.issueDate || '—' },
    { label: 'تاریخ اعتبار / انقضا', value: doc.expiryDate ? `${doc.expiryDate} (${exp.labelFa})` : 'بدون انقضا' },
  ];

  if (doc.category === 'ORG_PROCEDURES') {
    const prom = meta.promulgationStatus
      ? PROMULGATION_STATUS_LABELS[meta.promulgationStatus]?.fa
      : 'ابلاغ‌شده (معتبر)';
    rows.push(
      { label: 'کد / شماره بازنگری', value: meta.revisionCode || `Rev.${doc.version}` },
      { label: 'تاریخ آخرین بازنگری', value: meta.revisionDate || '—' },
      { label: 'مسئول تهیه', value: meta.preparedBy || '—' },
      { label: 'مسئول تأیید / تصویب‌کننده', value: meta.approvedBy || '—' },
      { label: 'وضعیت ابلاغ', value: prom }
    );
  } else if (doc.category === 'EQUIPMENT_CERTIFICATES') {
    rows.push(
      { label: 'مدل / شماره سریال تجهیز', value: meta.equipmentSerialOrModel || '—' },
      { label: 'شناسه مشترک تجهیز در سایر ماژول‌ها', value: meta.linkedEquipmentCode || '—' },
      { label: 'نوع گواهینامه و بازرسی', value: meta.certificateType || '—' },
      { label: 'شرکت بازرسی‌کننده', value: meta.inspectionCompany || '—' },
      {
        label: 'وضعیت گواهینامه',
        value:
          meta.renewalStatus === 'PENDING_RENEWAL'
            ? 'در انتظار تمدید'
            : exp.labelFa,
      }
    );
  } else if (doc.category === 'ORG_FORMS_CHECKLISTS') {
    rows.push(
      { label: 'حوزه تخصصی HSE', value: meta.hseDomain || '—' },
      { label: 'شماره بازنگری فرم', value: meta.revisionCode || `Rev.${doc.version}` }
    );
  } else if (doc.category === 'OTHER_HSE_DOCS') {
    const topic = OTHER_TOPIC_CATEGORIES.find((t) => t.id === meta.topicCategory)?.fa;
    rows.push(
      { label: 'دسته‌بندی موضوعی', value: topic || '—' },
      { label: 'مرجع صادرکننده', value: meta.issuingAuthority || '—' },
      { label: 'کلیدواژه‌ها', value: meta.tags || '—' }
    );
  }

  return (
    <div className="fixed inset-0 z-[10065] bg-slate-950/75 backdrop-blur-xs flex flex-col p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl px-4 py-3 flex items-center justify-between gap-3 max-w-4xl w-full mx-auto">
        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
          {isFa ? `چاپ برگه شناسنامه مستند — ${doc.title}` : `Print Document Card — ${doc.title}`}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ / خروجی PDF' : 'Print A4'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-4 max-w-4xl w-full mx-auto rounded-b-2xl border-x border-b border-slate-300 dark:border-slate-800">
        <div
          id="hse-doc-printable-card"
          dir={isFa ? 'rtl' : 'ltr'}
          className="bg-white text-slate-900 mx-auto p-6 sm:p-8 shadow-lg max-w-[210mm] text-xs leading-relaxed"
        >
          {/* Official Header */}
          <div className="avoid-break border-2 border-slate-800 mb-5">
            <div className="grid grid-cols-12 items-stretch">
              <div className="col-span-3 p-3 border-e border-slate-800 flex flex-col items-center justify-center text-center gap-1 bg-slate-50">
                <HseLogo size="sm" />
                <div className="text-[10px] font-bold text-slate-800">HSECORE</div>
                <div className="text-[9px] font-bold text-slate-600">
                  {branding?.organizationNameFa || 'مجتمع پتروشیمی رجال'}
                </div>
              </div>
              <div className="col-span-6 p-3 border-e border-slate-800 flex flex-col items-center justify-center text-center">
                <div className="text-sm font-black text-slate-900">
                  شناسنامه کنترل مستندات HSE
                </div>
                <div className="text-xs font-bold text-sky-800 mt-1">{catMeta.fa}</div>
              </div>
              <div className="col-span-3 text-[10px] divide-y divide-slate-800 font-bold">
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">کد مدرک:</span>
                  <span className="font-mono">{doc.documentNumber}</span>
                </div>
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">نسخه جاری:</span>
                  <span className="font-mono">v{doc.version}</span>
                </div>
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">وضعیت:</span>
                  <span>{doc.status === 'ACTIVE' ? 'فعال' : 'آرشیوشده'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Table */}
          <table className="w-full border-collapse border border-slate-400 mb-5">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="w-[32%] bg-slate-50 font-bold text-slate-700 p-2 border border-slate-300">
                    {r.label}
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-900 font-medium">
                    {r.value || '—'}
                  </td>
                </tr>
              ))}
              {doc.description && (
                <tr>
                  <td className="w-[32%] bg-slate-50 font-bold text-slate-700 p-2 border border-slate-300 align-top">
                    توضیحات و دامنه کاربرد
                  </td>
                  <td className="p-2 border border-slate-300 text-slate-900 whitespace-pre-wrap">
                    {doc.description}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Primary File & Versions */}
          <div className="avoid-break mb-5">
            <h4 className="font-bold text-slate-800 mb-2">تاریخچه نسخه‌های سند اصلی</h4>
            <table className="w-full border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 border border-slate-300 text-right">نسخه</th>
                  <th className="p-2 border border-slate-300 text-right">نام فایل</th>
                  <th className="p-2 border border-slate-300 text-right">حجم</th>
                  <th className="p-2 border border-slate-300 text-right">تغییرات</th>
                  <th className="p-2 border border-slate-300 text-right">بارگذاری‌کننده</th>
                </tr>
              </thead>
              <tbody>
                {(doc.versions || []).map((v) => (
                  <tr key={v.fileId}>
                    <td className="p-2 border border-slate-300 font-mono">v{v.version}</td>
                    <td className="p-2 border border-slate-300">{v.originalName}</td>
                    <td className="p-2 border border-slate-300 font-mono">{formatFileSize(v.fileSize)}</td>
                    <td className="p-2 border border-slate-300">{v.changeNote || '—'}</td>
                    <td className="p-2 border border-slate-300">{v.uploadedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Extra Attachments */}
          {(doc.extraAttachments || []).length > 0 && (
            <div className="avoid-break">
              <h4 className="font-bold text-slate-800 mb-2">فایل‌های پیوست تکمیلی</h4>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-2 border border-slate-300 text-right">عنوان / نام فایل</th>
                    <th className="p-2 border border-slate-300 text-right">حجم</th>
                    <th className="p-2 border border-slate-300 text-right">بارگذاری‌کننده</th>
                  </tr>
                </thead>
                <tbody>
                  {(doc.extraAttachments || []).map((att) => (
                    <tr key={att.fileId}>
                      <td className="p-2 border border-slate-300">{att.title || att.originalName}</td>
                      <td className="p-2 border border-slate-300 font-mono">{formatFileSize(att.fileSize)}</td>
                      <td className="p-2 border border-slate-300">{att.uploadedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPrintModal;

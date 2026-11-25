import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  FileDown,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { FormalReportHeader } from '../../../components/common/FormalReportHeader';
import { printService } from '../../../services/printService';
import {
  getInspectionReasonLabelFa,
  getScaffoldTypeLabelFa,
  resolveChecklistAnswer,
  resolveChecklistVerdict,
  SCAFFOLD_TAG_META,
  SCAFFOLD_WORKFLOW_STEPS,
  ScaffoldDetailData,
  ScaffoldInspectionRecord,
  ScaffoldManagementReportData,
  STANDARD_SCAFFOLD_CHECKLIST_ITEMS,
} from './types';

interface CertificateProps {
  mode: 'certificate';
  detail: ScaffoldDetailData;
  inspection?: ScaffoldInspectionRecord | null;
  onClose: () => void;
}

interface SummaryProps {
  mode: 'summary';
  report: ScaffoldManagementReportData;
  onClose: () => void;
}

type Props = CertificateProps | SummaryProps;

function escapeCssContent(str: string): string {
  return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export default function ScaffoldPrintModal(props: Props) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  const triggerPrintOrPdf = (isPdfIntent: boolean) => {
    if (!printRef.current) return;
    const isSummary = props.mode === 'summary';

    if (isSummary) {
      const title = `گزارش-مدیریتی-داربست-${props.report.generatedAtJalali}`;
      printService.printElement(printRef.current, {
        title,
        orientation: 'landscape',
        pageSize: 'A4',
        margin: '10mm 10mm 14mm 10mm',
        isFa: true,
        autoPrint: true,
        documentCode: 'HSE-RP-SCF-01',
        documentDate: props.report.generatedAtJalali,
      });
      return;
    }

    const scaffold = props.detail.scaffold;
    const activeInspection = props.inspection || props.detail.inspections[0] || null;
    const docTag = activeInspection?.inspectionNumber || scaffold.scaffoldCode;
    const title = isPdfIntent
      ? `چک-لیست-ایمنی-نصب-داربست-${docTag}`
      : `چک‌لیست ایمنی نصب داربست - ${docTag}`;

    const safeScaffoldCode = escapeCssContent(scaffold.scaffoldCode);
    const safeWorkOrder = escapeCssContent(scaffold.workRequestNumber || '-');

    const customStyles = `
      @page {
        size: A4 portrait;
        margin: 9mm 9mm 14mm 9mm;
        @bottom-right {
          content: "شناسه داربست: ${safeScaffoldCode}  |  دستور کار: ${safeWorkOrder}";
          font-family: 'Vazirmatn', Tahoma, sans-serif;
          font-size: 8pt;
          font-weight: 700;
          color: #334155;
        }
        @bottom-center {
          content: "چک‌لیست ایمنی نصب داربست — RHS-W14 Rev 00";
          font-family: 'Vazirmatn', Tahoma, sans-serif;
          font-size: 7.5pt;
          color: #64748b;
        }
        @bottom-left {
          content: "صفحه " counter(page) " از " counter(pages);
          font-family: 'Vazirmatn', Tahoma, sans-serif;
          font-size: 8pt;
          font-weight: 700;
          color: #334155;
        }
      }
      .scf-print-page {
        width: 100% !important;
        max-width: 100% !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .scf-checklist-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .scf-checklist-table thead {
        display: table-header-group !important;
      }
      .scf-checklist-table tfoot {
        display: table-footer-group !important;
      }
      .scf-checklist-table tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .scf-checklist-table th,
      .scf-checklist-table td {
        border: 1px solid #475569 !important;
        vertical-align: middle;
        word-wrap: break-word;
      }
      .scf-avoid-break {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    `;

    printService.printElement(printRef.current, {
      title,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '9mm 9mm 14mm 9mm',
      isFa: true,
      autoPrint: true,
      customStyles,
      documentCode: `HSE-FO-SCF-${scaffold.scaffoldCode}`,
      documentDate: activeInspection?.inspectionDate || scaffold.requestDate,
    });
  };

  const renderCertificate = (detail: ScaffoldDetailData, targetInspection?: ScaffoldInspectionRecord | null) => {
    const { scaffold, inspections } = detail;
    const activeInspection = targetInspection || inspections[0] || null;
    const tagMeta = SCAFFOLD_TAG_META[scaffold.tagStatus];
    const workflowLabel =
      SCAFFOLD_WORKFLOW_STEPS.find(s => s.key === scaffold.workflowStatus)?.labelFa || scaffold.workflowStatus;

    const tagColors =
      scaffold.tagStatus === 'GREEN'
        ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
        : scaffold.tagStatus === 'YELLOW'
          ? 'bg-amber-50 border-amber-500 text-amber-950'
          : 'bg-rose-50 border-rose-600 text-rose-950';

    // Always render all 23 rows cleanly even if inspecting a blank pre-inspection dossier
    const checklistRows =
      activeInspection && Array.isArray(activeInspection.checklistItems) && activeInspection.checklistItems.length > 0
        ? activeInspection.checklistItems
        : STANDARD_SCAFFOLD_CHECKLIST_ITEMS.map(tpl => ({
            ...tpl,
            answer: null,
            verdict: null,
            comment: '',
            correctiveAction: '',
            responsiblePerson: '',
            dueDate: '',
          }));

    const sigMeta = activeInspection?.signaturesMeta || {};
    const inspectorSigName =
      sigMeta.inspectorName || activeInspection?.inspectorSignature || activeInspection?.inspectorName || scaffold.inspectorName;
    const inspectorSigCode =
      sigMeta.inspectorPersonnelCode || activeInspection?.inspectorPersonnelCode || scaffold.inspectorPersonnelCode || '';
    const inspectorSigAt =
      sigMeta.inspectorSignedAt ||
      (activeInspection ? `${activeInspection.inspectionDate}${activeInspection.inspectionTime ? ` - ${activeInspection.inspectionTime}` : ''}` : '');

    const unitSupSigName =
      sigMeta.unitSupervisorName || activeInspection?.unitSupervisorSignature || '';
    const unitSupSigCode = sigMeta.unitSupervisorPersonnelCode || '';
    const unitSupSigAt =
      sigMeta.unitSupervisorSignedAt || (unitSupSigName ? inspectorSigAt : '');

    const generalRemarks = activeInspection?.summaryNotes || scaffold.notes || '';

    return (
      <div
        className="scf-print-page bg-white text-slate-900 p-5 sm:p-7 mx-auto shadow-xl border border-slate-300"
        style={{ width: '210mm', maxWidth: '100%' }}
      >
        {/* Official HSECORE Formal Header */}
        <FormalReportHeader
          title="چک‌لیست ایمنی نصب داربست"
          subtitle="Scaffolding Installation Safety Checklist & Official Inspection Record (RHS-W14 Rev 00)"
          docCode={`HSE-FO-SCF-${scaffold.scaffoldCode}`}
          revision="00"
          docDate={activeInspection?.inspectionDate || scaffold.requestDate}
          departmentName="واحد ایمنی و بازرسی‌های فنی (HSECORE)"
          isFa
        />

        {/* Tag & Inspection Status Strip */}
        <div className={`mt-3 p-2.5 rounded-lg border-2 flex items-center justify-between gap-3 ${tagColors}`}>
          <div className="min-w-0">
            <div className="text-xs font-black">{tagMeta.labelFa}</div>
            <div className="text-[10px] mt-0.5 leading-snug">{tagMeta.descriptionFa}</div>
          </div>
          <div className="text-left shrink-0 border-r border-current/20 pr-3 text-[10.5px] space-y-0.5">
            <div>
              <span className="font-bold">شناسه داربست: </span>
              <span className="font-mono font-black">{scaffold.scaffoldCode}</span>
            </div>
            <div>
              <span className="font-bold">شماره بازرسی: </span>
              <span className="font-mono font-bold">{activeInspection?.inspectionNumber || 'ثبت اولیه'}</span>
            </div>
            <div>
              <span className="font-bold">اعتبار تگ: </span>
              <span className="font-mono font-bold">{scaffold.tagValidUntil || 'تا تأیید نهایی'}</span>
            </div>
          </div>
        </div>

        {/* Metadata Header Table (Work Order + Scaffold Specs) */}
        <table className="w-full border-collapse border border-slate-500 text-[10.5px] mt-3">
          <tbody>
            <tr>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5 w-[17%]">شماره دستور کار</td>
              <td className="border border-slate-500 p-1.5 w-[33%] font-mono font-black">
                {scaffold.workRequestNumber || '-'}
              </td>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5 w-[17%]">شماره پروانه کار (PTW)</td>
              <td className="border border-slate-500 p-1.5 w-[33%] font-mono font-bold">
                {scaffold.permitNumber || '-'}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">واحد درخواست‌کننده</td>
              <td className="border border-slate-500 p-1.5 font-bold">{scaffold.requestingUnit}</td>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">محل نصب / ناحیه</td>
              <td className="border border-slate-500 p-1.5">
                {scaffold.installationLocation}
                {scaffold.areaName ? ` (${scaffold.areaName})` : ''}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">واحد عملیاتی / تجهیز</td>
              <td className="border border-slate-500 p-1.5">
                {scaffold.unitName || '-'} / {scaffold.equipmentName || '-'}
              </td>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">نوع و ارتفاع داربست</td>
              <td className="border border-slate-500 p-1.5">
                {getScaffoldTypeLabelFa(scaffold.scaffoldType)} — <strong>{scaffold.heightMeters} متر</strong>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">پیمانکار مجری</td>
              <td className="border border-slate-500 p-1.5">{scaffold.contractorName}</td>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">مسئول نصب داربست</td>
              <td className="border border-slate-500 p-1.5">{scaffold.erectorSupervisorName}</td>
            </tr>
            <tr>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">بازرس واحد HSE</td>
              <td className="border border-slate-500 p-1.5 font-bold">
                {activeInspection?.inspectorName || scaffold.inspectorName}
                {(activeInspection?.inspectorPersonnelCode || scaffold.inspectorPersonnelCode)
                  ? ` (کد: ${activeInspection?.inspectorPersonnelCode || scaffold.inspectorPersonnelCode})`
                  : ''}
              </td>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">تاریخ و ساعت بازرسی</td>
              <td className="border border-slate-500 p-1.5 font-mono">
                {activeInspection
                  ? `${activeInspection.inspectionDate}${activeInspection.inspectionTime ? ` — ${activeInspection.inspectionTime}` : ''}`
                  : scaffold.requestDate}
                {' | '}
                <span className="font-sans text-[10px]">
                  {activeInspection ? getInspectionReasonLabelFa(activeInspection.inspectionReason) : workflowLabel}
                </span>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-500 bg-slate-100 font-bold p-1.5">شرح فعالیت و علت نصب</td>
              <td colSpan={3} className="border border-slate-500 p-1.5">
                {scaffold.activityDescription}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Official 23-Row Checklist Table */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-black bg-slate-800 text-white px-3 py-1.5 rounded-t-md">
            <span>جدول چک‌لیست ۲۳‌بندی ایمنی نصب داربست</span>
            {activeInspection && (
              <span className="font-mono text-[10px]">
                انطباق: {activeInspection.complianceScore}٪ | ایمن: {activeInspection.passedCount} | ناایمن: {activeInspection.failedCount}
                {activeInspection.naCount > 0 ? ` | نامرتبط: ${activeInspection.naCount}` : ''}
              </span>
            )}
          </div>

          <table className="scf-checklist-table w-full border-collapse border border-slate-500 text-[10px]">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-black">
                <th className="border border-slate-500 p-1.5 text-center" style={{ width: '6%' }}>
                  ردیف
                </th>
                <th className="border border-slate-500 p-1.5 text-right" style={{ width: '53%' }}>
                  موارد بازرسی و چک کردن داربست
                </th>
                <th className="border border-slate-500 p-1.5 text-center" style={{ width: '7%' }}>
                  بله
                </th>
                <th className="border border-slate-500 p-1.5 text-center" style={{ width: '7%' }}>
                  خیر
                </th>
                <th className="border border-slate-500 p-1.5 text-right" style={{ width: '27%' }}>
                  اقدام / توضیحات
                </th>
              </tr>
            </thead>
            <tbody>
              {checklistRows.map((it, i) => {
                const safe = it.safeAnswer || 'YES';
                const ans = resolveChecklistAnswer({ ...it, safeAnswer: safe });
                const verdict = resolveChecklistVerdict(ans, safe);
                const isUnsafe = verdict === 'FAIL';

                const remarksParts = [
                  ans === 'NA' ? '[نامرتبط]' : null,
                  it.comment || null,
                  it.correctiveAction ? `اقدام اصلاحی: ${it.correctiveAction}` : null,
                  it.responsiblePerson ? `مسئول: ${it.responsiblePerson}` : null,
                  it.dueDate ? `مهلت: ${it.dueDate}` : null,
                ].filter(Boolean);

                return (
                  <tr
                    key={it.code}
                    className={isUnsafe ? 'bg-rose-50/70' : i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}
                    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                  >
                    <td className="border border-slate-500 p-1.5 text-center font-mono font-bold">
                      {it.orderIndex || i + 1}
                    </td>
                    <td className="border border-slate-500 p-1.5 leading-relaxed font-medium text-slate-900">
                      {it.titleFa}
                    </td>
                    <td className="border border-slate-500 p-1.5 text-center font-black text-sm">
                      {ans === 'YES' ? (
                        <span className={safe === 'YES' ? 'text-emerald-700' : 'text-rose-700'}>✓</span>
                      ) : ans === 'NA' ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="border border-slate-500 p-1.5 text-center font-black text-sm">
                      {ans === 'NO' ? (
                        <span className={safe === 'NO' ? 'text-emerald-700' : 'text-rose-700'}>✓</span>
                      ) : ans === 'NA' ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="border border-slate-500 p-1.5 text-[9.5px] leading-snug text-slate-800">
                      {remarksParts.join(' | ') || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* General Remarks Section (توضیحات کلی) */}
        <div className="scf-avoid-break mt-3 border border-slate-500 rounded-md overflow-hidden">
          <div className="bg-slate-100 border-b border-slate-500 px-2.5 py-1 text-[10.5px] font-black text-slate-800">
            توضیحات کلی
          </div>
          <div className="p-2.5 min-h-[46px] text-[10.5px] leading-relaxed text-slate-800 whitespace-pre-wrap">
            {generalRemarks || '—'}
          </div>
        </div>

        {/* Two Official Signature Blocks (HSE Inspector & Safety Unit Supervisor) */}
        <div
          className="scf-avoid-break grid grid-cols-2 gap-4 mt-4 text-center text-[10.5px]"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <div className="border border-slate-500 rounded-md p-2.5 min-h-[92px] flex flex-col justify-between bg-slate-50/40">
            <div className="font-black text-slate-900 border-b border-slate-300 pb-1">
              محل امضای بازرس واحد HSE
            </div>
            <div className="font-bold text-slate-800 py-1">
              {inspectorSigName || '....................'}
              {inspectorSigCode ? <span className="font-mono text-[9.5px] text-slate-600 mr-1">({inspectorSigCode})</span> : null}
            </div>
            <div className="text-[9.5px] text-slate-600 border-t border-dashed border-slate-400 pt-1 font-mono">
              تاریخ و ساعت: {inspectorSigAt || '..../../.. - ..:..'}
            </div>
          </div>

          <div className="border border-slate-500 rounded-md p-2.5 min-h-[92px] flex flex-col justify-between bg-slate-50/40">
            <div className="font-black text-slate-900 border-b border-slate-300 pb-1">
              محل امضای مسئول واحد ایمنی
            </div>
            <div className="font-bold text-slate-800 py-1">
              {unitSupSigName || '....................'}
              {unitSupSigCode ? <span className="font-mono text-[9.5px] text-slate-600 mr-1">({unitSupSigCode})</span> : null}
            </div>
            <div className="text-[9.5px] text-slate-600 border-t border-dashed border-slate-400 pt-1 font-mono">
              تاریخ و ساعت: {unitSupSigAt || '..../../.. - ..:..'}
            </div>
          </div>
        </div>

        {/* Screen Preview Footer Note (visible on preview; print uses @page bottom boxes) */}
        <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[9.5px] text-slate-500">
          <span className="font-mono font-bold">شناسه داربست: {scaffold.scaffoldCode}</span>
          <span>فرم رسمی چک‌لیست ایمنی نصب داربست — سامانه جامع HSECORE</span>
          <span className="font-mono">RHS-W14 Rev 00</span>
        </div>
      </div>
    );
  };

  const renderSummaryReport = (report: ScaffoldManagementReportData) => (
    <div
      className="bg-white text-slate-900 p-6 sm:p-8 mx-auto shadow-lg border border-slate-300"
      style={{ width: '280mm', maxWidth: '100%' }}
    >
      <FormalReportHeader
        title="گزارش مدیریتی جامع وضعیت داربست‌بندی و تگ‌های ایمنی"
        subtitle="Executive Scaffolding Inspection & Color-Tag Status Summary Report"
        docCode="HSE-RP-SCF-01"
        revision="01"
        docDate={report.generatedAtJalali}
        departmentName="واحد ایمنی و بازرسی‌های فنی (HSECORE)"
        isFa
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-7 gap-2 mt-4 text-center">
        {[
          { label: 'کل داربست‌ها', val: report.kpis.totalScaffolds, cls: 'bg-slate-100 text-slate-900' },
          { label: 'تگ سبز (مجاز)', val: report.kpis.greenTagCount, cls: 'bg-emerald-100 text-emerald-900' },
          { label: 'تگ زرد (اصلاح)', val: report.kpis.yellowTagCount, cls: 'bg-amber-100 text-amber-900' },
          { label: 'تگ قرمز (ممنوع)', val: report.kpis.redTagCount, cls: 'bg-rose-100 text-rose-900' },
          { label: 'در انتظار بازرسی', val: report.kpis.pendingInspectionCount, cls: 'bg-blue-100 text-blue-900' },
          { label: 'دارای نقص باز', val: report.kpis.openDefectsScaffoldsCount, cls: 'bg-orange-100 text-orange-900' },
          { label: 'کل بازرسی‌ها', val: report.kpis.totalInspectionsPerformed, cls: 'bg-indigo-100 text-indigo-900' },
        ].map(k => (
          <div key={k.label} className={`p-2 rounded-lg border border-slate-300 ${k.cls}`}>
            <div className="text-lg font-black font-mono">{k.val}</div>
            <div className="text-[10px] font-bold">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Registry Table */}
      <table className="w-full border-collapse border border-slate-400 text-[10.5px] mt-4">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="border border-slate-400 p-1.5">کد داربست</th>
            <th className="border border-slate-400 p-1.5">واحد درخواست‌کننده</th>
            <th className="border border-slate-400 p-1.5">محل نصب / تجهیز</th>
            <th className="border border-slate-400 p-1.5">شماره PTW</th>
            <th className="border border-slate-400 p-1.5">پیمانکار</th>
            <th className="border border-slate-400 p-1.5">بازرس HSE</th>
            <th className="border border-slate-400 p-1.5">ارتفاع</th>
            <th className="border border-slate-400 p-1.5">وضعیت تگ</th>
            <th className="border border-slate-400 p-1.5">نواقص باز</th>
            <th className="border border-slate-400 p-1.5">آخرین بازرسی / اعتبار</th>
          </tr>
        </thead>
        <tbody>
          {report.items.map(s => (
            <tr key={s.id} style={{ breakInside: 'avoid' }}>
              <td className="border border-slate-400 p-1.5 font-mono font-bold text-center">{s.scaffoldCode}</td>
              <td className="border border-slate-400 p-1.5">{s.requestingUnit}</td>
              <td className="border border-slate-400 p-1.5">
                {s.installationLocation}
                {s.equipmentName ? ` (${s.equipmentName})` : ''}
              </td>
              <td className="border border-slate-400 p-1.5 font-mono text-center">{s.permitNumber || '-'}</td>
              <td className="border border-slate-400 p-1.5">{s.contractorName}</td>
              <td className="border border-slate-400 p-1.5">{s.inspectorName}</td>
              <td className="border border-slate-400 p-1.5 font-mono text-center">{s.heightMeters}m</td>
              <td className="border border-slate-400 p-1.5 text-center font-black">
                {s.tagStatus === 'GREEN' ? (
                  <span className="text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> سبز
                  </span>
                ) : s.tagStatus === 'YELLOW' ? (
                  <span className="text-amber-700 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> زرد
                  </span>
                ) : (
                  <span className="text-rose-700 inline-flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> قرمز
                  </span>
                )}
              </td>
              <td className="border border-slate-400 p-1.5 text-center font-mono">
                {s.openDefectsCount > 0 ? `${s.openDefectsCount} (${s.criticalDefectsCount} بحرانی)` : '0'}
              </td>
              <td className="border border-slate-400 p-1.5 font-mono text-center">
                {s.latestInspectionDate || '-'} {s.tagValidUntil ? `| اعتبار: ${s.tagValidUntil}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/85 backdrop-blur-xs" dir="rtl">
      {/* Sticky Print Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-slate-900 text-white border-b border-slate-700 shrink-0">
        <div className="text-xs sm:text-sm font-black">
          {props.mode === 'summary'
            ? 'پیش‌نمایش چاپ و PDF گزارش مدیریتی داربست‌ها (A4)'
            : `پیش‌نمایش چاپ و PDF چک‌لیست ایمنی نصب داربست — ${props.detail.scaffold.scaffoldCode}`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preview Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(70, z - 15))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="کوچک‌نمایی"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-bold text-slate-200">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(130, z + 15))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="بزرگ‌نمایی"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => triggerPrintOrPdf(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            چاپ مستقیم
          </button>

          <button
            type="button"
            onClick={() => triggerPrintOrPdf(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            دریافت خروجی PDF
          </button>

          <button
            type="button"
            onClick={props.onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="بستن پیش‌نمایش"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable A4 Preview Canvas */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          <div ref={printRef}>
            {props.mode === 'certificate'
              ? renderCertificate(props.detail, props.inspection)
              : renderSummaryReport(props.report)}
          </div>
        </div>
      </div>
    </div>
  );
}

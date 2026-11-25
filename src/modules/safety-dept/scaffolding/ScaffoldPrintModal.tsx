import React, { useRef } from 'react';
import { X, Printer, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { FormalReportHeader } from '../../../components/common/FormalReportHeader';
import { printService } from '../../../services/printService';
import {
  getInspectionReasonLabelFa,
  getScaffoldTypeLabelFa,
  SCAFFOLD_TAG_META,
  SCAFFOLD_WORKFLOW_STEPS,
  ScaffoldDetailData,
  ScaffoldInspectionRecord,
  ScaffoldManagementReportData,
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

export default function ScaffoldPrintModal(props: Props) {
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const isSummary = props.mode === 'summary';
    const title = isSummary
      ? `گزارش مدیریتی وضعیت داربست‌بندی - ${props.report.generatedAtJalali}`
      : `گواهی بازرسی داربست - ${props.detail.scaffold.scaffoldCode}`;

    printService.printElement(printRef.current, {
      title,
      orientation: isSummary ? 'landscape' : 'portrait',
      pageSize: 'A4',
      margin: '10mm 10mm',
      isFa: true,
      autoPrint: true,
      documentCode: isSummary ? 'HSE-RP-SCF-01' : props.detail.scaffold.scaffoldCode,
      documentDate: isSummary
        ? props.report.generatedAtJalali
        : props.detail.scaffold.latestInspectionDate || props.detail.scaffold.requestDate,
    });
  };

  const renderCertificate = (detail: ScaffoldDetailData, targetInspection?: ScaffoldInspectionRecord | null) => {
    const { scaffold, inspections, tagHistory } = detail;
    const activeInspection = targetInspection || inspections[0] || null;
    const tagMeta = SCAFFOLD_TAG_META[scaffold.tagStatus];
    const workflowLabel =
      SCAFFOLD_WORKFLOW_STEPS.find(s => s.key === scaffold.workflowStatus)?.labelFa || scaffold.workflowStatus;

    const tagColors =
      scaffold.tagStatus === 'GREEN'
        ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
        : scaffold.tagStatus === 'YELLOW'
          ? 'bg-amber-100 border-amber-500 text-amber-900'
          : 'bg-rose-100 border-rose-600 text-rose-900';

    return (
      <div className="bg-white text-slate-900 p-6 sm:p-8 mx-auto shadow-lg border border-slate-300" style={{ width: '210mm', maxWidth: '100%' }}>
        <FormalReportHeader
          title="گواهی رسمی بازرسی فنی و وضعیت تگ داربست"
          subtitle="Official Scaffolding Inspection Certificate & Tag Status Record"
          docCode={`HSE-FO-SCF-${scaffold.scaffoldCode}`}
          revision="01"
          docDate={activeInspection?.inspectionDate || scaffold.requestDate}
          departmentName="واحد ایمنی و بازرسی‌های فنی (HSECORE)"
          isFa
        />

        {/* Color Tag Banner */}
        <div className={`mt-4 p-3.5 rounded-xl border-2 flex items-center justify-between gap-4 ${tagColors}`}>
          <div>
            <div className="text-sm font-black">{tagMeta.labelFa}</div>
            <div className="text-[11px] mt-1">{tagMeta.descriptionFa}</div>
          </div>
          <div className="text-left shrink-0 border-r border-current/20 pr-4 text-xs">
            <div>
              <span className="font-bold">شماره داربست: </span>
              <span className="font-mono font-black">{scaffold.scaffoldCode}</span>
            </div>
            <div className="mt-1">
              <span className="font-bold">اعتبار تگ: </span>
              <span className="font-mono font-bold">{scaffold.tagValidUntil || 'نامعتبر / تا رفع نقص'}</span>
            </div>
            <div className="mt-1">
              <span className="font-bold">مرحله فرآیند: </span>
              <span>{workflowLabel}</span>
            </div>
          </div>
        </div>

        {/* Scaffold Specs Grid */}
        <table className="w-full border-collapse border border-slate-400 text-[11px] mt-4">
          <tbody>
            <tr>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2 w-1/6">واحد درخواست‌کننده</td>
              <td className="border border-slate-400 p-2 w-2/6">{scaffold.requestingUnit}</td>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2 w-1/6">شماره پروانه کار (PTW)</td>
              <td className="border border-slate-400 p-2 w-2/6 font-mono font-bold">{scaffold.permitNumber || '-'}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">محل نصب / ناحیه</td>
              <td className="border border-slate-400 p-2">
                {scaffold.installationLocation}{scaffold.areaName ? ` (${scaffold.areaName})` : ''}
              </td>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">شماره درخواست کار</td>
              <td className="border border-slate-400 p-2 font-mono">{scaffold.workRequestNumber || '-'}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">واحد / تجهیز</td>
              <td className="border border-slate-400 p-2">
                {scaffold.unitName || '-'} / {scaffold.equipmentName || '-'}
              </td>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">نوع و ارتفاع داربست</td>
              <td className="border border-slate-400 p-2">
                {getScaffoldTypeLabelFa(scaffold.scaffoldType)} — <strong>{scaffold.heightMeters} متر</strong>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">پیمانکار مجری</td>
              <td className="border border-slate-400 p-2">{scaffold.contractorName}</td>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">مسئول نصب داربست</td>
              <td className="border border-slate-400 p-2">{scaffold.erectorSupervisorName}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">بازرس HSE</td>
              <td className="border border-slate-400 p-2 font-bold">
                {activeInspection?.inspectorName || scaffold.inspectorName}
                {(activeInspection?.inspectorPersonnelCode || scaffold.inspectorPersonnelCode) &&
                  ` (کد: ${activeInspection?.inspectorPersonnelCode || scaffold.inspectorPersonnelCode})`}
              </td>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">تاریخ درخواست / تکمیل نصب</td>
              <td className="border border-slate-400 p-2 font-mono">
                {scaffold.requestDate} / {scaffold.installationCompletedDate || '-'}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 bg-slate-100 font-bold p-2">شرح فعالیت و علت نصب</td>
              <td colSpan={3} className="border border-slate-400 p-2">{scaffold.activityDescription}</td>
            </tr>
          </tbody>
        </table>

        {/* Checklist Table */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-black bg-slate-800 text-white px-3 py-2 rounded-t-lg">
            <span>
              نتایج چک‌لیست استاندارد بازرسی داربست
              {activeInspection ? ` — شماره بازرسی: ${activeInspection.inspectionNumber} (${getInspectionReasonLabelFa(activeInspection.inspectionReason)})` : ''}
            </span>
            {activeInspection && (
              <span>
                امتیاز انطباق: {activeInspection.complianceScore}٪ | تأیید: {activeInspection.passedCount} | عدم تأیید: {activeInspection.failedCount}
              </span>
            )}
          </div>

          {activeInspection ? (
            <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5 w-8 text-center">#</th>
                  <th className="border border-slate-400 p-1.5 text-right">آیتم بازرسی فنی و ایمنی</th>
                  <th className="border border-slate-400 p-1.5 w-20 text-center">وضعیت</th>
                  <th className="border border-slate-400 p-1.5 text-right">توضیحات / اقدام اصلاحی / مسئول رفع نقص</th>
                </tr>
              </thead>
              <tbody>
                {activeInspection.checklistItems.map((it, i) => (
                  <tr key={it.code} style={{ breakInside: 'avoid' }}>
                    <td className="border border-slate-400 p-1.5 text-center font-mono">{i + 1}</td>
                    <td className="border border-slate-400 p-1.5">
                      <span className="font-bold">{it.titleFa}</span>
                      {it.isCritical && <span className="mr-1 text-[9px] font-black text-rose-700">[بحرانی]</span>}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center font-black">
                      {it.verdict === 'PASS' ? (
                        <span className="text-emerald-700">تأیید</span>
                      ) : it.verdict === 'FAIL' ? (
                        <span className="text-rose-700">عدم تأیید</span>
                      ) : (
                        <span className="text-slate-500">نامرتبط</span>
                      )}
                    </td>
                    <td className="border border-slate-400 p-1.5">
                      {[
                        it.comment,
                        it.correctiveAction ? `اقدام اصلاحی: ${it.correctiveAction}` : null,
                        it.responsiblePerson ? `مسئول: ${it.responsiblePerson}` : null,
                        it.dueDate ? `مهلت: ${it.dueDate}` : null,
                      ]
                        .filter(Boolean)
                        .join(' | ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="border border-slate-400 p-4 text-center text-xs text-slate-600">
              هنوز بازرسی رسمی برای این داربست ثبت نشده است.
            </div>
          )}
        </div>

        {/* Recent Tag History Summary */}
        {tagHistory.length > 0 && (
          <div className="mt-4" style={{ breakInside: 'avoid' }}>
            <div className="text-xs font-black text-slate-800 mb-1.5">سوابق صدور و تغییر وضعیت تگ رنگی</div>
            <table className="w-full border-collapse border border-slate-400 text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5">تاریخ و ساعت</th>
                  <th className="border border-slate-400 p-1.5">تغییر تگ</th>
                  <th className="border border-slate-400 p-1.5">اقدام‌کننده</th>
                  <th className="border border-slate-400 p-1.5">علت و توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {tagHistory.slice(0, 5).map(h => (
                  <tr key={h.id}>
                    <td className="border border-slate-400 p-1.5 font-mono text-center">
                      {h.changedDateJalali} - {h.changedTime}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center font-bold">
                      {h.previousTag} ← {h.newTag}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center">{h.changedByName}</td>
                    <td className="border border-slate-400 p-1.5">{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-slate-400 text-center text-[11px]" style={{ breakInside: 'avoid' }}>
          <div className="border border-slate-300 rounded-lg p-3 min-h-[85px] flex flex-col justify-between">
            <div className="font-black text-slate-800">مسئول نصب داربست (پیمانکار)</div>
            <div className="text-slate-600 font-bold">{scaffold.erectorSupervisorName}</div>
            <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-300 pt-1">نام و امضاء</div>
          </div>
          <div className="border border-slate-300 rounded-lg p-3 min-h-[85px] flex flex-col justify-between">
            <div className="font-black text-slate-800">بازرس مجاز HSE</div>
            <div className="text-slate-700 font-bold">{activeInspection?.inspectorName || scaffold.inspectorName}</div>
            <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-300 pt-1">امضاء و مهر بازرس</div>
          </div>
          <div className="border border-slate-300 rounded-lg p-3 min-h-[85px] flex flex-col justify-between">
            <div className="font-black text-slate-800">تأییدکننده نهایی / سرپرست ایمنی</div>
            <div className="text-slate-700 font-bold">{scaffold.approvedBy || 'در انتظار تأیید نهایی'}</div>
            <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-300 pt-1">
              {scaffold.tagValidUntil ? `اعتبار تا: ${scaffold.tagValidUntil}` : 'امضاء و تاریخ'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryReport = (report: ScaffoldManagementReportData) => (
    <div className="bg-white text-slate-900 p-6 sm:p-8 mx-auto shadow-lg border border-slate-300" style={{ width: '280mm', maxWidth: '100%' }}>
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
                {s.installationLocation}{s.equipmentName ? ` (${s.equipmentName})` : ''}
              </td>
              <td className="border border-slate-400 p-1.5 font-mono text-center">{s.permitNumber || '-'}</td>
              <td className="border border-slate-400 p-1.5">{s.contractorName}</td>
              <td className="border border-slate-400 p-1.5">{s.inspectorName}</td>
              <td className="border border-slate-400 p-1.5 font-mono text-center">{s.heightMeters}m</td>
              <td className="border border-slate-400 p-1.5 text-center font-black">
                {s.tagStatus === 'GREEN' ? (
                  <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> سبز</span>
                ) : s.tagStatus === 'YELLOW' ? (
                  <span className="text-amber-700 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> زرد</span>
                ) : (
                  <span className="text-rose-700 inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> قرمز</span>
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
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/80 backdrop-blur-xs" dir="rtl">
      {/* Sticky Print Toolbar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 text-white border-b border-slate-700 shrink-0">
        <div className="text-sm font-black">
          {props.mode === 'summary'
            ? 'پیش‌نمایش چاپ و PDF گزارش مدیریتی داربست‌ها (A4)'
            : `پیش‌نمایش چاپ و PDF گواهی بازرسی داربست ${props.detail.scaffold.scaffoldCode} (A4 عمودی)`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            چاپ رسمی / ذخیره PDF
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable A4 Preview Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div ref={printRef}>
          {props.mode === 'certificate'
            ? renderCertificate(props.detail, props.inspection)
            : renderSummaryReport(props.report)}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Download, FileText, History, Printer, RefreshCw } from 'lucide-react';
import StatusBadge from './StatusBadge';
import Lifting3DViewport, { type Lifting3DViewportHandle } from './Lifting3DViewport';
import { liftingApi } from '../services/liftingApi';
import { printService } from '../../../services/printService';
import type { LiftingCrane, LiftingIntegrationContext, LiftingPlanRecord } from '../types';

interface Props {
  plan: LiftingPlanRecord | null;
  cranes: LiftingCrane[];
  integration: LiftingIntegrationContext | null;
  snapshotDataUrl: string | null;
  onCaptureSnapshot: (dataUrl: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const STATUS_LABEL_FA: Record<string, string> = {
  PASS: 'PASS (تأییدشده)',
  FAIL: 'FAIL (مردود / غیرمجاز)',
  WARNING: 'WARNING (هشدار مهندسی)',
  NOT_VERIFIED: 'NOT VERIFIED (احرازنشده)',
  NOT_APPLICABLE: 'NOT APPLICABLE (نامشخص / غیرمرتبط)',
};

function esc(val: unknown): string {
  return String(val ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function ReportsArchiveTab({
  plan,
  cranes,
  integration,
  snapshotDataUrl,
  onCaptureSnapshot,
  onToast,
}: Props) {
  const hiddenViewportRef = useRef<Lifting3DViewportHandle | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [calculations, setCalculations] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async (planId: number) => {
    setLoadingHistory(true);
    try {
      const data = await liftingApi.getPlanRevisionsAndCalcs(planId);
      setRevisions(data.revisions || []);
      setCalculations(data.calculations || []);
    } catch (err: any) {
      onToast(err?.message || 'خطا در بارگذاری تاریخچه نسخه‌ها', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (plan?.id) {
      loadHistory(plan.id);
    }
  }, [plan?.id, plan?.revisionNumber]);

  if (!plan) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center text-sm text-slate-500">
        ابتدا یک طرح باربرداری را انتخاب کنید.
      </div>
    );
  }

  const primaryCrane = cranes.find((c) => c.id === Number(plan.craneSetup?.primaryCraneId)) || null;
  const linkedRisk = integration?.riskAssessments.find((r) => r.id === plan.linkedRiskAssessmentId) || null;
  const linkedPtw = integration?.workPermits.find((p) => p.id === plan.linkedPermitId) || null;
  const summary: any = plan.latestCalculationSummary || {};

  const captureFromEmbeddedViewport = (): string | null => {
    const dataUrl = hiddenViewportRef.current?.captureSnapshot() || null;
    if (dataUrl) {
      onCaptureSnapshot(dataUrl);
      onToast('تصویر سه‌بعدی باکیفیت با موفقیت برای گزارش پیوست شد.', 'success');
    } else {
      onToast('در حال حاضر تصویر سه‌بعدی در دسترس نیست؛ می‌توانید از تب محاسبات نیز ذخیره کنید.', 'info');
    }
    return dataUrl;
  };

  const buildDossierHtml = (activeSnap: string | null): string => {
    const revRows = revisions
      .map(
        (r) => `
      <tr>
        <td style="font-family:monospace;font-weight:700;">R${esc(r.revisionNumber)}</td>
        <td>${esc(r.changeReason)}</td>
        <td>${esc(r.previousStatus)}</td>
        <td>${esc(r.changedBy)}</td>
        <td style="font-family:monospace;">${r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : '—'}</td>
      </tr>`
      )
      .join('');

    const workflowRows = (plan.workflowApprovals || [])
      .map(
        (w) => `
      <tr>
        <td>${esc(w.stageTitleFa)}</td>
        <td style="font-weight:700;">${esc(w.decision)}</td>
        <td>${esc(w.signerName || '—')} ${w.signerPersonnelCode ? `(${esc(w.signerPersonnelCode)})` : ''}</td>
        <td>${esc(w.comments || '—')}</td>
        <td style="font-family:monospace;">${w.decidedAt ? new Date(w.decidedAt).toLocaleDateString('fa-IR') : '—'}</td>
      </tr>`
      )
      .join('');

    return `
      <div style="direction:rtl;font-family:'Vazirmatn',Tahoma,sans-serif;color:#0f172a;font-size:10.5pt;line-height:1.55;">
        <div style="border:2px solid #0f172a;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:14pt;font-weight:900;">پرونده مهندسی و اجرایی عملیات باربرداری (LIFTING PLAN DOSSIER)</div>
            <div style="font-size:9.5pt;color:#475569;">سامانه یکپارچه مدیریت HSE (HSECORE) | موتور محاسبات ${esc(summary.engineVersion || plan.engineVersion || '2.1.0-core')}</div>
          </div>
          <div style="text-align:left;font-family:monospace;font-size:9.5pt;">
            <div><strong>کد طرح:</strong> ${esc(plan.planCode)}</div>
            <div><strong>نسخه:</strong> R${esc(plan.revisionNumber)} | <strong>تاریخ:</strong> ${esc(plan.plannedDate)}</div>
            <div><strong>وضعیت مهندسی:</strong> ${esc(STATUS_LABEL_FA[plan.engineeringStatus] || plan.engineeringStatus)}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;" border="1" cellpadding="6">
          <thead>
            <tr style="background:#f1f5f9;">
              <th colspan="4" style="text-align:right;">۱. مشخصات کلی عملیات و بار</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td width="20%"><strong>عنوان عملیات:</strong></td><td width="30%">${esc(plan.title)}</td>
              <td width="20%"><strong>دسته‌بندی:</strong></td><td width="30%">${esc(plan.liftCategory)}</td>
            </tr>
            <tr>
              <td><strong>واحد / محل:</strong></td><td>${esc(plan.unitName)} — ${esc(plan.areaLocation)}</td>
              <td><strong>پیمانکار مجری:</strong></td><td>${esc(plan.contractorName || 'تیم داخلی مجتمع')}</td>
            </tr>
            <tr>
              <td><strong>نام و شکل بار:</strong></td><td>${esc(plan.loadName)} (${esc(plan.loadShape)})</td>
              <td><strong>ابعاد (L×W×H):</strong></td><td style="font-family:monospace;">${esc(plan.loadDimensions?.lengthM)} × ${esc(plan.loadDimensions?.widthM)} × ${esc(plan.loadDimensions?.heightM)} m</td>
            </tr>
            <tr>
              <td><strong>وزن خالص / DAF:</strong></td><td style="font-family:monospace;">${esc(plan.netLoadWeightTon)} t | DAF=${esc(plan.dynamicFactor)}</td>
              <td><strong>بار کل طراحی:</strong></td><td style="font-family:monospace;font-weight:800;">${esc(summary.riggingResult?.designTotalLoadTon ?? '—')} t (استاتیک: ${esc(summary.riggingResult?.grossStaticLoadTon ?? '—')} t)</td>
            </tr>
          </tbody>
        </table>

        ${
          activeSnap
            ? `<div class="avoid-break" style="border:1px solid #cbd5e1;padding:10px;margin-bottom:14px;text-align:center;">
                 <div style="font-weight:800;margin-bottom:6px;text-align:right;">۲. نمای سه‌بعدی جانمایی مهندسی، بوم جرثقیل و اسلینگ‌ها (3D Viewport Snapshot)</div>
                 <img src="${activeSnap}" alt="3D Lifting Plan View" style="max-width:100%;max-height:320px;border:1px solid #e2e8f0;" />
               </div>`
            : ''
        }

        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;" border="1" cellpadding="6">
          <thead>
            <tr style="background:#f1f5f9;">
              <th colspan="4" style="text-align:right;">۳. خلاصه محاسبات مهندسی جرثقیل، فشار خاک و Rigging</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td width="22%"><strong>جرثقیل اصلی:</strong></td>
              <td width="28%">${primaryCrane ? `${esc(primaryCrane.name)} (${esc(primaryCrane.model)})` : 'انتخاب نشده'}</td>
              <td width="22%"><strong>طول بوم / شعاع کاری:</strong></td>
              <td width="28%" style="font-family:monospace;">${esc(plan.craneSetup?.boomLengthM || '—')} m / ${esc(plan.craneSetup?.radiusM || '—')} m</td>
            </tr>
            <tr>
              <td><strong>ظرفیت Load Chart:</strong></td>
              <td style="font-family:monospace;">${esc(summary.craneResult?.ratedCapacityTon ?? '—')} t (${esc(summary.craneResult?.status || 'NOT_VERIFIED')})</td>
              <td><strong>درصد بهره‌برداری جرثقیل:</strong></td>
              <td style="font-family:monospace;font-weight:800;">${esc(summary.craneResult?.utilizationPct ?? '—')}%</td>
            </tr>
            <tr>
              <td><strong>فشار ماکزیمم زیر جک‌ها:</strong></td>
              <td style="font-family:monospace;">${esc(summary.craneResult?.groundBearingPressureKpa ?? '—')} kPa (حد مجاز: ${esc(plan.craneSetup?.groundBearingMaxKpa || '—')} kPa)</td>
              <td><strong>حداقل زاویه اسلینگ:</strong></td>
              <td style="font-family:monospace;">${esc(summary.riggingResult?.minHorizontalAngleDeg ?? '—')}° (حداقل مجاز ۴۵°)</td>
            </tr>
          </tbody>
        </table>

        ${
          summary.riggingResult?.staticEquilibrium
            ? `<table style="width:100%;border-collapse:collapse;margin-bottom:14px;" border="1" cellpadding="5">
                 <thead>
                   <tr style="background:#f1f5f9;">
                     <th colspan="4" style="text-align:right;">۳-ب. تحلیل معینی استاتیکی، سازگاری سختی و باقیمانده ۶ درجه آزادی</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr>
                     <td width="22%"><strong>طبقه‌بندی / روش حل:</strong></td>
                     <td width="28%" style="font-family:monospace;">${esc(summary.riggingResult.staticEquilibrium.determinacyClassification)} | ${esc(summary.riggingResult.staticEquilibrium.solutionMethod)}</td>
                     <td width="22%"><strong>مجهول / معادله / DSI:</strong></td>
                     <td width="28%" style="font-family:monospace;">${esc(summary.riggingResult.staticEquilibrium.unknownCount)} / ${esc(summary.riggingResult.staticEquilibrium.independentEquationsCount)} (DSI=${esc(summary.riggingResult.staticEquilibrium.degreeOfIndeterminacy)})</td>
                   </tr>
                   <tr>
                     <td><strong>باقیمانده نیروها (ΣFx/Fy/Fz):</strong></td>
                     <td style="font-family:monospace;">${esc(summary.riggingResult.staticEquilibrium.residuals?.sumFxTon)} / ${esc(summary.riggingResult.staticEquilibrium.residuals?.sumFyTon)} / ${esc(summary.riggingResult.staticEquilibrium.residuals?.sumFzTon)} t</td>
                     <td><strong>باقیمانده گشتاورها (ΣMx/My/Mz):</strong></td>
                     <td style="font-family:monospace;">${esc(summary.riggingResult.staticEquilibrium.residuals?.sumMxTonM)} / ${esc(summary.riggingResult.staticEquilibrium.residuals?.sumMyTonM)} / ${esc(summary.riggingResult.staticEquilibrium.residuals?.sumMzTonM)} t·m</td>
                   </tr>
                   <tr>
                     <td><strong>تشخیص مهندسی:</strong></td>
                     <td colspan="3">${esc(summary.riggingResult.staticEquilibrium.diagnosisFa)}</td>
                   </tr>
                 </tbody>
               </table>`
            : ''
        }

        ${
          (summary.riggingResult?.legs || []).length > 0
            ? `<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9pt;" border="1" cellpadding="4">
                 <thead>
                   <tr style="background:#f1f5f9;">
                     <th>شاخه</th><th>طول مؤثر</th><th>زاویه افقی/عمودی</th><th>Fx/Fy/Fz (t)</th><th>کشش (t)</th><th>WLL مجاز</th><th>%</th><th>کشیدگی (mm)</th><th>مشارکت</th><th>وضعیت</th>
                   </tr>
                 </thead>
                 <tbody>${(summary.riggingResult?.legs || [])
                   .map(
                     (leg: any) => `<tr>
                       <td style="font-weight:700;">${esc(leg.label)} (${esc(leg.id)})</td>
                       <td style="font-family:monospace;">${esc(leg.effectiveLengthM ?? leg.lengthM)} m</td>
                       <td style="font-family:monospace;">${esc(leg.horizontalAngleDeg)}° / ${esc(leg.verticalAngleDeg)}°</td>
                       <td style="font-family:monospace;">${esc(leg.forceVectorTon?.x)} / ${esc(leg.forceVectorTon?.y)} / ${esc(leg.forceVectorTon?.z)}</td>
                       <td style="font-family:monospace;font-weight:700;">${esc(leg.axialTensionTon)} t</td>
                       <td style="font-family:monospace;">${esc(leg.allowableWllTon ?? summary.riggingResult?.effectiveSlingWllTon ?? '—')} t</td>
                       <td style="font-family:monospace;">${leg.slingUtilizationPct !== null && leg.slingUtilizationPct !== undefined ? `${esc(leg.slingUtilizationPct)}%` : '—'}</td>
                       <td style="font-family:monospace;">${leg.axialElongationMm !== null && leg.axialElongationMm !== undefined ? `${esc(leg.axialElongationMm)}` : '—'}</td>
                       <td style="font-family:monospace;">${esc(leg.participationStatus || 'ACTIVE')}</td>
                       <td style="font-family:monospace;">${esc(leg.status)}</td>
                     </tr>`
                   )
                   .join('')}</tbody>
               </table>`
            : ''
        }

        ${
          summary.riggingResult?.sensitivityAnalysis || (summary.riggingResult?.engineeringAssumptions || []).length > 0
            ? `<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9pt;" border="1" cellpadding="5">
                 <thead><tr style="background:#f1f5f9;"><th colspan="2" style="text-align:right;">۳-ج. تحلیل حساسیت و فرضیات مهندسی ثبت‌شده</th></tr></thead>
                 <tbody>
                   ${
                     summary.riggingResult?.sensitivityAnalysis
                       ? `<tr>
                            <td width="25%"><strong>پارامتر حاکم حساسیت:</strong></td>
                            <td>${esc(summary.riggingResult.sensitivityAnalysis.governingParameterFa)} (+${esc(summary.riggingResult.sensitivityAnalysis.maxImpactPct)}% → T_worst=${esc(summary.riggingResult.sensitivityAnalysis.worstCaseLegTensionTon)} t) — ${esc(summary.riggingResult.sensitivityAnalysis.noteFa)}</td>
                          </tr>`
                       : ''
                   }
                   ${(summary.riggingResult?.engineeringAssumptions || [])
                     .map(
                       (a: any) => `<tr>
                         <td style="font-family:monospace;"><strong>${esc(a.category)}</strong> (${esc(a.impactLevel)})</td>
                         <td>${esc(a.statementFa)} <span style="color:#64748b;font-family:monospace;">[${esc(a.technicalBasis)}]</span></td>
                       </tr>`
                     )
                     .join('')}
                 </tbody>
               </table>`
            : ''
        }

        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;" border="1" cellpadding="5">
          <thead><tr style="background:#f1f5f9;"><th colspan="4" style="text-align:right;">۴. تیم اجرایی و پیوندهای یکپارچه HSECORE</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>اپراتور / ریگر:</strong></td><td>${esc(plan.personnelAssignment?.operatorName || '—')} / ${esc(plan.personnelAssignment?.riggerName || '—')}</td>
              <td><strong>طراح / ناظر ایمنی:</strong></td><td>${esc(plan.personnelAssignment?.plannerName || '—')} / ${esc(plan.personnelAssignment?.safetySupervisorName || '—')}</td>
            </tr>
            <tr>
              <td><strong>JSA / ارزیابی ریسک متصل:</strong></td><td>${linkedRisk ? `${esc(linkedRisk.assessmentCode)} — ${esc(linkedRisk.activityTitle)}` : 'متصل نشده'}</td>
              <td><strong>پروانه کار ایمن (PTW):</strong></td><td>${linkedPtw ? `${esc(linkedPtw.permitNumber)} (${esc(linkedPtw.status)})` : 'متصل نشده'}</td>
            </tr>
          </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;" border="1" cellpadding="5">
          <thead>
            <tr style="background:#f1f5f9;"><th colspan="5" style="text-align:right;">۵. جدول امضاها و گردش کار ۹ مرحله‌ای</th></tr>
            <tr style="background:#f8fafc;"><th>مرحله</th><th>وضعیت</th><th>تاییدکننده</th><th>توضیحات</th><th>تاریخ</th></tr>
          </thead>
          <tbody>${workflowRows || '<tr><td colspan="5">رکوردی ثبت نشده</td></tr>'}</tbody>
        </table>

        ${
          revRows
            ? `<table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5">
                 <thead>
                   <tr style="background:#f1f5f9;"><th colspan="5" style="text-align:right;">۶. تاریخچه نسخه‌ها و بازنگری‌ها (Revision Log)</th></tr>
                   <tr style="background:#f8fafc;"><th>نسخه</th><th>علت تغییر</th><th>وضعیت قبل</th><th>تغییردهنده</th><th>تاریخ</th></tr>
                 </thead>
                 <tbody>${revRows}</tbody>
               </table>`
            : ''
        }
      </div>
    `;
  };

  const handlePrintPdf = () => {
    const snap = snapshotDataUrl || hiddenViewportRef.current?.captureSnapshot() || null;
    const html = buildDossierHtml(snap);
    printService.printHtml(html, {
      title: `گزارش مهندسی باربرداری - ${plan.planCode} (R${plan.revisionNumber})`,
      documentCode: `${plan.planCode}-R${plan.revisionNumber}`,
      documentDate: plan.plannedDate,
      orientation: 'portrait',
      pageSize: 'A4',
      isFa: true,
    });
  };

  const handleExportWord = () => {
    const snap = snapshotDataUrl || hiddenViewportRef.current?.captureSnapshot() || null;
    const bodyHtml = buildDossierHtml(snap);
    const wordHtml = `\uFEFF<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${esc(plan.planCode)}</title></head>
<body dir="rtl">${bodyHtml}</body>
</html>`;
    const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.planCode}_R${plan.revisionNumber}_Lifting_Dossier.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast('فایل Word قابل ویرایش گزارش مهندسی با موفقیت دانلود شد.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Export Control Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>پرونده رسمی مهندسی و آرشیو نسخه‌های طرح ({plan.planCode} — R{plan.revisionNumber})</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              خروجی رسمی A4 فارسی (PDF/چاپ مستقیم) و فایل Word قابل ویرایش شامل محاسبات ASME، نمای سه‌بعدی، JSA، PTW و امضاهای ۹ مرحله‌ای
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={captureFromEmbeddedViewport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-sky-600" />
              <span>به‌روزرسانی تصویر سه‌بعدی گزارش</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / خروجی PDF رسمی</span>
            </button>
            <button
              type="button"
              onClick={handleExportWord}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>خروجی Word (.doc)</span>
            </button>
          </div>
        </div>

        {/* 3D Snapshot preview or on-demand renderer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          <div className="lg:col-span-6 space-y-2">
            <div className="font-bold text-slate-700 dark:text-slate-200">
              پیش‌نمایش نمای سه‌بعدی آماده چاپ
            </div>
            {snapshotDataUrl ? (
              <img
                src={snapshotDataUrl}
                alt="3D Lifting Snapshot"
                className="w-full h-56 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900"
              />
            ) : (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <Lifting3DViewport
                  ref={hiddenViewportRef}
                  heightClass="h-56"
                  plan={plan}
                  crane={primaryCrane}
                  evaluation={plan.latestCalculationSummary as any}
                  onSnapshot={onCaptureSnapshot}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-200">وضعیت کلی پرونده مهندسی</span>
              <StatusBadge status={plan.engineeringStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">بار طراحی کل (DAF)</div>
                <div className="font-mono font-black text-base tabular-nums">
                  {summary.riggingResult?.designTotalLoadTon ?? '—'} t
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">بهره‌برداری جرثقیل</div>
                <div className="font-mono font-black text-base tabular-nums">
                  {summary.craneResult?.utilizationPct ?? '—'}%
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">تعداد محاسبات ذخیره‌شده</div>
                <div className="font-mono font-black text-base tabular-nums">{calculations.length}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">نسخه‌های بازنگری‌شده</div>
                <div className="font-mono font-black text-base tabular-nums">{revisions.length}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              استانداردهای مرجع لحاظ‌شده در این پرونده:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {Array.isArray(summary.standardReferences) && summary.standardReferences.length > 0
                  ? summary.standardReferences.map((s: any) => `${s.standardCode} (${s.clause})`).join('، ')
                  : 'ASME B30.5, P30.1, B30.9, B30.26'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Revision & Calculation Log Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-sky-600" />
              <span>تاریخچه بازنگری‌ها و کنترل نسخه (Revisions)</span>
            </h4>
            <button
              type="button"
              onClick={() => loadHistory(plan.id)}
              disabled={loadingHistory}
              className="text-slate-500 hover:text-sky-600 cursor-pointer"
              title="به‌روزرسانی"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {revisions.length === 0 ? (
            <div className="text-slate-500 py-6 text-center">
              هنوز ویرایش جدیدی پس از نسخه اولیه R1 ثبت نشده است.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[11px] text-slate-500">
                  <tr>
                    <th className="p-2">نسخه</th>
                    <th className="p-2">علت بازنگری</th>
                    <th className="p-2">ویرایش‌کننده</th>
                    <th className="p-2">تاریخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {revisions.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 font-mono font-bold">R{r.revisionNumber}</td>
                      <td className="p-2">{r.changeReason}</td>
                      <td className="p-2">{r.changedBy}</td>
                      <td className="p-2 font-mono text-[11px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
          <h4 className="font-black text-sm text-slate-900 dark:text-white">
            سوابق محاسبات صحه‌گذاری‌شده سمت سرور (Audit Calculations)
          </h4>
          {calculations.length === 0 ? (
            <div className="text-slate-500 py-6 text-center">محاسبه ذخیره‌شده‌ای یافت نشد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[11px] text-slate-500">
                  <tr>
                    <th className="p-2">نسخه</th>
                    <th className="p-2">وضعیت</th>
                    <th className="p-2">محاسبه‌کننده</th>
                    <th className="p-2">زمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {calculations.slice(0, 12).map((c) => (
                    <tr key={c.id}>
                      <td className="p-2 font-mono font-bold">R{c.revisionNumber}</td>
                      <td className="p-2">
                        <StatusBadge status={c.overallStatus} size="sm" />
                      </td>
                      <td className="p-2">{c.calculatedBy}</td>
                      <td className="p-2 font-mono text-[11px]">
                        {c.createdAt ? new Date(c.createdAt).toLocaleString('fa-IR') : '—'}
                      </td>
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
}

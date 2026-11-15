import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Plus,
  Printer,
  Sparkles,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type {
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FloorCalculationResult,
} from './types';
import { printHtmlSafely } from './fireDesignApi';
import { ENGINEERING_DISCLAIMER_FA } from './nfpaEngine';

interface Props {
  isFa: boolean;
  canWrite: boolean;
  canApprove: boolean;
  building: FireDesignBuilding;
  floor: FireDesignFloor;
  calc: FloorCalculationResult;
  gapActions: FireDesignGapAction[];
  onCreateGapAction: (payload: Partial<FireDesignGapAction>) => Promise<void>;
  onUpdateGapAction: (id: number, payload: Partial<FireDesignGapAction>) => Promise<void>;
  onDeleteGapAction: (id: number) => Promise<void>;
}

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'بحرانی (فوری)',
  HIGH: 'بالا',
  MEDIUM: 'متوسط',
  LOW: 'کم',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال اجرا',
  RESOLVED: 'اجراشده',
  VERIFIED: 'تایید و بسته',
};

export default function FireGapAnalysisPanel({
  isFa,
  canWrite,
  canApprove,
  building,
  floor,
  calc,
  gapActions,
  onCreateGapAction,
  onUpdateGapAction,
  onDeleteGapAction,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncingAuto, setSyncingAuto] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [newForm, setNewForm] = useState({
    title: '',
    systemType: 'GENERAL',
    gapType: 'DEFICIT' as FireDesignGapAction['gapType'],
    riskPriority: 'HIGH' as FireDesignGapAction['riskPriority'],
    responsiblePerson: '',
    dueDate: '',
    recommendedAction: '',
  });

  // Draft edits for inline updates
  const [draftEdits, setDraftEdits] = useState<Record<number, Partial<FireDesignGapAction>>>({});

  const buildingGaps = useMemo(() => {
    const prioWeight: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return gapActions
      .filter((g) => g.buildingId === building.id)
      .sort((a, b) => (prioWeight[a.riskPriority] ?? 9) - (prioWeight[b.riskPriority] ?? 9));
  }, [gapActions, building.id]);

  // Gap summary metrics for this floor
  const gapMetrics = useMemo(() => {
    const requiredTotal = calc.comparisonRows.reduce((s, r) => s + r.requiredCount, 0);
    const existingTotal = calc.comparisonRows.reduce((s, r) => s + r.existingCount, 0);
    const deficitTotal = calc.comparisonRows.reduce((s, r) => s + r.deficitCount, 0);
    const incompatibleTotal = calc.comparisonRows.reduce((s, r) => s + r.incompatibleCount, 0);
    const openCapa = buildingGaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length;
    return {
      requiredTotal,
      existingTotal,
      deficitTotal,
      incompatibleTotal,
      blindSpots: calc.uncoveredZones.length,
      compliancePercent: calc.overallCompliancePercent ?? 0,
      openCapa,
    };
  }, [calc, buildingGaps]);

  const handleAutoGenerateGaps = async () => {
    setSyncingAuto(true);
    setStatusMessage(null);
    let createdCount = 0;

    try {
      const existingCodes = new Set(gapActions.map((g) => g.actionCode));

      // 1. Deficits & Incompatible items from comparisonRows
      for (const row of calc.comparisonRows) {
        if (row.incompatibleCount > 0) {
          const code = `FGAP-${building.id}-${floor.id}-INCOMPAT-${row.categoryKey}`;
          if (!existingCodes.has(code)) {
            await onCreateGapAction({
              buildingId: building.id,
              floorId: floor.id,
              actionCode: code,
              systemType: 'EXTINGUISHER_NFPA10',
              gapType: 'INCOMPATIBLE',
              title: `جایگزینی فوری ${row.incompatibleCount} تجهیز ناسازگار (${row.categoryTitleFa})`,
              description: row.incompatibleReasons.join(' | ') || 'عامل اطفای موجود با کلاس خطر ساختمان ناسازگار است.',
              riskPriority: 'CRITICAL',
              recommendedAction: `جمع‌آوری تجهیزات ناسازگار (${row.agentOrType}) و جایگزینی با عامل سازگار طبق ماتریس NFPA 10.`,
              status: 'OPEN',
            });
            existingCodes.add(code);
            createdCount++;
          }
        } else if (row.deficitCount > 0) {
          const code = `FGAP-${building.id}-${floor.id}-DEF-${row.categoryKey}`;
          if (!existingCodes.has(code)) {
            await onCreateGapAction({
              buildingId: building.id,
              floorId: floor.id,
              actionCode: code,
              systemType: row.categoryKey.startsWith('SPRINKLER') ? 'SPRINKLER_NFPA13' : 'EXTINGUISHER_NFPA10',
              gapType: 'DEFICIT',
              title: `تامین کسری ${row.deficitCount} عدد ${row.categoryTitleFa} در طبقه ${floor.floorLabel}`,
              description: `موجود: ${row.existingCount} | مورد نیاز استاندارد: ${row.requiredCount} | کسری: ${row.deficitCount}`,
              riskPriority: row.categoryKey.startsWith('SPRINKLER') ? 'HIGH' : 'MEDIUM',
              recommendedAction: `خرید/نصب ${row.deficitCount} دستگاه ${row.agentOrType} مطابق نقشه جانمایی.`,
              status: 'OPEN',
            });
            existingCodes.add(code);
            createdCount++;
          }
        }
      }

      // 2. Blind Spots
      if (calc.uncoveredZones.length > 0) {
        const code = `FGAP-${building.id}-${floor.id}-BLIND`;
        if (!existingCodes.has(code)) {
          await onCreateGapAction({
            buildingId: building.id,
            floorId: floor.id,
            actionCode: code,
            systemType: 'GENERAL',
            gapType: 'BLIND_SPOT',
            title: `رفع ${calc.uncoveredZones.length} نقطه کور پوشش حریق در طبقه ${floor.floorLabel}`,
            description: calc.uncoveredZones.map((z) => `${z.system}: ${z.areaSqm} m² (${z.reasonFa})`).join(' | '),
            riskPriority: 'HIGH',
            recommendedAction: 'بازنگری جانمایی تجهیزات در نقشه ۲بعدی تا رسیدن به پوشش ۱۰۰٪ بدون مانع.',
            status: 'OPEN',
          });
          createdCount++;
        }
      }

      // 3. Hydraulic Water Supply Deficit
      if (calc.sprinkler.isRequiredOrRecommended && calc.sprinkler.hydraulics.waterSupplyStatus === 'INADEQUATE') {
        const code = `FGAP-${building.id}-HYD-SUPPLY`;
        if (!existingCodes.has(code)) {
          await onCreateGapAction({
            buildingId: building.id,
            floorId: floor.id,
            actionCode: code,
            systemType: 'PUMP_TANK_NFPA20_22',
            gapType: 'HYDRAULIC_DEFICIT',
            title: `ارتقای مخزن آب یا بوسترپمپ آتش‌نشانی ساختمان ${building.name}`,
            description: `${calc.sprinkler.hydraulics.tankCheckDetailFa} | ${calc.sprinkler.hydraulics.pumpCheckDetailFa}`,
            riskPriority: 'CRITICAL',
            recommendedAction: 'افزایش حجم مخزن ذخیره آب اطفا یا اصلاح مشخصات بوسترپمپ مطابق NFPA 20/22.',
            status: 'OPEN',
          });
          createdCount++;
        }
      }

      // 4. Over-density < 1.8m Cold Soldering
      if ((calc.sprinkler.overDensityConflicts || 0) > 0) {
        const code = `FGAP-${building.id}-${floor.id}-COLD-SOLDER`;
        if (!existingCodes.has(code)) {
          await onCreateGapAction({
            buildingId: building.id,
            floorId: floor.id,
            actionCode: code,
            systemType: 'SPRINKLER_NFPA13',
            gapType: 'MISPLACED',
            title: `اصلاح فاصله کمتر از ۱.۸ متر اسپرینکلرها (Cold Soldering) در طبقه ${floor.floorLabel}`,
            description: `تعداد ${calc.sprinkler.overDensityConflicts} تداخل فاصله کمتر از ۱.۸m شناسایی شد.`,
            riskPriority: 'MEDIUM',
            recommendedAction: 'جابجایی نازل‌های نزدیک به یکدیگر یا نصب صفحه بافل (Baffle) مطابق NFPA 13.',
            status: 'OPEN',
          });
          createdCount++;
        }
      }

      setStatusMessage(
        createdCount > 0
          ? `تعداد ${createdCount} اقدام اصلاحی جدید از روی تحلیل شکاف استخراج و ثبت شد.`
          : 'تمام شکاف‌های شناسایی‌شده این طبقه قبلاً در فهرست اقدامات اصلاحی ثبت شده‌اند.'
      );
    } catch (err: any) {
      setStatusMessage(err?.message || 'خطا در تولید خودکار اقدامات اصلاحی');
    } finally {
      setSyncingAuto(false);
    }
  };

  const handlePrintCapa = () => {
    printHtmlSafely(`<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8" />
<title>گزارش تحلیل شکاف و اقدامات اصلاحی حریق - ${building.name}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; }
  h2 { margin: 0 0 6px 0; }
  .meta { font-size: 12px; margin-bottom: 14px; color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
  th { background: #f1f5f9; }
  .disc { margin-top: 16px; padding: 8px; border: 1px solid #f59e0b; background: #fffbeb; font-size: 11px; }
</style>
</head>
<body>
  <h2>گزارش تحلیل شکاف و مدیریت اقدامات اصلاحی حفاظت در برابر حریق (GAP & CAPA)</h2>
  <div class="meta">ساختمان: <strong>${building.name} (${building.code})</strong> | واحد: ${building.unitName} | طبقه: ${floor.floorLabel} | انطباق کل: ${gapMetrics.compliancePercent}٪</div>
  <table>
    <thead>
      <tr><th>کد</th><th>اولویت</th><th>عنوان عدم انطباق</th><th>اقدام اصلاحی پیشنهادی</th><th>مسئول</th><th>مهلت</th><th>وضعیت</th></tr>
    </thead>
    <tbody>
      ${buildingGaps
        .map(
          (g) =>
            `<tr><td>${g.actionCode}</td><td>${PRIORITY_LABELS[g.riskPriority] || g.riskPriority}</td><td>${g.title}</td><td>${g.recommendedAction}</td><td>${g.responsiblePerson || '-'}</td><td>${g.dueDate || '-'}</td><td>${STATUS_LABELS[g.status] || g.status}</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="disc">${ENGINEERING_DISCLAIMER_FA}</div>
</body>
</html>`);
  };

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500">تجهیزات مورد نیاز</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {gapMetrics.requiredTotal}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500">تجهیزات موجود</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {gapMetrics.existingTotal}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500">کسری تجهیزات</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-rose-600">
            {gapMetrics.deficitTotal}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500">تجهیز ناسازگار</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-600">
            {gapMetrics.incompatibleTotal}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500">انطباق این طبقه</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-blue-600">
            {gapMetrics.compliancePercent}٪
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500">CAPA باز ساختمان</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {gapMetrics.openCapa}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            مدیریت عدم انطباق‌ها و اقدامات اصلاحی (CAPA) — {building.name}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              <button
                type="button"
                disabled={syncingAuto}
                onClick={handleAutoGenerateGaps}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{syncingAuto ? 'در حال استخراج...' : 'استخراج خودکار شکاف‌ها به CAPA'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm((v) => !v)}
                className="px-3.5 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ثبت اقدام اصلاحی دستی</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handlePrintCapa}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ گزارش CAPA</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-800 dark:text-blue-200">
          {statusMessage}
        </div>
      )}

      {/* Manual Add Form */}
      {showAddForm && canWrite && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 text-xs">
          <h4 className="font-bold text-slate-900 dark:text-white">ثبت اقدام اصلاحی جدید</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              placeholder="عنوان عدم انطباق..."
              value={newForm.title}
              onChange={(e) => setNewForm((p) => ({ ...p, title: e.target.value }))}
              className="md:col-span-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
            <select
              value={newForm.riskPriority}
              onChange={(e) => setNewForm((p) => ({ ...p, riskPriority: e.target.value as any }))}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="CRITICAL">اولویت بحرانی</option>
              <option value="HIGH">اولویت بالا</option>
              <option value="MEDIUM">اولویت متوسط</option>
              <option value="LOW">اولویت کم</option>
            </select>
            <select
              value={newForm.gapType}
              onChange={(e) => setNewForm((p) => ({ ...p, gapType: e.target.value as any }))}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="DEFICIT">کسری تجهیز</option>
              <option value="INCOMPATIBLE">ناسازگاری عامل اطفا</option>
              <option value="BLIND_SPOT">نقطه کور</option>
              <option value="HYDRAULIC_DEFICIT">کسری هیدرولیک/مخزن</option>
              <option value="INSPECTION_DUE">بازرسی/تست معوق</option>
              <option value="OTHER">سایر</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="اقدام اصلاحی پیشنهادی..."
              value={newForm.recommendedAction}
              onChange={(e) => setNewForm((p) => ({ ...p, recommendedAction: e.target.value }))}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
            <input
              placeholder="مسئول اجرا (نام/واحد)..."
              value={newForm.responsiblePerson}
              onChange={(e) => setNewForm((p) => ({ ...p, responsiblePerson: e.target.value }))}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
            <input
              placeholder="مهلت انجام (مثال: 1405/03/15)..."
              value={newForm.dueDate}
              onChange={(e) => setNewForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!newForm.title.trim()) return;
                await onCreateGapAction({
                  buildingId: building.id,
                  floorId: floor.id,
                  ...newForm,
                  description: newForm.title,
                  recommendedAction: newForm.recommendedAction || 'اصلاح مهندسی مطابق NFPA',
                });
                setNewForm({
                  title: '',
                  systemType: 'GENERAL',
                  gapType: 'DEFICIT',
                  riskPriority: 'HIGH',
                  responsiblePerson: '',
                  dueDate: '',
                  recommendedAction: '',
                });
                setShowAddForm(false);
              }}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
            >
              ثبت در پایگاه داده
            </button>
          </div>
        </div>
      )}

      {/* CAPA List Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {buildingGaps.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            هنوز اقدام اصلاحی برای این ساختمان ثبت نشده است. برای استخراج خودکار عدم انطباق‌ها، دکمه «استخراج خودکار شکاف‌ها به CAPA» را بزنید.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 text-right font-bold">کد و اولویت</th>
                  <th className="py-2.5 px-3 text-right font-bold">شرح عدم انطباق و اقدام پیشنهادی</th>
                  <th className="py-2.5 px-3 text-right font-bold">مسئول اجرا</th>
                  <th className="py-2.5 px-3 text-right font-bold">مهلت</th>
                  <th className="py-2.5 px-3 text-center font-bold">وضعیت</th>
                  <th className="py-2.5 px-3 text-center font-bold">ثبت تغییرات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {buildingGaps.map((g) => {
                  const draft = draftEdits[g.id] || {};
                  const currentResponsible = draft.responsiblePerson ?? g.responsiblePerson ?? '';
                  const currentDue = draft.dueDate ?? g.dueDate ?? '';
                  const currentStatus = draft.status ?? g.status;
                  const hasChanges = Boolean(draftEdits[g.id]);

                  return (
                    <tr key={g.id} className="align-top">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {g.actionCode}
                        </div>
                        <div
                          className={`mt-1 font-bold ${
                            g.riskPriority === 'CRITICAL'
                              ? 'text-rose-600'
                              : g.riskPriority === 'HIGH'
                                ? 'text-amber-600'
                                : 'text-slate-500'
                          }`}
                        >
                          {PRIORITY_LABELS[g.riskPriority] || g.riskPriority}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-md">
                        <div className="font-bold text-slate-900 dark:text-white">{g.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{g.description}</div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
                          پیشنهاد: {g.recommendedAction}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          disabled={!canWrite}
                          value={currentResponsible}
                          placeholder="نام مسئول..."
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [g.id]: { ...prev[g.id], responsiblePerson: e.target.value },
                            }))
                          }
                          className="w-32 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          disabled={!canWrite}
                          value={currentDue}
                          placeholder="1405/04/01"
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [g.id]: { ...prev[g.id], dueDate: e.target.value },
                            }))
                          }
                          className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <select
                          disabled={!canWrite}
                          value={currentStatus}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [g.id]: { ...prev[g.id], status: e.target.value as any },
                            }))
                          }
                          className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
                        >
                          <option value="OPEN">باز</option>
                          <option value="IN_PROGRESS">در حال اجرا</option>
                          <option value="RESOLVED">اجراشده</option>
                          <option value="VERIFIED">تایید و بسته</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canWrite && hasChanges && (
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateGapAction(g.id, draftEdits[g.id]);
                                setDraftEdits((prev) => {
                                  const next = { ...prev };
                                  delete next[g.id];
                                  return next;
                                });
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ذخیره</span>
                            </button>
                          )}
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => void onDeleteGapAction(g.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                              title="حذف اقدام اصلاحی"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

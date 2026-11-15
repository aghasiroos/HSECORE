import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  TrendingDown,
  Wrench,
  ArrowRightLeft,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  FmeaAssessment,
  FmeaRowItem,
  RiskActionItem,
  RiskLevel,
} from '../types';
import {
  calculateRiskLevel,
  getMethodMeta,
  getRiskLevelColor,
} from '../services/riskAssessmentService';
import {
  getTodayJalali,
  SimilarHazardSuggestion,
} from '../services/riskWorkflowEngine';
import { printService } from '../../../services/printService';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import RiskAssessmentHeaderBar from './shared/RiskAssessmentHeaderBar';
import RiskCommonMetaSection from './shared/RiskCommonMetaSection';
import RiskControlActionsPanel from './shared/RiskControlActionsPanel';
import { useRiskFormWorkflow } from './shared/useRiskFormWorkflow';

interface FmeaFormProps {
  initialData?: FmeaAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: FmeaAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const createEmptyRow = (): FmeaRowItem => ({
  id: `fmea-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  itemFunction: '',
  failureMode: '',
  failureEffects: '',
  severity: 6,
  causesOfFailure: '',
  occurrence: 4,
  currentControls: '',
  detection: 5,
  rpn: 120,
  rpnLevel: 'HIGH',
  recommendedActions: '',
  responsibility: '',
  targetDate: getTodayJalali(),
  revisedSeverity: 6,
  revisedOccurrence: 2,
  revisedDetection: 3,
  revisedRpn: 36,
  revisedRpnLevel: 'LOW',
});

export default function FmeaForm({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: FmeaFormProps) {
  const [formData, setFormData] = useState<FmeaAssessment>(() => {
    if (initialData) {
      return {
        ...initialData,
        rows: Array.isArray(initialData.rows) && initialData.rows.length > 0 ? initialData.rows : [createEmptyRow()],
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    return {
      id: `fmea-${Date.now()}`,
      code: `FMEA-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'FMEA',
      overallRiskLevel: 'HIGH',
      initialRiskScore: 120,
      residualRiskScore: 36,
      residualRiskLevel: 'LOW',
      equipmentTag: '',
      systemName: '',
      rows: [createEmptyRow()],
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const wf = useRiskFormWorkflow(formData, setFormData, onSave, currentUser, isFa);
  const meta = getMethodMeta('FMEA');

  const recomputeOverall = (rows: FmeaRowItem[]) => {
    const maxRpn = Math.max(0, ...rows.map(r => r.rpn || 0));
    const maxRevRpn = Math.max(0, ...rows.map(r => r.revisedRpn || r.rpn || 0));
    return {
      overallRiskLevel: calculateRiskLevel(maxRpn, 'RPN') as RiskLevel,
      initialRiskScore: maxRpn,
      residualRiskScore: maxRevRpn,
      residualRiskLevel: calculateRiskLevel(maxRevRpn, 'RPN') as RiskLevel,
    };
  };

  const handleRowChange = (rowId: string, field: keyof FmeaRowItem, value: any) => {
    setFormData(prev => {
      const updatedRows = prev.rows.map(r => {
        if (r.id !== rowId) return r;
        const next = { ...r, [field]: value };
        next.rpn = Number(next.severity || 1) * Number(next.occurrence || 1) * Number(next.detection || 1);
        next.rpnLevel = calculateRiskLevel(next.rpn, 'RPN');

        const rS = Number(next.revisedSeverity ?? next.severity);
        const rO = Number(next.revisedOccurrence ?? next.occurrence);
        const rD = Number(next.revisedDetection ?? next.detection);
        next.revisedRpn = rS * rO * rD;
        next.revisedRpnLevel = calculateRiskLevel(next.revisedRpn, 'RPN');
        return next;
      });
      return {
        ...prev,
        rows: updatedRows,
        ...recomputeOverall(updatedRows),
      };
    });
  };

  const handleAddRow = () => {
    setFormData(prev => {
      const nextRows = [...prev.rows, createEmptyRow()];
      return { ...prev, rows: nextRows, ...recomputeOverall(nextRows) };
    });
  };

  const handleRemoveRow = (rowId: string) => {
    if (formData.rows.length <= 1) return;
    setFormData(prev => {
      const nextRows = prev.rows.filter(r => r.id !== rowId);
      return { ...prev, rows: nextRows, ...recomputeOverall(nextRows) };
    });
  };

  const handleSyncRowsToActions = () => {
    const existing = formData.controlActions || [];
    const additions: RiskActionItem[] = [];
    for (const r of formData.rows) {
      if (!r.recommendedActions.trim()) continue;
      const already = existing.some(a => a.title.trim() === r.recommendedActions.trim());
      if (!already) {
        additions.push({
          id: `act-fmea-${r.id}`,
          title: r.recommendedActions.trim(),
          hierarchyControl: 'ENGINEERING',
          owner: r.responsibility || '',
          deadline: r.targetDate || getTodayJalali(),
          status: 'OPEN',
        });
      }
    }
    if (additions.length === 0) {
      wf.setFeedbackBanner({
        text: isFa ? 'تمام اقدامات پیشنهادی قبلاً به لیست اقدامات منتقل شده‌اند.' : 'All recommended actions are already listed.',
        type: 'error',
      });
      return;
    }
    setFormData(prev => ({ ...prev, controlActions: [...(prev.controlActions || []), ...additions] }));
    wf.setFeedbackBanner({
      text: isFa ? `${additions.length} اقدام اصلاحی از ردیف‌های FMEA به بخش پیگیری CAPA افزوده شد.` : `${additions.length} actions added.`,
      type: 'success',
    });
  };

  const handleApplySuggestion = (sug: SimilarHazardSuggestion) => {
    const suggestedRow: FmeaRowItem = {
      ...createEmptyRow(),
      itemFunction: formData.systemName || sug.title,
      failureMode: sug.hazardText,
      recommendedActions: sug.recommendedControl,
    };
    setFormData(prev => {
      const nextRows = [...prev.rows, suggestedRow];
      return { ...prev, rows: nextRows, ...recomputeOverall(nextRows) };
    });
  };

  const handlePrint = () => {
    printService.printElement('fmea-assessment-form-print', {
      title: `گزارش ارزیابی ریسک FMEA - ${formData.code} - ${formData.title || formData.systemName}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-FMEA-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  const maxInitialRpn = Math.max(0, ...formData.rows.map(r => r.rpn || 0));
  const maxRevisedRpn = Math.max(0, ...formData.rows.map(r => r.revisedRpn || r.rpn || 0));
  const reductionPct = maxInitialRpn > 0 ? Math.max(0, Math.round(((maxInitialRpn - maxRevisedRpn) / maxInitialRpn) * 100)) : 0;

  return (
    <div id="fmea-assessment-form-print" className="space-y-5 animate-in fade-in duration-300">
      <RiskAssessmentHeaderBar
        formData={formData}
        methodTitleFa={meta.titleFa}
        methodTitleEn={meta.titleEn}
        isEdit={Boolean(initialData)}
        isFa={isFa}
        canApprove={wf.canApprove}
        saving={wf.saving}
        validationIssues={wf.validationIssues}
        onCancel={onCancel}
        onPrint={handlePrint}
        onSaveDraft={wf.saveDraft}
        onSubmitReview={wf.submitForReview}
        onApprove={wf.approveAssessment}
        onArchive={wf.archiveAssessment}
        onStageClick={stage => setFormData(prev => ({ ...prev, workflowStage: stage }))}
      />

      {wf.feedbackBanner && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold ${
            wf.feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {wf.feedbackBanner.text}
        </div>
      )}

      <RiskCommonMetaSection
        formData={formData}
        onChange={patch => setFormData(prev => ({ ...prev, ...patch, method: 'FMEA' }))}
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان مطالعه یا فرآیند FMEA *"
        titlePlaceholderFa="مثال: ارزیابی حالات خرابی پمپ‌های انتقال حلال واحد ۳۰۰"
        onApplySuggestion={handleApplySuggestion}
        extraFields={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'کد تجهیز / دارایی (Equipment Tag)' : 'Equipment Tag'}
              </label>
              <input
                type="text"
                value={formData.equipmentTag}
                onChange={e => setFormData(prev => ({ ...prev, equipmentTag: e.target.value }))}
                placeholder="P-101A / K-201"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold outline-hidden"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'نام سیستم / زیرسیستم فرآیندی' : 'System / Subsystem'}
              </label>
              <input
                type="text"
                value={formData.systemName}
                onChange={e => setFormData(prev => ({ ...prev, systemName: e.target.value }))}
                placeholder={isFa ? 'مثال: سیستم پمپاژ و آب‌بندی مکانیکی' : 'e.g. Pumping & Seal System'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
              />
            </div>
          </div>
        }
      />

      {/* Initial vs Revised RPN Comparison Strip */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{isFa ? 'بیشینه RPN اولیه' : 'Max Initial RPN'}</span>
          <span className="text-xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">{maxInitialRpn}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{isFa ? 'بیشینه RPN اصلاح‌شده (باقیمانده)' : 'Max Revised RPN'}</span>
          <span className="text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{maxRevisedRpn}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            <span>{isFa ? 'درصد کاهش ریسک (RPN)' : 'Risk Reduction'}</span>
          </span>
          <span className="text-xl font-black font-mono tabular-nums text-blue-600 dark:text-blue-400" dir="ltr">
            {reductionPct}%
          </span>
        </div>
      </div>

      {/* FMEA Rows */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{isFa ? 'جدول حالات خرابی، علل، کنترل‌های جاری و محاسبه RPN اولیه و باقیمانده' : 'FMEA Failure Modes & RPN Analysis'}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncRowsToActions}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>{isFa ? 'انتقال پیشنهادها به بخش CAPA' : 'Copy Actions to CAPA'}</span>
            </button>
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن حالت خرابی' : 'Add Failure Mode'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {formData.rows.map((row, idx) => {
            const initCol = getRiskLevelColor(row.rpnLevel);
            const revCol = getRiskLevelColor(row.revisedRpnLevel || 'LOW');
            return (
              <div
                key={row.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {row.failureMode || (isFa ? `حالت خرابی شماره ${idx + 1}` : `Failure Mode #${idx + 1}`)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black font-mono tabular-nums ${initCol.badge}`}>
                      RPN اولیه: {row.rpn} ({isFa ? initCol.shortLabelFa : initCol.shortLabelEn})
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black font-mono tabular-nums ${revCol.badge}`}>
                      RPN اصلاح‌شده: {row.revisedRpn ?? row.rpn} ({isFa ? revCol.shortLabelFa : revCol.shortLabelEn})
                    </span>
                    {formData.rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'آیتم / کارکرد تجهیز *' : 'Item / Function *'}
                    </label>
                    <input
                      type="text"
                      value={row.itemFunction}
                      onChange={e => handleRowChange(row.id, 'itemFunction', e.target.value)}
                      placeholder={isFa ? 'مثال: آب‌بند مکانیکی شفت پمپ' : 'e.g. Mechanical Seal'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'حالت بالقوه خرابی *' : 'Failure Mode *'}
                    </label>
                    <input
                      type="text"
                      value={row.failureMode}
                      onChange={e => handleRowChange(row.id, 'failureMode', e.target.value)}
                      placeholder={isFa ? 'مثال: نشتی حلال اشتعال‌پذیر' : 'e.g. Seal leakage'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'اثرات و پیامد خرابی' : 'Failure Effects'}
                    </label>
                    <input
                      type="text"
                      value={row.failureEffects}
                      onChange={e => handleRowChange(row.id, 'failureEffects', e.target.value)}
                      placeholder={isFa ? 'آتش‌سوزی، توقف خط تولید' : 'Fire, shutdown'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'علل احتمالی وقوع' : 'Causes of Failure'}
                    </label>
                    <input
                      type="text"
                      value={row.causesOfFailure}
                      onChange={e => handleRowChange(row.id, 'causesOfFailure', e.target.value)}
                      placeholder={isFa ? 'فرسودگی اورینگ، دمای بالا' : 'Wear, thermal shock'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                </div>

                {/* Initial S, O, D & Current Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'کنترل‌های جاری و روش کشف فعلی' : 'Current Controls & Detection'}
                    </label>
                    <input
                      type="text"
                      value={row.currentControls}
                      onChange={e => handleRowChange(row.id, 'currentControls', e.target.value)}
                      placeholder={isFa ? 'بازرسی چشمی شیفتی، نشت‌یاب گاز' : 'Gas detector, shift check'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'شدت اولیه (S: 1-10)' : 'Severity (1-10)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.severity}
                      onChange={e => handleRowChange(row.id, 'severity', Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'وقوع اولیه (O: 1-10)' : 'Occurrence (1-10)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.occurrence}
                      onChange={e => handleRowChange(row.id, 'occurrence', Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'کشف اولیه (D: 1-10)' : 'Detection (1-10)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.detection}
                      onChange={e => handleRowChange(row.id, 'detection', Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>

                  <div className="md:col-span-1 text-center">
                    <span className="block text-[10px] font-bold text-slate-500 mb-1">RPN</span>
                    <span className={`inline-block w-full py-2 rounded-lg text-xs font-mono font-black tabular-nums ${initCol.badge}`}>
                      {row.rpn}
                    </span>
                  </div>
                </div>

                {/* Recommended Action, Owner, Deadline & Revised S, O, D */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                      {isFa ? 'اقدام اصلاحی / کنترلی پیشنهادی' : 'Recommended Action'}
                    </label>
                    <input
                      type="text"
                      value={row.recommendedActions}
                      onChange={e => handleRowChange(row.id, 'recommendedActions', e.target.value)}
                      placeholder={isFa ? 'نصب آب‌بند دوتایی + دتکتور خودکار و اینترلاک توقف' : 'Recommended engineering/procedural control...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مسئول اقدام' : 'Owner'}
                    </label>
                    <input
                      type="text"
                      value={row.responsibility}
                      onChange={e => handleRowChange(row.id, 'responsibility', e.target.value)}
                      placeholder={isFa ? 'سرپرست تعمیرات' : 'Owner'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مهلت اقدام' : 'Target Date'}
                    </label>
                    <PersianDatePicker
                      value={row.targetDate}
                      onChange={jStr => handleRowChange(row.id, 'targetDate', jStr)}
                      isFa={isFa}
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.revisedSeverity ?? row.severity}
                      onChange={e => handleRowChange(row.id, 'revisedSeverity', Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">O جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.revisedOccurrence ?? row.occurrence}
                      onChange={e => handleRowChange(row.id, 'revisedOccurrence', Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">D جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={row.revisedDetection ?? row.detection}
                      onChange={e => handleRowChange(row.id, 'revisedDetection', Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-1 text-center">
                    <span className="block text-[10px] font-bold text-slate-500 mb-1">RPN پس از اقدام</span>
                    <span className={`inline-block w-full py-2 rounded-lg text-xs font-mono font-black tabular-nums ${revCol.badge}`}>
                      {row.revisedRpn ?? row.rpn}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <RiskControlActionsPanel
        assessment={formData}
        actions={formData.controlActions || []}
        reviewHistory={formData.reviewHistory || []}
        onChangeActions={actions => setFormData(prev => ({ ...prev, controlActions: actions }))}
        isFa={isFa}
        actorName={wf.actorName}
        onStatusMessage={(text, type) => wf.setFeedbackBanner({ text, type: type || 'success' })}
      />
    </div>
  );
}

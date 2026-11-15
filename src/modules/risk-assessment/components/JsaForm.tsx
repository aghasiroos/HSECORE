import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Shield,
  ArrowRightLeft,
  HardHat,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  JsaAssessment,
  JsaStepItem,
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

interface JsaFormProps {
  initialData?: JsaAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: JsaAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const PPE_OPTIONS = [
  'کلاه ایمنی (Helmet)',
  'عینک ایمنی (Safety Goggles)',
  'کفش ایمنی (Safety Shoes)',
  'دستکش کار / عایق (Gloves)',
  'گوشی صداگیر (Ear Muff/Plug)',
  'ماسک تنفسی (Respirator)',
  'هارنس ایمنی (Safety Harness)',
  'لباس ضد حریق (FR Coverall)',
];

const createEmptyStep = (stepNum: number): JsaStepItem => ({
  id: `step-${Date.now()}-${stepNum}`,
  stepNumber: stepNum,
  taskDescription: '',
  hazards: '',
  potentialConsequences: '',
  existingControls: '',
  initialProbability: 3,
  initialSeverity: 4,
  initialRiskScore: 12,
  initialRiskLevel: 'HIGH',
  hierarchyControl: 'ENGINEERING',
  controlMeasures: '',
  residualProbability: 1,
  residualSeverity: 3,
  residualRiskScore: 3,
  residualRiskLevel: 'LOW',
  actionOwner: '',
  actionDeadline: getTodayJalali(),
});

export default function JsaForm({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: JsaFormProps) {
  const [formData, setFormData] = useState<JsaAssessment>(() => {
    if (initialData) {
      return {
        ...initialData,
        requiredPpe: Array.isArray(initialData.requiredPpe) ? initialData.requiredPpe : [],
        steps: Array.isArray(initialData.steps) && initialData.steps.length > 0 ? initialData.steps : [createEmptyStep(1)],
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    return {
      id: `jsa-${Date.now()}`,
      code: `JSA-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'JSA',
      overallRiskLevel: 'HIGH',
      initialRiskScore: 12,
      residualRiskScore: 3,
      residualRiskLevel: 'LOW',
      jobTitle: '',
      permitRefNumber: '',
      requiredPpe: ['کلاه ایمنی (Helmet)', 'کفش ایمنی (Safety Shoes)'],
      steps: [createEmptyStep(1)],
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const wf = useRiskFormWorkflow(formData, setFormData, onSave, currentUser, isFa);
  const meta = getMethodMeta('JSA');

  const recomputeOverall = (steps: JsaStepItem[]) => {
    const maxInit = Math.max(0, ...steps.map(s => s.initialRiskScore || 0));
    const maxRes = Math.max(0, ...steps.map(s => s.residualRiskScore || 0));
    return {
      overallRiskLevel: calculateRiskLevel(maxInit, '5x5') as RiskLevel,
      initialRiskScore: maxInit,
      residualRiskScore: maxRes,
      residualRiskLevel: calculateRiskLevel(maxRes, '5x5') as RiskLevel,
    };
  };

  const handleStepChange = (stepId: string, field: keyof JsaStepItem, value: any) => {
    setFormData(prev => {
      const updatedSteps = prev.steps.map(s => {
        if (s.id !== stepId) return s;
        const next = { ...s, [field]: value };
        next.initialRiskScore = Number(next.initialProbability || 1) * Number(next.initialSeverity || 1);
        next.initialRiskLevel = calculateRiskLevel(next.initialRiskScore, '5x5');
        next.residualRiskScore = Number(next.residualProbability || 1) * Number(next.residualSeverity || 1);
        next.residualRiskLevel = calculateRiskLevel(next.residualRiskScore, '5x5');
        return next;
      });
      return { ...prev, steps: updatedSteps, ...recomputeOverall(updatedSteps) };
    });
  };

  const handleAddStep = () => {
    setFormData(prev => {
      const nextSteps = [...prev.steps, createEmptyStep(prev.steps.length + 1)];
      return { ...prev, steps: nextSteps, ...recomputeOverall(nextSteps) };
    });
  };

  const handleRemoveStep = (stepId: string) => {
    if (formData.steps.length <= 1) return;
    setFormData(prev => {
      const nextSteps = prev.steps
        .filter(s => s.id !== stepId)
        .map((s, i) => ({ ...s, stepNumber: i + 1 }));
      return { ...prev, steps: nextSteps, ...recomputeOverall(nextSteps) };
    });
  };

  const togglePpe = (ppe: string) => {
    setFormData(prev => {
      const exists = prev.requiredPpe.includes(ppe);
      return {
        ...prev,
        requiredPpe: exists ? prev.requiredPpe.filter(p => p !== ppe) : [...prev.requiredPpe, ppe],
      };
    });
  };

  const handleSyncStepsToCapa = () => {
    const existing = formData.controlActions || [];
    const additions: RiskActionItem[] = [];
    for (const s of formData.steps) {
      if (!s.controlMeasures.trim()) continue;
      const already = existing.some(a => a.title.trim() === s.controlMeasures.trim());
      if (!already) {
        additions.push({
          id: `act-jsa-${s.id}`,
          title: `گام ${s.stepNumber}: ${s.controlMeasures.trim()}`,
          hierarchyControl: s.hierarchyControl,
          owner: s.actionOwner || '',
          deadline: s.actionDeadline || getTodayJalali(),
          status: 'OPEN',
        });
      }
    }
    if (additions.length === 0) {
      wf.setFeedbackBanner({
        text: isFa ? 'تمام اقدامات گام‌های JSA قبلاً در بخش CAPA ثبت شده‌اند.' : 'All JSA controls already synced.',
        type: 'error',
      });
      return;
    }
    setFormData(prev => ({ ...prev, controlActions: [...(prev.controlActions || []), ...additions] }));
    wf.setFeedbackBanner({
      text: isFa ? `${additions.length} اقدام از گام‌های JSA به لیست پیگیری CAPA افزوده شد.` : `${additions.length} actions synced.`,
      type: 'success',
    });
  };

  const handleApplySuggestion = (sug: SimilarHazardSuggestion) => {
    setFormData(prev => {
      const nextStep: JsaStepItem = {
        ...createEmptyStep(prev.steps.length + 1),
        taskDescription: sug.title,
        hazards: sug.hazardText,
        controlMeasures: sug.recommendedControl,
      };
      const nextSteps = [...prev.steps, nextStep];
      return { ...prev, steps: nextSteps, ...recomputeOverall(nextSteps) };
    });
  };

  const handlePrint = () => {
    printService.printElement('jsa-assessment-form-print', {
      title: `برگه آنالیز ایمنی شغلی (JSA) - ${formData.code} - ${formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-JSA-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  return (
    <div id="jsa-assessment-form-print" className="space-y-5 animate-in fade-in duration-300">
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
        onChange={patch =>
          setFormData(prev => ({
            ...prev,
            ...patch,
            method: 'JSA',
            permitRefNumber: patch.linkedRefs?.permitNumber ?? prev.permitRefNumber,
          }))
        }
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان فعالیت / عملیات JSA *"
        titlePlaceholderFa="مثال: کار در ارتفاع و تعمیرات خطوط بخار برج خنک‌کن"
        onApplySuggestion={handleApplySuggestion}
        extraFields={
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'عنوان شغل / تیم اجرایی' : 'Job / Crew Title'}
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={e => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  placeholder={isFa ? 'مثال: گروه جوشکاری و داربست‌بندی' : 'e.g. Welding & Scaffolding Crew'}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'شماره پروانه کار مرجع (PTW)' : 'Reference Work Permit #'}
                </label>
                <input
                  type="text"
                  value={formData.permitRefNumber || ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      permitRefNumber: e.target.value,
                      linkedRefs: { ...(prev.linkedRefs || {}), permitNumber: e.target.value },
                    }))
                  }
                  placeholder="PTW-1404-..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold outline-hidden"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <HardHat className="w-4 h-4 text-amber-600" />
                <span>{isFa ? 'تجهیزات حفاظت فردی الزامی (Mandatory PPE)' : 'Required PPE'}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PPE_OPTIONS.map(ppe => {
                  const selected = formData.requiredPpe.includes(ppe);
                  return (
                    <button
                      key={ppe}
                      type="button"
                      onClick={() => togglePpe(ppe)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        selected
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {ppe}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        }
      />

      {/* JSA Steps */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-600" />
            <span>{isFa ? 'تفکیک گام‌به‌گام مراحل کار، خطرات، سلسله‌مراتب کنترل و ریسک باقیمانده' : 'Job Step Hazard & Control Breakdown'}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncStepsToCapa}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600" />
              <span>{isFa ? 'انتقال کنترل‌ها به CAPA' : 'Sync to CAPA'}</span>
            </button>
            <button
              type="button"
              onClick={handleAddStep}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن مرحله جدید' : 'Add Step'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {formData.steps.map(step => {
            const initCol = getRiskLevelColor(step.initialRiskLevel);
            const resCol = getRiskLevelColor(step.residualRiskLevel);
            return (
              <div
                key={step.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
                      {step.stepNumber}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {isFa ? `مرحله ${step.stepNumber}` : `Step ${step.stepNumber}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums ${initCol.badge}`}>
                      {isFa ? 'ریسک اولیه:' : 'Initial:'} {step.initialRiskScore} ({isFa ? initCol.shortLabelFa : initCol.shortLabelEn})
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums ${resCol.badge}`}>
                      {isFa ? 'باقیمانده:' : 'Residual:'} {step.residualRiskScore} ({isFa ? resCol.shortLabelFa : resCol.shortLabelEn})
                    </span>
                    {formData.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(step.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'شرح مرحله / فعالیت *' : 'Task Description *'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.taskDescription}
                      onChange={e => handleStepChange(step.id, 'taskDescription', e.target.value)}
                      placeholder={isFa ? 'مثال: استقرار داربست و ایمن‌سازی محل کار' : 'Describe task step...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'خطرات بالقوه *' : 'Hazards *'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.hazards}
                      onChange={e => handleStepChange(step.id, 'hazards', e.target.value)}
                      placeholder={isFa ? 'سقوط از ارتفاع، پرتاب جرقه یا شیء' : 'Falls, sparks...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'پیامدهای احتمالی' : 'Consequences'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.potentialConsequences}
                      onChange={e => handleStepChange(step.id, 'potentialConsequences', e.target.value)}
                      placeholder={isFa ? 'آسیب جدی، شکستگی، حریق' : 'Severe injury, fire'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'کنترل‌های موجود فعلی' : 'Existing Controls'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.existingControls || ''}
                      onChange={e => handleStepChange(step.id, 'existingControls', e.target.value)}
                      placeholder={isFa ? 'تابلو هشدار، نوار خطر' : 'Warning signs...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                </div>

                {/* Risk Evaluation & Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">P اولیه (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={step.initialProbability}
                      onChange={e => handleStepChange(step.id, 'initialProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S اولیه (1-5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={step.initialSeverity}
                      onChange={e => handleStepChange(step.id, 'initialSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'سلسله‌مراتب کنترل' : 'Hierarchy'}
                    </label>
                    <select
                      value={step.hierarchyControl}
                      onChange={e => handleStepChange(step.id, 'hierarchyControl', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    >
                      <option value="ELIMINATION">{isFa ? 'حذف' : 'Elimination'}</option>
                      <option value="SUBSTITUTION">{isFa ? 'جایگزینی' : 'Substitution'}</option>
                      <option value="ENGINEERING">{isFa ? 'مهندسی' : 'Engineering'}</option>
                      <option value="ADMINISTRATIVE">{isFa ? 'اداری' : 'Administrative'}</option>
                      <option value="PPE">{isFa ? 'PPE' : 'PPE'}</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                      {isFa ? 'اقدامات کنترلی پیشنهادی / الزامی' : 'Required Control Measures'}
                    </label>
                    <input
                      type="text"
                      value={step.controlMeasures}
                      onChange={e => handleStepChange(step.id, 'controlMeasures', e.target.value)}
                      placeholder={isFa ? 'نصب لایف‌لاین، تگ سبز داربست، کپسول CO2' : 'Lifeline, scaffold tag...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مسئول اجرا' : 'Action Owner'}
                    </label>
                    <input
                      type="text"
                      value={step.actionOwner || ''}
                      onChange={e => handleStepChange(step.id, 'actionOwner', e.target.value)}
                      placeholder={isFa ? 'سرپرست کارگاه' : 'Supervisor'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مهلت' : 'Due'}
                    </label>
                    <PersianDatePicker
                      value={step.actionDeadline || ''}
                      onChange={jStr => handleStepChange(step.id, 'actionDeadline', jStr)}
                      isFa={isFa}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">P باقیمانده</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={step.residualProbability}
                      onChange={e => handleStepChange(step.id, 'residualProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S باقیمانده</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={step.residualSeverity}
                      onChange={e => handleStepChange(step.id, 'residualSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center tabular-nums"
                    />
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

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Briefcase,
  Users,
  X,
  ArrowRightLeft,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  JobActivityAssessment,
  JobActivityHazardItem,
  RiskActionItem,
  RiskLevel,
} from '../types';
import {
  calculateRiskLevel,
  getMethodMeta,
  getRiskLevelColor,
} from '../services/riskAssessmentService';
import { getTodayJalali } from '../services/riskWorkflowEngine';
import { printService } from '../../../services/printService';
import { getJobTitles } from '../../../utils/orgHelper';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import RiskAssessmentHeaderBar from './shared/RiskAssessmentHeaderBar';
import RiskCommonMetaSection from './shared/RiskCommonMetaSection';
import RiskControlActionsPanel from './shared/RiskControlActionsPanel';
import { useRiskFormWorkflow } from './shared/useRiskFormWorkflow';

interface JobActivityRiskFormProps {
  initialData?: JobActivityAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: JobActivityAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const createEmptyHazard = (): JobActivityHazardItem => ({
  id: `ja-hz-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  hazardCategory: 'SAFETY',
  hazardTitle: '',
  exposureCondition: 'روتین / روزانه',
  consequence: '',
  existingControls: '',
  initialProbability: 3,
  initialSeverity: 3,
  initialScore: 9,
  initialLevel: 'MEDIUM',
  hierarchyControl: 'ENGINEERING',
  controlMeasures: '',
  actionOwner: '',
  actionDeadline: getTodayJalali(),
  actionStatus: 'OPEN',
  residualProbability: 1,
  residualSeverity: 2,
  residualScore: 2,
  residualLevel: 'LOW',
});

export default function JobActivityRiskForm({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: JobActivityRiskFormProps) {
  const [formData, setFormData] = useState<JobActivityAssessment>(() => {
    if (initialData) {
      return {
        ...initialData,
        exposedPersonnel: Array.isArray(initialData.exposedPersonnel) ? initialData.exposedPersonnel : [],
        hazardsList: Array.isArray(initialData.hazardsList) && initialData.hazardsList.length > 0 ? initialData.hazardsList : [createEmptyHazard()],
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    return {
      id: `ja-${Date.now()}`,
      code: `JOB-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'JOB_ACTIVITY',
      overallRiskLevel: 'MEDIUM',
      initialRiskScore: 9,
      residualRiskScore: 2,
      residualRiskLevel: 'LOW',
      jobPosition: '',
      exposedPersonnel: [],
      reviewCycleMonths: 12,
      nextReviewDate: '',
      hazardsList: [createEmptyHazard()],
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const wf = useRiskFormWorkflow(formData, setFormData, onSave, currentUser, isFa);
  const meta = getMethodMeta('JOB_ACTIVITY');

  const recomputeOverall = (list: JobActivityHazardItem[]) => {
    const maxInit = Math.max(0, ...list.map(h => h.initialScore || 0));
    const maxRes = Math.max(0, ...list.map(h => h.residualScore || 0));
    return {
      overallRiskLevel: calculateRiskLevel(maxInit, '5x5') as RiskLevel,
      initialRiskScore: maxInit,
      residualRiskScore: maxRes,
      residualRiskLevel: calculateRiskLevel(maxRes, '5x5') as RiskLevel,
    };
  };

  const handleHazardChange = (hId: string, field: keyof JobActivityHazardItem, value: any) => {
    setFormData(prev => {
      const updated = prev.hazardsList.map(h => {
        if (h.id !== hId) return h;
        const next = { ...h, [field]: value };
        next.initialScore = Number(next.initialProbability || 1) * Number(next.initialSeverity || 1);
        next.initialLevel = calculateRiskLevel(next.initialScore, '5x5');
        next.residualScore = Number(next.residualProbability || 1) * Number(next.residualSeverity || 1);
        next.residualLevel = calculateRiskLevel(next.residualScore, '5x5');
        return next;
      });
      return { ...prev, hazardsList: updated, ...recomputeOverall(updated) };
    });
  };

  const handleAddHazard = () => {
    setFormData(prev => {
      const next = [...prev.hazardsList, createEmptyHazard()];
      return { ...prev, hazardsList: next, ...recomputeOverall(next) };
    });
  };

  const handleRemoveHazard = (hId: string) => {
    if (formData.hazardsList.length <= 1) return;
    setFormData(prev => {
      const next = prev.hazardsList.filter(h => h.id !== hId);
      return { ...prev, hazardsList: next, ...recomputeOverall(next) };
    });
  };

  const handleSyncToCapa = () => {
    const existing = formData.controlActions || [];
    const additions: RiskActionItem[] = [];
    for (const h of formData.hazardsList) {
      if (!h.controlMeasures.trim()) continue;
      if (!existing.some(a => a.title.trim() === h.controlMeasures.trim())) {
        additions.push({
          id: `act-ja-${h.id}`,
          title: h.controlMeasures.trim(),
          hierarchyControl: h.hierarchyControl,
          owner: h.actionOwner || '',
          deadline: h.actionDeadline || getTodayJalali(),
          status: h.actionStatus || 'OPEN',
        });
      }
    }
    if (additions.length === 0) {
      wf.setFeedbackBanner({
        text: isFa ? 'تمام اقدامات کنترلی قبلاً در لیست CAPA ثبت شده‌اند.' : 'All controls already synced.',
        type: 'error',
      });
      return;
    }
    setFormData(prev => ({ ...prev, controlActions: [...(prev.controlActions || []), ...additions] }));
    wf.setFeedbackBanner({
      text: isFa ? `${additions.length} اقدام کنترلی به بخش پیگیری CAPA افزوده شد.` : `${additions.length} actions added.`,
      type: 'success',
    });
  };

  const handlePrint = () => {
    printService.printElement('job-activity-risk-form-print', {
      title: `ارزیابی ریسک فعالیت و شغل - ${formData.code} - ${formData.jobPosition || formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-JOB-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  return (
    <div id="job-activity-risk-form-print" className="space-y-5 animate-in fade-in duration-300">
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
        onChange={patch => setFormData(prev => ({ ...prev, ...patch, method: 'JOB_ACTIVITY' }))}
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان فعالیت / شغل مورد ارزیابی *"
        titlePlaceholderFa="مثال: ارزیابی جامع ریسک‌های ایمنی، بهداشتی و محیط‌زیستی اپراتور بارگیری"
        extraFields={
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'پست سازمانی / عنوان شغلی' : 'Job Position'}
                </label>
                <input
                  type="text"
                  list="job-activity-titles"
                  value={formData.jobPosition}
                  onChange={e => setFormData(prev => ({ ...prev, jobPosition: e.target.value }))}
                  placeholder={isFa ? 'انتخاب یا تایپ سمت شغلی...' : 'Job title...'}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
                />
                <datalist id="job-activity-titles">
                  {getJobTitles().map(j => <option key={j} value={j} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'دوره بازنگری (ماه)' : 'Review Cycle (Months)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={formData.reviewCycleMonths}
                  onChange={e => setFormData(prev => ({ ...prev, reviewCycleMonths: Math.max(1, Number(e.target.value)) }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold outline-hidden tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'تاریخ بازنگری دوره‌ای بعدی' : 'Next Review Date'}
                </label>
                <PersianDatePicker
                  value={formData.nextReviewDate}
                  onChange={jStr => setFormData(prev => ({ ...prev, nextReviewDate: jStr }))}
                  isFa={isFa}
                />
              </div>
            </div>

            {/* Exposed Personnel */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>{isFa ? 'افراد یا گروه‌های شغلی در معرض ریسک' : 'Exposed Personnel / Roles'}</span>
                </span>
                <div className="w-full sm:w-72">
                  <CentralPersonnelSelector
                    language={isFa ? 'fa' : 'en'}
                    placeholder={isFa ? 'افزودن پرسنل در معرض مواجهه...' : 'Add exposed person...'}
                    compact
                    onSelectPersonnel={(p, org) => {
                      if (!p) return;
                      const label = `${p.fullName} (${org.unit})`;
                      if (!formData.exposedPersonnel.includes(label)) {
                        setFormData(prev => ({ ...prev, exposedPersonnel: [...prev.exposedPersonnel, label] }));
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.exposedPersonnel.map((person, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
                  >
                    <span>{person}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData(prev => ({
                          ...prev,
                          exposedPersonnel: prev.exposedPersonnel.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        }
      />

      {/* HSE Hazards Register */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <span>{isFa ? 'ثبت خطرات ایمنی، بهداشتی، ارگونومی و محیط‌زیستی شغل/فعالیت (HIRA)' : 'Job & Activity HSE Hazard Register'}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncToCapa}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isFa ? 'انتقال کنترل‌ها به CAPA' : 'Sync to CAPA'}</span>
            </button>
            <button
              type="button"
              onClick={handleAddHazard}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن ردیف خطر' : 'Add Hazard'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {formData.hazardsList.map((hz, idx) => {
            const initCol = getRiskLevelColor(hz.initialLevel);
            const resCol = getRiskLevelColor(hz.residualLevel);
            return (
              <div
                key={hz.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <select
                      value={hz.hazardCategory}
                      onChange={e => handleHazardChange(hz.id, 'hazardCategory', e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    >
                      <option value="SAFETY">{isFa ? 'ایمنی (Safety)' : 'Safety'}</option>
                      <option value="HEALTH">{isFa ? 'بهداشت حرفه‌ای (Health)' : 'Health'}</option>
                      <option value="ENVIRONMENT">{isFa ? 'محیط زیست (Environment)' : 'Environment'}</option>
                      <option value="ERGONOMIC">{isFa ? 'ارگونومی (Ergonomic)' : 'Ergonomic'}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums ${initCol.badge}`}>
                      {isFa ? 'ریسک اولیه:' : 'Initial:'} {hz.initialScore} ({isFa ? initCol.shortLabelFa : initCol.shortLabelEn})
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums ${resCol.badge}`}>
                      {isFa ? 'باقیمانده:' : 'Residual:'} {hz.residualScore} ({isFa ? resCol.shortLabelFa : resCol.shortLabelEn})
                    </span>
                    {formData.hazardsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveHazard(hz.id)}
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
                      {isFa ? 'شرح خطر / جنبه *' : 'Hazard / Aspect *'}
                    </label>
                    <input
                      type="text"
                      value={hz.hazardTitle}
                      onChange={e => handleHazardChange(hz.id, 'hazardTitle', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'شرایط و تناوب مواجهه' : 'Exposure Condition'}
                    </label>
                    <input
                      type="text"
                      value={hz.exposureCondition}
                      onChange={e => handleHazardChange(hz.id, 'exposureCondition', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'پیامدهای بالقوه' : 'Consequence'}
                    </label>
                    <input
                      type="text"
                      value={hz.consequence}
                      onChange={e => handleHazardChange(hz.id, 'consequence', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'کنترل‌های موجود فعلی' : 'Existing Controls'}
                    </label>
                    <input
                      type="text"
                      value={hz.existingControls}
                      onChange={e => handleHazardChange(hz.id, 'existingControls', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">P اولیه</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={hz.initialProbability}
                      onChange={e => handleHazardChange(hz.id, 'initialProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S اولیه</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={hz.initialSeverity}
                      onChange={e => handleHazardChange(hz.id, 'initialSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'سلسله‌مراتب کنترل' : 'Hierarchy'}
                    </label>
                    <select
                      value={hz.hierarchyControl}
                      onChange={e => handleHazardChange(hz.id, 'hierarchyControl', e.target.value)}
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
                      {isFa ? 'اقدامات کنترلی پیشنهادی' : 'Control Measures'}
                    </label>
                    <input
                      type="text"
                      value={hz.controlMeasures}
                      onChange={e => handleHazardChange(hz.id, 'controlMeasures', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مسئول' : 'Owner'}
                    </label>
                    <input
                      type="text"
                      value={hz.actionOwner}
                      onChange={e => handleHazardChange(hz.id, 'actionOwner', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مهلت' : 'Due'}
                    </label>
                    <PersianDatePicker
                      value={hz.actionDeadline}
                      onChange={jStr => handleHazardChange(hz.id, 'actionDeadline', jStr)}
                      isFa={isFa}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">P جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={hz.residualProbability}
                      onChange={e => handleHazardChange(hz.id, 'residualProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={hz.residualSeverity}
                      onChange={e => handleHazardChange(hz.id, 'residualSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
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

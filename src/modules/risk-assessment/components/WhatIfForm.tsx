import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  HelpCircle,
  ArrowRightLeft,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  RiskActionItem,
  RiskLevel,
  WhatIfAssessment,
  WhatIfQuestionItem,
} from '../types';
import {
  calculateRiskLevel,
  getMethodMeta,
  getRiskLevelColor,
} from '../services/riskAssessmentService';
import { getTodayJalali } from '../services/riskWorkflowEngine';
import { printService } from '../../../services/printService';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import RiskAssessmentHeaderBar from './shared/RiskAssessmentHeaderBar';
import RiskCommonMetaSection from './shared/RiskCommonMetaSection';
import RiskControlActionsPanel from './shared/RiskControlActionsPanel';
import { useRiskFormWorkflow } from './shared/useRiskFormWorkflow';

interface WhatIfFormProps {
  initialData?: WhatIfAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: WhatIfAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const createEmptyQuestion = (): WhatIfQuestionItem => ({
  id: `wif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  question: '',
  expertAnswer: '',
  hazards: '',
  consequences: '',
  existingControls: '',
  initialProbability: 3,
  initialSeverity: 4,
  initialRiskScore: 12,
  initialRiskLevel: 'HIGH',
  recommendations: '',
  responsible: '',
  deadline: getTodayJalali(),
  status: 'OPEN',
  residualProbability: 1,
  residualSeverity: 3,
  residualRiskScore: 3,
  residualRiskLevel: 'LOW',
});

export default function WhatIfForm({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: WhatIfFormProps) {
  const [formData, setFormData] = useState<WhatIfAssessment>(() => {
    if (initialData) {
      return {
        ...initialData,
        questions: Array.isArray(initialData.questions) && initialData.questions.length > 0 ? initialData.questions : [createEmptyQuestion()],
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    return {
      id: `whatif-${Date.now()}`,
      code: `WIF-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'WHAT_IF',
      overallRiskLevel: 'HIGH',
      initialRiskScore: 12,
      residualRiskScore: 3,
      residualRiskLevel: 'LOW',
      studyScope: '',
      processSubject: '',
      questions: [createEmptyQuestion()],
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const wf = useRiskFormWorkflow(formData, setFormData, onSave, currentUser, isFa);
  const meta = getMethodMeta('WHAT_IF');

  const recomputeOverall = (questions: WhatIfQuestionItem[]) => {
    const maxInit = Math.max(0, ...questions.map(q => q.initialRiskScore || 0));
    const maxRes = Math.max(0, ...questions.map(q => q.residualRiskScore || 0));
    return {
      overallRiskLevel: calculateRiskLevel(maxInit, '5x5') as RiskLevel,
      initialRiskScore: maxInit,
      residualRiskScore: maxRes,
      residualRiskLevel: calculateRiskLevel(maxRes, '5x5') as RiskLevel,
    };
  };

  const handleQuestionChange = (qId: string, field: keyof WhatIfQuestionItem, value: any) => {
    setFormData(prev => {
      const updated = prev.questions.map(q => {
        if (q.id !== qId) return q;
        const next = { ...q, [field]: value };
        next.initialRiskScore = Number(next.initialProbability || 1) * Number(next.initialSeverity || 1);
        next.initialRiskLevel = calculateRiskLevel(next.initialRiskScore, '5x5');
        next.residualRiskScore = Number(next.residualProbability || 1) * Number(next.residualSeverity || 1);
        next.residualRiskLevel = calculateRiskLevel(next.residualRiskScore, '5x5');
        return next;
      });
      return { ...prev, questions: updated, ...recomputeOverall(updated) };
    });
  };

  const handleAddQuestion = () => {
    setFormData(prev => {
      const next = [...prev.questions, createEmptyQuestion()];
      return { ...prev, questions: next, ...recomputeOverall(next) };
    });
  };

  const handleRemoveQuestion = (qId: string) => {
    if (formData.questions.length <= 1) return;
    setFormData(prev => {
      const next = prev.questions.filter(q => q.id !== qId);
      return { ...prev, questions: next, ...recomputeOverall(next) };
    });
  };

  const handleSyncToCapa = () => {
    const existing = formData.controlActions || [];
    const additions: RiskActionItem[] = [];
    for (const q of formData.questions) {
      if (!q.recommendations.trim()) continue;
      if (!existing.some(a => a.title.trim() === q.recommendations.trim())) {
        additions.push({
          id: `act-wif-${q.id}`,
          title: q.recommendations.trim(),
          hierarchyControl: 'ENGINEERING',
          owner: q.responsible || '',
          deadline: q.deadline || getTodayJalali(),
          status: q.status || 'OPEN',
        });
      }
    }
    if (additions.length === 0) {
      wf.setFeedbackBanner({
        text: isFa ? 'تمام پیشنهادهای What-If قبلاً در لیست CAPA ثبت شده‌اند.' : 'All recommendations already synced.',
        type: 'error',
      });
      return;
    }
    setFormData(prev => ({ ...prev, controlActions: [...(prev.controlActions || []), ...additions] }));
    wf.setFeedbackBanner({
      text: isFa ? `${additions.length} اقدام پیشنهادی به لیست پیگیری CAPA افزوده شد.` : `${additions.length} actions added.`,
      type: 'success',
    });
  };

  const handlePrint = () => {
    printService.printElement('whatif-assessment-form-print', {
      title: `مطالعه ریسک What-If - ${formData.code} - ${formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-WHATIF-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  return (
    <div id="whatif-assessment-form-print" className="space-y-5 animate-in fade-in duration-300">
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
        onChange={patch => setFormData(prev => ({ ...prev, ...patch, method: 'WHAT_IF' }))}
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان مطالعه What-If *"
        titlePlaceholderFa="مثال: مطالعه انحرافات فرآیندی تغییر مسیر خط انتقال بوتان"
        extraFields={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'محدوده مطالعه (Study Scope)' : 'Study Scope'}
              </label>
              <input
                type="text"
                value={formData.studyScope}
                onChange={e => setFormData(prev => ({ ...prev, studyScope: e.target.value }))}
                placeholder={isFa ? 'از خروجی مخزن T-201 تا ورودی رآکتور R-101' : 'Boundaries of the study'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'موضوع / فرآیند / تغییر مورد بررسی' : 'Subject / Process'}
              </label>
              <input
                type="text"
                value={formData.processSubject}
                onChange={e => setFormData(prev => ({ ...prev, processSubject: e.target.value }))}
                placeholder={isFa ? 'راه‌اندازی اولیه پس از تعمیرات اساسی (Startup)' : 'Startup / Modification'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
              />
            </div>
          </div>
        }
      />

      {/* What-If Questions Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>{isFa ? 'کاربرگ سوالات «چه می‌شود اگر...؟»، پاسخ کارشناسی و پیشنهادهای اصلاحی' : 'What-If Questions & Expert Analysis'}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncToCapa}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
              <span>{isFa ? 'انتقال پیشنهادها به CAPA' : 'Sync to CAPA'}</span>
            </button>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن سوال What-If' : 'Add What-If Question'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {formData.questions.map((q, idx) => {
            const initCol = getRiskLevelColor(q.initialRiskLevel);
            const resCol = getRiskLevelColor(q.residualRiskLevel);
            return (
              <div
                key={q.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {isFa ? `سناریوی شماره ${idx + 1}` : `Scenario #${idx + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums ${initCol.badge}`}>
                      {isFa ? 'ریسک اولیه:' : 'Pre:'} {q.initialRiskScore} ({isFa ? initCol.shortLabelFa : initCol.shortLabelEn})
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums ${resCol.badge}`}>
                      {isFa ? 'پس از اقدام:' : 'Post:'} {q.residualRiskScore} ({isFa ? resCol.shortLabelFa : resCol.shortLabelEn})
                    </span>
                    {formData.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                      {isFa ? 'سوال کلیدی (چه می‌شود اگر...؟) *' : 'What-If Question *'}
                    </label>
                    <textarea
                      rows={2}
                      value={q.question}
                      onChange={e => handleQuestionChange(q.id, 'question', e.target.value)}
                      placeholder={isFa ? 'چه می‌شود اگر شیر کنترل خروجی در حالت بسته گیر کند؟' : 'What if valve fails closed?'}
                      className="w-full p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'پاسخ کارشناسی تیم مطالعه' : 'Expert Team Answer'}
                    </label>
                    <textarea
                      rows={2}
                      value={q.expertAnswer}
                      onChange={e => handleQuestionChange(q.id, 'expertAnswer', e.target.value)}
                      placeholder={isFa ? 'افزایش فشار مخزن بالادستی بیش از فشار طراحی...' : 'Upstream overpressure occurs...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'خطر شناسایی‌شده' : 'Identified Hazard'}
                    </label>
                    <input
                      type="text"
                      value={q.hazards}
                      onChange={e => handleQuestionChange(q.id, 'hazards', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'پیامدهای بالقوه' : 'Consequences'}
                    </label>
                    <input
                      type="text"
                      value={q.consequences}
                      onChange={e => handleQuestionChange(q.id, 'consequences', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'حفاظ‌ها و کنترل‌های موجود' : 'Existing Safeguards'}
                    </label>
                    <input
                      type="text"
                      value={q.existingControls}
                      onChange={e => handleQuestionChange(q.id, 'existingControls', e.target.value)}
                      placeholder={isFa ? 'شیر اطمینان PSV-101، آلارم فشار بالا PAH' : 'PSV, High Pressure Alarm'}
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
                      value={q.initialProbability}
                      onChange={e => handleQuestionChange(q.id, 'initialProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S اولیه</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={q.initialSeverity}
                      onChange={e => handleQuestionChange(q.id, 'initialSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                      {isFa ? 'پیشنهادهای اصلاحی / اقدامات تکمیلی' : 'Recommendations'}
                    </label>
                    <input
                      type="text"
                      value={q.recommendations}
                      onChange={e => handleQuestionChange(q.id, 'recommendations', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مسئول' : 'Responsible'}
                    </label>
                    <input
                      type="text"
                      value={q.responsible}
                      onChange={e => handleQuestionChange(q.id, 'responsible', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'مهلت' : 'Deadline'}
                    </label>
                    <PersianDatePicker
                      value={q.deadline}
                      onChange={jStr => handleQuestionChange(q.id, 'deadline', jStr)}
                      isFa={isFa}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">P جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={q.residualProbability}
                      onChange={e => handleQuestionChange(q.id, 'residualProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">S جدید</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={q.residualSeverity}
                      onChange={e => handleQuestionChange(q.id, 'residualSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
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

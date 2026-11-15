import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  HeartPulse,
  BrainCircuit,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  HhaAssessment,
  HhaItem,
  HumanErrorType,
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
import RiskAssessmentHeaderBar from './shared/RiskAssessmentHeaderBar';
import RiskCommonMetaSection from './shared/RiskCommonMetaSection';
import RiskControlActionsPanel from './shared/RiskControlActionsPanel';
import { useRiskFormWorkflow } from './shared/useRiskFormWorkflow';

interface HhaFormProps {
  initialData?: HhaAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: HhaAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const createEmptyHhaItem = (): HhaItem => ({
  id: `hha-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  jobRole: '',
  workplaceArea: '',
  analysisDomain: 'COMBINED',
  hazardCategory: 'CHEMICAL',
  agentName: '',
  exposureRoute: 'INHALATION',
  exposureDuration: '۸ ساعت در شیفت',
  measuredLevel: '',
  standardOel: '',
  healthEffect: '',
  riskRating: 'MEDIUM',
  existingControls: '',
  proposedControls: '',
  targetMedicalTests: '',
  errorType: '',
  performanceShapingFactors: '',
  organizationalConditions: '',
  preventiveBarriers: '',
  trainingActions: '',
  initialProbability: 3,
  initialSeverity: 3,
  initialRiskScore: 9,
  residualProbability: 1,
  residualSeverity: 2,
  residualRiskScore: 2,
  residualRiskLevel: 'LOW',
  actionOwner: '',
  actionDeadline: getTodayJalali(),
});

const HUMAN_ERROR_LABELS: Array<{ value: HumanErrorType; labelFa: string }> = [
  { value: '', labelFa: '— انتخاب نوع خطای انسانی (در صورت وجود) —' },
  { value: 'INATTENTION', labelFa: 'عدم توجه / حواس‌پرتی (Slips & Lapses)' },
  { value: 'DECISION_ERROR', labelFa: 'اشتباه در تصمیم‌گیری یا تشخیص وضعیت' },
  { value: 'SKILL_GAP', labelFa: 'ضعف مهارت، تجربه یا تسلط فنی' },
  { value: 'PROCEDURE_VIOLATION', labelFa: 'عدم رعایت دستورالعمل / میان‌بُر ایمنی' },
  { value: 'ENVIRONMENTAL_HEALTH_FACTOR', labelFa: 'عوامل محیطی-بهداشتی (گرما، صدا، نور، خستگی)' },
];

export default function HhaForm({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: HhaFormProps) {
  const [formData, setFormData] = useState<HhaAssessment>(() => {
    if (initialData) {
      return {
        ...initialData,
        items: Array.isArray(initialData.items) && initialData.items.length > 0 ? initialData.items : [createEmptyHhaItem()],
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    return {
      id: `hha-${Date.now()}`,
      code: `HHA-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'HHA',
      overallRiskLevel: 'MEDIUM',
      initialRiskScore: 9,
      residualRiskScore: 2,
      residualRiskLevel: 'LOW',
      assessedDepartment: '',
      headcountExposed: 0,
      items: [createEmptyHhaItem()],
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const wf = useRiskFormWorkflow(formData, setFormData, onSave, currentUser, isFa);
  const meta = getMethodMeta('HHA');

  const recomputeOverall = (items: HhaItem[]) => {
    const rankOrder: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    let maxInitLevel: RiskLevel = 'LOW';
    let maxResLevel: RiskLevel = 'LOW';
    let maxInitScore = 0;
    let maxResScore = 0;

    for (const item of items) {
      if (rankOrder[item.riskRating] > rankOrder[maxInitLevel]) maxInitLevel = item.riskRating;
      const resLvl = item.residualRiskLevel || 'LOW';
      if (rankOrder[resLvl] > rankOrder[maxResLevel]) maxResLevel = resLvl;
      maxInitScore = Math.max(maxInitScore, item.initialRiskScore || 0);
      maxResScore = Math.max(maxResScore, item.residualRiskScore || 0);
    }

    return {
      overallRiskLevel: maxInitLevel,
      initialRiskScore: maxInitScore || undefined,
      residualRiskLevel: maxResLevel,
      residualRiskScore: maxResScore || undefined,
    };
  };

  const handleItemChange = (itemId: string, field: keyof HhaItem, value: any) => {
    setFormData(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.id !== itemId) return item;
        const next = { ...item, [field]: value };
        if (field === 'initialProbability' || field === 'initialSeverity') {
          const score = Number(next.initialProbability || 1) * Number(next.initialSeverity || 1);
          next.initialRiskScore = score;
          next.riskRating = calculateRiskLevel(score, '5x5');
        }
        if (field === 'residualProbability' || field === 'residualSeverity') {
          const rScore = Number(next.residualProbability || 1) * Number(next.residualSeverity || 1);
          next.residualRiskScore = rScore;
          next.residualRiskLevel = calculateRiskLevel(rScore, '5x5');
        }
        return next;
      });
      return {
        ...prev,
        items: updatedItems,
        ...recomputeOverall(updatedItems),
      };
    });
  };

  const handleAddItem = () => {
    setFormData(prev => {
      const next = [...prev.items, createEmptyHhaItem()];
      return { ...prev, items: next, ...recomputeOverall(next) };
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => {
      const next = prev.items.filter(i => i.id !== itemId);
      return { ...prev, items: next, ...recomputeOverall(next) };
    });
  };

  const handlePrint = () => {
    printService.printElement('hha-assessment-form-print', {
      title: `ارزیابی خطرات بهداشتی و خطای انسانی (HHA) - ${formData.code} - ${formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-HHA-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  return (
    <div id="hha-assessment-form-print" className="space-y-5 animate-in fade-in duration-300">
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
        onChange={patch => setFormData(prev => ({ ...prev, ...patch, method: 'HHA' }))}
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان ارزیابی خطرات بهداشتی و عوامل انسانی (HHA) *"
        titlePlaceholderFa="مثال: ارزیابی مواجهه شیمیایی، صوتی و خطاهای انسانی اپراتورهای اتاق کنترل"
        extraFields={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'بخش / دپارتمان تحت پایش' : 'Assessed Department'}
              </label>
              <input
                type="text"
                value={formData.assessedDepartment}
                onChange={e => setFormData(prev => ({ ...prev, assessedDepartment: e.target.value }))}
                placeholder={isFa ? 'مثال: آزمایشگاه کنترل کیفیت / اتاق کنترل مرکزی' : 'Department name'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'تعداد پرسنل در معرض مواجهه / خطا (نفر)' : 'Exposed Headcount'}
              </label>
              <input
                type="number"
                min={0}
                value={formData.headcountExposed}
                onChange={e => setFormData(prev => ({ ...prev, headcountExposed: Math.max(0, Number(e.target.value)) }))}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold outline-hidden tabular-nums"
              />
            </div>
          </div>
        }
      />

      {/* HHA + Human Factors Items */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-emerald-600" />
            <span>{isFa ? 'عوامل زیان‌آور شغلی (OEL/طب کار) و تحلیل خطای انسانی (Human Factors)' : 'Occupational Health & Human Error Items'}</span>
          </h3>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFa ? 'افزودن ردیف ارزیابی' : 'Add HHA Item'}</span>
          </button>
        </div>

        <datalist id="hha-jobs-list">
          {getJobTitles().map(j => <option key={j} value={j} />)}
        </datalist>

        <div className="space-y-4">
          {formData.items.map((item, idx) => {
            const initCol = getRiskLevelColor(item.riskRating);
            const resCol = getRiskLevelColor(item.residualRiskLevel || 'LOW');
            const showHealth = item.analysisDomain !== 'HUMAN_FACTORS';
            const showHuman = item.analysisDomain !== 'OCCUPATIONAL_HEALTH';

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <select
                      value={item.analysisDomain || 'COMBINED'}
                      onChange={e => handleItemChange(item.id, 'analysisDomain', e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                    >
                      <option value="COMBINED">{isFa ? 'بهداشت حرفه‌ای + خطای انسانی (کامل)' : 'Combined (Health + Human)'}</option>
                      <option value="OCCUPATIONAL_HEALTH">{isFa ? 'فقط عوامل زیان‌آور بهداشت حرفه‌ای' : 'Occupational Health Only'}</option>
                      <option value="HUMAN_FACTORS">{isFa ? 'فقط تحلیل خطای انسانی (Human Error)' : 'Human Factors Only'}</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black ${initCol.badge}`}>
                      {isFa ? 'ریسک اولیه:' : 'Initial:'} {isFa ? initCol.shortLabelFa : initCol.shortLabelEn}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black ${resCol.badge}`}>
                      {isFa ? 'باقیمانده:' : 'Residual:'} {isFa ? resCol.shortLabelFa : resCol.shortLabelEn}
                    </span>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Common Job / Area / Category */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'شغل / نقش در معرض خطر *' : 'Job Role *'}
                    </label>
                    <input
                      type="text"
                      list="hha-jobs-list"
                      value={item.jobRole}
                      onChange={e => handleItemChange(item.id, 'jobRole', e.target.value)}
                      placeholder={isFa ? 'مثال: اپراتور اتاق کنترل / آزمایشگاه' : 'Job title...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'محل کار / ایستگاه کاری' : 'Workplace Area'}
                    </label>
                    <input
                      type="text"
                      value={item.workplaceArea}
                      onChange={e => handleItemChange(item.id, 'workplaceArea', e.target.value)}
                      placeholder={isFa ? 'سالن کمپرسورها / میز آنالیز' : 'Workstation'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'دسته‌بندی عامل / خطا' : 'Hazard Category'}
                    </label>
                    <select
                      value={item.hazardCategory}
                      onChange={e => handleItemChange(item.id, 'hazardCategory', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    >
                      <option value="CHEMICAL">{isFa ? 'شیمیایی (گاز، بخار، گرد و غبار)' : 'Chemical'}</option>
                      <option value="PHYSICAL">{isFa ? 'فیزیکی (صدا، گرما، ارتعاش، روشنایی)' : 'Physical'}</option>
                      <option value="ERGONOMIC">{isFa ? 'ارگونومیک (پوسچر، حمل بار، چیدمان)' : 'Ergonomic'}</option>
                      <option value="BIOLOGICAL">{isFa ? 'بیولوژیکی' : 'Biological'}</option>
                      <option value="PSYCHOSOCIAL">{isFa ? 'روانی-اجتماعی / استرس و نوبت‌کاری' : 'Psychosocial'}</option>
                      <option value="HUMAN_ERROR">{isFa ? 'خطای انسانی و شناختی (Human Error)' : 'Human Error'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'نام عامل زیان‌آور / وظیفه حساس *' : 'Agent / Critical Task *'}
                    </label>
                    <input
                      type="text"
                      value={item.agentName}
                      onChange={e => handleItemChange(item.id, 'agentName', e.target.value)}
                      placeholder={isFa ? 'بنزن، صدای 92dBA، یا تنظیم دستی شیر' : 'Agent or task'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                </div>

                {/* Occupational Health Measurements */}
                {showHealth && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'مسیر مواجهه' : 'Exposure Route'}
                      </label>
                      <select
                        value={item.exposureRoute}
                        onChange={e => handleItemChange(item.id, 'exposureRoute', e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      >
                        <option value="INHALATION">{isFa ? 'تنفسی' : 'Inhalation'}</option>
                        <option value="DERMAL">{isFa ? 'پوستی' : 'Dermal'}</option>
                        <option value="ACOUSTIC">{isFa ? 'شنوایی (صدا)' : 'Acoustic'}</option>
                        <option value="WHOLE_BODY">{isFa ? 'تمام بدن (گرما/ارتعاش)' : 'Whole Body'}</option>
                        <option value="EYE">{isFa ? 'چشمی / روشنایی' : 'Eye'}</option>
                        <option value="INGESTION">{isFa ? 'گوارشی' : 'Ingestion'}</option>
                        <option value="COGNITIVE_TASK">{isFa ? 'بار شناختی / ذهنی' : 'Cognitive'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'مدت مواجهه' : 'Duration'}
                      </label>
                      <input
                        type="text"
                        value={item.exposureDuration}
                        onChange={e => handleItemChange(item.id, 'exposureDuration', e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'مقدار اندازه‌گیری‌شده' : 'Measured Level'}
                      </label>
                      <input
                        type="text"
                        value={item.measuredLevel || ''}
                        onChange={e => handleItemChange(item.id, 'measuredLevel', e.target.value)}
                        placeholder="89 dBA / 1.4 ppm"
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold outline-hidden"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'حد مجاز استاندارد (OEL/TLV)' : 'OEL / TLV Limit'}
                      </label>
                      <input
                        type="text"
                        value={item.standardOel || ''}
                        onChange={e => handleItemChange(item.id, 'standardOel', e.target.value)}
                        placeholder="85 dBA / 0.5 ppm"
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold outline-hidden"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                        {isFa ? 'آزمایش اختصاصی طب کار' : 'Target Medical Tests'}
                      </label>
                      <input
                        type="text"
                        value={item.targetMedicalTests}
                        onChange={e => handleItemChange(item.id, 'targetMedicalTests', e.target.value)}
                        placeholder={isFa ? 'ادیومتری، اسپیرومتری، CBC' : 'Audiometry, CBC'}
                        className="w-full p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      />
                    </div>
                  </div>
                )}

                {/* Human Factors / Human Error Sub-section */}
                {showHuman && (
                  <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/60 space-y-3">
                    <div className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <BrainCircuit className="w-4 h-4" />
                      <span>{isFa ? 'تحلیل خطای انسانی و عوامل شکل‌دهنده عملکرد (Human Factors / PSFs)' : 'Human Error & Performance Shaping Factors'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {isFa ? 'نوع خطای انسانی' : 'Human Error Type'}
                        </label>
                        <select
                          value={item.errorType || ''}
                          onChange={e => handleItemChange(item.id, 'errorType', e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                        >
                          {HUMAN_ERROR_LABELS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.labelFa}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {isFa ? 'عوامل شکل‌دهنده عملکرد (خستگی، فشار زمانی، HMI)' : 'Performance Shaping Factors'}
                        </label>
                        <input
                          type="text"
                          value={item.performanceShapingFactors || ''}
                          onChange={e => handleItemChange(item.id, 'performanceShapingFactors', e.target.value)}
                          placeholder={isFa ? 'شیفت شب، ازدحام آلارم‌ها، روشنایی کم' : 'Night shift, alarm overload'}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {isFa ? 'شرایط سازمانی و سرپرستی مؤثر' : 'Organizational Conditions'}
                        </label>
                        <input
                          type="text"
                          value={item.organizationalConditions || ''}
                          onChange={e => handleItemChange(item.id, 'organizationalConditions', e.target.value)}
                          placeholder={isFa ? 'کمبود نیروی جایگزین، عدم بازنگری SOP' : 'Short staffing, outdated SOP'}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {isFa ? 'موانع پیشگیرانه و مهندسی خطاپذیری (Poka-Yoke / Interlock)' : 'Preventive Barriers'}
                        </label>
                        <input
                          type="text"
                          value={item.preventiveBarriers || ''}
                          onChange={e => handleItemChange(item.id, 'preventiveBarriers', e.target.value)}
                          placeholder={isFa ? 'تأیید دوتایی (Double-check)، کدگذاری رنگی شیرها، اینترلاک' : 'Interlock, double verification'}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {isFa ? 'اقدامات آموزشی و بازآموزی' : 'Training Actions'}
                        </label>
                        <input
                          type="text"
                          value={item.trainingActions || ''}
                          onChange={e => handleItemChange(item.id, 'trainingActions', e.target.value)}
                          placeholder={isFa ? 'کارگاه شبیه‌سازی وضعیت اضطراری' : 'Simulation drill'}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Controls, Health Effect, Initial & Residual P*S */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'عوارض بر سلامت / پیامد خطا' : 'Health / Error Effect'}
                    </label>
                    <input
                      type="text"
                      value={item.healthEffect}
                      onChange={e => handleItemChange(item.id, 'healthEffect', e.target.value)}
                      placeholder={isFa ? 'افت شنوایی، مسمومیت یا خطای فرآیندی' : 'Effect...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {isFa ? 'کنترل‌های موجود' : 'Existing Controls'}
                    </label>
                    <input
                      type="text"
                      value={item.existingControls}
                      onChange={e => handleItemChange(item.id, 'existingControls', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                      {isFa ? 'اقدامات کنترلی پیشنهادی' : 'Proposed Controls'}
                    </label>
                    <input
                      type="text"
                      value={item.proposedControls}
                      onChange={e => handleItemChange(item.id, 'proposedControls', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>
                  <div className="md:col-span-3 grid grid-cols-4 gap-1.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">P اولیه</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={item.initialProbability ?? 3}
                        onChange={e => handleItemChange(item.id, 'initialProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">S اولیه</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={item.initialSeverity ?? 3}
                        onChange={e => handleItemChange(item.id, 'initialSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">P باقیمانده</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={item.residualProbability ?? 1}
                        onChange={e => handleItemChange(item.id, 'residualProbability', Math.max(1, Math.min(5, Number(e.target.value))))}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">S باقیمانده</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={item.residualSeverity ?? 2}
                        onChange={e => handleItemChange(item.id, 'residualSeverity', Math.max(1, Math.min(5, Number(e.target.value))))}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                    </div>
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

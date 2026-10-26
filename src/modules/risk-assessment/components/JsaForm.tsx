import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  Save, 
  Printer, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { JsaAssessment, JsaStepItem, RiskLevel } from '../types';
import { calculateRiskLevel, getRiskLevelColor } from '../services/riskAssessmentService';
import RiskPersonnelSignatures from './RiskPersonnelSignatures';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { useFinalSubmit } from '../../../context/FinalSubmitContext';
import { printService } from '../../../services/printService';
import { getUnits, getOrgSites } from '../../../utils/orgHelper';

interface JsaFormProps {
  initialData?: JsaAssessment | null;
  onSave: (assessment: JsaAssessment) => void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const PPE_OPTIONS = [
  'کلاه ایمنی استاندارد',
  'کفش ایمنی با سرپنجه کامپوزیت/فولادی',
  'عینک ایمنی ضد خش/ضد ضربه',
  'دستکش چرمی جوشکاری / مقاوم به برش',
  'دستکش نیتریل ضد مواد شیمیایی',
  'هارنس ایمنی تمام بدن با لنیارد دوبل',
  'ماسک تنفسی ضد گاز و بخارات آلی',
  'ایرماف / ایرپلاگ حفاظتی گوش',
  'شیلد محافظ صورت ضد پرتاب براده',
  'لباس کار نسوز کتان ۱۰۰٪'
];

export default function JsaForm({ initialData, onSave, onCancel, isFa, currentUser }: JsaFormProps) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const [formData, setFormData] = useState<JsaAssessment>(() => {
    if (initialData) return initialData;
    const nowJalali = '1404/06/05';
    return {
      id: `jsa-${Date.now()}`,
      code: `JSA-1404-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: '',
      unit: '',
      areaLocation: '',
      assessorName: '',
      assessmentDate: nowJalali,
      teamMembers: [],
      status: 'APPROVED',
      method: 'JSA',
      overallRiskLevel: 'HIGH',
      jobTitle: '',
      permitRefNumber: '',
      requiredPpe: ['کلاه ایمنی استاندارد', 'کفش ایمنی با سرپنجه کامپوزیت/فولادی', 'عینک ایمنی ضد خش/ضد ضربه'],
      steps: [
        {
          id: `step-${Date.now()}-1`,
          stepNumber: 1,
          taskDescription: '',
          hazards: '',
          potentialConsequences: '',
          initialProbability: 3,
          initialSeverity: 3,
          initialRiskScore: 9,
          initialRiskLevel: 'MEDIUM',
          hierarchyControl: 'ADMINISTRATIVE',
          controlMeasures: '',
          residualProbability: 1,
          residualSeverity: 2,
          residualRiskScore: 2,
          residualRiskLevel: 'LOW',
          actionOwner: '',
          actionDeadline: ''
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const [teamMemberInput, setTeamMemberInput] = useState('');

  const handleAddStep = () => {
    const newStep: JsaStepItem = {
      id: `step-${Date.now()}-${formData.steps.length + 1}`,
      stepNumber: formData.steps.length + 1,
      taskDescription: '',
      hazards: '',
      potentialConsequences: '',
      initialProbability: 3,
      initialSeverity: 3,
      initialRiskScore: 9,
      initialRiskLevel: 'MEDIUM',
      hierarchyControl: 'ENGINEERING',
      controlMeasures: '',
      residualProbability: 1,
      residualSeverity: 2,
      residualRiskScore: 2,
      residualRiskLevel: 'LOW',
      actionOwner: '',
      actionDeadline: ''
    };
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const handleRemoveStep = (stepId: string) => {
    if (formData.steps.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, stepNumber: idx + 1 }))
    }));
  };

  const handleStepChange = (stepId: string, field: keyof JsaStepItem, value: any) => {
    setFormData(prev => {
      const updatedSteps = prev.steps.map(step => {
        if (step.id !== stepId) return step;
        const updated = { ...step, [field]: value };
        
        // Recalculate Initial Risk
        if (field === 'initialProbability' || field === 'initialSeverity') {
          const p = field === 'initialProbability' ? Number(value) : step.initialProbability;
          const s = field === 'initialSeverity' ? Number(value) : step.initialSeverity;
          updated.initialRiskScore = p * s;
          updated.initialRiskLevel = calculateRiskLevel(updated.initialRiskScore, '5x5');
        }

        // Recalculate Residual Risk
        if (field === 'residualProbability' || field === 'residualSeverity') {
          const rp = field === 'residualProbability' ? Number(value) : step.residualProbability;
          const rs = field === 'residualSeverity' ? Number(value) : step.residualSeverity;
          updated.residualRiskScore = rp * rs;
          updated.residualRiskLevel = calculateRiskLevel(updated.residualRiskScore, '5x5');
        }

        return updated;
      });

      // Recalculate overall risk level
      const maxScore = Math.max(...updatedSteps.map(s => s.initialRiskScore));
      const overallLevel = calculateRiskLevel(maxScore, '5x5');

      return {
        ...prev,
        steps: updatedSteps,
        overallRiskLevel: overallLevel
      };
    });
  };

  const handleTogglePpe = (ppe: string) => {
    setFormData(prev => {
      const exists = prev.requiredPpe.includes(ppe);
      return {
        ...prev,
        requiredPpe: exists 
          ? prev.requiredPpe.filter(p => p !== ppe) 
          : [...prev.requiredPpe, ppe]
      };
    });
  };

  const handleAddTeamMember = () => {
    if (!teamMemberInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      teamMembers: [...(prev.teamMembers || []), teamMemberInput.trim()]
    }));
    setTeamMemberInput('');
  };

  const handleRemoveTeamMember = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: (prev.teamMembers || []).filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert(isFa ? 'لطفاً عنوان فعالیت/شغل را وارد نمایید' : 'Please enter assessment title');
      return;
    }
    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        onSave({
          ...formData,
          status: 'APPROVED'
        });
      }
    });
  };

  const overallColors = getRiskLevelColor(formData.overallRiskLevel);

  const handlePrint = () => {
    printService.printElement('jsa-assessment-form-print', {
      title: `آنالیز ایمنی شغلی (JSA) - ${formData.code} - ${formData.jobTitle || formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-JSA-01',
      documentDate: formData.assessmentDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  return (
    <form id="jsa-assessment-form-print" onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      {/* ── Form Header ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
              title={isFa ? 'بازگشت' : 'Back'}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {initialData ? (isFa ? 'ویرایش سند آنالیز ایمنی شغلی (JSA)' : 'Edit JSA Assessment') : (isFa ? 'فرم استاندارد آنالیز ایمنی شغلی (JSA / JHA)' : 'New Standard JSA Form')}
            </h2>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap" dir="ltr">
              {formData.code}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold mt-1 mr-7">
            {isFa ? 'شناسایی گام‌به‌گام خطرات، ارزیابی ریسک اولیه و تعیین اقدامات کنترلی و ریسک باقیمانده' : 'Step-by-step hazard identification and hierarchy of controls'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{isFa ? 'سطح ریسک کل:' : 'Overall:'}</span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black whitespace-nowrap ${overallColors.badge}`}>
              {isFa ? overallColors.labelFa : overallColors.labelEn}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isFa ? 'چاپ فرم استاندارد' : 'Print Form'}
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isFa ? 'ذخیره و ثبت در سیستم' : 'Save & Submit'}</span>
          </button>
        </div>
      </div>

      {/* ── Document Metadata ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Info className="w-4 h-4 text-blue-600" />
          {isFa ? '۱. مشخصات عمومی عملیات و تیم ارزیابی' : '1. General Operation & Team Info'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'عنوان شغل / فعالیت مورد ارزیابی *' : 'Job / Activity Title *'}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value, jobTitle: e.target.value })}
              placeholder={isFa ? 'مثال: تعویض شیر کنترل و جوشکاری خط لوله ورودی مبدل E-204' : 'e.g. Valve replacement and welding on E-204'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'شماره پروانه کار مرتبط (PTW Ref)' : 'Permit to Work Ref'}
            </label>
            <input
              type="text"
              value={formData.permitRefNumber || ''}
              onChange={e => setFormData({ ...formData, permitRefNumber: e.target.value })}
              placeholder={isFa ? 'مثال: PTW-1404-0941' : 'e.g. PTW-1404-0941'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'مجتمع / سایت عملیاتی' : 'Site'}
            </label>
            <input
              type="text"
              list="jsa-sites-list"
              value={formData.site}
              onChange={e => setFormData({ ...formData, site: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <datalist id="jsa-sites-list">
              {getOrgSites().map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'واحد عملیاتی / فرآیندی' : 'Process Unit'}
            </label>
            <input
              type="text"
              list="jsa-units-list"
              value={formData.unit}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <datalist id="jsa-units-list">
              {getUnits().map(u => <option key={u} value={u} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'موقعیت دقیق استقرار' : 'Exact Location'}
            </label>
            <input
              type="text"
              value={formData.areaLocation}
              onChange={e => setFormData({ ...formData, areaLocation: e.target.value })}
              placeholder={isFa ? 'مثال: استراکچر فلزی، طبقه سوم' : 'e.g. Structure level 3'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'تاریخ ارزیابی (شمسی)' : 'Assessment Date'}
            </label>
            <PersianDatePicker
              value={formData.assessmentDate}
              onChange={(jStr) => setFormData({ ...formData, assessmentDate: jStr })}
              isFa={isFa}
              placeholder={isFa ? 'انتخاب تاریخ ارزیابی...' : 'Assessment date...'}
            />
          </div>
        </div>

        {/* Personnel Signatures Block */}
        <RiskPersonnelSignatures
          formData={formData}
          onChange={(updated) => setFormData(prev => ({ ...prev, ...updated, method: 'JSA' }))}
          isFa={isFa}
        />

        {/* PPE Requirements */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
            {isFa ? 'تجهیزات حفاظت فردی (PPE) الزامی برای این شغل:' : 'Required PPE:'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {PPE_OPTIONS.map(ppe => {
              const isSelected = formData.requiredPpe.includes(ppe);
              return (
                <button
                  key={ppe}
                  type="button"
                  onClick={() => handleTogglePpe(ppe)}
                  className={`p-2 rounded-xl text-[11px] font-bold text-right transition border cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <span>{ppe}</span>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    {isSelected ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── JSA Step-by-Step Worksheet Matrix ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              {isFa ? '۲. ماتریس ارزیابی گام‌به‌گام مراحل کار و تدابیر کنترلی (Worksheet)' : '2. JSA Worksheet & Steps'}
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              {isFa ? 'فرمول ارزیابی: عدد ریسک = احتمال (P: 1-5) × شدت (S: 1-5)' : 'Formula: Risk Score = Probability (1-5) × Severity (1-5)'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddStep}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFa ? '+ افزودن گام جدید' : '+ Add Step'}</span>
          </button>
        </div>

        <div className="space-y-4">
          {formData.steps.map((step, index) => {
            const initColor = getRiskLevelColor(step.initialRiskLevel);
            const resColor = getRiskLevelColor(step.residualRiskLevel);

            return (
              <div 
                key={step.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                      {step.stepNumber}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {isFa ? `گام شماره ${step.stepNumber}` : `Step #${step.stepNumber}`}
                    </span>
                  </div>

                  {formData.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(step.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-md transition"
                      title={isFa ? 'حذف این گام' : 'Delete step'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'شرح وظیفه / اقدام در این مرحله *' : 'Task Description *'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.taskDescription}
                      onChange={e => handleStepChange(step.id, 'taskDescription', e.target.value)}
                      placeholder={isFa ? 'مثال: بستن داربست و انتقال لوله با جرثقیل' : 'e.g. Scaffolding erection'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-red-600 dark:text-red-400 mb-1">
                      {isFa ? 'خطرات بالقوه (Hazards) *' : 'Potential Hazards *'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.hazards}
                      onChange={e => handleStepChange(step.id, 'hazards', e.target.value)}
                      placeholder={isFa ? 'مثال: سقوط از ارتفاع، لغزش، پارگی بلت' : 'e.g. Fall from height'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden text-red-700 dark:text-red-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'پیامدها و اثرات ناشی از خطر *' : 'Consequences *'}
                    </label>
                    <textarea
                      rows={2}
                      value={step.potentialConsequences}
                      onChange={e => handleStepChange(step.id, 'potentialConsequences', e.target.value)}
                      placeholder={isFa ? 'مثال: آسیب شدید جسمی، شکستگی، توقف کار' : 'e.g. Fractures, downtime'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>
                </div>

                {/* Risk Calculations & Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  {/* Initial Risk */}
                  <div className="md:col-span-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-500 mb-1">
                      {isFa ? 'ارزیابی ریسک اولیه (بدون کنترل)' : 'Initial Risk Assessment'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'احتمال (P)' : 'Prob (P)'}</span>
                        <select
                          value={step.initialProbability}
                          onChange={e => handleStepChange(step.id, 'initialProbability', Number(e.target.value))}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                        >
                          <option value={1}>۱ (خیلی کم)</option>
                          <option value={2}>۲ (کم)</option>
                          <option value={3}>۳ (متوسط)</option>
                          <option value={4}>۴ (زیاد)</option>
                          <option value={5}>۵ (بسیار زیاد)</option>
                        </select>
                      </div>
                      <span className="font-black text-slate-400">×</span>
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'شدت (S)' : 'Sev (S)'}</span>
                        <select
                          value={step.initialSeverity}
                          onChange={e => handleStepChange(step.id, 'initialSeverity', Number(e.target.value))}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                        >
                          <option value={1}>۱ (ناچیز)</option>
                          <option value={2}>۲ (جزیی)</option>
                          <option value={3}>۳ (متوسط)</option>
                          <option value={4}>۴ (شدید)</option>
                          <option value={5}>۵ (فاجعه‌بار)</option>
                        </select>
                      </div>
                      <div className="mr-auto text-center">
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'نمره / رتبه' : 'Score / Level'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${initColor.badge}`}>
                          {step.initialRiskScore} ({step.initialRiskLevel})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Control Hierarchy & Measures */}
                  <div className="md:col-span-6 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                        {isFa ? 'اقدامات کنترلی و پیشگیرانه (Hierarchy of Controls) *' : 'Control Measures *'}
                      </span>
                      <select
                        value={step.hierarchyControl}
                        onChange={e => handleStepChange(step.id, 'hierarchyControl', e.target.value)}
                        className="text-[10px] font-bold p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300"
                      >
                        <option value="ELIMINATION">{isFa ? '۱. حذف خطر (Elimination)' : 'Elimination'}</option>
                        <option value="SUBSTITUTION">{isFa ? '۲. جایگزینی (Substitution)' : 'Substitution'}</option>
                        <option value="ENGINEERING">{isFa ? '۳. کنترل مهندسی (Engineering)' : 'Engineering'}</option>
                        <option value="ADMINISTRATIVE">{isFa ? '۴. کنترل اداری / رویه‌ای (Administrative)' : 'Administrative'}</option>
                        <option value="PPE">{isFa ? '۵. لوازم حفاظت فردی (PPE)' : 'PPE'}</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={step.controlMeasures}
                      onChange={e => handleStepChange(step.id, 'controlMeasures', e.target.value)}
                      placeholder={isFa ? 'مثال: استفاده از داربست مجهز به تگ سبز، اتصال دائمی به لایف‌لاین، حضور ناظر ایمنی' : 'Specify exact control actions'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>

                  {/* Residual Risk */}
                  <div className="md:col-span-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-1">
                      {isFa ? 'ریسک باقیمانده (پس از اعمال کنترل)' : 'Residual Risk'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'احتمال ثانویه' : 'Res. P'}</span>
                        <select
                          value={step.residualProbability}
                          onChange={e => handleStepChange(step.id, 'residualProbability', Number(e.target.value))}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                        >
                          <option value={1}>۱</option>
                          <option value={2}>۲</option>
                          <option value={3}>۳</option>
                          <option value={4}>۴</option>
                        </select>
                      </div>
                      <span className="font-black text-slate-400">×</span>
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'شدت ثانویه' : 'Res. S'}</span>
                        <select
                          value={step.residualSeverity}
                          onChange={e => handleStepChange(step.id, 'residualSeverity', Number(e.target.value))}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                        >
                          <option value={1}>۱</option>
                          <option value={2}>۲</option>
                          <option value={3}>۳</option>
                          <option value={4}>۴</option>
                        </select>
                      </div>
                      <div className="mr-auto text-center">
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'نمره / رتبه' : 'Score'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${resColor.badge}`}>
                          {step.residualRiskScore} ({step.residualRiskLevel})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
}

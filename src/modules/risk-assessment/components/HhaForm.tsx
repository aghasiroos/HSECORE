import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Save, 
  Printer, 
  ArrowRight, 
  Info,
  HeartPulse
} from 'lucide-react';
import { HhaAssessment, HhaItem, RiskLevel } from '../types';
import { getRiskLevelColor } from '../services/riskAssessmentService';
import RiskPersonnelSignatures from './RiskPersonnelSignatures';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { printService } from '../../../services/printService';
import { getUnits, getJobTitles } from '../../../utils/orgHelper';

interface HhaFormProps {
  initialData?: HhaAssessment | null;
  onSave: (assessment: HhaAssessment) => void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

export default function HhaForm({ initialData, onSave, onCancel, isFa, currentUser }: HhaFormProps) {
  const [formData, setFormData] = useState<HhaAssessment>(() => {
    if (initialData) return initialData;
    const nowJalali = '1404/06/05';
    return {
      id: `hha-${Date.now()}`,
      code: `HHA-1404-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: '',
      unit: '',
      areaLocation: '',
      assessorName: '',
      assessmentDate: nowJalali,
      teamMembers: [],
      status: 'APPROVED',
      method: 'HHA',
      overallRiskLevel: 'HIGH',
      assessedDepartment: '',
      headcountExposed: 0,
      items: [
        {
          id: `hha-item-${Date.now()}-1`,
          jobRole: '',
          workplaceArea: '',
          hazardCategory: 'CHEMICAL',
          agentName: '',
          exposureRoute: 'INHALATION',
          exposureDuration: '۶ ساعت در روز',
          measuredLevel: '',
          standardOel: '',
          healthEffect: '',
          riskRating: 'HIGH',
          existingControls: '',
          proposedControls: '',
          targetMedicalTests: ''
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const handleAddItem = () => {
    const newItem: HhaItem = {
      id: `hha-item-${Date.now()}-${formData.items.length + 1}`,
      jobRole: '',
      workplaceArea: '',
      hazardCategory: 'PHYSICAL',
      agentName: '',
      exposureRoute: 'ACOUSTIC',
      exposureDuration: '۸ ساعت در شیفت',
      measuredLevel: '',
      standardOel: '',
      healthEffect: '',
      riskRating: 'MEDIUM',
      existingControls: '',
      proposedControls: '',
      targetMedicalTests: ''
    };
    setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const handleRemoveItem = (itemId: string) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
  };

  const handleItemChange = (itemId: string, field: keyof HhaItem, value: any) => {
    setFormData(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.id !== itemId) return item;
        return { ...item, [field]: value };
      });

      const hasCritical = updatedItems.some(i => i.riskRating === 'CRITICAL');
      const hasHigh = updatedItems.some(i => i.riskRating === 'HIGH');
      const overallLevel: RiskLevel = hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : 'MEDIUM';

      return {
        ...prev,
        items: updatedItems,
        overallRiskLevel: overallLevel
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert(isFa ? 'لطفاً عنوان ارزیابی بهداشت حرفه‌ای را وارد فرمایید' : 'Please enter HHA title');
      return;
    }
    onSave(formData);
  };

  const overallColors = getRiskLevelColor(formData.overallRiskLevel);

  const handlePrint = () => {
    printService.printElement('hha-assessment-form-print', {
      title: `ارزیابی خطرات بهداشتی و طب کار (HHA) - ${formData.code} - ${formData.assessedDepartment || formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-HHA-01',
      documentDate: formData.assessmentDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  return (
    <form id="hha-assessment-form-print" onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {initialData ? (isFa ? 'ویرایش ارزیابی خطرات بهداشتی (HHA)' : 'Edit Health Hazard Assessment') : (isFa ? 'فرم ارزیابی خطرات بهداشتی و طب کار (HHA)' : 'New Health Hazard Assessment Form')}
            </h2>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap" dir="ltr">
              {formData.code}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold mt-1 mr-7">
            {isFa ? 'شناسایی و پایش عوامل زیان‌آور شیمیایی، فیزیکی، ارگونومی، بیولوژیکی و برنامه‌ریزی معاینات طب کار' : 'Occupational health hazard assessment and surveillance'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{isFa ? 'سطح ریسک بهداشتی:' : 'Health Risk:'}</span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black whitespace-nowrap ${overallColors.badge}`}>
              {isFa ? overallColors.labelFa : overallColors.labelEn}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isFa ? 'چاپ استاندارد فرم HHA' : 'Print HHA Form'}
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-emerald-500/20 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isFa ? 'ذخیره پرونده بهداشت حرفه‌ای' : 'Save HHA Record'}</span>
          </button>
        </div>
      </div>

      {/* ── Metadata ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Info className="w-4 h-4 text-emerald-600" />
          {isFa ? 'مشخصات واحد و جمعیت تحت مواجهه' : 'Department & Exposed Population'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'عنوان ارزیابی بهداشت حرفه‌ای *' : 'HHA Title *'}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder={isFa ? 'مثال: ارزیابی مواجهه با بخارات شیمیایی و صدای محیط کار آزمایشگاه' : 'e.g. Chemical & Noise Exposure'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'دپارتمان / واحد مورد ارزیابی' : 'Department'}
            </label>
            <input
              type="text"
              list="hha-units-list"
              value={formData.assessedDepartment}
              onChange={e => setFormData({ ...formData, assessedDepartment: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
            />
            <datalist id="hha-units-list">
              {getUnits().map(u => <option key={u} value={u} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'تعداد پرسنل در معرض خطر (نفر)' : 'Exposed Headcount'}
            </label>
            <input
              type="number"
              value={formData.headcountExposed}
              onChange={e => setFormData({ ...formData, headcountExposed: Number(e.target.value) })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'تاریخ ارزیابی' : 'Date'}
            </label>
            <PersianDatePicker
              value={formData.assessmentDate}
              onChange={(jStr) => setFormData({ ...formData, assessmentDate: jStr })}
              isFa={isFa}
              placeholder={isFa ? 'انتخاب تاریخ ارزیابی...' : 'Assessment date...'}
            />
          </div>
        </div>
      </div>

      {/* Personnel Signatures Block */}
      <RiskPersonnelSignatures
        formData={formData}
        onChange={(updated) => setFormData(prev => ({ ...prev, ...updated, method: 'HHA' }))}
        isFa={isFa}
      />

      {/* ── HHA Items Table ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-600" />
              {isFa ? 'جدول شناسایی عوامل زیان‌آور، مقادیر سنجش، اثرات و آزمایش‌های طب کار' : 'Health Hazards & Occupational Health Actions'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFa ? '+ افزودن عامل زیان‌آور' : '+ Add Hazard Agent'}</span>
          </button>
        </div>

        <div className="space-y-4">
          {formData.items.map((item, index) => {
            const riskCol = getRiskLevelColor(item.riskRating);

            return (
              <div 
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    {isFa ? `عامل زیان‌آور شماره ${index + 1}` : `Agent #${index + 1}`}
                  </span>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700 p-1 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'شغل / سمت سازمانی *' : 'Job Role *'}
                    </label>
                    <input
                      type="text"
                      list="hha-jobs-list"
                      value={item.jobRole}
                      onChange={e => handleItemChange(item.id, 'jobRole', e.target.value)}
                      placeholder={isFa ? 'مثال: آنالیست شیمی' : 'e.g. Chemist'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                    <datalist id="hha-jobs-list">
                      {getJobTitles().map(j => <option key={j} value={j} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'دسته عامل زیان‌آور *' : 'Category *'}
                    </label>
                    <select
                      value={item.hazardCategory}
                      onChange={e => handleItemChange(item.id, 'hazardCategory', e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    >
                      <option value="CHEMICAL">{isFa ? 'شیمیایی (گاز، بخار، گرد و غبار)' : 'Chemical'}</option>
                      <option value="PHYSICAL">{isFa ? 'فیزیکی (صدا، ارتعاش، حرارت، پرتو)' : 'Physical'}</option>
                      <option value="ERGONOMIC">{isFa ? 'ارگونومیک (حمل بار، پوسچر نامناسب)' : 'Ergonomic'}</option>
                      <option value="BIOLOGICAL">{isFa ? 'بیولوژیکی (باکتری، ویروس، قارچ)' : 'Biological'}</option>
                      <option value="PSYCHOSOCIAL">{isFa ? 'روانشناختی / استرس شغلی' : 'Psychosocial'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'نام عامل زیان‌آور *' : 'Agent Name *'}
                    </label>
                    <input
                      type="text"
                      value={item.agentName}
                      onChange={e => handleItemChange(item.id, 'agentName', e.target.value)}
                      placeholder={isFa ? 'مثال: بخارات بنزن / سر و صدا' : 'e.g. Benzene'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'رتبه ریسک بهداشتی' : 'Risk Rating'}
                    </label>
                    <select
                      value={item.riskRating}
                      onChange={e => handleItemChange(item.id, 'riskRating', e.target.value)}
                      className={`w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black outline-hidden ${riskCol.badge}`}
                    >
                      <option value="LOW">{isFa ? 'پایین (Acceptable)' : 'Low'}</option>
                      <option value="MEDIUM">{isFa ? 'متوسط (Medium)' : 'Medium'}</option>
                      <option value="HIGH">{isFa ? 'بالا (High)' : 'High'}</option>
                      <option value="CRITICAL">{isFa ? 'بحرانی (Critical)' : 'Critical'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'عوارض بر سلامت (Health Effects)' : 'Health Effects'}
                    </label>
                    <textarea
                      rows={2}
                      value={item.healthEffect}
                      onChange={e => handleItemChange(item.id, 'healthEffect', e.target.value)}
                      placeholder={isFa ? 'مثال: سرطان‌زایی، افت شنوایی ناشی از صدا' : 'e.g. Hearing loss'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'اقدامات کنترلی مهندسی و بهداشتی پیشنهادی' : 'Proposed Controls'}
                    </label>
                    <textarea
                      rows={2}
                      value={item.proposedControls}
                      onChange={e => handleItemChange(item.id, 'proposedControls', e.target.value)}
                      placeholder={isFa ? 'مثال: نصب هود موضعی با دبی مناسب، ایرماف استاندارد' : 'e.g. Local exhaust ventilation'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      {isFa ? 'آزمایش‌های اختصاصی طب کار (Medical Surveillance)' : 'Target Medical Tests'}
                    </label>
                    <textarea
                      rows={2}
                      value={item.targetMedicalTests}
                      onChange={e => handleItemChange(item.id, 'targetMedicalTests', e.target.value)}
                      placeholder={isFa ? 'مثال: ادیومتری سالانه، سنجش اسید ترانس‌موکونیک ادرار، اسپیرومتری' : 'e.g. Audiometry'}
                      className="w-full p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
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

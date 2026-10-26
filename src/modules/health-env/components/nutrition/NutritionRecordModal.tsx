import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Activity, 
  Heart, 
  Apple, 
  Scale, 
  FileText, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Check, 
  Plus, 
  Trash2,
  Salad,
  Info
} from 'lucide-react';
import { 
  NutritionRecord, 
  NutritionBmiCategory, 
  DietGoal, 
  FastFoodFrequency,
  SugaryDrinksFrequency,
  SaltIntakeLevel,
  FatOilPreference,
  MealTimingPattern,
  CaffeineIntakeLevel,
  PhysicalActivityLevel,
  FattyLiverGrade,
  ConsultationType,
  FollowUpStatus,
  NutritionPriority
} from '../../types/nutritionTypes';
import CentralPersonnelSelector from '../../../../components/CentralPersonnelSelector';
import { ComplexPersonnel, PersonnelOrgDetails } from '../../../../utils/personnelHelper';
import { nutritionService } from '../../services/nutritionService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Partial<NutritionRecord>) => Promise<void>;
  initialData?: NutritionRecord | null;
  currentUser?: any;
  todayJalali: string;
}

const COMMON_UNDERLYING_CONDITIONS = [
  'کبد چرب',
  'دیابت نوع ۲',
  'پره‌دیابت (قند لب مرز)',
  'فشار خون بالا',
  'دیس‌لیپیدمی (چربی خون)',
  'چاقی مفرط (BMI >= 30)',
  'رفلاکس معده و سوءهاضمه',
  'سندرم روده تحریک‌پذیر (IBS)',
  'نقرس و اسید اوریک بالا',
  'سندرم متابولیک',
  'کم‌کاری تیروئید'
];

const COMMON_RECOMMENDATIONS = [
  'کاهش مصرف قندهای ساده، نوشابه‌ها و شیرینی‌جات صنعتی',
  'جایگزینی روغن‌های جامد با روغن زیتون بکر و دانه‌های روغنی',
  'افزایش مصرف فیبر روزانه با حداقل ۳ تا ۵ واحد سبزیجات تازه',
  'مصرف میان‌وعده‌های سالم (آجیل خام، میوه) در شیفت شب جهت جلوگیری از افت قند',
  'پرهیز از مصرف وعده سنگین بلافاصله قبل از خواب در استراحت شیفت',
  'نوشیدن حداقل ۸ تا ۱۰ لیوان آب در طول روز کاری و پرهیز از کم‌آبی',
  'حداقل ۱۵۰ دقیقه فعالیت بدنی هوازی با شدت متوسط در هفته',
  'محدود کردن فست‌فود و غذاهای فراوری‌شده به حداکثر یک‌بار در ماه',
  'کاهش نمک مصرفی سر سفره و استفاده از چاشنی‌های طبیعی (لیمو، ادویه‌ها)'
];

export default function NutritionRecordModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentUser,
  todayJalali
}: Props) {
  const [activeTab, setActiveTab] = useState<'anthropometrics' | 'dietary' | 'biomarkers' | 'plan' | 'consultation'>('anthropometrics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<NutritionRecord>>(() => {
    if (initialData) return { ...initialData };

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return {
      visitDate: todayJalali,
      visitTime: timeStr,
      shift: 'عادی‌کار',
      personnelCode: '',
      nationalCode: '',
      fullName: '',
      unit: '',
      jobTitle: '',
      height: 175,
      weight: 75,
      bmi: 24.5,
      bmiCategory: 'normal',
      fastFoodFrequency: 'rarely',
      sugaryDrinksFrequency: 'rarely',
      saltIntake: 'moderate',
      fatOilPreference: 'olive_liquid',
      mealTimingPattern: 'regular_3_meals',
      caffeineIntake: 'moderate',
      physicalActivityLevel: 'moderate',
      fattyLiverGrade: 'none',
      underlyingConditions: [],
      dietGoal: 'general_wellness',
      dietPlanSummary: '',
      recommendations: [],
      consultationType: 'initial_assessment',
      consultantName: currentUser?.fullName || currentUser?.name || 'کارشناس تغذیه',
      consultationNotes: '',
      followUpStatus: 'pending',
      priority: 'routine'
    };
  });

  // Sync when isOpen or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData });
      } else {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setFormData({
          visitDate: todayJalali,
          visitTime: timeStr,
          shift: 'عادی‌کار',
          personnelCode: '',
          nationalCode: '',
          fullName: '',
          unit: '',
          jobTitle: '',
          height: 175,
          weight: 75,
          bmi: 24.5,
          bmiCategory: 'normal',
          fastFoodFrequency: 'rarely',
          sugaryDrinksFrequency: 'rarely',
          saltIntake: 'moderate',
          fatOilPreference: 'olive_liquid',
          mealTimingPattern: 'regular_3_meals',
          caffeineIntake: 'moderate',
          physicalActivityLevel: 'moderate',
          fattyLiverGrade: 'none',
          underlyingConditions: [],
          dietGoal: 'general_wellness',
          dietPlanSummary: '',
          recommendations: [],
          consultationType: 'initial_assessment',
          consultantName: currentUser?.fullName || currentUser?.name || 'کارشناس تغذیه',
          consultationNotes: '',
          followUpStatus: 'pending',
          priority: 'routine'
        });
      }
      setActiveTab('anthropometrics');
      setError(null);
    }
  }, [isOpen, initialData, todayJalali, currentUser]);

  // Dynamically calculate BMI & WHR
  useEffect(() => {
    const h = Number(formData.height) || 0;
    const w = Number(formData.weight) || 0;
    if (h > 0 && w > 0) {
      const hM = h / 100;
      const computedBmi = Number((w / (hM * hM)).toFixed(1));
      const category = nutritionService.getBmiCategory(computedBmi);
      setFormData(prev => ({
        ...prev,
        bmi: computedBmi,
        bmiCategory: category
      }));
    }
  }, [formData.height, formData.weight]);

  useEffect(() => {
    const waist = Number(formData.waistCircumference) || 0;
    const hip = Number(formData.hipCircumference) || 0;
    if (waist > 0 && hip > 0) {
      const computedWhr = Number((waist / hip).toFixed(2));
      setFormData(prev => ({
        ...prev,
        whr: computedWhr
      }));
    }
  }, [formData.waistCircumference, formData.hipCircumference]);

  const handleSelectPersonnel = (person: ComplexPersonnel | null, orgDetails: PersonnelOrgDetails) => {
    if (!person) {
      setFormData(prev => ({
        ...prev,
        personnelId: undefined,
        personnelCode: '',
        nationalCode: '',
        fullName: '',
        unit: '',
        jobTitle: '',
        gender: undefined,
        phone: undefined,
        age: undefined
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      personnelId: person.id,
      personnelCode: person.personnelCode || '',
      nationalCode: person.nationalCode || '',
      fullName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      unit: orgDetails.unit || person.unit || '',
      department: orgDetails.department || person.department,
      jobTitle: person.jobTitle || '',
      phone: person.phone || (person as any).mobile || '',
      gender: (person as any).gender || 'MALE'
    }));
  };

  const toggleCondition = (cond: string) => {
    setFormData(prev => {
      const current = prev.underlyingConditions || [];
      if (current.includes(cond)) {
        return { ...prev, underlyingConditions: current.filter(c => c !== cond) };
      } else {
        return { ...prev, underlyingConditions: [...current, cond] };
      }
    });
  };

  const toggleRecommendation = (rec: string) => {
    setFormData(prev => {
      const current = prev.recommendations || [];
      if (current.includes(rec)) {
        return { ...prev, recommendations: current.filter(r => r !== rec) };
      } else {
        return { ...prev, recommendations: [...current, rec] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.personnelCode || !formData.fullName) {
      setError('لطفاً پرسنل مورد نظر را از بانک اطلاعاتی مرکزی انتخاب کنید.');
      setActiveTab('anthropometrics');
      return;
    }

    if (!formData.height || !formData.weight) {
      setError('ثبت قد و وزن برای ارزیابی وضعیت تغذیه الزامی است.');
      setActiveTab('anthropometrics');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت اطلاعات در سرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBmiBadge = (category?: NutritionBmiCategory) => {
    switch (category) {
      case 'underweight':
        return { label: 'کم‌وزن (Underweight)', color: 'text-amber-700 dark:text-amber-300' };
      case 'normal':
        return { label: 'نرمال و متناسب (Normal)', color: 'text-emerald-700 dark:text-emerald-300 font-bold' };
      case 'overweight':
        return { label: 'اضافه وزن (Overweight)', color: 'text-orange-700 dark:text-orange-300 font-bold' };
      case 'obese_1':
        return { label: 'چاقی درجه ۱ (Obese Class I)', color: 'text-rose-700 dark:text-rose-300 font-bold' };
      case 'obese_2':
        return { label: 'چاقی درجه ۲ (Obese Class II)', color: 'text-rose-700 dark:text-rose-300 font-bold' };
      case 'obese_3':
        return { label: 'چاقی مفرط درجه ۳ (Obese Class III)', color: 'text-red-700 dark:text-red-300 font-bold' };
      default:
        return { label: 'نامشخص', color: 'text-slate-600' };
    }
  };

  const bmiInfo = getBmiBadge(formData.bmiCategory);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Apple className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                {initialData ? 'ویرایش پرونده مشاوره و ارزیابی تغذیه' : 'ثبت پرونده و مشاوره تغذیه جدید'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تن‌سنجی، عادات غذایی، پایش شاخص‌های متابولیک و برنامه رژیم پرسنل
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Navigation Controls (Interactive Filter Buttons) */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('anthropometrics')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'anthropometrics'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>مشخصات و تن‌سنجی</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dietary')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'dietary'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Salad className="w-4 h-4" />
              <span>ارزیابی عادات غذایی</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('biomarkers')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'biomarkers'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>پایش شاخص‌ها و آزمایشات</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'plan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>برنامه و توصیه‌های تغذیه</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('consultation')}
              className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'consultation'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>شرح مشاوره و پیگیری</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Tab Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* TAB 1: Anthropometrics */}
          {activeTab === 'anthropometrics' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {/* Personnel Selector from Master DB */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  انتخاب پرسنل از بانک اطلاعاتی مرکزی سازمانی <span className="text-rose-500">*</span>
                </label>
                <CentralPersonnelSelector
                  selectedPersonnelCode={formData.personnelCode}
                  onSelectPersonnel={handleSelectPersonnel}
                  placeholder="جستجو با نام، کد پرسنلی یا کد ملی..."
                />
                {formData.fullName && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-medium">
                    <span>نام: <strong>{formData.fullName}</strong></span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>کد پرسنلی: <strong>{formData.personnelCode}</strong></span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>واحد: <strong>{formData.unit || 'نامشخص'}</strong></span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>شغل: <strong>{formData.jobTitle || 'نامشخص'}</strong></span>
                  </div>
                )}
              </div>

              {/* Consultation Date, Time, Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاریخ مراجعه (شمسی) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.visitDate || ''}
                    onChange={e => setFormData({ ...formData, visitDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="1405/07/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ساعت مراجعه
                  </label>
                  <input
                    type="text"
                    value={formData.visitTime || ''}
                    onChange={e => setFormData({ ...formData, visitTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="10:30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    شیفت کاری پرسنل
                  </label>
                  <select
                    value={formData.shift || 'عادی‌کار'}
                    onChange={e => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="عادی‌کار">عادی‌کار (روزکار ۸ ساعته)</option>
                    <option value="نوبت‌کاری ۱۲ ساعته">نوبت‌کاری ۱۲ ساعته (شیفت روز / شب)</option>
                    <option value="نوبت‌کاری ۸ ساعته">نوبت‌کاری ۸ ساعته (صبح، عصر، شب)</option>
                    <option value="اقماری ۱۴-۱۴">اقماری ۱۴-۱۴</option>
                    <option value="اقماری ۲۱-۷">اقماری ۲۱-۷</option>
                  </select>
                </div>
              </div>

              {/* Anthropometrics Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>شاخص‌های تن‌سنجی و ترکیب بدنی</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      قد (سانتی‌متر) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={100}
                      max={250}
                      value={formData.height || ''}
                      onChange={e => setFormData({ ...formData, height: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="175"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      وزن (کیلوگرم) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min={30}
                      max={300}
                      value={formData.weight || ''}
                      onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="75.5"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      دور کمر (سانتی‌متر)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.waistCircumference || ''}
                      onChange={e => setFormData({ ...formData, waistCircumference: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="88"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      دور باسن (سانتی‌متر)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.hipCircumference || ''}
                      onChange={e => setFormData({ ...formData, hipCircumference: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="100"
                    />
                  </div>
                </div>

                {/* Real-time Calculated Indicators */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">شاخص توده بدنی (BMI):</span>
                    <strong className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formData.bmi || '---'}
                    </strong>
                    <span className={`text-xs ${bmiInfo.color}`}>
                      ({bmiInfo.label})
                    </span>
                  </div>

                  {formData.whr !== undefined && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span>نسبت دور کمر به باسن (WHR):</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{formData.whr}</strong>
                      <span className="text-[11px] text-slate-400">
                        {formData.whr > 0.90 ? '(چاقی شکمی بالا)' : '(طبیعی)'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional optional anthropometrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      درصد چربی تخمینی بدن (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.bodyFatPercentage || ''}
                      onChange={e => setFormData({ ...formData, bodyFatPercentage: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="مثال: 22.5"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      فشار خون سیستولیک (mmHg)
                    </label>
                    <input
                      type="number"
                      value={formData.systolicBp || ''}
                      onChange={e => setFormData({ ...formData, systolicBp: parseInt(e.target.value, 10) || undefined })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="120"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      فشار خون دیاستولیک (mmHg)
                    </label>
                    <input
                      type="number"
                      value={formData.diastolicBp || ''}
                      onChange={e => setFormData({ ...formData, diastolicBp: parseInt(e.target.value, 10) || undefined })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="80"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Dietary Habits Assessment */}
          {activeTab === 'dietary' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    مصرف آب روزانه (لیتر در روز)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.waterIntakeLiters || ''}
                    onChange={e => setFormData({ ...formData, waterIntakeLiters: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="مثال: 2"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    سهم مصرف میوه و سبزیجات روزانه (واحد)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.fruitVeggieServings || ''}
                    onChange={e => setFormData({ ...formData, fruitVeggieServings: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="مثال: 3"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    بسامد مصرف فست‌فود و غذاهای سرخ‌کردنی
                  </label>
                  <select
                    value={formData.fastFoodFrequency || 'rarely'}
                    onChange={e => setFormData({ ...formData, fastFoodFrequency: e.target.value as FastFoodFrequency })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="never">اصلاً مصرف نمی‌کند</option>
                    <option value="rarely">به‌ندرت (کمتر از یک‌بار در ماه)</option>
                    <option value="weekly_1_2">۱ تا ۲ بار در هفته</option>
                    <option value="weekly_3_plus">۳ بار یا بیشتر در هفته</option>
                    <option value="daily">روزانه</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    مصرف نوشیدنی‌های شیرین و شکر صنعتی
                  </label>
                  <select
                    value={formData.sugaryDrinksFrequency || 'rarely'}
                    onChange={e => setFormData({ ...formData, sugaryDrinksFrequency: e.target.value as SugaryDrinksFrequency })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="never">اصلاً (بدون قند و شکر)</option>
                    <option value="rarely">به‌ندرت</option>
                    <option value="weekly">چند بار در هفته</option>
                    <option value="daily">روزانه و مکرر</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    میزان مصرف نمک و شوری غذا
                  </label>
                  <select
                    value={formData.saltIntake || 'moderate'}
                    onChange={e => setFormData({ ...formData, saltIntake: e.target.value as SaltIntakeLevel })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="low">کم‌نمک (تغذیه سالم)</option>
                    <option value="moderate">متوسط (معمول)</option>
                    <option value="high">زیاد (استفاده از نمکدان سر سفره)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    نوع روغن غالب در سبد غذایی
                  </label>
                  <select
                    value={formData.fatOilPreference || 'olive_liquid'}
                    onChange={e => setFormData({ ...formData, fatOilPreference: e.target.value as FatOilPreference })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="olive_liquid">روغن زیتون، کنجد و مایع گیاهی</option>
                    <option value="balanced">ترکیبی و متعادل</option>
                    <option value="solid_animal">روغن‌های جامد، حیوانی و دنبه</option>
                    <option value="fried">غذاهای عمدتاً سرخ‌شده با روغن زیاد</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    الگوی زمان‌بندی وعده‌های غذایی در شیفت
                  </label>
                  <select
                    value={formData.mealTimingPattern || 'regular_3_meals'}
                    onChange={e => setFormData({ ...formData, mealTimingPattern: e.target.value as MealTimingPattern })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="regular_3_meals">۳ وعده منظم در ساعات مشخص</option>
                    <option value="skips_breakfast">حذف صبحانه و پرخوری در ناهار/شام</option>
                    <option value="late_night_eating">غذا خوردن دیروقت در انتهای شب</option>
                    <option value="shift_irregular">نامنظم به دلیل چرخش شیفت و شب‌کاری</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    سطح فعالیت بدنی و ورزش هفتگی
                  </label>
                  <select
                    value={formData.physicalActivityLevel || 'moderate'}
                    onChange={e => setFormData({ ...formData, physicalActivityLevel: e.target.value as PhysicalActivityLevel })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="sedentary">بی‌تحرک (پشت‌میزنشین بدون ورزش)</option>
                    <option value="light">سبک (پیاده‌روی گاه‌به‌گاه)</option>
                    <option value="moderate">متوسط (ورزش منظم ۲ تا ۳ جلسه در هفته)</option>
                    <option value="heavy">سنگین (شغل پرتحرک فیزیکی یا ورزش حرفه‌ای)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  یادداشت عادات و رفتارهای غذایی خاص
                </label>
                <textarea
                  rows={2}
                  value={formData.dietaryHabitNotes || ''}
                  onChange={e => setFormData({ ...formData, dietaryHabitNotes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                  placeholder="مثال: حساسیت به لاکتوز شیر، ریزه‌خواری حین کار با کامپیوتر، مصرف زیاد چای و قهوه..."
                />
              </div>
            </div>
          )}

          {/* TAB 3: Biomarkers & Metabolic Conditions */}
          {activeTab === 'biomarkers' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    قند خون ناشتا FBS (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={formData.fbs || ''}
                    onChange={e => setFormData({ ...formData, fbs: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="95"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    کلسترول تام (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={formData.cholesterol || ''}
                    onChange={e => setFormData({ ...formData, cholesterol: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="180"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تری‌گلیسرید TG (mg/dL)
                  </label>
                  <input
                    type="number"
                    value={formData.triglycerides || ''}
                    onChange={e => setFormData({ ...formData, triglycerides: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="150"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    گرید کبد چرب (سونوگرافی)
                  </label>
                  <select
                    value={formData.fattyLiverGrade || 'none'}
                    onChange={e => setFormData({ ...formData, fattyLiverGrade: e.target.value as FattyLiverGrade })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="none">طبیعی / بدون کبد چرب</option>
                    <option value="grade_1">گرید ۱ (خفیف)</option>
                    <option value="grade_2">گرید ۲ (متوسط)</option>
                    <option value="grade_3">گرید ۳ (شدید)</option>
                  </select>
                </div>
              </div>

              {/* Conditions Checklist */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  بیماری‌ها و شرایط بالینی زمینه‌ای:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {COMMON_UNDERLYING_CONDITIONS.map(c => {
                    const isChecked = (formData.underlyingConditions || []).includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCondition(c)}
                        className={`p-2 rounded-xl text-xs font-medium text-right border transition flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{c}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Nutrition Plan & Recommendations */}
          {activeTab === 'plan' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    هدف رژیم و برنامه تغذیه‌ای <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.dietGoal || 'general_wellness'}
                    onChange={e => setFormData({ ...formData, dietGoal: e.target.value as DietGoal })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="weight_loss">کاهش وزن و چربی‌سوزی</option>
                    <option value="weight_gain">افزایش وزن و حجم عضلانی</option>
                    <option value="weight_maintenance">تثبیت وزن و تعادل تغذیه‌ای</option>
                    <option value="fatty_liver_reversal">بهبود و درمان کبد چرب</option>
                    <option value="diabetes_control">کنترل دیابت و حساسیت انسولینی</option>
                    <option value="hypertension_dash">رژیم کاهش فشار خون (DASH)</option>
                    <option value="shift_work_optimization">بهینه‌سازی تغذیه در نوبت‌کاری و شیفت</option>
                    <option value="general_wellness">ارتقای سلامت عمومی</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    وزن هدف (کیلوگرم)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.targetWeight || ''}
                    onChange={e => setFormData({ ...formData, targetWeight: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="مثال: 70"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    کالری هدف روزانه (kcal)
                  </label>
                  <input
                    type="number"
                    value={formData.dailyCalorieTarget || ''}
                    onChange={e => setFormData({ ...formData, dailyCalorieTarget: parseInt(e.target.value, 10) || undefined })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="مثال: 2100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  الگو و شرح برنامه غذایی پیشنهادی
                </label>
                <textarea
                  rows={3}
                  value={formData.dietPlanSummary || ''}
                  onChange={e => setFormData({ ...formData, dietPlanSummary: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                  placeholder="شرح وعده‌ها: صبحانه پروتئینی، ناهار کم‌چرب با سبزیجات، میان‌وعده سالم در شیفت شب..."
                />
              </div>

              {/* Practical recommendations checklist */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  توصیه‌های کاربردی متناسب با شغل و شیفت کاری پرسنل:
                </label>
                <div className="space-y-1.5 pt-1">
                  {COMMON_RECOMMENDATIONS.map(rec => {
                    const isChecked = (formData.recommendations || []).includes(rec);
                    return (
                      <button
                        key={rec}
                        type="button"
                        onClick={() => toggleRecommendation(rec)}
                        className={`w-full p-2.5 rounded-xl text-xs text-right border transition flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-medium'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{rec}</span>
                        {isChecked && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  مکمل‌های تغذیه‌ای پیشنهادی (در صورت نیاز)
                </label>
                <input
                  type="text"
                  value={formData.supplements || ''}
                  onChange={e => setFormData({ ...formData, supplements: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                  placeholder="مثال: ویتامین D3 ماهیانه، امگا ۳، مولتی‌ویتامین مینرال..."
                />
              </div>
            </div>
          )}

          {/* TAB 5: Consultation Notes & Follow-up */}
          {activeTab === 'consultation' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    نوع مشاوره
                  </label>
                  <select
                    value={formData.consultationType || 'initial_assessment'}
                    onChange={e => setFormData({ ...formData, consultationType: e.target.value as ConsultationType })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="initial_assessment">ارزیابی و مشاوره اولیه</option>
                    <option value="routine_follow_up">پیگیری و بررسی دوره‌ای</option>
                    <option value="special_condition">شرایط خاص متابولیک و بیماری</option>
                    <option value="shift_worker_consult">مشاوره تخصصی شیفت کاری و شب‌کاری</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    کارشناس مشاور تغذیه <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.consultantName || ''}
                    onChange={e => setFormData({ ...formData, consultantName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                    placeholder="نام کارشناس تغذیه"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    سطح اولویت بالینی
                  </label>
                  <select
                    value={formData.priority || 'routine'}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as NutritionPriority })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="routine">عادی و روتین (Routine)</option>
                    <option value="high_risk">پرخطر و نیازمند پایش (High Risk)</option>
                    <option value="urgent">فوری / مداخله تخصصی (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  شرح جلسه مشاوره، بازخورد و ارزیابی پایبندی پرسنل
                </label>
                <textarea
                  rows={4}
                  value={formData.consultationNotes || ''}
                  onChange={e => setFormData({ ...formData, consultationNotes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                  placeholder="نکات مطرح شده در جلسه مشاوره، میزان همکاری فرد، موانع اجرای برنامه در محیط کار..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    وضعیت پیگیری
                  </label>
                  <select
                    value={formData.followUpStatus || 'pending'}
                    onChange={e => setFormData({ ...formData, followUpStatus: e.target.value as FollowUpStatus })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="pending">در انتظار پیگیری و مراجعه بعدی</option>
                    <option value="in_progress">در حال اجرای برنامه غذایی</option>
                    <option value="achieved">تحقق هدف رژیم (موفق)</option>
                    <option value="missed">عدم مراجعه / انصراف</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاریخ مراجعه و ارزیابی بعدی (شمسی)
                  </label>
                  <input
                    type="text"
                    value={formData.nextFollowUpDate || ''}
                    onChange={e => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
                    placeholder="مثال: 1405/08/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ثبت در سرور...' : 'ثبت و ذخیره پرونده تغذیه'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

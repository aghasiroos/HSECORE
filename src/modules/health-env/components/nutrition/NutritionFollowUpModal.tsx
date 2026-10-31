import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Calendar, 
  Scale, 
  Heart, 
  Apple, 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  User, 
  CheckCircle2, 
  FileText,
  ShieldCheck,
  Salad
} from 'lucide-react';
import { 
  HighRiskPersonnelProfile, 
  FollowUpStatus, 
  DietGoal, 
  NutritionRecord 
} from '../../types/nutritionTypes';
import { nutritionService } from '../../services/nutritionService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: HighRiskPersonnelProfile | null;
  onSaved: () => Promise<void>;
  currentUser?: any;
  todayJalali: string;
}

const COMMON_RECOMMENDATIONS_POOL = [
  'کاهش مصرف قندهای ساده، نوشابه‌ها، آبمیوه‌های صنعتی و شیرینی‌جات',
  'جایگزینی روغن‌های جامد و ترانس با روغن زیتون فرابکر و روغن کنجد',
  'مصرف روزانه حداقل ۴۰۰ گرم سبزیجات تازه، کاهو و سالاد با سرکه سیب یا آبلیمو',
  'تنظیم وعده شام سبک در نوبت‌کاری و پرهیز از خواب بلافاصله بعد از صرف غذا',
  'نوشیدن حداقل ۸ تا ۱۰ لیوان آب در طول روز کاری و پرهیز از نوشیدنی‌های انرژی‌زا',
  'پیاده‌روی و تمرینات هوازی منظم حداقل ۱۵۰ دقیقه در هفته با شدت متوسط',
  'محدودیت جدی مصرف فست‌فود، سوسیس، کالباس و غذاهای سرخ‌کرده پرچرب',
  'کاهش مصرف نمک طعام سر سفره و استفاده از چاشنی‌های گیاهی و لیمو ترش تازه',
  'مصرف فیبر محلول (نان سبوس‌دار، جو دوسر) جهت کاهش کلسترول و جذب قند'
];

export default function NutritionFollowUpModal({
  isOpen,
  onClose,
  profile,
  onSaved,
  currentUser,
  todayJalali
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>('in_progress');
  const [dietGoal, setDietGoal] = useState<DietGoal>('weight_loss');
  const [currentWeight, setCurrentWeight] = useState<number>(75);
  const [targetWeight, setTargetWeight] = useState<number | undefined>(undefined);
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number | undefined>(undefined);
  const [dietPlanSummary, setDietPlanSummary] = useState<string>('');
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([]);
  const [supplements, setSupplements] = useState<string>('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>('');
  const [consultationNotes, setConsultationNotes] = useState<string>('');

  // Pre-fill on open or profile change
  useEffect(() => {
    if (isOpen && profile) {
      setFollowUpStatus(profile.followUpStatus === 'achieved' ? 'in_progress' : profile.followUpStatus);
      setDietGoal(
        profile.dietGoal ||
        (profile.fattyLiverGrade === 'grade_2' || profile.fattyLiverGrade === 'grade_3'
          ? 'fatty_liver_reversal'
          : profile.fbs && profile.fbs >= 126
          ? 'diabetes_control'
          : (profile.systolicBp && profile.systolicBp >= 140)
          ? 'hypertension_dash'
          : profile.bmi >= 30
          ? 'weight_loss'
          : 'general_wellness')
      );
      setCurrentWeight(profile.weight || 75);
      setTargetWeight(profile.weight ? Math.round(profile.weight * 0.92) : undefined);
      setDailyCalorieTarget(profile.dailyCalorieTarget || 1850);
      setDietPlanSummary(
        profile.dietPlanSummary ||
        (profile.fattyLiverGrade !== 'none'
          ? 'الگوی رژیم مدیترانه‌ای اصلاح‌شده کم‌چرب، غنی از آنتی‌اکسیدان‌ها، پرهیز از قندهای ساده و تنظیم وعده‌های سبک شیفت کاری.'
          : 'رژیم کنترل کالری، افزایش سهم فیبر و سبزیجات، متعادل‌سازی کربوهیدرات و افزایش فعالیت بدنی روزانه.')
      );
      setSelectedRecommendations(
        profile.recommendations.length > 0
          ? profile.recommendations
          : [COMMON_RECOMMENDATIONS_POOL[0], COMMON_RECOMMENDATIONS_POOL[2], COMMON_RECOMMENDATIONS_POOL[5]]
      );
      setSupplements(
        profile.supplements ||
        (profile.fattyLiverGrade !== 'none' ? 'مکمل ویتامین E و امگا ۳ تحت نظر پزشک' : '')
      );
      setNextFollowUpDate(profile.nextFollowUpDate || '');
      setConsultationNotes(
        profile.consultationNotes ||
        `پیگیری هوشمند وضعیت پرسنل پرخطر با عوامل خطر: ${profile.riskCategories.map(r => r.categoryLabelFa).join('، ')}`
      );
      setError(null);
    }
  }, [isOpen, profile]);

  if (!isOpen || !profile) return null;

  // Quick next-date helper
  const setQuickFollowUp = (daysAhead: number) => {
    try {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      const jStr = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d).replace(/\//g, '/');
      setNextFollowUpDate(jStr);
    } catch {
      setNextFollowUpDate(todayJalali);
    }
  };

  const toggleRecommendation = (rec: string) => {
    setSelectedRecommendations(prev => 
      prev.includes(rec) ? prev.filter(r => r !== rec) : [...prev, rec]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const height = profile.height || 175;
      const weight = Number(currentWeight) || profile.weight || 75;
      const hM = height / 100;
      const computedBmi = Number((weight / (hM * hM)).toFixed(1));
      const bmiCategory = nutritionService.getBmiCategory(computedBmi);

      const recordPayload: Partial<NutritionRecord> = {
        id: profile.nutritionRecordId, // if exists, updates; else creates
        personnelCode: profile.personnelCode,
        nationalCode: profile.nationalCode,
        fullName: profile.fullName,
        unit: profile.unit,
        department: profile.department,
        jobTitle: profile.jobTitle,
        phone: profile.phone,
        gender: profile.gender,
        height,
        weight,
        bmi: computedBmi,
        bmiCategory,
        waistCircumference: profile.waistCircumference,
        whr: profile.whr,
        fattyLiverGrade: profile.fattyLiverGrade,
        systolicBp: profile.systolicBp,
        diastolicBp: profile.diastolicBp,
        fbs: profile.fbs,
        cholesterol: profile.cholesterol,
        triglycerides: profile.triglycerides,
        underlyingConditions: profile.underlyingConditions,
        visitDate: todayJalali,
        shift: 'عادی‌کار',
        consultationType: profile.hasNutritionRecord ? 'routine_follow_up' : 'initial_assessment',
        consultantName: currentUser?.fullName || currentUser?.name || 'کارشناس تغذیه',
        priority: profile.overallPriority,
        dietGoal,
        targetWeight: Number(targetWeight) || undefined,
        dailyCalorieTarget: Number(dailyCalorieTarget) || undefined,
        dietPlanSummary,
        recommendations: selectedRecommendations,
        supplements: supplements.trim() || undefined,
        consultationNotes,
        followUpStatus,
        nextFollowUpDate: nextFollowUpDate.trim() || undefined
      };

      await nutritionService.saveRecord(recordPayload, currentUser);
      await onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save nutrition follow-up:', err);
      setError(err?.message || 'خطا در ثبت و ذخیره پیگیری در پایگاه داده.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <Salad className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-snug">
                ثبت و به‌روزرسانی پیگیری هوشمند کارشناس تغذیه
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                {profile.fullName} · کد پرسنلی: {profile.personnelCode} · واحد: {profile.unit}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Personnel Risk Factors Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                عوامل خطر شناسایی‌شده برای این پرسنل:
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {profile.hasPeriodicExamRecord ? `معاینه ادواری: سال ${profile.lastExamYear || '-'}` : 'فاقد سابقه ادواری'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.riskCategories.map((rc, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                    rc.severity === 'critical'
                      ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
                      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{rc.detailsFa}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Form Grid 1: Follow-up Status & Diet Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                وضعیت پیگیری <span className="text-rose-500">*</span>
              </label>
              <select
                value={followUpStatus}
                onChange={e => setFollowUpStatus(e.target.value as FollowUpStatus)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="in_progress">در حال اجرا و پیگیری مداوم (In Progress)</option>
                <option value="achieved">تحقق هدف رژیم و تثبیت وزن (Achieved)</option>
                <option value="pending">در انتظار مراجعه و ارزیابی (Pending)</option>
                <option value="missed">عدم مراجعه / معوق مانده (Missed)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                هدف برنامه تغذیه‌ای <span className="text-rose-500">*</span>
              </label>
              <select
                value={dietGoal}
                onChange={e => setDietGoal(e.target.value as DietGoal)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="weight_loss">کاهش وزن و چربی‌سوزی</option>
                <option value="fatty_liver_reversal">رژیم پاکسازی و بهبود کبد چرب</option>
                <option value="diabetes_control">کنترل قند و مقاومت به انسولین</option>
                <option value="hypertension_dash">رژیم کاهش فشار خون (DASH)</option>
                <option value="shift_work_optimization">بهینه‌سازی تغذیه در نوبت‌کاری و شیفت</option>
                <option value="weight_maintenance">تثبیت وزن و تعادل تغذیه‌ای</option>
                <option value="general_wellness">ارتقای سلامت عمومی و انرژی</option>
              </select>
            </div>
          </div>

          {/* Form Grid 2: Anthropometrics (Weight, Target Weight, Calories) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                وزن فعلی (کیلوگرم)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={currentWeight || ''}
                  onChange={e => setCurrentWeight(parseFloat(e.target.value) || 0)}
                  className="w-full h-11 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono"
                />
                <Scale className="w-4 h-4 text-slate-400 absolute right-2.5 top-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                وزن هدف (کیلوگرم)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="مثلاً: 68"
                value={targetWeight || ''}
                onChange={e => setTargetWeight(parseFloat(e.target.value) || undefined)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                کالری هدف روزانه (kcal)
              </label>
              <input
                type="number"
                step="50"
                placeholder="مثلاً: 1800"
                value={dailyCalorieTarget || ''}
                onChange={e => setDailyCalorieTarget(parseInt(e.target.value, 10) || undefined)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Form Field 3: Next Follow-Up Date & Quick Selectors */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>تاریخ نوبت پیگیری بعدی (شمسی):</span>
              </label>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickFollowUp(14)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                >
                  ۲ هفته دیگر
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFollowUp(30)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                >
                  ۱ ماه دیگر
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFollowUp(60)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                >
                  ۲ ماه دیگر
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="1405/02/15"
                value={nextFollowUpDate}
                onChange={e => setNextFollowUpDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white font-mono text-center tracking-wider"
              />
            </div>
          </div>

          {/* Form Field 4: Corrective Actions & Plan Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>اقدامات اصلاحی و الگوی رژیم پیشنهادی:</span>
            </label>
            <textarea
              rows={2}
              value={dietPlanSummary}
              onChange={e => setDietPlanSummary(e.target.value)}
              placeholder="شرح الگوی رژیم غذایی و اهداف اصلاحی مدنظر کارشناس تغذیه..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed"
            />
          </div>

          {/* Form Field 5: Recommendations Pool */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              توصیه‌های کاربردی متناسب با شرایط و شیفت پرسنل:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {COMMON_RECOMMENDATIONS_POOL.map((rec, i) => {
                const active = selectedRecommendations.includes(rec);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleRecommendation(rec)}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-start gap-2 ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                      active ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {active && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="leading-relaxed text-[11px]">{rec}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Field 6: Supplements & Consultant Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                مکمل‌های تغذیه‌ای پیشنهادی
              </label>
              <input
                type="text"
                placeholder="مثلاً: قرص ویتامین D، امگا ۳، کپسول سیلیمارین..."
                value={supplements}
                onChange={e => setSupplements(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                شرح جلسه مشاوره و نتیجه پیگیری
              </label>
              <input
                type="text"
                placeholder="توضیحات و بازخورد پرسنل..."
                value={consultationNotes}
                onChange={e => setConsultationNotes(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            انصراف
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'در حال ثبت در پایگاه داده...' : 'ثبت و ذخیره پیگیری هوشمند'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

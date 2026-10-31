import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Activity, 
  Scale, 
  Heart, 
  AlertTriangle, 
  Clock, 
  Printer, 
  Edit3, 
  CheckCircle2, 
  FileText, 
  Stethoscope, 
  ShieldAlert, 
  Droplet,
  ChevronLeft,
  ChevronRight,
  Eye,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { HighRiskPersonnelProfile } from '../../types/nutritionTypes';
import { PeriodicMedicalExam } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: HighRiskPersonnelProfile | null;
  onOpenFollowUp: (profile: HighRiskPersonnelProfile) => void;
  onOpenPrint?: (profile: HighRiskPersonnelProfile) => void;
}

export default function PersonnelExamHistoryModal({
  isOpen,
  onClose,
  profile,
  onOpenFollowUp,
  onOpenPrint
}: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'exams' | 'vitals' | 'trends'>('summary');

  if (!isOpen || !profile) return null;

  const exams: PeriodicMedicalExam[] = profile.allExamsHistory || [];

  const getFitnessBadge = (status?: string) => {
    switch (status) {
      case 'fit':
        return { label: 'مناسب کار بدون محدودیت (Fit)', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300' };
      case 'fit_with_limitations':
        return { label: 'مناسب کار با محدودیت (Fit with Limitations)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300' };
      case 'needs_specialist':
        return { label: 'نیازمند ارزیابی تخصصی (Specialist Review)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border-purple-300' };
      case 'unfit':
        return { label: 'نامناسب برای شغل فعلی (Unfit)', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border-rose-300' };
      default:
        return { label: 'در حال بررسی / نامشخص', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300' };
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
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
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black leading-snug">
                  سوابق پزشکی و پرونده پایش تغذیه: {profile.fullName}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                  کد: {profile.personnelCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {profile.unit} {profile.department ? `· ${profile.department}` : ''} {profile.jobTitle ? `· سمت: ${profile.jobTitle}` : ''}
                {profile.nationalCode ? ` · کد ملی: ${profile.nationalCode}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenFollowUp(profile)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>ثبت پیگیری جدید</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="shrink-0 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-5 pt-3 flex gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'summary'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>خلاصه ریسک و وضعیت بالینی</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'exams'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>تاریخچه معاینات ادواری ({exams.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vitals')}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'vitals'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>شاخص‌های تن‌سنجی و بیومارکرها</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trends')}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trends'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>روند تغییرات و سوابق سنجش</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              
              {/* Identified High Risk Criteria Badges */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-3">
                <h3 className="font-black text-amber-950 dark:text-amber-200 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>عوامل خطر شناسایی‌شده برای این پرسنل</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {profile.riskCategories.map((rc, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        rc.severity === 'critical'
                          ? 'bg-rose-50 text-rose-950 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
                          : rc.severity === 'high'
                          ? 'bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800'
                          : 'bg-blue-50 text-blue-950 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-black">
                        <span>{rc.categoryLabelFa}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/40 font-mono">
                          {rc.severity === 'critical' ? 'بحرانی' : rc.severity === 'high' ? 'پرخطر' : 'متوسط'}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{rc.detailsFa}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vitals Quick Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px] font-bold">شاخص BMI</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <strong className="text-lg font-black text-slate-900 dark:text-white">{profile.bmi || '-'}</strong>
                    <span className="text-[11px] text-slate-500 font-sans">
                      ({profile.bmiCategory === 'overweight' ? 'اضافه‌وزن' : profile.bmiCategory === 'obese_1' ? 'چاقی ۱' : profile.bmiCategory === 'obese_2' ? 'چاقی ۲' : profile.bmiCategory === 'obese_3' ? 'چاقی ۳' : 'طبیعی'})
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px] font-bold">فشار خون</span>
                  <div className="mt-1 font-mono">
                    <strong className="text-lg font-black text-slate-900 dark:text-white">
                      {profile.systolicBp && profile.diastolicBp ? `${profile.systolicBp}/${profile.diastolicBp}` : '---'}
                    </strong>
                    <span className="text-[11px] text-slate-500 font-sans block">
                      {profile.bloodPressureStage === 'crisis' ? 'بحران پرفشاری' : profile.bloodPressureStage === 'stage_2' ? 'پرفشاری درجه ۲' : profile.bloodPressureStage === 'stage_1' ? 'پرفشاری درجه ۱' : profile.bloodPressureStage === 'prehypertension' ? 'پیش‌فشار خون' : 'طبیعی'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px] font-bold">قند خون ناشتا (FBS)</span>
                  <div className="mt-1 font-mono">
                    <strong className="text-lg font-black text-slate-900 dark:text-white">
                      {profile.fbs ? `${profile.fbs} mg/dL` : (profile.randomBs ? `BS: ${profile.randomBs}` : '---')}
                    </strong>
                    {profile.hba1c && (
                      <span className="text-[11px] text-slate-500 font-mono block">
                        HbA1c: {profile.hba1c}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px] font-bold">کبد چرب</span>
                  <div className="mt-1 font-black">
                    <span className={`text-base ${profile.fattyLiverGrade === 'grade_3' ? 'text-rose-600' : profile.fattyLiverGrade === 'grade_2' ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {profile.fattyLiverGrade === 'none' ? 'طبیعی' : `گرید ${profile.fattyLiverGrade.replace('grade_', '')}`}
                    </span>
                    <span className="text-[11px] text-slate-500 block font-normal">
                      {profile.fattyLiverDetails || 'طب کار / سونوگرافی'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nutrition Follow-up Plan Info */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                  <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>وضعیت برنامه مراقبت تغذیه‌ای و پیگیری</span>
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    profile.followUpStatus === 'achieved'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : profile.followUpStatus === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                  }`}>
                    {profile.followUpStatus === 'achieved' ? 'تحقق هدف رژیم' : profile.followUpStatus === 'in_progress' ? 'در حال پیگیری فعال' : 'در انتظار پیگیری'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">هدف مداخله تغذیه:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {profile.dietGoal ? (
                        profile.dietGoal === 'weight_loss' ? 'کاهش وزن و چربی‌سوزی'
                        : profile.dietGoal === 'fatty_liver_reversal' ? 'بهبود کبد چرب'
                        : profile.dietGoal === 'diabetes_control' ? 'کنترل قند و دیابت'
                        : profile.dietGoal === 'hypertension_dash' ? 'کاهش فشار خون (DASH)'
                        : 'ارتقای سلامت عمومی'
                      ) : 'تعیین‌نشده'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">موعد نوبت پیگیری بعدی:</span>
                    <strong className={`font-mono ${profile.isFollowUpOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {profile.nextFollowUpDate || 'ثبت‌نشده'}
                    </strong>
                    {profile.isFollowUpOverdue && (
                      <span className="text-[10px] font-bold text-rose-600 mr-2">
                        (موعد فرارسیده / معوق)
                      </span>
                    )}
                  </div>

                  {profile.dietPlanSummary && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">خلاصه الگوی غذایی:</span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {profile.dietPlanSummary}
                      </p>
                    </div>
                  )}

                  {profile.recommendations && profile.recommendations.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px] mb-1">توصیه‌های کاربردی تغذیه:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                        {profile.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: EXAMS HISTORY */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              {exams.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                  <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-bold">هیچ سابقه معاینه ادواری برای این پرسنل ثبت نشده است.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exams.map((exam, index) => {
                    const fitness = getFitnessBadge(exam.status);
                    return (
                      <div 
                        key={exam.id || index}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <strong className="text-slate-900 dark:text-white font-black text-xs sm:text-sm">
                              معاینه سال {exam.examYear || '-'} · تاریخ: {exam.examDate || '-'}
                            </strong>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({exam.examType || 'معاینه ادواری'})
                            </span>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${fitness.color}`}>
                            {fitness.label}
                          </span>
                        </div>

                        {/* Exam Key Findings */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">فشار خون:</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {exam.findings?.bloodPressure || '-'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">قد و وزن:</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {exam.findings?.heightCm ? `${exam.findings.heightCm}cm` : '-'} / {exam.findings?.weightKg ? `${exam.findings.weightKg}kg` : '-'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">شاخص BMI:</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {exam.findings?.bmi || '-'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">مرکز طب کار:</span>
                            <strong className="text-slate-800 dark:text-slate-200">
                              {exam.medicalCenter || '-'}
                            </strong>
                          </div>
                        </div>

                        {/* Doctor verdict / conclusions */}
                        {exam.findings?.generalConclusion && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-[11px]">
                            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                              نتیجه‌گیری و نظریه پزشک طب کار ({exam.doctor || 'پزشک معاین'}):
                            </span>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                              {exam.findings.generalConclusion}
                            </p>
                          </div>
                        )}

                        {/* Blood Tests & Lab */}
                        {exam.findings?.bloodTests && (
                          <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 text-[11px] border border-blue-100 dark:border-blue-900/40">
                            <span className="font-bold text-blue-900 dark:text-blue-200 block mb-0.5">
                              نتایج آزمایش‌های خون و بیوشیمی:
                            </span>
                            <p className="text-blue-800 dark:text-blue-300 leading-relaxed font-mono">
                              {exam.findings.bloodTests}
                            </p>
                          </div>
                        )}

                        {/* Recommendations */}
                        {exam.recommendations && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            <strong className="text-slate-700 dark:text-slate-300">توصیه‌های شغلی و پزشکی: </strong>
                            <span>{exam.recommendations}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VITALS & BIOMARKERS */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>جدول شاخص‌های تن‌سنجی و بیومارکرهای متابولیک</span>
                </h4>

                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 font-bold">
                      <th className="py-2">شاخص</th>
                      <th className="py-2">مقدار ثبت‌شده</th>
                      <th className="py-2">محدوده مرجع</th>
                      <th className="py-2">ارزیابی وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    <tr>
                      <td className="py-2.5 font-bold">قد (Height)</td>
                      <td className="py-2.5 font-mono">{profile.height ? `${profile.height} cm` : '-'}</td>
                      <td className="py-2.5 text-slate-400">بزرگسالان</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">طبیعی</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">وزن (Weight)</td>
                      <td className="py-2.5 font-mono">{profile.weight ? `${profile.weight} kg` : '-'}</td>
                      <td className="py-2.5 text-slate-400">متناسب با قد</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">-</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">شاخص توده بدنی (BMI)</td>
                      <td className="py-2.5 font-mono font-bold text-rose-600">{profile.bmi || '-'}</td>
                      <td className="py-2.5 text-slate-400 font-mono">18.5 - 24.9</td>
                      <td className="py-2.5 font-bold text-rose-600">
                        {profile.bmi >= 40 ? 'چاقی مفرط (درجه ۳)' : profile.bmi >= 35 ? 'چاقی درجه ۲' : profile.bmi >= 30 ? 'چاقی درجه ۱' : profile.bmi >= 25 ? 'اضافه‌وزن' : 'نرمال'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">فشار خون سیستولیک/دیاستولیک</td>
                      <td className="py-2.5 font-mono font-bold">
                        {profile.systolicBp && profile.diastolicBp ? `${profile.systolicBp}/${profile.diastolicBp} mmHg` : '-'}
                      </td>
                      <td className="py-2.5 text-slate-400 font-mono">&lt; 120/80</td>
                      <td className="py-2.5 font-bold">
                        <span className={profile.bloodPressureStage === 'normal' ? 'text-emerald-600' : 'text-rose-600'}>
                          {profile.bloodPressureStage === 'crisis' ? 'بحران فشار خون' : profile.bloodPressureStage === 'stage_2' ? 'پرفشاری درجه ۲' : profile.bloodPressureStage === 'stage_1' ? 'پرفشاری درجه ۱' : profile.bloodPressureStage === 'prehypertension' ? 'پیش‌فشارخون' : 'طبیعی'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">قند خون ناشتا (FBS)</td>
                      <td className="py-2.5 font-mono">{profile.fbs ? `${profile.fbs} mg/dL` : '-'}</td>
                      <td className="py-2.5 text-slate-400 font-mono">70 - 99</td>
                      <td className="py-2.5 font-bold">
                        <span className={!profile.fbs || profile.fbs < 100 ? 'text-emerald-600' : profile.fbs < 126 ? 'text-amber-600' : 'text-rose-600'}>
                          {!profile.fbs ? '-' : profile.fbs < 100 ? 'طبیعی' : profile.fbs < 126 ? 'پیش‌دیابت' : 'دیابت'}
                        </span>
                      </td>
                    </tr>
                    {profile.hba1c && (
                      <tr>
                        <td className="py-2.5 font-bold">هموگلوبین گلیکوزیله (HbA1c)</td>
                        <td className="py-2.5 font-mono">{profile.hba1c}%</td>
                        <td className="py-2.5 text-slate-400 font-mono">&lt; 5.7%</td>
                        <td className="py-2.5 font-bold">
                          <span className={profile.hba1c < 5.7 ? 'text-emerald-600' : profile.hba1c < 6.5 ? 'text-amber-600' : 'text-rose-600'}>
                            {profile.hba1c < 5.7 ? 'طبیعی' : profile.hba1c < 6.5 ? 'پیش‌دیابت' : 'دیابت'}
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2.5 font-bold">کبد چرب (اولتراسونوگرافی)</td>
                      <td className="py-2.5 font-bold">
                        {profile.fattyLiverGrade === 'none' ? 'طبیعی' : `گرید ${profile.fattyLiverGrade.replace('grade_', '')}`}
                      </td>
                      <td className="py-2.5 text-slate-400">فاقد کبد چرب</td>
                      <td className="py-2.5 font-bold">
                        <span className={profile.fattyLiverGrade === 'none' ? 'text-emerald-600' : 'text-amber-600'}>
                          {profile.fattyLiverGrade === 'none' ? 'سالم' : 'نیازمند رژیم کبد چرب'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LONGITUDINAL TRENDS & MEASUREMENT HISTORY */}
          {activeTab === 'trends' && (
            <div className="space-y-4">
              
              {/* Trend Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>روند شاخص توده بدنی (BMI)</span>
                    <Scale className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-xl font-black font-mono text-slate-900 dark:text-white">
                      {profile.bmi || '-'}
                    </strong>
                    <span className="text-[11px] font-bold text-rose-600">
                      {profile.bmi >= 30 ? 'در محدوده چاقی' : profile.bmi >= 25 ? 'اضافه‌وزن' : 'نرمال'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {exams.length > 1
                      ? `دارای ${exams.length} دوره سنجش ثبت‌شده در سوابق معاینات ادواری`
                      : 'ثبت اولین دوره پایش بالینی و تن‌سنجی'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>روند فشار خون</span>
                    <Heart className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-xl font-black font-mono text-slate-900 dark:text-white">
                      {profile.systolicBp && profile.diastolicBp ? `${profile.systolicBp}/${profile.diastolicBp}` : '-'}
                    </strong>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      mmHg
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {profile.bloodPressureStage === 'normal'
                      ? 'محدوده بهینه و کنترل‌شده'
                      : profile.bloodPressureStage === 'prehypertension'
                      ? 'پیش‌فشار خون (نیازمند اصلاح الگوی غذایی)'
                      : 'پرفشاری خون غیرطبیعی (نیازمند پایش مداوم)'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>قند خون و متابولیسم</span>
                    <Droplet className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-xl font-black font-mono text-slate-900 dark:text-white">
                      {profile.fbs ? `${profile.fbs}` : (profile.hba1c ? `${profile.hba1c}%` : '-')}
                    </strong>
                    <span className="text-[11px] text-slate-500 font-sans">
                      {profile.fbs ? 'mg/dL (FBS)' : (profile.hba1c ? '(HbA1c)' : '')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {profile.bloodSugarStage === 'diabetes'
                      ? 'دیابت بالینی ثبت‌شده'
                      : profile.bloodSugarStage === 'prediabetes'
                      ? 'پیش‌دیابت و اختلال تحمل گلوکز'
                      : 'قند خون ناشتا در محدوده هدف'}
                  </p>
                </div>
              </div>

              {/* Comparative Longitudinal Table */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>جدول مقایسه‌ای روند تغییرات در طول دوره‌های معاینات ادواری</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold">
                    تعداد دوره‌ها: {exams.length}
                  </span>
                </div>

                {exams.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-xs">
                    تنها نتایج دوره جاری ثبت شده است. با ثبت دوره‌های بعدی معاینات ادواری، روند مقایسه‌ای به‌صورت خودکار ترسیم می‌گردد.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold">
                          <th className="p-2.5">دوره / تاریخ</th>
                          <th className="p-2.5">وزن و قد</th>
                          <th className="p-2.5">BMI</th>
                          <th className="p-2.5">فشار خون</th>
                          <th className="p-2.5">قند و آزمایش‌ها</th>
                          <th className="p-2.5">نظریه طب کار</th>
                          <th className="p-2.5 text-center">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {exams.map((ex, idx) => {
                          const bmiVal = ex.findings?.bmi || 0;
                          return (
                            <tr key={ex.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                              <td className="p-2.5 font-bold font-mono">
                                {ex.examYear ? `سال ${ex.examYear}` : ex.examDate || `دوره ${idx + 1}`}
                                {idx === 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 mr-1.5 font-sans">
                                    آخرین
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-mono">
                                {ex.findings?.weightKg ? `${ex.findings.weightKg} kg` : '-'} / {ex.findings?.heightCm ? `${ex.findings.heightCm} cm` : '-'}
                              </td>
                              <td className="p-2.5 font-mono font-bold">
                                <span className={bmiVal >= 30 ? 'text-rose-600' : bmiVal >= 25 ? 'text-orange-600' : 'text-slate-700 dark:text-slate-200'}>
                                  {bmiVal || '-'}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono">
                                {ex.findings?.bloodPressure || '-'}
                              </td>
                              <td className="p-2.5 text-[11px] max-w-[200px] truncate" title={ex.findings?.bloodTests || ''}>
                                {ex.findings?.bloodTests || '-'}
                              </td>
                              <td className="p-2.5 text-[11px] max-w-[200px] truncate" title={ex.findings?.generalConclusion || ''}>
                                {ex.findings?.generalConclusion || '-'}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {ex.status === 'fit' ? 'تأیید' : ex.status === 'needs_specialist' ? 'ارجاع' : ex.status === 'unfit' ? 'عدم تأیید' : 'پایش'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Clinical Evaluation Advisory Notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>تذکر پزشکی:</strong> روندهای ثبت‌شده صرفاً جهت پایش پاسخ به مداخله تغذیه‌ای و اصلاح سبک زندگی است. هرگونه ارزیابی تشخیصی قطعی منوط به ویزیت حضوری پزشک متخصص می‌باشد.
                </span>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            شناسه یکتای پرونده: <span className="font-mono">{profile.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPrint && (
              <button
                type="button"
                onClick={() => onOpenPrint(profile)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span>چاپ برنامه</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

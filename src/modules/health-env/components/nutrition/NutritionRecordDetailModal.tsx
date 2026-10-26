import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Edit, 
  Apple, 
  Scale, 
  Activity, 
  Calendar, 
  User, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  History,
  Salad,
  Flame,
  Droplet
} from 'lucide-react';
import { NutritionRecord } from '../../types/nutritionTypes';
import { nutritionService } from '../../services/nutritionService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record: NutritionRecord | null;
  onEdit: (record: NutritionRecord) => void;
  onOpenPrint: (record: NutritionRecord) => void;
}

export default function NutritionRecordDetailModal({
  isOpen,
  onClose,
  record,
  onEdit,
  onOpenPrint
}: Props) {
  const [history, setHistory] = useState<NutritionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (record?.personnelCode) {
      setLoadingHistory(true);
      nutritionService.getPersonnelHistory(record.personnelCode)
        .then(res => setHistory(res))
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false));
    }
  }, [record?.personnelCode]);

  const getBmiLabel = (category: string) => {
    switch (category) {
      case 'underweight': return 'کم‌وزن';
      case 'normal': return 'نرمال و متناسب';
      case 'overweight': return 'اضافه وزن';
      case 'obese_1': return 'چاقی درجه ۱';
      case 'obese_2': return 'چاقی درجه ۲';
      case 'obese_3': return 'چاقی مفرط درجه ۳';
      default: return 'نامشخص';
    }
  };

  const getGoalLabel = (goal: string) => {
    switch (goal) {
      case 'weight_loss': return 'کاهش وزن و چربی‌سوزی';
      case 'weight_gain': return 'افزایش وزن و حجم عضلانی';
      case 'weight_maintenance': return 'تثبیت وزن و تعادل تغذیه‌ای';
      case 'fatty_liver_reversal': return 'بهبود و پاکسازی کبد چرب';
      case 'diabetes_control': return 'کنترل دیابت و حساسیت انسولینی';
      case 'hypertension_dash': return 'رژیم کاهش فشار خون (DASH)';
      case 'shift_work_optimization': return 'تنظیم تغذیه متناسب با نوبت‌کاری و شیفت';
      default: return 'ارتقای سلامت عمومی';
    }
  };

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Apple className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-800 dark:text-white">
                  پرونده سلامت تغذیه: {record.fullName}
                </h2>
                <span className="font-mono text-xs text-slate-500">
                  ({record.recordNumber})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                کد پرسنلی: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{record.personnelCode}</span> · واحد: <span className="font-bold text-slate-700 dark:text-slate-300">{record.unit || 'نامشخص'}</span> · تاریخ مشاوره: <span className="font-mono text-slate-700 dark:text-slate-300">{record.visitDate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPrint(record)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="چاپ برگه برنامه رژیم"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition cursor-pointer"
              title="ویرایش پرونده"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
          
          {/* Key Anthropometric Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-bold">قد</span>
              <span className="text-base font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {record.height} <span className="text-xs font-sans text-slate-400">cm</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-bold">وزن فعلی</span>
              <span className="text-base font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {record.weight} <span className="text-xs font-sans text-slate-400">kg</span>
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-bold">شاخص BMI</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-black font-mono text-emerald-800 dark:text-emerald-300">
                  {record.bmi}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                  ({getBmiLabel(record.bmiCategory)})
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-bold">دور کمر / باسن (WHR)</span>
              <span className="text-base font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {record.whr || '---'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-bold">کبد چرب</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 block">
                {record.fattyLiverGrade === 'none' ? 'سالم / بدون کبد چرب' : `گرید ${record.fattyLiverGrade.replace('grade_', '')}`}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-bold">وضعیت پیگیری</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 block">
                {record.followUpStatus === 'achieved' ? 'تحقق هدف رژیم' : record.followUpStatus === 'in_progress' ? 'در حال اجرا' : 'در انتظار پیگیری'}
              </span>
            </div>
          </div>

          {/* Care Plan & Goals */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <Salad className="w-4 h-4 text-emerald-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-xs">
                  برنامه تغذیه‌ای: {getGoalLabel(record.dietGoal)}
                </h3>
              </div>
              <div className="text-slate-500 text-[11px] flex items-center gap-3">
                {record.targetWeight && <span>وزن هدف: <strong className="font-mono text-slate-800 dark:text-slate-200">{record.targetWeight} kg</strong></span>}
                {record.dailyCalorieTarget && <span>کالری هدف: <strong className="font-mono text-slate-800 dark:text-slate-200">{record.dailyCalorieTarget} kcal</strong></span>}
              </div>
            </div>

            {record.dietPlanSummary && (
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                {record.dietPlanSummary}
              </p>
            )}

            {record.recommendations && record.recommendations.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 block">توصیه‌های کاربردی:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {record.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {record.supplements && (
              <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <strong>مکمل‌های پیشنهادی:</strong> {record.supplements}
              </div>
            )}
          </div>

          {/* Lifestyle & Dietary Habits Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>عادات غذایی و رفتارهای تغذیه‌ای</span>
              </h4>
              <div className="space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                <div>مصرف آب روزانه: <strong>{record.waterIntakeLiters ? `${record.waterIntakeLiters} لیتر` : 'ثبت نشده'}</strong></div>
                <div>سهم میوه و سبزیجات: <strong>{record.fruitVeggieServings ? `${record.fruitVeggieServings} واحد` : 'ثبت نشده'}</strong></div>
                <div>بسامد فست‌فود: <strong>{record.fastFoodFrequency === 'never' ? 'اصلاً' : record.fastFoodFrequency === 'rarely' ? 'به‌ندرت' : record.fastFoodFrequency === 'weekly_1_2' ? '۱-۲ بار در هفته' : 'زیاد'}</strong></div>
                <div>مصرف نمک: <strong>{record.saltIntake === 'low' ? 'کم' : record.saltIntake === 'high' ? 'زیاد' : 'متوسط'}</strong></div>
                <div>الگوی زمان‌بندی وعده‌ها: <strong>{record.mealTimingPattern === 'regular_3_meals' ? '۳ وعده منظم' : record.mealTimingPattern === 'skips_breakfast' ? 'حذف صبحانه' : 'نامنظم/شیفتی'}</strong></div>
                <div>فعالیت بدنی هفتگی: <strong>{record.physicalActivityLevel === 'sedentary' ? 'بی‌تحرک' : record.physicalActivityLevel === 'moderate' ? 'متوسط و منظم' : record.physicalActivityLevel === 'heavy' ? 'سنگین' : 'سبک'}</strong></div>
              </div>
              {record.dietaryHabitNotes && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
                  {record.dietaryHabitNotes}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-purple-600" />
                <span>شاخص‌های آزمایشگاهی و بیماری‌های زمینه‌ای</span>
              </h4>
              <div className="space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                <div>قند خون ناشتا (FBS): <strong className="font-mono">{record.fbs ? `${record.fbs} mg/dL` : 'ثبت نشده'}</strong></div>
                <div>کلسترول تام: <strong className="font-mono">{record.cholesterol ? `${record.cholesterol} mg/dL` : 'ثبت نشده'}</strong></div>
                <div>تری‌گلیسرید: <strong className="font-mono">{record.triglycerides ? `${record.triglycerides} mg/dL` : 'ثبت نشده'}</strong></div>
                <div>اسید اوریک: <strong className="font-mono">{record.uricAcid ? `${record.uricAcid} mg/dL` : 'ثبت نشده'}</strong></div>
                <div>فشار خون: <strong className="font-mono">{record.systolicBp && record.diastolicBp ? `${record.systolicBp}/${record.diastolicBp} mmHg` : 'ثبت نشده'}</strong></div>
              </div>
              {record.underlyingConditions && record.underlyingConditions.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 block font-bold mb-1">بیماری‌های زمینه‌ای:</span>
                  <div className="flex flex-wrap gap-1">
                    {record.underlyingConditions.map((cond, i) => (
                      <span key={i} className="text-[10px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg">
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Consultation Notes */}
          {record.consultationNotes && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">شرح جلسه مشاوره و دستورات کارشناس:</span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                {record.consultationNotes}
              </p>
            </div>
          )}

          {/* Personnel Consultation History Timeline */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-800 dark:text-white text-xs flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              <span>تاریخچه مراجعات و ارزیابی‌های تغذیه‌ای این فرد ({history.length} نوبت)</span>
            </h4>

            {loadingHistory ? (
              <div className="text-center py-4 text-slate-400 text-xs">در حال بارگذاری سوابق...</div>
            ) : history.length <= 1 ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-slate-500 text-center text-xs">
                این اولین جلسه مشاوره ثبت‌شده برای این پرسنل است.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="p-2.5">تاریخ</th>
                      <th className="p-2.5">وزن</th>
                      <th className="p-2.5">BMI</th>
                      <th className="p-2.5">هدف رژیم</th>
                      <th className="p-2.5">وضعیت پیگیری</th>
                      <th className="p-2.5">کارشناس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {history.map(h => (
                      <tr key={h.id} className={h.id === record.id ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-bold' : ''}>
                        <td className="p-2.5 font-mono">{h.visitDate}</td>
                        <td className="p-2.5 font-mono">{h.weight} kg</td>
                        <td className="p-2.5 font-mono text-emerald-600 dark:text-emerald-400">{h.bmi}</td>
                        <td className="p-2.5">{getGoalLabel(h.dietGoal)}</td>
                        <td className="p-2.5">{h.followUpStatus === 'achieved' ? 'تحقق هدف' : 'در حال اجرا'}</td>
                        <td className="p-2.5">{h.consultantName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Metadata */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div>ثبت‌شده توسط: <strong className="text-slate-600 dark:text-slate-300">{record.createdBy}</strong></div>
            <div>تاریخ ثبت سیستم: <span className="font-mono">{new Date(record.createdAt).toLocaleDateString('fa-IR')}</span></div>
          </div>

        </div>

      </div>
    </div>
  );
}

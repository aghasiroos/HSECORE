import React from 'react';
import { X, Printer, Apple, CheckCircle2 } from 'lucide-react';
import { NutritionRecord } from '../../types/nutritionTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record: NutritionRecord | null;
}

export default function NutritionCarePlanPrintModal({
  isOpen,
  onClose,
  record
}: Props) {
  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  const getGoalTitle = (goal: string) => {
    switch (goal) {
      case 'weight_loss': return 'کاهش وزن و چربی‌سوزی';
      case 'weight_gain': return 'افزایش وزن و حجم عضلانی';
      case 'weight_maintenance': return 'تثبیت وزن و تعادل تغذیه‌ای';
      case 'fatty_liver_reversal': return 'بهبود و پاکسازی کبد چرب';
      case 'diabetes_control': return 'کنترل دیابت و حساسیت به انسولین';
      case 'hypertension_dash': return 'رژیم کنترل فشار خون (DASH)';
      case 'shift_work_optimization': return 'تنظیم تغذیه متناسب با نوبت‌کاری و شیفت شب';
      default: return 'ارتقای سلامت عمومی و انرژی کار';
    }
  };

  const getBmiStatus = (bmi: number) => {
    if (bmi < 18.5) return 'کم‌وزن (Underweight)';
    if (bmi < 25) return 'نرمال و متناسب (Normal)';
    if (bmi < 30) return 'اضافه وزن (Overweight)';
    if (bmi < 35) return 'چاقی درجه ۱ (Obese I)';
    if (bmi < 40) return 'چاقی درجه ۲ (Obese II)';
    return 'چاقی مفرط درجه ۳ (Obese III)';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6" dir="rtl">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Apple className="w-4 h-4 text-emerald-600" />
            <span>برگه رسمی برنامه و توصیه‌های تغذیه‌ای پرسنل (آماده چاپ A4)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ رسمی برگه رژیم</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper View */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 print:p-0 print:overflow-visible">
          <div className="border border-slate-300 rounded-2xl p-8 space-y-6 max-w-3xl mx-auto bg-white text-slate-900">
            
            {/* Header */}
            <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-base font-black text-slate-950">
                  سامانه مدیریت بهداشت، ایمنی و محیط زیست (HSECORE)
                </h1>
                <p className="text-xs font-bold text-slate-600">
                  واحد بهداشت حرفه‌ای و طب کار — پرونده مشاوره و برنامه تغذیه
                </p>
              </div>

              <div className="text-left text-xs font-mono space-y-1">
                <div>شماره پرونده: <strong>{record.recordNumber}</strong></div>
                <div>تاریخ صدور: <strong>{record.visitDate}</strong></div>
              </div>
            </div>

            {/* Personnel Specifications Table */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2.5 gap-x-4">
                <div>نام و نام خانوادگی: <strong className="font-bold">{record.fullName}</strong></div>
                <div>کد پرسنلی: <strong className="font-mono font-bold">{record.personnelCode}</strong></div>
                <div>کد ملی: <strong className="font-mono">{record.nationalCode || '---'}</strong></div>
                <div>واحد سازمانی: <strong>{record.unit || '---'}</strong></div>
                <div>سمت سازمانی: <strong>{record.jobTitle || '---'}</strong></div>
                <div>شیفت کاری: <strong>{record.shift || 'عادی‌کار'}</strong></div>
                <div>کارشناس مشاور: <strong>{record.consultantName}</strong></div>
                <div>تاریخ پیگیری بعدی: <strong className="font-mono">{record.nextFollowUpDate || 'تعیین‌نشده'}</strong></div>
              </div>
            </div>

            {/* Anthropometric & Body Composition Grid */}
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-2 border-r-4 border-emerald-600 pr-2">
                ۱. نتایج تن‌سنجی و پایش شاخص‌های بیومارکر
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 block">قد</span>
                  <strong className="font-mono text-sm">{record.height} cm</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 block">وزن</span>
                  <strong className="font-mono text-sm">{record.weight} kg</strong>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-800 block">شاخص BMI</span>
                  <strong className="font-mono text-sm text-emerald-900">{record.bmi}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 block">دور کمر</span>
                  <strong className="font-mono text-sm">{record.waistCircumference || '---'} cm</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 block">نسبت WHR</span>
                  <strong className="font-mono text-sm">{record.whr || '---'}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 block">کبد چرب</span>
                  <strong className="text-xs">
                    {record.fattyLiverGrade === 'none' ? 'طبیعی' : `گرید ${record.fattyLiverGrade.replace('grade_', '')}`}
                  </strong>
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-600 flex items-center justify-between px-1">
                <span>وضعیت شاخص توده بدنی: <strong>{getBmiStatus(record.bmi)}</strong></span>
                {record.fbs && <span>قند خون ناشتا: <strong className="font-mono">{record.fbs} mg/dL</strong></span>}
                {record.triglycerides && <span>تری‌گلیسرید: <strong className="font-mono">{record.triglycerides} mg/dL</strong></span>}
              </div>
            </div>

            {/* Diet Goal & Targets */}
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-2 border-r-4 border-emerald-600 pr-2">
                ۲. هدف برنامه و اهداف محاسباتی
              </h3>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>هدف اصلی رژیم: <strong className="text-emerald-800 font-bold">{getGoalTitle(record.dietGoal)}</strong></div>
                  {record.targetWeight && <div>وزن هدف: <strong className="font-mono">{record.targetWeight} kg</strong></div>}
                  {record.dailyCalorieTarget && <div>کالری تخمینی روزانه: <strong className="font-mono">{record.dailyCalorieTarget} kcal</strong></div>}
                </div>
                {record.dietPlanSummary && (
                  <div className="pt-2 border-t border-slate-200 text-slate-700 leading-relaxed">
                    <strong>الگوی وعده‌ها:</strong> {record.dietPlanSummary}
                  </div>
                )}
              </div>
            </div>

            {/* Nutrition Recommendations List */}
            {record.recommendations && record.recommendations.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-slate-900 mb-2 border-r-4 border-emerald-600 pr-2">
                  ۳. دستورالعمل‌ها و توصیه‌های اختصاصی کارشناسی
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700 pr-1">
                  {record.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supplements */}
            {record.supplements && (
              <div className="text-xs bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-amber-950">
                <strong>مکمل‌های تجویزشده/توصیه‌شده:</strong> {record.supplements}
              </div>
            )}

            {/* Signatures & Verification */}
            <div className="pt-8 border-t border-slate-300 grid grid-cols-2 text-center text-xs">
              <div className="space-y-12">
                <span className="font-bold">امضاء پرسنل / مراجع:</span>
                <div className="text-slate-400 font-mono text-[10px]">{record.fullName}</div>
              </div>
              <div className="space-y-12">
                <span className="font-bold">مهر و امضاء کارشناس تغذیه و رژیم‌درمانی:</span>
                <div className="text-slate-700 font-bold text-xs">{record.consultantName}</div>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              این برگه به عنوان سند پایش سلامت شغلی در پرونده طب کار پرسنل در سامانه HSECORE ثبت و نگهداری می‌شود.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

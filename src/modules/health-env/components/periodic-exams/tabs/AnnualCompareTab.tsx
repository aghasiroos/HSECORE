import React from 'react';
import { TrendingUp, Calendar, Activity, Users, AlertTriangle } from 'lucide-react';
import { CustomizableChart } from '../CustomizableChart';

interface Props {
  joinedRecords: any[];
  toNum: (v: any) => number | null;
  avg: (nums: (number | null)[]) => number | null;
}

export const AnnualCompareTab: React.FC<Props> = ({ joinedRecords, toNum, avg }) => {
  const byYear: Record<string, any[]> = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    joinedRecords.forEach(r => {
      const y = r.exam_year || 'نامشخص';
      (map[y] = map[y] || []).push(r);
    });
    return map;
  }, [joinedRecords]);

  const years = React.useMemo(() => Object.keys(byYear).sort(), [byYear]);

  // Chart data: Average BMI by year with numbers on top
  const bmiTrendData = React.useMemo(() => {
    return years.map(y => {
      const list = byYear[y];
      const mean = avg(list.map(r => toNum(r.bmi))) || 0;
      return {
        label: `سال ${y}`,
        value: parseFloat(mean.toFixed(1)),
        subLabel: `${list.length} پرسنل`
      };
    });
  }, [years, byYear, avg, toNum]);

  // Chart data: Follow-up cases count by year with numbers on top
  const followupTrendData = React.useMemo(() => {
    return years.map(y => {
      const list = byYear[y];
      const count = list.filter(r => r.final_followup_needed === 'بله').length;
      return {
        label: `سال ${y}`,
        value: count,
        subLabel: `${((count / list.length) * 100).toFixed(0)}٪ از کل`
      };
    });
  }, [years, byYear]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2.5 mb-1">
          <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-black text-slate-800 dark:text-white">
            روند و مقایسه سنواتی شاخص‌های سلامت سازمان ({years.length} دوره)
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          تحلیل طولی وضعیت سلامت نیروی کار و ارزیابی اثربخشی مداخلات بهداشتی در دوره‌های {years.join('، ')}
        </p>
      </div>

      {/* 2 Customizable Charts with Numbers on Top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CustomizableChart
          title="روند میانگین BMI سازمان در گذر زمان"
          subtitle="بررسی نوسانات وزن و چاقی در سال‌های مختلف با اعداد بالای ستون‌ها"
          icon={<TrendingUp className="w-4 h-4" />}
          data={bmiTrendData}
          unit="kg/m²"
          defaultType="bar"
          defaultPalette="teal"
          height={260}
        />

        <CustomizableChart
          title="تعداد موارد نیازمند پیگیری درمانی برحسب سال"
          subtitle="آمار پرونده‌های ارجاعی و نیازمند پیگیری جهت پایش سلامت شغلی"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          data={followupTrendData}
          unit="نفر"
          defaultType="bar"
          defaultPalette="amber"
          height={260}
        />
      </div>

      {/* Year KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {years.map(y => {
          const list = byYear[y];
          const avgBmi = avg(list.map(r => toNum(r.bmi)))?.toFixed(1) || '—';
          const abnFbs = list.filter(r => (toNum(r.fbs) || 0) >= 100).length;
          const abnBp = list.filter(r => {
            const sys = toNum(r.bp_sys);
            return sys !== null && sys >= 140;
          }).length;
          const followups = list.filter(r => r.final_followup_needed === 'بله').length;

          return (
            <div
              key={y}
              className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-base font-black text-slate-800 dark:text-white">سال {y}</span>
                <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {list.length} معاینه
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/80">
                  <span className="text-slate-400">میانگین شاخص BMI:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">{avgBmi} kg/m²</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/80">
                  <span className="text-slate-400">قند خون بالا یا مرزی (FBS≥۱۰۰):</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">
                    {abnFbs} نفر ({((abnFbs / list.length) * 100).toFixed(0)}٪)
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/80">
                  <span className="text-slate-400">فشارخون سیستولیک بالا:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">
                    {abnBp} نفر ({((abnBp / list.length) * 100).toFixed(0)}٪)
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/80">
                  <span className="text-slate-400">نیازمند پیگیری درمانی:</span>
                  <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                    {followups} نفر ({((followups / list.length) * 100).toFixed(0)}٪)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnnualCompareTab;

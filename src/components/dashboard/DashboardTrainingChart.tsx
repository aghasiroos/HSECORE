import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { GraduationCap, Award, Users, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface DashboardTrainingChartProps {
  trainingData?: {
    totalCourses: number;
    totalAttendances: number;
    trainedPersonnel: number;
    totalHours: number;
    passRate: number;
    byCategory: {
      generalSafety: number;
      fireFighting: number;
      firstAid: number;
      ptwTraining: number;
      ergonomics: number;
    };
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

const COLORS = ['#3b82f6', '#f97316', '#10b981', '#f59e0b', '#8b5cf6'];

export const DashboardTrainingChart: React.FC<DashboardTrainingChartProps> = React.memo(({
  trainingData,
  isFa,
  onNavigate,
}) => {
  const [viewType, setViewType] = useState<'bar' | 'pie'>('bar');

  const rawCats = trainingData?.byCategory || {
    generalSafety: 0,
    fireFighting: 0,
    firstAid: 0,
    ptwTraining: 0,
    ergonomics: 0,
  };

  const chartData = [
    { name: isFa ? 'ایمنی عمومی' : 'General Safety', count: rawCats.generalSafety },
    { name: isFa ? 'اطفای حریق' : 'Fire Fighting', count: rawCats.fireFighting },
    { name: isFa ? 'کمک‌های اولیه' : 'First Aid', count: rawCats.firstAid },
    { name: isFa ? 'پروانه کار (PTW)' : 'PTW Training', count: rawCats.ptwTraining },
    { name: isFa ? 'ارگونومی و بهداشت' : 'Ergonomics', count: rawCats.ergonomics },
  ];

  const totalCourses = trainingData?.totalCourses || 0;
  const trainedPersonnel = trainingData?.trainedPersonnel || 0;
  const passRate = totalCourses > 0 || (trainingData?.totalAttendances || 0) > 0 ? (trainingData?.passRate ?? 0) : 0;
  const totalHours = trainingData?.totalHours || 0;

  return (
    <div 
      onClick={() => onNavigate && onNavigate('training')}
      className="hse-motion-card bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-blue-400 dark:hover:border-blue-600"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="hse-card-icon p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'مدیریت آموزش و توانمندسازی HSE' : 'HSE Training & Competency'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'پایش دوره‌های ایمنی، نفر-ساعت آموزش و قبولی آزمون‌ها' : 'Training courses, man-hours & certification'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full">
          {passRate}% {isFa ? 'قبولی آزمون' : 'Pass Rate'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/60 dark:border-blue-800/50">
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">{isFa ? 'دوره‌های فعال' : 'Courses'}</span>
          <strong className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">{totalCourses}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'پرسنل آموزش‌دیده' : 'Trained'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{trainedPersonnel}</strong>
        </div>
        <div className="p-2.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200/60 dark:border-purple-800/50">
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block">{isFa ? 'نفر-ساعت آموزش' : 'Hours'}</span>
          <strong className="text-lg font-black font-mono text-purple-600 dark:text-purple-400">{totalHours}</strong>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="hse-chart-reveal flex-1 min-h-[170px] w-full min-w-0">
        <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={170} debounce={50}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
            <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} allowDecimals={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--color-slate-900, #0f172a)', 
                color: '#fff', 
                borderRadius: '12px', 
                fontSize: '11px', 
                fontWeight: 'bold' 
              }} 
            />
            <Bar dataKey="count" name={isFa ? 'تعداد دوره‌ها' : 'Courses'} radius={[5, 5, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('training');
          }}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{isFa ? 'ورود به ماژول مدیریت آموزش' : 'Go to Training Module'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

DashboardTrainingChart.displayName = 'DashboardTrainingChart';

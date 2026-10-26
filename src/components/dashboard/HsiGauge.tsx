import React from 'react';
import { HeatRecord } from '../../types';
import { isWeatherRecordStale } from '../../utils/weatherPhysics';

interface HsiGaugeProps {
  heatRecord: HeatRecord | null;
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

export const HsiGauge: React.FC<HsiGaugeProps> = React.memo(({ heatRecord, isFa, onNavigate }) => {
  const currentHi = heatRecord ? heatRecord.hi : 25;
  const minHi = 20;
  const maxHi = 60; // Expanded to 60 to fit OSHA 54+ category
  const val = Math.min(maxHi, Math.max(minHi, currentHi));
  const percentage = ((val - minHi) / (maxHi - minHi)) * 100;
  const rotation = (percentage / 100) * 180 - 90; // -90 to +90 degrees

  let activeColor = '#10b981';
  let labelText = isFa ? 'Normal / عادی' : 'Normal';

  if (val < 27) {
    activeColor = '#10b981'; // Green (Safe)
    labelText = isFa ? 'Normal / عادی' : 'Normal';
  } else if (val < 32) {
    activeColor = '#eab308'; // Yellow (Caution)
    labelText = isFa ? '۱. احتیاط (Caution)' : 'I - Caution';
  } else if (val < 39) {
    activeColor = '#f97316'; // Orange (Extreme Caution)
    labelText = isFa ? '۲. احتیاط شدید (Extreme Caution)' : 'II - Extreme Caution';
  } else if (val < 50) {
    activeColor = '#ef4444'; // Red (Danger)
    labelText = isFa ? '۳. خطر ۱ (Hazard 1)' : 'III - Hazard 1';
  } else if (val < 54) {
    activeColor = '#991b1b'; // Dark Red (Extreme Danger)
    labelText = isFa ? '۴. خطر ۲ (Hazard 2)' : 'IV - Hazard 2';
  } else {
    activeColor = '#7f1d1d'; // Darker Red (Stop Work)
    labelText = isFa ? '۵. خطر شدید (Severe Hazard)' : 'V - Severe Hazard';
  }

  const fmtNum = (n: number | undefined, dec = 1) => {
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString(isFa ? 'fa-IR' : 'en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  };

  return (
    <div
      onClick={() => onNavigate && onNavigate('heat')}
      className={`flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden w-full h-full min-h-[320px] sm:min-h-[360px] mx-auto space-y-5 sm:space-y-6 ${onNavigate ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500' : ''}`}
      id="weather-style-hsi-card"
      title={isFa ? 'کلیک جهت انتقال به ماژول پایش استرس حرارتی' : 'Click to navigate to Heat Stress Monitor'}
    >
      {/* Title Block - Iranian Weather App Style */}
      <div className="text-center space-y-1 mt-1 w-full">
        <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider block leading-snug">
          {isFa ? 'سامانه هوشمند مانیتورینگ پارامترهای اقلیمی' : 'CLIMATE PARAMETERS MONITORING SYSTEM'}
        </span>
        <h4 className="text-sm sm:text-[16px] font-black text-slate-700 dark:text-slate-200">
          {isFa ? 'شاخص استرس گرمایی محیط کار' : 'Workplace Heat Stress Index (HSI)'}
        </h4>
      </div>

      {/* Gauge Component Area */}
      <div className="flex flex-col items-center justify-center space-y-3 w-full">
        {/* 5-Band OSHA Standard Gauge (Green, Yellow, Blue, Red, Dark Red) */}
        <div className="relative w-full max-w-[260px] sm:max-w-[300px] aspect-[240/130] flex items-end justify-center mt-2 mb-1 mx-auto">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 130">
            {/* Sector 1: Green (Safe) */}
            <path
              d="M 15 120 A 105 105 0 0 1 29.1 67.5"
              fill="none"
              stroke="#10b981"
              strokeWidth="22"
              strokeLinecap="round"
            />
            {/* Sector 2: Yellow (Caution) */}
            <path
              d="M 29.1 67.5 A 105 105 0 0 1 67.5 29.1"
              fill="none"
              stroke="#eab308"
              strokeWidth="22"
              strokeLinecap="butt"
            />
            {/* Sector 3: Orange (Extreme Caution) */}
            <path
              d="M 67.5 29.1 A 105 105 0 0 1 120 15"
              fill="none"
              stroke="#f97316"
              strokeWidth="22"
              strokeLinecap="butt"
            />
            {/* Sector 4: Red (Danger) */}
            <path
              d="M 120 15 A 105 105 0 0 1 172.5 29.1"
              fill="none"
              stroke="#ef4444"
              strokeWidth="22"
              strokeLinecap="butt"
            />
            {/* Sector 5: Dark Red (Extreme Danger) */}
            <path
              d="M 172.5 29.1 A 105 105 0 0 1 210.9 67.5"
              fill="none"
              stroke="#991b1b"
              strokeWidth="22"
              strokeLinecap="butt"
            />
            {/* Sector 6: Darker Red (Stop Work) */}
            <path
              d="M 210.9 67.5 A 105 105 0 0 1 225 120"
              fill="none"
              stroke="#7f1d1d"
              strokeWidth="22"
              strokeLinecap="round"
            />

            {/* Dynamic Needle - Thicker */}
            <g transform={`rotate(${rotation}, 120, 120)`} className="transition-transform duration-1000 ease-out">
              {/* Needle Base Circle */}
              <circle cx="120" cy="120" r="14" fill="currentColor" className="text-slate-800 dark:text-slate-100 " />
              {/* Needle Polygon */}
              <polygon points="113,120 120,10 127,120" fill="currentColor" className="text-slate-800 dark:text-slate-100 " />
              {/* Center Solid Cap */}
              <circle cx="120" cy="120" r="6" fill="#0B1120" />
            </g>
          </svg>
        </div>

        {/* Value display */}
        <div className="text-center space-y-1">
          <span className="text-4xl sm:text-[52px] font-black font-mono text-slate-900 dark:text-slate-100 tracking-tighter leading-none block select-none">
            {fmtNum(currentHi, 1)}°C
          </span>

          <span className="text-base sm:text-[18px] font-extrabold text-slate-900 dark:text-slate-200 tracking-tight block">
            {isFa ? 'استرس گرمایی' : 'Heat Stress Level'}
          </span>
        </div>
      </div>

      {/* Status Category Badge */}
      <div className="w-full text-center">
        <span
          className="px-3.5 py-1.5 text-xs font-black rounded-2xl border transition-all whitespace-normal leading-snug inline-block max-w-full"
          style={{
            backgroundColor: `${activeColor}15`,
            borderColor: `${activeColor}45`,
            color: activeColor
          }}
        >
          {labelText}
        </span>
      </div>

      {/* Small Additional Information at the Bottom */}
      <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-500">
        <div className="space-y-0.5">
          <span className="text-slate-400 block font-semibold">{isFa ? 'دما' : 'Temp'}</span>
          <strong className="text-slate-800 dark:text-slate-100 font-mono text-xs font-black">
            {heatRecord ? `${fmtNum(heatRecord.tempC)}°C` : '—'}
          </strong>
        </div>
        <div className="space-y-0.5 border-x border-slate-100 dark:border-slate-800">
          <span className="text-slate-400 block font-semibold">{isFa ? 'ایستگاه' : 'Station'}</span>
          <strong className="text-slate-800 dark:text-slate-100 text-[11px] font-black truncate max-w-[80px] block mx-auto">
            {heatRecord ? heatRecord.loc : '—'}
          </strong>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-400 block font-semibold">{isFa ? 'رطوبت' : 'Humidity'}</span>
          <strong className="text-slate-800 dark:text-slate-100 font-mono text-xs font-black">
            {heatRecord ? `${heatRecord.hum}%` : '—'}
          </strong>
        </div>
      </div>
      {(() => {
        const isStale = isWeatherRecordStale(heatRecord?.ts, 35);
        if (!heatRecord || isStale) {
          return (
            <div className="w-full mt-2 flex items-center justify-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40 py-1 px-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>{isFa ? `داده آرشیو (${heatRecord?.source || 'پایش ثبت‌شده'})` : `Archived Telemetry (${heatRecord?.source || 'Historical Log'})`}</span>
            </div>
          );
        }
        return (
          <div className="w-full mt-2 flex items-center justify-center gap-1.5 text-[10px] text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/40 py-1 px-2.5 rounded-lg border border-sky-100 dark:border-sky-900">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{isFa ? `ایستگاه زنده: ${heatRecord?.source || heatRecord?.provider || 'ایستگاه هواشناسی'}` : `Live Station: ${heatRecord?.source || heatRecord?.provider || 'Weather Station'}`}</span>
          </div>
        );
      })()}
    </div>
  );
});

HsiGauge.displayName = 'HsiGauge';

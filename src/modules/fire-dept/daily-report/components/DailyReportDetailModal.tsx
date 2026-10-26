import React from 'react';
import { 
  X, Printer, Edit, Copy, Trash2, CheckCircle2, 
  AlertTriangle, Clock, Calendar, ShieldCheck, Flame, 
  FileText, Truck, Gauge, Activity, Droplets
} from 'lucide-react';
import { FireDailyReport } from '../types/dailyReportTypes';

interface Props {
  report: FireDailyReport;
  onClose: () => void;
  onEdit: (report: FireDailyReport) => void;
  onPrint: (report: FireDailyReport) => void;
  onDuplicate: (report: FireDailyReport) => void;
  onDelete: (report: FireDailyReport) => void;
  isFa?: boolean;
}

export default function DailyReportDetailModal({
  report,
  onClose,
  onEdit,
  onPrint,
  onDuplicate,
  onDelete,
  isFa = true
}: Props) {
  const p = report;

  const getStatusBadge = (status: string) => {
    const isBad = status === 'دارای نقص' || status === 'خارج از مدار' || status === 'خارج از سرویس' || status === 'دارای نقص جزئی';
    const isWarn = status === 'در حال سرویس' || status === 'در حال تعمیر';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isBad ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
        isWarn ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
      }`}>
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir={isFa ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 rounded-xl text-white">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black">{p.stationName}</h2>
                {p.unitName && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    {isFa ? 'واحد:' : 'Unit:'} {p.unitName}
                  </span>
                )}
                {p.subUnitName && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {isFa ? 'زیرمجموعه:' : 'Sub-Unit:'} {p.subUnitName}
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                  p.status === 'FINALIZED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {p.status === 'FINALIZED' ? (isFa ? 'ثبت نهایی شده' : 'Finalized') : (isFa ? 'پیش‌نویس' : 'Draft')}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {isFa ? 'شناسه سند:' : 'Document No:'} {p.reportNumber} | {isFa ? 'تاریخ:' : 'Date:'} {p.reportDate} | {isFa ? 'نوبتکار:' : 'Shift:'} {p.shift === 'DAY' ? 'روزکار' : p.shift === 'NIGHT' ? 'شب‌کار' : 'چرخشی'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              title={isFa ? 'چاپ رسمی' : 'Print Form'}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{isFa ? 'چاپ رسمی' : 'Print'}</span>
            </button>

            <button
              onClick={() => onEdit(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              title={isFa ? 'ویرایش' : 'Edit'}
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">{isFa ? 'ویرایش' : 'Edit'}</span>
            </button>

            <button
              onClick={() => onDuplicate(p)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title={isFa ? 'کپی و ایجاد گزارش مشابه' : 'Duplicate'}
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(p)}
              className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
              title={isFa ? 'حذف' : 'Delete'}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Details */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-800 dark:text-slate-100">
          
          {/* Summary KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl text-center">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">{isFa ? 'مجوزهای گرم' : 'Hot Permits'}</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">{p.workPermitsIssued?.hotWork || 0}</span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-center">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'مجوزهای سرد' : 'Cold Permits'}</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">{p.workPermitsIssued?.coldWork || 0}</span>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-center">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'ساعات استندبای' : 'Standby Hours'}</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">{p.standbyAndEscort?.standbyHours || 0} h</span>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl text-center">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block">{isFa ? 'اسکورت تانکرها' : 'Tanker Escorts'}</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">{(p.standbyAndEscort?.propyleneTankerEscorts || 0) + (p.standbyAndEscort?.propaneTankerEscorts || 0)}</span>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-center">
              <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">{isFa ? 'حوادث روز' : 'Incidents'}</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">
                {(p.inspectionsAndIncidents?.humanIncidents?.minor || 0) + (p.inspectionsAndIncidents?.vehicleIncidents?.minor || 0) + (p.inspectionsAndIncidents?.fireIncidents?.minor || 0)}
              </span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl text-center">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">{isFa ? 'موارد نشت گاز' : 'Gas Leaks'}</span>
              <span className="text-base font-black font-mono text-slate-800 dark:text-white">{p.gasLeaks?.length || 0}</span>
            </div>
          </div>

          {/* Section 1: بازرسی و مجوزها */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                {isFa ? 'بازرسی‌ها و حوادث' : 'Inspections & Incidents'}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>تعداد بازرسی HSE: <span className="font-mono font-bold">{p.inspectionsAndIncidents?.hseInspectionsCount || 0}</span></div>
                <div>تعداد بازرسی آتش‌نشانی: <span className="font-mono font-bold">{p.inspectionsAndIncidents?.fireInspectionsCount || 0}</span></div>
                <div>حوادث انسانی: <span className="font-mono font-bold">جزئی: {p.inspectionsAndIncidents?.humanIncidents?.minor || 0} | قابل ثبت: {p.inspectionsAndIncidents?.humanIncidents?.recordable || 0}</span></div>
                <div>حوادث ماشینی: <span className="font-mono font-bold">جزئی: {p.inspectionsAndIncidents?.vehicleIncidents?.minor || 0}</span></div>
                <div>آتش‌سوزی: <span className="font-mono font-bold text-red-600">حاد: {p.inspectionsAndIncidents?.fireIncidents?.severe || 0}</span></div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  {isFa ? 'مجوز های پروانه کار (PTW)' : 'Work Permits (PTW)'}
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  اصلی: {(Number(p.workPermitsIssued?.hotWork) || 0) + (Number(p.workPermitsIssued?.coldWork) || 0)} | 
                  الحاقی: {(Number(p.workPermitsIssued?.attachedPermits?.excavation) || 0) + (Number(p.workPermitsIssued?.attachedPermits?.confinedSpace ?? p.workPermitsIssued?.confinedSpace) || 0) + (Number(p.workPermitsIssued?.attachedPermits?.vehicleCrane) || 0) + (Number(p.workPermitsIssued?.attachedPermits?.radiation) || 0) + (Number(p.workPermitsIssued?.attachedPermits?.electricalIsolation) || 0) + (Number(p.workPermitsIssued?.attachedPermits?.processIsolation) || 0)}
                </span>
              </h3>
              
              {/* Main & Attached Details */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 block mb-1">پروانه‌های اصلی:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>کار گرم: <span className="font-mono font-bold text-red-600">{p.workPermitsIssued?.hotWork || 0}</span></div>
                    <div>کار سرد: <span className="font-mono font-bold text-blue-600">{p.workPermitsIssued?.coldWork || 0}</span></div>
                  </div>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">پروانه‌های الحاقی:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px] bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>حفاری: <span className="font-mono font-bold">{p.workPermitsIssued?.attachedPermits?.excavation || 0}</span></div>
                    <div>ورود به فضا بسته: <span className="font-mono font-bold text-purple-600">{p.workPermitsIssued?.attachedPermits?.confinedSpace ?? p.workPermitsIssued?.confinedSpace ?? 0}</span></div>
                    <div>ورود خودرو / جرثقیل: <span className="font-mono font-bold">{p.workPermitsIssued?.attachedPermits?.vehicleCrane || 0}</span></div>
                    <div>منابع پرتوزا: <span className="font-mono font-bold">{p.workPermitsIssued?.attachedPermits?.radiation || 0}</span></div>
                    <div>جداسازی الکتریکی: <span className="font-mono font-bold">{p.workPermitsIssued?.attachedPermits?.electricalIsolation || 0}</span></div>
                    <div>جداسازی فرایندی/مکانیکی/ابزار دقیق: <span className="font-mono font-bold">{p.workPermitsIssued?.attachedPermits?.processIsolation || 0}</span></div>
                  </div>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 block mb-1">سنجه‌های نظارتی و کنترل آتش‌نشانی:</span>
                  <div className="grid grid-cols-3 gap-2 text-[11px] bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>Gas Testers: <span className="font-mono font-bold">{p.workPermitsIssued?.gasTesters || 0}</span></div>
                    <div>Standby: <span className="font-mono font-bold">{p.workPermitsIssued?.standby || 0}</span></div>
                    <div>باطل شده: <span className="font-mono font-bold text-rose-600">{p.workPermitsIssued?.revokedPermits || 0}</span></div>
                  </div>
                </div>

                {p.workPermitsIssued?.notes && (
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="font-bold">یادداشت نظارتی: </span>
                    {p.workPermitsIssued.notes}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: خودروها و ادوات اطفایی */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* وضعیت ناوگان */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <Truck className="w-4 h-4 text-red-600" />
                {isFa ? 'وضعیت ناوگان خودرویی' : 'Fleet Vehicles Status'}
              </h3>
              <div className="space-y-2 text-xs">
                {Object.entries(p.vehiclesStatus || {}).map(([key, val]: any) => {
                  const code = val?.vehicleCode || (key.startsWith('veh-') ? '' : key);
                  const name = val?.vehicleName || val?.name || key;
                  const plate = val?.plateNumber;
                  const status = typeof val === 'string' ? val : val?.status || 'آماده به کار (OK)';
                  const desc = typeof val === 'object' ? val?.description : '';

                  return (
                    <div key={key} className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {code && (
                            <span className="font-mono text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                              {code}
                            </span>
                          )}
                          <span className="font-bold text-slate-800 dark:text-slate-200">{name}</span>
                          {plate && <span className="text-[10px] text-slate-400 font-mono">({plate})</span>}
                        </div>
                        {getStatusBadge(status)}
                      </div>
                      {desc && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-750 pt-1">
                          {desc}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* شیرآلات و سیستم‌های آبی */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <Droplets className="w-4 h-4 text-blue-600" />
                {isFa ? 'اطفای آبی و دلویج ولوها' : 'Water Suppression & Deluge'}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span>FB-8001A</span>
                  {getStatusBadge(p.waterSuppressionAndValves?.delugeValves?.fb8001A || 'سالم')}
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span>FB-8001B</span>
                  {getStatusBadge(p.waterSuppressionAndValves?.delugeValves?.fb8001B || 'سالم')}
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span>FB-4501</span>
                  {getStatusBadge(p.waterSuppressionAndValves?.delugeValves?.fb4501 || 'سالم')}
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span>FB-4502</span>
                  {getStatusBadge(p.waterSuppressionAndValves?.delugeValves?.fb4502 || 'سالم')}
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span>Hydrants</span>
                  {getStatusBadge(p.waterSuppressionAndValves?.hydrants || 'سالم')}
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span>Monitors</span>
                  {getStatusBadge(p.waterSuppressionAndValves?.monitors || 'سالم')}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: نشت گازهای سمی */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {isFa ? 'نشت گازهای سمی و آلارم‌ها' : 'Toxic Gas Leaks & Alarms'}
            </h3>
            {p.gasLeaks && p.gasLeaks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-200/70 dark:bg-slate-750 font-bold">
                    <tr>
                      <th className="p-2">نوع گاز</th>
                      <th className="p-2">مقدار (ppm)</th>
                      <th className="p-2">جهت باد</th>
                      <th className="p-2">محل انتشار</th>
                      <th className="p-2">زمان شروع/پایان</th>
                      <th className="p-2">اقدامات انجام شده</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {p.gasLeaks.map(leak => (
                      <tr key={leak.id}>
                        <td className="p-2 font-bold">{leak.gasType}</td>
                        <td className="p-2 font-mono text-red-600 font-bold">{leak.amountPpm}</td>
                        <td className="p-2">{leak.windDirection}</td>
                        <td className="p-2">{leak.leakLocations}</td>
                        <td className="p-2 font-mono">{leak.startTime} - {leak.endTime}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">{leak.actionsTaken || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-xs">{isFa ? 'موردی از نشت گاز در این شیفت گزارش نشده است.' : 'No gas leaks reported.'}</p>
            )}
          </div>

          {/* Section 4: شرح کار انجام شده و نواقص */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white">{isFa ? 'شرح کار انجام شده:' : 'Work Completed:'}</h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {p.workCompletedDescription || '-'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white">{isFa ? 'نواقص و نیازمندی‌ها:' : 'Defects & Needs:'}</h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {p.defectsAndNeeds || '-'}
              </p>
            </div>
          </div>

          {/* Section: آیتم‌ها و سنجه‌های داینامیک */}
          {p.dynamicCustomItems && p.dynamicCustomItems.length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-3">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  {isFa ? 'پارامترها و سنجه‌های داینامیک اختصاصی ثبت‌شده' : 'Dynamic Custom Items'}
                </span>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                  {p.dynamicCustomItems.length} {isFa ? 'مورد' : 'items'}
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {p.dynamicCustomItems.map((item, idx) => (
                  <div key={item.id || idx} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.nameFa}</span>
                      <span className="text-[10px] text-slate-400">{item.categoryFa} {item.unit && `(${item.unit})`}</span>
                    </div>
                    <div>
                      {item.itemType === 'status' ? (
                        getStatusBadge(item.statusValue || 'سالم')
                      ) : item.itemType === 'number' ? (
                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                          {item.numericValue ?? 0} {item.unit || ''}
                        </span>
                      ) : item.itemType === 'boolean' ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.numericValue ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {item.numericValue ? 'فعال / OK' : 'غیرفعال'}
                        </span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{item.textValue || '-'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: امضاها و تاییدات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">{isFa ? 'نوبتکار روز:' : 'Day Shift:'}</span>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {p.signatures?.dayShiftOfficer?.name || '-'} {p.signatures?.dayShiftOfficer?.personnelCode && `(${p.signatures.dayShiftOfficer.personnelCode})`}
              </div>
              {p.signatures?.dayShiftOfficer?.signed && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isFa ? 'تأیید و امضا شده' : 'Signed'}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">{isFa ? 'نوبتکار شب:' : 'Night Shift:'}</span>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {p.signatures?.nightShiftOfficer?.name || '-'} {p.signatures?.nightShiftOfficer?.personnelCode && `(${p.signatures.nightShiftOfficer.personnelCode})`}
              </div>
              {p.signatures?.nightShiftOfficer?.signed && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isFa ? 'تأیید و امضا شده' : 'Signed'}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {isFa ? 'بستن پنجره' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}

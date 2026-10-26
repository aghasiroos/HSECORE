import React, { useState, useMemo } from 'react';
import { 
  BarChart3, FileSpreadsheet, Printer, Download, Filter, 
  Wind, Droplets, Trash2, ShieldAlert, Search, Calendar
} from 'lucide-react';
import { healthEnvService, extractShamsiYear } from '../services/healthEnvService';
import FormalReportHeader from '../../../components/common/FormalReportHeader';
import { printService } from '../../../services/printService';

interface Props {
  language: 'fa' | 'en';
}

export default function EnvironmentReports({ language }: Props) {
  const isFa = language === 'fa';
  const availableYears = useMemo(() => healthEnvService.getAvailableMonitoringYears(), []);
  const latestYear = useMemo(() => healthEnvService.getLatestMonitoringYear(), []);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedReportType, setSelectedReportType] = useState<'monitoring' | 'waste' | 'wastewater'>('monitoring');
  const [searchTerm, setSearchTerm] = useState('');

  const monitoringRecords = useMemo(() => {
    const records = healthEnvService.getAllEnvMonitoring();
    if (selectedYear === 'all') return records;
    return records.filter(m => extractShamsiYear(m.date) === selectedYear);
  }, [selectedYear]);

  const wasteRecords = useMemo(() => {
    const records = healthEnvService.getAllWasteRecords();
    if (selectedYear === 'all') return records;
    return records.filter(w => extractShamsiYear(w.productionDate) === selectedYear || extractShamsiYear(w.createdAt) === selectedYear);
  }, [selectedYear]);

  const wastewaterRecords = useMemo(() => {
    const records = healthEnvService.getAllWastewater();
    if (selectedYear === 'all') return records;
    return records.filter(ww => extractShamsiYear(ww.date) === selectedYear || extractShamsiYear(ww.createdAt) === selectedYear);
  }, [selectedYear]);



  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    
    if (selectedReportType === 'monitoring') {
      csvContent += 'نوع پایش,پارامتر,ایستگاه,مقدار,واحد,حد استاندارد,وضعیت انطباق,تاریخ\n';
      monitoringRecords.forEach(m => {
        csvContent += `"${m.monitoringType}","${m.parameter}","${m.stationOrLocation}","${m.measuredValue}","${m.unit}","${m.standardLimit}","${m.complianceStatus}","${m.date}"\n`;
      });
    } else if (selectedReportType === 'waste') {
      csvContent += 'کد,عنوان پسماند,دسته,مقدار,واحد,مانیفست EMP,پیمانکار,وضعیت\n';
      wasteRecords.forEach(w => {
        csvContent += `"${w.code}","${w.title}","${w.category}","${w.quantity}","${w.unit}","${w.manifestNo || ''}","${w.contractor}","${w.status}"\n`;
      });
    } else {
      csvContent += 'پارامتر,محل نمونه برداری,مقصد تخلیه,مقدار,حد مجاز,دبی روزانه,وضعیت\n';
      wastewaterRecords.forEach(ww => {
        csvContent += `"${ww.parameter}","${ww.samplingPoint}","${ww.dischargeDestination}","${ww.measuredValue}","${ww.standardLimit}","${ww.dailyFlowRateM3 || ''}","${ww.complianceStatus}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSE_Environment_Report_${selectedReportType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto print:p-0 print:m-0 print:max-w-none" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Official Standard Header for Print / PDF */}
      <div className="hidden print:block mb-4">
        <FormalReportHeader 
          isFa={isFa} 
          docTitle={isFa ? 'گزارش جامع پایش، پسماند و شاخص‌های محیط‌زیست' : 'Environmental Monitoring & Compliance Report'} 
          docCode="HSE-ENV-REP-01" 
          revision="01" 
          issueDate={new Date().toLocaleDateString('fa-IR')} 
        />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isFa ? 'گزارش‌های جامع و آماری محیط‌زیست' : 'Environmental Compliance & Analytical Reports'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa ? 'خروجی‌های آماری مانیتورینگ آنلاین، پسماندهای ویژه، پساب تصفیه‌خانه و عدم انطباق‌ها' : 'Statistical outputs, environmental audits and CSV exports.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isFa ? 'دریافت اکسل (CSV)' : 'Export CSV'}</span>
          </button>
          <button
            onClick={() => {
              const typeNames: Record<string, string> = {
                monitoring: 'پایش‌های محیطی و آلاینده‌ها',
                waste: 'مدیریت و پسماندهای صنعتی و عادی',
                wastewater: 'کیفیت پساب و خروجی تصفیه‌خانه'
              };
              printService.printElement('env-reports-print-container', {
                title: `گزارش رسمی محیط زیست - ${typeNames[selectedReportType] || 'گزارش محیط زیست'}`,
                orientation: 'landscape',
                pageSize: 'A4',
                documentCode: `HSE-ENV-REP-${selectedReportType.toUpperCase()}`,
                documentDate: new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
                isFa: isFa,
                autoPrint: true
              });
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ گزارش' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Selectors & Year Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-xs font-bold">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedReportType('monitoring')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              selectedReportType === 'monitoring' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            گزارش پایش‌های محیطی
          </button>
          <button
            onClick={() => setSelectedReportType('waste')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              selectedReportType === 'waste' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            گزارش جامع پسماند و EMP
          </button>
          <button
            onClick={() => setSelectedReportType('wastewater')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              selectedReportType === 'wastewater' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            گزارش کیفیت پساب و خروجی
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">{isFa ? 'سال پایش:' : 'Year:'}</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-emerald-500 outline-none cursor-pointer text-xs"
          >
            <option value="all">{isFa ? 'همه سال‌ها' : 'All Years'}</option>
            {availableYears.map(y => (
              <option key={y} value={y}>
                {isFa ? `سال ${y}` : `Year ${y}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div id="env-reports-print-container" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {selectedReportType === 'monitoring' && (
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-750 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3.5">نوع پایش</th>
                  <th className="p-3.5">پارامتر</th>
                  <th className="p-3.5">محل پایش</th>
                  <th className="p-3.5">مقدار</th>
                  <th className="p-3.5">حد استاندارد</th>
                  <th className="p-3.5">وضعیت</th>
                  <th className="p-3.5">تاریخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {monitoringRecords.map((m, idx) => (
                  <tr key={`${m.id || 'm'}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="p-3.5 font-bold">{m.monitoringType}</td>
                    <td className="p-3.5">{m.parameter}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{m.stationOrLocation}</td>
                    <td className="p-3.5 font-mono font-bold">{m.measuredValue} {m.unit}</td>
                    <td className="p-3.5 font-mono text-slate-500">{m.standardLimit} {m.unit}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.complianceStatus === 'compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.complianceStatus === 'compliant' ? 'منطبق' : 'عدم انطباق'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{m.date}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}

          {selectedReportType === 'waste' && (
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-750 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3.5">کد</th>
                  <th className="p-3.5">عنوان پسماند</th>
                  <th className="p-3.5">دسته‌بندی</th>
                  <th className="p-3.5">مقدار</th>
                  <th className="p-3.5">مانیفست EMP</th>
                  <th className="p-3.5">پیمانکار</th>
                  <th className="p-3.5">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {wasteRecords.map((w, idx) => (
                  <tr key={`${w.id || 'w'}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="p-3.5 font-mono text-amber-600">{w.code}</td>
                    <td className="p-3.5 font-bold">{w.title}</td>
                    <td className="p-3.5">{w.category}</td>
                    <td className="p-3.5 font-mono font-bold">{w.quantity} {w.unit}</td>
                    <td className="p-3.5 font-mono text-indigo-600">{w.manifestNo || '-'}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{w.contractor}</td>
                    <td className="p-3.5">{w.status}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}

          {selectedReportType === 'wastewater' && (
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-750 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3.5">پارامتر</th>
                  <th className="p-3.5">محل نمونه‌برداری</th>
                  <th className="p-3.5">مقصد تخلیه</th>
                  <th className="p-3.5">مقدار</th>
                  <th className="p-3.5">حد استاندارد</th>
                  <th className="p-3.5">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {wastewaterRecords.map((ww, idx) => (
                  <tr key={`${ww.id || 'ww'}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="p-3.5 font-bold">{ww.parameter}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{ww.samplingPoint}</td>
                    <td className="p-3.5 text-slate-500">{ww.dischargeDestination}</td>
                    <td className="p-3.5 font-mono font-bold">{ww.measuredValue} {ww.unit}</td>
                    <td className="p-3.5 font-mono text-slate-500">{ww.standardLimit} {ww.unit}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ww.complianceStatus === 'compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {ww.complianceStatus === 'compliant' ? 'مجاز' : 'غیرمجاز'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}

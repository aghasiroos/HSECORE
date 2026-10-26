import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplets, Activity, Plus, Search, Filter, CheckCircle2, 
  AlertTriangle, Trash2, Edit3, Eye, Download, RefreshCw, X, Waves
} from 'lucide-react';
import { WastewaterRecord, ComplianceStatus } from '../types';
import { healthEnvService } from '../services/healthEnvService';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

const DISCHARGE_DESTINATIONS = [
  'تخلیه به آب‌های سطحی / دریا (خلیج فارس)',
  'مصارف کشاورزی و آبیاری فضای سبز مجتمع',
  'تخلیه به چاه جاذب صنعتی',
  'بازچرخانی در فرآیند برج‌های خنک‌کننده (Cooling Towers)'
];

const STANDARD_LIMITS: Record<string, Record<string, number>> = {
  'تخلیه به آب‌های سطحی / دریا (خلیج فارس)': {
    'BOD5': 30,
    'COD': 60,
    'TSS': 40,
    'Oil & Grease': 10,
    'Phosphate': 6,
    'pH': 8.5
  },
  'مصارف کشاورزی و آبیاری فضای سبز مجتمع': {
    'BOD5': 100,
    'COD': 200,
    'TSS': 100,
    'Oil & Grease': 10,
    'Phosphate': 6,
    'pH': 8.5
  },
  'تخلیه به چاه جاذب صنعتی': {
    'BOD5': 30,
    'COD': 60,
    'TSS': 40,
    'Oil & Grease': 10,
    'Phosphate': 6,
    'pH': 8.5
  }
};

export default function WastewaterManagementView({ language, currentUser }: Props) {
  const isFa = language === 'fa';
  const [records, setRecords] = useState<WastewaterRecord[]>(() => healthEnvService.getAllWastewater());

  useEffect(() => {
    const handler = () => {
      // Using window event to trigger re-renders dynamically
      const ev = new Event('force_update');
      window.dispatchEvent(ev);
    };
    window.addEventListener('hse_health_env_updated', handler);
    return () => window.removeEventListener('hse_health_env_updated', handler);
  }, []);

  useEffect(() => {
    const handleForce = () => {
      if (typeof reloadData === 'function') reloadData();
      else window.location.reload();
    };
    window.addEventListener('force_update', handleForce);
    return () => window.removeEventListener('force_update', handleForce);
  }, []);

  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WastewaterRecord | null>(null);
  const [formData, setFormData] = useState<Partial<WastewaterRecord>>({
    samplingPoint: 'خروجی نهایی تصفیه‌خانه (Final Outfall)',
    date: '1404/04/01',
    dischargeDestination: 'تخلیه به آب‌های سطحی / دریا (خلیج فارس)',
    parameter: 'COD',
    measuredValue: 48,
    unit: 'mg/L',
    standardLimit: 60,
    complianceStatus: 'compliant',
    dailyFlowRateM3: 450,
    inspector: currentUser?.fullName || 'کارشناس بهره‌برداری ETP',
    notes: ''
  });

  const reloadData = () => {
    setRecords(healthEnvService.getAllWastewater());
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchDest = selectedDestination === 'all' || rec.dischargeDestination === selectedDestination;
      const matchStatus = selectedStatus === 'all' || rec.complianceStatus === selectedStatus;
      const matchSearch = !searchTerm ||
        rec.parameter.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.samplingPoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.dischargeDestination.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDest && matchStatus && matchSearch;
    });
  }, [records, selectedDestination, selectedStatus, searchTerm]);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      samplingPoint: 'خروجی نهایی تصفیه‌خانه (Final Outfall)',
      date: '1404/04/01',
      dischargeDestination: 'تخلیه به آب‌های سطحی / دریا (خلیج فارس)',
      parameter: 'COD',
      measuredValue: 45,
      unit: 'mg/L',
      standardLimit: 60,
      complianceStatus: 'compliant',
      dailyFlowRateM3: 500,
      inspector: currentUser?.fullName || 'کارشناس بهره‌برداری ETP',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: WastewaterRecord) => {
    setEditingRecord(rec);
    setFormData({ ...rec });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.parameter || !formData.samplingPoint) {
      alert('لطفاً پارامتر و محل نمونه‌برداری را مشخص نمایید.');
      return;
    }

    healthEnvService.saveWastewater({
      ...formData,
      id: editingRecord?.id
    }, currentUser?.fullName || 'admin');

    setIsModalOpen(false);
    reloadData();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('آیا از حذف این رکورد پساب اطمینان دارید؟')) {
      healthEnvService.deleteWastewater(id, currentUser?.fullName || 'admin');
      reloadData();
    }
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isFa ? 'مدیریت و کنترل کیفی پساب صنعتی (ETP Outfall)' : 'Wastewater Treatment & Outfall Quality'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa ? 'پایش خروجی تصفیه‌خانه، دبی روزانه و انطباق با حدود استاندارد تخلیه به محیط زیست' : 'Effluent treatment plant monitoring, flow rates and discharge thresholds.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت اندازه‌گیری پساب جدید' : 'New Outfall Log'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-[0px] w-full md:min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isFa ? 'جستجو در پارامتر، نقطه نمونه‌برداری یا مقصد تخلیه...' : 'Search parameter, point, destination...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="w-60">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
          >
            <option value="all">{isFa ? 'تمامی مقاصد تخلیه' : 'All Destinations'}</option>
            {DISCHARGE_DESTINATIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
          >
            <option value="all">{isFa ? 'وضعیت انطباق' : 'All Compliance'}</option>
            <option value="compliant">{isFa ? 'مطابق با استاندارد' : 'Compliant'}</option>
            <option value="non_compliant">{isFa ? 'فراتر از حد مجاز' : 'Non-Compliant'}</option>
          </select>
        </div>

        <button 
          onClick={reloadData}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-xl"
          title="بازخوانی"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-750 font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3.5">پارامتر کیفی پساب</th>
                <th className="p-3.5">محل نمونه‌برداری</th>
                <th className="p-3.5">مقصد تخلیه پساب</th>
                <th className="p-3.5">مقدار اندازه‌گیری</th>
                <th className="p-3.5">حد استاندارد</th>
                <th className="p-3.5">دبی روزانه (m³/d)</th>
                <th className="p-3.5">وضعیت انطباق</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    هیچ رکوردی برای پایش پساب یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Waves className="w-4 h-4 text-blue-500" />
                        <span>{rec.parameter}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">تاریخ: {rec.date}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      {rec.samplingPoint}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 text-[11px]">
                      {rec.dischargeDestination}
                    </td>
                    <td className="p-3.5 font-mono">
                      <strong className={`text-sm ${rec.complianceStatus === 'compliant' ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                        {rec.measuredValue}
                      </strong>{' '}
                      <span className="text-[10px] text-slate-400 font-sans">{rec.unit}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">
                      حداکثر {rec.standardLimit} {rec.unit}
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                      {rec.dailyFlowRateM3 ? `${rec.dailyFlowRateM3} m³/d` : '-'}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        rec.complianceStatus === 'compliant'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>
                        {rec.complianceStatus === 'compliant' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {rec.complianceStatus === 'compliant' ? 'مجاز' : 'غیرمجاز'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="ویرایش"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-750">
              <h3 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-600" />
                {editingRecord ? 'ویرایش پارامتر پساب' : 'ثبت داده آزمایشگاهی پساب جدید'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">پارامتر کیفی</label>
                  <select
                    value={formData.parameter}
                    onChange={(e) => setFormData({ ...formData, parameter: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="COD">اکسیژن‌خواهی شیمیایی (COD)</option>
                    <option value="BOD5">اکسیژن‌خواهی بیوشیمیایی (BOD5)</option>
                    <option value="TSS">مواد جامد معلق کل (TSS)</option>
                    <option value="Oil & Grease">چربی و روغن (Oil & Grease)</option>
                    <option value="pH">پ‌هاش (pH)</option>
                    <option value="Phosphate">فسفات (Phosphate)</option>
                    <option value="Total Nitrogen">نیتروژن کل (TN)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">مقصد تخلیه پساب</label>
                  <select
                    value={formData.dischargeDestination}
                    onChange={(e) => setFormData({ ...formData, dischargeDestination: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    {DISCHARGE_DESTINATIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">محل نمونه‌برداری</label>
                  <input
                    type="text"
                    value={formData.samplingPoint}
                    onChange={(e) => setFormData({ ...formData, samplingPoint: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="خروجی کلاریفایر، حوضچه ته نشینی..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">تاریخ نمونه‌برداری</label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    placeholder="1404/04/01"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">مقدار اندازه‌گیری‌شده</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.measuredValue}
                    onChange={(e) => setFormData({ ...formData, measuredValue: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">حد استاندارد تخلیه</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.standardLimit}
                    onChange={(e) => setFormData({ ...formData, standardLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">دبی روزانه خروجی (m³/day)</label>
                  <input
                    type="number"
                    value={formData.dailyFlowRateM3 || ''}
                    onChange={(e) => setFormData({ ...formData, dailyFlowRateM3: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    placeholder="500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">کارشناس آزمایشگاه</label>
                  <input
                    type="text"
                    value={formData.inspector}
                    onChange={(e) => setFormData({ ...formData, inspector: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                >
                  ذخیره نتایج پساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

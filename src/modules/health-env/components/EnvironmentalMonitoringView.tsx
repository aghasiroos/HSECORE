import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wind, Droplets, Volume2, Factory, Gauge, Plus, Search, 
  Filter, CheckCircle2, AlertTriangle, Trash2, Edit3, Eye, 
  Download, FileText, RefreshCw, X, Paperclip, Calendar
} from 'lucide-react';
import { EnvMonitoringRecord, EnvMonitoringType, ComplianceStatus } from '../types';
import { healthEnvService } from '../services/healthEnvService';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

const PRESET_PARAMETERS: Record<EnvMonitoringType, Array<{ name: string; unit: string; limit: number; limitType: 'max' | 'min' }>> = {
  stacks: [
    { name: 'اکسیدهای نیتروژن (NOx)', unit: 'mg/Nm³', limit: 350, limitType: 'max' },
    { name: 'دی‌اکسید گوگرد دودکش (SO2)', unit: 'mg/Nm³', limit: 800, limitType: 'max' },
    { name: 'مونوکسید کربن دودکش (CO)', unit: 'mg/Nm³', limit: 150, limitType: 'max' },
    { name: 'کدورت گازهای خروجی (Opacity)', unit: '٪', limit: 20, limitType: 'max' }
  ],
  wastewater: [
    { name: 'اکسیژن‌خواهی شیمیایی (COD)', unit: 'mg/L', limit: 100, limitType: 'max' },
    { name: 'اکسیژن‌خواهی بیوشیمیایی (BOD5)', unit: 'mg/L', limit: 30, limitType: 'max' },
    { name: 'مواد جامد معلق کل (TSS)', unit: 'mg/L', limit: 40, limitType: 'max' },
    { name: 'روغن و گریس (Oil & Grease)', unit: 'mg/L', limit: 10, limitType: 'max' },
    { name: 'فسفات کل (Phosphate)', unit: 'mg/L', limit: 6, limitType: 'max' },
    { name: 'پ‌هاش (pH)', unit: 'واحد pH', limit: 8.5, limitType: 'max' }
  ],
  water: [
    { name: 'هدایت الکتریکی (EC)', unit: 'µS/cm', limit: 2500, limitType: 'max' },
    { name: 'کل جامدات محلول (TDS)', unit: 'mg/L', limit: 1500, limitType: 'max' },
    { name: 'کدورت (Turbidity)', unit: 'NTU', limit: 5, limitType: 'max' },
    { name: 'کلیفرم کل (Total Coliform)', unit: 'MPN/100ml', limit: 0, limitType: 'max' }
  ],
  soil: [
    { name: 'هیدروکربن‌های نفتی کل (TPH)', unit: 'mg/kg', limit: 500, limitType: 'max' },
    { name: 'سرب در خاک (Pb)', unit: 'mg/kg', limit: 100, limitType: 'max' },
    { name: 'کادمیوم در خاک (Cd)', unit: 'mg/kg', limit: 3, limitType: 'max' }
  ],
  noise: [
    { name: 'تراز معادل صوت روزانه (Leq Day)', unit: 'dBA', limit: 65, limitType: 'max' },
    { name: 'تراز معادل صوت شبانه (Leq Night)', unit: 'dBA', limit: 55, limitType: 'max' },
    { name: 'تراز صوت صنعتی محوطه کاری', unit: 'dBA', limit: 85, limitType: 'max' }
  ],
  air: []
};

export default function EnvironmentalMonitoringView({ language, currentUser }: Props) {
  const isFa = language === 'fa';
  const [monitoringRecords, setMonitoringRecords] = useState<EnvMonitoringRecord[]>(() => healthEnvService.getAllEnvMonitoring());

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

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCompliance, setSelectedCompliance] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EnvMonitoringRecord | null>(null);
  const [formData, setFormData] = useState<Partial<EnvMonitoringRecord>>({
    monitoringType: 'stacks',
    stationOrLocation: '',
    site: '',
    department: '',
    date: '1404/04/01',
    parameter: 'اکسیدهای نیتروژن (NOx)',
    measuredValue: 250,
    unit: 'mg/Nm³',
    standardLimit: 350,
    limitType: 'max',
    complianceStatus: 'compliant',
    laboratory: 'آزمایشگاه معتمد محیط زیست',
    inspector: currentUser?.fullName || 'کارشناس محیط زیست',
    description: ''
  });

  const reloadData = () => {
    setMonitoringRecords(healthEnvService.getAllEnvMonitoring());
  };

  const filteredRecords = useMemo(() => {
    return monitoringRecords.filter((rec) => {
      const matchType = selectedType === 'all' || rec.monitoringType === selectedType;
      const matchComp = selectedCompliance === 'all' || rec.complianceStatus === selectedCompliance;
      const matchSearch = !searchTerm ||
        rec.parameter.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.stationOrLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.laboratory.toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchComp && matchSearch;
    });
  }, [monitoringRecords, selectedType, selectedCompliance, searchTerm]);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    const defaultType: EnvMonitoringType = 'stacks';
    const preset = PRESET_PARAMETERS[defaultType][0];
    setFormData({
      monitoringType: defaultType,
      stationOrLocation: '',
      site: '',
      department: '',
      date: '1404/04/01',
      parameter: preset.name,
      measuredValue: 15,
      unit: preset.unit,
      standardLimit: preset.limit,
      limitType: preset.limitType,
      complianceStatus: 'compliant',
      laboratory: 'آزمایشگاه معتمد محیط زیست',
      inspector: currentUser?.fullName || 'کارشناس محیط زیست',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: EnvMonitoringRecord) => {
    setEditingRecord(rec);
    setFormData({ ...rec });
    setIsModalOpen(true);
  };

  const handleTypeChangeInForm = (type: EnvMonitoringType) => {
    const preset = PRESET_PARAMETERS[type]?.[0] || { name: 'پارامتر', unit: 'ppm', limit: 10, limitType: 'max' };
    setFormData(prev => ({
      ...prev,
      monitoringType: type,
      parameter: preset.name,
      unit: preset.unit,
      standardLimit: preset.limit,
      limitType: preset.limitType as 'max' | 'min'
    }));
  };

  const handleParameterPresetSelect = (paramName: string) => {
    const type = formData.monitoringType || 'stacks';
    const preset = PRESET_PARAMETERS[type]?.find(p => p.name === paramName);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        parameter: preset.name,
        unit: preset.unit,
        standardLimit: preset.limit,
        limitType: preset.limitType as 'max' | 'min'
      }));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.stationOrLocation || !formData.parameter) {
      alert('لطفاً ایستگاه/محل پایش و پارامتر را مشخص کنید.');
      return;
    }

    healthEnvService.saveEnvMonitoring({
      ...formData,
      id: editingRecord?.id
    }, currentUser?.fullName || 'admin');

    setIsModalOpen(false);
    reloadData();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('آیا از حذف این رکورد پایش محیط زیست اطمینان دارید؟')) {
      healthEnvService.deleteEnvMonitoring(id, currentUser?.fullName || 'admin');
      reloadData();
    }
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isFa ? 'پایش و اندازه‌گیری‌های محیط‌زیستی' : 'Environmental Monitoring & Telemetry'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa ? 'ثبت نتایج آزمایشگاهی، مقایسه خودکار با حدود مجاز استاندارد ملی و پایش مستمر خروجی‌ها' : 'Field measurements, standard limit thresholds, and automatic compliance checking.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت اندازه‌گیری / پایش جدید' : 'New Measurement'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-[0px] w-full md:min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isFa ? 'جستجو در پارامتر، ایستگاه یا آزمایشگاه...' : 'Search parameter, location, lab...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        <div className="w-44">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
          >
            <option value="all">{isFa ? 'تمامی انواع پایش' : 'All Types'}</option>
            <option value="stacks">{isFa ? 'دودکش‌ها (CEMS)' : 'Stacks'}</option>
            <option value="wastewater">{isFa ? 'پساب صنعتی (ETP)' : 'Wastewater'}</option>
            <option value="water">{isFa ? 'آب صنعتی و شرب' : 'Water'}</option>
            <option value="soil">{isFa ? 'خاک و آب‌های زیرزمینی' : 'Soil'}</option>
            <option value="noise">{isFa ? 'صدا و نویز محیطی' : 'Noise'}</option>
          </select>
        </div>

        <div className="w-40">
          <select
            value={selectedCompliance}
            onChange={(e) => setSelectedCompliance(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
          >
            <option value="all">{isFa ? 'وضعیت انطباق' : 'All Compliance'}</option>
            <option value="compliant">{isFa ? 'مطابق با استاندارد' : 'Compliant'}</option>
            <option value="non_compliant">{isFa ? 'فراتر از حد مجاز (عدم انطباق)' : 'Non-Compliant'}</option>
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

      {/* Monitoring Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-750 font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3.5">نوع پایش</th>
                <th className="p-3.5">پارامتر اندازه‌گیری‌شده</th>
                <th className="p-3.5">ایستگاه / محل نمونه‌برداری</th>
                <th className="p-3.5">مقدار اندازه‌گیری</th>
                <th className="p-3.5">حد استاندارد</th>
                <th className="p-3.5">وضعیت انطباق</th>
                <th className="p-3.5">تاریخ / آزمایشگاه</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    هیچ رکورد اندازه‌گیری محیط زیستی با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors">
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                        {rec.monitoringType === 'air' && 'هوای محیطی'}
                        {rec.monitoringType === 'stacks' && 'دودکش CEMS'}
                        {rec.monitoringType === 'wastewater' && 'پساب ETP'}
                        {rec.monitoringType === 'water' && 'آب'}
                        {rec.monitoringType === 'soil' && 'خاک'}
                        {rec.monitoringType === 'noise' && 'صدا'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{rec.parameter}</div>
                      {rec.description && <div className="text-[10px] text-slate-400 truncate max-w-xs">{rec.description}</div>}
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      {rec.stationOrLocation}
                    </td>
                    <td className="p-3.5 font-mono">
                      <strong className={`text-sm ${
                        rec.complianceStatus === 'compliant' ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                      }`}>
                        {rec.measuredValue}
                      </strong>{' '}
                      <span className="text-[10px] text-slate-400 font-sans">{rec.unit}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">
                      {rec.limitType === 'max' ? 'حداکثر ' : 'حداقل '} {rec.standardLimit} {rec.unit}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        rec.complianceStatus === 'compliant'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>
                        {rec.complianceStatus === 'compliant' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {rec.complianceStatus === 'compliant' ? 'مطابق با استاندارد' : 'عدم انطباق'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-slate-600 dark:text-slate-300">{rec.date}</div>
                      <div className="text-[10px] text-slate-400">{rec.laboratory}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-750">
              <h3 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Gauge className="w-5 h-5 text-emerald-600" />
                {editingRecord ? 'ویرایش رکورد پایش محیط زیست' : 'ثبت داده پایش و اندازه‌گیری جدید'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">نوع پایش محیط زیستی</label>
                  <select
                    value={formData.monitoringType}
                    onChange={(e) => handleTypeChangeInForm(e.target.value as EnvMonitoringType)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="stacks">دودکش‌ها و انتشار گازهای خروجی (CEMS)</option>
                    <option value="wastewater">پساب صنعتی تصفیه‌خانه (ETP)</option>
                    <option value="water">منابع آب صنعتی و شرب</option>
                    <option value="soil">خاک و آب‌های زیرزمینی</option>
                    <option value="noise">صدا و نویز محیطی</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">پارامترهای استاندارد پیش‌فرض</label>
                  <select
                    onChange={(e) => handleParameterPresetSelect(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="">انتخاب سریع از پارامترهای استاندارد...</option>
                    {PRESET_PARAMETERS[formData.monitoringType || 'stacks']?.map(p => (
                      <option key={p.name} value={p.name}>{p.name} (حد: {p.limit} {p.unit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">نام پارامتر آلاینده</label>
                  <input
                    type="text"
                    value={formData.parameter}
                    onChange={(e) => setFormData({ ...formData, parameter: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="مانند: PM2.5, COD, NOx"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">ایستگاه / محل دقیق پایش</label>
                  <input
                    type="text"
                    value={formData.stationOrLocation}
                    onChange={(e) => setFormData({ ...formData, stationOrLocation: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="مانند: ایستگاه غربی سایت، خروجی کلاریفایر ۲"
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
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">واحد سنجش</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="mg/L, ppm, µg/m³, dBA"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">حد استاندارد مصوب محیط‌زیست</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.standardLimit}
                    onChange={(e) => setFormData({ ...formData, standardLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
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
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">آزمایشگاه سنجش‌کننده</label>
                  <input
                    type="text"
                    value={formData.laboratory}
                    onChange={(e) => setFormData({ ...formData, laboratory: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">کارشناس / بازرس نمونه‌بردار</label>
                  <input
                    type="text"
                    value={formData.inspector}
                    onChange={(e) => setFormData({ ...formData, inspector: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">توضیحات و اقدامات پیشگیرانه</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  placeholder="توضیحات شرایط محیطی، وضعیت دستگاه یا فیلترها..."
                />
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all"
                >
                  ذخیره و ثبت پایش
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

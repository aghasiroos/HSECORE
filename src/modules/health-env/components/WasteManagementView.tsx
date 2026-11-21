import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, Recycle, Truck, ShieldAlert, Plus, Search, 
  Filter, CheckCircle2, Edit3, FileText, BarChart3, RefreshCw, X, Download
} from 'lucide-react';
import { WasteRecord, WasteCategory, WasteStatus } from '../types';
import { healthEnvService } from '../services/healthEnvService';
import { toast } from 'react-hot-toast';
import { showConfirmDialog } from '../../../components/common/ConfirmDialogModal';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

const WASTE_CATEGORIES: WasteCategory[] = [
  'پسماند خطرناک (Hazardous)',
  'پسماند صنعتی غیرخطرناک',
  'پسماند قابل بازیافت',
  'پسماند عادی و بهداشتی',
  'پسماند بیولوژیک / بهداری'
];

const WASTE_STATUSES: WasteStatus[] = [
  'تولید و دپو موقت',
  'در حال تفکیک و بسته‌بندی',
  'آماده بارگیری و حمل',
  'تحویل پیمانکار مجاز',
  'امحاء نهایی در لندفیل ویژه',
  'بازیافت کامل'
];

export default function WasteManagementView({ language, currentUser }: Props) {
  const isFa = language === 'fa';
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>(() => healthEnvService.getAllWasteRecords());

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
      reloadData();
    };
    window.addEventListener('force_update', handleForce);
    return () => window.removeEventListener('force_update', handleForce);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWaste, setEditingWaste] = useState<WasteRecord | null>(null);
  const [formData, setFormData] = useState<Partial<WasteRecord>>({
    code: 'HW-01',
    title: '',
    category: 'پسماند خطرناک (Hazardous)',
    quantity: 10,
    unit: 'تن (Ton)',
    productionDate: '1404/04/01',
    originLocation: '',
    department: '',
    storageMethod: 'انبار مسقف پسماند ویژه',
    disposalOrTransferMethod: 'امحاء توسط شرکت مجاز',
    contractor: 'شرکت مدیریت پسماند پاک‌زیست',
    manifestNo: 'EMP-1404-001',
    status: 'تولید و دپو موقت',
    isHazardous: true,
    hasManifestDoc: true,
    notes: ''
  });

  const reloadData = () => {
    setWasteRecords(healthEnvService.getAllWasteRecords());
  };

  const filteredRecords = useMemo(() => {
    return wasteRecords.filter((rec) => {
      const matchCategory = selectedCategory === 'all' || rec.category === selectedCategory;
      const matchStatus = selectedStatus === 'all' || rec.status === selectedStatus;
      const matchSearch = !searchTerm ||
        rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.manifestNo && rec.manifestNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        rec.contractor.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchStatus && matchSearch;
    });
  }, [wasteRecords, selectedCategory, selectedStatus, searchTerm]);

  // Calculations
  const stats = useMemo(() => {
    const totalQty = wasteRecords.reduce((acc, w) => acc + (w.quantity || 0), 0);
    const hazardousQty = wasteRecords.filter(w => w.isHazardous).reduce((acc, w) => acc + (w.quantity || 0), 0);
    const recycledQty = wasteRecords.filter(w => w.category === 'پسماند قابل بازیافت').reduce((acc, w) => acc + (w.quantity || 0), 0);
    const recoveryRate = totalQty > 0 ? Math.round((recycledQty / totalQty) * 100) : 0;
    return { totalQty, hazardousQty, recycledQty, recoveryRate };
  }, [wasteRecords]);

  const handleOpenAdd = () => {
    setEditingWaste(null);
    setFormData({
      code: `HW-0${wasteRecords.length + 1}`,
      title: '',
      category: 'پسماند خطرناک (Hazardous)',
      quantity: 5,
      unit: 'تن (Ton)',
      productionDate: '1404/04/01',
      originLocation: '',
      department: '',
      storageMethod: 'انبار مسقف پسماند ویژه با حوضچه مهار',
      disposalOrTransferMethod: 'ارسال به مرکز امحاء مجاز سازمان محیط زیست',
      contractor: 'شرکت تخصصی پسماند پاک‌زیست جنوب',
      manifestNo: `EMP-HW-1404-0${Math.floor(100 + Math.random() * 900)}`,
      status: 'تولید و دپو موقت',
      isHazardous: true,
      hasManifestDoc: true,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: WasteRecord) => {
    setEditingWaste(w);
    setFormData({ ...w });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.code) {
      toast.error('لطفاً عنوان و کد پسماند را وارد کنید.');
      return;
    }

    healthEnvService.saveWasteRecord({
      ...formData,
      id: editingWaste?.id,
      isHazardous: formData.category === 'پسماند خطرناک (Hazardous)'
    }, currentUser?.fullName || 'admin');

    setIsModalOpen(false);
    reloadData();
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirmDialog({
      title: 'حذف رکورد پسماند',
      message: 'آیا از حذف این رکورد پسماند اطمینان دارید؟',
      confirmLabel: 'حذف',
      cancelLabel: 'انصراف',
      tone: 'danger',
    });
    if (ok) {
      healthEnvService.deleteWasteRecord(id, currentUser?.fullName || 'admin');
      reloadData();
    }
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 text-white rounded-2xl shadow-sm">
            <Recycle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isFa ? 'مدیریت و رهگیری پسماندهای صنعتی و ویژه (EMP)' : 'Industrial & Hazardous Waste Management'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa ? 'رهگیری پسماندهای خطرناک، مانیفست‌های سازمان حفاظت محیط‌زیست، بازیافت و امحاء' : 'Hazardous waste manifests, storage, recycling and environmental compliance.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت محموله / پسماند جدید' : 'New Waste Batch'}</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block mb-1">مجموع کل پسماند</span>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
            {stats.totalQty.toFixed(1)} <span className="text-xs text-slate-400">تن</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">ثبت‌شده در سال جاری</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block mb-1">پسماندهای بازیافت‌شده</span>
          <div className="text-2xl font-black font-mono text-emerald-600">
            {stats.recycledQty.toFixed(1)} <span className="text-xs text-slate-400">تن</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-bold mt-1 block">نرخ بازیافت: {stats.recoveryRate}٪</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block mb-1">پسماندهای ویژه و خطرناک</span>
          <div className="text-2xl font-black font-mono text-rose-600">
            {stats.hazardousQty.toFixed(1)} <span className="text-xs text-slate-400">تن</span>
          </div>
          <span className="text-[11px] text-rose-600 font-bold mt-1 block">نیازمند امحاء تخصصی</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block mb-1">مانیفست‌های سامانه EMP</span>
          <div className="text-2xl font-black font-mono text-blue-600">
            {wasteRecords.filter(w => !!w.manifestNo).length} <span className="text-xs text-slate-400">فقره</span>
          </div>
          <span className="text-[11px] text-blue-600 font-bold mt-1 block">سامانه جامع محیط‌زیست</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-[0px] w-full md:min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isFa ? 'جستجو در عنوان، کد پسماند، مانیفست یا پیمانکار...' : 'Search title, code, manifest...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="w-52">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
          >
            <option value="all">{isFa ? 'تمامی دسته‌بندی‌های پسماند' : 'All Categories'}</option>
            {WASTE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="w-44">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
          >
            <option value="all">{isFa ? 'تمامی وضعیت‌ها' : 'All Statuses'}</option>
            {WASTE_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
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
                <th className="p-3.5">کد / عنوان پسماند</th>
                <th className="p-3.5">دسته‌بندی پسماند</th>
                <th className="p-3.5">مقدار</th>
                <th className="p-3.5">محل تولید / انبارش</th>
                <th className="p-3.5">مانیفست EMP</th>
                <th className="p-3.5">پیمانکار امحاء / بازیافت</th>
                <th className="p-3.5">وضعیت</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    هیچ محموله پسماندی با مشخصات انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="font-mono text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded text-[10px]">
                          {w.code}
                        </span>
                        <span>{w.title}</span>
                      </div>
                      {w.notes && <div className="text-[10px] text-slate-400 truncate max-w-xs">{w.notes}</div>}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        w.isHazardous 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' 
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {w.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono">
                      <strong className="text-slate-900 dark:text-white text-sm">{w.quantity}</strong>{' '}
                      <span className="text-[10px] text-slate-400 font-sans">{w.unit}</span>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      <div>{w.originLocation}</div>
                      <div className="text-[10px] text-slate-400">{w.department}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      {w.manifestNo || '-'}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {w.contractor}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {w.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(w)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="ویرایش"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
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
                <Trash2 className="w-5 h-5 text-amber-600" />
                {editingWaste ? 'ویرایش اطلاعات محموله پسماند' : 'ثبت محموله پسماند صنعتی / ویژه جدید'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">کد شناسایی پسماند</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    placeholder="HW-01"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان و شرح پسماند</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="لجن نفتی، ضایعات کاتالیست..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">دسته‌بندی طبق آیین‌نامه</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as WasteCategory })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    {WASTE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">وضعیت فرآیندی پسماند</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as WasteStatus })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    {WASTE_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">مقدار پسماند</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">واحد سنجش</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="تن (Ton)">تن (Ton)</option>
                    <option value="کیلوگرم (Kg)">کیلوگرم (Kg)</option>
                    <option value="بشکه (Drum)">بشکه (Drum)</option>
                    <option value="متر مکعب (m³)">متر مکعب (m³)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">شماره مانیفست سامانه EMP</label>
                  <input
                    type="text"
                    value={formData.manifestNo || ''}
                    onChange={(e) => setFormData({ ...formData, manifestNo: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    placeholder="EMP-HW-1404-001"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">شرکت / پیمانکار حمل و بازیافت</label>
                  <input
                    type="text"
                    value={formData.contractor}
                    onChange={(e) => setFormData({ ...formData, contractor: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">روش انبارش و نگهداری موقت</label>
                <input
                  type="text"
                  value={formData.storageMethod}
                  onChange={(e) => setFormData({ ...formData, storageMethod: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  placeholder="انبار مسقف پسماند ویژه در بشکه‌های ۲۲۰ لیتری..."
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all"
                >
                  ذخیره و ثبت مانیفست
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

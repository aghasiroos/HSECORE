import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Stethoscope,
  Activity,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Building,
  Ambulance,
  HeartPulse,
  Pill,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { ClinicVisit, ClinicFilterState, ClinicStatistics, ClinicTriageLevel } from '../../types/clinicTypes';
import { clinicService } from '../../services/clinicService';
import ClinicVisitModal from './ClinicVisitModal';
import ClinicVisitDetailModal from './ClinicVisitDetailModal';
import { downloadCsvFile } from '../../../../utils/fileHelpers';
import { toast } from 'react-hot-toast';
import { showConfirmDialog } from '../../../../components/common/ConfirmDialogModal';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

export default function ClinicSubmoduleView({ language, currentUser }: Props) {
  const isFa = language === 'fa';

  // State
  const [visits, setVisits] = useState<ClinicVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<ClinicVisit | null>(null);
  const [selectedVisitForDetail, setSelectedVisitForDetail] = useState<ClinicVisit | null>(null);

  // Filters State
  const [filters, setFilters] = useState<ClinicFilterState>({
    searchQuery: '',
    personnelCode: '',
    unit: '',
    visitType: '',
    triageLevel: '',
    outcome: '',
    isWorkRelated: 'all',
    dateFrom: '',
    dateTo: ''
  });

  // Calculate current Jalali date
  const todayJalali = useMemo(() => {
    try {
      const d = new Date();
      return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d).replace(/\//g, '/');
    } catch {
      return '1404/07/16';
    }
  }, []);

  const loadVisits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clinicService.getVisits();
      setVisits(data);
    } catch (err) {
      console.error('Failed to load clinic visits:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVisits();

    const handleUpdate = () => loadVisits();
    window.addEventListener('hse_clinic_visits_updated', handleUpdate);
    window.addEventListener('app_data_mutated', handleUpdate);

    return () => {
      window.removeEventListener('hse_clinic_visits_updated', handleUpdate);
      window.removeEventListener('app_data_mutated', handleUpdate);
    };
  }, [loadVisits]);

  // Real statistics without fake defaults
  const stats: ClinicStatistics = useMemo(() => {
    return clinicService.calculateStatistics(visits, todayJalali);
  }, [visits, todayJalali]);

  // Unique units from real visits
  const uniqueUnits = useMemo(() => {
    return Array.from(new Set(visits.map(v => v.unit).filter(Boolean))).sort();
  }, [visits]);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesName = (v.fullName || '').toLowerCase().includes(q);
        const matchesCode = (v.personnelCode || '').toLowerCase().includes(q);
        const matchesComplaint = (v.chiefComplaint || '').toLowerCase().includes(q);
        const matchesDiag = (v.primaryDiagnosis || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesComplaint && !matchesDiag) return false;
      }

      if (filters.personnelCode && !v.personnelCode.includes(filters.personnelCode.trim())) {
        return false;
      }

      if (filters.unit && v.unit !== filters.unit) {
        return false;
      }

      if (filters.visitType && v.visitType !== filters.visitType) {
        return false;
      }

      if (filters.triageLevel && String(v.triageLevel) !== String(filters.triageLevel)) {
        return false;
      }

      if (filters.outcome && v.outcome !== filters.outcome) {
        return false;
      }

      if (filters.isWorkRelated === 'yes' && !v.isWorkRelated) return false;
      if (filters.isWorkRelated === 'no' && v.isWorkRelated) return false;

      if (filters.dateFrom && v.visitDate < filters.dateFrom) return false;
      if (filters.dateTo && v.visitDate > filters.dateTo) return false;

      return true;
    });
  }, [visits, filters]);

  const handleSaveVisit = async (visitData: Partial<ClinicVisit>) => {
    await clinicService.saveVisit(visitData, currentUser);
    await loadVisits();
  };

  const handleDeleteVisit = async (id: string, name: string) => {
    const ok = await showConfirmDialog({
      title: 'حذف پرونده مراجعه بهداری',
      message: `آیا از حذف پرونده مراجعه بهداری پرسنل "${name}" اطمینان دارید؟`,
      confirmLabel: 'حذف',
      cancelLabel: 'انصراف',
      tone: 'danger',
    });
    if (ok) {
      try {
        await clinicService.deleteVisit(id);
        await loadVisits();
      } catch (err: any) {
        toast.error(err?.message || 'خطا در حذف پرونده از پایگاه داده');
      }
    }
  };

  const handleExportCsv = () => {
    if (filteredVisits.length === 0) return;
    const headers = ['شماره پرونده', 'تاریخ', 'ساعت', 'کد پرسنلی', 'نام و نام خانوادگی', 'واحد', 'سمت', 'سطح تریاژ', 'علت مراجعه', 'تشخیص', 'ماهیت', 'اقدامات', 'نتیجه', 'اعزام آمبولانس', 'کادر معالج'];
    const rows = filteredVisits.map(v => [
      v.visitNumber,
      v.visitDate,
      v.visitTime,
      v.personnelCode,
      v.fullName,
      v.unit || '',
      v.jobTitle || '',
      v.triageLevel,
      `"${(v.chiefComplaint || '').replace(/"/g, '""')}"`,
      `"${(v.primaryDiagnosis || '').replace(/"/g, '""')}"`,
      v.isWorkRelated ? 'شغلی' : 'غیر شغلی',
      `"${(v.actionsPerformed || []).join('، ')}"`,
      v.outcome,
      v.ambulanceDispatch?.dispatched ? 'بله' : 'خیر',
      v.attendingMedic
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCsvFile(`hse_clinic_visits_${todayJalali.replace(/\//g, '-')}.csv`, csvContent);
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir="rtl">
      
      {/* Top Banner & Actions */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 shrink-0">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>زیرماژول بهداری و مراجعات سرپایی</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت مراجعات روزانه، تریاژ، علائم حیاتی، اقدامات بالینی، داروها، استراحت پزشکی و اعزام به مراکز درمانی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCsv}
            disabled={filteredVisits.length === 0}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="خروجی اکسل و CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل</span>
          </button>
          <button
            onClick={loadVisits}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-2xl transition cursor-pointer"
            title="بازخوانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setEditingVisit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs rounded-2xl flex items-center gap-2 transition cursor-pointer shadow-lg shadow-teal-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت مراجعه جدید به بهداری</span>
          </button>
        </div>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">کل مراجعات ثبت‌شده</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">{stats.totalVisits}</span>
            <Activity className="w-4 h-4 text-teal-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">مراجعات امروز ({todayJalali})</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-teal-600">{stats.todayVisits}</span>
            <Calendar className="w-4 h-4 text-teal-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">حوادث شغلی / کارگاهی</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-rose-600">{stats.workRelatedCount}</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">اعزام با آمبولانس</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-red-600">{stats.ambulanceDispatchCount}</span>
            <Ambulance className="w-4 h-4 text-red-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">مجموع استراحت پزشکی</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-amber-600">{stats.totalMedicalRestDays} <span className="text-xs font-normal">روز</span></span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">بیماری‌های غیرشغلی</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-blue-600">{stats.nonWorkRelatedCount}</span>
            <HeartPulse className="w-4 h-4 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-teal-600" />
            <span>فیلتر و جستجوی پیشرفته مراجعات:</span>
          </h3>
          {(filters.searchQuery || filters.personnelCode || filters.unit || filters.visitType || filters.triageLevel || filters.outcome || filters.isWorkRelated !== 'all' || filters.dateFrom || filters.dateTo) && (
            <button
              onClick={() => setFilters({
                searchQuery: '',
                personnelCode: '',
                unit: '',
                visitType: '',
                triageLevel: '',
                outcome: '',
                isWorkRelated: 'all',
                dateFrom: '',
                dateTo: ''
              })}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
            >
              پاک‌سازی فیلترها
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">جستجوی آزاد</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
                placeholder="نام، کد پرسنلی، شکایت، تشخیص..."
                className="w-full pr-8 pl-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">کد پرسنلی</label>
            <input
              type="text"
              value={filters.personnelCode}
              onChange={e => setFilters({ ...filters, personnelCode: e.target.value })}
              placeholder="جستجو بر اساس کد..."
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">واحد سازمانی</label>
            <select
              value={filters.unit}
              onChange={e => setFilters({ ...filters, unit: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">همه واحدها</option>
              {uniqueUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">سطح تریاژ</label>
            <select
              value={filters.triageLevel}
              onChange={e => setFilters({ ...filters, triageLevel: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">همه سطوح</option>
              <option value="1">سطح ۱ - احیا (Resuscitation)</option>
              <option value="2">سطح ۲ - بسیار فوری (Emergent)</option>
              <option value="3">سطح ۳ - فوری (Urgent)</option>
              <option value="4">سطح ۴ - نیمه‌فوری (Semi-Urgent)</option>
              <option value="5">سطح ۵ - غیرفوری (Non-Urgent)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">ماهیت مراجعه</label>
            <select
              value={filters.isWorkRelated}
              onChange={e => setFilters({ ...filters, isWorkRelated: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="all">همه (شغلی و غیرشغلی)</option>
              <option value="yes">فقط حوادث شغلی</option>
              <option value="no">بیماری‌ها و حوادث غیرشغلی</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table of Visits */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
              دفتر ثبت مراجعات بهداری مجتمع
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              {filteredVisits.length} پرونده
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
            <span>در حال بارگذاری پرونده‌ها...</span>
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Stethoscope className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-bold">هیچ مراجعه‌ای با مشخصات انتخابی یافت نشد.</p>
            <p className="text-[11px] text-slate-400">برای ثبت اولین مراجعه، بر روی «ثبت مراجعه جدید به بهداری» کلیک کنید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black">
                  <th className="p-3 w-10 text-center">ردیف</th>
                  <th className="p-3">شماره و تاریخ</th>
                  <th className="p-3">کد و نام پرسنل</th>
                  <th className="p-3">واحد / سمت</th>
                  <th className="p-3 text-center">تریاژ</th>
                  <th className="p-3">شکایت و تشخیص اولیه</th>
                  <th className="p-3">تعیین تکلیف / خروج</th>
                  <th className="p-3">کادر معالج</th>
                  <th className="p-3 w-28 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVisits.map((v, idx) => {
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition">
                      <td className="p-3 text-center font-mono font-bold text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-400 block text-[11px]">{v.visitNumber}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{v.visitDate} {v.visitTime} ({v.shift})</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">{v.fullName}</span>
                        <span className="font-mono text-[10px] text-slate-400">کد: {v.personnelCode}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-slate-800 dark:text-slate-200 block">{v.unit || '-'}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">{v.jobTitle || '-'}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-block ${
                          v.triageLevel === 1 ? 'bg-red-600 text-white' :
                          v.triageLevel === 2 ? 'bg-orange-600 text-white' :
                          v.triageLevel === 3 ? 'bg-amber-500 text-white' :
                          v.triageLevel === 4 ? 'bg-emerald-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          سطح {v.triageLevel}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={v.primaryDiagnosis}>
                          {v.primaryDiagnosis || '-'}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate" title={v.chiefComplaint}>
                          {v.chiefComplaint}
                        </span>
                        {v.isWorkRelated && (
                          <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 block mt-0.5">
                            ● حادثه شغلی
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-slate-800 dark:text-slate-200 block font-bold text-[11px]">{v.outcome}</span>
                        {v.ambulanceDispatch?.dispatched && (
                          <span className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5">
                            <Ambulance className="w-3 h-3" />
                            اعزام با آمبولانس
                          </span>
                        )}
                        {v.medicalRestDays && v.medicalRestDays > 0 ? (
                          <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                            {v.medicalRestDays} روز استراحت
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                        <span>{v.attendingMedic}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedVisitForDetail(v)}
                            className="p-1.5 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-600 rounded-lg transition cursor-pointer"
                            title="مشاهده پرونده و چاپ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingVisit(v);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVisit(v.id, v.fullName)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 rounded-lg transition cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ClinicVisitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVisit(null);
        }}
        onSave={handleSaveVisit}
        initialData={editingVisit}
        currentUser={currentUser}
        todayJalali={todayJalali}
      />

      <ClinicVisitDetailModal
        visit={selectedVisitForDetail}
        onClose={() => setSelectedVisitForDetail(null)}
      />

    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, Printer, Edit, Trash2, Copy, 
  FileText, Calendar, Clock, CheckCircle2, AlertTriangle, 
  Flame, Truck, Eye, RefreshCw, Layers, ShieldCheck, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FireDailyReport, ShiftType, ReportStatus } from './types/dailyReportTypes';
import { fireDailyReportService } from './services/dailyReportService';
import DailyReportFormModal from './components/DailyReportFormModal';
import DailyReportPrintView from './components/DailyReportPrintView';
import DailyReportDetailModal from './components/DailyReportDetailModal';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';
import { useSubmoduleFullscreen, FullscreenToggleBtn } from '../../health-env/components/common/SubmoduleFullscreen';

interface Props {
  language: 'fa' | 'en';
}

export default function FireDailyReportView({ language }: Props) {
  const isFa = language === 'fa';
  const { isFullscreen, toggleFullscreen, containerClassName } = useSubmoduleFullscreen();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: isFullscreen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: false } }));
    };
  }, [isFullscreen]);

  const [reports, setReports] = useState<FireDailyReport[]>(() => fireDailyReportService.getAllReports());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FireDailyReport | null>(null);
  const [viewingReport, setViewingReport] = useState<FireDailyReport | null>(null);
  const [printingReport, setPrintingReport] = useState<FireDailyReport | null>(null);
  const [deleteConfirmReport, setDeleteConfirmReport] = useState<FireDailyReport | null>(null);

  // Sync with service updates
  useEffect(() => {
    const handleUpdate = () => {
      setReports(fireDailyReportService.getAllReports());
    };
    window.addEventListener('hse_fire_daily_reports_updated', handleUpdate);
    return () => window.removeEventListener('hse_fire_daily_reports_updated', handleUpdate);
  }, []);

  const stats = useMemo(() => fireDailyReportService.getStats(reports), [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // Shift filter
      if (selectedShift !== 'ALL' && r.shift !== selectedShift) return false;
      // Status filter
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inNumber = r.reportNumber.toLowerCase().includes(query);
        const inDate = r.reportDate.toLowerCase().includes(query);
        const inUnit = (r.unitName || '').toLowerCase().includes(query);
        const inSubUnit = (r.subUnitName || '').toLowerCase().includes(query);
        const inDesc = (r.workCompletedDescription || '').toLowerCase().includes(query);
        const inDefects = (r.defectsAndNeeds || '').toLowerCase().includes(query);
        const inDaySign = (r.signatures?.dayShiftOfficer?.name || '').toLowerCase().includes(query);
        const inNightSign = (r.signatures?.nightShiftOfficer?.name || '').toLowerCase().includes(query);
        if (!inNumber && !inDate && !inUnit && !inSubUnit && !inDesc && !inDefects && !inDaySign && !inNightSign) return false;
      }
      return true;
    });
  }, [reports, searchTerm, selectedShift, selectedStatus]);

  // Handlers
  const handleCreateNew = () => {
    setEditingReport(null);
    setIsFormOpen(true);
  };

  const handleEdit = (report: FireDailyReport) => {
    setViewingReport(null);
    setEditingReport(report);
    setIsFormOpen(true);
  };

  const handleSave = (savedReport: FireDailyReport) => {
    const saved = fireDailyReportService.saveReport(savedReport);
    setReports(fireDailyReportService.getAllReports());
    setIsFormOpen(false);
    setEditingReport(null);
    if (saved.status === 'FINALIZED') {
      toast.success(isFa ? `گزارش شماره ${saved.reportNumber} نهایی و ثبت شد.` : `Report ${saved.reportNumber} finalized.`);
    } else {
      toast.success(isFa ? `پیش‌نویس گزارش شماره ${saved.reportNumber} با موفقیت ذخیره شد.` : `Draft ${saved.reportNumber} saved.`);
    }
  };

  const handleRequestDelete = (report: FireDailyReport) => {
    setDeleteConfirmReport(report);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmReport) return;
    const id = deleteConfirmReport.id;
    const reportNum = deleteConfirmReport.reportNumber;
    fireDailyReportService.deleteReport(id);
    setReports(fireDailyReportService.getAllReports());
    if (viewingReport?.id === id) setViewingReport(null);
    setDeleteConfirmReport(null);
    toast.success(isFa ? `گزارش ${reportNum} با موفقیت حذف شد.` : `Report ${reportNum} deleted.`);
  };

  const handleDuplicate = (report: FireDailyReport) => {
    const dup = fireDailyReportService.duplicateReport(report.id);
    if (dup) {
      setReports(fireDailyReportService.getAllReports());
      setEditingReport(dup);
      setIsFormOpen(true);
      toast.success(isFa ? 'یک نسخه رونوشت از گزارش ایجاد شد.' : 'Report duplicated.');
    }
  };

  return (
    <div 
      className={`${containerClassName} p-4 sm:p-6 space-y-6 animate-fadeIn w-full max-w-[1920px] mx-auto`} 
      dir={isFa ? 'rtl' : 'ltr'}
    >
      
      {/* Top Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-sm shadow-red-600/30">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {isFa ? 'گزارش روزانه ایستگاه آتش‌نشانی معین' : 'Fire Department Daily Reports'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle Button matching other enterprise HSE tabs */}
          <FullscreenToggleBtn
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            activeColor="text-red-600"
            titleFullscreen={isFa ? 'نمایش تمام‌صفحه' : 'Fullscreen'}
            titleExit={isFa ? 'خروج از حالت تمام‌صفحه (Esc)' : 'Exit Fullscreen (Esc)'}
          />

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-red-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت گزارش روزانه جدید' : 'New Daily Report'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">{isFa ? 'کل گزارش‌ها' : 'Total Reports'}</div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-[10px] text-emerald-600 font-bold mt-1">{stats.finalized} {isFa ? 'ثبت نهایی' : 'Finalized'}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1">{isFa ? 'مجوز کار گرم' : 'Hot Permits'}</div>
          <div className="text-xl font-black font-mono text-blue-700 dark:text-blue-300">{stats.totalHotPermits}</div>
          <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'مورد پایش‌شده' : 'Monitored'}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'مجوز کار سرد' : 'Cold Permits'}</div>
          <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300">{stats.totalColdPermits}</div>
          <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'مورد صادره' : 'Issued'}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">{isFa ? 'ساعات استندبای' : 'Standby Hours'}</div>
          <div className="text-xl font-black font-mono text-amber-700 dark:text-amber-300">{stats.totalStandbyHours} <span className="text-xs">h</span></div>
          <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'حضور میدانی' : 'Field presence'}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mb-1">{isFa ? 'اسکورت تانکرها' : 'Tanker Escorts'}</div>
          <div className="text-xl font-black font-mono text-purple-700 dark:text-purple-300">{stats.totalEscorts}</div>
          <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'پروپیلن و پروپان' : 'Propylene & Propane'}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1">{isFa ? 'نشت گازهای سمی' : 'Gas Leaks'}</div>
          <div className="text-xl font-black font-mono text-rose-700 dark:text-rose-300">{stats.totalGasLeaks}</div>
          <div className="text-[10px] text-slate-500 mt-1">{stats.totalFireAlarms} {isFa ? 'آلارم حریق' : 'Fire Alarms'}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isFa ? 'جستجو در شماره گزارش، تاریخ، شرح کار، نواقص یا نام نوبتکار...' : 'Search by report number, date, text, officer...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Shift Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">{isFa ? 'شیفت:' : 'Shift:'}</span>
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            <option value="ALL">{isFa ? 'همه شیفت‌ها' : 'All Shifts'}</option>
            <option value="DAY">{isFa ? 'روزکار (DAY)' : 'Day Shift'}</option>
            <option value="NIGHT">{isFa ? 'شب‌کار (NIGHT)' : 'Night Shift'}</option>
            <option value="ROTATING">{isFa ? 'چرخشی' : 'Rotating'}</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">{isFa ? 'وضعیت:' : 'Status:'}</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            <option value="ALL">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
            <option value="FINALIZED">{isFa ? 'ثبت نهایی شده' : 'Finalized'}</option>
            <option value="DRAFT">{isFa ? 'پیش‌نویس' : 'Draft'}</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        {filteredReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-3.5">{isFa ? 'شماره سند / گزارش' : 'Report No'}</th>
                  <th className="p-3.5">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                  <th className="p-3.5">{isFa ? 'تاریخ' : 'Date'}</th>
                  <th className="p-3.5">{isFa ? 'شیفت' : 'Shift'}</th>
                  <th className="p-3.5">{isFa ? 'مجوزهای گرم / سرد' : 'Permits (Hot/Cold)'}</th>
                  <th className="p-3.5">{isFa ? 'استندبای / اسکورت' : 'Standby / Escorts'}</th>
                  <th className="p-3.5">{isFa ? 'نشت گاز / حوادث' : 'Leaks / Incidents'}</th>
                  <th className="p-3.5">{isFa ? 'نوبتکار روز / شب' : 'Shift Officers'}</th>
                  <th className="p-3.5">{isFa ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-750 text-slate-700 dark:text-slate-200">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      {report.reportNumber}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-col gap-0.5 items-start">
                        <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                          {report.unitName || (isFa ? 'نامشخص' : 'Unspecified')}
                        </span>
                        {report.subUnitName && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5">
                            {report.subUnitName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-semibold">
                      {report.reportDate}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {report.shift === 'DAY' ? (isFa ? 'روزکار' : 'Day') : report.shift === 'NIGHT' ? (isFa ? 'شب‌کار' : 'Night') : (isFa ? 'چرخشی' : 'Rotating')}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono">
                      <span className="text-red-600 font-bold">{report.workPermitsIssued?.hotWork || 0}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-blue-600 font-bold">{report.workPermitsIssued?.coldWork || 0}</span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      <span>{report.standbyAndEscort?.standbyHours || 0}h</span>
                      <span className="text-slate-400 mx-1">|</span>
                      <span>{(report.standbyAndEscort?.propyleneTankerEscorts || 0) + (report.standbyAndEscort?.propaneTankerEscorts || 0)} تانکر</span>
                    </td>
                    <td className="p-3.5">
                      {report.gasLeaks && report.gasLeaks.length > 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-full font-bold text-[10px]">
                          {report.gasLeaks.length} {isFa ? 'مورد نشت' : 'leaks'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">{isFa ? 'پاک / بدون نشت' : 'Clear'}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-[11px]">
                      <div>{report.signatures?.dayShiftOfficer?.name || '-'}</div>
                      <div className="text-[10px] text-slate-400">{report.signatures?.nightShiftOfficer?.name || '-'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        report.status === 'FINALIZED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {report.status === 'FINALIZED' ? (isFa ? 'ثبت نهایی' : 'Finalized') : (isFa ? 'پیش‌نویس' : 'Draft')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingReport(report)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                          title={isFa ? 'مشاهده کامل جزئیات' : 'View Details'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPrintingReport(report)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                          title={isFa ? 'چاپ رسمی فرم پتروشیمی رجال' : 'Official Print'}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(report)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                          title={isFa ? 'ویرایش' : 'Edit'}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(report)}
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition cursor-pointer"
                          title={isFa ? 'کپی و ثبت گزارش جدید بر اساس این داده' : 'Duplicate'}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(report)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title={isFa ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {isFa ? 'گزارشی با فیلترهای مشخص‌شده یافت نشد.' : 'No daily reports found with matching criteria.'}
            </p>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              {isFa ? '+ ثبت اولین گزارش روزانه' : '+ Create First Report'}
            </button>
          </div>
        )}
      </div>

      {/* MODALS */}
      {isFormOpen && (
        <DailyReportFormModal
          initialData={editingReport}
          onSave={handleSave}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingReport(null);
          }}
          isFa={isFa}
        />
      )}

      {viewingReport && (
        <DailyReportDetailModal
          report={viewingReport}
          onClose={() => setViewingReport(null)}
          onEdit={(r) => handleEdit(r)}
          onPrint={(r) => {
            setViewingReport(null);
            setPrintingReport(r);
          }}
          onDuplicate={(r) => handleDuplicate(r)}
          onDelete={(r) => handleRequestDelete(r)}
          isFa={isFa}
        />
      )}

      {printingReport && (
        <DailyReportPrintView
          report={printingReport}
          onClose={() => setPrintingReport(null)}
          isFa={isFa}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmReport}
        language={language}
        title={isFa ? 'تأیید حذف گزارش روزانه' : 'Confirm Daily Report Deletion'}
        itemType={isFa ? 'گزارش روزانه' : 'Daily Report'}
        itemName={deleteConfirmReport?.reportNumber}
        message={
          isFa
            ? `آیا از حذف کامل گزارش روزانه شماره «${deleteConfirmReport?.reportNumber || ''}» مربوط به تاریخ ${deleteConfirmReport?.reportDate || ''} و نوبتکاری ${deleteConfirmReport?.shift === 'DAY' ? 'روز' : 'شب'} اطمینان دارید؟ تمامی اطلاعات، چک‌لیست‌ها و سوابق این گزارش به طور قطعی حذف خواهند شد.`
            : `Are you sure you want to permanently delete daily report "${deleteConfirmReport?.reportNumber || ''}" dated ${deleteConfirmReport?.reportDate || ''}? All shift records and inspections will be removed.`
        }
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirmReport(null)}
      />

    </div>
  );
}

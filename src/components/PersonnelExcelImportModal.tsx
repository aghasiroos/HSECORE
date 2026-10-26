import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  UserPlus,
  UserCheck,
  AlertTriangle,
  FileCheck2,
  Search,
  ShieldAlert,
  Download
} from 'lucide-react';
import { Personnel } from './PersonnelManagement';
import { 
  parsePersonnelExcelFile, 
  commitPersonnelImportBatch, 
  PersonnelImportPreviewResult,
  downloadPersonnelExcelTemplate
} from '../services/personnelImportService';
import { VirtualizedDataTable, VirtualizedColumn } from './common/virtualized/VirtualizedDataTable';

interface PersonnelExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  personnelList: Personnel[];
  onSuccess: (updatedList: Personnel[]) => void;
  currentUser?: any;
  isFa: boolean;
}

export default function PersonnelExcelImportModal({
  isOpen,
  onClose,
  personnelList,
  onSuccess,
  currentUser,
  isFa
}: PersonnelExcelImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [previewResult, setPreviewResult] = useState<PersonnelImportPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'WARNING' | 'ERROR'>('ALL');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const isAdmin = currentUser?.role === 'Administrator' || !currentUser; // Admin authorization check

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAdmin) {
      setErrorMessage(
        isFa 
          ? 'دست‌یابی ناموفق: بارگذاری و بروزرسانی اطلاعات از فایل اکسل تنها برای مدیر اصلی سیستم (Administrator) مجاز است.' 
          : 'Access denied: Excel import is restricted to System Administrators.'
      );
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);
    setProcessingProgress(5);
    setProcessingMessage('بارگذاری و تحلیل فایل اکسل در Web Worker...');
    setErrorMessage(null);
    setPreviewResult(null);

    try {
      const res = await parsePersonnelExcelFile(file, personnelList, (prog, msg) => {
        setProcessingProgress(prog);
        if (msg) setProcessingMessage(msg);
      });
      setPreviewResult(res);
    } catch (err: any) {
      console.error('Error parsing personnel excel:', err);
      setErrorMessage(err?.message || 'خطا در تحلیل و خواندن ساختار فایل اکسل.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!previewResult) return;

    setIsCommitting(true);
    try {
      const { updatedList, createdCount, updatedCount } = await commitPersonnelImportBatch(
        previewResult.rows,
        personnelList,
        currentUser
      );
      onSuccess(updatedList);
      setShowConfirmModal(false);
      onClose();
    } catch (err: any) {
      alert('خطا در ثبت نهایی اطلاعات: ' + err?.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredRows = previewResult?.rows.filter(row => {
    // Status Filter
    if (statusFilter === 'CREATE' && row.action !== 'CREATE') return false;
    if (statusFilter === 'UPDATE' && row.action !== 'UPDATE') return false;
    if (statusFilter === 'WARNING' && row.action !== 'DUPLICATE_WARNING') return false;
    if (statusFilter === 'ERROR' && row.action !== 'ERROR') return false;

    // Search term filter
    if (!searchTerm.trim()) return true;
    const cleanQ = searchTerm.trim().toLowerCase();
    return (
      row.fullName.toLowerCase().includes(cleanQ) ||
      row.rawNationalCode.includes(cleanQ) ||
      row.rawPersonnelCode.toLowerCase().includes(cleanQ) ||
      row.unit.toLowerCase().includes(cleanQ) ||
      row.jobTitle.toLowerCase().includes(cleanQ)
    );
  }) || [];

  const tableColumns = useMemo<VirtualizedColumn<any>[]>(() => [
    {
      key: 'rowId',
      header: '#',
      width: 45,
      className: 'text-center font-mono font-bold text-slate-400',
      headerClassName: 'text-center w-12',
      render: (row) => row.rowId
    },
    {
      key: 'rawNationalCode',
      header: 'کد ملی',
      width: 100,
      className: 'font-mono font-bold text-slate-800 dark:text-slate-200',
      render: (row) => row.rawNationalCode || '—'
    },
    {
      key: 'rawPersonnelCode',
      header: 'کد پرسنلی',
      width: 90,
      className: 'font-mono font-bold text-slate-800 dark:text-slate-200',
      render: (row) => row.rawPersonnelCode || '—'
    },
    {
      key: 'fullName',
      header: 'نام و نام خانوادگی',
      width: 140,
      className: 'font-bold text-slate-900 dark:text-slate-100',
      render: (row) => row.fullName
    },
    {
      key: 'gender',
      header: 'جنسیت',
      width: 70,
      render: (row) => row.gender
    },
    {
      key: 'militaryStatus',
      header: 'نظام وظیفه',
      width: 100,
      render: (row) => row.militaryStatus
    },
    {
      key: 'unit',
      header: 'واحد / شغل',
      width: 150,
      render: (row) => `${row.unit || 'نامشخص'} ${row.jobTitle ? `(${row.jobTitle})` : ''}`
    },
    {
      key: 'action',
      header: 'وضعیت تطبیق',
      width: 130,
      headerClassName: 'text-center',
      className: 'text-center',
      render: (row) => (
        <>
          {row.action === 'CREATE' && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-300">
              ایجاد پرسنل جدید
            </span>
          )}
          {row.action === 'UPDATE' && (
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-blue-300">
              {row.matchMethod === 'NATIONAL_CODE' ? 'به‌روزرسانی (کد ملی)' : 'به‌روزرسانی (کد پرسنلی)'}
            </span>
          )}
          {row.action === 'DUPLICATE_WARNING' && (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-300">
              هشدار / تکراری
            </span>
          )}
          {row.action === 'ERROR' && (
            <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-rose-300">
              خطای سطر
            </span>
          )}
        </>
      )
    },
    {
      key: 'changes',
      header: 'تغییرات و به‌روزرسانی‌ها',
      width: 260,
      render: (row) => (
        row.changedFields && row.changedFields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.changedFields.map((cf: any, i: number) => (
              <span key={i} className="bg-blue-50 text-blue-800 text-[10px] font-medium px-2 py-0.5 rounded-md border border-blue-200">
                {cf.labelFa}: <span className="text-slate-400 line-through">{cf.oldValue}</span> ➔ <span className="font-bold text-blue-900">{cf.newValue}</span>
              </span>
            ))}
          </div>
        ) : row.action === 'UPDATE' ? (
          <span className="text-slate-400 text-[11px]">بدون تغییر جدید (اطلاعات کامل است)</span>
        ) : row.errors && row.errors.length > 0 ? (
          <span className="text-rose-600 text-[11px] font-bold">{row.errors.join(' | ')}</span>
        ) : (
          <span className="text-emerald-600 text-[11px]">ثبت اولیه تمام فیلدها</span>
        )
      )
    }
  ], []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-5xl w-full shadow-2xl border border-slate-200 space-y-6 text-right dir-rtl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                ورود و بروزرسانی هوشمند اطلاعات پرسنل (از اکسل)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                قابلیت شناسایی خودکار ستون‌ها، تطبیق بر اساس کد ملی / کد پرسنلی و پیش‌نمایش تغییرات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">

          {/* Access Warning if not admin */}
          {!isAdmin && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                هشدار عدم دسترسی: عملیات بارگذاری و به‌روزرسانی گروهی پرونده‌های پرسنل منحصر به مدیر اصلی سیستم می‌باشد.
              </span>
            </div>
          )}

          {/* Sample Excel Template Download Banner */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  فایل اکسل نمونه جهت ورود صحیح اطلاعات
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  دارای تمامی ستون‌های مجاز، نمونه داده استاندارد و برگه راهنمای تکمیل فیلدها
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadPersonnelExcelTemplate}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود فایل اکسل نمونه</span>
            </button>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-6 text-center transition-all bg-slate-50/50 hover:bg-emerald-50/20 group relative cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={!isAdmin || isProcessing}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-600 group-hover:text-emerald-600 group-hover:border-emerald-300 flex items-center justify-center mx-auto transition-all">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  انتخاب یا رهاسازی فایل اکسل (.xlsx یا .xls)
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  ستون‌های شناسایی‌شده: کد ملی، کد پرسنلی، نام، نام خانوادگی، جنسیت، وضعیت نظام وظیفه، واحد و ...
                </p>
              </div>

              {selectedFile && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-100 text-emerald-900 rounded-xl border border-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>فایل انتخاب‌شده: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Spinner & Web Worker Progress Bar */}
          {isProcessing && (
            <div className="p-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-xs font-black text-blue-900 dark:text-blue-200">
                  {processingMessage || 'در حال پردازش داده‌ها در Web Worker بدون قفل شدن مرورگر...'}
                </span>
                <span className="text-xs font-mono font-bold text-blue-700">{processingProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, processingProgress)}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-600/80">
                پردازش موازی در پشت‌صحنه جهت روان ماندن رابط کاربری و جلوگیری از انجماد صفحه
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Match Comparison Preview Studio */}
          {previewResult && (
            <div className="space-y-5 border-t border-slate-100 pt-4">
              
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-right">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>ایجاد پرسنل جدید</span>
                  </div>
                  <div className="text-lg font-black text-emerald-900 mt-1">
                    {previewResult.createdCount} نفر
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-right">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>به‌روزرسانی پرسنل موجود</span>
                  </div>
                  <div className="text-lg font-black text-blue-900 mt-1">
                    {previewResult.updatedCount} نفر
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 border border-blue-200 rounded-2xl text-right">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>هشدار / تکراری در فایل</span>
                  </div>
                  <div className="text-lg font-black text-amber-900 mt-1">
                    {previewResult.warningCount} موارد
                  </div>
                </div>

                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-right">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>خطاهای غیرقابل ثبت</span>
                  </div>
                  <div className="text-lg font-black text-rose-900 mt-1">
                    {previewResult.errorCount} سطر
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      statusFilter === 'ALL' ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    همه ({previewResult.rows.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('CREATE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      statusFilter === 'CREATE' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    جدید ({previewResult.createdCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('UPDATE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      statusFilter === 'UPDATE' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    به‌روزرسانی ({previewResult.updatedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('WARNING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      statusFilter === 'WARNING' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    هشدارها ({previewResult.warningCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="جستجو در پیش‌نمایش..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>

              {/* Isolated Scroll Table with Virtualization */}
              <div className="rounded-2xl border border-slate-200 shadow-inner bg-white overflow-hidden">
                <VirtualizedDataTable
                  data={filteredRows || []}
                  columns={tableColumns}
                  height={380}
                  isFa={isFa}
                  emptyMessage="هیچ رکوردی برای نمایش وجود ندارد."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            انصراف
          </button>

          {previewResult && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>تأیید و ذخیره نهایی اطلاعات در سامانه</span>
            </button>
          )}
        </div>

        {/* Final Commitment Confirm Modal */}
        {showConfirmModal && previewResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 text-right dir-rtl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تأیید ذخیره‌سازی اطلاعات پرسنل</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ثبت نهایی {previewResult.createdCount} پرسنل جدید و بروزرسانی {previewResult.updatedCount} پرونده موجود
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-700 leading-relaxed">
                <p>
                  با تأیید این مرحله، تغییرات فوق در بانک اطلاعات پرسنل سامانه ثبت می‌گردد و در تمام ماژول‌های HSE (از جمله معاینات دوره‌ای، پروانه‌های کار و آموزش) اعمال خواهد شد.
                </p>
                <p className="font-bold text-slate-900">
                  همچنین این عملیات در لاگ سیستم ثبت می‌گردد.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  بازگشت
                </button>
                <button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md transition-colors cursor-pointer flex items-center gap-2"
                >
                  <FileCheck2 className={`w-4 h-4 ${isCommitting ? 'animate-spin' : ''}`} />
                  <span>{isCommitting ? 'در حال ثبت در پایگاه داده...' : 'ذخیره نهایی اطلاعات'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

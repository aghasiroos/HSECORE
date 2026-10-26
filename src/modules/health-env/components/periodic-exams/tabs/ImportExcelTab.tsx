import React, { useState } from 'react';
import {
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Building2,
  Calendar,
  Users,
  Sparkles,
  AlertCircle,
  HardDrive,
  FileText,
  ShieldCheck
} from 'lucide-react';

export interface ImportedBatch {
  id: string;
  fileName: string;
  fileSize?: string;
  importedAt: string;
  recordCount: number;
  personnelCount: number;
  years: string[];
  companies: string[];
}

interface Props {
  downloadExcelTemplate: () => void;
  handleFileUpload: (file: File) => void;
  importStatus: string;
  joinedRecords: any[];
  personnelList: any[];
  clearImportedData: () => void;
  pendingImport: any[];
  dupPolicy: 'skip' | 'update' | 'replace';
  setDupPolicy: (p: 'skip' | 'update' | 'replace') => void;
  confirmImport: () => void;
  setPendingImport: (p: any[]) => void;
  importedBatches: ImportedBatch[];
  deleteBatch: (batchId: string) => void;
}

export const ImportExcelTab: React.FC<Props> = ({
  downloadExcelTemplate,
  handleFileUpload,
  importStatus,
  joinedRecords,
  personnelList,
  clearImportedData,
  pendingImport,
  dupPolicy,
  setDupPolicy,
  confirmImport,
  setPendingImport,
  importedBatches = [],
  deleteBatch
}) => {
  const [fileToDelete, setFileToDelete] = useState<ImportedBatch | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Grid: Upload & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Upload Card (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Upload className="w-4 h-4" />
              </div>
              <span>ورود اطلاعات از فایل اکسل طب کار</span>
            </h3>

            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-teal-600/70 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود قالب اکسل خام</span>
            </button>
          </div>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-850/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">۱</span>
              <span>فایل اکسل می‌تواند شامل دوره‌های مختلف معاینات (سال‌های ۱۴۰۱، ۱۴۰۲، ۱۴۰۳ و ...) و شرکت‌های مختلف باشد.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">۲</span>
              <span>هر فایل اکسل با شناسه اختصاصی ثبت می‌شود و امکان حذف مستقل هر فایل بدون تأثیر بر سایر فایل‌ها وجود دارد.</span>
            </div>
          </div>

          {/* Drop Zone */}
          <label className="border-2 border-dashed border-teal-300/80 dark:border-teal-800/80 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-teal-600 hover:bg-teal-50/30 dark:hover:bg-teal-950/30 transition-all block">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <span className="text-sm font-black text-slate-800 dark:text-slate-100 block">
                فایل اکسل معاینات (.xlsx / .xls) را اینجا رها کنید یا کلیک نمایید
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block mt-1">
                پشتیبانی کامل از فایل‌های خروجی نرم‌افزارهای طب کار و اکسل‌های استاندارد
              </span>
            </div>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={e => {
                if (e.target.files?.length) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </label>

          {importStatus && (
            <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 text-xs text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}
        </div>

        {/* Right Column: Database Summary (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <HardDrive className="w-4 h-4" />
              </div>
              <span>وضعیت داده‌های موجود در سامانه</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] font-bold">تعداد کل پرونده‌ها</span>
                <span className="text-2xl font-black font-mono text-teal-700 dark:text-teal-300 mt-1 block">
                  {joinedRecords.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">رکورد معاینه ثبت‌شده</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] font-bold">کل پرسنل یکتا</span>
                <span className="text-2xl font-black font-mono text-slate-800 dark:text-white mt-1 block">
                  {personnelList.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">نفر پرسنل شاغل</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[11px] font-bold">تعداد فایل‌های اکسل بارگذاری‌شده</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5 block">
                  {importedBatches.length} فایل ثبت‌شده در پایگاه
                </span>
              </div>
              <span className="text-xs font-bold font-mono px-3 py-1 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {importedBatches.length} فایل
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending preview modal / section */}
      {pendingImport.length > 0 && (
        <div className="bg-white dark:bg-[#17222c] border border-teal-300 dark:border-teal-800 rounded-3xl p-5 space-y-4 shadow-md animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                <span>پیش‌نمایش داده‌های فایل اکسل ({pendingImport.length} رکورد آماده ورود)</span>
              </h3>
              <span className="text-xs text-slate-400 mt-0.5 block">
                لطفاً سیاست برخورد با رکوردهای هم‌نام/تکراری را انتخاب نموده و ورود داده را تأیید کنید.
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={dupPolicy}
                onChange={e => setDupPolicy(e.target.value as any)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
              >
                <option value="skip">رد شدن از رکوردهای تکراری (Skip)</option>
                <option value="update">به‌روزرسانی رکوردهای موجود (Update)</option>
                <option value="replace">جایگزینی کامل دیتابیس با این فایل (Replace)</option>
              </select>

              <button
                type="button"
                onClick={confirmImport}
                className="px-4 py-2 text-xs font-black rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید و ذخیره در سامانه</span>
              </button>

              <button
                type="button"
                onClick={() => setPendingImport([])}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-64 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 sticky top-0">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام و نام خانوادگی</th>
                  <th className="p-3">کد ملی</th>
                  <th className="p-3">کد پرسنلی</th>
                  <th className="p-3">واحد / شرکت</th>
                  <th className="p-3">تاریخ معاینه</th>
                  <th className="p-3">BMI</th>
                  <th className="p-3">فشار خون</th>
                  <th className="p-3">نظریه طب کار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingImport.slice(0, 30).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                    <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {[r.fname, r.lname].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{r.nid || '—'}</td>
                    <td className="p-3 font-mono">{r.pcode || '—'}</td>
                    <td className="p-3">{r.company || '—'}</td>
                    <td className="p-3 font-mono">{r.exam_date || '—'}</td>
                    <td className="p-3 font-mono">{r.bmi || '—'}</td>
                    <td className="p-3 font-mono">{r.bp_sys ? `${r.bp_sys}/${r.bp_dia}` : '—'}</td>
                    <td className="p-3">{r.final_opinion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pendingImport.length > 30 && (
            <p className="text-[11px] text-slate-400 text-center">
              نمایش ۳۰ رکورد اول از مجموع {pendingImport.length} رکورد
            </p>
          )}
        </div>
      )}

      {/* SECTION: Imported Excel Files History & Delete Individual Files */}
      <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              <span>فایل‌های اکسل وارد شده به سامانه و مدیریت آن‌ها</span>
            </h3>
            <span className="text-xs text-slate-400 mt-0.5 block">
              امکان حذف مستقل هر فایل اکسل، مشاهده مشخصات و سابقه فایل‌های ثبت‌شده
            </span>
          </div>

          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            مجموع {importedBatches.length} فایل فعال
          </span>
        </div>

        {importedBatches.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-850/40">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
              هیچ فایل اکسلی در سامانه ثبت نشده است
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
              با بارگذاری اولین فایل اکسل از بخش بالا، سابقه فایل به همراه تعداد رکوردها در این قسمت قرار می‌گیرد و در هر زمان امکان حذف آن وجود دارد.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {importedBatches.map(batch => (
              <div
                key={batch.id}
                className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/80 hover:border-teal-300 dark:hover:border-teal-800 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white truncate">
                        {batch.fileName}
                      </h4>
                      {batch.fileSize && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                          {batch.fileSize}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>تاریخ ورود: {batch.importedAt}</span>
                      </span>

                      <span className="flex items-center gap-1 font-bold text-teal-700 dark:text-teal-300">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{batch.recordCount} رکورد معاینه</span>
                      </span>

                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{batch.personnelCount} پرسنل</span>
                      </span>

                      {batch.years && batch.years.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>سال: {batch.years.join('، ')}</span>
                        </span>
                      )}

                      {batch.companies && batch.companies.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>سازمان: {batch.companies.join('، ')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete Button for this specific Excel file */}
                <button
                  type="button"
                  onClick={() => setFileToDelete(batch)}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف این فایل اکسل</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Confirm Delete Specific File */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#17222c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                تأیید حذف فایل اکسل
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                آیا از حذف فایل <strong className="text-slate-800 dark:text-white">«{fileToDelete.fileName}»</strong> اطمینان دارید؟
                با حذف این فایل، تعداد <strong className="text-rose-600 font-mono">{fileToDelete.recordCount}</strong> رکورد معاینه مرتبط با آن از کلیه بخش‌های سامانه پاک خواهد شد.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  deleteBatch(fileToDelete.id);
                  setFileToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-sm shadow-rose-600/20"
              >
                بله، حذف شود
              </button>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Clear All Data */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#17222c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                پاک‌سازی کامل پایگاه داده
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                آیا از پاک‌سازی کلیه اطلاعات معاینات ادواری، فایل‌های اکسل و پرونده‌های پرسنل اطمینان دارید؟ پایگاه داده سامانه کاملاً خالی خواهد شد.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  clearImportedData();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-sm shadow-rose-600/20"
              >
                بله، پاک‌سازی کامل
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcelTab;

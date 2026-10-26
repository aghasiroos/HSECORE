import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Layers
} from 'lucide-react';
import { TrirRecord } from '../../types';
import { 
  downloadTrirExcelTemplate, 
  parseTrirExcelFile, 
  ParsedTrirRow 
} from './trirExcelService';
import { sortRecordsByYearAndMonth, normalizeForMatching } from '../../utils/textNormalization';

interface TrirExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecords: TrirRecord[];
  onImport: (importedRecords: TrirRecord[], mode: 'merge' | 'replace') => void;
  isFa: boolean;
}

export default function TrirExcelImportModal({
  isOpen,
  onClose,
  existingRecords,
  onImport,
  isFa
}: TrirExcelImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTrirRow[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setParseError(null);
    setParsedRows([]);

    try {
      const res = await parseTrirExcelFile(file, existingRecords);
      setParsedRows(res.rows);
      setDuplicateCount(res.duplicateCount);
    } catch (err: any) {
      console.error('Failed to parse TRIR excel:', err);
      setParseError(err?.message || 'خطا در تحلیل و خواندن فایل اکسل. لطفاً از الگوی استاندارد استفاده فرمایید.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  const displayedRows = showOnlyErrors ? invalidRows : parsedRows;

  const handleCommitImport = () => {
    if (validRows.length === 0) return;

    let finalRecords: TrirRecord[] = [];

    if (importMode === 'replace') {
      // Deduplicate within file itself
      const fileDeduplicated: TrirRecord[] = [];
      validRows.forEach(r => {
        const normM = normalizeForMatching(r.month);
        const idx = fileDeduplicated.findIndex(f => f.year === r.year && (normalizeForMatching(f.month) === normM || f.month === r.month));
        const recItem: TrirRecord = {
          id: 'tr' + Math.random().toString(36).slice(2, 9),
          year: r.year,
          month: r.month,
          attendance: r.attendance,
          mission: r.mission,
          contractor: r.contractor,
          incidents: r.incidents,
          notes: r.notes
        };
        if (idx >= 0) {
          fileDeduplicated[idx] = recItem;
        } else {
          fileDeduplicated.push(recItem);
        }
      });
      finalRecords = fileDeduplicated;
    } else {
      // Merge: Update existing records that have matching (year, month) without creating duplicates
      const updatedExisting = existingRecords.map(existing => {
        const normExistingM = normalizeForMatching(existing.month);
        const match = validRows.find(v => v.year === existing.year && (normalizeForMatching(v.month) === normExistingM || v.month === existing.month));
        if (match) {
          return {
            ...existing,
            attendance: match.attendance,
            mission: match.mission,
            contractor: match.contractor,
            incidents: match.incidents,
            notes: match.notes || existing.notes
          };
        }
        return existing;
      });

      // Filter truly new valid rows that don't match existing records or earlier new rows
      const brandNew: TrirRecord[] = [];
      validRows.forEach(v => {
        const normVM = normalizeForMatching(v.month);
        const existsInOld = existingRecords.some(e => e.year === v.year && (normalizeForMatching(e.month) === normVM || e.month === v.month));
        const existsInNew = brandNew.some(b => b.year === v.year && (normalizeForMatching(b.month) === normVM || b.month === v.month));
        if (!existsInOld && !existsInNew) {
          brandNew.push({
            id: 'tr' + Math.random().toString(36).slice(2, 9),
            year: v.year,
            month: v.month,
            attendance: v.attendance,
            mission: v.mission,
            contractor: v.contractor,
            incidents: v.incidents,
            notes: v.notes
          });
        }
      });

      finalRecords = [...updatedExisting, ...brandNew];
    }

    // Chronologically sort all records by Year -> Month while preserving original values
    finalRecords = sortRecordsByYearAndMonth(finalRecords, true);

    onImport(finalRecords, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn" id="trir-excel-import-modal">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shadow-emerald-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'ورود اطلاعات آمار کارکرد و حوادث از فایل اکسل' : 'Import Man-hours & Incident Data from Excel'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa ? 'بارگذاری گروهی داده‌های ماهانه، استخراج خودکار و محاسبه شاخص‌های TRIR' : 'Batch upload monthly data and compute incident indicators automatically'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">

          {/* Download Template Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-4 rounded-xl border border-blue-200/80 dark:border-blue-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'نیاز به راهنمایی یا فرمت استاندارد اکسل دارید؟' : 'Need standard template and column format?'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {isFa ? 'فایل اکسل نمونه حاوی سرستون‌های استاندارد فارسی، داده‌های نمونه و راهنمای تکمیل را دانلود کنید.' : 'Download sample template with official Persian headers and examples.'}
                </p>
              </div>
            </div>
            <button
              onClick={downloadTrirExcelTemplate}
              className="px-4 py-2 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700/80 rounded-xl text-xs font-black border border-amber-200 dark:border-amber-700 flex items-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFa ? 'دانلود فایل اکسل نمونه' : 'Download Sample Excel'}</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          {!selectedFile ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]' 
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-3 shadow-xs">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isFa ? 'فایل اکسل را اینجا بکشید و رها کنید، یا کلیک نمایید' : 'Drag & drop your Excel file here, or click to browse'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {isFa ? 'فرمت‌های مجاز: XLSX, XLS, CSV' : 'Supported formats: .xlsx, .xls, .csv'}
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedFile.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB — {parsedRows.length} {isFa ? 'سطر پردازش‌شده' : 'rows parsed'}
                  </div>
                </div>
              </div>
              <button
                onClick={resetUpload}
                className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg font-bold transition-colors cursor-pointer"
              >
                {isFa ? 'تغییر فایل' : 'Change File'}
              </button>
            </div>
          )}

          {/* Parsing error */}
          {parseError && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{isFa ? 'خطا در بارگذاری فایل اکسل:' : 'Excel parsing error:'}</p>
                <p className="mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview section if rows parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-1">
              
              {/* Summary Metrics & Mode Select */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-center">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'معتبر و آماده' : 'Valid'}</span>
                    <span className="text-base font-mono font-black text-emerald-700 dark:text-emerald-300">{validRows.length}</span>
                  </div>

                  <div className="bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-800/80 text-center">
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">{isFa ? 'دارای نقص / خطا' : 'Invalid'}</span>
                    <span className="text-base font-mono font-black text-red-700 dark:text-red-300">{invalidRows.length}</span>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80 text-center">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'همپوشانی ماه/سال' : 'Overlap'}</span>
                    <span className="text-base font-mono font-black text-amber-700 dark:text-amber-300">{duplicateCount}</span>
                  </div>
                </div>

                {/* Import Mode Selector */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>{isFa ? 'نحوه اعمال اطلاعات بر سامانه:' : 'Import strategy:'}</span>
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'merge' 
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-bold' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <input 
                        type="radio" 
                        name="importMode" 
                        checked={importMode === 'merge'} 
                        onChange={() => setImportMode('merge')} 
                        className="text-blue-600"
                      />
                      <span>{isFa ? 'افزودن و بروزرسانی' : 'Merge & Update'}</span>
                    </label>

                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'replace' 
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 font-bold' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <input 
                        type="radio" 
                        name="importMode" 
                        checked={importMode === 'replace'} 
                        onChange={() => setImportMode('replace')} 
                        className="text-rose-600"
                      />
                      <span>{isFa ? 'جایگزینی کامل' : 'Replace All'}</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Preview table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isFa ? `پیش‌نمایش ردیف‌های خوانده‌شده (${displayedRows.length} سطر)` : `Rows Preview (${displayedRows.length})`}
                  </span>

                  {invalidRows.length > 0 && (
                    <button
                      onClick={() => setShowOnlyErrors(!showOnlyErrors)}
                      className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>{showOnlyErrors ? (isFa ? 'نمایش همه سطرها' : 'Show all') : (isFa ? `فقط نمایش خطادارها (${invalidRows.length})` : `Show only errors (${invalidRows.length})`)}</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto max-h-56 custom-scrollbar text-[11px]">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        <th className="p-2 text-center">#</th>
                        <th className="p-2 text-center">{isFa ? 'سال' : 'Year'}</th>
                        <th className="p-2 text-center">{isFa ? 'ماه' : 'Month'}</th>
                        <th className="p-2 text-right">{isFa ? 'حضور' : 'Attendance'}</th>
                        <th className="p-2 text-right">{isFa ? 'ماموریت' : 'Mission'}</th>
                        <th className="p-2 text-right">{isFa ? 'پیمانکار' : 'Contractor'}</th>
                        <th className="p-2 text-right font-bold">{isFa ? 'کل کارکرد' : 'Total'}</th>
                        <th className="p-2 text-center text-red-500 font-bold">{isFa ? 'حوادث LTI' : 'LTI'}</th>
                        <th className="p-2 text-center text-sky-600">{isFa ? 'TRIR ماه' : 'TRIR'}</th>
                        <th className="p-2 text-center">{isFa ? 'وضعیت سطر' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {displayedRows.map((r, idx) => (
                        <tr 
                          key={idx} 
                          className={!r.isValid ? 'bg-red-50/70 dark:bg-red-950/20' : r.isDuplicateWithExisting ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}
                        >
                          <td className="p-2 text-center font-mono text-slate-400">{r.rowNumber}</td>
                          <td className="p-2 text-center font-mono font-bold">{r.year}</td>
                          <td className="p-2 text-center font-bold text-slate-800 dark:text-slate-200">{r.month}</td>
                          <td className="p-2 text-right font-mono">{r.attendance.toLocaleString('en-US')}</td>
                          <td className="p-2 text-right font-mono">{r.mission.toLocaleString('en-US')}</td>
                          <td className="p-2 text-right font-mono">{r.contractor.toLocaleString('en-US')}</td>
                          <td className="p-2 text-right font-mono font-bold">{r.totalHours.toLocaleString('en-US')}</td>
                          <td className="p-2 text-center font-mono font-black text-red-500">{r.incidents}</td>
                          <td className="p-2 text-center font-mono text-sky-600 font-bold">{r.monthlyTRIR.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            {r.isValid ? (
                              r.isDuplicateWithExisting ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                  {isFa ? 'بروزرسانی ردیف' : 'Will Update'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                  {isFa ? 'رکورد جدید' : 'New'}
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400" title={r.validationError}>
                                {r.validationError || (isFa ? 'خطا' : 'Error')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={validRows.length === 0}
            onClick={handleCommitImport}
            className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 ${
              validRows.length > 0 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer' 
                : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isFa 
                ? `اعمال و ذخیره ${validRows.length} رکورد معتبر در سامانه` 
                : `Commit ${validRows.length} records`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

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
  Layers,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { WarningRecord } from '../../types';
import {
  downloadWarningsExcelTemplate,
  parseWarningsExcelFile,
  ParsedWarningRow
} from './warningsExcelService';

interface WarningsExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecords: WarningRecord[];
  onImport: (importedRecords: WarningRecord[], mode: 'merge' | 'replace') => Promise<void> | void;
  isFa: boolean;
  currentUser?: any;
}

export default function WarningsExcelImportModal({
  isOpen,
  onClose,
  existingRecords,
  onImport,
  isFa
}: WarningsExcelImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedWarningRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [filterType, setFilterType] = useState<'all' | 'valid' | 'invalid' | 'duplicate'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      const res = await parseWarningsExcelFile(file, existingRecords);
      setParsedRows(res.rows);
      setDuplicateCount(res.duplicateCount);
    } catch (err: any) {
      console.error('Failed to parse Warnings Excel:', err);
      setParseError(err?.message || (isFa ? 'خطا در خواندن فایل اکسل. لطفاً از الگوی استاندارد استفاده فرمایید.' : 'Error parsing Excel file. Please use the standard template.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseError(null);
    setSearchQuery('');
    setFilterType('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);
  const duplicateRows = parsedRows.filter(r => r.isDuplicate);

  // Filtered rows for display
  const displayedRows = parsedRows.filter(r => {
    if (filterType === 'valid' && !r.isValid) return false;
    if (filterType === 'invalid' && r.isValid) return false;
    if (filterType === 'duplicate' && !r.isDuplicate) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (r.record.name || '').toLowerCase().includes(q);
      const matchNum = (r.record.number || '').toLowerCase().includes(q);
      const matchCode = (r.record.personnelCode || '').toLowerCase().includes(q);
      const matchReason = (r.record.reason || '').toLowerCase().includes(q);
      const matchDept = (r.record.department || r.record.unit || '').toLowerCase().includes(q);
      return matchName || matchNum || matchCode || matchReason || matchDept;
    }
    return true;
  });

  const handleFinalSubmit = async () => {
    if (validRows.length === 0) return;

    if (importMode === 'replace') {
      const conf = window.confirm(
        isFa
          ? `هشدار قطعی: حالت "جایگزینی کامل" انتخاب شده است.\nتمام ${existingRecords.length} اخطار قبلی ثبت‌شده در سیستم پاکسازی شده و با ${validRows.length} ردیف جدید از اکسل جایگزین خواهند شد.\n\nآیا از انجام این عملیات اطمینان دارید؟`
          : `Warning: "Replace All" mode is selected. All ${existingRecords.length} existing records will be cleared and replaced with ${validRows.length} new records. Do you wish to continue?`
      );
      if (!conf) return;
    }

    setIsSubmitting(true);
    try {
      const recordsToImport = validRows.map(r => r.record);
      await onImport(recordsToImport, importMode);
      onClose();
    } catch (err) {
      console.error('Import submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xs shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'ورود اطلاعات اخطارهای ایمنی از فایل اکسل' : 'Import Safety Warnings from Excel'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {isFa ? 'ورود گروهی احکام عدم انطباق، اخطارهای فردی و واحدی مطابق الگوی استاندارد' : 'Bulk import individual and unit safety warning notices'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadWarningsExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition border border-emerald-200 dark:border-emerald-800 cursor-pointer shadow-2xs"
              title={isFa ? 'دانلود فایل نمونه استاندارد با ۵ ردیف داده و برگه راهنما' : 'Download sample template with 5 rows and instructions'}
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isFa ? 'دانلود فایل اکسل نمونه' : 'Download Sample Template'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* UPLOAD ZONE (When no file selected) */}
          {!selectedFile && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 scale-[0.99]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-slate-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="p-4 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-3xl shadow-sm">
                  <UploadCloud className="w-10 h-10 animate-bounce" />
                </div>

                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {isFa ? 'فایل اکسل اخطارها را به اینجا بکشید یا برای انتخاب کلیک کنید' : 'Drag and drop your Excel file here or click to browse'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isFa 
                      ? 'پشتیبانی از فرمت‌های XLSX، XLS و CSV با ستون‌های استاندارد تاریخ، نام، کد پرسنلی و علت اخطار' 
                      : 'Supports .XLSX, .XLS and .CSV files with standard column headers'}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 shadow-2xs">
                    .xlsx / .xls
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {isFa ? 'حداکثر حجم: ۱۰ مگابایت' : 'Max size: 10 MB'}
                  </span>
                </div>
              </div>

              {/* Helpful Tips Box */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-900 dark:text-amber-300">
                    {isFa ? 'نکات مهم جهت بارگذاری صحیح اطلاعات:' : 'Important notes for valid data import:'}
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <li>{isFa ? 'برای اطمینان از تطابق ستون‌ها، حتماً ابتدا دکمه «دانلود فایل اکسل نمونه» را فشرده و اطلاعات را در آن وارد فرمایید.' : 'Download sample template first to ensure matching columns.'}</li>
                    <li>{isFa ? 'فیلدهای نام و شرح علت اخطار اجباری می‌باشند.' : 'Name and violation reason are mandatory.'}</li>
                    <li>{isFa ? 'نوع اخطار باید یکی از مقادیر «فردی» یا «واحدی» باشد.' : 'Type must be either individual or unit.'}</li>
                    <li>{isFa ? 'در صورت خالی بودن شماره ابلاغیه، سامانه به صورت خودکار شماره مسلسل رسمی تولید خواهد کرد.' : 'Notice numbers will be auto-generated if left empty.'}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* PARSING LOADER */}
          {isProcessing && (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {isFa ? 'در حال تحلیل و بررسی ساختار سطرهای اکسل...' : 'Analyzing Excel rows and validating records...'}
              </p>
            </div>
          )}

          {/* PARSE ERROR */}
          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <span className="font-medium">{parseError}</span>
              </div>
              <button
                type="button"
                onClick={resetUpload}
                className="px-3 py-1 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
              >
                {isFa ? 'تلاش مجدد' : 'Try Again'}
              </button>
            </div>
          )}

          {/* PARSED DATA PREVIEW & CONTROLS */}
          {selectedFile && !isProcessing && parsedRows.length > 0 && (
            <div className="space-y-5">
              
              {/* File Info & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB — {parsedRows.length} {isFa ? 'ردیف پردازش‌شده' : 'rows parsed'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadWarningsExcelTemplate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isFa ? 'دانلود الگو' : 'Template'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetUpload}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    {isFa ? 'تغییر فایل' : 'Change File'}
                  </button>
                </div>
              </div>

              {/* Status Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total */}
                <div 
                  onClick={() => setFilterType('all')}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    filterType === 'all' 
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-400 block">{isFa ? 'کل ردیف‌ها' : 'Total Rows'}</span>
                  <span className="text-lg font-black font-mono text-slate-800 dark:text-slate-100">{parsedRows.length}</span>
                </div>

                {/* Valid */}
                <div 
                  onClick={() => setFilterType('valid')}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    filterType === 'valid' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">{isFa ? 'معتبر (آماده ثبت)' : 'Valid Rows'}</span>
                  <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{validRows.length}</span>
                </div>

                {/* Invalid */}
                <div 
                  onClick={() => setFilterType('invalid')}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    filterType === 'invalid' 
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block">{isFa ? 'دارای خطا' : 'Invalid Rows'}</span>
                  <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">{invalidRows.length}</span>
                </div>

                {/* Duplicates */}
                <div 
                  onClick={() => setFilterType('duplicate')}
                  className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                    filterType === 'duplicate' 
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">{isFa ? 'شماره تکراری' : 'Duplicate Notice'}</span>
                  <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{duplicateCount}</span>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isFa ? 'جستجو بر اساس نام، شماره ابلاغیه، کد پرسنلی یا علت...' : 'Search by name, notice ID, code or reason...'}
                    className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Selector */}
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-slate-400 text-[11px]">{isFa ? 'نمایش:' : 'Filter:'}</span>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterType === 'all' ? 'bg-white dark:bg-slate-900 shadow-2xs font-black text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}
                    >
                      {isFa ? 'همه' : 'All'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('valid')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterType === 'valid' ? 'bg-white dark:bg-slate-900 shadow-2xs font-black text-emerald-600' : 'text-slate-500'}`}
                    >
                      {isFa ? 'معتبر' : 'Valid'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('invalid')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterType === 'invalid' ? 'bg-white dark:bg-slate-900 shadow-2xs font-black text-rose-600' : 'text-slate-500'}`}
                    >
                      {isFa ? 'خطادار' : 'Invalid'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('duplicate')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterType === 'duplicate' ? 'bg-white dark:bg-slate-900 shadow-2xs font-black text-amber-600' : 'text-slate-500'}`}
                    >
                      {isFa ? 'تکراری' : 'Duplicate'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                    <tr>
                      <th className="p-2.5 text-center w-12">{isFa ? 'سطر' : 'Row'}</th>
                      <th className="p-2.5 text-center w-24">{isFa ? 'وضعیت' : 'Status'}</th>
                      <th className="p-2.5">{isFa ? 'شماره ابلاغیه' : 'Notice ID'}</th>
                      <th className="p-2.5">{isFa ? 'تاریخ' : 'Date'}</th>
                      <th className="p-2.5">{isFa ? 'نوع' : 'Type'}</th>
                      <th className="p-2.5">{isFa ? 'نام و مشخصات' : 'Name'}</th>
                      <th className="p-2.5">{isFa ? 'کد پرسنلی' : 'Code'}</th>
                      <th className="p-2.5">{isFa ? 'واحد / دپارتمان' : 'Unit/Dept'}</th>
                      <th className="p-2.5 min-w-[200px]">{isFa ? 'علت اخطار' : 'Reason'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          {isFa ? 'هیچ ردیفی با فیلتر انتخابی مطابقت ندارد' : 'No rows match current filter'}
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((r, i) => (
                        <tr 
                          key={i} 
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                            !r.isValid ? 'bg-rose-50/40 dark:bg-rose-950/20' : r.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center font-mono text-slate-400">{r.rowNumber}</td>
                          
                          <td className="p-2.5 text-center">
                            {!r.isValid ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                title={r.validationErrors.join(' | ')}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {isFa ? 'خطا' : 'Error'}
                              </span>
                            ) : r.isDuplicate ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                title={isFa ? 'شماره ابلاغیه قبلاً ثبت شده یا تکراری است' : 'Duplicate Notice Number'}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {isFa ? 'تکراری' : 'Duplicate'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                {isFa ? 'تایید' : 'OK'}
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-200">
                            {r.record.number}
                          </td>

                          <td className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {r.record.day} {r.record.month} {r.record.year}
                          </td>

                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              r.record.type === 'واحدی' 
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' 
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            }`}>
                              {r.record.type}
                            </span>
                          </td>

                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                            {r.record.name}
                            {r.record.jobTitle && (
                              <span className="text-[10px] text-slate-400 block font-normal">{r.record.jobTitle}</span>
                            )}
                          </td>

                          <td className="p-2.5 font-mono text-slate-500">
                            {r.record.personnelCode || '—'}
                          </td>

                          <td className="p-2.5 text-slate-600 dark:text-slate-300">
                            {r.record.unit || r.record.department || '—'}
                          </td>

                          <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={r.record.reason}>
                            {r.record.reason}
                            {r.validationErrors.length > 0 && (
                              <span className="text-[10px] text-rose-500 block font-bold">
                                {r.validationErrors.join('، ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Import Mode Selection */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                  {isFa ? 'نحوه اعمال و ذخیره‌سازی داده‌ها در سامانه:' : 'Import Mode Selection:'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Merge Mode */}
                  <label 
                    onClick={() => setImportMode('merge')}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      importMode === 'merge' 
                        ? 'border-blue-500 bg-white dark:bg-slate-900 shadow-xs ring-2 ring-blue-500/20' 
                        : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/30'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="importMode" 
                      checked={importMode === 'merge'} 
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div className="space-y-0.5 text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-100 block">
                        {isFa ? 'افزودن و ادغام هوشمند (پیشنهادی)' : 'Append & Smart Merge (Recommended)'}
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-relaxed">
                        {isFa 
                          ? 'ردیف‌های معتبر به اخطارهای قبلی افزوده شده و سوابق پیشین حفظ می‌گردند.' 
                          : 'Valid rows will be added to the database preserving existing history.'}
                      </span>
                    </div>
                  </label>

                  {/* Replace Mode */}
                  <label 
                    onClick={() => setImportMode('replace')}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      importMode === 'replace' 
                        ? 'border-amber-500 bg-white dark:bg-slate-900 shadow-xs ring-2 ring-amber-500/20' 
                        : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/30'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="importMode" 
                      checked={importMode === 'replace'} 
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-amber-600"
                    />
                    <div className="space-y-0.5 text-xs">
                      <span className="font-bold text-amber-600 dark:text-amber-400 block">
                        {isFa ? 'جایگزینی کامل (پاکسازی تمام قبلی‌ها)' : 'Full Replacement (Clear Existing)'}
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-relaxed">
                        {isFa 
                          ? 'تمام اخطارهای قبلی پاکسازی شده و منحصراً ردیف‌های این فایل قرار می‌گیرند.' 
                          : 'All current records will be purged and replaced by this file.'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>

          {selectedFile && parsedRows.length > 0 && (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={validRows.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-blue-500/25 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isFa ? 'در حال ثبت در سرور...' : 'Saving to Server...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {isFa 
                      ? `ثبت و ذخیره نهایی ${validRows.length} اخطار در سامانه` 
                      : `Confirm & Import ${validRows.length} Warnings`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

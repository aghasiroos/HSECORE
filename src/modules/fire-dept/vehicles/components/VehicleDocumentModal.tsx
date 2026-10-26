import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, X, Image as ImageIcon, FileCheck, 
  AlertCircle, Calendar, Hash, Tag, Info, CheckCircle2 
} from 'lucide-react';
import { VehicleDocument, VehicleDocumentCategory } from '../types/vehicleTypes';

interface Props {
  isOpen: boolean;
  language: 'fa' | 'en';
  vehicleCode: string;
  document?: VehicleDocument | null;
  onSave: (doc: Omit<VehicleDocument, 'id'>) => void;
  onClose: () => void;
}

export default function VehicleDocumentModal({
  isOpen,
  language,
  vehicleCode,
  document,
  onSave,
  onClose
}: Props) {
  const isFa = language === 'fa';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VehicleDocumentCategory>('manual');
  const [docNumber, setDocNumber] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toLocaleDateString('fa-IR'));
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'PDF' | 'PNG' | 'JPG' | 'JPEG' | string>('PDF');
  const [fileSize, setFileSize] = useState('1.5 MB');
  const [fileData, setFileData] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setCategory(document.category || 'manual');
      setDocNumber(document.docNumber || '');
      setUploadDate(document.uploadDate || new Date().toLocaleDateString('fa-IR'));
      setExpiryDate(document.expiryDate || '');
      setNotes(document.notes || '');
      setFileName(document.fileName || document.title || '');
      setFileType(document.fileType || 'PDF');
      setFileSize(document.size || '1.2 MB');
      setFileData(document.fileData || '');
    } else {
      setTitle('');
      setCategory('manual');
      setDocNumber('');
      setUploadDate(new Date().toLocaleDateString('fa-IR'));
      setExpiryDate('');
      setNotes('');
      setFileName('');
      setFileType('PDF');
      setFileSize('1.2 MB');
      setFileData('');
    }
    setUploadError(null);
  }, [document, isOpen]);

  const processFile = (file: File) => {
    setUploadError(null);
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(ext)) {
      setUploadError(isFa ? 'فرمت فایل نامعتبر است. فقط فرمت‌های PDF، PNG و JPG مجاز هستند.' : 'Invalid file format. Only PDF, PNG, and JPG are supported.');
      return;
    }

    // Size calculation
    const sizeInMb = file.size / (1024 * 1024);
    let sizeStr = '';
    if (sizeInMb < 1) {
      sizeStr = `${Math.round(file.size / 1024)} KB`;
    } else {
      sizeStr = `${sizeInMb.toFixed(1)} MB`;
    }

    const detectedType = ext.toUpperCase() === 'JPEG' ? 'JPG' : ext.toUpperCase();
    setFileType(detectedType);
    setFileName(file.name);
    setFileSize(sizeStr);

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    // Read as Data URL for preview and storage
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setFileData(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setUploadError(isFa ? 'لطفاً عنوان سند را وارد نمایید.' : 'Please enter document title.');
      return;
    }

    onSave({
      title: title.trim(),
      category,
      docNumber: docNumber.trim(),
      uploadDate,
      expiryDate: expiryDate.trim(),
      notes: notes.trim(),
      fileName: fileName || `${title}.${fileType.toLowerCase()}`,
      fileType: fileType || 'PDF',
      size: fileSize || '1.2 MB',
      fileData: fileData || ''
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-fadeIn overflow-y-auto"
      style={{ direction: isFa ? 'rtl' : 'ltr' }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scaleIn my-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 border border-red-200 dark:border-red-900/50">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {document 
                  ? (isFa ? 'ویرایش مشخصات سند / مدرک فنی' : 'Edit Vehicle Document')
                  : (isFa ? 'بارگذاری سند و مدرک فنی جدید' : 'Upload Vehicle Document')
                }
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {isFa ? `پیوست به خودرو: ${vehicleCode}` : `Attached to: ${vehicleCode}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {uploadError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Title and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-red-500" />
                <span>{isFa ? 'عنوان سند / مدرک:' : 'Document Title:'} <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={isFa ? 'مثال: بیمه‌نامه شخص ثالث سال ۱۴۰۴' : 'e.g. Insurance Policy 2026'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 rounded-xl px-3.5 py-2.5 outline-none font-bold text-slate-800 dark:text-slate-100 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-red-500" />
                <span>{isFa ? 'نوع و دسته‌بندی سند:' : 'Document Category:'}</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as VehicleDocumentCategory)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 rounded-xl px-3.5 py-2.5 outline-none font-bold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
              >
                <option value="manual">{isFa ? 'دفترچه راهنما و کاتالوگ فنی' : 'Technical Manual & Catalog'}</option>
                <option value="insurance">{isFa ? 'گواهی و بیمه‌نامه (شخص ثالث / بدنه)' : 'Insurance Policy & Certificate'}</option>
                <option value="ownership">{isFa ? 'اسناد مالکیت، کارت و سند انتظامی' : 'Ownership & Title Documents'}</option>
                <option value="license">{isFa ? 'مجوز بهره‌برداری و معاینه فنی' : 'Operational License & Inspection'}</option>
                <option value="technical">{isFa ? 'نقشه‌های برق، مدار هیدرولیک و اطفاء' : 'Technical Schematics & Wiring'}</option>
                <option value="other">{isFa ? 'سایر اسناد و مستندات' : 'Other Documents'}</option>
              </select>
            </div>
          </div>

          {/* Doc Number, Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'شماره سند / بیمه:' : 'Document / Policy No:'}</span>
              </label>
              <input
                type="text"
                value={docNumber}
                onChange={e => setDocNumber(e.target.value)}
                placeholder={isFa ? 'مثال: INS-1404-892' : 'e.g. INS-1404-892'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'تاریخ ثبت / صدور:' : 'Issue / Upload Date:'}</span>
              </label>
              <input
                type="text"
                value={uploadDate}
                onChange={e => setUploadDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'تاریخ انقضا (در صورت وجود):' : 'Expiry Date:'}</span>
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                placeholder={isFa ? 'مثال: 1405/02/15' : '1405/02/15'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100 transition-colors"
              />
            </div>
          </div>

          {/* File Upload Zone (PDF, PNG, JPG) */}
          <div className="space-y-2">
            <label className="block text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-red-500" />
                <span>{isFa ? 'فایل پیوست (فرمت‌های PDF ، PNG و JPG):' : 'File Attachment (PDF, PNG, JPG):'}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">PDF, PNG, JPG, JPEG</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center space-y-2 ${
                dragActive
                  ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30'
                  : fileName
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/20 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-red-400 bg-slate-50/60 dark:bg-slate-850'
              }`}
            >
              {fileName ? (
                <div className="flex items-center justify-between gap-3 text-right">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl text-white font-black text-xs font-mono ${
                      fileType === 'PDF' ? 'bg-red-600' : 'bg-blue-600'
                    }`}>
                      {fileType}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs truncate max-w-[280px]">
                        {fileName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {fileSize} • {isFa ? 'برای تغییر فایل کلیک کنید' : 'Click to change'}
                      </span>
                    </div>
                  </div>

                  {fileData && fileType !== 'PDF' ? (
                    <img 
                      src={fileData} 
                      alt="preview" 
                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700" 
                    />
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      {isFa ? 'آماده ذخیره' : 'Ready'}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <div className="p-2 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-bold text-xs">
                    {isFa ? 'فایل را به اینجا بکشید یا برای انتخاب کلیک کنید' : 'Drag & drop file here or click to browse'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isFa ? 'پشتیبانی از اسناد PDF و تصاویر PNG / JPG (حداکثر ۲۰ مگابایت)' : 'Supports PDF documents & PNG/JPG images (Max 20MB)'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>{isFa ? 'توضیحات و یادداشت تکمیلی:' : 'Notes / Description:'}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isFa ? 'توضیحات اضافی در خصوص شرایط مدرک، شرکت بیمه‌گر، نحوه دسترسی و...' : 'Additional notes...'}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-500 rounded-xl p-3 outline-none text-slate-800 dark:text-slate-100 transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>{document ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'بارگذاری و ذخیره سند' : 'Upload Document')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

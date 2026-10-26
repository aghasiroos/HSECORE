import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Eye,
  Download,
  Trash2,
  Edit3,
  Calendar,
  Tag,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  FileCheck,
  X,
  Clock,
  HardDrive
} from 'lucide-react';
import {
  DossierAttachment,
  DossierDocType,
  DOC_TYPE_CONFIG,
  getAttachmentsForPerson,
  getAttachmentCountsForPerson,
  addDossierAttachment,
  updateDossierAttachment,
  deleteDossierAttachment,
  formatFileSize
} from './dossierAttachmentStorage';
import DossierFilePreviewModal from './DossierFilePreviewModal';

interface Props {
  personnelId: string;
  personnelName: string;
  nationalCode?: string;
  personnelCode?: string;
  activeExamYear: string; // 'all' or specific year like '1404'
  availableYears: string[];
}

export const DossierAttachmentManager: React.FC<Props> = ({
  personnelId,
  personnelName,
  nationalCode,
  personnelCode,
  activeExamYear,
  availableYears
}) => {
  const [attachments, setAttachments] = useState<DossierAttachment[]>([]);
  const [counts, setCounts] = useState<{ total: number; byYear: Record<string, number> }>({ total: 0, byYear: {} });
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);

  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [examYear, setExamYear] = useState<string>(activeExamYear !== 'all' ? activeExamYear : (availableYears[availableYears.length - 1] || '1404'));
  const [docType, setDocType] = useState<DossierDocType>('lab');
  const [docDate, setDocDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Modals
  const [previewItem, setPreviewItem] = useState<DossierAttachment | null>(null);
  const [editingItem, setEditingItem] = useState<DossierAttachment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load attachments
  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getAttachmentsForPerson(personnelId, activeExamYear);
      const cnt = await getAttachmentCountsForPerson(personnelId);
      setAttachments(list);
      setCounts(cnt);
    } catch (err) {
      console.error('Failed to load attachments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (activeExamYear !== 'all') {
      setExamYear(activeExamYear);
    }
  }, [personnelId, activeExamYear]);

  // File selection handler
  const handleFileChange = (file: File) => {
    setUploadError('');
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    if (!allowed.includes(ext)) {
      setUploadError(`فرمت «${ext}» مجاز نیست. فقط فرمت‌های PDF، JPG، JPEG، PNG و WEBP پشتیبانی می‌شوند.`);
      setSelectedFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('حجم فایل نباید بیش از ۱۵ مگابایت باشد.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    // Auto-detect docType from file name
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes('lab') || lowerName.includes('آزمایش') || lowerName.includes('خون')) {
      setDocType('lab');
    } else if (lowerName.includes('spiro') || lowerName.includes('اسپیرو') || lowerName.includes('ریه')) {
      setDocType('spiro');
    } else if (lowerName.includes('audio') || lowerName.includes('ادیو') || lowerName.includes('شنوایی')) {
      setDocType('audio');
    } else if (lowerName.includes('ecg') || lowerName.includes('قلب') || lowerName.includes('نوار')) {
      setDocType('ecg');
    } else if (lowerName.includes('eye') || lowerName.includes('opt') || lowerName.includes('بینایی') || lowerName.includes('دید')) {
      setDocType('optometry');
    } else if (lowerName.includes('radio') || lowerName.includes('xray') || lowerName.includes('عکس') || lowerName.includes('قفسه')) {
      setDocType('radio');
    }

    if (!title.trim()) {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(baseName.replace(/[_-]/g, ' '));
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileBase64) {
      setUploadError('لطفاً یک فایل جهت پیوست انتخاب کنید.');
      return;
    }
    if (!title.trim()) {
      setUploadError('عنوان سند الزامی است.');
      return;
    }

    setIsSubmitting(true);
    setUploadError('');

    try {
      const ext = (selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf') as 'pdf' | 'jpg' | 'jpeg' | 'png' | 'webp';

      await addDossierAttachment({
        personnelId,
        personnelName,
        examYear: examYear || '1404',
        title: title.trim(),
        documentDate: docDate.trim() || new Date().toLocaleDateString('fa-IR'),
        docType,
        description: description.trim(),
        fileName: selectedFile.name,
        fileType: ext,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
        fileData: fileBase64
      });

      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setFileBase64('');
      setDocDate('');
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      await loadData();
    } catch (err) {
      setUploadError('خطا در ذخیره‌سازی فایل پیوست.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = (att: DossierAttachment) => {
    if (!att.fileData) return;

    if (att.fileData.startsWith('data:')) {
      try {
        const parts = att.fileData.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : att.mimeType || 'application/octet-stream';
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = att.fileName || `${att.title}.${att.fileType}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      } catch (err) {
        const a = document.createElement('a');
        a.href = att.fileData;
        a.download = att.fileName || `${att.title}.${att.fileType}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } else {
      const a = document.createElement('a');
      a.href = att.fileData;
      a.download = att.fileName || `${att.title}.${att.fileType}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDossierAttachment(id);
    setDeletingId(null);
    await loadData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    await updateDossierAttachment(editingItem.id, {
      title: editingItem.title,
      docType: editingItem.docType,
      documentDate: editingItem.documentDate,
      description: editingItem.description,
      examYear: editingItem.examYear
    });

    setEditingItem(null);
    await loadData();
  };

  // Filtered by category
  const filteredList = attachments.filter(a => {
    if (activeCategory === 'all') return true;
    return a.docType === activeCategory;
  });

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 dark:border-teal-950 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-teal-900 dark:text-teal-300 flex items-center gap-2">
              <span>پیوست اسناد و مدارک پزشکی معاینات</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-teal-700 text-white">
                {activeExamYear === 'all' ? `${counts.total} سند کل` : `${attachments.length} سند سال ${activeExamYear}`}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              آرشیو فایل‌های PDF، تصاویر آزمایشات، نوار قلب، اسپیرومتری و کارت سلامت به تفکیک سال معاینه
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowUploadForm(!showUploadForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
            showUploadForm
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          {showUploadForm ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>انصراف</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن سند جدید</span>
            </>
          )}
        </button>
      </div>

      {/* Upload Form Box */}
      {showUploadForm && (
        <form
          onSubmit={handleUploadSubmit}
          className="p-4 rounded-2xl bg-teal-50/50 dark:bg-[#1a2936] border border-teal-200 dark:border-teal-800/80 space-y-3.5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-extrabold text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-teal-600" />
              <span>بارگذاری مدرک یا آزمایش جدید (PDF، تصویر)</span>
            </h5>
            <span className="text-[10px] text-slate-400">حداکثر حجم: ۱۵ مگابایت</span>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-teal-500 bg-teal-100/60 dark:bg-teal-950/60'
                : selectedFile
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-teal-400 bg-white dark:bg-[#141e28]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  {selectedFile.name.toLowerCase().endsWith('.pdf') ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-800 dark:text-white font-mono">{selectedFile.name}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    حجم: {formatFileSize(selectedFile.size)} • آماده ذخیره‌سازی
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <UploadCloud className="w-7 h-7 mx-auto mb-1.5 text-teal-600 opacity-80" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  فایل را اینجا بکشید یا برای انتخاب کلیک کنید
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  پشتیبانی از فایل‌های <b className="text-teal-600">PDF</b> و تصاویر <b className="text-teal-600">JPG, PNG, WEBP</b>
                </p>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Title */}
            <div className="lg:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                عنوان سند / آزمایش <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="مثال: جواب آزمایش خون و کلسترول ۱۴۰۴"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141e28] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                required
              />
            </div>

            {/* Exam Year */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                سال معاینه مربوطه <span className="text-rose-500">*</span>
              </label>
              <select
                value={examYear}
                onChange={e => setExamYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141e28] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>سال {y}</option>
                ))}
              </select>
            </div>

            {/* Document Date */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                تاریخ انجام / صدور
              </label>
              <input
                type="text"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                placeholder="۱۴۰۴/۰۲/۱۵"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141e28] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
              />
            </div>

            {/* Doc Type */}
            <div className="lg:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                نوع و دسته‌بندی سند
              </label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as DossierDocType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141e28] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              >
                {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="lg:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                توضیحات تکمیلی (اختیاری)
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="توضیحات یا یادداشت پزشک..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141e28] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              />
            </div>
          </div>

          {uploadError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-100 dark:border-teal-900/60">
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'در حال ذخیره‌سازی...' : 'پیوست به پرونده'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Pills */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            همه ({attachments.length})
          </button>
          {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => {
            const count = attachments.filter(a => a.docType === k).length;
            if (count === 0) return null;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActiveCategory(k)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  activeCategory === k
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
                <span className="font-mono text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Attachments Grid / List */}
      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">
          در حال دریافت اسناد پیوست...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {activeExamYear === 'all'
              ? 'هیچ سندی برای این پرسنل پیوست نشده است.'
              : `هیچ سندی برای دوره معاینه سال ${activeExamYear} پیوست نشده است.`}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            جهت افزودن جواب آزمایشات، نوار قلب، عکس رادیولوژی، اسپیرومتری یا کارت سلامت روی دکمه «افزودن سند جدید» کلیک کنید.
          </p>
          {!showUploadForm && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن اولین سند</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredList.map(att => {
            const cfg = DOC_TYPE_CONFIG[att.docType] || DOC_TYPE_CONFIG.other;
            const isPdf = att.fileType === 'pdf';

            return (
              <div
                key={att.id}
                className="p-3 rounded-2xl bg-slate-50/80 dark:bg-[#141f2a] border border-slate-200/90 dark:border-slate-800/80 hover:border-teal-300 dark:hover:border-teal-700 transition-all flex flex-col justify-between gap-2 shadow-xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      onClick={() => setPreviewItem(att)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer ${
                        isPdf
                          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                          : 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-slate-800 dark:text-white truncate cursor-pointer hover:text-teal-600" onClick={() => setPreviewItem(att)}>
                          {att.title}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/60">
                          سال {att.examYear}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${cfg.bg} ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <span className="font-mono">{att.fileSizeFormatted}</span>
                        {att.documentDate && <span>تاریخ: {att.documentDate}</span>}
                      </div>

                      {att.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                          {att.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                    {att.fileName}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(att)}
                      title="پیش‌نمایش سند"
                      className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(att)}
                      title="دانلود فایل"
                      className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingItem(att)}
                      title="ویرایش مشخصات"
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingId(att.id)}
                      title="حذف سند"
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <form
            onSubmit={handleUpdate}
            className="bg-white dark:bg-[#16202a] rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5"
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-teal-600" />
                <span>ویرایش مشخصات سند پیوست</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  عنوان سند
                </label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    سال معاینه
                  </label>
                  <select
                    value={editingItem.examYear}
                    onChange={e => setEditingItem({ ...editingItem, examYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>سال {y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    تاریخ سند
                  </label>
                  <input
                    type="text"
                    value={editingItem.documentDate || ''}
                    onChange={e => setEditingItem({ ...editingItem, documentDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  دسته‌بندی سند
                </label>
                <select
                  value={editingItem.docType}
                  onChange={e => setEditingItem({ ...editingItem, docType: e.target.value as DossierDocType })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs"
                >
                  {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  توضیحات
                </label>
                <textarea
                  rows={2}
                  value={editingItem.description || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                ذخیره تغییرات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#16202a] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-right" dir="rtl">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white text-center">
              حذف فایل پیوست
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              آیا از حذف این فایل پیوست از پرونده پرسنل اطمینان دارید؟ این عملیات قابل بازگشت نیست.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                تایید و حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <DossierFilePreviewModal
        attachment={previewItem}
        onClose={() => setPreviewItem(null)}
        onDownload={handleDownload}
      />
    </div>
  );
};
export default DossierAttachmentManager;

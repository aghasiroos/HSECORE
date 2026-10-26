import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Download, 
  Check, 
  AlertCircle, 
  File, 
  Image as ImageIcon,
  Paperclip
} from 'lucide-react';
import { DossierAttachmentItem } from '../../types/personnelDossierTypes';
import { personnelDossierService } from '../../services/personnelDossierService';

interface PersonnelDossierAttachmentsModalProps {
  personnelCode: string;
  personnelName: string;
  isFa: boolean;
  currentUser?: any;
  onClose: () => void;
  onUpdated: () => void;
  existingAttachments: DossierAttachmentItem[];
}

export default function PersonnelDossierAttachmentsModal({
  personnelCode,
  personnelName,
  isFa,
  currentUser,
  onClose,
  onUpdated,
  existingAttachments
}: PersonnelDossierAttachmentsModalProps) {
  const [attachments, setAttachments] = useState<DossierAttachmentItem[]>(existingAttachments);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [category, setCategory] = useState<DossierAttachmentItem['category']>('CERTIFICATE');
  const [description, setDescription] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChosen = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(isFa ? 'حجم فایل نمی‌تواند بیشتر از ۵ مگابایت باشد.' : 'File size cannot exceed 5MB.');
      return;
    }
    setErrorMsg('');
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setFileDataUrl(e.target?.result as string || '');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setErrorMsg(isFa ? 'لطفاً ابتدا یک فایل انتخاب یا رها کنید.' : 'Please choose a file first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const todayFa = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const newItem = personnelDossierService.addAttachment({
        personnelCode,
        fileName: selectedFile.name,
        fileType: selectedFile.type || 'application/octet-stream',
        category,
        fileSize: selectedFile.size,
        uploadDate: todayFa,
        uploadedBy: currentUser?.fullName || currentUser?.username || 'کاربر سیستم',
        dataUrl: fileDataUrl,
        description
      });

      setAttachments(prev => [newItem, ...prev]);
      setSelectedFile(null);
      setFileDataUrl('');
      setDescription('');
      onUpdated();
    } catch (e: any) {
      setErrorMsg(e.message || 'خطا در بارگذاری فایل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm(isFa ? 'آیا از حذف این فایل پیوست اطمینان دارید؟' : 'Are you sure you want to delete this attachment?')) {
      personnelDossierService.deleteAttachment(id);
      setAttachments(prev => prev.filter(a => a.id !== id));
      onUpdated();
    }
  };

  const getCategoryTitle = (cat: DossierAttachmentItem['category']) => {
    switch (cat) {
      case 'NATIONAL_ID': return 'کارت ملی / شناسنامه';
      case 'MEDICAL_CARD': return 'کارت بهداشت و طب کار';
      case 'DIPLOMA': return 'دانشنامه و مدرک تحصیلی';
      case 'CERTIFICATE': return 'گواهینامه آموزشی و صلاحیت';
      case 'CONTRACT': return 'قرارداد و احکام شغلی';
      default: return 'سایر مدارک';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">
                {isFa ? 'مدیریت اسناد، مدارک و پیوست‌های پرونده' : 'Personnel Dossier Attachments'}
              </h3>
              <p className="text-xs text-slate-400">
                {personnelName} (کد: {personnelCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-100">
          {/* Upload Area with Drag & Drop */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              {isFa ? 'بارگذاری سند جدید (پشتیبانی از هر دو حالت کشیدن و رها کردن یا کلیک):' : 'Upload New Attachment:'}
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChosen(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-8 h-8 text-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {selectedFile 
                  ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` 
                  : (isFa ? 'فایل را اینجا بکشید یا برای انتخاب کلیک کنید' : 'Drag file here or click to select')}
              </span>
              <span className="text-[11px] text-slate-400">
                فرمت‌های مجاز: PDF، JPG، PNG، Word (حداکثر ۵ مگابایت)
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Inputs for Category & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {isFa ? 'دسته‌بندی سند:' : 'Document Category:'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CERTIFICATE">گواهینامه آموزشی و صلاحیت</option>
                  <option value="MEDICAL_CARD">کارت بهداشت و طب کار</option>
                  <option value="NATIONAL_ID">کارت ملی و شناسنامه</option>
                  <option value="DIPLOMA">دانشنامه و مدارک تحصیلی</option>
                  <option value="CONTRACT">قرارداد و احکام شغلی</option>
                  <option value="OTHER">سایر مدارک و پیوست‌ها</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {isFa ? 'توضیحات تکمیلی:' : 'Notes / Description:'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isFa ? 'مثال: گواهینامه معتبر تا پایان سال ۱۴۰۵...' : 'e.g. Valid until...'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-blue-500/20"
              >
                <Check className="w-4 h-4" />
                <span>{isFa ? 'ذخیره و پیوست به پرونده' : 'Save & Attach to Dossier'}</span>
              </button>
            )}
          </div>

          {/* List of Existing Attachments */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{isFa ? 'مدارک پیوست‌شده موجود' : 'Existing Attached Documents'}</span>
              <span className="text-[11px] font-mono text-slate-400">{attachments.length} مورد</span>
            </h4>

            {attachments.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        {att.fileType.includes('image') ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                          {att.fileName}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold">
                            {getCategoryTitle(att.category)}
                          </span>
                          <span>{att.uploadDate}</span>
                          <span>({Math.round(att.fileSize / 1024)} KB)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.fileName}
                          className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                          title="دانلود فایل"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(att.id)}
                        className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-600 dark:text-rose-400 flex items-center justify-center transition cursor-pointer"
                        title="حذف پیوست"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                {isFa ? 'هیچ سند یا مدرک پیوستی برای این پرسنل ثبت نشده است.' : 'No attachments found.'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

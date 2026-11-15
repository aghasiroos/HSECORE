import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  Download,
  Eye,
  Trash2,
  Star,
  AlertTriangle,
  Paperclip,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import moment from 'moment-jalaali';
import { toast } from 'react-hot-toast';
import { apiDb } from '../../../services/apiDatabaseClient';
import PdfDocumentViewer from '../../health-env/components/PdfDocumentViewer';
import { formatFileSize } from '../../../utils/fileHelpers';
import { sdsApi } from '../sdsApi';
import { SdsAttachmentItem, SdsAttachmentRole, SdsRecordItem } from '../types';
import { ATTACHMENT_ROLE_LABELS } from '../constants';

interface SdsAttachmentsModalProps {
  record: SdsRecordItem | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isFa: boolean;
  language: 'fa' | 'en';
  onClose: () => void;
  onRecordUpdated: (updated: SdsRecordItem) => void;
}

export const SdsAttachmentsModal: React.FC<SdsAttachmentsModalProps> = ({
  record,
  canCreate,
  canEdit,
  canDelete,
  isFa,
  language,
  onClose,
  onRecordUpdated,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentRole, setAttachmentRole] = useState<SdsAttachmentRole>('PRIMARY_SDS_PDF');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SdsAttachmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview state
  const [previewAtt, setPreviewAtt] = useState<{
    att: SdsAttachmentItem;
    blobUrl: string | null;
    loading: boolean;
    error?: string | null;
  } | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const activeBlobRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
    };
  }, []);

  if (!record) return null;

  const validateFile = (f: File): boolean => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'doc', 'xlsx', 'xls'];
    if (!allowedExts.includes(ext)) {
      toast.error(
        isFa
          ? 'فرمت فایل مجاز نیست. فرمت‌های مجاز: PDF، JPG، PNG، WEBP، Word و Excel'
          : 'Unsupported file format.'
      );
      return false;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error(isFa ? 'حجم فایل نباید بیشتر از ۲۵ مگابایت باشد.' : 'Max 25MB exceeded.');
      return false;
    }
    return true;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error(isFa ? 'ابتدا یک فایل انتخاب نمایید.' : 'Select a file first.');
      return;
    }
    setUploading(true);
    try {
      await sdsApi.uploadAttachment(record.id, {
        file: selectedFile,
        attachmentRole,
        title: title.trim() || selectedFile.name,
        notes: notes.trim(),
        isPrimary: attachmentRole === 'PRIMARY_SDS_PDF',
      });
      const refreshed = await sdsApi.getById(record.id);
      onRecordUpdated(refreshed);
      setSelectedFile(null);
      setTitle('');
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(isFa ? 'فایل پیوست با موفقیت بارگذاری و متصل شد.' : 'Attachment uploaded.');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بارگذاری پیوست');
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = async (att: SdsAttachmentItem) => {
    if (att.mimeType !== 'application/pdf') {
      toast.error(isFa ? 'فایل اصلی SDS باید با فرمت PDF باشد.' : 'Primary SDS file must be PDF.');
      return;
    }
    try {
      const updated = await sdsApi.setPrimaryAttachment(record.id, att.id);
      onRecordUpdated(updated);
      toast.success(isFa ? 'به عنوان فایل اصلی SDS انتخاب شد.' : 'Set as primary SDS PDF.');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بروزرسانی');
    }
  };

  const handleDeleteAttachment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const updated = await sdsApi.deleteAttachment(record.id, deleteTarget.id);
      onRecordUpdated(updated);
      if (previewAtt?.att.id === deleteTarget.id) {
        setPreviewAtt(null);
      }
      setDeleteTarget(null);
      toast.success(isFa ? 'فایل پیوست حذف شد (رکورد اصلی ماده شیمیایی حفظ گردید).' : 'Attachment deleted.');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در حذف پیوست');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenPreview = async (att: SdsAttachmentItem) => {
    setImageZoom(1);
    setImageRotation(0);
    setPreviewAtt({ att, blobUrl: null, loading: true, error: null });
    const blobUrl = await apiDb.fetchFileBlobUrl(att.fileId, att.mimeType);
    if (activeBlobRef.current && activeBlobRef.current !== blobUrl) {
      URL.revokeObjectURL(activeBlobRef.current);
    }
    activeBlobRef.current = blobUrl;

    if (!blobUrl) {
      setPreviewAtt({
        att,
        blobUrl: null,
        loading: false,
        error: isFa ? 'فایل در سرور قابل بارگذاری نبود.' : 'Could not load preview.',
      });
      return;
    }
    setPreviewAtt({ att, blobUrl, loading: false, error: null });
  };

  const handleDownload = async (att: SdsAttachmentItem) => {
    const tid = toast.loading(isFa ? 'در حال دریافت فایل...' : 'Downloading...');
    const ok = await apiDb.downloadFileById(att.fileId, att.originalName);
    toast.dismiss(tid);
    if (ok) toast.success(isFa ? 'فایل دانلود شد.' : 'Downloaded.');
    else toast.error(isFa ? 'خطا در دانلود فایل' : 'Download failed');
  };

  return (
    <div className="fixed inset-0 z-[10055] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Paperclip className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 truncate">
                {isFa
                  ? `مدیریت فایل‌ها و مستندات پیوست SDS: ${record.materialNameFa}`
                  : `SDS Attachments: ${record.materialNameEn}`}
              </h3>
              <p className="text-[11px] font-bold text-slate-500 truncate">
                کد مدرک: <span className="font-mono">{record.documentNumber}</span> • CAS:{' '}
                <span className="font-mono">{record.casNumber || '-'}</span> •{' '}
                {record.attachmentCount} فایل پیوست
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Upload Form */}
          {canCreate && (
            <form
              onSubmit={handleUpload}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" />
                <span>{isFa ? 'افزودن فایل جدید (SDS اصلی PDF، دیتاشیت فنی، COA، دستورالعمل انبارش...)' : 'Upload New Attachment'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    {isFa ? 'نوع / نقش فایل پیوست' : 'Attachment Role'}
                  </label>
                  <select
                    value={attachmentRole}
                    onChange={(e) => setAttachmentRole(e.target.value as SdsAttachmentRole)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    {Object.entries(ATTACHMENT_ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {isFa ? v.fa : v.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    {isFa ? 'عنوان فایل' : 'Title'}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isFa ? 'مثلاً: برگه SDS سازنده BASF نسخه ۲۰۲۴' : 'Optional title'}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    {isFa ? 'توضیحات کوتاه' : 'Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isFa ? 'اختیاری' : 'Optional'}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && validateFile(f)) setSelectedFile(f);
                      else if (f) e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl border border-dashed border-sky-400 hover:border-sky-600 bg-white dark:bg-slate-900 text-xs font-bold text-sky-700 dark:text-sky-300 cursor-pointer"
                  >
                    {selectedFile
                      ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                      : isFa
                      ? 'انتخاب فایل از سیستم (PDF، تصویر، Word، Excel — حداکثر ۲۵ مگابایت)'
                      : 'Select File (max 25MB)'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? (isFa ? 'در حال بارگذاری...' : 'Uploading...') : isFa ? 'بارگذاری و الصاق فایل' : 'Upload'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Attachments List */}
          <div className="space-y-2.5">
            {record.attachments.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500">
                {isFa
                  ? 'هنوز هیچ فایل پیوستی برای این ماده شیمیایی بارگذاری نشده است.'
                  : 'No attachments uploaded yet.'}
              </div>
            ) : (
              record.attachments.map((att) => {
                const roleMeta = ATTACHMENT_ROLE_LABELS[att.attachmentRole] || ATTACHMENT_ROLE_LABELS.OTHER;
                const isPreviewable =
                  att.mimeType === 'application/pdf' ||
                  att.mimeType.startsWith('image/') ||
                  att.originalName.toLowerCase().endsWith('.pdf');

                return (
                  <div
                    key={att.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      att.isPrimary
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                            {att.title || att.originalName}
                          </span>
                          {att.isPrimary && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              <span>فایل اصلی SDS</span>
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            {isFa ? roleMeta.fa : roleMeta.en}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold flex flex-wrap items-center gap-3">
                          <span className="font-mono">{att.originalName}</span>
                          <span className="font-mono tabular-nums">{formatFileSize(att.fileSize)}</span>
                          <span>{att.uploadedBy}</span>
                          <span className="font-mono">
                            {moment(att.createdAt).format('jYYYY/jMM/jDD HH:mm')}
                          </span>
                        </div>
                        {att.notes && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                            {att.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {isPreviewable && (
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(att)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isFa ? 'پیش‌نمایش' : 'Preview'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(att)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isFa ? 'دانلود' : 'Download'}</span>
                      </button>
                      {canEdit && !att.isPrimary && att.mimeType === 'application/pdf' && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(att)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>{isFa ? 'تنظیم به عنوان اصلی' : 'Set Primary'}</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(att)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-600 cursor-pointer"
                          title={isFa ? 'حذف پیوست' : 'Delete Attachment'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Inline File Preview Sub-Modal */}
      {previewAtt && (
        <div className="fixed inset-0 z-[10065] bg-slate-950/85 backdrop-blur-xs flex flex-col p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden max-w-6xl w-full mx-auto shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900">
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                  {previewAtt.att.title || previewAtt.att.originalName}
                </h4>
                <div className="text-[11px] text-slate-500 font-bold">
                  {record.materialNameFa} ({record.documentNumber})
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewAtt.att.mimeType.startsWith('image/') && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button type="button" onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="p-1.5 rounded-lg hover:bg-white cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setImageZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="p-1.5 rounded-lg hover:bg-white cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setImageRotation((r) => (r + 90) % 360)} className="p-1.5 rounded-lg hover:bg-white cursor-pointer"><RotateCw className="w-4 h-4" /></button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDownload(previewAtt.att)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isFa ? 'دانلود' : 'Download'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAtt(null)}
                  className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-600 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center">
              {previewAtt.loading ? (
                <div className="text-xs font-bold text-slate-300">در حال بارگذاری پیش‌نمایش...</div>
              ) : previewAtt.blobUrl ? (
                previewAtt.att.mimeType === 'application/pdf' ||
                previewAtt.att.originalName.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-full">
                    <PdfDocumentViewer
                      fileId={previewAtt.att.fileId}
                      fileData={previewAtt.blobUrl}
                      fileName={previewAtt.att.originalName}
                      displayName={`${record.materialNameFa} — ${previewAtt.att.originalName}`}
                      language={language}
                      onDownload={() => handleDownload(previewAtt.att)}
                    />
                  </div>
                ) : (
                  <img
                    src={previewAtt.blobUrl}
                    alt={previewAtt.att.originalName}
                    style={{ transform: `scale(${imageZoom}) rotate(${imageRotation}deg)` }}
                    className="max-w-full max-h-full object-contain rounded-lg transition-transform"
                  />
                )
              ) : (
                <div className="p-6 text-center text-xs font-bold text-rose-400">
                  {previewAtt.error || 'خطا در نمایش فایل'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Attachment Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10070] bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'تأیید حذف فایل پیوست' : 'Confirm Attachment Deletion'}
              </h4>
              <p className="text-xs text-slate-500 font-bold">
                {isFa
                  ? `آیا از حذف فایل «${deleteTarget.originalName}» اطمینان دارید؟ (اطلاعات اصلی برگه SDS حفظ خواهد شد)`
                  : `Delete attachment "${deleteTarget.originalName}"?`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAttachment}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                {deleting ? 'در حال حذف...' : isFa ? 'بله، حذف شود' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

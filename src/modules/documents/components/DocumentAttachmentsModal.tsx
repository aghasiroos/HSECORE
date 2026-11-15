import React, { useState, useRef } from 'react';
import {
  X,
  Paperclip,
  Upload,
  Eye,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import moment from 'moment-jalaali';
import { toast } from 'react-hot-toast';
import { apiDb } from '../../../services/apiDatabaseClient';
import { formatFileSize } from '../../../utils/fileHelpers';
import {
  ATTACHMENT_ROLES_BY_CATEGORY,
  DocumentExtraAttachmentItem,
  HseDocumentItem,
} from '../types';

interface DocumentAttachmentsModalProps {
  doc: HseDocumentItem | null;
  canUpload: boolean;
  canDelete: boolean;
  isFa: boolean;
  onClose: () => void;
  onUpdated: (updated: HseDocumentItem) => void;
  onPreviewFile: (
    fileId: string,
    originalName: string,
    mimeType: string,
    title: string
  ) => void;
  onDownloadFile: (fileId: string, originalName: string) => void;
}

export const DocumentAttachmentsModal: React.FC<DocumentAttachmentsModalProps> = ({
  doc,
  canUpload,
  canDelete,
  isFa,
  onClose,
  onUpdated,
  onPreviewFile,
  onDownloadFile,
}) => {
  const roles = doc
    ? ATTACHMENT_ROLES_BY_CATEGORY[doc.category] || ATTACHMENT_ROLES_BY_CATEGORY.OTHER_HSE_DOCS
    : ATTACHMENT_ROLES_BY_CATEGORY.OTHER_HSE_DOCS;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [role, setRole] = useState<string>(roles[0]?.id || 'OTHER');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentExtraAttachmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!doc) return null;

  const extraList = doc.extraAttachments || [];

  const getRoleLabel = (rId: string) => {
    const found = roles.find((r) => r.id === rId);
    return found ? (isFa ? found.fa : found.en) : rId;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error(isFa ? 'لطفاً حداقل یک فایل انتخاب کنید.' : 'Select at least one file.');
      return;
    }

    setUploading(true);
    let latestDoc: HseDocumentItem = doc;
    let uploadedCount = 0;
    try {
      for (const file of selectedFiles) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`حجم فایل «${file.name}» بیش از ۲۵ مگابایت است.`);
          continue;
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('role', role);
        fd.append(
          'title',
          selectedFiles.length === 1 && title.trim() ? title.trim() : file.name
        );

        const res = await apiDb.addDocumentAttachment(doc.documentId, fd);
        if (res.success && res.data) {
          latestDoc = res.data;
          uploadedCount++;
        } else {
          toast.error(res.error || `خطا در بارگذاری فایل ${file.name}`);
        }
      }

      if (uploadedCount > 0) {
        toast.success(
          isFa
            ? `${uploadedCount} فایل پیوست با موفقیت به سند اضافه شد.`
            : `${uploadedCount} attachment(s) uploaded.`
        );
        setSelectedFiles([]);
        setTitle('');
        if (inputRef.current) inputRef.current.value = '';
        onUpdated(latestDoc);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDeleteAttachment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiDb.deleteDocumentAttachment(doc.documentId, deleteTarget.fileId);
      if (res.success && res.data) {
        toast.success(isFa ? 'فایل پیوست با موفقیت حذف شد.' : 'Attachment deleted.');
        setDeleteTarget(null);
        onUpdated(res.data);
      } else {
        toast.error(res.error || 'خطا در حذف پیوست');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10055] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Paperclip className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {isFa ? 'مدیریت فایل‌های پیوست و مستندات تکمیلی' : 'Document Attachments'}
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                {doc.title} · <span className="font-mono">{doc.documentNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload New Attachments */}
        {canUpload && (
          <form
            onSubmit={handleUpload}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'نوع فایل پیوست' : 'Attachment Role'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {isFa ? r.fa : r.en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'عنوان توضیحی فایل (اختیاری)' : 'Title (Optional)'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isFa ? 'مثلاً: گزارش آزمون غیرمخرب / فرم تکمیل‌شده واحد الفین' : 'Optional title'}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSelectedFiles(files);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex-1 py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-500 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-sky-600" />
                <span>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} فایل انتخاب شد (${selectedFiles.map((f) => f.name).join('، ')})`
                    : isFa
                    ? 'انتخاب یک یا چند فایل (PDF، Word، Excel، تصویر)'
                    : 'Choose file(s)'}
                </span>
              </button>

              <button
                type="submit"
                disabled={uploading || selectedFiles.length === 0}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                {uploading
                  ? isFa
                    ? 'در حال بارگذاری...'
                    : 'Uploading...'
                  : isFa
                  ? 'افزودن پیوست'
                  : 'Upload'}
              </button>
            </div>
          </form>
        )}

        {/* List of Extra Attachments */}
        <div className="space-y-2 max-h-[45vh] overflow-y-auto">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {isFa
              ? `فایل‌های پیوست‌شده (${extraList.length} مورد)`
              : `Attached Files (${extraList.length})`}
          </div>

          {extraList.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              {isFa
                ? 'علاوه بر فایل اصلی مستند، هنوز فایل پیوست دیگری بارگذاری نشده است.'
                : 'No supplementary attachments uploaded yet.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {extraList.map((att) => {
                const canPreview =
                  att.mimeType === 'application/pdf' ||
                  att.mimeType.startsWith('image/') ||
                  att.originalName.toLowerCase().endsWith('.pdf');
                return (
                  <div
                    key={att.fileId}
                    className="p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {att.title || att.originalName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-medium text-sky-700 dark:text-sky-400">
                            {getRoleLabel(att.role)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[180px]">{att.originalName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatFileSize(att.fileSize)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {moment(att.createdAt).format('jYYYY/jMM/jDD')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canPreview && (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewFile(
                              att.fileId,
                              att.originalName,
                              att.mimeType,
                              att.title || att.originalName
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isFa ? 'مشاهده' : 'Preview'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDownloadFile(att.fileId, att.originalName)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isFa ? 'دانلود' : 'Download'}</span>
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(att)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 cursor-pointer"
                          title={isFa ? 'حذف فایل پیوست' : 'Delete Attachment'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm Delete Attachment */}
        {deleteTarget && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs font-bold text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>
                {isFa
                  ? `آیا از حذف فایل پیوست «${deleteTarget.originalName}» اطمینان دارید؟ (سند اصلی حفظ می‌شود)`
                  : `Delete attachment "${deleteTarget.originalName}"?`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDeleteAttachment}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                {deleting ? '...' : isFa ? 'حذف پیوست' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentAttachmentsModal;

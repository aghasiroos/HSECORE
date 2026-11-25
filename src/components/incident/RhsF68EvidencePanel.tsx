import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Film,
  Download,
  Eye,
  Trash2,
  X,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { RhsF68AttachmentItem } from '../../types';
import { apiDb } from '../../services/apiDatabaseClient';

interface RhsF68EvidencePanelProps {
  entityId: string;
  attachments: RhsF68AttachmentItem[];
  onChange?: (updated: RhsF68AttachmentItem[]) => void;
  readOnly?: boolean;
  isFa?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const RhsF68EvidencePanel: React.FC<RhsF68EvidencePanelProps> = ({
  entityId,
  attachments,
  onChange,
  readOnly = false,
  isFa = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<{
    item: RhsF68AttachmentItem;
    blobUrl: string | null;
    loading: boolean;
  } | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  // Load authenticated blob thumbnails for attached images cleanly and revoke on unmount
  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];

    const loadThumbnails = async () => {
      for (const att of attachments) {
        if (!att?.fileId || !att.mimeType?.startsWith('image/')) continue;
        if (thumbnailUrls[att.fileId]) continue;
        const url = await apiDb.fetchFileBlobUrl(att.fileId, att.mimeType);
        if (url) {
          if (active) {
            createdUrls.push(url);
            setThumbnailUrls((prev) => ({ ...prev, [att.fileId]: url }));
          } else {
            URL.revokeObjectURL(url);
          }
        }
      }
    };

    loadThumbnails();
    return () => {
      active = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [attachments]);

  // Cleanup preview blob URL on close
  const closePreview = () => {
    if (previewItem?.blobUrl) {
      URL.revokeObjectURL(previewItem.blobUrl);
    }
    setPreviewItem(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const nextList = [...attachments];

    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(isFa ? `حجم فایل "${file.name}" بیش از ۲۵ مگابایت است.` : `File "${file.name}" exceeds 25MB.`);
          continue;
        }
        const saved = await apiDb.uploadEntityFile('INCIDENT', entityId || `TEMP-${Date.now()}`, file);
        if (saved?.fileId) {
          nextList.push({
            fileId: saved.fileId,
            originalName: saved.originalName || file.name,
            mimeType: saved.mimeType || file.type,
            fileSize: saved.fileSize || file.size,
            fileUrl: saved.fileUrl,
            uploadedAt: saved.createdAt || new Date().toISOString(),
            uploadedBy: saved.uploadedBy,
          });
        }
      }
      onChange?.(nextList);
      toast.success(isFa ? 'فایل(های) شاهد با موفقیت بارگذاری و ثبت شدند.' : 'Evidence uploaded successfully.');
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در بارگذاری فایل' : 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleOpenPreview = async (item: RhsF68AttachmentItem) => {
    setPreviewItem({ item, blobUrl: null, loading: true });
    if (item.mimeType === 'application/pdf') {
      const rendered = await apiDb.fetchPdfPageImageUrl(item.fileId, 1);
      if (rendered?.url) {
        setPreviewItem({ item, blobUrl: rendered.url, loading: false });
        return;
      }
    }
    const url = await apiDb.fetchFileBlobUrl(item.fileId, item.mimeType);
    setPreviewItem({ item, blobUrl: url, loading: false });
  };

  const handleRemove = (fileId: string) => {
    const filtered = attachments.filter((a) => a.fileId !== fileId);
    onChange?.(filtered);
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <label className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition cursor-pointer">
          <div className="flex items-center gap-3 text-right">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                {uploading
                  ? isFa
                    ? 'در حال بارگذاری و اعتبارسنجی امنیتی فایل...'
                    : 'Uploading...'
                  : isFa
                  ? 'افزودن عکس، فیلم یا مستندات شاهد (حداکثر ۲۵ مگابایت)'
                  : 'Upload Photos, Videos, or Evidence Documents (Max 25MB)'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isFa
                  ? 'فرمت‌های مجاز: JPG، PNG، WEBP، ویدیو (MP4 / WebM / MOV)، PDF، Word و Excel'
                  : 'Supported: JPG, PNG, WEBP, MP4, WebM, MOV, PDF, DOCX, XLSX'}
              </p>
            </div>
          </div>
          <span className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
            {isFa ? 'انتخاب فایل' : 'Select Files'}
          </span>
          <input
            type="file"
            multiple
            disabled={uploading}
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,.docx,.doc,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      )}

      {attachments.length === 0 ? (
        <div className="p-6 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs text-slate-500">
          <Paperclip className="w-6 h-6 mx-auto mb-1.5 text-slate-400" />
          {isFa ? 'هیچ فایل یا مدرکی برای این گزارش پیوست نشده است.' : 'No evidence files attached yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {attachments.map((att) => {
            const isImg = att.mimeType?.startsWith('image/');
            const isVideo = att.mimeType?.startsWith('video/');
            const thumb = thumbnailUrls[att.fileId];

            return (
              <div
                key={att.fileId}
                className="flex flex-col justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 gap-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {isImg && thumb ? (
                      <img src={thumb} alt={att.originalName} className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <Film className="w-5 h-5 text-purple-600" />
                    ) : isImg ? (
                      <ImageIcon className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={att.originalName}>
                      {att.originalName}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {formatBytes(att.fileSize)} • {isVideo ? 'Video' : isImg ? 'Image' : 'Document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(att)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isFa ? 'پیش‌نمایش' : 'Preview'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => apiDb.downloadFileById(att.fileId, att.originalName)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isFa ? 'دریافت' : 'Download'}</span>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemove(att.fileId)}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title={isFa ? 'حذف پیوست' : 'Remove'}
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

      {previewItem &&
        createPortal(
          <div className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                  {previewItem.item.originalName}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => apiDb.downloadFileById(previewItem.item.fileId, previewItem.item.originalName)}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isFa ? 'دانلود' : 'Download'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 min-h-[320px]">
                {previewItem.loading ? (
                  <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{isFa ? 'در حال بارگذاری پیش‌نمایش...' : 'Loading preview...'}</span>
                  </div>
                ) : !previewItem.blobUrl ? (
                  <div className="text-center space-y-2 text-xs text-slate-500">
                    <p>{isFa ? 'پیش‌نمایش مستقیم برای این فرمت در دسترس نیست. می‌توانید فایل را دریافت کنید.' : 'Direct preview unavailable. Please download the file.'}</p>
                  </div>
                ) : previewItem.item.mimeType?.startsWith('video/') ? (
                  <video controls autoPlay className="max-h-[72vh] w-full rounded-xl bg-black">
                    <source src={previewItem.blobUrl} type={previewItem.item.mimeType} />
                  </video>
                ) : (
                  <img
                    src={previewItem.blobUrl}
                    alt={previewItem.item.originalName}
                    className="max-h-[72vh] max-w-full object-contain rounded-xl"
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

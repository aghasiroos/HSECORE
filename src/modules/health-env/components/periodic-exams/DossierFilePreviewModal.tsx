import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Calendar,
  Tag,
  Info,
  Maximize2,
  ExternalLink
} from 'lucide-react';
import { DossierAttachment, DOC_TYPE_CONFIG } from './dossierAttachmentStorage';
import PdfDocumentViewer from '../PdfDocumentViewer';

interface Props {
  attachment: DossierAttachment | null;
  onClose: () => void;
  onDownload: (att: DossierAttachment) => void;
}

export const DossierFilePreviewModal: React.FC<Props> = ({
  attachment,
  onClose,
  onDownload
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setZoom(100);
    setRotation(0);

    if (attachment?.fileData) {
      if (attachment.fileData.startsWith('data:')) {
        try {
          const parts = attachment.fileData.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : attachment.mimeType || 'application/octet-stream';
          const byteCharacters = atob(parts[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mime });
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);

          return () => {
            URL.revokeObjectURL(url);
          };
        } catch {
          setBlobUrl(attachment.fileData);
        }
      } else {
        setBlobUrl(attachment.fileData);
      }
    } else {
      setBlobUrl(null);
    }
  }, [attachment]);

  if (!attachment) return null;

  const isPdf = attachment.fileType === 'pdf' || attachment.fileName.toLowerCase().endsWith('.pdf');
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(attachment.fileType) ||
    /\.(jpg|jpeg|png|webp)$/i.test(attachment.fileName);

  const docConfig = DOC_TYPE_CONFIG[attachment.docType] || DOC_TYPE_CONFIG.other;

  const handlePrint = () => {
    if (isImage && blobUrl) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${attachment.title}</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
                img { max-width: 95%; max-height: 95vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${blobUrl}" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else if (blobUrl) {
      const w = window.open(blobUrl, '_blank');
      if (w) w.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-[#16202a] rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#1a2632]/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">{docConfig.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-800 dark:text-white text-sm truncate">
                  {attachment.title}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300">
                  سال معاینه: {attachment.examYear}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${docConfig.bg} ${docConfig.color}`}>
                  {docConfig.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                <span>فایل: <span className="font-mono text-slate-500">{attachment.fileName}</span></span>
                <span>حجم: <span className="font-mono">{attachment.fileSizeFormatted}</span></span>
                {attachment.documentDate && <span>تاریخ: {attachment.documentDate}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl p-1 text-slate-700 dark:text-slate-300">
                <button
                  onClick={() => setZoom(z => Math.max(50, z - 25))}
                  title="کوچک‌نمایی"
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-1">{zoom}٪</span>
                <button
                  onClick={() => setZoom(z => Math.min(250, z + 25))}
                  title="بزرگ‌نمایی"
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  title="چرخش ۹۰ درجه"
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => onDownload(attachment)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">دانلود</span>
            </button>

            <button
              onClick={handlePrint}
              title="چاپ سند"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                title="باز کردن در برگه جدید"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className={`flex-1 bg-slate-900/95 relative overflow-hidden flex min-h-0 ${isPdf ? 'p-0' : 'items-center justify-center p-4 select-none'}`}>
          {isPdf ? (
            attachment.fileData || blobUrl ? (
              <div className="w-full h-full flex flex-col min-h-0">
                <PdfDocumentViewer
                  fileData={attachment.fileData || blobUrl || ''}
                  fileName={attachment.fileName}
                  displayName={attachment.title}
                  language="fa"
                  onDownload={() => onDownload(attachment)}
                />
              </div>
            ) : (
              <div className="text-center text-slate-400 p-8">
                <FileText className="w-12 h-12 mx-auto mb-3 text-rose-500 opacity-80" />
                <p className="font-bold text-white text-sm mb-1">{attachment.title}</p>
                <p className="text-xs text-slate-400 mb-4 font-mono">{attachment.fileName}</p>
                <button
                  onClick={() => onDownload(attachment)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  دانلود و مشاهده فایل PDF
                </button>
              </div>
            )
          ) : isImage ? (
            blobUrl ? (
              <div className="w-full h-full overflow-auto flex items-center justify-center">
                <img
                  src={blobUrl}
                  alt={attachment.title}
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease',
                    maxWidth: zoom <= 100 ? '100%' : 'none',
                    maxHeight: zoom <= 100 ? '100%' : 'none',
                    objectFit: 'contain'
                  }}
                  className="rounded-lg shadow-2xl"
                />
              </div>
            ) : (
              <div className="text-center text-slate-400">
                در حال پردازش و بارگذاری تصویر...
              </div>
            )
          ) : (
            <div className="text-center text-slate-400 p-8">
              <FileText className="w-12 h-12 mx-auto mb-3 text-teal-400" />
              <p className="font-bold text-white text-sm mb-1">{attachment.title}</p>
              <p className="text-xs text-slate-400 mb-4">{attachment.fileSizeFormatted}</p>
              <button
                onClick={() => onDownload(attachment)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
              >
                دانلود فایل ({attachment.fileSizeFormatted})
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        {attachment.description && (
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-[#1a2632] border-t border-slate-200 dark:border-slate-800 text-xs flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <span className="font-bold text-slate-600 dark:text-slate-300">توضیحات:</span>
            <span className="text-slate-500 dark:text-slate-400 truncate">{attachment.description}</span>
          </div>
        )}
      </div>
    </div>
  );
};
export default DossierFilePreviewModal;

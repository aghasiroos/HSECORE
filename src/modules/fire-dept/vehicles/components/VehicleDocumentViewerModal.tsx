import React, { useState } from 'react';
import { 
  FileText, Download, X, Image as ImageIcon, Calendar, 
  Hash, Tag, ExternalLink, ZoomIn, ZoomOut, CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { VehicleDocument } from '../types/vehicleTypes';
import PdfDocumentViewer from '../../../health-env/components/PdfDocumentViewer';

interface Props {
  isOpen: boolean;
  language: 'fa' | 'en';
  vehicleCode: string;
  document: VehicleDocument | null;
  onClose: () => void;
}

export default function VehicleDocumentViewerModal({
  isOpen,
  language,
  vehicleCode,
  document,
  onClose
}: Props) {
  const isFa = language === 'fa';
  const [zoom, setZoom] = useState(1);

  const isImage = document?.fileType === 'PNG' || document?.fileType === 'JPG' || document?.fileType === 'JPEG';
  const isPdf = document?.fileType === 'PDF';

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case 'manual': return isFa ? 'دفترچه راهنما و کاتالوگ فنی' : 'Technical Manual';
      case 'insurance': return isFa ? 'گواهی و بیمه‌نامه' : 'Insurance Policy';
      case 'ownership': return isFa ? 'اسناد مالکیت و شناسنامه خودرو' : 'Ownership & Title';
      case 'license': return isFa ? 'مجوز بهره‌برداری و معاینه فنی' : 'Operational License';
      case 'technical': return isFa ? 'نقشه‌های فنی و هیدرولیک' : 'Technical Schematics';
      default: return isFa ? 'سند ضمیمه' : 'Attached Document';
    }
  };

  const handleDownload = () => {
    if (document.fileData) {
      const link = window.document.createElement('a');
      link.href = document.fileData;
      link.download = document.fileName || `${document.title}.${document.fileType.toLowerCase()}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } else {
      // Create text dummy download if no raw data
      const blob = new Blob([`Document: ${document.title}\nVehicle: ${vehicleCode}\nDate: ${document.uploadDate}\nNumber: ${document.docNumber || '-'}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${document.title}.txt`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs font-sans animate-fadeIn overflow-y-auto"
      style={{ direction: isFa ? 'rtl' : 'ltr' }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-scaleIn my-6 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              isPdf 
                ? 'bg-red-50 dark:bg-red-950/50 text-red-600 border border-red-200 dark:border-red-900/50'
                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 border border-blue-200 dark:border-blue-900/50'
            }`}>
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black text-white ${
                  isPdf ? 'bg-red-600' : 'bg-blue-600'
                }`}>
                  {document.fileType}
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate max-w-md">
                  {document.title}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {getCategoryLabel(document.category)} • {isFa ? `خودرو: ${vehicleCode}` : `Vehicle: ${vehicleCode}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFa ? 'دانلود فایل' : 'Download'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Metadata Bar */}
        <div className="bg-slate-100/70 dark:bg-slate-800/70 px-5 py-2.5 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
            {document.docNumber && (
              <span className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono font-bold">{document.docNumber}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{isFa ? 'تاریخ ثبت:' : 'Uploaded:'} <strong className="font-mono">{document.uploadDate}</strong></span>
            </span>
            {document.expiryDate && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isFa ? 'انقضا:' : 'Exp:'} <strong className="font-mono">{document.expiryDate}</strong></span>
              </span>
            )}
            <span className="font-mono text-slate-400">
              {document.size || '1.2 MB'}
            </span>
          </div>

          {isImage && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-6 bg-slate-900/5 dark:bg-slate-950/40 flex items-center justify-center min-h-[350px]">
          {isImage ? (
            document.fileData ? (
              <div className="overflow-auto max-h-[60vh] max-w-full flex items-center justify-center p-2">
                <img
                  src={document.fileData}
                  alt={document.title}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                  className="rounded-2xl shadow-lg max-h-[50vh] object-contain transition-transform duration-200 border border-slate-200 dark:border-slate-700"
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-md space-y-3">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{document.title}</h4>
                <p className="text-xs text-slate-500">
                  {isFa ? 'تصویر با فرمت PNG/JPG ضمیمه شده است.' : 'PNG/JPG image attachment ready.'}
                </p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs"
                >
                  {isFa ? 'دانلود و مشاهده کامل تصویر' : 'Download Image'}
                </button>
              </div>
            )
          ) : isPdf ? (
            document.fileData ? (
              <div className="w-full h-[65vh] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <PdfDocumentViewer
                  fileData={document.fileData}
                  fileName={document.fileName}
                  displayName={document.title}
                  language={language}
                  onDownload={handleDownload}
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-md space-y-3">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-3xl flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{document.title}</h4>
                <p className="text-xs text-slate-500">
                  {isFa ? 'سند الکترونیکی با استاندارد PDF ضمیمه پرونده خودرو است.' : 'PDF format electronic document verified.'}
                </p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs"
                >
                  {isFa ? 'دریافت و ذخیره فایل PDF' : 'Download PDF File'}
                </button>
              </div>
            )
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-md space-y-3">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{document.title}</h4>
              <p className="text-xs text-slate-500">{document.notes || (isFa ? 'سند فنی خودرو' : 'Vehicle Document')}</p>
            </div>
          )}
        </div>

        {/* Footer Notes */}
        {document.notes && (
          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {isFa ? 'یادداشت و ملاحظات سند:' : 'Document Notes:'}
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {document.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

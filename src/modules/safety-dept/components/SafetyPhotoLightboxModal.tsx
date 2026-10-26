import React from 'react';
import { X, Download, ZoomIn, Calendar, User, Tag } from 'lucide-react';
import { SafetyAuditPhoto } from '../types';

interface Props {
  photo: SafetyAuditPhoto | null;
  onClose: () => void;
  isFa?: boolean;
}

export default function SafetyPhotoLightboxModal({ photo, onClose, isFa = true }: Props) {
  if (!photo) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.fileName || `safety-audit-photo-${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
      dir={isFa ? 'rtl' : 'ltr'}
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ZoomIn className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white truncate max-w-md">
                {photo.caption || photo.fileName || (isFa ? 'تصویر مستند بازرسی ایمنی' : 'Inspection Evidence Photo')}
              </h4>
              {photo.fileSize && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {photo.fileSize}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title={isFa ? 'دانلود تصویر با کیفیت اصلی' : 'Download Photo'}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
              title={isFa ? 'بستن' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Image Display */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
          <img 
            src={photo.url} 
            alt={photo.caption || 'Safety inspection photo'}
            className="max-h-[68vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800/80"
          />
        </div>

        {/* Footer Meta */}
        {(photo.caption || photo.uploadedAt || photo.uploadedBy) && (
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            {photo.caption && (
              <p className="text-slate-200 font-medium leading-relaxed max-w-xl">
                {photo.caption}
              </p>
            )}
            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
              {photo.uploadedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  {photo.uploadedAt}
                </span>
              )}
              {photo.uploadedBy && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  {photo.uploadedBy}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

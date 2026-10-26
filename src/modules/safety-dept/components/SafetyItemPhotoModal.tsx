import React from 'react';
import { X, Camera, CheckSquare, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { SafetyAuditPhoto, SafetyChecklistInspectionItem } from '../types';
import SafetyPhotoAttachmentSection from './SafetyPhotoAttachmentSection';

interface Props {
  item: SafetyChecklistInspectionItem | null;
  itemIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdateItemPhotos: (itemIndex: number, photos: SafetyAuditPhoto[]) => void;
  isFa?: boolean;
  currentUser?: any;
}

export default function SafetyItemPhotoModal({
  item,
  itemIndex,
  isOpen,
  onClose,
  onUpdateItemPhotos,
  isFa = true,
  currentUser
}: Props) {
  if (!isOpen || !item) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
      dir={isFa ? 'rtl' : 'ltr'}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[10px] font-mono font-bold">
                  {isFa ? `بند شماره ${itemIndex + 1}` : `Item #${itemIndex + 1}`}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  item.verdict === 'fail' 
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' 
                    : item.verdict === 'warning'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}>
                  {item.verdict === 'fail' ? (isFa ? 'عدم انطباق' : 'Fail') : item.verdict === 'warning' ? (isFa ? 'هشدار' : 'Warn') : (isFa ? 'تایید' : 'Pass')}
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                {item.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {item.comment && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200 block">{isFa ? 'توضیحات و شرح نقص:' : 'Notes / Defect:'}</span>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">{item.comment}</p>
              </div>
            </div>
          )}

          <SafetyPhotoAttachmentSection
            photos={item.photos || []}
            onChange={(updatedPhotos) => onUpdateItemPhotos(itemIndex, updatedPhotos)}
            title={isFa ? 'عکس‌های مستند این بند کنترلی' : 'Item Evidence Photos'}
            subtitle={isFa ? 'عکس‌های مربوط به وضعیت، نقص یا اصلاح این بند خاص' : 'Upload photos specifically for this checklist item.'}
            isFa={isFa}
            currentUser={currentUser}
            maxPhotos={6}
          />
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {item.photos && item.photos.length > 0 
              ? (isFa ? `${item.photos.length} عکس پیوست شده است` : `${item.photos.length} photos attached`)
              : (isFa ? 'بدون عکس پیوست' : 'No photos attached')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {isFa ? 'تایید و بستن' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

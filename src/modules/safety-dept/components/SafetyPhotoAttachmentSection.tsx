import React, { useState, useRef } from 'react';
import { 
  Camera, Upload, Trash2, Eye, Image as ImageIcon, 
  Plus, Edit2, Check, AlertCircle, FileText, Sparkles
} from 'lucide-react';
import { SafetyAuditPhoto } from '../types';
import SafetyPhotoLightboxModal from './SafetyPhotoLightboxModal';
import { compressImageFile } from '../../../utils/fileHelpers';

interface Props {
  photos: SafetyAuditPhoto[];
  onChange: (photos: SafetyAuditPhoto[]) => void;
  title?: string;
  subtitle?: string;
  isFa?: boolean;
  currentUser?: any;
  maxPhotos?: number;
  compact?: boolean;
}

async function processAndCompressImage(file: File): Promise<{ url: string; sizeFormatted: string }> {
  const { dataUrl, sizeFormatted } = await compressImageFile(file);
  return { url: dataUrl, sizeFormatted };
}

export default function SafetyPhotoAttachmentSection({
  photos = [],
  onChange,
  title,
  subtitle,
  isFa = true,
  currentUser,
  maxPhotos = 12,
  compact = false
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionInput, setCaptionInput] = useState('');
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<SafetyAuditPhoto | null>(null);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      alert(isFa ? `حداکثر ${maxPhotos} تصویر مجاز است.` : `Max ${maxPhotos} photos allowed.`);
      return;
    }

    setIsUploading(true);
    try {
      const newPhotosList: SafetyAuditPhoto[] = [];
      const now = new Date().toLocaleDateString('fa-IR');
      const uploader = currentUser?.fullName || currentUser?.username || (isFa ? 'کارشناس ایمنی' : 'Safety Officer');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const { url, sizeFormatted } = await processAndCompressImage(file);
        newPhotosList.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url,
          fileName: file.name,
          fileSize: sizeFormatted,
          caption: '',
          uploadedAt: now,
          uploadedBy: uploader
        });
      }

      if (newPhotosList.length > 0) {
        onChange([...photos, ...newPhotosList]);
      }
    } catch (err) {
      console.error('Photo processing error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
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
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleRemovePhoto = (photoId: string) => {
    onChange(photos.filter(p => p.id !== photoId));
  };

  const handleStartEditCaption = (photo: SafetyAuditPhoto) => {
    setEditingCaptionId(photo.id);
    setCaptionInput(photo.caption || '');
  };

  const handleSaveCaption = (photoId: string) => {
    onChange(photos.map(p => p.id === photoId ? { ...p, caption: captionInput.trim() } : p));
    setEditingCaptionId(null);
    setCaptionInput('');
  };

  return (
    <div className={`space-y-3.5 ${compact ? '' : 'p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80'}`}>
      {/* Section Header */}
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <span>{title || (isFa ? 'مستندات تصویری و عکس‌های بازرسی و ممیزی' : 'Inspection Evidence Photos')}</span>
                {photos.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold">
                    {photos.length} {isFa ? 'عکس' : 'photos'}
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {subtitle || (isFa ? 'تصاویر محل بازرسی، ماشین‌آلات، عیوب مشاهده‌شده و شواهد انطباق استاندارد' : 'Attach audit photos, machinery status, and safety compliance evidence.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Camera on Mobile/Tablet */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isFa ? 'عکاسی با دوربین' : 'Take Photo'}</span>
            </button>

            {/* Upload Files Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isFa ? 'انتخاب فایل عکس' : 'Upload Photos'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden File & Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={e => handleFilesSelected(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFilesSelected(e.target.files)}
      />

      {/* Drag & Drop Upload Zone (Shown when empty or in full mode) */}
      {photos.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-white/50 dark:bg-slate-800/50'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            {isUploading ? (
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isFa ? 'جهت افزودن عکس کلیک کنید یا فایل‌ها را به اینجا بکشید' : 'Click to select photos or drag & drop here'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
              JPG, PNG, WEBP — {isFa ? 'فشرده‌سازی خودکار و بهینه‌سازی کیفیت' : 'Auto-compressed high quality'}
            </p>
          </div>
        </div>
      ) : null}

      {/* Photos Thumbnail Grid */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {photos.map((photo, idx) => (
              <div
                key={photo.id || idx}
                className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {/* Image Frame */}
                <div 
                  className="relative aspect-4/3 bg-slate-100 dark:bg-slate-900 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedPhotoForZoom(photo)}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || photo.fileName || 'Inspection item photo'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs hover:bg-black/80">
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>

                  {/* Number Badge */}
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-mono font-bold backdrop-blur-xs">
                    #{idx + 1}
                  </span>

                  {photo.fileSize && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono backdrop-blur-xs">
                      {photo.fileSize}
                    </span>
                  )}
                </div>

                {/* Caption / Title / Actions */}
                <div className="p-2 bg-white dark:bg-slate-800 text-[11px] flex-1 flex flex-col justify-between gap-1.5">
                  {editingCaptionId === photo.id ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={captionInput}
                        onChange={e => setCaptionInput(e.target.value)}
                        placeholder={isFa ? 'عنوان/شرح عکس...' : 'Caption...'}
                        className="w-full px-2 py-1 text-[11px] bg-slate-50 dark:bg-slate-900 border border-blue-400 rounded-lg outline-none"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveCaption(photo.id);
                          if (e.key === 'Escape') setEditingCaptionId(null);
                        }}
                      />
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveCaption(photo.id)}
                          className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-1">
                      <p 
                        onClick={() => handleStartEditCaption(photo)}
                        className="text-slate-700 dark:text-slate-300 truncate font-medium hover:text-blue-600 cursor-pointer flex-1"
                        title={photo.caption || (isFa ? 'برای افزودن شرح کلیک کنید' : 'Click to add caption')}
                      >
                        {photo.caption || <span className="text-slate-400 italic text-[10px]">{isFa ? '+ شرح عکس...' : '+ Add caption...'}</span>}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleStartEditCaption(photo)}
                        className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                        title={isFa ? 'ویرایش شرح' : 'Edit caption'}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Remove Button */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-mono">
                      {photo.uploadedAt || ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="text-rose-500 hover:text-rose-700 p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                      title={isFa ? 'حذف عکس' : 'Delete photo'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Add More Card */}
            {photos.length < maxPhotos && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-4/3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all flex flex-col items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[11px] font-bold">
                  {isFa ? 'افزودن عکس بیشتر' : 'Add More'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {selectedPhotoForZoom && (
        <SafetyPhotoLightboxModal
          photo={selectedPhotoForZoom}
          onClose={() => setSelectedPhotoForZoom(null)}
          isFa={isFa}
        />
      )}
    </div>
  );
}

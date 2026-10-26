import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Bell,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Info,
  Play,
  Save,
  X,
  Sparkles,
  Lock,
  RotateCcw,
  Check,
  Database,
  Radio,
  SlidersHorizontal,
  Upload,
  Music,
  Trash2,
  FileAudio,
  Square,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiDb } from '../../services/apiDatabaseClient';
import { useNotification } from '../../context/NotificationContext';
import { playNotificationSound, stopNotificationAudio, SoundType } from '../../utils/notificationAudio';
import { NotificationPreferences, DEFAULT_PREFERENCES } from '../../services/notificationService';
import { isUserAdmin, addAuditLog } from '../../utils/authHelper';
import { UserProfile } from '../../types';

interface PendingAudioFile {
  name: string;
  size: number;
  dataUrl: string;
}

interface HseCriticalAlarmCustomizerProps {
  localPrefs: NotificationPreferences;
  setLocalPrefs: React.Dispatch<React.SetStateAction<NotificationPreferences>>;
  onPersistPrefs: (updatedPrefs: NotificationPreferences, logMessage?: string) => Promise<void>;
  isFa: boolean;
  isPlayingCustomAudio: boolean;
  testingType: string | null;
  onTestAudio: (type: SoundType, forceDefaultSynth?: boolean) => void;
  onStopAudio: () => void;
  compact?: boolean;
}

export const HseCriticalAlarmCustomizer: React.FC<HseCriticalAlarmCustomizerProps> = ({
  localPrefs,
  setLocalPrefs,
  onPersistPrefs,
  isFa,
  isPlayingCustomAudio,
  testingType,
  onTestAudio,
  onStopAudio,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingAudioFile, setPendingAudioFile] = useState<PendingAudioFile | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const triggerFilePicker = () => {
    setStatusMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);

    // Strict validation: ONLY .mp3 is permitted
    const isMp3 =
      file.name.toLowerCase().endsWith('.mp3') ||
      file.type === 'audio/mpeg' ||
      file.type === 'audio/mp3';

    if (!isMp3) {
      const errMsg = isFa
        ? 'خطا: فرمت فایل نامعتبر است! تنها فایل‌های صوتی با پسوند MP3. برای آژیر بحرانی HSE مجاز هستند.'
        : 'Invalid audio format! Only .mp3 files are allowed for the HSE Critical Alarm.';
      setStatusMessage({ type: 'error', text: errMsg });
      toast.error(errMsg);
      e.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      const errMsg = isFa
        ? 'حجم فایل صوتی بیش از حد مجاز است! حداکثر حجم فایل MP3 نباید از ۱۵ مگابایت بیشتر باشد.'
        : 'MP3 file size must not exceed 15MB.';
      setStatusMessage({ type: 'error', text: errMsg });
      toast.error(errMsg);
      e.target.value = '';
      return;
    }

    const selectedName = file.name;
    const selectedSize = file.size;
    const reader = new FileReader();

    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result as string;
      if (dataUrl) {
        // Open confirmation warning dialog before applying the new siren
        setPendingAudioFile({
          name: selectedName,
          size: selectedSize,
          dataUrl,
        });
      }
    };

    reader.onerror = () => {
      const errMsg = isFa ? 'خطا در خواندن فایل صوتی MP3.' : 'Failed to load MP3 file.';
      setStatusMessage({ type: 'error', text: errMsg });
      toast.error(errMsg);
    };

    reader.onloadend = () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const handleConfirmPendingFile = async () => {
    if (!pendingAudioFile) return;
    onStopAudio();
    setIsApplying(true);
    try {
      let resolvedAudioUrl = '/api/v1/notifications/custom-siren';
      try {
        const uploadResult = await apiDb.uploadCustomSiren(
          pendingAudioFile.dataUrl,
          pendingAudioFile.name,
          pendingAudioFile.size
        );
        if (uploadResult?.audioUrl) {
          resolvedAudioUrl = uploadResult.audioUrl;
        }
      } catch (uploadErr) {
        console.warn('Dedicated upload endpoint failed, falling back:', uploadErr);
      }

      const updatedPrefs: NotificationPreferences = {
        ...localPrefs,
        criticalHseAudioMode: 'custom_mp3',
        criticalHseCustomAudioUrl: resolvedAudioUrl,
        criticalHseCustomAudioName: pendingAudioFile.name,
        criticalHseCustomAudioSize: pendingAudioFile.size,
      };
      await onPersistPrefs(
        updatedPrefs,
        `جایگزینی و فعال‌سازی آژیر بحرانی HSE با فایل MP3: ${pendingAudioFile.name}`
      );
      const msg = isFa
        ? `آژیر سفارشی "${pendingAudioFile.name}" با موفقیت تایید، فعال و در سیستم ذخیره گردید.`
        : `Custom MP3 "${pendingAudioFile.name}" confirmed, activated, and saved.`;
      setStatusMessage({ type: 'success', text: msg });
      toast.success(msg);
      setPendingAudioFile(null);
    } catch {
      const errMsg = isFa ? 'خطا در اعمال و ذخیره‌سازی آژیر سفارشی.' : 'Failed to apply custom siren.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelPendingFile = () => {
    onStopAudio();
    setPendingAudioFile(null);
  };

  const handleSwitchMode = async (mode: 'default_synth' | 'custom_mp3') => {
    onStopAudio();
    const updatedPrefs: NotificationPreferences = {
      ...localPrefs,
      criticalHseAudioMode: mode,
    };
    setLocalPrefs(updatedPrefs);
    await onPersistPrefs(
      updatedPrefs,
      mode === 'custom_mp3'
        ? 'تغییر وضعیت آژیر بحرانی HSE به حالت فایل MP3 سفارشی'
        : 'تغییر وضعیت آژیر بحرانی HSE به حالت سنتز دیجیتال پیش‌فرض'
    );
    setStatusMessage({
      type: 'success',
      text:
        mode === 'custom_mp3'
          ? isFa
            ? 'آژیر سفارشی MP3 به عنوان آژیر بحرانی HSE فعال شد.'
            : 'Custom MP3 siren activated.'
          : isFa
          ? 'آژیر صنعتی پیش‌فرض سامانه فعال شد.'
          : 'Default industrial siren activated.',
    });
  };

  const handleRemoveCustomAudio = async () => {
    onStopAudio();
    try {
      await apiDb.deleteCustomSiren();
    } catch (e) {
      console.warn('Failed deleting custom siren from server:', e);
    }
    const updatedPrefs: NotificationPreferences = {
      ...localPrefs,
      criticalHseAudioMode: 'default_synth',
      criticalHseCustomAudioUrl: undefined,
      criticalHseCustomAudioName: undefined,
      criticalHseCustomAudioSize: undefined,
    };
    await onPersistPrefs(
      updatedPrefs,
      'حذف آژیر سفارشی MP3 و بازگشت به آژیر استاندارد سنتز دیجیتال پیش‌فرض'
    );
    const msg = isFa
      ? 'آژیر سفارشی حذف شد و به آژیر استاندارد سنتز دیجیتال بازگردانی گردید.'
      : 'Custom MP3 removed, restored to default synth siren.';
    setStatusMessage({ type: 'success', text: msg });
    toast.success(msg);
  };

  const hasCustomFile = Boolean(localPrefs.criticalHseCustomAudioUrl);
  const isCustomMode = localPrefs.criticalHseAudioMode === 'custom_mp3' && hasCustomFile;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl border border-rose-200/90 dark:border-rose-900/60 shadow-xs space-y-4 overflow-hidden ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,audio/mpeg,audio/mp3"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'شخصی‌سازی آژیر بحرانی HSE' : 'HSE Critical Alarm Customization'}
              </h4>
              <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-black rounded-full border border-rose-200/80 dark:border-rose-900/60 shrink-0">
                {isFa ? 'فقط فرمت MP3' : 'MP3 Only'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5 leading-relaxed">
              {isFa
                ? 'امکان بارگذاری و جایگزینی فایل صوتی MP3 دلخواه منحصراً برای آژیر بحرانی HSE'
                : 'Replace default siren with custom MP3 exclusively for HSE critical events'}
            </p>
          </div>
        </div>

        {isPlayingCustomAudio && (
          <button
            type="button"
            onClick={onStopAudio}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm animate-pulse cursor-pointer shrink-0"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{isFa ? 'توقف پخش' : 'Stop'}</span>
          </button>
        )}
      </div>

      {/* Inline Status / Feedback Alert */}
      {statusMessage && (
        <div
          className={`p-3 rounded-2xl border flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="leading-relaxed break-words">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Confirmation Warning Dialog upon selecting an MP3 file */}
      {pendingAudioFile && (
        <div className="p-4 sm:p-5 bg-rose-50/95 dark:bg-rose-950/50 border-2 border-rose-500 dark:border-rose-600 rounded-2xl space-y-3.5 shadow-lg animate-in zoom-in-95">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h5 className="text-xs sm:text-sm font-black text-rose-950 dark:text-rose-100">
                {isFa
                  ? 'هشدار تعویض و جایگزینی آژیر بحرانی HSE'
                  : 'Confirm HSE Critical Siren Replacement'}
              </h5>
              <p className="text-[11px] sm:text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                {isFa
                  ? 'آیا از تعویض آژیر بحرانی سامانه و جایگزینی آن با فایل صوتی انتخاب‌شده اطمینان دارید؟ پس از تایید شما، این فایل به عنوان آژیر بحرانی HSE در سیستم اعمال و فعال خواهد شد.'
                  : 'Are you sure you want to replace the HSE critical siren with the selected MP3 file? Upon confirmation, it will be immediately activated.'}
              </p>
            </div>
          </div>

          {/* Selected File Preview Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <FileAudio className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-800 dark:text-slate-100 break-all">
                  {pendingAudioFile.name}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">
                  {formatFileSize(pendingAudioFile.size)} • MP3 Audio
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isPlayingCustomAudio) {
                  onStopAudio();
                } else {
                  playNotificationSound('critical_hse', {
                    volume: localPrefs.soundVolume,
                    muted: false,
                    forcePlay: true,
                    customAudioUrl: pendingAudioFile.dataUrl,
                  });
                }
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              {isPlayingCustomAudio ? (
                <>
                  <Square className="w-3 h-3 fill-current text-rose-600" />
                  <span>{isFa ? 'توقف پیش‌شنوایی' : 'Stop Preview'}</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current text-rose-600" />
                  <span>{isFa ? 'پیش‌شنوایی فایل انتخابی' : 'Preview File'}</span>
                </>
              )}
            </button>
          </div>

          {/* Confirm / Cancel Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCancelPendingFile}
              disabled={isApplying}
              className="px-4 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirmPendingFile}
              disabled={isApplying}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>
                {isApplying
                  ? isFa
                    ? 'در حال اعمال...'
                    : 'Applying...'
                  : isFa
                  ? 'تایید و اعمال آژیر جدید'
                  : 'Confirm & Apply Siren'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Selection Cards (Fully Responsive, No Overflow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Option 1: Default Synthesizer Siren */}
        <div
          onClick={() => handleSwitchMode('default_synth')}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition select-none flex flex-col justify-between gap-3 overflow-hidden min-w-0 ${
            !isCustomMode
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-400 dark:border-rose-600 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                {isFa ? 'آژیر صنعتی پیش‌فرض سامانه' : 'Default Industrial Siren'}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed break-words">
                {isFa
                  ? 'سنتز دیجیتال نوسانی ۹۴۰/۶۸۰ هرتز با موتور بومی Web Audio API بدون نیاز به فایل صوتی'
                  : 'Web Audio API real-time 940/680Hz dual oscillator synth'}
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                !isCustomMode
                  ? 'border-rose-600 bg-white dark:bg-slate-900 ring-2 ring-rose-500/20'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {!isCustomMode && <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 w-full min-w-0">
            <span className="text-[10px] font-bold text-slate-400">
              {isFa ? 'وضعیت: پیش‌فرض کارخانه' : 'Status: System Default'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTestAudio('critical_hse', true);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
            >
              <Play className="w-3 h-3 fill-current text-rose-600" />
              <span>
                {testingType === 'critical_hse' && !isCustomMode
                  ? isFa
                    ? 'پخش...'
                    : 'Playing...'
                  : isFa
                  ? 'آزمایش'
                  : 'Test'}
              </span>
            </button>
          </div>
        </div>

        {/* Option 2: Custom MP3 Siren */}
        <div
          onClick={() => {
            if (hasCustomFile) {
              handleSwitchMode('custom_mp3');
            } else {
              triggerFilePicker();
            }
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition select-none flex flex-col justify-between gap-3 overflow-hidden min-w-0 ${
            isCustomMode
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-400 dark:border-rose-600 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'آژیر سفارشی اختصاصی (MP3)' : 'Custom MP3 Siren'}
                </span>
                {hasCustomFile && (
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded shrink-0">
                    {isFa ? 'بارگذاری شده' : 'Uploaded'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed break-words">
                {hasCustomFile
                  ? `${localPrefs.criticalHseCustomAudioName} (${formatFileSize(
                      localPrefs.criticalHseCustomAudioSize
                    )})`
                  : isFa
                  ? 'بارگذاری فایل صوتی MP3 مدنظر برای اعلام وضعیت‌های اضطراری'
                  : 'Upload an MP3 file to play during HSE emergencies'}
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                isCustomMode
                  ? 'border-rose-600 bg-white dark:bg-slate-900 ring-2 ring-rose-500/20'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {isCustomMode && <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 w-full min-w-0">
            {hasCustomFile ? (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                {isCustomMode
                  ? isFa
                    ? 'وضعیت: فعال برای آژیر بحرانی'
                    : 'Status: Active for HSE'
                  : isFa
                  ? 'آماده فعال‌سازی'
                  : 'Ready'}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400">
                {isFa ? 'نیاز به انتخاب فایل MP3' : 'Needs MP3 File'}
              </span>
            )}

            {hasCustomFile ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlayingCustomAudio) {
                    onStopAudio();
                  } else {
                    playNotificationSound('critical_hse', {
                      volume: localPrefs.soundVolume,
                      muted: false,
                      forcePlay: true,
                      customAudioUrl: localPrefs.criticalHseCustomAudioUrl,
                    });
                  }
                }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                {isPlayingCustomAudio ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    <span>{isFa ? 'توقف' : 'Stop'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isFa ? 'آزمایش MP3' : 'Test MP3'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFilePicker();
                }}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg text-[11px] font-black border border-rose-200 dark:border-rose-900 flex items-center gap-1 transition cursor-pointer active:scale-95 shrink-0"
              >
                <Upload className="w-3 h-3" />
                <span>{isFa ? 'انتخاب MP3' : 'Pick MP3'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Custom File Details Card or Upload Box */}
      {hasCustomFile ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isPlayingCustomAudio
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              <FileAudio className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 break-all">
                  {localPrefs.criticalHseCustomAudioName || 'custom_siren.mp3'}
                </span>
                <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[10px] font-black rounded shrink-0">
                  MP3
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-bold mt-0.5">
                <span>{formatFileSize(localPrefs.criticalHseCustomAudioSize)}</span>
                <span>•</span>
                <span
                  className={
                    isCustomMode
                      ? 'text-emerald-600 dark:text-emerald-400 font-black'
                      : 'text-slate-400'
                  }
                >
                  {isCustomMode
                    ? isFa
                      ? 'آژیر بحرانی فعال در سیستم'
                      : 'Active HSE Siren'
                    : isFa
                    ? 'غیرفعال (روی کارت بالا کلیک کنید تا فعال شود)'
                    : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={triggerFilePicker}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>{isFa ? 'تعویض فایل MP3' : 'Replace'}</span>
            </button>

            <button
              type="button"
              onClick={handleRemoveCustomAudio}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 transition cursor-pointer"
              title={isFa ? 'حذف فایل و بازگشت به آژیر پیش‌فرض' : 'Remove MP3 & Restore Default'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isFa ? 'حذف و بازگشت به پیش‌فرض' : 'Remove'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={triggerFilePicker}
          className="border-2 border-dashed border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-600 rounded-2xl p-5 text-center cursor-pointer transition bg-rose-50/30 hover:bg-rose-50/60 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 group"
        >
          <div className="w-11 h-11 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
            {isFa
              ? 'کلیک جهت بارگذاری فایل صوتی MP3 برای آژیر بحرانی HSE'
              : 'Click to upload custom MP3 for HSE Critical Alarm'}
          </span>
          <p className="text-[11px] text-slate-400 font-bold mt-1">
            {isFa
              ? 'فقط فایل‌های صوتی با پسوند mp3. پذیرفته می‌شوند (پس از انتخاب، با تایید شما اعمال می‌گردد)'
              : 'Only .mp3 format accepted (Applied upon your confirmation)'}
          </p>
        </div>
      )}

      {/* Industrial Notice strictly stating this is ONLY for HSE critical alarm */}
      <div className="p-3 bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/90 dark:border-amber-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          {isFa
            ? 'توجه: طبق استانداردهای ایمنی و ارگونومی، قابلیت تعویض آژیر منحصراً برای رخدادهای بحرانی HSE (مانند آتش‌سوزی، شرایط اضطراری و آژیر قرمز) فعال است و سایر اصوات سیستم (هشدار، موفقیت و اطلاعات) به صورت استاندارد و یکپارچه پخش می‌شوند.'
            : 'Note: In accordance with industrial safety standards, sound customization is strictly restricted to HSE Critical Alarms. Warning, success, and info alerts retain their standard chime.'}
        </p>
      </div>
    </div>
  );
};

interface AdvancedSoundSettingsPanelProps {
  currentUser: UserProfile | null;
  isFa?: boolean;
  onClose?: () => void;
  isModal?: boolean;
}

export const AdvancedSoundSettingsPanel: React.FC<AdvancedSoundSettingsPanelProps> = ({
  currentUser,
  isFa = true,
  onClose,
  isModal = false,
}) => {
  const { preferences, updatePreferences, triggerTestAlert } = useNotification();

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [isPlayingCustomAudio, setIsPlayingCustomAudio] = useState(false);

  const isAdmin = isUserAdmin(currentUser);

  // Synchronize with active global preferences
  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  // Synchronize playing state with global audio events
  useEffect(() => {
    const handlePlayState = (e: any) => {
      setIsPlayingCustomAudio(!!e.detail?.isPlaying);
    };
    window.addEventListener('hse_audio_play_state', handlePlayState);
    return () => {
      window.removeEventListener('hse_audio_play_state', handlePlayState);
      stopNotificationAudio();
    };
  }, []);

  // Persist helper used for immediate siren confirmation & full form save
  const persistPreferences = async (
    updatedPrefs: NotificationPreferences,
    logMessage?: string
  ) => {
    setLocalPrefs(updatedPrefs);
    await updatePreferences(updatedPrefs);
    if (currentUser?.username && logMessage) {
      addAuditLog(currentUser.username, logMessage, 'موفقیت‌آمیز');
    }
  };

  // Audio preview tester
  const handleTestAudio = (type: SoundType, forceDefaultSynth = false) => {
    setTestingType(type);
    const customAudioUrl =
      !forceDefaultSynth &&
      type === 'critical_hse' &&
      localPrefs.criticalHseAudioMode === 'custom_mp3'
        ? localPrefs.criticalHseCustomAudioUrl
        : undefined;

    playNotificationSound(type, {
      volume: localPrefs.soundVolume,
      muted: false,
      forcePlay: true,
      customAudioUrl,
    });
    setTimeout(() => setTestingType(null), 1500);
  };

  const handleStopAudio = () => {
    stopNotificationAudio();
    setIsPlayingCustomAudio(false);
    setTestingType(null);
  };

  // Reset to default factory settings
  const handleResetDefaults = () => {
    setLocalPrefs(DEFAULT_PREFERENCES);
    toast.success(isFa ? 'تنظیمات به حالت پیش‌فرض بازگردانی شد.' : 'Reset to default preferences.');
  };

  // Save to پایگاه داده via CentralNotificationService
  const handleSave = async () => {
    if (!isAdmin) {
      toast.error(
        isFa
          ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی تغییر این تنظیمات را دارد.'
          : 'Only the main Administrator can update these settings.'
      );
      return;
    }

    setIsSaving(true);
    try {
      await persistPreferences(
        localPrefs,
        'بروزرسانی تنظیمات پیشرفته صدا و موتور هشدارهای مرکزی سامانه در پایگاه داده'
      );
      toast.success(
        isFa
          ? 'تنظیمات پیشرفته صدا و اعلان‌ها در پایگاه داده ذخیره شد.'
          : 'Advanced sound & alert settings saved to database successfully.'
      );
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
      toast.error(isFa ? 'خطا در ذخیره‌سازی تنظیمات در سرور.' : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // If user is not the main administrator, block access and show clear restriction notice
  if (!isAdmin) {
    return (
      <div
        className="w-full bg-white dark:bg-slate-900 rounded-3xl p-10 border border-rose-200 dark:border-rose-900/60 shadow-lg text-center space-y-4"
        dir="rtl"
      >
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
            {isFa ? 'محدودیت دسترسی: ویژه مدیر اصلی برنامه' : 'Access Restricted: Main Administrator Only'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {isFa
              ? 'پیکربندی پیشرفته موتور صوتی، بلندی صدا، هشدارهای اضطراری بحرانی و سیاست نمایش پنجره‌های Popup منحصراً توسط مدیر اصلی سامانه (Administrator) قابل مشاهده و تغییر است.'
              : 'Advanced audio engine configuration, volume, critical alert bypass, and popup policies are strictly restricted to the main System Administrator.'}
          </p>
        </div>
        {onClose && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {isFa ? 'بازگشت' : 'Back'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // MODAL VIEW (Used inside popup dialog)
  // ══════════════════════════════════════════════════════════════════
  if (isModal) {
    return (
      <div
        className="w-full max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right select-none animate-in zoom-in-95"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                تنظیمات سیستم اعلان و هشدار مرکزی
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                پیکربندی صدا، سطح صدا و نحوه نمایش پنجره‌های اعلان در پایگاه داده
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Volume Card */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-700 dark:text-slate-200">شدت بلندی صدا (Volume):</span>
                <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-black">
                  {Math.round(localPrefs.soundVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={localPrefs.soundVolume}
                onChange={(e) =>
                  setLocalPrefs({ ...localPrefs, soundVolume: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-black text-slate-800 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={localPrefs.criticalSoundAlwaysOn}
                  onChange={(e) =>
                    setLocalPrefs({ ...localPrefs, criticalSoundAlwaysOn: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                />
                <span>هشدار بحرانی HSE همیشه با صدا پخش شود (حتی در حالت بی‌صدا)</span>
              </label>
              <ShieldAlert className="w-4.5 h-4.5 text-rose-500 shrink-0" />
            </div>
          </div>

          {/* Audio Preview 2x2 Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-slate-500" />
              <span>پیش‌شنوایی و آزمایش آژیرها و اصوات هشدار:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/90 dark:border-rose-900/60 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    if (isPlayingCustomAudio) {
                      handleStopAudio();
                    } else {
                      handleTestAudio('critical_hse');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                >
                  {isPlayingCustomAudio ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>{isFa ? 'توقف' : 'Stop'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>{testingType === 'critical_hse' ? (isFa ? 'پخش...' : 'Playing...') : (isFa ? 'آزمایش' : 'Test')}</span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="font-black text-rose-900 dark:text-rose-200 block text-xs">
                      آژیر بحرانی HSE
                    </span>
                    <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block">
                      {localPrefs.criticalHseAudioMode === 'custom_mp3' && localPrefs.criticalHseCustomAudioUrl
                        ? 'MP3 سفارشی'
                        : 'سنتز پیش‌فرض'}
                    </span>
                  </div>
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/60 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleTestAudio('warning')}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{testingType === 'warning' ? 'پخش...' : 'آزمایش'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-black text-amber-900 dark:text-amber-200">هشدار احتیاطی</span>
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-900/60 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleTestAudio('success')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{testingType === 'success' ? 'پخش...' : 'آزمایش'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-black text-emerald-900 dark:text-emerald-200">پیام موفقیت</span>
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-900/60 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleTestAudio('info')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{testingType === 'info' ? 'پخش...' : 'آزمایش'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-black text-blue-900 dark:text-blue-200">اعلان اطلاعاتی</span>
                  <Info className="w-4.5 h-4.5 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* HSE Critical Alarm MP3 Customization Card */}
          <HseCriticalAlarmCustomizer
            localPrefs={localPrefs}
            setLocalPrefs={setLocalPrefs}
            onPersistPrefs={persistPreferences}
            isFa={isFa}
            isPlayingCustomAudio={isPlayingCustomAudio}
            testingType={testingType}
            onTestAudio={handleTestAudio}
            onStopAudio={handleStopAudio}
            compact={true}
          />

          {/* Popup Policy */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-slate-600 dark:text-slate-300">
              نحوه نمایش پنجره اعلان (Popup در مرکز صفحه):
            </h4>
            <div className="space-y-2 text-xs">
              {[
                { key: 'important_and_critical', label: 'نمایش Popup برای هشدارهای بحرانی و مهم (پیشنهادی)' },
                { key: 'critical_only', label: 'فقط برای هشدارهای بحرانی HSE' },
                { key: 'all', label: 'نمایش Popup برای تمامی اعلان‌ها' },
                { key: 'none', label: 'عدم نمایش Popup (فقط در نوار بالای سامانه)' },
              ].map((opt) => {
                const isSelected = localPrefs.showCenterPopup === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() =>
                      setLocalPrefs({ ...localPrefs, showCenterPopup: opt.key as any })
                    }
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-200 font-black shadow-xs ring-1 ring-blue-400/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-xs">{opt.label}</span>
                    <div
                      className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition ${
                        isSelected
                          ? 'border-blue-600 bg-white dark:bg-slate-900 ring-2 ring-blue-500/20'
                          : 'border-slate-300 dark:border-slate-600 bg-transparent'
                      }`}
                    >
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Alert Broadcast */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => triggerTestAlert('critical_hse', 'critical')}
              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-2xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>ارسال هشدار آزمایشی</span>
            </button>
            <div>
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                ارسال اعلان آزمایشی جهت تست زنده:
              </span>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                یک نمونه هشدار بحرانی ارسال می‌کند
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 bg-slate-50/90 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات'}</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
            >
              انصراف
            </button>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // FULL-SCREEN / FULL-PAGE TAB VIEW (Like Broadcast Hub & History)
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="w-full space-y-6 text-right select-none animate-in fade-in duration-200" dir="rtl">
      
      {/* ── Top Header Banner (Full Width) ── */}
      <div className="bg-gradient-to-r from-blue-600/10 via-indigo-500/5 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-blue-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/25">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                تنظیمات سیستم اعلان و هشدار مرکزی (Audio & Alert Engine)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                ویژه مدیر اصلی سامانه
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
              پیکربندی سطح صدا، رفتار آژیرهای اضطراری، پیش‌شنوایی و نحوه نمایش پنجره‌های اعلان
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="بازگردانی به مقادیر پیش‌فرض"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی پیش‌فرض</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Full-Width Grid (Two Columns like Broadcast Hub) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ════════════════════════════════════════════════════════
            LEFT COLUMN (lg:col-span-6): Volume & Audio Studio
           ════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Card 1: Volume Control & Emergency Siren Override */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                  {localPrefs.soundVolume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    شدت بلندی صدا و رفتار آژیر بحرانی
                  </h4>
                  <p className="text-[11px] text-slate-400 font-bold">
                    تنظیم قدرت افکت‌های صوتی و قابلیت پخش آژیرهای خطرساز
                  </p>
                </div>
              </div>

              {/* Live percent badge */}
              <div className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono font-black text-base rounded-xl">
                {Math.round(localPrefs.soundVolume * 100)}%
              </div>
            </div>

            {/* Range Slider Container */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>شدت بلندی صدا (Volume):</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  مقدار ذخیره شده در سرور: {Math.round(localPrefs.soundVolume * 100)}٪
                </span>
              </div>

              <div className="relative py-2">
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localPrefs.soundVolume}
                  onChange={(e) =>
                    setLocalPrefs({ ...localPrefs, soundVolume: parseFloat(e.target.value) })
                  }
                  className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-xl appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                />
                
                {/* Step scale markers */}
                <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1.5 px-1">
                  <span>۰٪ (بی‌صدا)</span>
                  <span>۲۵٪</span>
                  <span>۵۰٪ (معمولی)</span>
                  <span>۷۵٪</span>
                  <span>۱۰۰٪ (حداکثر)</span>
                </div>
              </div>

              {/* Quick preset buttons */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 font-bold">تنظیم سریع:</span>
                {[
                  { label: 'بی‌صدا', val: 0.0 },
                  { label: '۳۰٪', val: 0.3 },
                  { label: '۶۰٪', val: 0.6 },
                  { label: '۸۰٪', val: 0.8 },
                  { label: '۱۰۰٪', val: 1.0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setLocalPrefs({ ...localPrefs, soundVolume: preset.val })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      Math.abs(localPrefs.soundVolume - preset.val) < 0.03
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Critical Sound Always On Checkbox (Exact Design from Screenshot) */}
            <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl flex items-center justify-between gap-3">
              <label className="flex items-center gap-3 cursor-pointer text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={localPrefs.criticalSoundAlwaysOn}
                  onChange={(e) =>
                    setLocalPrefs({
                      ...localPrefs,
                      criticalSoundAlwaysOn: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer shrink-0"
                />
                <span>هشدار بحرانی HSE همیشه با صدا پخش شود (حتی در حالت بی‌صدا)</span>
              </label>

              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Card 2: Audio Synthesizer Studio & Test Matrix (Exact 2x2 Grid from Screenshot) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    پیش‌شنوایی و آزمایش آژیرها و اصوات هشدار:
                  </h4>
                  <p className="text-[11px] text-slate-400 font-bold">
                    تولید اصوات صنعتی با Web Audio API بدون نیاز به دانلود فایل صوتی
                  </p>
                </div>
              </div>
            </div>

            {/* 2x2 Grid matching the screenshot with full responsive elegance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              
              {/* 1. Critical HSE Siren (Top Right in RTL) */}
              <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition">
                <button
                  type="button"
                  onClick={() => {
                    if (isPlayingCustomAudio) {
                      handleStopAudio();
                    } else {
                      handleTestAudio('critical_hse');
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                  {isPlayingCustomAudio ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{isFa ? 'توقف' : 'Stop'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{testingType === 'critical_hse' ? (isFa ? 'در حال پخش...' : 'Playing...') : (isFa ? 'آزمایش' : 'Test')}</span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <span className="font-black text-rose-950 dark:text-rose-200 text-xs sm:text-sm block">
                      آژیر بحرانی HSE
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">
                      {localPrefs.criticalHseAudioMode === 'custom_mp3' && localPrefs.criticalHseCustomAudioUrl
                        ? `MP3 سفارشی (${localPrefs.criticalHseCustomAudioName || 'فایل'})`
                        : 'سنتز دیجیتال پیش‌فرض'}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 shrink-0">
                    <ShieldAlert className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>

              {/* 2. Caution Warning (Top Left in RTL) */}
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition">
                <button
                  type="button"
                  onClick={() => handleTestAudio('warning')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{testingType === 'warning' ? 'در حال پخش...' : 'آزمایش'}</span>
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-amber-950 dark:text-amber-200 text-xs sm:text-sm">
                    هشدار احتیاطی
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600">
                    <AlertTriangle className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>

              {/* 3. Success Melody (Bottom Right in RTL) */}
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition">
                <button
                  type="button"
                  onClick={() => handleTestAudio('success')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{testingType === 'success' ? 'در حال پخش...' : 'آزمایش'}</span>
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm">
                    پیام موفقیت
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>

              {/* 4. Info Chime (Bottom Left in RTL) */}
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition">
                <button
                  type="button"
                  onClick={() => handleTestAudio('info')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{testingType === 'info' ? 'در حال پخش...' : 'آزمایش'}</span>
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-blue-950 dark:text-blue-200 text-xs sm:text-sm">
                    اعلان اطلاعاتی
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600">
                    <Info className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* HSE Critical Alarm MP3 Customizer Card */}
          <HseCriticalAlarmCustomizer
            localPrefs={localPrefs}
            setLocalPrefs={setLocalPrefs}
            onPersistPrefs={persistPreferences}
            isFa={isFa}
            isPlayingCustomAudio={isPlayingCustomAudio}
            testingType={testingType}
            onTestAudio={handleTestAudio}
            onStopAudio={handleStopAudio}
            compact={false}
          />
        </div>

        {/* ════════════════════════════════════════════════════════
            RIGHT COLUMN (lg:col-span-6): Popup Policy & Live Test
           ════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Card 3: Modal Popup Policy Matrix (4 Options from Screenshot) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    نحوه نمایش پنجره اعلان (Popup در مرکز صفحه):
                  </h4>
                  <p className="text-[11px] text-slate-400 font-bold">
                    تعیین رفتار پنجره‌های پاپ‌آپ شناور در هنگام دریافت پیام‌های جدید
                  </p>
                </div>
              </div>
            </div>

            {/* The 4 options in full width */}
            <div className="space-y-3 text-xs">
              {[
                {
                  key: 'important_and_critical',
                  label: 'نمایش Popup برای هشدارهای بحرانی و مهم (پیشنهادی)',
                  desc: 'پنجره پاپ‌آپ تمام‌صفحه فقط برای رویدادهای اضطراری و پیام‌های فوری باز می‌شود.',
                },
                {
                  key: 'critical_only',
                  label: 'فقط برای هشدارهای بحرانی HSE',
                  desc: 'پاپ‌آپ صرفاً در هنگام اعلام آژیر قرمز، حریق و تخلیه اضطراری فعال می‌گردد.',
                },
                {
                  key: 'all',
                  label: 'نمایش Popup برای تمامی اعلان‌ها',
                  desc: 'کلیه اعلان‌های عادی، اطلاعاتی و اداری به صورت پنجره در مرکز صفحه باز خواهند شد.',
                },
                {
                  key: 'none',
                  label: 'عدم نمایش Popup (فقط در نوار بالای سامانه)',
                  desc: 'پنجره پاپ‌آپ غیرفعال؛ پیام‌ها تنها در فهرست زنگوله و اعلانات سایدبار ذخیره می‌شوند.',
                },
              ].map((opt) => {
                const isSelected = localPrefs.showCenterPopup === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() =>
                      setLocalPrefs({
                        ...localPrefs,
                        showCenterPopup: opt.key as any,
                      })
                    }
                    className={`p-4 rounded-2xl border cursor-pointer transition select-none flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-200 font-black shadow-xs ring-2 ring-blue-400/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Text content on right */}
                    <div className="space-y-0.5">
                      <div className="text-xs sm:text-sm font-black">{opt.label}</div>
                      <div className="text-[11px] text-slate-400 font-normal leading-relaxed">{opt.desc}</div>
                    </div>

                    {/* Radio indicator on left */}
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                        isSelected
                          ? 'border-blue-600 bg-white dark:bg-slate-900 ring-2 ring-blue-500/20'
                          : 'border-slate-300 dark:border-slate-600 bg-transparent'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 4: Live Test Alert Broadcast & Simulation */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100 block">
                  ارسال اعلان آزمایشی جهت تست زنده:
                </span>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  یک نمونه هشدار بحرانی ارسال می‌کند تا کارکرد آژیر، پاپ‌آپ و لیست پیام‌ها را ارزیابی فرمایید.
                </p>
              </div>

              <button
                type="button"
                onClick={() => triggerTestAlert('critical_hse', 'critical')}
                className="px-5 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <Sparkles className="w-4 h-4 text-rose-500" />
                <span>ارسال هشدار آزمایشی</span>
              </button>
            </div>
          </div>

          {/* Card 5: Persistent Save Toolbar (Full Width) */}
          <div className="p-6 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60 rounded-3xl border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                  ذخیره‌سازی پایدار در پایگاه داده مرکزی
                </div>
                <div className="text-[11px] text-slate-400 font-bold">
                  تغییرات شما برای کلیه مرورگرها و ورودهای بعدی حفظ خواهد شد.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  انصراف
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

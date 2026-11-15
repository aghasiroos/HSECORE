import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { BuildingDependencyCheck, FireDesignBuilding } from './types';
import { fireDesignApi } from './fireDesignApi';

interface Props {
  isFa: boolean;
  building: FireDesignBuilding | null;
  onClose: () => void;
  onConfirmDelete: (buildingId: number, confirmDependentSoftDelete: boolean) => Promise<void>;
}

export default function DeleteBuildingConfirmModal({
  isFa,
  building,
  onClose,
  onConfirmDelete,
}: Props) {
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [deps, setDeps] = useState<BuildingDependencyCheck | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!building) {
      setDeps(null);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    setLoadingDeps(true);
    setErrorMsg(null);

    fireDesignApi
      .getBuildingDependencies(building.id)
      .then((res) => {
        if (!cancelled) setDeps(res);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setErrorMsg(err?.message || 'خطا در بررسی ارتباطات و وابستگی‌های ساختمان');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDeps(false);
      });

    return () => {
      cancelled = true;
    };
  }, [building]);

  if (!building) return null;

  const isBlocked = Boolean(deps && !deps.canDelete);
  const canSubmit = !loadingDeps && !deleting && !isBlocked && deps !== null;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirmDelete(building.id, Boolean(deps?.hasDependencies));
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در حذف ساختمان');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      dir={isFa ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-2xl shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm">
                تأیید حذف ساختمان ثبت‌شده
              </h4>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{building.name}</span>
                <span className="font-mono text-[11px] text-slate-400">({building.code})</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Standard Confirmation Prompt */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
          <p className="font-black">آیا از حذف این ساختمان اطمینان دارید؟</p>
          <p className="text-slate-600 dark:text-slate-300">
            با حذف ساختمان، اطلاعات و ارتباطات وابسته به آن ممکن است تحت تأثیر قرار گیرند. لطفاً قبل از تأیید از تصمیم خود اطمینان حاصل کنید.
          </p>
        </div>

        {/* Dependency Inspection Result */}
        {loadingDeps ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>در حال بررسی ارتباط ساختمان با پروژه‌های طراحی، نقشه‌ها، محاسبات و تجهیزات...</span>
          </div>
        ) : deps ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[11px] tabular-nums">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400">طبقات</div>
                <div className="font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {deps.floorsCount}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400">نقشه‌ها</div>
                <div className="font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {deps.layoutsCount}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400">سیستم‌ها</div>
                <div className="font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {deps.systemsCount}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400">مغایرت‌ها</div>
                <div className="font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {deps.gapActionsCount}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400">تجهیزات واحد</div>
                <div className="font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {deps.linkedEquipmentCount}
                </div>
              </div>
            </div>

            {isBlocked && deps.blockReasonFa && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-black">عملیات حذف به دلیل محدودیت وابستگی متوقف شد</div>
                  <p className="leading-relaxed opacity-90">{deps.blockReasonFa}</p>
                </div>
              </div>
            )}

            {!isBlocked && deps.hasDependencies && deps.warningDetailFa && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-black">هشدار تکمیلی وجود اطلاعات وابسته</div>
                  <p className="leading-relaxed opacity-90">{deps.warningDetailFa}</p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            انصراف
          </button>
          {!isBlocked && (
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canSubmit}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{deleting ? 'در حال حذف...' : 'تأیید و حذف'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { AlertTriangle, GitCompare, RefreshCw, Save, X } from 'lucide-react';
import type { ConflictDetails } from '../../services/apiDatabaseClient';

export interface ConflictModalRequest {
  title?: string;
  message?: string;
  conflict: ConflictDetails;
  localRecord?: Record<string, any> | null;
  allowForceOverwrite?: boolean;
}

interface ActiveConflictState {
  request: ConflictModalRequest;
  resolve: (decision: 'reload' | 'overwrite' | 'cancel') => void;
}

let openConflictModalImpl: ((state: ActiveConflictState) => void) | null = null;

export function showConflictResolutionDialog(
  request: ConflictModalRequest
): Promise<'reload' | 'overwrite' | 'cancel'> {
  return new Promise((resolve) => {
    if (!openConflictModalImpl) {
      resolve('reload');
      return;
    }
    openConflictModalImpl({ request, resolve });
  });
}

/**
 * Convenience helper for module catch blocks handling HTTP 409 VERSION_CONFLICT.
 */
export async function handleVersionConflict(
  err: any,
  opts: {
    title?: string;
    localRecord?: Record<string, any> | null;
    onReloadLatest: (serverRecord?: any) => Promise<void> | void;
    onForceOverwrite?: (serverVersion: number) => Promise<void> | void;
  }
): Promise<'reload' | 'overwrite' | 'cancel'> {
  const conflict: ConflictDetails = err?.conflict || {
    serverVersion: err?.serverVersion,
    updatedAt: err?.updatedAt,
    updatedBy: err?.updatedBy,
    currentRecord: err?.currentRecord,
  };

  const decision = await showConflictResolutionDialog({
    title: opts.title,
    message: err?.message,
    conflict,
    localRecord: opts.localRecord,
    allowForceOverwrite: Boolean(opts.onForceOverwrite),
  });

  if (decision === 'reload') {
    await opts.onReloadLatest(conflict.currentRecord);
  } else if (decision === 'overwrite' && opts.onForceOverwrite) {
    const nextExpected = Number(
      conflict.serverVersion ?? conflict.currentRecord?.version ?? 1
    );
    await opts.onForceOverwrite(nextExpected);
  }

  return decision;
}

function summarizeRecordFields(record: any): Array<[string, string]> {
  if (!record || typeof record !== 'object') return [];
  const skip = new Set([
    'passwordHash',
    'password_hash',
    'fileData',
    'signatureImage',
    'profilePhoto',
  ]);
  const entries: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(record)) {
    if (skip.has(k) || entries.length >= 8) continue;
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') {
      entries.push([k, Array.isArray(v) ? `[${v.length} items]` : '{...}']);
    } else {
      entries.push([k, String(v).slice(0, 80)]);
    }
  }
  return entries;
}

export const ConflictResolutionModal: React.FC = () => {
  const [active, setActive] = useState<ActiveConflictState | null>(null);

  useEffect(() => {
    openConflictModalImpl = (nextState) => {
      setActive(nextState);
    };
    return () => {
      openConflictModalImpl = null;
    };
  }, []);

  if (!active) return null;

  const isFa =
    typeof document === 'undefined' ||
    document.documentElement.lang === 'fa' ||
    document.documentElement.dir === 'rtl';

  const { request, resolve } = active;
  const { conflict, localRecord } = request;
  const serverEntries = summarizeRecordFields(conflict?.currentRecord);
  const localEntries = summarizeRecordFields(localRecord);

  const finish = (decision: 'reload' | 'overwrite' | 'cancel') => {
    setActive(null);
    resolve(decision);
  };

  return (
    <div
      className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
      dir={isFa ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/60 dark:border-amber-700/50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {request.title ||
                  (isFa
                    ? 'تعارض هم‌زمانی ویرایش اطلاعات (HTTP 409)'
                    : 'Concurrent Edit Conflict Detected (HTTP 409)')}
              </h3>
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                {isFa
                  ? 'این رکورد پیش از ذخیره شما توسط کاربر دیگری در پایگاه داده تغییر یافته است.'
                  : 'This record was modified by another user in PostgreSQL before your changes were saved.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => finish('cancel')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 text-xs text-slate-700 dark:text-slate-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                {request.message ||
                  (isFa
                    ? 'نسخه ارسالی با نسخه فعلی پایگاه داده تطابق ندارد.'
                    : 'Submitted version does not match the current database version.')}
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                {conflict?.serverVersion !== undefined && (
                  <span>
                    {isFa ? 'نسخه فعلی سرور:' : 'Server Version:'}{' '}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      v{conflict.serverVersion}
                    </strong>
                  </span>
                )}
                {conflict?.updatedBy && (
                  <span>
                    {isFa ? 'آخرین ویرایش توسط:' : 'Updated By:'}{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {conflict.updatedBy}
                    </strong>
                  </span>
                )}
                {conflict?.updatedAt && (
                  <span>
                    {isFa ? 'زمان بروزرسانی:' : 'Updated At:'}{' '}
                    <strong className="font-mono text-slate-800 dark:text-slate-200">
                      {new Date(conflict.updatedAt).toLocaleString(isFa ? 'fa-IR' : 'en-US')}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {(serverEntries.length > 0 || localEntries.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {serverEntries.length > 0 && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/15 p-3">
                  <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 mb-2">
                    {isFa ? 'آخرین وضعیت ذخیره‌شده در سرور' : 'Latest Server Snapshot'}
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {serverEntries.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-emerald-100/60 dark:border-emerald-900/40 pb-1 last:border-0">
                        <span className="font-mono text-slate-500">{k}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[60%]">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {localEntries.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                  <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-2">
                    {isFa ? 'تغییرات محلی شما (ذخیره‌نشده)' : 'Your Unsaved Local Changes'}
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {localEntries.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/40 pb-1 last:border-0">
                        <span className="font-mono text-slate-500">{k}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[60%]">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200/70 dark:border-slate-800">
          <button
            type="button"
            onClick={() => finish('cancel')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>

          {request.allowForceOverwrite && (
            <button
              type="button"
              onClick={() => finish('overwrite')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isFa ? 'بازنویسی با نسخه من' : 'Overwrite with My Changes'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => finish('reload')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isFa ? 'بارگذاری آخرین نسخه سرور' : 'Reload Latest Server Version'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  History,
  GitBranch,
  CheckCircle2,
  Send,
  Globe,
  Archive,
  AlertTriangle,
  ArrowLeftRight,
  RotateCcw,
} from 'lucide-react';
import moment from 'moment-jalaali';
import { toast } from 'react-hot-toast';
import { sdsApi } from '../sdsApi';
import { SdsRecordItem, SdsRevisionItem } from '../types';
import { SDS_STATUS_META, SDS_16_SECTIONS, SIGNAL_WORD_META } from '../constants';

interface SdsRevisionHistoryModalProps {
  recordId: number | null;
  canEdit: boolean;
  canApprove: boolean;
  isFa: boolean;
  onClose: () => void;
  onRecordUpdated: (updated: SdsRecordItem) => void;
  onOpenFormForEdit?: (updated: SdsRecordItem) => void;
}

interface DiffRow {
  label: string;
  leftVal: string;
  rightVal: string;
}

function summarizeSnapshotDiffs(leftSnap: any, rightSnap: any): DiffRow[] {
  if (!leftSnap || !rightSnap) return [];
  const diffs: DiffRow[] = [];

  const metaFields: { key: string; label: string }[] = [
    { key: 'documentNumber', label: 'شماره سند' },
    { key: 'materialNameFa', label: 'نام فارسی ماده' },
    { key: 'materialNameEn', label: 'نام انگلیسی ماده' },
    { key: 'tradeName', label: 'نام تجاری' },
    { key: 'casNumber', label: 'شماره CAS' },
    { key: 'unNumber', label: 'شماره UN' },
    { key: 'manufacturer', label: 'سازنده' },
    { key: 'supplier', label: 'تأمین‌کننده' },
    { key: 'unitName', label: 'واحد مصرف‌کننده' },
    { key: 'storageLocation', label: 'محل مصرف / انبارش' },
    { key: 'physicalState', label: 'حالت فیزیکی' },
    { key: 'preparedDate', label: 'تاریخ تهیه' },
    { key: 'lastRevisionDate', label: 'تاریخ بازنگری' },
    { key: 'status', label: 'وضعیت' },
  ];

  for (const f of metaFields) {
    const l = String(leftSnap[f.key] ?? '-');
    const r = String(rightSnap[f.key] ?? '-');
    if (l !== r) {
      diffs.push({ label: f.label, leftVal: l || '-', rightVal: r || '-' });
    }
  }

  const lGhs = leftSnap.ghsData || {};
  const rGhs = rightSnap.ghsData || {};
  if (JSON.stringify(lGhs.pictograms || []) !== JSON.stringify(rGhs.pictograms || [])) {
    diffs.push({
      label: 'علائم GHS',
      leftVal: (lGhs.pictograms || []).join('، ') || '-',
      rightVal: (rGhs.pictograms || []).join('، ') || '-',
    });
  }
  if ((lGhs.signalWord || 'NONE') !== (rGhs.signalWord || 'NONE')) {
    diffs.push({
      label: 'واژه اخطار',
      leftVal: SIGNAL_WORD_META[lGhs.signalWord as keyof typeof SIGNAL_WORD_META]?.fa || '-',
      rightVal: SIGNAL_WORD_META[rGhs.signalWord as keyof typeof SIGNAL_WORD_META]?.fa || '-',
    });
  }
  if (JSON.stringify(lGhs.hStatements || []) !== JSON.stringify(rGhs.hStatements || [])) {
    diffs.push({
      label: 'عبارات خطر (H)',
      leftVal: (lGhs.hStatements || []).join(' | ') || '-',
      rightVal: (rGhs.hStatements || []).join(' | ') || '-',
    });
  }
  if (JSON.stringify(lGhs.pStatements || []) !== JSON.stringify(rGhs.pStatements || [])) {
    diffs.push({
      label: 'عبارات احتیاطی (P)',
      leftVal: (lGhs.pStatements || []).join(' | ') || '-',
      rightVal: (rGhs.pStatements || []).join(' | ') || '-',
    });
  }

  const lSec = leftSnap.sections || {};
  const rSec = rightSnap.sections || {};
  for (const secMeta of SDS_16_SECTIONS) {
    const lObj = lSec[secMeta.key] || {};
    const rObj = rSec[secMeta.key] || {};
    if (JSON.stringify(lObj) !== JSON.stringify(rObj)) {
      diffs.push({
        label: secMeta.titleFa,
        leftVal: JSON.stringify(lObj, null, 0).slice(0, 180) || '-',
        rightVal: JSON.stringify(rObj, null, 0).slice(0, 180) || '-',
      });
    }
  }

  return diffs;
}

export const SdsRevisionHistoryModal: React.FC<SdsRevisionHistoryModalProps> = ({
  recordId,
  canEdit,
  canApprove,
  isFa,
  onClose,
  onRecordUpdated,
  onOpenFormForEdit,
}) => {
  const [record, setRecord] = useState<SdsRecordItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // New revision prompt fields
  const [showNewRevBox, setShowNewRevBox] = useState(false);
  const [revTrigger, setRevTrigger] = useState('');
  const [revSummary, setRevSummary] = useState('');

  // Flag revision alert fields
  const [showFlagBox, setShowFlagBox] = useState(false);
  const [flagMessage, setFlagMessage] = useState('');

  // Obsolete prompt fields
  const [showObsoleteBox, setShowObsoleteBox] = useState(false);
  const [obsoleteReason, setObsoleteReason] = useState('');

  // Comparison state
  const [leftRevNum, setLeftRevNum] = useState<number | null>(null);
  const [rightRevNum, setRightRevNum] = useState<number | null>(null);

  useEffect(() => {
    if (!recordId) {
      setRecord(null);
      return;
    }
    setLoading(true);
    setShowNewRevBox(false);
    setShowFlagBox(false);
    setShowObsoleteBox(false);
    sdsApi
      .getById(recordId)
      .then((data) => {
        setRecord(data);
        const revs = data.revisions || [];
        if (revs.length >= 2) {
          setRightRevNum(revs[0].revisionNumber);
          setLeftRevNum(revs[1].revisionNumber);
        } else if (revs.length === 1) {
          setRightRevNum(revs[0].revisionNumber);
          setLeftRevNum(revs[0].revisionNumber);
        }
      })
      .catch((err: any) => {
        toast.error(err?.message || 'خطا در دریافت تاریخچه نسخه‌ها');
      })
      .finally(() => setLoading(false));
  }, [recordId]);

  const revisions: SdsRevisionItem[] = useMemo(() => record?.revisions || [], [record]);

  const diffRows = useMemo(() => {
    if (!leftRevNum || !rightRevNum || leftRevNum === rightRevNum) return [];
    const l = revisions.find((r) => r.revisionNumber === leftRevNum);
    const r = revisions.find((r) => r.revisionNumber === rightRevNum);
    return summarizeSnapshotDiffs(l?.snapshot, r?.snapshot);
  }, [leftRevNum, rightRevNum, revisions]);

  if (!recordId) return null;

  const runStatusAction = async (
    action: 'SUBMIT_REVIEW' | 'APPROVE' | 'PUBLISH' | 'MARK_OBSOLETE' | 'FLAG_REVISION' | 'RETURN_DRAFT',
    extra?: any
  ) => {
    if (!record) return;
    setBusy(true);
    try {
      const updated = await sdsApi.changeStatus(record.id, { action, ...extra });
      setRecord(updated);
      onRecordUpdated(updated);
      setShowFlagBox(false);
      setShowObsoleteBox(false);
      toast.success(isFa ? 'وضعیت سند با موفقیت بروزرسانی شد.' : 'Status updated.');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تغییر وضعیت');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNewRevision = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const updated = await sdsApi.createRevision(record.id, {
        triggerReason: revTrigger.trim() || 'بروزرسانی بر اساس سند سازنده یا ضوابط HSE',
        changeSummary: revSummary.trim() || `شروع ویرایش ${record.revisionNumber + 1}`,
        lastRevisionDate: moment().format('jYYYY/jMM/jDD'),
      });
      setRecord(updated);
      onRecordUpdated(updated);
      setShowNewRevBox(false);
      setRevTrigger('');
      setRevSummary('');
      toast.success(
        isFa
          ? `بازنگری جدید (ویرایش ${updated.revisionNumber}) ایجاد و آماده ویرایش شد.`
          : 'New revision created.'
      );
      if (onOpenFormForEdit) {
        onOpenFormForEdit(updated);
      }
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ایجاد بازنگری جدید');
    } finally {
      setBusy(false);
    }
  };

  const statusMeta = record ? SDS_STATUS_META[record.status] : null;

  return (
    <div className="fixed inset-0 z-[10055] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 truncate">
                  {record
                    ? `چرخه حیات و تاریخچه بازنگری‌ها: ${record.materialNameFa}`
                    : 'تاریخچه بازنگری SDS'}
                </h3>
                {statusMeta && (
                  <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${statusMeta.badgeClass}`}>
                    {isFa ? statusMeta.fa : statusMeta.en}
                  </span>
                )}
              </div>
              {record && (
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  شماره سند: <span className="font-mono">{record.documentNumber}</span> • ویرایش جاری:{' '}
                  <span className="font-mono">Rev.{record.revisionNumber}</span> • تهیه‌کننده:{' '}
                  {record.createdBy}
                  {record.approvedBy ? ` • تأییدکننده: ${record.approvedBy}` : ''}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading || !record ? (
            <div className="p-10 text-center text-xs font-bold text-slate-500">
              در حال دریافت اطلاعات تاریخچه و چرخه حیات...
            </div>
          ) : (
            <>
              {/* Revision Policy Notice */}
              <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs font-bold text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  تاریخ بازنگری SDS به معنای تاریخ انقضای خودکار ماده یا مستند نیست؛ بازنگری تنها در صورت تغییر مقررات، انتشار نسخه جدید سازنده یا رویه مصوب مجتمع الزامی می‌شود.
                </div>
              </div>

              {/* Lifecycle Governance Action Strip */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                  عملیات کنترل مستند و چرخه تأیید
                </div>

                <div className="flex flex-wrap gap-2">
                  {canEdit && record.status === 'DRAFT' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runStatusAction('SUBMIT_REVIEW')}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ارسال جهت بررسی و تأیید</span>
                    </button>
                  )}

                  {canApprove && (record.status === 'DRAFT' || record.status === 'UNDER_REVIEW') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runStatusAction('APPROVE')}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تأیید نهایی (Approve)</span>
                    </button>
                  )}

                  {canApprove && (record.status === 'APPROVED' || record.status === 'UNDER_REVIEW') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runStatusAction('PUBLISH')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>انتشار رسمی (Publish)</span>
                    </button>
                  )}

                  {canEdit && record.status === 'UNDER_REVIEW' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runStatusAction('RETURN_DRAFT')}
                      className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازگشت به پیش‌نویس</span>
                    </button>
                  )}

                  {canEdit && record.status !== 'OBSOLETE' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowNewRevBox((v) => !v)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>ایجاد بازنگری جدید (Rev.{record.revisionNumber + 1})</span>
                    </button>
                  )}

                  {canEdit && record.status !== 'OBSOLETE' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (record.needsRevision) {
                          runStatusAction('FLAG_REVISION', { needsRevision: false });
                        } else {
                          setShowFlagBox((v) => !v);
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                        record.needsRevision
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        {record.needsRevision ? 'رفع هشدار نیاز به بازنگری' : 'ثبت هشدار نیاز به بازنگری'}
                      </span>
                    </button>
                  )}

                  {canApprove && record.status !== 'OBSOLETE' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowObsoleteBox((v) => !v)}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>منسوخ کردن (Obsolete)</span>
                    </button>
                  )}
                </div>

                {/* New Revision Input Box */}
                {showNewRevBox && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                    <div className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                      ایجاد نسخه بازنگری جدید (نسخه قبلی به‌صورت کامل در تاریخچه حفظ می‌شود)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={revTrigger}
                        onChange={(e) => setRevTrigger(e.target.value)}
                        placeholder="علت بازنگری (مثلاً: دریافت نسخه جدید سازنده / تغییر ضوابط)"
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      />
                      <input
                        type="text"
                        value={revSummary}
                        onChange={(e) => setRevSummary(e.target.value)}
                        placeholder="خلاصه تغییرات مورد نظر در این بازنگری"
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowNewRevBox(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold cursor-pointer">انصراف</button>
                      <button type="button" disabled={busy} onClick={handleCreateNewRevision} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer">ایجاد بازنگری</button>
                    </div>
                  </div>
                )}

                {/* Flag Revision Input Box */}
                {showFlagBox && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 space-y-2.5">
                    <input
                      type="text"
                      value={flagMessage}
                      onChange={(e) => setFlagMessage(e.target.value)}
                      placeholder="علت نیاز به بازنگری (تغییر مقررات، انتشار نسخه جدید سازنده یا دستورالعمل مصوب مجتمع)"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowFlagBox(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold cursor-pointer">انصراف</button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runStatusAction('FLAG_REVISION', {
                            needsRevision: true,
                            reviewAlertMessage: flagMessage.trim(),
                            revisionTriggerReason: flagMessage.trim(),
                          })
                        }
                        className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black cursor-pointer"
                      >
                        ثبت هشدار
                      </button>
                    </div>
                  </div>
                )}

                {/* Obsolete Input Box */}
                {showObsoleteBox && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 space-y-2.5">
                    <input
                      type="text"
                      value={obsoleteReason}
                      onChange={(e) => setObsoleteReason(e.target.value)}
                      placeholder="علت منسوخ شدن این SDS (مثلاً: جایگزینی ماده یا توقف مصرف در مجتمع)..."
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowObsoleteBox(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold cursor-pointer">انصراف</button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runStatusAction('MARK_OBSOLETE', { notes: obsoleteReason.trim() })}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black cursor-pointer"
                      >
                        تأیید منسوخ‌سازی
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Version Comparison Tool */}
              {revisions.length >= 2 && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4 text-sky-600" />
                      <span>مقایسه تفاوت نسخه‌ها (Version Comparison)</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <select
                        value={leftRevNum ?? ''}
                        onChange={(e) => setLeftRevNum(Number(e.target.value))}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        {revisions.map((r) => (
                          <option key={r.id} value={r.revisionNumber}>
                            نسخه مبدا: Rev.{r.revisionNumber}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs font-black text-slate-400">↔</span>
                      <select
                        value={rightRevNum ?? ''}
                        onChange={(e) => setRightRevNum(Number(e.target.value))}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        {revisions.map((r) => (
                          <option key={r.id} value={r.revisionNumber}>
                            نسخه مقصد: Rev.{r.revisionNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {diffRows.length === 0 ? (
                    <div className="text-xs font-bold text-slate-500 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                      {leftRevNum === rightRevNum
                        ? 'برای مشاهده تغییرات، دو نسخه متفاوت را انتخاب نمایید.'
                        : 'هیچ تفاوت ساختاری بین دو نسخه انتخاب‌شده ثبت نشده است.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black">
                            <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">بخش / فیلد</th>
                            <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">مقدار در Rev.{leftRevNum}</th>
                            <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">مقدار در Rev.{rightRevNum}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {diffRows.map((d, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-black text-slate-700 dark:text-slate-200">{d.label}</td>
                              <td className="p-2.5 text-rose-700 dark:text-rose-300 font-bold break-words max-w-xs">{d.leftVal}</td>
                              <td className="p-2.5 text-emerald-700 dark:text-emerald-300 font-bold break-words max-w-xs">{d.rightVal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Revisions Timeline */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                  فهرست کامل سوابق و نسخه‌های ذخیره‌شده ({revisions.length} نسخه)
                </h4>
                {revisions.map((rev) => {
                  const st = SDS_STATUS_META[rev.statusAtSnapshot] || SDS_STATUS_META.DRAFT;
                  return (
                    <div
                      key={rev.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-mono text-[11px] font-black">
                            Rev.{rev.revisionNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${st.badgeClass}`}>
                            {st.fa}
                          </span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {rev.changeSummary || 'ثبت نسخه'}
                          </span>
                        </div>
                        {rev.triggerReason && (
                          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            مبنا / علت: {rev.triggerReason}
                          </div>
                        )}
                        <div className="text-[10px] font-bold text-slate-400 flex flex-wrap gap-3">
                          <span>تدوین/ویرایش: {rev.editorName}</span>
                          {rev.approverName && <span>تأییدکننده: {rev.approverName}</span>}
                          <span className="font-mono">
                            {moment(rev.createdAt).format('jYYYY/jMM/jDD HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

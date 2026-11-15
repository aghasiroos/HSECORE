import React, { useState } from 'react';
import { Link2, Plus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import LiftingFormModalShell from './LiftingFormModalShell';
import { liftingApi } from '../services/liftingApi';
import type { LiftingIntegrationContext, LiftingPlanRecord } from '../types';

interface Props {
  plan: LiftingPlanRecord | null;
  integration: LiftingIntegrationContext | null;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function LiftingRiskJsaTab({ plan, integration, canWrite, onRefresh, onToast }: Props) {
  const [selectedRiskId, setSelectedRiskId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Separate JSA Creation Modal state
  const [jsaModalOpen, setJsaModalOpen] = useState(false);
  const [jsaTitle, setJsaTitle] = useState('');
  const [hazardDesc, setHazardDesc] = useState(
    'سقوط بار معلق، واژگونی جرثقیل، گسیختگی اسلینگ یا شگل، برخورد با خطوط لوله/برق مجاور'
  );
  const [controlsDesc, setControlsDesc] = useState(
    'تأیید Lifting Plan، بازرسی چشمی Rigging، محصورسازی شعاع خطر، کنترل سرعت باد و حضور ریگر مجاز'
  );
  const [severity, setSeverity] = useState(4);
  const [probability, setProbability] = useState(3);

  // Separate CAPA / NC Creation Modal state
  const [ncModalOpen, setNcModalOpen] = useState(false);
  const [ncTitle, setNcTitle] = useState('');
  const [ncDesc, setNcDesc] = useState(
    'مغایرت شناسایی‌شده در ارزیابی JSA یا بازرسی تجهیزات باربرداری نیازمند اقدام اصلاحی (CAPA)'
  );
  const [ncRiskLevel, setNcRiskLevel] = useState<'HIGH' | 'CRITICAL' | 'MEDIUM'>('HIGH');

  if (!plan) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center text-sm text-slate-500">
        ابتدا یک طرح باربرداری را انتخاب کنید.
      </div>
    );
  }

  const linkedRisk = integration?.riskAssessments.find((r) => r.id === plan.linkedRiskAssessmentId) || null;
  const linkedNc = integration?.nonConformances.find((n) => n.id === plan.linkedNonConformanceId) || null;

  const openNewJsaModal = () => {
    setJsaTitle(`JSA باربرداری ${plan.planCode}: ${plan.title}`);
    setJsaModalOpen(true);
  };

  const openNewNcModal = () => {
    setNcTitle(`مغایرت ایمنی / فنی باربرداری ${plan.planCode}`);
    setNcModalOpen(true);
  };

  const handleLinkExisting = async () => {
    if (!selectedRiskId) return;
    setSubmitting(true);
    try {
      await liftingApi.linkOrCreateJsa(plan.id, { existingRiskAssessmentId: Number(selectedRiskId) });
      onToast('ارزیابی ریسک / JSA با موفقیت به طرح باربرداری متصل شد.', 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در اتصال JSA', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewJsa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await liftingApi.linkOrCreateJsa(plan.id, {
        activityTitle: jsaTitle.trim() || `JSA باربرداری ${plan.planCode}: ${plan.title}`,
        hazardDescription: hazardDesc,
        proposedControls: controlsDesc,
        severity,
        probability,
      });
      onToast('رکورد JSA در ماژول اصلی ارزیابی ریسک HSECORE ایجاد و به این طرح متصل شد.', 'success');
      setJsaModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ایجاد JSA', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await liftingApi.linkOrCreateNc(plan.id, {
        title: ncTitle.trim() || `مغایرت ایمنی / فنی باربرداری ${plan.planCode}`,
        description: ncDesc,
        riskLevel: ncRiskLevel,
      });
      onToast('عدم انطباق در ماژول مرکزی CAPA ثبت و به این طرح متصل شد.', 'success');
      setNcModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ثبت عدم انطباق', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Linked Status Summary */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              یکپارچگی مستقیم با ماژول ارزیابی ریسک (JSA) و عدم انطباق‌ها (CAPA)
            </h3>
            <p className="text-[11px] text-slate-500">
              این بخش مستقیماً به جدول مرکزی risk_assessments و non_conformances سامانه HSECORE متصل است.
            </p>
          </div>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openNewJsaModal}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت JSA جدید و اتصال</span>
              </button>
              <button
                type="button"
                onClick={openNewNcModal}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>ثبت عدم انطباق (CAPA)</span>
              </button>
            </div>
          )}
        </div>

        {linkedRisk ? (
          <div className="p-4 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  JSA متصل‌شده: {linkedRisk.assessmentCode || `#${linkedRisk.id}`} — {linkedRisk.activityTitle}
                </span>
              </span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                ریسک اولیه: {linkedRisk.initialRiskScore} ({linkedRisk.initialRiskLevel}) → باقیمانده:{' '}
                {linkedRisk.residualRiskScore || '—'}
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-200">
              <strong>خطرات شناسایی‌شده:</strong> {linkedRisk.hazardDescription}
            </p>
            <p className="text-slate-700 dark:text-slate-200">
              <strong>اقدامات کنترلی:</strong> {linkedRisk.proposedControls || linkedRisk.existingControls}
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-bold">
            هنوز هیچ JSA / ارزیابی ریسکی به این طرح متصل نشده است. برای عبور از مرحله «ارزیابی ایمنی و HSE» در گردش کار، اتصال JSA الزامی است.
          </div>
        )}

        {linkedNc && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-center justify-between">
            <span>
              <strong>عدم انطباق مرتبط ({linkedNc.trackingCode}):</strong> {linkedNc.title}
            </span>
            <span className="font-mono font-bold">وضعیت: {linkedNc.status}</span>
          </div>
        )}
      </div>

      {/* Link Existing JSA Card */}
      {canWrite && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
          <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-sky-600" />
            <span>اتصال به JSA موجود در ماژول ارزیابی ریسک</span>
          </h4>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedRiskId}
              onChange={(e) => setSelectedRiskId(e.target.value)}
              className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            >
              <option value="">
                -- انتخاب از ارزیابی‌های ثبت‌شده ({integration?.riskAssessments.length || 0}) --
              </option>
              {(integration?.riskAssessments || []).map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.methodology}] {r.assessmentCode || r.id} — {r.activityTitle} ({r.initialRiskLevel})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLinkExisting}
              disabled={!selectedRiskId || submitting}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer whitespace-nowrap"
            >
              اتصال ارزیابی انتخاب‌شده
            </button>
          </div>
        </div>
      )}

      {/* Separate JSA Creation Modal */}
      <LiftingFormModalShell
        isOpen={jsaModalOpen}
        title="ثبت سریع JSA جدید در بانک ریسک HSECORE"
        subtitle={`ایجاد رکورد ارزیابی ایمنی شغل و اتصال خودکار به طرح ${plan.planCode}`}
        icon={Plus}
        maxWidthClass="max-w-2xl"
        submitting={submitting}
        submitLabel="ثبت در بانک ریسک و اتصال به طرح"
        onClose={() => setJsaModalOpen(false)}
        onSubmit={handleCreateNewJsa}
      >
        <div className="space-y-4">
          <div>
            <label className="block font-bold mb-1.5">عنوان فعالیت / JSA *</label>
            <input
              required
              type="text"
              value={jsaTitle}
              onChange={(e) => setJsaTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">شرح مخاطرات باربرداری *</label>
            <textarea
              required
              rows={3}
              value={hazardDesc}
              onChange={(e) => setHazardDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">اقدامات کنترلی پیشنهادی *</label>
            <textarea
              required
              rows={3}
              value={controlsDesc}
              onChange={(e) => setControlsDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1.5">شدت (Severity 1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1.5">احتمال (Probability 1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={probability}
                onChange={(e) => setProbability(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
          </div>
        </div>
      </LiftingFormModalShell>

      {/* Separate NC / CAPA Creation Modal */}
      <LiftingFormModalShell
        isOpen={ncModalOpen}
        title="ثبت عدم انطباق و اقدام اصلاحی (CAPA)"
        subtitle={`ثبت در ماژول مرکزی CAPA و اتصال به طرح ${plan.planCode}`}
        icon={ShieldAlert}
        maxWidthClass="max-w-2xl"
        submitting={submitting}
        submitLabel="ثبت عدم انطباق و اتصال"
        onClose={() => setNcModalOpen(false)}
        onSubmit={handleCreateNc}
      >
        <div className="space-y-4">
          <div>
            <label className="block font-bold mb-1.5">عنوان عدم انطباق *</label>
            <input
              required
              type="text"
              value={ncTitle}
              onChange={(e) => setNcTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">سطح ریسک مغایرت</label>
            <select
              value={ncRiskLevel}
              onChange={(e) => setNcRiskLevel(e.target.value as 'HIGH' | 'CRITICAL' | 'MEDIUM')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="CRITICAL">بحرانی (CRITICAL)</option>
              <option value="HIGH">بالا (HIGH)</option>
              <option value="MEDIUM">متوسط (MEDIUM)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1.5">شرح مغایرت و اقدام اصلاحی مورد نیاز *</label>
            <textarea
              required
              rows={3}
              value={ncDesc}
              onChange={(e) => setNcDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
        </div>
      </LiftingFormModalShell>
    </div>
  );
}

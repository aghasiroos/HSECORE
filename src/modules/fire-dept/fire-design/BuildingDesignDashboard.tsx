import React from 'react';
import {
  CheckCircle2,
  Clock,
  CircleDashed,
  ShieldCheck,
  AlertOctagon,
  PackageCheck,
  FileCheck2,
  ArrowUpLeft,
} from 'lucide-react';
import type { FireSystemType } from './types';
import { BuildingDesignStatusSummary, renderFireSystemIcon } from './systemMetricsHelper';

interface Props {
  summary: BuildingDesignStatusSummary;
  onSelectSystemForDesign: (systemType: FireSystemType) => void;
  onGoToStepTwo?: () => void;
}

export default function BuildingDesignDashboard({
  summary,
  onSelectSystemForDesign,
  onGoToStepTwo,
}: Props) {
  const approvalLabel =
    summary.engineeringApprovalStage === 'APPROVED'
      ? 'تأیید نهایی مهندسی'
      : summary.engineeringApprovalStage === 'REVIEWED'
        ? 'بازبینی فنی انجام شده'
        : 'طراحی مقدماتی / پیش‌نویس';

  const approvalTone =
    summary.engineeringApprovalStage === 'APPROVED'
      ? 'text-emerald-600 dark:text-emerald-400'
      : summary.engineeringApprovalStage === 'REVIEWED'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            داشبورد وضعیت طراحی و انطباق ساختمان: {summary.building.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            کد <span className="font-mono">{summary.building.code}</span> · واحد {summary.building.unitName} ·{' '}
            <span className="tabular-nums">{summary.floorsCount}</span> طبقه ({summary.totalAreaSqm.toLocaleString()} m²)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 ${approvalTone}`}>
            <FileCheck2 className="w-4 h-4 shrink-0" />
            <span>وضعیت تأیید: {approvalLabel}</span>
          </div>
          {onGoToStepTwo && (
            <button
              type="button"
              onClick={onGoToStepTwo}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <span>انتخاب طبقه و ادامه طراحی</span>
              <ArrowUpLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Separated Progress vs Compliance Bars (Strictly Decoupled!) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200">درصد پیشرفت طراحی (پوشش ۸ سیستم)</span>
            <span className="font-mono font-black text-blue-600 dark:text-blue-400 tabular-nums text-sm">
              {summary.designProgressPercent}٪
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, summary.designProgressPercent))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            نشان‌دهنده میزان تکمیل و ثبت طراحی از مجموع ۸ سیستم حفاظت حریق ({summary.designedCount} کامل، {summary.inProgressCount} در دست اقدام، {summary.undesignedCount} طراحی‌نشده).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200">درصد انطباق استاندارد (کفایت فنی NFPA)</span>
            <span
              className={`font-mono font-black tabular-nums text-sm ${
                summary.standardCompliancePercent >= 85
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : summary.standardCompliancePercent >= 60
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.standardCompliancePercent}٪
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                summary.standardCompliancePercent >= 85
                  ? 'bg-emerald-600'
                  : summary.standardCompliancePercent >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, summary.standardCompliancePercent))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            شاخص مستقل انطباق فنی محاسبات هیدرولیک، فواصل پوشش، سازگاری عامل اطفا و نقاط کور (مجزا از درصد پیشرفت طراحی).
          </p>
        </div>
      </div>

      {/* 6 Numeric Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile
          label="سیستم‌های طراحی‌شده"
          value={`${summary.designedCount} / 8`}
          tone="text-emerald-600 dark:text-emerald-400"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricTile
          label="در دست طراحی"
          value={String(summary.inProgressCount)}
          tone="text-blue-600 dark:text-blue-400"
          icon={<Clock className="w-4 h-4 text-blue-600" />}
        />
        <MetricTile
          label="طراحی‌نشده"
          value={String(summary.undesignedCount)}
          tone="text-slate-700 dark:text-slate-300"
          icon={<CircleDashed className="w-4 h-4 text-slate-400" />}
        />
        <MetricTile
          label="تجهیزات موجود / مورد نیاز"
          value={`${summary.existingEquipmentCount} / ${summary.requiredEquipmentCount}`}
          tone="text-slate-900 dark:text-white"
          icon={<PackageCheck className="w-4 h-4 text-indigo-600" />}
        />
        <MetricTile
          label="مغایرت‌ها و CAPA باز"
          value={String(summary.totalDiscrepanciesCount)}
          tone={summary.totalDiscrepanciesCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}
          icon={<AlertOctagon className="w-4 h-4 text-rose-600" />}
        />
        <MetricTile
          label="کفایت استاندارد NFPA"
          value={`${summary.standardCompliancePercent}٪`}
          tone={summary.standardCompliancePercent >= 85 ? 'text-emerald-600' : 'text-amber-600'}
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* Quick 8-System Matrix Strip */}
      <div className="pt-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">
          وضعیت سریع هر یک از ۸ سیستم حفاظت حریق در این ساختمان (برای ورود به طراحی کلیک کنید):
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {summary.perSystem.map((item) => {
            const stateLabel =
              item.designState === 'DESIGNED'
                ? 'طراحی شده'
                : item.designState === 'IN_PROGRESS'
                  ? 'در حال طراحی'
                  : 'طراحی نشده';
            const stateTone =
              item.designState === 'DESIGNED'
                ? 'text-emerald-600 dark:text-emerald-400'
                : item.designState === 'IN_PROGRESS'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400';
            return (
              <button
                key={item.descriptor.type}
                type="button"
                onClick={() => onSelectSystemForDesign(item.descriptor.type)}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 transition-colors text-right flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 shrink-0">
                    {renderFireSystemIcon(item.descriptor.iconKey, 'w-4 h-4')}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.descriptor.shortTitleFa}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {item.descriptor.standardCode}
                    </div>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className={`text-[11px] font-bold ${stateTone}`}>{stateLabel}</div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500">
                    {item.complianceState !== 'INCOMPLETE' ? `${item.complianceScore}٪ انطباق` : '—'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className={`mt-1.5 text-lg font-black font-mono tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

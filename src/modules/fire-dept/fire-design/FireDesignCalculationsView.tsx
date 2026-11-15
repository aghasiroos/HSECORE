import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Flame,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Ban,
  MapPin,
} from 'lucide-react';
import type {
  ExtinguisherConfigInput,
  FireDesignBuilding,
  FireDesignFloor,
  FloorCalculationResult,
  SprinklerConfigInput,
} from './types';
import { getNfpa10TableCitation, getNfpa13TableCitation } from './nfpaEngine';

interface Props {
  isFa: boolean;
  building: FireDesignBuilding;
  floor: FireDesignFloor;
  calc: FloorCalculationResult;
  sprinklerConfig: SprinklerConfigInput;
  extinguisherConfig: ExtinguisherConfigInput;
  onChangeSprinklerConfig: (cfg: SprinklerConfigInput) => void;
  onChangeExtinguisherConfig: (cfg: ExtinguisherConfigInput) => void;
  onOpenCanvas: () => void;
  onOpenReports: () => void;
}

export default function FireDesignCalculationsView({
  isFa,
  building,
  floor,
  calc,
  sprinklerConfig,
  extinguisherConfig,
  onChangeSprinklerConfig,
  onChangeExtinguisherConfig,
  onOpenCanvas,
  onOpenReports,
}: Props) {
  const n13 = getNfpa13TableCitation(calc.nfpa13Edition);
  const n10 = getNfpa10TableCitation(calc.nfpa10Edition);
  const h = calc.sprinkler.hydraulics;

  if (calc.calculationStatus === 'INCOMPLETE_DATA') {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-rose-900 dark:text-rose-100">
              عدم امکان صدور محاسبات قطعی: اطلاعات ورودی ساختمان یا طبقه ناقص است
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              طبق اصول مهندسی و منطق کنترل کیفیت استاندارد، سامانه از تولید اعداد فرضی خودداری می‌کند. لطفاً موارد زیر را در تب «مشخصات ساختمان و طبقات» تکمیل کنید:
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-rose-800 dark:text-rose-200">
          {calc.missingRequiredFields.map((f) => (
            <li
              key={f}
              className="px-3 py-2 bg-white dark:bg-slate-900/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2"
            >
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Engineering Disclaimer & Editions Strip */}
      <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-950 dark:text-amber-200 leading-relaxed">
            {calc.engineeringDisclaimerFa}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenCanvas}
            className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>مشاهده و ویرایش روی نقشه دوبعدی</span>
          </button>
          <button
            type="button"
            onClick={onOpenReports}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            گزارش‌های ۸ گانه
          </button>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">گروه خطر NFPA 13 ({calc.nfpa13Edition})</div>
          <div className="text-sm font-black text-slate-900 dark:text-white mt-1">{calc.hazardGroupLabelFa}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={calc.hazardBasisCitation}>
            {calc.hazardBasisCitation}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">اسپرینکلر مورد نیاز (طبقه {floor.floorLabel})</div>
          <div className="text-2xl font-black font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {calc.sprinkler.isRequiredOrRecommended ? calc.sprinkler.calculatedHeadCount : 'جایگزین غیرآبی'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            پوشش فعلی نقشه: {calc.sprinkler.coveragePercent}% · K={calc.sprinkler.kFactor}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">خاموش‌کننده دستی NFPA 10 ({calc.nfpa10Edition})</div>
          <div className="text-2xl font-black font-mono tabular-nums text-red-600 dark:text-red-400 mt-1">
            {calc.extinguisher.requiredTotalCount} دستگاه
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            پوشش پیمایش: {calc.extinguisher.coveragePercent}% · حداکثر مشاهده: {calc.extinguisher.maxObservedTravelM}m
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">نیاز آبی کل و مخزن</div>
          <div className="text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {h.totalWaterDemandGpm} GPM
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            مخزن: {h.requiredTankVolumeLiters.toLocaleString()} L · فشار: {h.totalRequiredPressureBar} Bar
          </div>
        </div>
      </div>

      {/* Warnings & Obstruction Alerts */}
      {calc.warnings.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-300 dark:border-amber-700/70 p-4 space-y-2">
          <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>هشدارهای مهندسی، موانع سازه‌ای و الزامات ویژه</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            {calc.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 font-black">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Design Overrides & Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            انتخاب نوع نازل اسپرینکلر (NFPA 13)
          </label>
          <select
            value={sprinklerConfig.headType || ''}
            onChange={(e) =>
              onChangeSprinklerConfig({
                ...sprinklerConfig,
                headType: (e.target.value || undefined) as any,
              })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
          >
            <option value="">انتخاب هوشمند بر اساس سقف و کاربری</option>
            <option value="PENDENT">پایین‌زن استاندارد / واکنش سریع (Pendent)</option>
            <option value="UPRIGHT">بالازن صنعتی (Upright)</option>
            <option value="CONCEALED">توکار سقف کاذب (Concealed)</option>
            <option value="SIDEWALL">دیواری (Sidewall)</option>
            <option value="ESFR">واکنش سریع سرکوب‌گر (ESFR)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            ضریب K نازل اسپرینکلر
          </label>
          <select
            value={sprinklerConfig.kFactor || ''}
            onChange={(e) =>
              onChangeSprinklerConfig({
                ...sprinklerConfig,
                kFactor: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
          >
            <option value="">پیشنهاد استاندارد ({calc.sprinkler.kFactor})</option>
            <option value="5.6">K = 5.6 (80 metric) — Standard</option>
            <option value="8.0">K = 8.0 (115 metric) — Large Orifice</option>
            <option value="11.2">K = 11.2 (160 metric) — ELO</option>
            <option value="14.0">K = 14.0 (200 metric) — ESFR/CMSA</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            اولویت عامل اطفای اتاق کنترل / سرور (NFPA 10)
          </label>
          <select
            value={extinguisherConfig.preferredCleanAgent || 'CO2'}
            onChange={(e) =>
              onChangeExtinguisherConfig({
                ...extinguisherConfig,
                preferredCleanAgent: e.target.value as 'CO2' | 'CLEAN_AGENT',
              })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
          >
            <option value="CO2">دی‌اکسید کربن (CO2) — اقتصادی و رایج</option>
            <option value="CLEAN_AGENT">گاز پاک (Halotron / FM-200 / FK-5-1-12) — اتاق سرور</option>
          </select>
        </div>
      </div>

      {/* Stage 3: Detailed NFPA 13 & Hydraulics Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Droplets className="w-4 h-4 text-sky-600" />
                <span>طراحی شبکه اسپرینکلر و هیدرولیک (NFPA 13 — {calc.nfpa13Edition})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{n13.editionNoteFa}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <MetricBox label="نوع اسپرینکلر توصیه‌شده" value={calc.sprinkler.recommendedHeadLabelFa} />
            <MetricBox
              label="دمای عملگر / ضریب K"
              value={`${calc.sprinkler.tempRatingC}°C · K=${calc.sprinkler.kFactor}`}
              mono
            />
            <MetricBox
              label="حداکثر سطح پوشش هر نازل"
              value={`${calc.sprinkler.maxCoveragePerHeadSqm} m²`}
              mono
            />
            <MetricBox
              label="فاصله طراحی شبکه (X × Y)"
              value={`${calc.sprinkler.designSpacingXM} × ${calc.sprinkler.designSpacingYM} m (حداکثر ${calc.sprinkler.maxSpacingM}m)`}
              mono
            />
            <MetricBox
              label="حداقل فاصله بین اسپرینکلرها"
              value={`${calc.sprinkler.minSpacingM} m (ضابطه Cold Soldering)`}
              mono
            />
            <MetricBox
              label="حداکثر فاصله تا دیوار (S/2)"
              value={`${calc.sprinkler.maxWallDistanceM} m`}
              mono
            />
            <MetricBox
              label="چگالی طراحی (Density)"
              value={`${h.designDensityGpmSqft} gpm/ft² (${h.designDensityMmMin} mm/min)`}
              mono
            />
            <MetricBox
              label="مساحت بحرانی طراحی (Remote Area)"
              value={`${h.remoteAreaSqft} ft² (${h.remoteAreaSqm} m²)`}
              mono
            />
            <MetricBox
              label="دبی دورترین اسپرینکلر و فشار"
              value={`${h.flowPerHeadGpm} GPM (${h.flowPerHeadLpm} L/min) @ ${h.operatingPressureBar} Bar`}
              mono
            />
            <MetricBox
              label="دبی اسپرینکلر + هوز استریم"
              value={`${h.sprinklerDemandGpm} + ${h.hoseStreamAllowanceGpm} = ${h.totalWaterDemandGpm} GPM`}
              mono
            />
            <MetricBox
              label="افت اصطکاک (Hazen-Williams) و ارتفاع"
              value={`اصطکاک: ${h.frictionLossBar} Bar + ارتفاع: ${h.elevationLossBar} Bar (C=${h.cFactorUsed})`}
              mono
            />
            <MetricBox
              label="فشار کل مورد نیاز در رایزر / پمپ"
              value={`${h.totalRequiredPressureBar} Bar (${(h.totalRequiredPressureBar * 14.5038).toFixed(0)} PSI)`}
              mono
            />
          </div>

          {/* Water Tank & Pump Verification Result */}
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              h.waterSupplyStatus === 'ADEQUATE'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : h.waterSupplyStatus === 'INADEQUATE'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="font-black flex items-center gap-1.5">
              <Gauge className="w-4 h-4" />
              <span>
                {h.sourceTypeUsed === 'FIRE_NETWORK'
                  ? 'وضعیت کفایت شبکه آب و بوسترپمپ:'
                  : 'وضعیت کفایت مخزن و بوسترپمپ:'}{' '}
                {h.waterSupplyStatus === 'ADEQUATE'
                  ? 'مورد تایید (کافی)'
                  : h.waterSupplyStatus === 'INADEQUATE'
                    ? 'نامناسب / دارای کسری'
                    : 'نیازمند تکمیل داده‌های منبع آب'}
              </span>
            </div>
            <div>{h.tankCheckDetailFa}</div>
            <div>{h.pumpCheckDetailFa}</div>
            <div className="text-[11px] opacity-80 font-mono">مرجع: {h.standardRef}</div>
          </div>
        </div>

        {/* Stage 4: NFPA 10 Extinguishers & Chemical/Electrical Compatibility */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-600" />
                <span>خاموش‌کننده‌های دستی و سازگاری با مواد (NFPA 10 — {calc.nfpa10Edition})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{n10.editionNoteFa}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-2">نوع عامل اطفا</th>
                  <th className="py-2 px-2">رتبه NFPA 10</th>
                  <th className="py-2 px-2">ظرفیت</th>
                  <th className="py-2 px-2">تعداد</th>
                  <th className="py-2 px-2">محل استقرار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {calc.extinguisher.allocationByAgent.map((a) => (
                  <tr key={a.agent}>
                    <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">{a.labelFa}</td>
                    <td className="py-2.5 px-2 font-mono">{a.rating}</td>
                    <td className="py-2.5 px-2">{a.capacityFa}</td>
                    <td className="py-2.5 px-2 font-mono font-black text-red-600 dark:text-red-400">{a.requiredCount}</td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">{a.mountingLocationFa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compatibility & Forbidden Agents */}
          <div className="space-y-2.5 pt-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">ماتریس سازگاری و محدودیت‌های ایمنی عامل اطفا</h4>
            {calc.extinguisher.compatibilityMatrix.map((c) => (
              <div
                key={c.fireClass}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-slate-900 dark:text-white">
                    کلاس {c.fireClass}: {c.zoneName}
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    مجاز/توصیه‌شده: {c.recommendedLabelFa}
                  </span>
                </div>
                {c.forbiddenAgents.length > 0 && (
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
                    {c.forbiddenAgents.map((f) => (
                      <div key={f.agent} className="flex items-start gap-1.5">
                        <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>ممنوع ({f.labelFa}):</strong> {f.reasonFa}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.notesFa}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Existing vs Required Comparison + Compliance Table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="font-black text-sm text-slate-900 dark:text-white">
            مقایسه تجهیزات موجود در سامانه ({building.unitName}) با نیاز استاندارد
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 px-2">دسته تجهیز</th>
                  <th className="py-2 px-2">موجود</th>
                  <th className="py-2 px-2">مورد نیاز</th>
                  <th className="py-2 px-2">کسری / مازاد</th>
                  <th className="py-2 px-2">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {calc.comparisonRows.map((row) => (
                  <tr key={row.categoryKey}>
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-slate-900 dark:text-white">{row.categoryTitleFa}</div>
                      <div className="text-[11px] text-slate-500">{row.agentOrType}</div>
                      {row.incompatibleReasons.length > 0 && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                          {row.incompatibleReasons[0]}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold">{row.existingCount}</td>
                    <td className="py-2.5 px-2 font-mono font-bold">{row.requiredCount}</td>
                    <td className="py-2.5 px-2 font-mono font-black">
                      {row.deficitCount > 0 ? (
                        <span className="text-rose-600">-{row.deficitCount} کسری</span>
                      ) : row.surplusCount > 0 ? (
                        <span className="text-sky-600">+{row.surplusCount} مازاد</span>
                      ) : row.incompatibleCount > 0 ? (
                        <span className="text-rose-700">{row.incompatibleCount} ناسازگار</span>
                      ) : (
                        <span className="text-emerald-600">منطبق</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`text-[11px] font-black ${
                          row.status === 'ADEQUATE'
                            ? 'text-emerald-600'
                            : row.status === 'SURPLUS'
                              ? 'text-sky-600'
                              : 'text-rose-600'
                        }`}
                      >
                        {row.status === 'ADEQUATE'
                          ? 'تامین'
                          : row.status === 'SURPLUS'
                            ? 'مازاد'
                            : row.status === 'INCOMPATIBLE'
                              ? 'ناسازگار'
                              : 'کمبود'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>چک‌لیست انطباق استانداردهای NFPA 13 و NFPA 10</span>
          </h3>
          <div className="space-y-2.5">
            {calc.complianceChecks.map((chk) => (
              <div
                key={chk.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                    <span>{chk.titleFa}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      [{chk.standard} ({chk.edition}) · {chk.clause}]
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">{chk.detailFa}</p>
                </div>
                <span
                  className={`text-[11px] font-black shrink-0 flex items-center gap-1 ${
                    chk.status === 'PASS'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : chk.status === 'WARNING' || chk.status === 'INCOMPLETE'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {chk.status === 'PASS' && <CheckCircle2 className="w-4 h-4" />}
                  {chk.status === 'FAIL' && <XCircle className="w-4 h-4" />}
                  {(chk.status === 'WARNING' || chk.status === 'INCOMPLETE') && <AlertTriangle className="w-4 h-4" />}
                  <span>
                    {chk.status === 'PASS'
                      ? 'منطبق'
                      : chk.status === 'FAIL'
                        ? 'عدم انطباق'
                        : chk.status === 'INCOMPLETE'
                          ? 'ناقص'
                          : 'نیازمند بررسی'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-xs font-black text-slate-900 dark:text-white mt-0.5 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </div>
    </div>
  );
}

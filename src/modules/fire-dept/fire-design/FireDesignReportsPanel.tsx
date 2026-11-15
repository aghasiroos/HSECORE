import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Building2,
  Droplets,
  Flame,
  MapPin,
  Scale,
  EyeOff,
  ShieldCheck,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import type {
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FireDesignSystemRecord,
  FloorCalculationResult,
  PlacedSuppressionItem,
} from './types';
import {
  ENGINEERING_DISCLAIMER_FA,
  OCCUPANCY_LABELS_FA,
} from './nfpaEngine';
import { exportEightReportsToExcel, printHtmlSafely } from './fireDesignApi';

interface Props {
  isFa: boolean;
  building: FireDesignBuilding;
  floors: FireDesignFloor[];
  selectedFloor: FireDesignFloor;
  calc: FloorCalculationResult;
  placedItems: PlacedSuppressionItem[];
  systems?: FireDesignSystemRecord[];
  gapActions?: FireDesignGapAction[];
}

type ReportIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const REPORTS_META: { id: ReportIndex; titleFa: string; icon: React.ReactNode }[] = [
  { id: 1, titleFa: '۱. مشخصات ساختمان و رده خطر', icon: <Building2 className="w-4 h-4" /> },
  { id: 2, titleFa: '۲. اسپرینکلرهای مورد نیاز (NFPA 13)', icon: <Droplets className="w-4 h-4" /> },
  { id: 3, titleFa: '۳. خاموش‌کننده‌ها و سازگاری (NFPA 10)', icon: <Flame className="w-4 h-4" /> },
  { id: 4, titleFa: '۴. جانمایی تجهیزات طبقه به طبقه', icon: <MapPin className="w-4 h-4" /> },
  { id: 5, titleFa: '۵. تجهیزات موجود vs کسری / مازاد', icon: <Scale className="w-4 h-4" /> },
  { id: 6, titleFa: '۶. نقاط کور و نواحی بدون پوشش', icon: <EyeOff className="w-4 h-4" /> },
  { id: 7, titleFa: '۷. ارزیابی انطباق NFPA 13 / NFPA 10', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 8, titleFa: '۸. نیاز آبی و محاسبات هیدرولیکی', icon: <Gauge className="w-4 h-4" /> },
];

export default function FireDesignReportsPanel({
  isFa,
  building,
  floors,
  selectedFloor,
  calc,
  placedItems,
  systems = [],
  gapActions = [],
}: Props) {
  const [activeReport, setActiveReport] = useState<ReportIndex>(1);
  const h = calc.sprinkler.hydraulics;

  const handlePrintAllReports = () => {
    const html = `<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8" />
<title>گزارش جامع طراحی سیستم‌های اطفای حریق - ${building.name}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; font-size: 11px; line-height: 1.65; }
  h1 { font-size: 16px; margin: 0 0 6px 0; }
  h2 { font-size: 13px; margin: 18px 0 8px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: right; }
  th { background: #f8fafc; font-weight: bold; }
  .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; }
  .disclaimer { margin-top: 18px; padding: 10px; border: 1px solid #d97706; background: #fffbeb; font-weight: bold; }
</style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1>گزارش مهندسی ۸‌گانه طراحی و جانمایی سیستم‌های اطفای حریق (NFPA 13 / NFPA 10)</h1>
      <div>ساختمان: <strong>${building.name} (${building.code})</strong> | شرکت: ${building.companyName} | واحد: ${building.unitName}</div>
    </div>
    <div style="text-align:left;">
      <div>طبقه مورد گزارش: <strong>${selectedFloor.floorLabel}</strong></div>
      <div>استانداردها: NFPA 13 (${calc.nfpa13Edition}) & NFPA 10 (${calc.nfpa10Edition})</div>
    </div>
  </div>

  <h2>۱. مشخصات ساختمان و طبقه‌بندی خطر</h2>
  <table>
    <tr><th>کاربری</th><td>${OCCUPANCY_LABELS_FA[building.occupancyType] || building.occupancyType}</td><th>گروه خطر NFPA 13</th><td>${calc.hazardGroupLabelFa}</td></tr>
    <tr><th>نوع سازه / سقف</th><td>${building.structureType} / ${building.ceilingType}</td><th>کلاس‌های حریق</th><td>${calc.detectedFireClasses.join('، ')}</td></tr>
    <tr><th>مواد موجود</th><td colspan="3">${building.storedMaterials}</td></tr>
  </table>

  <h2>۲. طراحی اسپرینکلر مورد نیاز (NFPA 13)</h2>
  <table>
    <tr><th>نوع نازل</th><td>${calc.sprinkler.recommendedHeadLabelFa}</td><th>ضریب K / دمای عملگر</th><td>K=${calc.sprinkler.kFactor} / ${calc.sprinkler.tempRatingC}°C</td></tr>
    <tr><th>فواصل طراحی</th><td>${calc.sprinkler.designSpacingXM} × ${calc.sprinkler.designSpacingYM} m (Max ${calc.sprinkler.maxSpacingM}m)</td><th>تعداد محاسبه‌شده / پوشش</th><td>${calc.sprinkler.calculatedHeadCount} عدد (${calc.sprinkler.coveragePercent}%)</td></tr>
  </table>

  <h2>۳. خاموش‌کننده‌های دستی و سازگاری با مواد (NFPA 10)</h2>
  <table>
    <thead><tr><th>عامل اطفا</th><th>رتبه</th><th>ظرفیت</th><th>تعداد</th><th>محل نصب</th></tr></thead>
    <tbody>
      ${calc.extinguisher.allocationByAgent
        .map((a) => `<tr><td>${a.labelFa}</td><td>${a.rating}</td><td>${a.capacityFa}</td><td>${a.requiredCount}</td><td>${a.mountingLocationFa}</td></tr>`)
        .join('')}
    </tbody>
  </table>

  <h2>۴. جدول جانمایی تجهیزات روی نقشه طبقه</h2>
  <table>
    <thead><tr><th>کد</th><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>X (m)</th><th>Y (m)</th><th>توضیحات</th></tr></thead>
    <tbody>
      ${placedItems
        .map((p) => `<tr><td>${p.code}</td><td>${p.label}</td><td>${p.kind}</td><td>${p.origin === 'EXISTING' ? 'موجود' : 'پیشنهادی'}</td><td>${p.xM}</td><td>${p.yM}</td><td>${p.mountingNote || '-'}</td></tr>`)
        .join('')}
    </tbody>
  </table>

  <h2>۵. مقایسه تجهیزات موجود با کسری و مازاد</h2>
  <table>
    <thead><tr><th>دسته</th><th>موجود</th><th>مورد نیاز</th><th>کسری</th><th>مازاد</th><th>ناسازگار</th><th>وضعیت</th></tr></thead>
    <tbody>
      ${calc.comparisonRows
        .map((r) => `<tr><td>${r.categoryTitleFa}</td><td>${r.existingCount}</td><td>${r.requiredCount}</td><td>${r.deficitCount}</td><td>${r.surplusCount}</td><td>${r.incompatibleCount}</td><td>${r.status}</td></tr>`)
        .join('')}
    </tbody>
  </table>

  <h2>۶. نقاط کور و محدوده‌های بدون پوشش</h2>
  <table>
    <thead><tr><th>سیستم</th><th>محدوده (X, Y)</th><th>مساحت تقریبی (m²)</th><th>علت</th></tr></thead>
    <tbody>
      ${
        calc.uncoveredZones.length > 0
          ? calc.uncoveredZones
              .map((z) => `<tr><td>${z.system}</td><td>(${z.xM}, ${z.yM}) — ${z.widthM}×${z.heightM} m</td><td>${z.areaSqm}</td><td>${z.reasonFa}</td></tr>`)
              .join('')
          : '<tr><td colspan="4">نقطه کوری در پلان طبقه شناسایی نشد.</td></tr>'
      }
    </tbody>
  </table>

  <h2>۷. ارزیابی انطباق با استانداردهای NFPA 13 و NFPA 10</h2>
  <table>
    <thead><tr><th>استاندارد / بند</th><th>موضوع</th><th>وضعیت</th><th>شرح</th></tr></thead>
    <tbody>
      ${calc.complianceChecks
        .map((c) => `<tr><td>${c.standard} (${c.edition}) - ${c.clause}</td><td>${c.titleFa}</td><td>${c.status}</td><td>${c.detailFa}</td></tr>`)
        .join('')}
    </tbody>
  </table>

  <h2>۸. نیاز آبی و محاسبات هیدرولیکی مقدماتی (Hazen-Williams)</h2>
  <table>
    <tr><th>چگالی طراحی / مساحت بحرانی</th><td>${h.designDensityGpmSqft} gpm/ft² (${h.designDensityMmMin} mm/min) / ${h.remoteAreaSqft} ft²</td><th>دبی کل (اسپرینکلر + هوز)</th><td>${h.totalWaterDemandGpm} GPM (${h.totalWaterDemandLpm} L/min)</td></tr>
    <tr><th>افت اصطکاک / ارتفاع</th><td>${h.frictionLossBar} Bar / ${h.elevationLossBar} Bar</td><th>فشار مورد نیاز رایزر</th><td>${h.totalRequiredPressureBar} Bar</td></tr>
    <tr><th>${h.sourceTypeUsed === 'FIRE_NETWORK' ? `معادل حجم ذخیره (${h.supplyDurationMin}m)` : `حجم مخزن مورد نیاز (${h.supplyDurationMin}m)`}</th><td>${h.requiredTankVolumeLiters.toLocaleString()} لیتر</td><th>وضعیت منبع آب و پمپ</th><td>${h.waterSupplyStatus}</td></tr>
    <tr><th>ارزیابی منبع آب و پمپ</th><td colspan="3">${h.tankCheckDetailFa} | ${h.pumpCheckDetailFa}</td></tr>
  </table>

  <div class="disclaimer">${ENGINEERING_DISCLAIMER_FA}</div>
</body>
</html>`;
    printHtmlSafely(html);
  };

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Action Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-sm text-slate-900 dark:text-white">
            مرکز گزارش‌های تخصصی ۸‌گانه (ساختمان {building.name} — {selectedFloor.floorLabel})
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            خروجی اکسل چندبرگی (۸ شیت مجزا) و چاپ رسمی PDF بر اساس محاسبات لحظه‌ای پایگاه داده.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportEightReportsToExcel({
                building,
                floors,
                selectedFloor,
                calc,
                placedItems,
                systems,
                gapActions,
              })
            }
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی Excel (۸ گزارش)</span>
          </button>
          <button
            type="button"
            onClick={handlePrintAllReports}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ / PDF رسمی کامل</span>
          </button>
        </div>
      </div>

      {/* 8 Report Selector Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {REPORTS_META.map((rep) => {
          const isActive = activeReport === rep.id;
          return (
            <button
              key={rep.id}
              type="button"
              onClick={() => setActiveReport(rep.id)}
              className={`p-3 rounded-xl border text-right text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-400'
              }`}
            >
              <span className="shrink-0">{rep.icon}</span>
              <span className="truncate">{rep.titleFa}</span>
            </button>
          );
        })}
      </div>

      {/* Active Report Content Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        {activeReport === 1 && (
          <div className="space-y-4">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۱: مشخصات ساختمان، طبقات و طبقه‌بندی ریسک و خطر حریق
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <InfoRow label="نام و کد ساختمان" value={`${building.name} (${building.code})`} />
              <InfoRow label="شرکت / واحد" value={`${building.companyName} — ${building.unitName}`} />
              <InfoRow label="نوع کاربری" value={OCCUPANCY_LABELS_FA[building.occupancyType] || building.occupancyType} />
              <InfoRow label="نوع سازه و سقف" value={`${building.structureType} / ${building.ceilingType}`} />
              <InfoRow label="کلاس‌های حریق" value={calc.detectedFireClasses.join('، ')} mono />
              <InfoRow label="گروه خطر NFPA 13" value={calc.hazardGroupLabelFa} />
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <strong>مواد و فعالیت:</strong> {building.storedMaterials} — {building.activityType} |{' '}
              <strong>مبنای استاندارد:</strong> {calc.hazardBasisCitation}
            </div>
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 px-2">طبقه</th>
                  <th className="py-2 px-2">طول × عرض (m)</th>
                  <th className="py-2 px-2">مساحت (m²)</th>
                  <th className="py-2 px-2">ارتفاع سقف (m)</th>
                  <th className="py-2 px-2">سقف کاذب / عمق تیر (m)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {floors.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 px-2 font-bold">{f.floorLabel} ({f.floorCode})</td>
                    <td className="py-2 px-2 font-mono">{f.lengthM} × {f.widthM}</td>
                    <td className="py-2 px-2 font-mono">{f.areaSqm}</td>
                    <td className="py-2 px-2 font-mono">{f.ceilingHeightM}</td>
                    <td className="py-2 px-2 font-mono">{f.falseCeilingHeightM} / {f.beamDepthM}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 2 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۲: تعداد و نوع اسپرینکلر مورد نیاز طبقه ({selectedFloor.floorLabel})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoRow label="توصیه سیستم سقفی" value={calc.sprinkler.recommendedHeadLabelFa} />
              <InfoRow label="تعداد نازل محاسبه‌شده" value={`${calc.sprinkler.calculatedHeadCount} عدد`} mono />
              <InfoRow label="تعداد جانمایی‌شده در نقشه" value={`${calc.sprinkler.placedSprinklerCount} عدد (${calc.sprinkler.coveragePercent}%)`} mono />
              <InfoRow label="حداکثر سطح پوشش هر نازل" value={`${calc.sprinkler.maxCoveragePerHeadSqm} m²`} mono />
              <InfoRow label="فواصل شبکه طراحی" value={`${calc.sprinkler.designSpacingXM} × ${calc.sprinkler.designSpacingYM} m`} mono />
              <InfoRow label="حداکثر فاصله تا دیوار (S/2)" value={`${calc.sprinkler.maxWallDistanceM} m`} mono />
            </div>
            {calc.sprinkler.obstructionAlerts.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                {calc.sprinkler.obstructionAlerts.map((a, idx) => (
                  <div key={idx}>• {a}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeReport === 3 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۳: خاموش‌کننده‌های دستی و سازگاری با مواد (NFPA 10 — {calc.nfpa10Edition})
            </h4>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 px-2">عامل اطفا</th>
                  <th className="py-2 px-2">رتبه</th>
                  <th className="py-2 px-2">ظرفیت</th>
                  <th className="py-2 px-2">تعداد</th>
                  <th className="py-2 px-2">محل نصب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {calc.extinguisher.allocationByAgent.map((a) => (
                  <tr key={a.agent}>
                    <td className="py-2 px-2 font-bold">{a.labelFa}</td>
                    <td className="py-2 px-2 font-mono">{a.rating}</td>
                    <td className="py-2 px-2">{a.capacityFa}</td>
                    <td className="py-2 px-2 font-mono font-bold">{a.requiredCount}</td>
                    <td className="py-2 px-2">{a.mountingLocationFa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 4 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۴: فهرست جانمایی تجهیزات روی نقشه طبقه ({selectedFloor.floorLabel})
            </h4>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-2 px-2">کد</th>
                    <th className="py-2 px-2">عنوان</th>
                    <th className="py-2 px-2">منشاء</th>
                    <th className="py-2 px-2">مختصات (X, Y)</th>
                    <th className="py-2 px-2">شعاع (m)</th>
                    <th className="py-2 px-2">توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {placedItems.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-2 font-mono font-bold">{p.code}</td>
                      <td className="py-2 px-2">{p.label}</td>
                      <td className="py-2 px-2 font-bold">{p.origin === 'EXISTING' ? 'موجود' : 'پیشنهادی'}</td>
                      <td className="py-2 px-2 font-mono">({p.xM}, {p.yM})</td>
                      <td className="py-2 px-2 font-mono">{p.coverageRadiusM}</td>
                      <td className="py-2 px-2 text-slate-500">{p.mountingNote || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 5 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۵: مقایسه تجهیزات موجود با استاندارد (کسری، مازاد و موارد ناسازگار)
            </h4>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 px-2">تجهیز</th>
                  <th className="py-2 px-2">موجود</th>
                  <th className="py-2 px-2">نیاز استاندارد</th>
                  <th className="py-2 px-2">کسری</th>
                  <th className="py-2 px-2">مازاد</th>
                  <th className="py-2 px-2">ناسازگار</th>
                  <th className="py-2 px-2">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {calc.comparisonRows.map((r) => (
                  <tr key={r.categoryKey}>
                    <td className="py-2 px-2 font-bold">{r.categoryTitleFa}</td>
                    <td className="py-2 px-2 font-mono">{r.existingCount}</td>
                    <td className="py-2 px-2 font-mono">{r.requiredCount}</td>
                    <td className="py-2 px-2 font-mono text-rose-600 font-bold">{r.deficitCount}</td>
                    <td className="py-2 px-2 font-mono text-sky-600">{r.surplusCount}</td>
                    <td className="py-2 px-2 font-mono text-rose-700 font-bold">{r.incompatibleCount}</td>
                    <td className="py-2 px-2 font-bold">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 6 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۶: نواحی بدون پوشش و نقاط کور شناسایی‌شده در نقشه
            </h4>
            {calc.uncoveredZones.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">
                نقطه کور یا فضای خارج از پوشش در چیدمان فعلی طبقه شناسایی نشد.
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-2 px-2">سیستم</th>
                    <th className="py-2 px-2">مختصات (X, Y)</th>
                    <th className="py-2 px-2">ابعاد (m)</th>
                    <th className="py-2 px-2">مساحت (m²)</th>
                    <th className="py-2 px-2">علت فنی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {calc.uncoveredZones.map((z) => (
                    <tr key={z.id}>
                      <td className="py-2 px-2 font-bold">{z.system}</td>
                      <td className="py-2 px-2 font-mono">({z.xM}, {z.yM})</td>
                      <td className="py-2 px-2 font-mono">{z.widthM} × {z.heightM}</td>
                      <td className="py-2 px-2 font-mono font-bold text-rose-600">{z.areaSqm}</td>
                      <td className="py-2 px-2">{z.reasonFa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeReport === 7 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۷: ارزیابی انطباق با استانداردهای NFPA 13 و NFPA 10
            </h4>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 px-2">استاندارد / مرجع</th>
                  <th className="py-2 px-2">موضوع کنترل</th>
                  <th className="py-2 px-2">وضعیت</th>
                  <th className="py-2 px-2">توضیح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {calc.complianceChecks.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-2 font-mono">{c.standard} ({c.edition}) · {c.clause}</td>
                    <td className="py-2 px-2 font-bold">{c.titleFa}</td>
                    <td className="py-2 px-2 font-black">{c.status}</td>
                    <td className="py-2 px-2">{c.detailFa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 8 && (
          <div className="space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              گزارش ۸: برآورد نیاز آبی و محاسبات هیدرولیکی مقدماتی (Hazen-Williams)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoRow label="چگالی طراحی" value={`${h.designDensityGpmSqft} gpm/ft² (${h.designDensityMmMin} mm/min)`} mono />
              <InfoRow label="مساحت بحرانی (Remote Area)" value={`${h.remoteAreaSqft} ft² (${h.remoteAreaSqm} m²)`} mono />
              <InfoRow label="دبی هر نازل / فشار" value={`${h.flowPerHeadGpm} GPM @ ${h.operatingPressureBar} Bar`} mono />
              <InfoRow label="دبی کل آب اطفا (با هوز استریم)" value={`${h.totalWaterDemandGpm} GPM (${h.totalWaterDemandLpm} L/min)`} mono />
              <InfoRow label="فشار کل مورد نیاز در رایزر" value={`${h.totalRequiredPressureBar} Bar (افت اصطکاک ${h.frictionLossBar} + ارتفاع ${h.elevationLossBar})`} mono />
              <InfoRow label="حجم مخزن مورد نیاز" value={`${h.requiredTankVolumeLiters.toLocaleString()} لیتر (${h.supplyDurationMin} دقیقه)`} mono />
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div><strong>ارزیابی مخزن:</strong> {h.tankCheckDetailFa}</div>
              <div><strong>ارزیابی پمپ:</strong> {h.pumpCheckDetailFa}</div>
            </div>
          </div>
        )}

        {/* Mandatory Engineering Disclaimer */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>{ENGINEERING_DISCLAIMER_FA}</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`font-bold text-slate-900 dark:text-white mt-0.5 ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</div>
    </div>
  );
}

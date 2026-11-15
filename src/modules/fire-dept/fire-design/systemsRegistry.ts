/**
 * Extensible Fire Protection Systems Plugin Architecture
 * Allows adding new NFPA systems (Hydrant/Standpipe, Foam, Clean Agent, Fire Alarm, Pump/Tank)
 * without altering the core Building/Floor/Canvas/Reports infrastructure.
 */

import type {
  FireDesignBuilding,
  FireDesignFloor,
  FireSystemType,
  PlacedSuppressionItem,
} from './types';
import {
  resolveHasFirePump,
  resolveWaterSourceType,
  toNullablePositiveNumber,
} from './waterSupplyUtils';

export interface SystemFieldDef {
  key: string;
  labelFa: string;
  type: 'number' | 'select' | 'text' | 'boolean';
  unit?: string;
  defaultValue: any;
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface SystemEvaluationOutput {
  systemType: FireSystemType;
  standardCode: string;
  standardEdition: string;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | 'INCOMPLETE';
  missingFields: string[];
  summaryMetrics: { labelFa: string; value: string; highlight?: 'ok' | 'warn' | 'bad' }[];
  clauseCitations: string[];
  recommendationsFa: string[];
  suggestedItems: PlacedSuppressionItem[];
}

export interface FireProtectionSystemPlugin {
  type: FireSystemType;
  titleFa: string;
  titleEn: string;
  standardCode: string;
  supportedEditions: string[];
  defaultEdition: string;
  scope: 'FLOOR' | 'BUILDING';
  descriptionFa: string;
  fields: SystemFieldDef[];
  evaluate: (params: {
    building: FireDesignBuilding;
    floor?: FireDesignFloor | null;
    edition: string;
    inputs: Record<string, any>;
    placedItems?: PlacedSuppressionItem[];
  }) => SystemEvaluationOutput;
}

export interface UnifiedFireSystemDescriptor {
  type: FireSystemType;
  titleFa: string;
  titleEn: string;
  shortTitleFa: string;
  standardCode: string;
  supportedEditions: string[];
  defaultEdition: string;
  scope: 'FLOOR' | 'BUILDING';
  engineKind: 'CORE_FLOOR' | 'PLUGIN';
  iconKey:
    | 'SPRINKLER'
    | 'EXTINGUISHER'
    | 'HYDRANT'
    | 'FOAM'
    | 'CLEAN_AGENT'
    | 'ALARM'
    | 'PUMP'
    | 'TANK';
  descriptionFa: string;
}

export const ALL_EIGHT_FIRE_SYSTEMS: UnifiedFireSystemDescriptor[] = [
  {
    type: 'SPRINKLER_NFPA13',
    titleFa: 'سیستم اسپرینکلر اتوماتیک',
    titleEn: 'Automatic Sprinkler System',
    shortTitleFa: 'اسپرینکلر',
    standardCode: 'NFPA 13',
    supportedEditions: ['2022', '2019', '2016'],
    defaultEdition: '2022',
    scope: 'FLOOR',
    engineKind: 'CORE_FLOOR',
    iconKey: 'SPRINKLER',
    descriptionFa: 'محاسبه شبکه نازل‌ها، رده خطر، چگالی بارش، هیدرولیک Hazen-Williams، تداخل موانع و Cold Soldering',
  },
  {
    type: 'EXTINGUISHER_NFPA10',
    titleFa: 'خاموش‌کننده‌های دستی',
    titleEn: 'Portable Fire Extinguishers',
    shortTitleFa: 'خاموش‌کننده دستی',
    standardCode: 'NFPA 10',
    supportedEditions: ['2022', '2018'],
    defaultEdition: '2022',
    scope: 'FLOOR',
    engineKind: 'CORE_FLOOR',
    iconKey: 'EXTINGUISHER',
    descriptionFa: 'تعیین تعداد، ظرفیت، ماتریس سازگاری عوامل اطفا با کلاس‌های A/B/C/D/K و حداکثر فاصله پیمایش',
  },
  {
    type: 'STANDPIPE_HYDRANT_NFPA14',
    titleFa: 'هیدرانت و جعبه آتش‌نشانی',
    titleEn: 'Standpipe, Hose Box & Hydrant',
    shortTitleFa: 'هیدرانت و هوزباکس',
    standardCode: 'NFPA 14',
    supportedEditions: ['2024', '2019', '2016'],
    defaultEdition: '2024',
    scope: 'FLOOR',
    engineKind: 'PLUGIN',
    iconKey: 'HYDRANT',
    descriptionFa: 'محاسبه کلاس لوله قائم (I/II/III)، دبی و فشار نازل، پوشش شیلنگ و دسترسی جعبه‌های آتش‌نشانی',
  },
  {
    type: 'FOAM_NFPA11',
    titleFa: 'سیستم اطفای حریق فوم',
    titleEn: 'Foam Extinguishing System',
    shortTitleFa: 'سیستم فوم',
    standardCode: 'NFPA 11',
    supportedEditions: ['2021', '2016'],
    defaultEdition: '2021',
    scope: 'FLOOR',
    engineKind: 'PLUGIN',
    iconKey: 'FOAM',
    descriptionFa: 'تعیین نوع فوم (AFFF / AR-AFFF)، نرخ کاربرد، درصد اختلاط، ذخیره کنسانتره و جانمایی مانیتور فوم',
  },
  {
    type: 'CLEAN_AGENT_NFPA2001',
    titleFa: 'سیستم اطفای گاز پاک',
    titleEn: 'Clean Agent Suppression System',
    shortTitleFa: 'گاز پاک',
    standardCode: 'NFPA 2001',
    supportedEditions: ['2022', '2018'],
    defaultEdition: '2022',
    scope: 'FLOOR',
    engineKind: 'PLUGIN',
    iconKey: 'CLEAN_AGENT',
    descriptionFa: 'محاسبه جرم گاز پاک (Novec 1230 / FM-200 / IG-541)، بررسی حد ایمن NOAEL و جانمایی نازل‌ها',
  },
  {
    type: 'FIRE_ALARM_NFPA72',
    titleFa: 'سیستم اعلام حریق خودکار',
    titleEn: 'Fire Detection & Alarm System',
    shortTitleFa: 'اعلام حریق',
    standardCode: 'NFPA 72',
    supportedEditions: ['2022', '2019', '2016'],
    defaultEdition: '2022',
    scope: 'FLOOR',
    engineKind: 'PLUGIN',
    iconKey: 'ALARM',
    descriptionFa: 'محاسبه و جانمایی دتکتورهای دود/حرارت/گاز، شستی اعلام حریق، آژیر/فلاشر و سناریوی Cause & Effect',
  },
  {
    type: 'PUMP_NFPA20',
    titleFa: 'سیستم پمپ آتش‌نشانی',
    titleEn: 'Stationary Fire Pump System',
    shortTitleFa: 'پمپ آتش‌نشانی',
    standardCode: 'NFPA 20',
    supportedEditions: ['2022', '2019'],
    defaultEdition: '2022',
    scope: 'BUILDING',
    engineKind: 'PLUGIN',
    iconKey: 'PUMP',
    descriptionFa: 'ارزیابی پمپ اصلی، رزرو دیزلی، جوکی پمپ، نقطه کار، محدودیت Churn 140%، اضافه بار 150% و تست NFPA 25',
  },
  {
    type: 'TANK_NFPA22',
    titleFa: 'مخزن آب آتش‌نشانی',
    titleEn: 'Water Storage Tank for Fire Protection',
    shortTitleFa: 'مخزن آب حریق',
    standardCode: 'NFPA 22',
    supportedEditions: ['2022', '2019'],
    defaultEdition: '2022',
    scope: 'BUILDING',
    engineKind: 'PLUGIN',
    iconKey: 'TANK',
    descriptionFa: 'محاسبه ظرفیت خالص و ناخالص مخزن ذخیره آب (+۱۰٪ مارجین مکش)، نرخ پرشدن مجدد و کنترل تجهیزات حفاظتی مخزن',
  },
];

export const FIRE_SYSTEM_PLUGINS: FireProtectionSystemPlugin[] = [
  {
    type: 'STANDPIPE_HYDRANT_NFPA14',
    titleFa: 'سیستم هیدرانت، لوله قائم و جعبه آتش‌نشانی',
    titleEn: 'Standpipe, Hose Box & Hydrant System',
    standardCode: 'NFPA 14',
    supportedEditions: ['2024', '2019', '2016'],
    defaultEdition: '2024',
    scope: 'FLOOR',
    descriptionFa: 'محاسبه کلاس لوله قائم (I/II/III)، دبی و فشار نازل، پوشش شیلنگ و دسترسی جعبه‌های آتش‌نشانی',
    fields: [
      {
        key: 'standpipeClass',
        labelFa: 'کلاس سیستم لوله قائم',
        type: 'select',
        defaultValue: 'CLASS_III',
        options: [
          { value: 'CLASS_I', label: 'Class I (اتصال ۲.۵ اینچ آتش‌نشانی — ۱۰۰ PSI)' },
          { value: 'CLASS_II', label: 'Class II (هوزریل/شیلنگ ۱.۵ اینچ — ۶۵ PSI)' },
          { value: 'CLASS_III', label: 'Class III (ترکیبی ۱.۵ و ۲.۵ اینچ)' },
        ],
      },
      {
        key: 'hoseLengthM',
        labelFa: 'طول شیلنگ جعبه/هوزریل (متر)',
        type: 'number',
        unit: 'm',
        defaultValue: 30,
        required: true,
      },
      {
        key: 'riserCount',
        labelFa: 'تعداد رایزر (ستون لوله قائم)',
        type: 'number',
        defaultValue: 1,
        required: true,
      },
      {
        key: 'availablePressureBar',
        labelFa: 'فشار تامین‌شده شبکه هیدرانت/رایزر (Bar)',
        type: 'number',
        unit: 'Bar',
        defaultValue: '',
      },
    ],
    evaluate: ({ building, floor, edition, inputs }) => {
      const missing: string[] = [];
      if (!floor) missing.push('انتخاب طبقه');
      const hoseLen = Number(inputs.hoseLengthM || 30);
      const risers = Math.max(1, Number(inputs.riserCount || 1));
      const sClass = inputs.standpipeClass || 'CLASS_III';

      if (!floor || floor.areaSqm <= 0) {
        return {
          systemType: 'STANDPIPE_HYDRANT_NFPA14',
          standardCode: 'NFPA 14',
          standardEdition: edition,
          complianceStatus: 'INCOMPLETE',
          missingFields: [...missing, 'مساحت و ابعاد طبقه'],
          summaryMetrics: [],
          clauseCitations: [`NFPA 14 (${edition}) Ch. 7`],
          recommendationsFa: ['اطلاعات ابعاد طبقه را تکمیل کنید.'],
          suggestedItems: [],
        };
      }

      // NFPA 14 Ch. 7: Class I/III = 500 gpm first standpipe + 250 gpm each additional (max 1000/1250 gpm)
      const flowGpm =
        sClass === 'CLASS_II' ? 100 : Math.min(1250, 500 + Math.max(0, risers - 1) * 250);
      const minOutletPressureBar = sClass === 'CLASS_II' ? 4.5 : 6.9; // 65 psi vs 100 psi
      const effectiveReachM = Math.min(45, hoseLen + 6); // hose + jet throw
      const maxTravelAllowedM = building.occupancyType === 'WAREHOUSE' ? 40 : 45.7; // 150 ft typical hose reach

      const cols = Math.max(1, Math.ceil(floor.lengthM / (effectiveReachM * 1.4)));
      const rows = Math.max(1, Math.ceil(floor.widthM / (effectiveReachM * 1.4)));
      const requiredBoxes = Math.max(risers, cols * rows);
      const effCols = Math.max(cols, Math.ceil(requiredBoxes / rows));

      const availBar = inputs.availablePressureBar ? Number(inputs.availablePressureBar) : null;
      let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' = 'NEEDS_REVIEW';
      if (availBar !== null) {
        status = availBar >= minOutletPressureBar ? 'COMPLIANT' : 'NON_COMPLIANT';
      }

      const suggestedItems: PlacedSuppressionItem[] = [];
      let idx = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < effCols; c++) {
          if (idx > requiredBoxes) break;
          suggestedItems.push({
            id: `hyd-prop-${floor.id}-${idx}`,
            kind: 'HYDRANT_HOSE_PROPOSED',
            systemType: 'STANDPIPE_HYDRANT_NFPA14',
            origin: 'PROPOSED',
            code: `HB-${floor.floorCode}-${String(idx).padStart(2, '0')}`,
            label: `جعبه آتش‌نشانی / هوزریل (${sClass}) #${idx}`,
            xM: Number((effCols === 1 ? 1.0 : 0.8 + (c * Math.max(1, floor.lengthM - 1.6)) / Math.max(1, effCols - 1)).toFixed(2)),
            yM: Number((r === 0 ? 0.8 : floor.widthM - 0.8).toFixed(2)),
            coverageRadiusM: effectiveReachM,
            capacityLabel: `شیلنگ ${hoseLen}m`,
            mountingNote: `کنار راه‌پله/خروجی اضطراری با شیر زاویه‌ای مطابق NFPA 14 (${edition})`,
          });
          idx++;
        }
      }

      return {
        systemType: 'STANDPIPE_HYDRANT_NFPA14',
        standardCode: 'NFPA 14',
        standardEdition: edition,
        complianceStatus: status,
        missingFields: availBar === null ? ['فشار تامین‌شده شبکه (Bar) برای تایید نهایی'] : [],
        summaryMetrics: [
          { labelFa: 'تعداد جعبه / ایستگاه شیلنگ مورد نیاز', value: `${requiredBoxes} دستگاه` },
          { labelFa: 'دبی طراحی رایزر (NFPA 14 Ch. 7)', value: `${flowGpm} GPM (${Math.round(flowGpm * 3.785)} L/min)` },
          { labelFa: 'حداقل فشار باقیمانده نازل', value: `${minOutletPressureBar} Bar (${sClass === 'CLASS_II' ? '65' : '100'} PSI)` },
          { labelFa: 'شعاع پوشش عملیاتی هر ایستگاه', value: `${effectiveReachM} متر (حداکثر ${maxTravelAllowedM}m)` },
        ],
        clauseCitations: [
          `NFPA 14 (${edition}) Sec. 7.3 (Travel Distance & Hose Reach)`,
          `NFPA 14 (${edition}) Sec. 7.8 & 7.10 (Minimum Pressure & Flow Rates)`,
        ],
        recommendationsFa: [
          availBar === null
            ? 'برای تایید قطعی انطباق فشار، فشار استاتیک/باقیمانده شبکه هیدرانت را ثبت کنید.'
            : availBar < minOutletPressureBar
              ? `فشار شبکه (${availBar} Bar) کمتر از حداقل استاندارد (${minOutletPressureBar} Bar) است؛ بوسترپمپ یا اصلاح خط الزامی است.`
              : 'فشار و دبی طراحی هیدرانت و جعبه آتش‌نشانی مطابق استاندارد تامین می‌شود.',
        ],
        suggestedItems,
      };
    },
  },

  {
    type: 'FOAM_NFPA11',
    titleFa: 'سیستم اطفای حریق فوم (مایعات قابل اشتعال)',
    titleEn: 'Foam Fire Extinguishing System',
    standardCode: 'NFPA 11',
    supportedEditions: ['2021', '2016'],
    defaultEdition: '2021',
    scope: 'FLOOR',
    descriptionFa: 'تعیین نوع فوم، نرخ کاربرد، درصد اختلاط، دبی محلول، ذخیره کنسانتره فوم و جانمایی مانیتور/چمبر فوم',
    fields: [
      {
        key: 'fuelType',
        labelFa: 'نوع سوخت / مایع قابل اشتعال',
        type: 'select',
        defaultValue: 'HYDROCARBON',
        options: [
          { value: 'HYDROCARBON', label: 'هیدروکربن غیرقطبی (بنزین، نفت، گازوئیل، پلی‌اتیلن)' },
          { value: 'POLAR_SOLVENT', label: 'حلال قطبی (الکل، استون، متانول، MTBE)' },
        ],
      },
      {
        key: 'hazardAreaSqm',
        labelFa: 'مساحت حوضچه / زون پرخطر فوم (مترمربع)',
        type: 'number',
        unit: 'm²',
        defaultValue: 200,
        required: true,
      },
      {
        key: 'concentratePercent',
        labelFa: 'درصد اختلاط فوم (%)',
        type: 'select',
        defaultValue: '3',
        options: [
          { value: '1', label: '۱٪ (AFFF 1%)' },
          { value: '3', label: '۳٪ (AFFF / AR-AFFF 3%)' },
          { value: '6', label: '۶٪ (AR-AFFF Polar 6%)' },
        ],
      },
      {
        key: 'availableFoamLiters',
        labelFa: 'ذخیره کنسانتره فوم موجود (لیتر)',
        type: 'number',
        unit: 'L',
        defaultValue: '',
      },
    ],
    evaluate: ({ building, floor, edition, inputs }) => {
      const fuel = inputs.fuelType || 'HYDROCARBON';
      const areaSqm = Number(inputs.hazardAreaSqm || floor?.areaSqm || 0);
      const pct = Number(inputs.concentratePercent || (fuel === 'POLAR_SOLVENT' ? 6 : 3));

      if (areaSqm <= 0) {
        return {
          systemType: 'FOAM_NFPA11',
          standardCode: 'NFPA 11',
          standardEdition: edition,
          complianceStatus: 'INCOMPLETE',
          missingFields: ['مساحت زون حوضچه / مایعات قابل اشتعال'],
          summaryMetrics: [],
          clauseCitations: [`NFPA 11 (${edition}) Ch. 5`],
          recommendationsFa: [],
          suggestedItems: [],
        };
      }

      // NFPA 11 Sec. 5.2: Hydrocarbons = 4.1 L/min.m2 (0.10 gpm/ft2), Polar solvents = 6.5 L/min.m2 (0.16 gpm/ft2)
      const appRateLpmSqm = fuel === 'POLAR_SOLVENT' ? 6.5 : 4.1;
      const durationMin = fuel === 'POLAR_SOLVENT' ? 55 : 30; // NFPA 11 Table 5.2.5.2.2
      const solutionFlowLpm = Math.round(areaSqm * appRateLpmSqm);
      const concentrateLpm = Number(((solutionFlowLpm * pct) / 100).toFixed(1));
      const requiredFoamReserveLiters = Math.ceil(concentrateLpm * durationMin * 1.1); // +10% piping reserve
      const requiredWaterLiters = Math.ceil((solutionFlowLpm - concentrateLpm) * durationMin);

      const recommendedFoamFa =
        fuel === 'POLAR_SOLVENT'
          ? 'AR-AFFF (فوم مقاوم در برابر حلال‌های قطبی / الکل)'
          : 'AFFF / F3 Fluorine-Free (فوم فیلم‌ساز مناسب هیدروکربن)';

      const availFoam = inputs.availableFoamLiters ? Number(inputs.availableFoamLiters) : null;
      const incompatiblePct = fuel === 'POLAR_SOLVENT' && pct < 3;
      let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' = 'NEEDS_REVIEW';
      if (incompatiblePct || (availFoam !== null && availFoam < requiredFoamReserveLiters)) {
        status = 'NON_COMPLIANT';
      } else if (availFoam !== null && availFoam >= requiredFoamReserveLiters) {
        status = 'COMPLIANT';
      }

      const monitorCount = Math.max(1, Math.ceil(areaSqm / 350));
      const suggestedItems: PlacedSuppressionItem[] = [];
      if (floor) {
        for (let i = 1; i <= monitorCount; i++) {
          suggestedItems.push({
            id: `foam-prop-${floor.id}-${i}`,
            kind: 'FOAM_MONITOR_PROPOSED',
            systemType: 'FOAM_NFPA11',
            origin: 'PROPOSED',
            code: `FM-MON-${String(i).padStart(2, '0')}`,
            label: `مانیتور / پکیج فوم ${pct}% #${i}`,
            xM: Number(((i / (monitorCount + 1)) * floor.lengthM).toFixed(2)),
            yM: 1.5,
            coverageRadiusM: 18,
            capacityLabel: `${solutionFlowLpm} L/min`,
            mountingNote: `${recommendedFoamFa} — ذخیره مورد نیاز ${requiredFoamReserveLiters} لیتر`,
          });
        }
      }

      return {
        systemType: 'FOAM_NFPA11',
        standardCode: 'NFPA 11',
        standardEdition: edition,
        complianceStatus: status,
        missingFields: availFoam === null ? ['حجم ذخیره کنسانتره فوم موجود (لیتر)'] : [],
        summaryMetrics: [
          { labelFa: 'نوع فوم استاندارد', value: recommendedFoamFa },
          { labelFa: 'نرخ کاربرد طراحی (Application Rate)', value: `${appRateLpmSqm} L/min·m² (${durationMin} دقیقه)` },
          { labelFa: 'دبی محلول فوم مورد نیاز', value: `${solutionFlowLpm.toLocaleString()} L/min` },
          { labelFa: 'ذخیره کنسانتره فوم مورد نیاز (+۱۰٪ رزرو)', value: `${requiredFoamReserveLiters.toLocaleString()} لیتر` },
          { labelFa: 'آب مورد نیاز اطفا', value: `${requiredWaterLiters.toLocaleString()} لیتر` },
        ],
        clauseCitations: [
          `NFPA 11 (${edition}) Sec. 5.2 (Minimum Application Rates & Duration)`,
          `NFPA 11 (${edition}) Sec. 4.3 (Foam Concentrate Compatibility)`,
        ],
        recommendationsFa: [
          incompatiblePct
            ? 'هشدار ناسازگاری: برای حلال‌های قطبی باید از فوم AR-AFFF با درصد طراحی ۳٪ یا ۶٪ استفاده شود.'
            : 'سازگاری نوع فوم با ماده قابل اشتعال تایید است.',
          availFoam !== null && availFoam < requiredFoamReserveLiters
            ? `کسری ذخیره فوم: موجود ${availFoam.toLocaleString()} لیتر < مورد نیاز ${requiredFoamReserveLiters.toLocaleString()} لیتر.`
            : 'در صورت موجودی تانک فوم بالای سقف نیاز، وضعیت ذخیره قابل قبول است.',
        ],
        suggestedItems,
      };
    },
  },

  {
    type: 'CLEAN_AGENT_NFPA2001',
    titleFa: 'سیستم اطفای گاز پاک (اتاق سرور و کنترل)',
    titleEn: 'Clean Agent Suppression System',
    standardCode: 'NFPA 2001',
    supportedEditions: ['2022', '2018'],
    defaultEdition: '2022',
    scope: 'FLOOR',
    descriptionFa: 'محاسبه جرم عامل پاک (FM-200 / Novec 1230 / IG-541)، بررسی NOAEL/LOAEL حضور افراد، نشت‌بندی و نازل‌ها',
    fields: [
      {
        key: 'agentName',
        labelFa: 'نوع گاز پاک (Clean Agent)',
        type: 'select',
        defaultValue: 'FK_5_1_12',
        options: [
          { value: 'FK_5_1_12', label: 'FK-5-1-12 (Novec 1230) — دوستدار محیط زیست' },
          { value: 'HFC_227EA', label: 'HFC-227ea (FM-200)' },
          { value: 'IG_541', label: 'IG-541 (Inergen — گاز خنثی)' },
        ],
      },
      {
        key: 'roomAreaSqm',
        labelFa: 'مساحت اتاق تحت پوشش (مترمربع)',
        type: 'number',
        unit: 'm²',
        defaultValue: 60,
        required: true,
      },
      {
        key: 'roomHeightM',
        labelFa: 'ارتفاع خالص اتاق + سقف/کف کاذب (متر)',
        type: 'number',
        unit: 'm',
        defaultValue: 3.5,
        required: true,
      },
      {
        key: 'isNormallyOccupied',
        labelFa: 'فضا دارای حضور دائم پرسنل است؟',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'doorFanTested',
        labelFa: 'تست نشت‌بندی (Door Fan Integrity Test) انجام شده؟',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    evaluate: ({ floor, edition, inputs }) => {
      const areaSqm = Number(inputs.roomAreaSqm || floor?.areaSqm || 0);
      const heightM = Number(inputs.roomHeightM || floor?.ceilingHeightM || 0);
      const volumeM3 = Number((areaSqm * heightM).toFixed(1));
      if (volumeM3 <= 0) {
        return {
          systemType: 'CLEAN_AGENT_NFPA2001',
          standardCode: 'NFPA 2001',
          standardEdition: edition,
          complianceStatus: 'INCOMPLETE',
          missingFields: ['مساحت و ارتفاع خالص فضای حفاظت‌شده'],
          summaryMetrics: [],
          clauseCitations: [`NFPA 2001 (${edition}) Ch. 5`],
          recommendationsFa: [],
          suggestedItems: [],
        };
      }

      // NFPA 2001 Annex A / Table A.5.5 flooding calculations at 21°C
      const agent = inputs.agentName || 'FK_5_1_12';
      let designConcPct = 4.5;
      let specificVolumeM3Kg = 0.0719; // FK-5-1-12 @ 21C: s = 0.0664 + 0.000274*T
      let noaelPct = 10.0;
      let loaelPct = 10.0;
      let agentLabel = 'FK-5-1-12 (Novec 1230)';

      if (agent === 'HFC_227EA') {
        designConcPct = 7.9; // Class A/C typical min 7.5-8.7%
        specificVolumeM3Kg = 0.137; // 0.1269 + 0.000513*21
        noaelPct = 9.0;
        loaelPct = 10.5;
        agentLabel = 'HFC-227ea (FM-200)';
      } else if (agent === 'IG_541') {
        designConcPct = 38.5;
        specificVolumeM3Kg = 0.706;
        noaelPct = 43.0;
        loaelPct = 52.0;
        agentLabel = 'IG-541 (Inergen)';
      }

      // Flooding equation W = (V / s) * (C / (100 - C))
      const agentWeightKg = Number(
        ((volumeM3 / specificVolumeM3Kg) * (designConcPct / (100 - designConcPct))).toFixed(1)
      );
      const cylinderSizeKg = agent === 'IG_541' ? 40 : 80;
      const cylindersNeeded = Math.max(1, Math.ceil(agentWeightKg / cylinderSizeKg));
      const nozzlesNeeded = Math.max(1, Math.ceil(areaSqm / 36)); // ~6x6m per 360 nozzle

      const occupied = inputs.isNormallyOccupied !== false;
      const safeForOccupied = designConcPct <= noaelPct;
      const doorFanOk = Boolean(inputs.doorFanTested);

      const status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' =
        occupied && !safeForOccupied ? 'NON_COMPLIANT' : doorFanOk ? 'COMPLIANT' : 'NEEDS_REVIEW';

      const suggestedItems: PlacedSuppressionItem[] = [];
      if (floor) {
        const cols = Math.max(1, Math.ceil(Math.sqrt(nozzlesNeeded)));
        const rows = Math.max(1, Math.ceil(nozzlesNeeded / cols));
        let n = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (n > nozzlesNeeded) break;
            suggestedItems.push({
              id: `ca-noz-${floor.id}-${n}`,
              kind: 'CLEAN_AGENT_NOZZLE',
              systemType: 'CLEAN_AGENT_NFPA2001',
              origin: 'PROPOSED',
              code: `CA-NZ-${String(n).padStart(2, '0')}`,
              label: `نازل ${agentLabel} #${n}`,
              xM: Number((((c + 0.5) * floor.lengthM) / cols).toFixed(2)),
              yM: Number((((r + 0.5) * floor.widthM) / rows).toFixed(2)),
              coverageRadiusM: 4.5,
              capacityLabel: `${designConcPct}%`,
              mountingNote: 'نازل سقفی ۳۶۰ درجه با تخلیه ۱۰ ثانیه‌ای',
            });
            n++;
          }
        }
        suggestedItems.push({
          id: `ca-cyl-${floor.id}-1`,
          kind: 'CLEAN_AGENT_CYLINDER',
          systemType: 'CLEAN_AGENT_NFPA2001',
          origin: 'PROPOSED',
          code: `CA-BANK-01`,
          label: `منیفولد ${cylindersNeeded} سیلندر ${agentLabel}`,
          xM: 1.0,
          yM: 1.0,
          coverageRadiusM: 2.0,
          capacityLabel: `${agentWeightKg} kg`,
          mountingNote: 'همراه با سوئیچ فشار، شاسی تخلیه دستی و آژیر هشدار ۳۰ ثانیه پیش از تخلیه',
        });
      }

      return {
        systemType: 'CLEAN_AGENT_NFPA2001',
        standardCode: 'NFPA 2001',
        standardEdition: edition,
        complianceStatus: status,
        missingFields: !doorFanOk ? ['انجام و ثبت نتیجه آزمون نشت‌بندی فضا (Door Fan 10-min Hold)'] : [],
        summaryMetrics: [
          { labelFa: 'حجم خالص فضای حفاظت‌شده', value: `${volumeM3.toLocaleString()} m³` },
          { labelFa: 'مقدار گاز پاک مورد نیاز', value: `${agentWeightKg} kg (${cylindersNeeded} سیلندر)` },
          { labelFa: 'غلظت طراحی / حد ایمن NOAEL', value: `${designConcPct}% (NOAEL: ${noaelPct}%)`, highlight: safeForOccupied ? 'ok' : 'bad' },
          { labelFa: 'تعداد نازل سقفی پیشنهادی', value: `${nozzlesNeeded} عدد` },
        ],
        clauseCitations: [
          `NFPA 2001 (${edition}) Sec. 1.5 (Safety Limits — NOAEL ${noaelPct}% / LOAEL ${loaelPct}%)`,
          `NFPA 2001 (${edition}) Ch. 5 (Total Flooding Quantity & 10-min Retention)`,
        ],
        recommendationsFa: [
          'نصب آژیر و فلاشر هشدار پیش از تخلیه (Pre-discharge 30s) و شستی Abort Switch کنار خروجی‌ها الزامی است.',
          doorFanOk
            ? 'تست نشت‌بندی اتاق برای نگهداری غلظت ۱۰ دقیقه‌ای تایید شده است.'
            : 'درزبندی دیوارها، دمپرهای خودکار تهویه و انجام تست Door Fan پیش از راه‌اندازی الزامی است.',
        ],
        suggestedItems,
      };
    },
  },

  {
    type: 'FIRE_ALARM_NFPA72',
    titleFa: 'سیستم اعلام حریق خودکار (دتکتور، شستی و آژیر)',
    titleEn: 'Fire Detection & Alarm System',
    standardCode: 'NFPA 72',
    supportedEditions: ['2022', '2019', '2016'],
    defaultEdition: '2022',
    scope: 'FLOOR',
    descriptionFa: 'محاسبه و جانمایی دتکتورهای دود/حرارت/گاز، شستی اعلام حریق، آژیر/فلاشر، زون‌بندی و سناریوی Cause & Effect',
    fields: [
      {
        key: 'detectorType',
        labelFa: 'نوع دتکتور اصلی طبقه',
        type: 'select',
        defaultValue: 'SMOKE',
        options: [
          { value: 'SMOKE', label: 'دتکتور دود اپتیکال (Smoke — فاصله استاندارد ۹.۱m)' },
          { value: 'HEAT', label: 'دتکتور حرارتی (Heat — مناسب موتورخانه/آشپزخانه/غبارآلود)' },
          { value: 'MULTI_GAS', label: 'ترکیبی دود + گازسنج صنعتی (LEL/CO/H2S)' },
        ],
      },
      {
        key: 'panelType',
        labelFa: 'نوع پنل مرکزی اعلام حریق (FACP)',
        type: 'select',
        defaultValue: 'ADDRESSABLE',
        options: [
          { value: 'ADDRESSABLE', label: 'آدرس‌پذیر هوشمند (Addressable Loop)' },
          { value: 'CONVENTIONAL', label: 'متعارف زونی (Conventional Zones)' },
        ],
      },
      {
        key: 'exitsCount',
        labelFa: 'تعداد درهای خروج طبقه (جهت شستی و آژیر)',
        type: 'number',
        defaultValue: 2,
        required: true,
      },
    ],
    evaluate: ({ building, floor, edition, inputs }) => {
      if (!floor || floor.areaSqm <= 0) {
        return {
          systemType: 'FIRE_ALARM_NFPA72',
          standardCode: 'NFPA 72',
          standardEdition: edition,
          complianceStatus: 'INCOMPLETE',
          missingFields: ['ابعاد و ارتفاع سقف طبقه'],
          summaryMetrics: [],
          clauseCitations: [`NFPA 72 (${edition}) Ch. 17`],
          recommendationsFa: [],
          suggestedItems: [],
        };
      }

      const detType = inputs.detectorType || 'SMOKE';
      // NFPA 72 Sec. 17.7.3.2.3: 9.1m (30 ft) nominal smooth ceiling spacing for smoke; derate for high ceiling > 3m
      const baseSpacingM = detType === 'HEAT' ? 7.6 : 9.1;
      const heightDerate = floor.ceilingHeightM > 6 ? 0.7 : floor.ceilingHeightM > 3.6 ? 0.85 : 1.0;
      const beamDerate = floor.beamDepthM > 0.3 ? 0.8 : 1.0;
      const effectiveSpacingM = Number((baseSpacingM * heightDerate * beamDerate).toFixed(2));

      const cols = Math.max(1, Math.ceil(floor.lengthM / effectiveSpacingM));
      const rows = Math.max(1, Math.ceil(floor.widthM / effectiveSpacingM));
      const detectorCount = cols * rows;
      const exits = Math.max(1, Number(inputs.exitsCount || 2));
      const pullStationsCount = Math.max(exits, Math.ceil(floor.lengthM / 61)); // NFPA 72 Sec. 17.14.8.5 (200 ft = 61m)
      const hornStrobesCount = Math.max(exits, Math.ceil(floor.areaSqm / 250));

      const suggestedItems: PlacedSuppressionItem[] = [];
      let dIdx = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          suggestedItems.push({
            id: `det-prop-${floor.id}-${dIdx}`,
            kind: detType === 'HEAT' ? 'DETECTOR_HEAT' : detType === 'MULTI_GAS' ? 'DETECTOR_GAS' : 'DETECTOR_SMOKE',
            systemType: 'FIRE_ALARM_NFPA72',
            origin: 'PROPOSED',
            code: `${detType === 'HEAT' ? 'HD' : detType === 'MULTI_GAS' ? 'GD' : 'SD'}-${floor.floorCode}-${String(dIdx).padStart(2, '0')}`,
            label: `دتکتور ${detType === 'HEAT' ? 'حرارتی' : detType === 'MULTI_GAS' ? 'دود/گاز' : 'دود'} #${dIdx}`,
            xM: Number((((c + 0.5) * floor.lengthM) / cols).toFixed(2)),
            yM: Number((((r + 0.5) * floor.widthM) / rows).toFixed(2)),
            coverageRadiusM: Number((effectiveSpacingM / 1.414).toFixed(2)),
            mountingNote: `فاصله طراحی ${effectiveSpacingM}m مطابق NFPA 72 (${edition}) Ch. 17`,
          });
          dIdx++;
        }
      }

      for (let p = 1; p <= pullStationsCount; p++) {
        suggestedItems.push({
          id: `mcp-prop-${floor.id}-${p}`,
          kind: 'PULL_STATION',
          systemType: 'FIRE_ALARM_NFPA72',
          origin: 'PROPOSED',
          code: `MCP-${floor.floorCode}-${String(p).padStart(2, '0')}`,
          label: `شستی اعلام حریق #${p}`,
          xM: Number(((p / (pullStationsCount + 1)) * floor.lengthM).toFixed(2)),
          yM: 0.5,
          coverageRadiusM: 30,
          mountingNote: 'نصب در مسیر خروج در ارتفاع ۱.۰۷ تا ۱.۲۲ متر (NFPA 72 Sec. 17.14.8)',
        });
      }

      for (let h = 1; h <= hornStrobesCount; h++) {
        suggestedItems.push({
          id: `hs-prop-${floor.id}-${h}`,
          kind: 'HORN_STROBE',
          systemType: 'FIRE_ALARM_NFPA72',
          origin: 'PROPOSED',
          code: `AV-${floor.floorCode}-${String(h).padStart(2, '0')}`,
          label: `آژیر و فلاشر #${h}`,
          xM: Number(((h / (hornStrobesCount + 1)) * floor.lengthM).toFixed(2)),
          yM: Number(Math.max(1, floor.widthM - 0.6).toFixed(2)),
          coverageRadiusM: 15,
          mountingNote: 'حداقل ۱۵ دسی‌بل بالاتر از نویز محیط + همگام‌سازی فلاشر',
        });
      }

      return {
        systemType: 'FIRE_ALARM_NFPA72',
        standardCode: 'NFPA 72',
        standardEdition: edition,
        complianceStatus: 'COMPLIANT',
        missingFields: [],
        summaryMetrics: [
          { labelFa: 'تعداد دتکتور مورد نیاز', value: `${detectorCount} عدد (فاصله ${effectiveSpacingM}m)` },
          { labelFa: 'تعداد شستی اعلام حریق (MCP)', value: `${pullStationsCount} عدد` },
          { labelFa: 'تعداد آژیر و فلاشر (NAC)', value: `${hornStrobesCount} عدد` },
          { labelFa: 'باتری بک‌آپ پنل (NFPA 72 Sec. 10.6.7)', value: '۲۴ ساعت آماده به کار + ۱۵ دقیقه آلارم' },
        ],
        clauseCitations: [
          `NFPA 72 (${edition}) Sec. 17.7 (Smoke/Heat Detector Spacing & Ceiling Derating)`,
          `NFPA 72 (${edition}) Sec. 17.14.8.5 (Manual Fire Alarm Boxes ≤ 61m Travel)`,
          `NFPA 72 (${edition}) Ch. 18 (Notification Appliances & Cause-and-Effect)`,
        ],
        recommendationsFa: [
          `سناریوی Cause & Effect برای ${building.name}: با فعال‌شدن دتکتورهای کراس-زون/شستی، دستور قطع برق غیرضروری، بستن دمپرهای حریق و ارسال آلارم به ایستگاه آتش‌نشانی صادر شود.`,
        ],
        suggestedItems,
      };
    },
  },

  {
    type: 'PUMP_NFPA20',
    titleFa: 'سیستم پمپ آتش‌نشانی (الکتریکی، دیزلی و جوکی)',
    titleEn: 'Fire Pump System',
    standardCode: 'NFPA 20',
    supportedEditions: ['2022', '2019'],
    defaultEdition: '2022',
    scope: 'BUILDING',
    descriptionFa: 'ارزیابی دبی و هد نامی پمپ اصلی، شرط پمپ رزرو دیزلی، سایزینگ جوکی پمپ، منحنی ۱۴۰٪/۱۵۰٪ و برنامه آزمون NFPA 25',
    fields: [
      { key: 'totalDemandGpm', labelFa: 'دبی کل طراحی سیستم‌های متصل (GPM)', type: 'number', unit: 'GPM', defaultValue: 750, required: true },
      { key: 'requiredHeadBar', labelFa: 'فشار مورد نیاز سیستم در خروجی پمپ (Bar)', type: 'number', unit: 'Bar', defaultValue: 8.0, required: true },
      {
        key: 'pumpDriverType',
        labelFa: 'پیکربندی محرک ایستگاه پمپاژ',
        type: 'select',
        defaultValue: 'ELECTRIC_MAIN_DIESEL_STANDBY',
        options: [
          { value: 'ELECTRIC_MAIN_DIESEL_STANDBY', label: 'الکتروپمپ اصلی + پمپ رزرو دیزلی ۱۰۰٪ (استاندارد کامل)' },
          { value: 'DIESEL_ONLY', label: 'پمپ‌های دیزلی مستقل بدون نیاز به شبکه برق' },
          { value: 'ELECTRIC_ONLY', label: 'فقط الکتروپمپ (نیازمند برق اضطراری مطمئن)' },
        ],
      },
      { key: 'hasStandbyDieselPump', labelFa: 'پمپ رزرو دیزلی ۱۰۰٪ یا تغذیه دوگانه تاییدشده موجود است؟', type: 'boolean', defaultValue: true },
      { key: 'hasJockeyPump', labelFa: 'جوکی پمپ (Pressure Maintenance) در مدار نصب است؟', type: 'boolean', defaultValue: true },
      { key: 'lastFlowTestDate', labelFa: 'تاریخ آخرین تست دبی سالیانه (NFPA 25)', type: 'text', defaultValue: '' },
    ],
    evaluate: ({ building, edition, inputs }) => {
      const ws = building.waterSupply || {};
      const demandGpm = Number(inputs.totalDemandGpm || 0);
      const reqBar = Number(inputs.requiredHeadBar || 0);

      if (demandGpm <= 0 || reqBar <= 0) {
        return {
          systemType: 'PUMP_NFPA20',
          standardCode: 'NFPA 20',
          standardEdition: edition,
          complianceStatus: 'INCOMPLETE',
          missingFields: ['دبی کل طراحی پمپ (GPM)', 'فشار مورد نیاز در خروجی پمپ (Bar)'],
          summaryMetrics: [],
          clauseCitations: [`NFPA 20 (${edition}) Sec. 4.7 & 6.2`],
          recommendationsFa: [],
          suggestedItems: [],
        };
      }

      const jockeyFlowGpm = Math.max(5, Math.round(demandGpm * 0.02));
      const jockeyStopBar = Number((reqBar + 0.7).toFixed(2));
      const jockeyStartBar = Number((jockeyStopBar - 0.5).toFixed(2));
      const mainStartBar = Number(Math.max(2, jockeyStartBar - 0.5).toFixed(2));
      const maxChurnBar = Number((reqBar * 1.4).toFixed(2));
      const overloadFlowGpm = Math.round(demandGpm * 1.5);
      const overloadMinBar = Number((reqBar * 0.65).toFixed(2));

      const existingPumpGpm = toNullablePositiveNumber(ws.pumpRatedFlowGpm) ?? 0;
      const existingPumpBar = toNullablePositiveNumber(ws.pumpRatedPressureBar) ?? 0;
      const hasPumpFlag = resolveHasFirePump(ws);
      const sourceType = resolveWaterSourceType(building, 'STORAGE_TANK');
      const staticOrResidualBar =
        toNullablePositiveNumber(ws.residualPressureBar) ?? toNullablePositiveNumber(ws.staticPressureBar) ?? 0;
      const noPumpDeclared = hasPumpFlag === false;
      const hasMissingBuildingSupply = !noPumpDeclared && (!existingPumpGpm || !existingPumpBar);

      const hasBackup = inputs.hasStandbyDieselPump !== false;
      const hasJockey = inputs.hasJockeyPump !== false;

      const isOk = noPumpDeclared
        ? sourceType === 'FIRE_NETWORK' && staticOrResidualBar >= reqBar
        : !hasMissingBuildingSupply &&
          existingPumpGpm >= demandGpm &&
          existingPumpBar >= reqBar &&
          hasBackup &&
          hasJockey;

      return {
        systemType: 'PUMP_NFPA20',
        standardCode: 'NFPA 20 / NFPA 25',
        standardEdition: edition,
        complianceStatus: hasMissingBuildingSupply ? 'NEEDS_REVIEW' : isOk ? 'COMPLIANT' : 'NON_COMPLIANT',
        missingFields: hasMissingBuildingSupply
          ? ['دبی (GPM) و فشار نامی (Bar) پمپ موجود در شناسنامه ساختمان تکمیل نشده است']
          : [],
        summaryMetrics: [
          {
            labelFa: 'نقطه کار نامی پمپ اصلی و رزرو',
            value: `${demandGpm} GPM @ ${reqBar} Bar (Churn ≤ ${maxChurnBar} Bar)`,
            highlight: noPumpDeclared
              ? isOk
                ? 'ok'
                : 'bad'
              : !hasMissingBuildingSupply
                ? existingPumpGpm >= demandGpm && existingPumpBar >= reqBar
                  ? 'ok'
                  : 'bad'
                : undefined,
          },
          {
            labelFa: 'نقطه ۱۵۰٪ اضافه‌بار مجاز (NFPA 20)',
            value: `${overloadFlowGpm} GPM @ ≥ ${overloadMinBar} Bar (حداقل ۶۵٪ هد)`,
          },
          {
            labelFa: 'مشخصات و نقاط تنظیم جوکی پمپ',
            value: `${jockeyFlowGpm} GPM (Start ${jockeyStartBar} / Stop ${jockeyStopBar} Bar — Main Start ${mainStartBar} Bar)`,
            highlight: hasJockey ? 'ok' : 'warn',
          },
          {
            labelFa: 'مقایسه با پمپ ثبت‌شده ساختمان',
            value: noPumpDeclared
              ? sourceType === 'FIRE_NETWORK'
                ? `بدون پمپ اختصاصی (فشار شبکه: ${staticOrResidualBar} Bar)`
                : 'پمپ آتش‌نشانی در شناسنامه ساختمان ثبت نشده (ندارد)'
              : hasMissingBuildingSupply
                ? 'در انتظار ثبت اطلاعات پلاک پمپ'
                : `${existingPumpGpm} GPM @ ${existingPumpBar} Bar`,
            highlight: noPumpDeclared
              ? isOk
                ? 'ok'
                : 'bad'
              : !hasMissingBuildingSupply
                ? isOk
                  ? 'ok'
                  : 'bad'
                : 'warn',
          },
        ],
        clauseCitations: [
          `NFPA 20 (${edition}) Sec. 4.7 & 6.2 (Rated Flow, 140% Max Churn & 150% Overload @ 65% Head)`,
          `NFPA 20 (${edition}) Sec. 4.26 (Pressure Maintenance / Jockey Pump Sizing)`,
          `NFPA 25 (${edition}) Ch. 8 (Weekly No-Flow Test & Annual Flow Test)`,
        ],
        recommendationsFa: [
          noPumpDeclared
            ? isOk
              ? `ساختمان بدون پمپ آتش‌نشانی و متصل به شبکه پرفشار (${staticOrResidualBar} Bar ≥ ${reqBar} Bar) است؛ در صورت افت فشار فصلی، نصب بوسترپمپ NFPA 20 توصیه می‌شود.`
              : 'ساختمان فاقد پمپ آتش‌نشانی است و فشار شبکه/منبع به تنهایی پاسخگوی هد طراحی نیست؛ طراحی ایستگاه پمپاژ NFPA 20 الزامی است.'
            : hasMissingBuildingSupply
              ? 'مشخصات پلاک پمپ موجود را در بخش اطلاعات ساختمان وارد کنید تا کفایت دبی و فشار بررسی شود.'
              : isOk
                ? 'پمپ آتش‌نشانی و تجهیزات پشتیبان منطبق با ضوابط NFPA 20 ارزیابی شدند.'
                : 'ظرفیت یا فشار پمپ موجود، شرط پمپ رزرو دیزلی یا وجود جوکی پمپ با نیاز طراحی هم‌خوانی ندارد؛ ارتقا یا اصلاح الزامی است.',
          inputs.lastFlowTestDate
            ? `آخرین تست دبی سالیانه NFPA 25 در تاریخ ${inputs.lastFlowTestDate} ثبت شده است.`
            : 'تاریخ آخرین آزمون دبی سالیانه NFPA 25 ثبت نشده است؛ تست منحنی پمپ باید برنامه‌ریزی شود.',
        ],
        suggestedItems: [],
      };
    },
  },

  {
    type: 'TANK_NFPA22',
    titleFa: 'مخزن ذخیره آب آتش‌نشانی',
    titleEn: 'Fire Protection Water Storage Tank',
    standardCode: 'NFPA 22',
    supportedEditions: ['2022', '2019'],
    defaultEdition: '2022',
    scope: 'BUILDING',
    descriptionFa: 'محاسبه حجم مفید مخزن آتش‌نشانی، اعمال ۱۰٪ حاشیه حجم غیرقابل برداشت مکش (Vortex)، نرخ پرشدن مجدد و کنترل سطح/گرمایش',
    fields: [
      { key: 'totalDemandGpm', labelFa: 'حداکثر دبی آب اطفا (اسپرینکلر + هوز/فوم) (GPM)', type: 'number', unit: 'GPM', defaultValue: 750, required: true },
      { key: 'durationMin', labelFa: 'مدت تداوم الزامی تامین آب (دقیقه)', type: 'number', unit: 'min', defaultValue: 60, required: true },
      {
        key: 'tankType',
        labelFa: 'نوع سازه مخزن آب',
        type: 'select',
        defaultValue: 'STEEL_BOLTED',
        options: [
          { value: 'STEEL_BOLTED', label: 'فولادی پیچ و مهره‌ای یا جوشی سطحی (Welded/Bolted Steel)' },
          { value: 'CONCRETE_UNDERGROUND', label: 'بتنی مدفون یا نیمه‌مدفون (Reinforced Concrete)' },
          { value: 'FRP_FIBERGLASS', label: 'مخزن کامپوزیت / فایبرگلاس تاییدشده' },
        ],
      },
      { key: 'refillRateLpm', labelFa: 'دبی خط پرکن جبرانی شبکه (لیتر بر دقیقه)', type: 'number', unit: 'L/min', defaultValue: 400 },
      { key: 'hasLevelAlarmAndVortex', labelFa: 'مجهز به نشانگر سطح، آلارم کم‌شدن آب و صفحه گرداب‌گیر (Anti-Vortex) است؟', type: 'boolean', defaultValue: true },
    ],
    evaluate: ({ building, edition, inputs }) => {
      const ws = building.waterSupply || {};
      const demandGpm = Number(inputs.totalDemandGpm || 0);
      const durMin = Number(inputs.durationMin || 0);
      const refillLpm = Math.max(0, Number(inputs.refillRateLpm || 0));

      if (demandGpm <= 0 || durMin <= 0) {
        return {
          systemType: 'TANK_NFPA22',
          standardCode: 'NFPA 22',
          standardEdition: edition,
          complianceStatus: 'INCOMPLETE',
          missingFields: ['حداکثر دبی آب اطفا (GPM)', 'مدت تداوم تامین آب (دقیقه)'],
          summaryMetrics: [],
          clauseCitations: [`NFPA 22 (${edition}) Ch. 4`],
          recommendationsFa: [],
          suggestedItems: [],
        };
      }

      const netEffectiveLiters = Math.ceil(demandGpm * 3.78541 * durMin);
      const grossRequiredLiters = Math.ceil(netEffectiveLiters * 1.1); // +10% unusable suction / vortex / dead storage
      const refillTimeHours = refillLpm > 0 ? Number((netEffectiveLiters / (refillLpm * 60)).toFixed(1)) : null;

      const sourceType = resolveWaterSourceType(building, 'STORAGE_TANK');
      const isNetworkOnly = sourceType === 'FIRE_NETWORK';
      const existingTankLiters = toNullablePositiveNumber(ws.tankCapacityLiters) ?? 0;
      const hasMissingBuildingTank = !isNetworkOnly && !existingTankLiters;
      const hasVortexAndAlarm = inputs.hasLevelAlarmAndVortex !== false;

      const isOk = isNetworkOnly
        ? hasVortexAndAlarm
        : !hasMissingBuildingTank && existingTankLiters >= grossRequiredLiters && hasVortexAndAlarm;
      const deficitLiters = isNetworkOnly ? 0 : Math.max(0, grossRequiredLiters - existingTankLiters);

      return {
        systemType: 'TANK_NFPA22',
        standardCode: 'NFPA 22',
        standardEdition: edition,
        complianceStatus: isNetworkOnly
          ? 'COMPLIANT'
          : hasMissingBuildingTank
            ? 'NEEDS_REVIEW'
            : isOk
              ? 'COMPLIANT'
              : 'NON_COMPLIANT',
        missingFields: hasMissingBuildingTank
          ? ['ظرفیت مخزن ذخیره آب موجود در شناسنامه ساختمان تکمیل نشده است']
          : [],
        summaryMetrics: [
          { labelFa: 'حجم مفید مورد نیاز اطفا (Net Effective)', value: `${netEffectiveLiters.toLocaleString()} لیتر (${durMin} دقیقه)` },
          {
            labelFa: 'ظرفیت اسمی کل مخزن (+۱۰٪ حجم مرده مکش)',
            value: `${grossRequiredLiters.toLocaleString()} لیتر (${(grossRequiredLiters / 1000).toFixed(1)} m³)`,
          },
          {
            labelFa: 'مقایسه با مخزن موجود ساختمان',
            value: isNetworkOnly
              ? 'تأمین مستقیم از شبکه آب آتش‌نشانی (بدون مخزن اختصاصی)'
              : hasMissingBuildingTank
                ? 'ثبت‌نشده در شناسنامه ساختمان'
                : deficitLiters > 0
                  ? `${existingTankLiters.toLocaleString()} لیتر (کسری ${deficitLiters.toLocaleString()} لیتر)`
                  : `${existingTankLiters.toLocaleString()} لیتر (کافی)`,
            highlight: isNetworkOnly ? 'ok' : hasMissingBuildingTank ? 'warn' : deficitLiters > 0 ? 'bad' : 'ok',
          },
          {
            labelFa: 'زمان بازیابی و پرشدن مجدد مخزن (NFPA 22 ≤ 8h)',
            value: refillTimeHours !== null ? `${refillTimeHours} ساعت (@ ${refillLpm} L/min)` : 'خط پرکن ثبت نشده',
            highlight: refillTimeHours !== null && refillTimeHours <= 8 ? 'ok' : 'warn',
          },
        ],
        clauseCitations: [
          `NFPA 22 (${edition}) Ch. 4 & 14 (Net Capacity, Anti-Vortex Plate & 8-Hour Automatic Refill)`,
          `NFPA 25 (${edition}) Ch. 9 (Water Storage Tank Interior/Exterior Inspection)`,
        ],
        recommendationsFa: [
          isNetworkOnly
            ? `منبع آب این ساختمان روی «شبکه آب آتش‌نشانی» تنظیم شده و مخزن اختصاصی الزام نشده است؛ در صورت نیاز به مخزن ذخیره پشتیبان، حداقل ظرفیت اسمی ${grossRequiredLiters.toLocaleString()} لیتر پیشنهاد می‌شود.`
            : hasMissingBuildingTank
              ? 'ظرفیت فعلی مخزن آب آتش‌نشانی را در اطلاعات ساختمان ثبت کنید تا کسری یا کفایت محاسبه شود.'
              : deficitLiters > 0
                ? `مخزن موجود ${deficitLiters.toLocaleString()} لیتر کسری دارد؛ افزایش حجم یا افزودن مخزن موازی با کلکتور مشترک توصیه می‌شود.`
                : 'ظرفیت مخزن ذخیره آب آتش‌نشانی پاسخگوی تقاضای طراحی و حاشیه ایمنی NFPA 22 است.',
          !hasVortexAndAlarm
            ? 'نصب صفحه Anti-Vortex در مکش پمپ و ترانسمیتر/آلارم سطح پایین در اتاق کنترل آتش‌نشانی الزامی است.'
            : refillTimeHours !== null && refillTimeHours > 8
              ? `زمان پرشدن مجدد (${refillTimeHours} ساعت) بیش از ۸ ساعت توصیه‌شده است؛ قطر خط آب جبرانی بررسی شود.`
              : 'شرایط تجهیزاتی مخزن (گرداب‌گیر و آلارم سطح) مطابق الزامات استاندارد است.',
        ],
        suggestedItems: [],
      };
    },
  },
];

export function getSystemPlugin(type: FireSystemType): FireProtectionSystemPlugin | undefined {
  if (type === 'PUMP_TANK_NFPA20_22') {
    return FIRE_SYSTEM_PLUGINS.find((p) => p.type === 'PUMP_NFPA20');
  }
  return FIRE_SYSTEM_PLUGINS.find((p) => p.type === type);
}

export function getSystemDescriptor(type: FireSystemType): UnifiedFireSystemDescriptor | undefined {
  if (type === 'PUMP_TANK_NFPA20_22') {
    return ALL_EIGHT_FIRE_SYSTEMS.find((d) => d.type === 'PUMP_NFPA20');
  }
  return ALL_EIGHT_FIRE_SYSTEMS.find((d) => d.type === type);
}


import * as XLSX from 'xlsx';
import { authFetch } from '../../../services/apiDatabaseClient';
import type {
  BuildingDependencyCheck,
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FireDesignLayout,
  FireDesignSystemRecord,
  FireSystemType,
  FloorCalculationResult,
  PlacedSuppressionItem,
} from './types';
import {
  ENGINEERING_DISCLAIMER_FA,
  ExistingEquipmentSummaryItem,
  OCCUPANCY_LABELS_FA,
} from './nfpaEngine';

export interface FireDesignBootstrapResponse {
  buildings: FireDesignBuilding[];
  floors: FireDesignFloor[];
  layouts: FireDesignLayout[];
  systems: FireDesignSystemRecord[];
  gapActions: FireDesignGapAction[];
  companies: { id: number; name: string; code: string }[];
  units: { id: number; name: string; code: string }[];
  existingEquipmentCount: number;
  existingEquipment: ExistingEquipmentSummaryItem[];
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `خطای سرور (${res.status})`);
  }
  return payload.data as T;
}

export const fireDesignApi = {
  async bootstrap(): Promise<FireDesignBootstrapResponse> {
    const res = await authFetch('/api/v1/fire-design/bootstrap');
    return parseJsonResponse<FireDesignBootstrapResponse>(res);
  },

  async createBuilding(data: Partial<FireDesignBuilding>): Promise<FireDesignBuilding> {
    const res = await authFetch('/api/v1/fire-design/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<FireDesignBuilding>(res);
  },

  async updateBuilding(id: number, data: Partial<FireDesignBuilding>): Promise<FireDesignBuilding> {
    const res = await authFetch(`/api/v1/fire-design/buildings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<FireDesignBuilding>(res);
  },

  async getBuildingDependencies(id: number): Promise<BuildingDependencyCheck> {
    const res = await authFetch(`/api/v1/fire-design/buildings/${id}/dependencies`);
    return parseJsonResponse<BuildingDependencyCheck>(res);
  },

  async deleteBuilding(id: number, confirmDependentSoftDelete = false): Promise<{ id: number; softDeleted: boolean }> {
    const res = await authFetch(`/api/v1/fire-design/buildings/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmDependentSoftDelete }),
    });
    return parseJsonResponse<{ id: number; softDeleted: boolean }>(res);
  },

  async createFloor(data: Partial<FireDesignFloor>): Promise<FireDesignFloor> {
    const res = await authFetch('/api/v1/fire-design/floors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<FireDesignFloor>(res);
  },

  async updateFloor(id: number, data: Partial<FireDesignFloor>): Promise<FireDesignFloor> {
    const res = await authFetch(`/api/v1/fire-design/floors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<FireDesignFloor>(res);
  },

  async deleteFloor(id: number): Promise<void> {
    const res = await authFetch(`/api/v1/fire-design/floors/${id}`, { method: 'DELETE' });
    await parseJsonResponse(res);
  },

  async calculateFloor(body: {
    building?: FireDesignBuilding;
    floor?: FireDesignFloor;
    buildingId?: number;
    floorId?: number;
    sprinklerConfig?: any;
    extinguisherConfig?: any;
    placedItems?: PlacedSuppressionItem[];
  }): Promise<FloorCalculationResult> {
    const res = await authFetch('/api/v1/fire-design/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJsonResponse<FloorCalculationResult>(res);
  },

  async saveLayoutRevision(body: {
    buildingId: number;
    floorId: number;
    sprinklerConfig?: any;
    extinguisherConfig?: any;
    placedItems: PlacedSuppressionItem[];
    notes?: string;
  }): Promise<FireDesignLayout> {
    const res = await authFetch('/api/v1/fire-design/layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJsonResponse<FireDesignLayout>(res);
  },

  async approveLayout(id: number, status: 'REVIEWED' | 'APPROVED', notes?: string): Promise<FireDesignLayout> {
    const res = await authFetch(`/api/v1/fire-design/layouts/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    return parseJsonResponse<FireDesignLayout>(res);
  },

  async saveSystemDesign(body: {
    buildingId: number;
    floorId?: number | null;
    systemType: FireSystemType;
    standardEdition: string;
    localCodeNotes?: string;
    designInputs: Record<string, any>;
  }): Promise<FireDesignSystemRecord> {
    const res = await authFetch('/api/v1/fire-design/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJsonResponse<FireDesignSystemRecord>(res);
  },

  async approveSystemDesign(
    id: number,
    status: 'REVIEWED' | 'APPROVED' = 'APPROVED',
    notes?: string
  ): Promise<FireDesignSystemRecord> {
    const res = await authFetch(`/api/v1/fire-design/systems/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    return parseJsonResponse<FireDesignSystemRecord>(res);
  },

  async deleteSystemDesign(id: number): Promise<void> {
    const res = await authFetch(`/api/v1/fire-design/systems/${id}`, { method: 'DELETE' });
    await parseJsonResponse(res);
  },

  async createGapAction(body: Partial<FireDesignGapAction>): Promise<FireDesignGapAction> {
    const res = await authFetch('/api/v1/fire-design/gap-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJsonResponse<FireDesignGapAction>(res);
  },

  async updateGapAction(id: number, body: Partial<FireDesignGapAction>): Promise<FireDesignGapAction> {
    const res = await authFetch(`/api/v1/fire-design/gap-actions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJsonResponse<FireDesignGapAction>(res);
  },

  async deleteGapAction(id: number): Promise<void> {
    const res = await authFetch(`/api/v1/fire-design/gap-actions/${id}`, { method: 'DELETE' });
    await parseJsonResponse(res);
  },

  async uploadFloorPlanFile(file: File, floorId: number): Promise<{
    fileId: string;
    originalName: string;
    mimeType: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'fire_design_floor_plan');
    formData.append('entityId', String(floorId));
    formData.append('originalFileName', file.name);
    const res = await authFetch('/api/v1/files/upload', {
      method: 'POST',
      body: formData,
    });
    return parseJsonResponse<{ fileId: string; originalName: string; mimeType: string }>(res);
  },

  async fetchFloorPlanImageUrl(fileId: string, mimeType?: string | null): Promise<{
    objectUrl: string;
    widthPx: number;
    heightPx: number;
  }> {
    const isPdf = (mimeType || '').includes('pdf');
    const url = isPdf
      ? `/api/v1/files/${encodeURIComponent(fileId)}/preview`
      : `/api/v1/files/${encodeURIComponent(fileId)}/preview`;

    const res = await authFetch(url);
    if (!res.ok) {
      throw new Error('خطا در دریافت فایل نقشه از سرور');
    }
    const blob = await res.blob();

    if (isPdf) {
      const pdfjsLib = await import('pdfjs-dist');
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
      const arrayBuf = await blob.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('خطا در آماده‌سازی بوم رندر PDF');
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      const pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('تبدیل PDF به تصویر ناموفق بود'))), 'image/png')
      );
      return {
        objectUrl: URL.createObjectURL(pngBlob),
        widthPx: canvas.width,
        heightPx: canvas.height,
      };
    }

    const objectUrl = URL.createObjectURL(blob);
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1200, h: img.naturalHeight || 800 });
      img.onerror = () => resolve({ w: 1200, h: 800 });
      img.src = objectUrl;
    });
    return {
      objectUrl,
      widthPx: dims.w,
      heightPx: dims.h,
    };
  },
};

/**
 * Exports all 8 NFPA Engineering Reports for a Building + Floor to a multi-sheet .xlsx workbook.
 */
export function exportEightReportsToExcel(params: {
  building: FireDesignBuilding;
  floors: FireDesignFloor[];
  selectedFloor: FireDesignFloor;
  calc: FloorCalculationResult;
  placedItems: PlacedSuppressionItem[];
  systems?: FireDesignSystemRecord[];
  gapActions?: FireDesignGapAction[];
}) {
  const { building, floors, selectedFloor, calc, placedItems, systems = [], gapActions = [] } = params;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Building Specifications & Hazard Classification
  const s1Data = [
    ['گزارش ۱: مشخصات ساختمان، کاربری و طبقه‌بندی خطر حریق'],
    ['کد ساختمان', building.code, 'نام ساختمان', building.name],
    ['شرکت / مجتمع', building.companyName, 'واحد بهره‌بردار', building.unitName],
    ['کاربری', OCCUPANCY_LABELS_FA[building.occupancyType] || building.occupancyType, 'نوع سازه', building.structureType],
    ['نوع سقف', building.ceilingType, 'تعداد طبقات / زیرزمین', `${building.floorsAboveGround} طبقه + ${building.basementFloors} زیرزمین`],
    ['مواد موجود', building.storedMaterials, 'کلاس‌های حریق', calc.detectedFireClasses.join(', ')],
    ['ویرایش NFPA 13', calc.nfpa13Edition, 'ویرایش NFPA 10', calc.nfpa10Edition],
    ['گروه خطر NFPA 13', calc.hazardGroupLabelFa, 'مبنای استاندارد', calc.hazardBasisCitation],
    [],
    ['مشخصات طبقات ثبت‌شده'],
    ['کد طبقه', 'عنوان طبقه', 'طول (m)', 'عرض (m)', 'ارتفاع سقف (m)', 'مساحت (m²)', 'ارتفاع سقف کاذب (m)', 'عمق تیر (m)'],
    ...floors.map((f) => [
      f.floorCode,
      f.floorLabel,
      f.lengthM,
      f.widthM,
      f.ceilingHeightM,
      f.areaSqm,
      f.falseCeilingHeightM,
      f.beamDepthM,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s1Data), '1_Building_Hazard');

  // Sheet 2: Required Sprinklers
  const s2Data = [
    ['گزارش ۲: طراحی و تعداد اسپرینکلر مورد نیاز (NFPA 13)'],
    ['طبقه', selectedFloor.floorLabel, 'مساحت (m²)', selectedFloor.areaSqm],
    ['نیاز به اسپرینکلر آبی', calc.sprinkler.isRequiredOrRecommended ? 'بله' : 'خیر / سیستم جایگزین'],
    ['نوع اسپرینکلر پیشنهادی', calc.sprinkler.recommendedHeadLabelFa],
    ['ضریب K', calc.sprinkler.kFactor, 'دمای عملگر (°C)', calc.sprinkler.tempRatingC],
    ['حداکثر سطح پوشش هر نازل (m²)', calc.sprinkler.maxCoveragePerHeadSqm, 'حداکثر فاصله مجاز (m)', calc.sprinkler.maxSpacingM],
    ['فاصله طراحی شبکه (m)', `${calc.sprinkler.designSpacingXM} × ${calc.sprinkler.designSpacingYM}`, 'تعداد محاسبه‌شده', calc.sprinkler.calculatedHeadCount],
    ['تعداد جانمایی‌شده در نقشه', calc.sprinkler.placedSprinklerCount, 'درصد پوشش فضایی (%)', calc.sprinkler.coveragePercent],
    ['هشدارهای موانع و سقف', ...calc.sprinkler.obstructionAlerts],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s2Data), '2_Sprinklers_NFPA13');

  // Sheet 3: Required Extinguishers & Compatibility
  const s3Data = [
    ['گزارش ۳: خاموش‌کننده‌های دستی و سازگاری با مواد (NFPA 10)'],
    ['کلاس‌های حریق', calc.detectedFireClasses.join(', '), 'پوشش فضایی (%)', calc.extinguisher.coveragePercent],
    ['حداکثر فاصله پیمایش مشاهده‌شده (m)', calc.extinguisher.maxObservedTravelM],
    [],
    ['تخصیص خاموش‌کننده‌ها'],
    ['عامل اطفا', 'رتبه (Rating)', 'ظرفیت پیشنهادی', 'تعداد مورد نیاز', 'محل نصب پیشنهادی'],
    ...calc.extinguisher.allocationByAgent.map((a) => [
      a.labelFa,
      a.rating,
      a.capacityFa,
      a.requiredCount,
      a.mountingLocationFa,
    ]),
    [],
    ['ماتریس سازگاری عامل اطفا'],
    ['کلاس حریق', 'محدوده / ماهیت خطر', 'عامل توصیه‌شده', 'عوامل ممنوعه', 'توضیحات فنی'],
    ...calc.extinguisher.compatibilityMatrix.map((c) => [
      `Class ${c.fireClass}`,
      c.zoneName,
      c.recommendedLabelFa,
      c.forbiddenAgents.map((f) => `${f.labelFa}: ${f.reasonFa}`).join(' | '),
      c.notesFa,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s3Data), '3_Extinguishers_NFPA10');

  // Sheet 4: Floor-by-Floor Placement Schedule
  const s4Data = [
    ['گزارش ۴: جدول جانمایی تجهیزات در نقشه طبقه', selectedFloor.floorLabel],
    ['کد تجهیز', 'عنوان', 'نوع / دسته', 'منشاء (موجود/پیشنهادی)', 'موقعیت X (m)', 'موقعیت Y (m)', 'شعاع پوشش (m)', 'عامل/ظرفیت', 'توضیحات نصب'],
    ...placedItems.map((p) => [
      p.code,
      p.label,
      p.kind,
      p.origin === 'EXISTING' ? 'موجود' : 'پیشنهادی',
      p.xM,
      p.yM,
      p.coverageRadiusM,
      p.capacityLabel || p.sprinklerHeadType || '-',
      p.mountingNote || '-',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s4Data), '4_Floor_Layout');

  // Sheet 5: Existing vs Deficit/Surplus
  const s5Data = [
    ['گزارش ۵: مقایسه تجهیزات موجود در سامانه با نیاز استاندارد (کسری / مازاد / ناسازگار)'],
    ['دسته / نوع تجهیز', 'مشخصات استاندارد', 'موجود', 'مورد نیاز', 'کسری', 'مازاد', 'ناسازگار', 'وضعیت', 'توضیح ناسازگاری'],
    ...calc.comparisonRows.map((r) => [
      r.categoryTitleFa,
      r.agentOrType,
      r.existingCount,
      r.requiredCount,
      r.deficitCount,
      r.surplusCount,
      r.incompatibleCount,
      r.status,
      r.incompatibleReasons.join(' | '),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s5Data), '5_Existing_vs_Deficit');

  // Sheet 6: Blind Spots & Uncovered Zones
  const s6Data = [
    ['گزارش ۶: نقاط کور و محدوده‌های فاقد پوشش استاندارد'],
    ['شناسه', 'سیستم', 'مختصات X (m)', 'مختصات Y (m)', 'ابعاد (m)', 'مساحت تقریبی (m²)', 'شدت', 'علت فنی'],
    ...(calc.uncoveredZones.length > 0
      ? calc.uncoveredZones.map((z) => [
          z.id,
          z.system,
          z.xM,
          z.yM,
          `${z.widthM} × ${z.heightM}`,
          z.areaSqm,
          z.severity,
          z.reasonFa,
        ])
      : [['-', 'کامل', '-', '-', '-', 0, 'NONE', 'نقطه کوری در محدوده طبقه یافت نشد']]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s6Data), '6_Blind_Spots');

  // Sheet 7: NFPA 13 & NFPA 10 Compliance
  const s7Data = [
    ['گزارش ۷: ارزیابی انطباق با استانداردهای NFPA 13 و NFPA 10'],
    ['استاندارد', 'ویرایش', 'مرجع بند/جدول', 'موضوع ممیزی', 'وضعیت', 'شرح جزئیات'],
    ...calc.complianceChecks.map((c) => [
      c.standard,
      c.edition,
      c.clause,
      c.titleFa,
      c.status,
      c.detailFa,
    ]),
    [],
    [ENGINEERING_DISCLAIMER_FA],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s7Data), '7_Compliance');

  // Sheet 8: Hydraulics & Water Demand
  const h = calc.sprinkler.hydraulics;
  const s8Data = [
    ['گزارش ۸: برآورد نیاز آبی، محاسبات هیدرولیکی Hazen-Williams و ارزیابی مخزن/پمپ'],
    ['مرجع هیدرولیکی', h.standardRef],
    ['چگالی طراحی (gpm/ft²)', h.designDensityGpmSqft, 'چگالی متریک (mm/min)', h.designDensityMmMin],
    ['مساحت بحرانی (ft²)', h.remoteAreaSqft, 'مساحت بحرانی (m²)', h.remoteAreaSqm],
    ['دبی هر اسپرینکلر (GPM)', h.flowPerHeadGpm, 'دبی هر اسپرینکلر (L/min)', h.flowPerHeadLpm],
    ['فشار بهره‌برداری دورترین نازل (Bar)', h.operatingPressureBar, 'فشار (PSI)', h.operatingPressurePsi],
    ['افت اصطکاک لوله Hazen-Williams (Bar)', h.frictionLossBar, 'ضریب زبری C', h.cFactorUsed],
    ['افت ارتفاع استاتیک (Bar)', h.elevationLossBar, 'قطر رایزر (mm)', h.riserDiameterMm],
    ['فشار کل مورد نیاز در رایزر (Bar)', h.totalRequiredPressureBar],
    ['دبی شبکه اسپرینکلر (GPM / LPM)', `${h.sprinklerDemandGpm} GPM / ${h.sprinklerDemandLpm} L/min`],
    ['دبی هوز استریم (GPM / LPM)', `${h.hoseStreamAllowanceGpm} GPM / ${h.hoseStreamAllowanceLpm} L/min`],
    ['دبی کل آب اطفا (GPM / LPM)', `${h.totalWaterDemandGpm} GPM / ${h.totalWaterDemandLpm} L/min`],
    ['مدت زمان تداوم (دقیقه)', h.supplyDurationMin, 'حجم مخزن مورد نیاز (لیتر)', h.requiredTankVolumeLiters],
    ['وضعیت کفایت منبع آب', h.waterSupplyStatus],
    ['ارزیابی مخزن', h.tankCheckDetailFa],
    ['ارزیابی بوسترپمپ', h.pumpCheckDetailFa],
    [],
    [ENGINEERING_DISCLAIMER_FA],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s8Data), '8_Hydraulics_Water');

  // Sheet 9: Additional Systems (NFPA 14/11/2001/72/20) & CAPA Gap Actions
  const s9Data = [
    ['گزارش ۹: سایر سیستم‌های حفاظت در برابر حریق و اقدامات اصلاحی (CAPA)'],
    ['کد سیستم', 'استاندارد', 'ویرایش', 'مرحله طراحی', 'وضعیت انطباق', 'نسخه', 'کاربر'],
    ...(systems.length > 0
      ? systems.map((s) => [
          s.systemType,
          s.standardCode,
          s.standardEdition,
          s.designStage,
          s.complianceStatus,
          `v${s.version}`,
          s.updatedBy || '-',
        ])
      : [['-', '-', '-', '-', '-', '-', 'سیستم مکملی برای این ساختمان ثبت نشده است']]),
    [],
    ['فهرست اقدامات اصلاحی و تحلیل شکاف (GAP / CAPA)'],
    ['کد اقدام', 'اولویت', 'نوع شکاف', 'عنوان', 'مسئول اجرا', 'مهلت', 'وضعیت', 'اقدام پیشنهادی'],
    ...(gapActions.length > 0
      ? gapActions.map((g) => [
          g.actionCode,
          g.riskPriority,
          g.gapType,
          g.title,
          g.responsiblePerson || '-',
          g.dueDate || '-',
          g.status,
          g.recommendedAction,
        ])
      : [['-', '-', '-', '-', '-', '-', '-', 'عدم انطباق بازی ثبت نشده است']]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s9Data), '9_Systems_CAPA');

  const safeCode = (building.code || 'BLD').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `HSECORE_FireDesign_${safeCode}_${selectedFloor.floorCode}.xlsx`);
}

/**
 * Prints formal HTML report via hidden iframe (safe inside embedded iframes without window.open).
 */
export function printHtmlSafely(htmlContent: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  }, 300);
}


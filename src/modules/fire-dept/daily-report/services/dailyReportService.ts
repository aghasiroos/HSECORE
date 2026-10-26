import { 
  FireDailyReport, 
  GasLeakRecord, 
  DailyReportVehicleItem, 
  DynamicReportCustomItem, 
  ConfinedSpaceSection, 
  ConfinedSpaceLogItem 
} from '../types/dailyReportTypes';
import { getUnits, getSubUnitsForUnit } from '../../../../utils/orgHelper';
import { getFleetVehicles } from '../../vehicles/hooks/useVehicleData';
import { apiDb } from '../../../../services/apiDatabaseClient';
import { addAuditLog } from '../../../../utils/authHelper';

const STORAGE_KEY = 'hse_fire_daily_reports_v1';
const TEMPLATE_FIELDS_KEY = 'hse_fire_daily_report_custom_fields';

export const DEFAULT_STATION_NAME = 'ایستگاه آتش نشانی معین';

/**
 * Normalizes any report object to ensure complete backward compatibility with all fields.
 */
export function normalizeReport(r: any): FireDailyReport {
  if (!r) return createEmptyDailyReport();

  const permits = r.workPermitsIssued || {};
  const attached = permits.attachedPermits || {};

  const totalMain = (Number(permits.hotWork) || 0) + (Number(permits.coldWork) || 0);

  const totalAttached = (Number(attached.excavation) || 0) + 
                       (Number(attached.confinedSpace ?? permits.confinedSpace) || 0) + 
                       (Number(attached.vehicleCrane ?? attached.heavyMachinery) || 0) + 
                       (Number(attached.radiation) || 0) + 
                       (Number(attached.electricalIsolation) || 0) + 
                       (Number(attached.processIsolation) || 0);

  const confinedCount = Number(attached.confinedSpace ?? permits.confinedSpace ?? permits.confinedSpaceManagement?.totalPermitsCount) || 0;

  return {
    ...r,
    workPermitsIssued: {
      hotWork: Number(permits.hotWork) || 0,
      coldWork: Number(permits.coldWork) || 0,
      totalMainPermits: permits.totalMainPermits ?? totalMain,
      attachedPermits: {
        excavation: Number(attached.excavation) || 0,
        confinedSpace: confinedCount,
        vehicleCrane: Number(attached.vehicleCrane ?? attached.heavyMachinery) || 0,
        radiation: Number(attached.radiation) || 0,
        electricalIsolation: Number(attached.electricalIsolation) || 0,
        processIsolation: Number(attached.processIsolation) || 0,
        totalAttached: attached.totalAttached ?? totalAttached
      },
      confinedSpace: confinedCount,
      gasTesters: Number(permits.gasTesters) || 0,
      standby: Number(permits.standby) || 0,
      revokedPermits: Number(permits.revokedPermits) || 0,
      notes: permits.notes || ''
    },
    dynamicCustomItems: Array.isArray(r.dynamicCustomItems) ? r.dynamicCustomItems : []
  };
}

export function buildInitialVehiclesStatus(
  fleet = getFleetVehicles(),
  includeFallback = false
): Record<string, DailyReportVehicleItem> {
  const initialVehiclesStatus: Record<string, DailyReportVehicleItem> = {};
  if (fleet && fleet.length > 0) {
    fleet.forEach(v => {
      initialVehiclesStatus[v.id] = {
        vehicleId: v.id,
        vehicleCode: v.code,
        vehicleName: v.brandModel || v.vehicleType,
        plateNumber: v.plateNumber,
        vehicleType: v.vehicleType,
        status: v.status === 'خارج از سرویس'
          ? 'خارج از سرویس'
          : v.status === 'در تعمیرات'
          ? 'در حال تعمیر'
          : v.status === 'آماده به کار با محدودیت'
          ? 'دارای نقص جزئی'
          : 'آماده به کار (OK)',
        description: `مخزن آب: ${v.waterTankCapacity || 0}L - فوم: ${v.foamTankCapacity || 0}L | پمپ و تجهیزات آماده`
      };
    });
  } else if (includeFallback) {
    initialVehiclesStatus['veh-01'] = {
      vehicleId: 'veh-01',
      vehicleCode: 'FT-01',
      vehicleName: 'Mercedes-Benz Actros 3340 (6x4)',
      plateNumber: '۱۲ الف ۳۴۵ ایران ۲۲',
      vehicleType: 'خودرو سنگین اطفاء حریق',
      status: 'آماده به کار (OK)',
      description: 'مخزن آب و فوم پر، پمپ در مدار'
    };
  }
  return initialVehiclesStatus;
}

export function createEmptyDailyReport(authorName = 'کارشناس ایستگاه آتش‌نشانی'): FireDailyReport {
  const todayJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '/');

  const randomSeq = Math.floor(1000 + Math.random() * 9000);
  const reportNumber = `FDR-${todayJalali.replace(/\//g, '')}-${randomSeq}`;
  const initialVehiclesStatus = buildInitialVehiclesStatus(getFleetVehicles(), true);

  return {
    id: `fdr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    reportNumber,
    reportDate: todayJalali,
    stationName: DEFAULT_STATION_NAME,
    unitName: '',
    subUnitName: '',
    shift: 'DAY',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: authorName,

    inspectionsAndIncidents: {
      hseInspectionsCount: 0,
      fireInspectionsCount: 0,
      humanIncidents: { minor: 0, recordable: 0, severe: 0 },
      vehicleIncidents: { minor: 0, recordable: 0, severe: 0 },
      fireIncidents: { minor: 0, recordable: 0, severe: 0 }
    },

    workPermitsIssued: {
      hotWork: 0,
      coldWork: 0,
      totalMainPermits: 0,
      attachedPermits: {
        excavation: 0,
        confinedSpace: 0,
        vehicleCrane: 0,
        radiation: 0,
        electricalIsolation: 0,
        processIsolation: 0,
        totalAttached: 0
      },
      confinedSpace: 0,
      gasTesters: 0,
      standby: 0,
      revokedPermits: 0,
      notes: ''
    },

    waterSuppressionAndValves: {
      delugeValves: {
        fb8001A: 'سالم / نرمال',
        fb8001B: 'سالم / نرمال',
        fb4501: 'سالم / نرمال',
        fb4502: 'سالم / نرمال'
      },
      onOffValveU20: 'سالم / نرمال',
      onOffValveU40: 'سالم / نرمال',
      railHose: 'سالم / نرمال',
      hydrants: 'سالم / نرمال',
      monitors: 'سالم / نرمال',
      fireBox: 'سالم / نرمال'
    },

    fireExtinguishers: {
      powderExisting: { kg6: 120, kg40: 35 },
      co2Existing: { kg6: 45, kg30: 18, kg10: 22 },
      warehouseCharged: { co2: 15, kg6: 25, kg40: 8 },
      warehouseUncharged: { co2: 3, kg6: 5, kg40: 2 }
    },

    gaseousAndAlarmSystems: {
      fm200: {
        unit51: 'سالم / نرمال',
        unit54: 'سالم / نرمال'
      },
      alarmSystems: {
        callPoints: 'سالم / نرمال',
        smokeDetectors: 'سالم / نرمال',
        heatDetectors: 'سالم / نرمال',
        flameDetectors: 'سالم / نرمال',
        hornsSirens: 'سالم / نرمال',
        mainPanel: 'سالم / نرمال'
      }
    },

    vehiclesStatus: initialVehiclesStatus,

    gasDetectorsStatus: {
      fixed: {
        unit01: 'سالم / نرمال',
        unit20: 'سالم / نرمال',
        unit21: 'سالم / نرمال',
        unit40: 'سالم / نرمال',
        utility: 'سالم / نرمال',
        storageTanks: 'سالم / نرمال',
        gd: 'سالم / نرمال'
      },
      portable: {
        gasAlertBW: 'سالم / نرمال',
        msa: 'سالم / نرمال',
        cosmos: 'سالم / نرمال',
        crowcon: 'سالم / نرمال',
        crowconTriplePlus: 'سالم / نرمال'
      }
    },

    alarmSystemFaults: {
      industrialPanel: { fault: 0, fire: 0, warning: 0 },
      nonIndustrialPanel: { fault: 0, fire: 0, warning: 0 }
    },

    standbyAndEscort: {
      propyleneTankerEscorts: 0,
      propaneTankerEscorts: 0,
      standbyHours: 0
    },

    gasLeaks: [],

    workCompletedDescription: '',
    defectsAndNeeds: '',
    dynamicCustomItems: [],

    signatures: {
      dayShiftOfficer: {
        name: '',
        personnelCode: '',
        signed: false,
        time: ''
      },
      nightShiftOfficer: {
        name: '',
        personnelCode: '',
        signed: false,
        time: ''
      }
    }
  };
}

const INITIAL_DEMO_REPORTS: FireDailyReport[] = [];

// In-memory cache for ultra-fast, synchronous UI queries
let memoryReportsCache: FireDailyReport[] | null = null;
let isInitialized = false;

/**
 * Initialize and sync fire daily reports from پایگاه داده backend into memory cache.
 */
export async function initFireDailyReportStorage(): Promise<FireDailyReport[]> {
  try {
    const dbReports = await apiDb.getFireDailyReports();
    if (Array.isArray(dbReports)) {
      memoryReportsCache = dbReports;
      isInitialized = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_fire_daily_reports_updated', { detail: dbReports }));
      }
      return dbReports;
    }
  } catch (e) {
    console.warn('[FireDailyReport] Error loading reports from database:', e);
  }
  isInitialized = true;
  return memoryReportsCache || [];
}

// Auto-run background initialization on startup and listen for real-time changes
if (typeof window !== 'undefined') {
  initFireDailyReportStorage();

  const handleRemoteUpdate = (e: any) => {
    const entity = String(e?.detail?.key || e?.detail?.data?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
    if (entity === 'fire_reports' || entity === STORAGE_KEY.toLowerCase()) {
      apiDb.getFireDailyReports().then(reports => {
        if (Array.isArray(reports)) {
          memoryReportsCache = reports;
          window.dispatchEvent(new CustomEvent('hse_fire_daily_reports_updated', { detail: reports }));
        }
      }).catch(() => {});
    }
  };

  window.addEventListener('app_data_mutated', handleRemoteUpdate);
}

export const fireDailyReportService = {
  getAllReports(): FireDailyReport[] {
    if (memoryReportsCache !== null) {
      return memoryReportsCache.map(normalizeReport);
    }

    if (!isInitialized) {
      initFireDailyReportStorage().catch(() => {});
    }

    return [];
  },

  getReportById(id: string): FireDailyReport | undefined {
    const list = this.getAllReports();
    const item = list.find(r => r.id === id);
    return item ? normalizeReport(item) : undefined;
  },

  saveReport(report: FireDailyReport): FireDailyReport {
    const list = this.getAllReports();
    const existingIndex = list.findIndex(r => r.id === report.id);
    const normalized = normalizeReport(report);
    const updated: FireDailyReport = {
      ...normalized,
      updatedAt: new Date().toISOString()
    };

    let newList: FireDailyReport[];
    if (existingIndex >= 0) {
      newList = [...list];
      newList[existingIndex] = updated;
    } else {
      newList = [updated, ...list];
    }

    // 1. Immediately update synchronous in-memory cache
    memoryReportsCache = newList;

    // 2. Authoritative persistence in پایگاه داده
    apiDb.saveFireDailyReports(newList).catch(console.error);

    // 3. Audit Log for Enterprise compliance
    try {
      addAuditLog(
        'FireDailyReport',
        existingIndex >= 0 ? 'ویرایش گزارش روزانه آتش‌نشانی' : 'ثبت گزارش روزانه جدید آتش‌نشانی',
        `گزارش ${updated.reportNumber} با موفقیت ثبت گردید.`
      );
    } catch (_) {}

    // 4. Notify all UI listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_fire_daily_reports_updated', { detail: newList }));
    }

    return updated;
  },

  deleteReport(id: string): boolean {
    const list = this.getAllReports();
    const target = list.find(r => r.id === id);
    const filtered = list.filter(r => r.id !== id);
    
    // 1. Update in-memory cache
    memoryReportsCache = filtered;

    // 2. Authoritative persistence in پایگاه داده
    apiDb.saveFireDailyReports(filtered).catch(console.error);

    // 5. Audit Log
    try {
      addAuditLog(
        'FireDailyReport',
        'حذف گزارش روزانه آتش‌نشانی',
        `گزارش ${target?.reportNumber || id} با موفقیت حذف گردید.`
      );
    } catch (_) {}

    // 6. Notify UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_fire_daily_reports_updated', { detail: filtered }));
    }
    return true;
  },

  duplicateReport(id: string, currentUser = 'کارشناس ایستگاه'): FireDailyReport | null {
    const original = this.getReportById(id);
    if (!original) return null;

    const todayJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '/');

    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const newReport: FireDailyReport = normalizeReport({
      ...JSON.parse(JSON.stringify(original)),
      id: `fdr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      reportNumber: `FDR-${todayJalali.replace(/\//g, '')}-${randomSeq}`,
      reportDate: todayJalali,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser,
      finalizedAt: undefined,
      finalizedBy: undefined,
      signatures: {
        dayShiftOfficer: { ...original.signatures.dayShiftOfficer, signed: false, notes: undefined },
        nightShiftOfficer: { ...original.signatures.nightShiftOfficer, signed: false, notes: undefined }
      }
    });

    this.saveReport(newReport);
    return newReport;
  },

  /**
   * Automatically retrieves required data from specialized modules (PTW, Fleet, Equipment, Incidents)
   * avoiding duplicate manual entry and ensuring cross-module data consistency.
   */
  async autoSyncFromModules(reportDate: string, currentReport: FireDailyReport): Promise<{
    syncedReport: FireDailyReport;
    summary: {
      permitsFound: number;
      confinedFound: number;
      vehiclesFound: number;
      incidentsFound: number;
      equipmentFound: number;
    }
  }> {
    const updated = JSON.parse(JSON.stringify(normalizeReport(currentReport))) as FireDailyReport;
    let permitsFound = 0;
    let confinedFound = 0;
    let vehiclesFound = 0;
    let incidentsFound = 0;
    let equipmentFound = 0;

    // 1. SYNC FROM PTW MODULE (Permits, Attached, Confined Space)
    try {
      const allPermits = await apiDb.getWorkPermits();
      if (Array.isArray(allPermits) && allPermits.length > 0) {
        // Filter permits for today's date or active permits
        const cleanReportDate = (reportDate || '').trim();
        const matchingPermits = allPermits.filter((p: any) => {
          if (!cleanReportDate) return true;
          const pDate = (p.date || p.issueDate || p.validFrom || p.createdAt || '').toString();
          return pDate.includes(cleanReportDate) || p.status === 'Active' || p.status === 'Issued';
        });

        permitsFound = matchingPermits.length;

        let hot = 0;
        let cold = 0;

        let excav = 0;
        let confined = 0;
        let vehicleCrane = 0;
        let radAtt = 0;
        let elect = 0;
        let processMech = 0;

        let gasTestersCount = 0;
        let standbyCount = 0;

        matchingPermits.forEach((p: any) => {
          // Categorize Main Permit Type: Hot Work vs Cold Work
          const pType = (p.permitType || p.permitCategory || '').toString().toLowerCase();
          if (pType.includes('hot') || pType.includes('گرم')) {
            hot++;
          } else if (pType.includes('cold') || pType.includes('سرد')) {
            cold++;
          } else {
            hot++;
          }

          // Categorize the 6 Attached Permits
          const att = p.attachedPermits || {};
          if (att.excavation || pType.includes('excav') || pType.includes('حفاری')) excav++;
          if (att.confinedSpace || pType.includes('confined') || pType.includes('بسته')) confined++;
          if (att.vehicleCrane || att.heavyMachinery || att.crane || pType.includes('خودرو') || pType.includes('جرثقیل')) vehicleCrane++;
          if (att.radiation || pType.includes('radi') || pType.includes('پرتو')) radAtt++;
          if (att.electrical || att.electricalIsolation || pType.includes('elect') || pType.includes('الکتریک')) elect++;
          if (att.processIsolation || att.mechanicalIsolation || pType.includes('process') || pType.includes('فرایند') || pType.includes('مکانیک')) processMech++;

          // Gas testers
          if (p.gasTestRequired === 'Completed' || p.gasTest) gasTestersCount++;
          // Standby
          if (p.standByHse || p.responsibles?.safetyUnit) standbyCount++;
        });

        const totalMainPermits = hot + cold;
        const totalAttached = excav + confined + vehicleCrane + radAtt + elect + processMech;

        // Apply updated permit metrics
        updated.workPermitsIssued.hotWork = hot;
        updated.workPermitsIssued.coldWork = cold;
        updated.workPermitsIssued.totalMainPermits = totalMainPermits;

        updated.workPermitsIssued.attachedPermits = {
          excavation: excav,
          confinedSpace: confined,
          vehicleCrane: vehicleCrane,
          radiation: radAtt,
          electricalIsolation: elect,
          processIsolation: processMech,
          totalAttached: totalAttached
        };

        updated.workPermitsIssued.confinedSpace = confined;
        updated.workPermitsIssued.gasTesters = gasTestersCount;
        updated.workPermitsIssued.standby = standbyCount;

        // Revoked permits
        const revoked = allPermits.filter((p: any) => p.status === 'Cancelled' || p.status === 'Revoked').length;
        updated.workPermitsIssued.revokedPermits = revoked;
      }
    } catch (err) {
      console.warn('[FireDailyReport] Failed to sync PTW data:', err);
    }

    // 2. SYNC FROM FLEET VEHICLES MODULE
    try {
      const fleet = getFleetVehicles();
      if (Array.isArray(fleet) && fleet.length > 0) {
        vehiclesFound = fleet.length;
        const currentVehStatus: any = updated.vehiclesStatus || {};
        fleet.forEach(v => {
          currentVehStatus[v.id] = {
            vehicleId: v.id,
            vehicleCode: v.code,
            vehicleName: v.brandModel || v.vehicleType,
            plateNumber: v.plateNumber,
            vehicleType: v.vehicleType,
            status: v.status === 'خارج از سرویس' 
              ? 'خارج از سرویس' 
              : v.status === 'در تعمیرات' 
              ? 'در حال تعمیر' 
              : v.status === 'آماده به کار با محدودیت' 
              ? 'دارای نقص جزئی' 
              : 'آماده به کار (OK)',
            description: currentVehStatus[v.id]?.description || `مخزن آب: ${v.waterTankCapacity || 0}L - فوم: ${v.foamTankCapacity || 0}L | آماده‌به‌کار`
          };
        });
        updated.vehiclesStatus = currentVehStatus;
      }
    } catch (err) {
      console.warn('[FireDailyReport] Failed to sync fleet vehicles:', err);
    }

    // 3. SYNC FROM FIRE EQUIPMENT DATABASE (Extinguishers, Valves, Gas Detectors)
    try {
      const equipData = await apiDb.getFireEquipment();
      if (Array.isArray(equipData) && equipData.length > 0) {
        equipmentFound = equipData.length;
        let pow6 = 0;
        let pow40 = 0;
        let co2_6 = 0;
        let co2_10 = 0;
        let co2_30 = 0;

        equipData.forEach((eq: any) => {
          const typeStr = (eq.type || eq.category || '').toString();
          if (typeStr.includes('پودر')) {
            if (typeStr.includes('40') || typeStr.includes('۴۰')) pow40++;
            else pow6++;
          } else if (typeStr.includes('CO2') || typeStr.includes('دی‌اکسید') || typeStr.includes('گازکربنیک')) {
            if (typeStr.includes('30') || typeStr.includes('۳۰')) co2_30++;
            else if (typeStr.includes('10') || typeStr.includes('۱۰')) co2_10++;
            else co2_6++;
          }
        });

        if (pow6 > 0 || pow40 > 0 || co2_6 > 0) {
          updated.fireExtinguishers.powderExisting.kg6 = Math.max(updated.fireExtinguishers.powderExisting.kg6, pow6);
          updated.fireExtinguishers.powderExisting.kg40 = Math.max(updated.fireExtinguishers.powderExisting.kg40, pow40);
          updated.fireExtinguishers.co2Existing.kg6 = Math.max(updated.fireExtinguishers.co2Existing.kg6, co2_6);
          if (co2_10 > 0) updated.fireExtinguishers.co2Existing.kg10 = co2_10;
          if (co2_30 > 0) updated.fireExtinguishers.co2Existing.kg30 = co2_30;
        }
      }
    } catch (err) {
      console.warn('[FireDailyReport] Failed to sync equipment data:', err);
    }

    // 4. SYNC FROM INCIDENTS MODULE
    try {
      const allIncidents = await apiDb.getIncidents();
      if (Array.isArray(allIncidents) && allIncidents.length > 0) {
        incidentsFound = allIncidents.length;
        const todayIncidents = allIncidents.filter((inc: any) => {
          const incDate = (inc.incidentDate || inc.date || '').toString();
          return !reportDate || incDate.includes(reportDate);
        });

        let humMinor = 0;
        let humRec = 0;
        let humSev = 0;
        let vehCount = 0;
        let fireCount = 0;

        todayIncidents.forEach((inc: any) => {
          const type = (inc.incidentType || '').toLowerCase();
          const sev = (inc.severity || '').toLowerCase();
          if (type.includes('fire') || type.includes('حریق')) {
            fireCount++;
          } else if (type.includes('veh') || type.includes('خودرو')) {
            vehCount++;
          } else {
            if (sev.includes('sev') || sev.includes('حاد') || sev.includes('fatal')) humSev++;
            else if (sev.includes('rec') || sev.includes('ثبت') || sev.includes('lti')) humRec++;
            else humMinor++;
          }
        });

        if (todayIncidents.length > 0) {
          updated.inspectionsAndIncidents.humanIncidents.minor = humMinor;
          updated.inspectionsAndIncidents.humanIncidents.recordable = humRec;
          updated.inspectionsAndIncidents.humanIncidents.severe = humSev;
          updated.inspectionsAndIncidents.vehicleIncidents.recordable = vehCount;
          updated.inspectionsAndIncidents.fireIncidents.recordable = fireCount;
        }
      }
    } catch (err) {
      console.warn('[FireDailyReport] Failed to sync incidents data:', err);
    }

    return {
      syncedReport: updated,
      summary: {
        permitsFound,
        confinedFound,
        vehiclesFound,
        incidentsFound,
        equipmentFound
      }
    };
  },

  /**
   * Loads global custom field templates persisted in پایگاه داده.
   */
  async getCustomFieldsTemplates(): Promise<DynamicReportCustomItem[]> {
    try {
      const list = await apiDb.getSetting(TEMPLATE_FIELDS_KEY);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  /**
   * Persists global custom field templates to پایگاه داده.
   */
  async saveCustomFieldsTemplates(items: DynamicReportCustomItem[]): Promise<boolean> {
    try {
      return await apiDb.saveSetting(TEMPLATE_FIELDS_KEY, items);
    } catch {
      return false;
    }
  },

  getStats(reports?: FireDailyReport[]) {
    const list = (reports || this.getAllReports()).map(normalizeReport);
    const total = list.length;
    const finalized = list.filter(r => r.status === 'FINALIZED').length;
    const drafts = list.filter(r => r.status === 'DRAFT').length;

    const totalHotPermits = list.reduce((sum, r) => sum + (r.workPermitsIssued?.hotWork || 0), 0);
    const totalColdPermits = list.reduce((sum, r) => sum + (r.workPermitsIssued?.coldWork || 0), 0);
    const totalConfinedPermits = list.reduce((sum, r) => sum + (r.workPermitsIssued?.attachedPermits?.confinedSpace ?? r.workPermitsIssued?.confinedSpace ?? 0), 0);
    const totalStandbyHours = list.reduce((sum, r) => sum + (r.standbyAndEscort?.standbyHours || 0), 0);
    const totalEscorts = list.reduce((sum, r) => sum + (r.standbyAndEscort?.propyleneTankerEscorts || 0) + (r.standbyAndEscort?.propaneTankerEscorts || 0), 0);
    const totalGasLeaks = list.reduce((sum, r) => sum + (r.gasLeaks?.length || 0), 0);
    const totalFireAlarms = list.reduce((sum, r) => sum + (r.alarmSystemFaults?.industrialPanel?.fire || 0) + (r.alarmSystemFaults?.nonIndustrialPanel?.fire || 0), 0);

    return {
      total,
      finalized,
      drafts,
      totalHotPermits,
      totalColdPermits,
      totalConfinedPermits,
      totalStandbyHours,
      totalEscorts,
      totalGasLeaks,
      totalFireAlarms
    };
  }
};

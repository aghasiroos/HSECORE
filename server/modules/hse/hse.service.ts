import {
  getAllFiveSAudits,
  createFiveSAudit,
  getAllFireEquipment,
  upsertFireEquipment,
  getAllSafetyWarnings,
  createSafetyWarning,
  deduplicateSafetyWarningsInDb,
  clearAllSafetyWarnings,
  getTrirRecords,
  upsertTrirRecord,
  deleteTrirRecord,
  getAllSystemSettings,
  getSystemSetting,
  setSystemSetting,
  getFullSyncSnapshot,
} from '../../db-services.ts';
import { auditService } from '../audit/audit.service.ts';
import { notificationService } from '../notifications/notification.service.ts';
import { ValidationError } from '../../core/errors.ts';

export class HSEService {
  // 5S Audits
  async getFiveSAudits() {
    return await getAllFiveSAudits();
  }

  async createFiveSAudit(data: any, actorName?: string) {
    if (!data.title || !data.auditDate || !data.site) {
      throw new ValidationError('عنوان ممیزی، تاریخ و سایت الزامی هستند.');
    }
    const result = await createFiveSAudit(data);
    await auditService.log({
      action: 'CREATE_5S_AUDIT',
      module: 'HSE',
      entityType: 'FIVE_S_AUDIT',
      entityId: String(result.id),
      details: { site: data.site, score: data.totalScore, actor: actorName },
    });
    return result;
  }

  // Fire Station & Equipment
  async getFireEquipment() {
    const list = await getAllFireEquipment();
    const now = new Date().getTime();
    const thirtyDaysMs = 30 * 86400000;

    // Enhance with expiry alert status
    return list.map((eq: any) => {
      let isExpiringSoon = false;
      let isExpired = false;
      if (eq.expiryDate) {
        const exp = new Date(eq.expiryDate).getTime();
        if (exp < now) isExpired = true;
        else if (exp - now < thirtyDaysMs) isExpiringSoon = true;
      }
      return {
        ...eq,
        isExpired,
        isExpiringSoon,
      };
    });
  }

  async upsertFireEquipment(data: any, actorName?: string) {
    if (!data.code || !data.equipmentType || !data.location) {
      throw new ValidationError('کد تجهیز، نوع تجهیز و موقعیت مکانی الزامی هستند.');
    }
    const result = await upsertFireEquipment(data);
    await auditService.log({
      action: 'UPSERT_FIRE_EQUIPMENT',
      module: 'HSE',
      entityType: 'FIRE_EQUIPMENT',
      entityId: data.code,
      details: { actor: actorName },
    });
    return result;
  }

  // Safety Warnings & Deduplication
  async getSafetyWarnings() {
    return await getAllSafetyWarnings();
  }

  async createSafetyWarning(data: any, actorName?: string) {
    const result = await createSafetyWarning(data);
    await auditService.log({
      action: 'CREATE_SAFETY_WARNING',
      module: 'HSE',
      entityType: 'SAFETY_WARNING',
      entityId: result.number || String(result.id),
      personnelCode: result.personnelCode,
      details: { reason: result.reason, actor: actorName },
    });
    return result;
  }

  async deduplicateWarnings() {
    const count = await deduplicateSafetyWarningsInDb();
    return { deduplicatedCount: count, message: `تعداد ${count} رکورد تکراری اخطار ایمنی با موفقیت پاکسازی شد.` };
  }

  async clearAllWarnings() {
    const count = await clearAllSafetyWarnings();
    return { deletedCount: count };
  }

  // Statistical & OSHA Calculations (TRIR, LTIFR, SR, FSI)
  async getTrirRecords() {
    return await getTrirRecords();
  }

  async upsertTrirRecord(data: any) {
    const att = Number(data.attendanceHours ?? data.attendance ?? 0) || 0;
    const miss = Number(data.missionHours ?? data.mission ?? 0) || 0;
    const cont = Number(data.contractorHours ?? data.contractor ?? 0) || 0;
    const totalWorkingHours = att + miss + cont;
    const totalHours = Number(data.manHours ?? data.totalHours ?? totalWorkingHours) || (totalWorkingHours > 0 ? totalWorkingHours : 1);
    const recordableCount = Number(data.recordableIncidents ?? data.incidents ?? 0);
    const ltiCount = Number(data.lostTimeInjuries ?? 0);
    const lostDays = Number(data.lostWorkDays ?? 0);

    // Standard KPI Calculations:
    // TRIR (Total Recordable Incident Rate) based on standard 1,000,000 man-hours
    const calculatedTrir = totalHours > 0 ? Number(((recordableCount * 1000000) / totalHours).toFixed(2)) : 0;
    // LTIFR = (LTI * 1,000,000) / Man-Hours
    const calculatedLtifr = totalHours > 0 ? Number(((ltiCount * 1000000) / totalHours).toFixed(2)) : 0;
    // Severity Rate (SR) = (Lost Workdays * 200,000) / Man-Hours
    const calculatedSr = totalHours > 0 ? Number(((lostDays * 200000) / totalHours).toFixed(2)) : 0;
    // Frequency Severity Index (FSI) = sqrt((TRIR * SR) / 1000)
    const calculatedFsi = Number(Math.sqrt((calculatedTrir * calculatedSr) / 1000).toFixed(3));

    const payload = {
      ...data,
      attendanceHours: att,
      missionHours: miss,
      contractorHours: cont,
      totalHours: totalHours > 1 ? totalHours : (totalWorkingHours || 0),
      incidents: recordableCount,
      trir: data.trir !== undefined ? data.trir : calculatedTrir,
      monthlyTrir: data.monthlyTrir !== undefined ? data.monthlyTrir : calculatedTrir,
      ltifr: data.ltifr !== undefined ? data.ltifr : calculatedLtifr,
      sr: data.sr !== undefined ? data.sr : calculatedSr,
      fsi: data.fsi !== undefined ? data.fsi : calculatedFsi,
    };

    return await upsertTrirRecord(payload);
  }

  async deleteTrirRecord(id: string | number, year?: number, month?: string) {
    return await deleteTrirRecord(id, year, month);
  }

  async clearAllTrirRecords() {
    return await deleteTrirRecord('clear_all');
  }

  // System Settings
  async getSystemSettings() {
    return await getAllSystemSettings();
  }

  async setSystemSetting(key: string, value: any, description?: string) {
    return await setSystemSetting(key, value, description);
  }

  // Central Full Sync
  async getFullSync() {
    return await getFullSyncSnapshot();
  }
}

export const hseService = new HSEService();

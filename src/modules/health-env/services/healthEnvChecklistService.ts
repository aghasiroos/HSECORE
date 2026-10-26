import { 
  HealthEnvInspection, 
  HealthEnvChecklistTypeTemplate, 
  HealthEnvChecklistItem,
  HealthEnvChecklistType
} from '../types/checklistTypes';
import { apiDb } from '../../../services/apiDatabaseClient';
import { getTodayJalaliDate, calculateNextInspectionDate } from '../../../utils/inspectionScheduleHelper';

const HEALTH_ENV_CHECKLIST_TEMPLATES: HealthEnvChecklistTypeTemplate[] = [];
const INITIAL_HEALTH_ENV_INSPECTIONS: HealthEnvInspection[] = [];

class HealthEnvChecklistService {
  private inspections: HealthEnvInspection[] = [];
  private templates: HealthEnvChecklistTypeTemplate[] = [];
  private isLoaded = false;
  private isReloading = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadData();

      const handleRemoteMutation = (e: any) => {
        const entity = String(e?.detail?.key || e?.detail?.data?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
        if (entity.includes('health_env')) {
          this.reloadFromServer();
        }
      };
      window.addEventListener('app_data_mutated', handleRemoteMutation);
    }
  }

  public async reloadFromServer() {
    await this.loadData();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_inspections_updated'));
      window.dispatchEvent(new Event('hse_health_env_templates_updated'));
    }
  }

  private async loadData() {
    if (this.isReloading) return;
    this.isReloading = true;
    try {
      const [dbInspections, dbTemplates] = await Promise.all([
        apiDb.getHealthEnvInspections(),
        apiDb.getHealthEnvTemplates(),
      ]);

      if (dbInspections && Array.isArray(dbInspections) && dbInspections.length > 0) {
        this.inspections = dbInspections;
      } else if (!this.isLoaded) {
        this.inspections = [...INITIAL_HEALTH_ENV_INSPECTIONS];
      }

      if (dbTemplates && Array.isArray(dbTemplates) && dbTemplates.length > 0) {
        this.templates = dbTemplates;
      } else if (!this.isLoaded) {
        this.templates = [...HEALTH_ENV_CHECKLIST_TEMPLATES];
      }

      this.isLoaded = true;
    } catch (err) {
      console.error('Error loading Health & Env Checklists from پایگاه داده:', err);
      if (this.inspections.length === 0) {
        this.inspections = [...INITIAL_HEALTH_ENV_INSPECTIONS];
      }
      if (this.templates.length === 0) {
        this.templates = [...HEALTH_ENV_CHECKLIST_TEMPLATES];
      }
    } finally {
      this.isReloading = false;
    }
  }

  // --- TEMPLATES METHODS ---
  public getTemplates(): HealthEnvChecklistTypeTemplate[] {
    return this.templates.length > 0 ? [...this.templates] : [...HEALTH_ENV_CHECKLIST_TEMPLATES];
  }

  public getTemplateById(id: HealthEnvChecklistType): HealthEnvChecklistTypeTemplate | undefined {
    return this.getTemplates().find(t => t.id === id);
  }

  public async saveTemplate(template: HealthEnvChecklistTypeTemplate, user: string = 'کاربر سیستم'): Promise<boolean> {
    const idx = this.templates.findIndex(t => t.id === template.id);
    const now = new Date().toISOString();
    const updatedRecord: HealthEnvChecklistTypeTemplate = {
      ...template,
      isActive: template.isActive !== undefined ? template.isActive : true,
      defaultItems: template.defaultItems || [],
      updatedAt: now,
      createdAt: template.createdAt || now
    };

    if (idx !== -1) {
      this.templates[idx] = updatedRecord;
    } else {
      this.templates.push(updatedRecord);
    }

    await apiDb.saveHealthEnvTemplate(updatedRecord);
    await apiDb.saveAllHealthEnvTemplates(this.templates);
    await apiDb.logAudit({
      action: idx !== -1 ? 'UPDATE' : 'CREATE',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_TEMPLATE',
      entityId: template.id,
      newValue: { id: template.id, title: template.titleFa, itemCount: updatedRecord.defaultItems.length },
      details: { updatedBy: user, timestamp: now }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_templates_updated'));
    }
    return true;
  }

  public async deleteTemplate(templateId: string, user: string = 'کاربر سیستم'): Promise<boolean> {
    const target = this.templates.find(t => t.id === templateId);
    if (!target) return false;

    this.templates = this.templates.filter(t => t.id !== templateId);
    await apiDb.deleteHealthEnvTemplate(templateId);
    await apiDb.saveAllHealthEnvTemplates(this.templates);
    await apiDb.logAudit({
      action: 'DELETE',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_TEMPLATE',
      entityId: templateId,
      oldValue: { id: templateId, title: target.titleFa },
      details: { deletedBy: user, timestamp: new Date().toISOString() }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_templates_updated'));
    }
    return true;
  }

  public async reorderChecklistItems(
    templateId: HealthEnvChecklistType, 
    items: HealthEnvChecklistItem[], 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    template.defaultItems = items.map((item, idx) => ({
      ...item,
      orderIndex: idx + 1
    }));
    await this.saveTemplate(template, user);
    return true;
  }

  public async addChecklistItem(
    templateId: HealthEnvChecklistType, 
    item: Omit<HealthEnvChecklistItem, 'id'>, 
    user: string = 'کاربر سیستم'
  ): Promise<HealthEnvChecklistItem> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    const newItem: HealthEnvChecklistItem = {
      ...item,
      id: `custom-${templateId}-${Date.now()}`,
      isCustom: true
    };
    template.defaultItems.push(newItem);
    await this.saveTemplate(template, user);
    return newItem;
  }

  public async updateChecklistItem(
    templateId: HealthEnvChecklistType, 
    item: HealthEnvChecklistItem, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    const idx = template.defaultItems.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      template.defaultItems[idx] = { ...item };
      await this.saveTemplate(template, user);
      return true;
    }
    return false;
  }

  public async deleteChecklistItem(
    templateId: HealthEnvChecklistType, 
    itemId: string, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    const deletedItem = template.defaultItems.find(i => i.id === itemId);
    template.defaultItems = template.defaultItems.filter(i => i.id !== itemId);
    await this.saveTemplate(template, user);

    await apiDb.logAudit({
      action: 'DELETE',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_ITEM',
      entityId: itemId,
      previousValue: deletedItem,
      details: {
        templateId,
        templateTitle: template.titleFa,
        itemTitle: deletedItem?.title,
        deletedBy: user,
        timestamp: new Date().toISOString()
      }
    });

    return true;
  }

  public async resetTemplateToDefault(
    templateId: HealthEnvChecklistType, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const defaultTemplate = HEALTH_ENV_CHECKLIST_TEMPLATES.find(t => t.id === templateId);
    if (!defaultTemplate) throw new Error('الگوی استاندارد یافت نشد.');

    const cloned = JSON.parse(JSON.stringify(defaultTemplate));
    await this.saveTemplate(cloned, user);

    await apiDb.logAudit({
      action: 'RESET',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_TEMPLATE',
      entityId: templateId,
      details: {
        templateTitle: defaultTemplate.titleFa,
        resetBy: user,
        timestamp: new Date().toISOString()
      }
    });

    return true;
  }

  // --- INSPECTION METHODS ---
  public getAllInspections(): HealthEnvInspection[] {
    return [...this.inspections];
  }

  public getInspectionById(id: string): HealthEnvInspection | undefined {
    return this.inspections.find(i => i.id === id);
  }

  public async saveInspection(
    inspection: Partial<HealthEnvInspection>, 
    user: string = 'کاربر سیستم'
  ): Promise<HealthEnvInspection> {
    const isNew = !inspection.id;
    const now = new Date().toISOString();
    const items = inspection.items || [];
    const totalItems = items.length;
    const passedCount = items.filter(i => i.verdict === 'pass').length;
    const failedCount = items.filter(i => i.verdict === 'fail').length;
    const naCount = items.filter(i => i.verdict === 'na').length;
    const effectiveTotal = totalItems - naCount;
    const scorePercent = effectiveTotal > 0 ? Math.round((passedCount / effectiveTotal) * 100) : 100;

    let finalStatus: HealthEnvInspection['status'] = inspection.status || 'COMPLETED';
    if (failedCount > 0) {
      finalStatus = 'ACTION_REQUIRED';
    }

    const actualDate = inspection.inspectionDate || getTodayJalaliDate();
    const scheduleType = inspection.scheduleType || 'PERIODIC';
    const periodicInterval = inspection.periodicInterval || 'MONTHLY';
    
    // Calculate nextInspectionDate if periodic and not explicitly provided
    let nextInspectionDate = inspection.nextInspectionDate;
    if (scheduleType === 'PERIODIC' && !nextInspectionDate) {
      nextInspectionDate = calculateNextInspectionDate(actualDate, 'PERIODIC', periodicInterval);
    } else if (scheduleType === 'ADHOC') {
      nextInspectionDate = undefined;
    }

    let savedRecord: HealthEnvInspection;

    if (isNew) {
      const yearPrefix = actualDate.split('/')[0] || '1404';
      const count = this.inspections.length + 1;
      const seq = String(count).padStart(3, '0');
      const newId = `HE-INSP-${yearPrefix}-${seq}`;

      const newRecord: HealthEnvInspection = {
        id: newId,
        checklistTypeId: inspection.checklistTypeId || 'premises-buildings',
        checklistTypeNameFa: inspection.checklistTypeNameFa || 'چک‌لیست بازدید اماکن و ساختمان‌ها',
        title: inspection.title || `بازرسی بهداشت و محیط زیست ${newId}`,
        inspectionDate: actualDate,
        inspectionTime: inspection.inspectionTime || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        site: inspection.site || 'مجتمع مرکزی',
        unit: inspection.unit || 'واحد HSE',
        areaLocation: inspection.areaLocation || '',
        equipmentOrFacilityCode: inspection.equipmentOrFacilityCode || '',
        inspectorName: inspection.inspectorName || user,
        inspectorCode: inspection.inspectorCode || '',
        supervisorName: inspection.supervisorName || '',
        hseManagerName: inspection.hseManagerName || '',
        status: finalStatus,
        approvalStatus: inspection.approvalStatus || 'PENDING_APPROVAL',
        approvalNotes: inspection.approvalNotes || '',
        scorePercent,
        totalItems,
        passedCount,
        failedCount,
        naCount,
        items,
        findingsSummary: inspection.findingsSummary || '',
        immediateActionsTaken: inspection.immediateActionsTaken || '',
        recommendedCapa: inspection.recommendedCapa || '',
        photos: inspection.photos || [],
        scheduleType,
        periodicInterval: scheduleType === 'PERIODIC' ? periodicInterval : undefined,
        nextInspectionDate,
        attachments: inspection.attachments || [],
        referralId: inspection.referralId,
        inspectorSignature: inspection.inspectorSignature || '',
        supervisorSignature: inspection.supervisorSignature || '',
        createdAt: now,
        updatedAt: now,
        createdByUser: user,
        approvalLogs: [
          {
            id: `log-${Date.now()}`,
            step: 'SUBMITTED',
            actionBy: user,
            role: 'بازرس بهداشت و محیط زیست',
            timestamp: actualDate,
            comment: 'ثبت اولیه چک‌لیست بازرسی'
          }
        ]
      };

      this.inspections.unshift(newRecord);
      savedRecord = newRecord;

      await apiDb.saveHealthEnvInspection(newRecord);
      await apiDb.logAudit({
        action: 'CREATE',
        module: 'HEALTH_ENV',
        entityType: 'INSPECTION_CHECKLIST',
        entityId: newId,
        newValue: { id: newId, title: newRecord.title, checklistType: newRecord.checklistTypeId, score: scorePercent },
        details: { createdBy: user, timestamp: now }
      });

    } else {
      const idx = this.inspections.findIndex(i => i.id === inspection.id);
      const prev = idx !== -1 ? this.inspections[idx] : null;

      const updatedRecord: HealthEnvInspection = {
        ...prev,
        ...inspection,
        id: inspection.id!,
        checklistTypeId: inspection.checklistTypeId || prev?.checklistTypeId || 'premises-buildings',
        checklistTypeNameFa: inspection.checklistTypeNameFa || prev?.checklistTypeNameFa || 'چک‌لیست بهداشت',
        title: inspection.title || prev?.title || 'بازرسی بهداشت و محیط زیست',
        inspectionDate: actualDate,
        inspectionTime: inspection.inspectionTime || prev?.inspectionTime || '',
        site: inspection.site || prev?.site || '',
        unit: inspection.unit || prev?.unit || '',
        areaLocation: inspection.areaLocation || prev?.areaLocation || '',
        equipmentOrFacilityCode: inspection.equipmentOrFacilityCode || prev?.equipmentOrFacilityCode || '',
        inspectorName: inspection.inspectorName || prev?.inspectorName || user,
        supervisorName: inspection.supervisorName || prev?.supervisorName,
        hseManagerName: inspection.hseManagerName || prev?.hseManagerName,
        status: finalStatus,
        approvalStatus: inspection.approvalStatus || prev?.approvalStatus || 'PENDING_APPROVAL',
        scorePercent,
        totalItems,
        passedCount,
        failedCount,
        naCount,
        items,
        findingsSummary: inspection.findingsSummary ?? prev?.findingsSummary,
        immediateActionsTaken: inspection.immediateActionsTaken ?? prev?.immediateActionsTaken,
        recommendedCapa: inspection.recommendedCapa ?? prev?.recommendedCapa,
        photos: inspection.photos || prev?.photos || [],
        scheduleType: scheduleType || prev?.scheduleType || 'PERIODIC',
        periodicInterval: scheduleType === 'PERIODIC' ? (periodicInterval || prev?.periodicInterval || 'MONTHLY') : undefined,
        nextInspectionDate: scheduleType === 'PERIODIC' ? (nextInspectionDate || prev?.nextInspectionDate) : undefined,
        attachments: inspection.attachments || prev?.attachments || [],
        referralId: inspection.referralId || prev?.referralId,
        inspectorSignature: inspection.inspectorSignature || prev?.inspectorSignature,
        supervisorSignature: inspection.supervisorSignature || prev?.supervisorSignature,
        createdAt: prev?.createdAt || now,
        updatedAt: now,
        createdByUser: prev?.createdByUser || user,
        approvalLogs: prev?.approvalLogs || []
      };

      if (idx !== -1) {
        this.inspections[idx] = updatedRecord;
      } else {
        this.inspections.unshift(updatedRecord);
      }
      savedRecord = updatedRecord;

      await apiDb.saveHealthEnvInspection(updatedRecord);
      await apiDb.logAudit({
        action: 'UPDATE',
        module: 'HEALTH_ENV',
        entityType: 'INSPECTION_CHECKLIST',
        entityId: updatedRecord.id,
        newValue: { id: updatedRecord.id, title: updatedRecord.title, score: scorePercent },
        details: { updatedBy: user, timestamp: now }
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_inspections_updated'));
    }
    return savedRecord;
  }

  public async deleteInspection(id: string, user: string = 'کاربر سیستم'): Promise<boolean> {
    const existing = this.getInspectionById(id);
    if (!existing) return false;

    this.inspections = this.inspections.filter(i => i.id !== id);
    await apiDb.deleteHealthEnvInspection(id);

    await apiDb.logAudit({
      action: 'DELETE',
      module: 'HEALTH_ENV',
      entityType: 'INSPECTION_CHECKLIST',
      entityId: id,
      oldValue: { id, title: existing.title },
      details: { deletedBy: user, timestamp: new Date().toISOString() }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_inspections_updated'));
    }
    return true;
  }

  // --- APPROVAL WORKFLOW METHODS ---
  public async approveInspection(
    id: string, 
    user: string = 'مدیر سیستم', 
    role: string = 'سرپرست HSE',
    comment?: string
  ): Promise<HealthEnvInspection> {
    const inspection = this.getInspectionById(id);
    if (!inspection) throw new Error('بازرسی مورد نظر یافت نشد.');

    const now = new Date().toISOString();
    const todayJalali = getTodayJalaliDate();

    const newLog = {
      id: `log-${Date.now()}`,
      step: 'MANAGER_APPROVAL' as const,
      actionBy: user,
      role: role || 'سرپرست بهداشت و محیط زیست',
      timestamp: todayJalali,
      comment: comment || 'تأیید نهایی گزارش بازرسی و اقدامات اصلاحی'
    };

    const updated: HealthEnvInspection = {
      ...inspection,
      approvalStatus: 'APPROVED',
      approvedBy: user,
      approvedAt: todayJalali,
      approvalNotes: comment || inspection.approvalNotes,
      status: inspection.failedCount > 0 ? 'ACTION_REQUIRED' : 'CLOSED',
      updatedAt: now,
      approvalLogs: [...(inspection.approvalLogs || []), newLog]
    };

    return this.saveInspection(updated, user);
  }

  public async rejectInspection(
    id: string, 
    user: string = 'مدیر سیستم', 
    role: string = 'سرپرست HSE',
    comment: string
  ): Promise<HealthEnvInspection> {
    const inspection = this.getInspectionById(id);
    if (!inspection) throw new Error('بازرسی مورد نظر یافت نشد.');

    const now = new Date().toISOString();
    const todayJalali = getTodayJalaliDate();

    const newLog = {
      id: `log-${Date.now()}`,
      step: 'REJECTED' as const,
      actionBy: user,
      role: role || 'سرپرست بهداشت و محیط زیست',
      timestamp: todayJalali,
      comment: comment || 'رد گزارش بازرسی جهت بازبینی و اصلاح نواقص'
    };

    const updated: HealthEnvInspection = {
      ...inspection,
      approvalStatus: 'REJECTED',
      approvalNotes: comment,
      status: 'ACTION_REQUIRED',
      updatedAt: now,
      approvalLogs: [...(inspection.approvalLogs || []), newLog]
    };

    return this.saveInspection(updated, user);
  }
}

export const healthEnvChecklistService = new HealthEnvChecklistService();

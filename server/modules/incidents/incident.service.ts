import { incidentRepository } from './incident.repository.ts';
import { IncidentCreateRequest, CAPAItem } from './incident.types.ts';
import { workflowService } from '../workflow/workflow.service.ts';
import { auditService } from '../audit/audit.service.ts';
import { fileService } from '../files/file.service.ts';
import { ValidationError, NotFoundError } from '../../core/errors.ts';
import { UserContext } from '../../core/middleware/auth.ts';
import { dispatchDomainWebhookEvent } from '../../services/webhookDispatcher.ts';

export class IncidentService {
  private generateIncidentNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
    return `INC-${year}${month}-${randomSeq}`;
  }

  async createIncident(req: any, user?: UserContext) {
    const title = req.title || req.description || 'گزارش رویداد و ناهنجاری ایمنی';
    const incidentDate = String(req.incidentDate || req.eventDate || new Date().toLocaleDateString('fa-IR'));
    const location = req.location || req.locationSite || req.department || 'کارگاه';
    const description = req.description || req.title || 'شرح ثبت ناهنجاری / رویداد';

    const incidentNumber = req.reportNumber || req.incidentNumber || this.generateIncidentNumber();
    const reporterName = req.reporterName || user?.name || user?.username || 'گزارش‌دهنده حادثه';

    const record = await incidentRepository.create({
      id: req.id,
      incidentNumber,
      title,
      incidentType: req.incidentType || req.category || 'NEAR_MISS',
      severity: req.severity || 'MINOR',
      incidentDate,
      location,
      reporterName,
      description,
      status: req.status || 'INVESTIGATING',
      companyId: req.companyId,
      departmentId: req.departmentId,
      unitId: req.unitId,
      incidentData: {
        reporterPersonnelCode: req.reporterPersonnelCode || user?.personnelCode,
        injuredPersonName: req.injuredPersonName,
        injuredPersonCode: req.injuredPersonCode,
        immediateActions: req.immediateActions || req.immediateActionTaken,
        rootCauses: req.rootCauses || [],
        capaActions: req.capaActions || req.capaList || [],
        attachedFileIds: req.attachedFileIds || [],
        category: req.category,
        categoryFa: req.categoryFa,
        riskAssessment: req.riskAssessment,
        toxicGasLeak: req.toxicGasLeak,
      },
    });

    let workflowId: number | string | undefined;
    try {
      // Auto-create Workflow Instance
      const workflow = await workflowService.createInstance(
        {
          workflowKey: 'INCIDENT_INVESTIGATION_WORKFLOW',
          entityType: 'INCIDENT',
          entityId: incidentNumber,
          entityNumber: incidentNumber,
          title: `بررسی و اقدامات اصلاحی حادثه: ${title}`,
          priority: req.severity === 'CRITICAL' || req.severity === 'HIGH' || req.severity === 'High / Restricted Work' ? 'HIGH' : 'NORMAL',
          requesterName: reporterName,
          requesterPersonnelCode: req.reporterPersonnelCode || user?.personnelCode,
          steps: [
            {
              stepOrder: 1,
              stepName: 'بررسی صحنه حادثه و تکمیل گزارش اولیه',
              stepType: 'REVIEW',
              assignedRole: 'SAFETY_OFFICER',
              deadlineHours: 24,
            },
            {
              stepOrder: 2,
              stepName: 'تحلیل علل ریشه‌ای (RCA) و ثبت اقدامات اصلاحی (CAPA)',
              stepType: 'APPROVE',
              assignedRole: 'INVESTIGATION_TEAM',
              deadlineHours: 48,
            },
            {
              stepOrder: 3,
              stepName: 'تایید نهایی، ارزیابی اثربخشی و بستن پرونده حادثه',
              stepType: 'APPROVE_SIGN',
              assignedRole: 'HSE_MANAGER',
              deadlineHours: 72,
            },
          ],
        },
        user
      );
      workflowId = workflow?.id;
    } catch (e) {
      console.warn('Incident workflow instantiation optional warning:', e);
    }

    try {
      await auditService.log({
        action: 'CREATE_INCIDENT',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: incidentNumber,
        newValue: { incidentNumber, title, severity: req.severity },
      });
    } catch {}

    void dispatchDomainWebhookEvent({
      eventType: 'incident.reported',
      moduleName: 'incident_reporting',
      correlationKey: incidentNumber,
      idempotencyKey: `idem_incident_${incidentNumber}_${req.status || 'INVESTIGATING'}`,
      triggeredBy: user?.username || reporterName,
      data: {
        id: record?.id || incidentNumber,
        incidentNumber,
        title,
        incidentType: req.incidentType || req.category || 'NEAR_MISS',
        severity: req.severity || 'MINOR',
        incidentDate,
        location,
        status: req.status || 'INVESTIGATING',
        description,
        workflowId,
      },
    });

    return {
      ...(typeof record === 'object' && record !== null ? record : {}),
      id: record?.id || record?.incidentNumber || incidentNumber,
      incidentNumber,
      reportNumber: incidentNumber,
      workflowId,
    };
  }

  async getAllIncidents() {
    return await incidentRepository.findAll();
  }

  async getIncidentByNumber(incidentNumber: string) {
    const inc = await incidentRepository.findByNumber(incidentNumber);
    if (!inc) {
      throw new NotFoundError(`گزارش حادثه با شماره '${incidentNumber}' یافت نشد.`);
    }

    const workflow = await workflowService.getInstanceByEntity('INCIDENT', incidentNumber);
    const files = await fileService.getFilesForEntity('INCIDENT', incidentNumber);

    return {
      ...inc,
      workflow,
      files,
    };
  }

  async addCAPAAction(incidentNumber: string, action: CAPAItem, user?: UserContext) {
    const inc = await this.getIncidentByNumber(incidentNumber);
    const existingCapa = inc.incidentData?.capaActions || [];
    existingCapa.push(action);

    await incidentRepository.updateStatus(incidentNumber, inc.status, {
      ...inc.incidentData,
      capaActions: existingCapa,
    });

    await auditService.log({
      action: 'ADD_CAPA',
      module: 'INCIDENTS',
      entityType: 'INCIDENT',
      entityId: incidentNumber,
      newValue: action,
    });

    return existingCapa;
  }

  async getA4PrintableReport(incidentNumber: string) {
    const incident = await this.getIncidentByNumber(incidentNumber);
    const verification = incident.workflow
      ? await workflowService.getA4PrintableVerification(incident.workflow.id)
      : null;

    return {
      incident,
      verification,
      printMetadata: {
        paperSize: 'A4',
        orientation: 'portrait',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async deleteIncident(idOrNumber: string | number, user?: UserContext) {
    const result = await incidentRepository.delete(idOrNumber);
    try {
      await auditService.log({
        action: 'DELETE_INCIDENT',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: String(idOrNumber),
        details: { deletedBy: user?.name || user?.username || 'system' },
      });
    } catch {}
    return result;
  }
}

export const incidentService = new IncidentService();

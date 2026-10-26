import { ClinicVisit, ClinicStatistics, ClinicFilterState } from '../types/clinicTypes';
import { apiDatabaseClient, authFetch } from '../../../services/apiDatabaseClient';

class ClinicService {
  /**
   * Fetch all clinic visits directly from پایگاه داده
   */
  async getVisits(): Promise<ClinicVisit[]> {
    try {
      const res = await authFetch('/api/v1/health-exams/clinic/visits');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // fallback to apiDatabaseClient
    }

    try {
      const list = await apiDatabaseClient.getClinicVisits();
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('Failed to get clinic visits from پایگاه داده:', err);
      return [];
    }
  }

  /**
   * Fetch personnel clinical history across visits for 360° health record
   */
  async getPersonnelHistory(identifier: string): Promise<ClinicVisit[]> {
    if (!identifier) return [];
    try {
      const res = await authFetch(`/api/v1/health-exams/clinic/personnel/${encodeURIComponent(identifier)}/history`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // fallback
    }

    const all = await this.getVisits();
    const clean = String(identifier).trim().toLowerCase();
    return all.filter(v => 
      String(v.personnelCode || '').trim().toLowerCase() === clean ||
      String(v.nationalCode || '').trim().toLowerCase() === clean ||
      String(v.personnelId || '').trim().toLowerCase() === clean
    );
  }

  /**
   * Save (create or update) a clinic visit in پایگاه داده with server-side validation & audit log
   */
  async saveVisit(visit: Partial<ClinicVisit>, currentUser?: any): Promise<ClinicVisit> {
    try {
      const res = await authFetch('/api/v1/health-exams/clinic/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visit)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          window.dispatchEvent(new CustomEvent('hse_clinic_visits_updated', { detail: json.data }));
          window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'clinicVisits' } }));
          return json.data;
        }
      }
    } catch {
      // fallback to direct setting persistence
    }

    const currentVisits = await this.getVisits();
    const nowIso = new Date().toISOString();
    const visitId = visit.id || `cln-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    let visitNumber = visit.visitNumber;
    if (!visitNumber) {
      const datePart = (visit.visitDate || '').replace(/\D/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      visitNumber = `CLN-${datePart}-${randomSeq}`;
    }

    const visitRecord: ClinicVisit = {
      id: visitId,
      visitNumber,
      visitDate: visit.visitDate || '',
      visitTime: visit.visitTime || '',
      shift: visit.shift || 'عادی‌کار',
      visitType: visit.visitType || 'مراجعه معمول / سرپایی',
      chiefComplaint: visit.chiefComplaint || '',
      personnelId: visit.personnelId,
      personnelCode: visit.personnelCode || '',
      nationalCode: visit.nationalCode || '',
      fullName: visit.fullName || '',
      gender: visit.gender,
      age: visit.age,
      unit: visit.unit || '',
      department: visit.department,
      jobTitle: visit.jobTitle || '',
      phone: visit.phone,
      bloodGroup: visit.bloodGroup,
      underlyingConditions: visit.underlyingConditions,
      allergies: visit.allergies,
      triageLevel: visit.triageLevel || 3,
      systolicBp: visit.systolicBp,
      diastolicBp: visit.diastolicBp,
      pulseRate: visit.pulseRate,
      respiratoryRate: visit.respiratoryRate,
      temperature: visit.temperature,
      spo2: visit.spo2,
      bloodSugar: visit.bloodSugar,
      painScore: visit.painScore,
      consciousnessLevel: visit.consciousnessLevel || 'هوشیار (Alert)',
      physicalExamNotes: visit.physicalExamNotes,
      affectedOrgan: visit.affectedOrgan,
      primaryDiagnosis: visit.primaryDiagnosis || '',
      icdCode: visit.icdCode,
      isWorkRelated: !!visit.isWorkRelated,
      incidentLocation: visit.incidentLocation,
      actionsPerformed: visit.actionsPerformed || [],
      actionDetails: visit.actionDetails,
      medications: visit.medications || [],
      outcome: visit.outcome || 'بهبود و بازگشت به کار',
      observationDurationHours: visit.observationDurationHours,
      medicalRestDays: visit.medicalRestDays,
      medicalRestFrom: visit.medicalRestFrom,
      medicalRestTo: visit.medicalRestTo,
      referralCenter: visit.referralCenter,
      ambulanceDispatch: visit.ambulanceDispatch || { dispatched: false },
      attendingMedic: visit.attendingMedic || currentUser?.name || 'کادر بهداری',
      medicRole: visit.medicRole || 'پرستار',
      notes: visit.notes,
      status: visit.status || 'COMPLETED',
      createdAt: visit.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: visit.createdBy || currentUser?.username || 'کادر بهداری',
      updatedBy: currentUser?.username || 'کادر بهداری'
    };

    const existingIndex = currentVisits.findIndex(v => v.id === visitId);
    let updatedList: ClinicVisit[];
    if (existingIndex >= 0) {
      updatedList = [...currentVisits];
      updatedList[existingIndex] = visitRecord;
    } else {
      updatedList = [visitRecord, ...currentVisits];
    }

    await apiDatabaseClient.saveClinicVisits(updatedList);
    window.dispatchEvent(new CustomEvent('hse_clinic_visits_updated', { detail: visitRecord }));
    window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'clinicVisits' } }));
    return visitRecord;
  }

  /**
   * Delete a clinic visit from پایگاه داده
   */
  async deleteVisit(id: string): Promise<boolean> {
    try {
      const res = await authFetch(`/api/v1/health-exams/clinic/visits/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('hse_clinic_visits_updated'));
        window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'clinicVisits' } }));
        return true;
      }
    } catch {
      // fallback
    }

    const currentVisits = await this.getVisits();
    const updated = currentVisits.filter(v => v.id !== id);
    await apiDatabaseClient.saveClinicVisits(updated);
    window.dispatchEvent(new CustomEvent('hse_clinic_visits_updated'));
    window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'clinicVisits' } }));
    return true;
  }

  /**
   * Calculate real statistics strictly from persistent visits without fabricated numbers
   */
  calculateStatistics(visits: ClinicVisit[], todayJalaliDate?: string): ClinicStatistics {
    const stats: ClinicStatistics = {
      totalVisits: visits.length,
      todayVisits: 0,
      workRelatedCount: 0,
      nonWorkRelatedCount: 0,
      ambulanceDispatchCount: 0,
      totalMedicalRestDays: 0,
      triageCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      outcomeCounts: {},
      topDiagnoses: [],
      topUnits: []
    };

    const diagnosisMap: Record<string, number> = {};
    const unitMap: Record<string, number> = {};

    visits.forEach(v => {
      if (todayJalaliDate && v.visitDate === todayJalaliDate) {
        stats.todayVisits += 1;
      }

      if (v.isWorkRelated) {
        stats.workRelatedCount += 1;
      } else {
        stats.nonWorkRelatedCount += 1;
      }

      if (v.ambulanceDispatch?.dispatched) {
        stats.ambulanceDispatchCount += 1;
      }

      if (v.medicalRestDays && v.medicalRestDays > 0) {
        stats.totalMedicalRestDays += Number(v.medicalRestDays) || 0;
      }

      if (v.triageLevel && stats.triageCounts[v.triageLevel] !== undefined) {
        stats.triageCounts[v.triageLevel] += 1;
      }

      if (v.outcome) {
        stats.outcomeCounts[v.outcome] = (stats.outcomeCounts[v.outcome] || 0) + 1;
      }

      const diag = (v.primaryDiagnosis || '').trim();
      if (diag) {
        diagnosisMap[diag] = (diagnosisMap[diag] || 0) + 1;
      }

      const unit = (v.unit || '').trim();
      if (unit) {
        unitMap[unit] = (unitMap[unit] || 0) + 1;
      }
    });

    stats.topDiagnoses = Object.entries(diagnosisMap)
      .map(([diagnosis, count]) => ({ diagnosis, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    stats.topUnits = Object.entries(unitMap)
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }
}

export const clinicService = new ClinicService();

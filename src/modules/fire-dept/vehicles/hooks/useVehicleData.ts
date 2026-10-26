import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FireVehicle, 
  VehicleInspectionRecord, 
  VehicleDefectRecord, 
  VehicleMaintenanceRecord, 
  VehicleCertificate, 
  VehicleDocument,
  VehicleStandard,
  VehicleStatus,
  VehicleOverallReadiness
} from '../types/vehicleTypes';
import { INITIAL_VEHICLE_STANDARDS } from '../config/defaultStandards';
import { addAuditLog } from '../../../../utils/authHelper';
import { apiDb } from '../../../../services/apiDatabaseClient';

export const STORAGE_VEHICLES_KEY = 'hse_fire_vehicles_v1';
export const STORAGE_STANDARDS_KEY = 'hse_fire_vehicle_standards_v1';

export const INITIAL_VEHICLES_SEED: any[] = [];

// In-memory cache for synchronous reads and instant UI response
let cachedFleetVehicles: FireVehicle[] = [];
let cachedStandards: VehicleStandard[] = INITIAL_VEHICLE_STANDARDS;

// Background initial fetch from پایگاه داده
if (typeof window !== 'undefined') {
  apiDb.getFireVehicles().then(dbVehicles => {
    if (Array.isArray(dbVehicles)) {
      cachedFleetVehicles = dbVehicles;
    }
  }).catch(() => {});

  apiDb.getFireVehicleStandards().then(dbStandards => {
    if (Array.isArray(dbStandards) && dbStandards.length > 0) {
      cachedStandards = dbStandards;
    }
  }).catch(() => {});
}

export function useVehicleData() {
  const [vehicles, setVehicles] = useState<FireVehicle[]>(() => cachedFleetVehicles);
  const [standards, setStandards] = useState<VehicleStandard[]>(() => cachedStandards);
  const isRemoteSyncRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  // Centralized پایگاه داده initial load & real-time sync
  const reloadVehicleDataFromDb = useCallback(async () => {
    try {
      const [dbVehicles, dbStandards] = await Promise.all([
        apiDb.getFireVehicles(),
        apiDb.getFireVehicleStandards(),
      ]);

      isRemoteSyncRef.current = true;
      if (Array.isArray(dbVehicles)) {
        cachedFleetVehicles = dbVehicles;
        setVehicles(dbVehicles);
      }

      if (Array.isArray(dbStandards) && dbStandards.length > 0) {
        cachedStandards = dbStandards;
        setStandards(dbStandards);
      }
      hasLoadedOnceRef.current = true;
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 50);
    } catch (e) {
      console.warn('[FireVehicles] Failed to load data from database:', e);
    }
  }, []);

  useEffect(() => {
    reloadVehicleDataFromDb();

    const handleRemoteMutation = (e: any) => {
      const entity = e?.detail?.entityType || e?.detail?.key || e?.detail?.entity;
      if (!entity || entity === 'settings' || entity === 'fire_vehicles' || entity === STORAGE_VEHICLES_KEY || entity === STORAGE_STANDARDS_KEY) {
        reloadVehicleDataFromDb();
      }
    };

    window.addEventListener('app_data_mutated', handleRemoteMutation);
    window.addEventListener('hse_data_mutated', handleRemoteMutation);
    return () => {
      window.removeEventListener('app_data_mutated', handleRemoteMutation);
      window.removeEventListener('hse_data_mutated', handleRemoteMutation);
    };
  }, [reloadVehicleDataFromDb]);

  // Persist vehicles to پایگاه داده on user mutations (including when last vehicle is deleted)
  useEffect(() => {
    cachedFleetVehicles = vehicles;
    if (!hasLoadedOnceRef.current || isRemoteSyncRef.current) return;
    apiDb.saveFireVehicles(vehicles).catch(console.error);
  }, [vehicles]);

  // Persist standards to پایگاه داده on user mutations
  useEffect(() => {
    cachedStandards = standards;
    if (!hasLoadedOnceRef.current || isRemoteSyncRef.current) return;
    if (standards.length > 0) {
      apiDb.saveFireVehicleStandards(standards).catch(console.error);
    }
  }, [standards]);

  // Helper: calculate vehicle overall state from compliance score & open defects
  const calculateVehicleHealth = (
    score: number, 
    defects: VehicleDefectRecord[],
    currentStatus: VehicleStatus
  ): { overallReadiness: VehicleOverallReadiness; status: VehicleStatus } => {
    const hasCriticalDefect = defects.some(d => (d.status === 'باز' || d.status === 'در حال اقدام') && d.severity === 'بحرانی');
    const hasHighDefect = defects.some(d => (d.status === 'باز' || d.status === 'در حال اقدام') && d.severity === 'بالا');

    let overallReadiness: VehicleOverallReadiness = 'عالی';
    if (score >= 90 && !hasCriticalDefect && !hasHighDefect) {
      overallReadiness = 'عالی';
    } else if (score >= 75 && !hasCriticalDefect) {
      overallReadiness = 'قابل قبول';
    } else if (score >= 50 && !hasCriticalDefect) {
      overallReadiness = 'نیازمند اقدام';
    } else {
      overallReadiness = 'بحرانی';
    }

    let status = currentStatus;
    if (hasCriticalDefect && currentStatus !== 'در تعمیرات') {
      status = 'خارج از سرویس';
    } else if (hasHighDefect && currentStatus === 'آماده به کار') {
      status = 'آماده به کار با محدودیت';
    }

    return { overallReadiness, status };
  };

  // Add Vehicle
  const addVehicle = (vehicleData: Omit<FireVehicle, 'id' | 'complianceScore' | 'overallReadiness' | 'documents' | 'certificates' | 'maintenanceHistory' | 'inspectionHistory' | 'defects'>) => {
    const newVehicle: FireVehicle = {
      ...vehicleData,
      id: 'veh-' + Date.now(),
      complianceScore: 100,
      overallReadiness: 'عالی',
      documents: [],
      certificates: [],
      maintenanceHistory: [],
      inspectionHistory: [],
      defects: []
    };

    setVehicles(prev => [newVehicle, ...prev]);
    addAuditLog('FireDept', `افزودن خودرو جدید با کد ${vehicleData.code} (${vehicleData.plateNumber})`, 'موفقیت‌آمیز');
    return newVehicle;
  };

  // Update Vehicle
  const updateVehicle = (id: string, updates: Partial<FireVehicle>) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== id) return v;
      const updated = { ...v, ...updates };
      const health = calculateVehicleHealth(updated.complianceScore, updated.defects, updated.status);
      return {
        ...updated,
        overallReadiness: updates.overallReadiness || health.overallReadiness,
        status: updates.status || health.status
      };
    }));
    addAuditLog('FireDept', `به‌روزرسانی اطلاعات خودرو با شناسه ${id}`, 'موفقیت‌آمیز');
  };

  // Delete Vehicle
  const deleteVehicle = (id: string) => {
    const target = vehicles.find(v => v.id === id);
    setVehicles(prev => prev.filter(v => v.id !== id));
    addAuditLog('FireDept', `حذف خودرو آتش‌نشانی ${target?.code || id}`, 'موفقیت‌آمیز');
  };

  // Add Inspection Record & Auto-Create Defects
  const addInspection = (inspection: VehicleInspectionRecord, autoDefects: VehicleDefectRecord[]) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== inspection.vehicleId) return v;

      const updatedInspections = [inspection, ...v.inspectionHistory];
      const updatedDefects = [...autoDefects, ...v.defects];
      const health = calculateVehicleHealth(inspection.complianceScore, updatedDefects, v.status);

      return {
        ...v,
        lastInspectionDate: inspection.date,
        complianceScore: inspection.complianceScore,
        overallReadiness: health.overallReadiness,
        status: health.status,
        inspectionHistory: updatedInspections,
        defects: updatedDefects
      };
    }));

    addAuditLog('FireDept', `ثبت بازرسی دوره‌ای (${inspection.inspectionType}) برای خودرو ${inspection.vehicleCode} با نمره انطباق ${inspection.complianceScore}%`, 'موفقیت‌آمیز');
  };

  // Update Inspection
  const updateInspection = (vehicleId: string, inspectionId: string, updates: Partial<VehicleInspectionRecord>) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedInspections = v.inspectionHistory.map(i => i.id === inspectionId ? { ...i, ...updates } : i);
      return {
        ...v,
        inspectionHistory: updatedInspections
      };
    }));
    addAuditLog('FireDept', `ویرایش سابقه بازرسی ${inspectionId} خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Delete Inspection
  const deleteInspection = (vehicleId: string, inspectionId: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedInspections = v.inspectionHistory.filter(i => i.id !== inspectionId);
      const latestInsp = updatedInspections[0];
      const newScore = latestInsp ? latestInsp.complianceScore : 100;
      const health = calculateVehicleHealth(newScore, v.defects, v.status);
      return {
        ...v,
        complianceScore: newScore,
        overallReadiness: health.overallReadiness,
        lastInspectionDate: latestInsp ? latestInsp.date : '',
        inspectionHistory: updatedInspections
      };
    }));
    addAuditLog('FireDept', `حذف سابقه بازرسی ${inspectionId} از خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Update Defect & CAPA
  const updateDefect = (vehicleId: string, defectId: string, updates: Partial<VehicleDefectRecord>) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedDefects = v.defects.map(d => d.id === defectId ? { ...d, ...updates } : d);
      const health = calculateVehicleHealth(v.complianceScore, updatedDefects, v.status);
      return {
        ...v,
        defects: updatedDefects,
        overallReadiness: health.overallReadiness,
        status: health.status
      };
    }));
    addAuditLog('FireDept', `به‌روزرسانی مغایرت/اقدام اصلاحی ${defectId} در خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Delete Defect
  const deleteDefect = (vehicleId: string, defectId: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedDefects = v.defects.filter(d => d.id !== defectId);
      const health = calculateVehicleHealth(v.complianceScore, updatedDefects, v.status);
      return {
        ...v,
        defects: updatedDefects,
        overallReadiness: health.overallReadiness,
        status: health.status
      };
    }));
    addAuditLog('FireDept', `حذف نقص ${defectId} از خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Add Defect Manually
  const addDefectManually = (vehicleId: string, defect: Omit<VehicleDefectRecord, 'id' | 'createdDate'>) => {
    const newDefect: VehicleDefectRecord = {
      ...defect,
      id: 'DEF-' + Date.now().toString().slice(-6),
      createdDate: new Date().toLocaleDateString('fa-IR')
    };

    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedDefects = [newDefect, ...v.defects];
      const health = calculateVehicleHealth(v.complianceScore, updatedDefects, v.status);
      return {
        ...v,
        defects: updatedDefects,
        overallReadiness: health.overallReadiness,
        status: health.status
      };
    }));
    addAuditLog('FireDept', `ثبت دستی نقص جدید برای خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Add Maintenance Record
  const addMaintenance = (
    vehicleIdOrRecord: string | Omit<VehicleMaintenanceRecord, 'id'>,
    recordData?: Omit<VehicleMaintenanceRecord, 'id'>
  ) => {
    const record = typeof vehicleIdOrRecord === 'string' ? recordData! : vehicleIdOrRecord;
    const targetVehicleId = typeof vehicleIdOrRecord === 'string' ? vehicleIdOrRecord : record.vehicleId;

    const newRecord: VehicleMaintenanceRecord = {
      ...record,
      vehicleId: targetVehicleId,
      id: 'maint-' + Date.now()
    };

    setVehicles(prev => prev.map(v => {
      if (v.id !== targetVehicleId) return v;
      const updatedMileage = record.mileage && record.mileage > v.mileage ? record.mileage : v.mileage;
      return {
        ...v,
        lastServiceDate: record.date,
        mileage: updatedMileage,
        maintenanceHistory: [newRecord, ...(v.maintenanceHistory || [])]
      };
    }));

    addAuditLog('FireDept', `ثبت گزارش تعمیرات و سرویس برای خودرو ${record.vehicleCode || targetVehicleId}`, 'موفقیت‌آمیز');
  };

  // Update Maintenance Record
  const updateMaintenance = (vehicleId: string, maintenanceId: string, updates: Partial<VehicleMaintenanceRecord>) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedHistory = (v.maintenanceHistory || []).map(m => m.id === maintenanceId ? { ...m, ...updates } : m);
      return {
        ...v,
        maintenanceHistory: updatedHistory
      };
    }));
    addAuditLog('FireDept', `به‌روزرسانی سابقه تعمیرات ${maintenanceId} خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Delete Maintenance Record
  const deleteMaintenance = (vehicleId: string, maintenanceId: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedHistory = (v.maintenanceHistory || []).filter(m => m.id !== maintenanceId);
      return {
        ...v,
        maintenanceHistory: updatedHistory
      };
    }));
    addAuditLog('FireDept', `حذف گزارش تعمیراتی ${maintenanceId} از خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Add Certificate & Test
  const addCertificate = (
    vehicleIdOrCert: string | Omit<VehicleCertificate, 'id'>,
    certData?: Omit<VehicleCertificate, 'id'>
  ) => {
    const cert = typeof vehicleIdOrCert === 'string' ? certData! : vehicleIdOrCert;
    const targetVehicleId = typeof vehicleIdOrCert === 'string' ? vehicleIdOrCert : cert.vehicleId;

    const newCert: VehicleCertificate = {
      ...cert,
      vehicleId: targetVehicleId,
      id: 'cert-' + Date.now()
    };

    setVehicles(prev => prev.map(v => {
      if (v.id !== targetVehicleId) return v;
      return {
        ...v,
        certificates: [newCert, ...(v.certificates || [])],
        testCertificates: [newCert, ...(v.testCertificates || v.certificates || [])]
      };
    }));

    addAuditLog('FireDept', `ثبت گواهی و آزمون جدید (${cert.testType}) برای خودرو ${targetVehicleId}`, 'موفقیت‌آمیز');
  };

  // Update Certificate
  const updateCertificate = (vehicleId: string, certificateId: string, updates: Partial<VehicleCertificate>) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedCerts = v.certificates.map(c => c.id === certificateId ? { ...c, ...updates } : c);
      return {
        ...v,
        certificates: updatedCerts
      };
    }));
    addAuditLog('FireDept', `ویرایش گواهینامه ${certificateId} خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Delete Certificate
  const deleteCertificate = (vehicleId: string, certificateId: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedCerts = v.certificates.filter(c => c.id !== certificateId);
      return {
        ...v,
        certificates: updatedCerts
      };
    }));
    addAuditLog('FireDept', `حذف گواهینامه ${certificateId} از خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Add Document (PDF, PNG, JPG)
  const addDocument = (vehicleId: string, doc: Omit<VehicleDocument, 'id'>) => {
    const newDoc: VehicleDocument = {
      ...doc,
      id: 'doc-' + Date.now()
    };
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      return {
        ...v,
        documents: [newDoc, ...(v.documents || [])]
      };
    }));
    addAuditLog('FireDept', `بارگذاری سند جدید (${doc.title}) برای خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Update Document
  const updateDocument = (vehicleId: string, documentId: string, updates: Partial<VehicleDocument>) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedDocs = (v.documents || []).map(d => d.id === documentId ? { ...d, ...updates } : d);
      return {
        ...v,
        documents: updatedDocs
      };
    }));
    addAuditLog('FireDept', `ویرایش مشخصات سند ${documentId} خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Delete Document
  const deleteDocument = (vehicleId: string, documentId: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const updatedDocs = (v.documents || []).filter(d => d.id !== documentId);
      return {
        ...v,
        documents: updatedDocs
      };
    }));
    addAuditLog('FireDept', `حذف سند ${documentId} از خودرو ${vehicleId}`, 'موفقیت‌آمیز');
  };

  // Standards Management
  const addStandard = (std: Omit<VehicleStandard, 'id'>) => {
    const newStd: VehicleStandard = {
      ...std,
      id: 'std-' + Date.now()
    };
    setStandards(prev => [newStd, ...prev]);
    addAuditLog('FireDept', `ثبت استاندارد فنی جدید: ${std.title} (${std.code})`, 'موفقیت‌آمیز');
  };

  const updateStandard = (id: string, updates: Partial<VehicleStandard>) => {
    setStandards(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    addAuditLog('FireDept', `به‌روزرسانی استاندارد ${id}`, 'موفقیت‌آمیز');
  };

  const deleteStandard = (id: string) => {
    setStandards(prev => prev.filter(s => s.id !== id));
    addAuditLog('FireDept', `حذف استاندارد ${id}`, 'موفقیت‌آمیز');
  };

  return {
    vehicles,
    standards,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addInspection,
    updateInspection,
    deleteInspection,
    updateDefect,
    deleteDefect,
    addDefectManually,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
    addCertificate,
    updateCertificate,
    deleteCertificate,
    addDocument,
    updateDocument,
    deleteDocument,
    addStandard,
    updateStandard,
    deleteStandard
  };
}

/**
 * Get all fire fleet vehicles directly from memory cache
 */
export function getFleetVehicles(): FireVehicle[] {
  return cachedFleetVehicles;
}

/**
 * Quick add a new vehicle into the fleet database
 */
export function quickAddFleetVehicle(vehicleData: Partial<FireVehicle>): FireVehicle {
  const current = getFleetVehicles();
  const newVehicle: FireVehicle = {
    id: vehicleData.id || 'veh-' + Date.now(),
    code: vehicleData.code || `FT-0${current.length + 1}`,
    plateNumber: vehicleData.plateNumber || '',
    vehicleType: vehicleData.vehicleType || 'خودرو اطفاء حریق',
    brandModel: vehicleData.brandModel || '',
    waterTankCapacity: vehicleData.waterTankCapacity ?? 3000,
    foamTankCapacity: vehicleData.foamTankCapacity ?? 500,
    fuelType: vehicleData.fuelType || 'دیزل (گازوئیل)',
    mileage: vehicleData.mileage ?? 0,
    fireStation: vehicleData.fireStation || 'ایستگاه ۱ - مرکزی',
    responsiblePerson: vehicleData.responsiblePerson || '',
    status: vehicleData.status || 'آماده به کار',
    complianceScore: 100,
    overallReadiness: 'عالی',
    documents: [],
    certificates: [],
    maintenanceHistory: [],
    inspectionHistory: [],
    defects: []
  };

  const updated = [newVehicle, ...current];
  cachedFleetVehicles = updated;
  try {
    addAuditLog('FireDept', `افزودن سریع خودرو به ناوگان: ${newVehicle.code} (${newVehicle.brandModel || newVehicle.plateNumber})`, 'موفقیت‌آمیز');
  } catch {
    // Handled in state
  }
  apiDb.saveFireVehicles(updated).catch(console.error);

  return newVehicle;
}

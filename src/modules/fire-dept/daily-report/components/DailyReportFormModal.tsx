import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Save, CheckCircle, AlertTriangle, Flame, ShieldAlert, 
  Truck, Gauge, Plus, Trash2, Clock, Calendar, 
  User, CheckCircle2, ChevronDown, RefreshCw, FileText,
  Building2, Car, PlusCircle, Sparkles, Check, Info, Shield, Layers
} from 'lucide-react';
import { 
  FireDailyReport, 
  EquipmentOperationalStatus, 
  VehicleOperationalStatus, 
  GasLeakRecord, 
  ShiftType,
  DailyReportVehicleItem
} from '../types/dailyReportTypes';
import { useFinalSubmit } from '../../../../context/FinalSubmitContext';
import PersianDatePicker from '../../../../components/common/PersianDatePicker';
import { getComplexPersonnelList, ComplexPersonnel } from '../../../../utils/personnelHelper';
import { getUnits, getSubUnitsForUnit } from '../../../../utils/orgHelper';
import { getFleetVehicles } from '../../vehicles/hooks/useVehicleData';
import { FireVehicle, VehicleStatus } from '../../vehicles/types/vehicleTypes';
import PersonnelShiftSelector from './PersonnelShiftSelector';
import ImportVehiclesModal from './ImportVehiclesModal';
import DynamicItemsSection from './DynamicItemsSection';
import { fireDailyReportService, normalizeReport, buildInitialVehiclesStatus } from '../services/dailyReportService';
import { toast } from 'react-hot-toast';

interface Props {
  initialData?: FireDailyReport | null;
  onSave: (report: FireDailyReport) => void;
  onCancel: () => void;
  isFa?: boolean;
  currentUser?: string;
}

const EQUIPMENT_STATUS_OPTIONS: EquipmentOperationalStatus[] = [
  'سالم / نرمال',
  'دارای نقص',
  'در حال سرویس',
  'خارج از مدار',
  'تست شده'
];

const VEHICLE_STATUS_OPTIONS: VehicleOperationalStatus[] = [
  'آماده به کار (OK)',
  'دارای نقص جزئی',
  'در حال تعمیر',
  'خارج از سرویس'
];

export default function DailyReportFormModal({
  initialData,
  onSave,
  onCancel,
  isFa = true,
  currentUser = 'کارشناس آتش‌نشانی'
}: Props) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const [personnelList, setPersonnelList] = useState<ComplexPersonnel[]>(() => getComplexPersonnelList());
  const availableUnits = useMemo(() => getUnits(), []);

  useEffect(() => {
    const refreshPersonnel = () => setPersonnelList(getComplexPersonnelList());
    window.addEventListener('hse_personnel_updated', refreshPersonnel);
    window.addEventListener('app_data_mutated', refreshPersonnel);
    window.addEventListener('storage', refreshPersonnel);
    return () => {
      window.removeEventListener('hse_personnel_updated', refreshPersonnel);
      window.removeEventListener('app_data_mutated', refreshPersonnel);
      window.removeEventListener('storage', refreshPersonnel);
    };
  }, []);

  const [fleetVehicles, setFleetVehicles] = useState<FireVehicle[]>(() => getFleetVehicles());
  const [isImportVehiclesModalOpen, setIsImportVehiclesModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'general' | 'permits' | 'valves' | 'extinguishers' | 'vehicles' | 'gas_detectors' | 'faults_standby' | 'leaks_tasks'
  >('general');

  const [formData, setFormData] = useState<FireDailyReport>(() => {
    const initialFleet = getFleetVehicles();

    if (initialData) {
      return normalizeReport(JSON.parse(JSON.stringify(initialData)));
    }
    const todayJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '/');

    const randomSeq = Math.floor(1000 + Math.random() * 9000);

    // Initial vehicle status populated dynamically from registered fleet
    const initialVehiclesStatus = buildInitialVehiclesStatus(initialFleet, false);

    return {
      id: `fdr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      reportNumber: `FDR-${todayJalali.replace(/\//g, '')}-${randomSeq}`,
      reportDate: todayJalali,
      stationName: 'ایستگاه آتش نشانی معین',
      unitName: '',
      subUnitName: '',
      shift: 'DAY',
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser,

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
      dynamicCustomItems: [],

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
        fm200: { unit51: 'سالم / نرمال', unit54: 'سالم / نرمال' },
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

      signatures: {
        dayShiftOfficer: { name: '', personnelCode: '', signed: false, time: '19:00' },
        nightShiftOfficer: { name: '', personnelCode: '', signed: false, time: '07:00' }
      }
    };
  });

  // Sub-units corresponding to selected unit
  const availableSubUnits = useMemo(() => {
    if (!formData.unitName) return [];
    return getSubUnitsForUnit(formData.unitName);
  }, [formData.unitName]);

  const handleUnitChange = (newUnit: string) => {
    const subs = getSubUnitsForUnit(newUnit);
    const autoSubUnit = subs && subs.length > 0 ? (subs.find(s => s.includes('آتش')) || subs[0]) : '';
    setFormData(prev => ({
      ...prev,
      unitName: newUnit,
      subUnitName: autoSubUnit
    }));
  };

  // State for new gas leak entry
  const [newLeak, setNewLeak] = useState<Omit<GasLeakRecord, 'id'>>({
    gasType: 'Propylene (پروپیلن)',
    amountPpm: 10,
    windDirection: 'جنوب غربی (SW)',
    leakLocations: 'فلنج پمپ واحد ۲۰',
    durationMinutes: 15,
    startTime: '10:00',
    endTime: '10:15',
    actionsTaken: ''
  });

  const handleAddLeak = () => {
    if (!newLeak.gasType || !newLeak.leakLocations) return;
    const leakRecord: GasLeakRecord = {
      ...newLeak,
      id: `leak-${Date.now()}`
    };
    setFormData(prev => ({
      ...prev,
      gasLeaks: [...(prev.gasLeaks || []), leakRecord]
    }));
    setNewLeak({
      gasType: 'Propylene (پروپیلن)',
      amountPpm: 0,
      windDirection: '',
      leakLocations: '',
      durationMinutes: 0,
      startTime: '',
      endTime: '',
      actionsTaken: ''
    });
  };

  const handleRemoveLeak = (id: string) => {
    setFormData(prev => ({
      ...prev,
      gasLeaks: prev.gasLeaks.filter(l => l.id !== id)
    }));
  };

  // Active vehicles in current report
  const activeReportVehicles = useMemo(() => {
    const entries = Object.entries(formData.vehiclesStatus || {});
    return entries.map(([key, val]: [string, any]) => {
      // Find matching fleet vehicle
      const matchedFleet = fleetVehicles.find(v => v.id === key || v.code === key || v.id === val?.vehicleId || v.code === val?.vehicleCode);
      return {
        key,
        vehicleId: matchedFleet?.id || val?.vehicleId || key,
        code: matchedFleet?.code || val?.vehicleCode || (key.startsWith('veh-') ? '' : key),
        name: matchedFleet?.brandModel || val?.vehicleName || val?.name || key,
        plateNumber: matchedFleet?.plateNumber || val?.plateNumber || '',
        vehicleType: matchedFleet?.vehicleType || val?.vehicleType || 'خودرو آتش‌نشانی',
        waterTankCapacity: matchedFleet?.waterTankCapacity,
        foamTankCapacity: matchedFleet?.foamTankCapacity,
        status: val?.status || 'آماده به کار (OK)',
        description: val?.description || ''
      };
    });
  }, [formData.vehiclesStatus, fleetVehicles]);

  // Unadded vehicles from the fleet
  const unaddedFleetVehicles = useMemo(() => {
    return fleetVehicles.filter(fv => {
      const isAlreadyAdded = activeReportVehicles.some(av => av.vehicleId === fv.id || av.code === fv.code || av.key === fv.id);
      return !isAlreadyAdded;
    });
  }, [fleetVehicles, activeReportVehicles]);

  // Handler: Add/import single vehicle from fleet into report
  const handleImportSingleVehicle = (target: FireVehicle) => {
    if (!target) return;

    setFormData(prev => ({
      ...prev,
      vehiclesStatus: {
        ...prev.vehiclesStatus,
        [target.id]: {
          vehicleId: target.id,
          vehicleCode: target.code,
          vehicleName: target.brandModel || target.vehicleType,
          plateNumber: target.plateNumber,
          vehicleType: target.vehicleType,
          status: target.status === 'خارج از سرویس' ? 'خارج از سرویس' : target.status === 'در تعمیرات' ? 'در حال تعمیر' : target.status === 'آماده به کار با محدودیت' ? 'دارای نقص جزئی' : 'آماده به کار (OK)',
          description: `مخزن آب: ${target.waterTankCapacity || 0}L - فوم: ${target.foamTankCapacity || 0}L`
        }
      }
    }));
  };

  // Handler: Import all ready vehicles from fleet
  const handleImportAllReadyVehicles = () => {
    const readyVehicles = fleetVehicles.filter(v => v.status === 'آماده به کار');
    const newStatuses: Record<string, DailyReportVehicleItem> = { ...(formData.vehiclesStatus || {}) };
    readyVehicles.forEach(target => {
      newStatuses[target.id] = {
        vehicleId: target.id,
        vehicleCode: target.code,
        vehicleName: target.brandModel || target.vehicleType,
        plateNumber: target.plateNumber,
        vehicleType: target.vehicleType,
        status: 'آماده به کار (OK)',
        description: `مخزن آب: ${target.waterTankCapacity || 0}L - فوم: ${target.foamTankCapacity || 0}L`
      };
    });
    setFormData(prev => ({ ...prev, vehiclesStatus: newStatuses }));
  };

  // Handler: Import all fleet vehicles
  const handleImportAllFleetVehicles = () => {
    const newStatuses: Record<string, DailyReportVehicleItem> = { ...(formData.vehiclesStatus || {}) };
    fleetVehicles.forEach(target => {
      newStatuses[target.id] = {
        vehicleId: target.id,
        vehicleCode: target.code,
        vehicleName: target.brandModel || target.vehicleType,
        plateNumber: target.plateNumber,
        vehicleType: target.vehicleType,
        status: target.status === 'خارج از سرویس' ? 'خارج از سرویس' : target.status === 'در تعمیرات' ? 'در حال تعمیر' : target.status === 'آماده به کار با محدودیت' ? 'دارای نقص جزئی' : 'آماده به کار (OK)',
        description: `مخزن آب: ${target.waterTankCapacity || 0}L - فوم: ${target.foamTankCapacity || 0}L`
      };
    });
    setFormData(prev => ({ ...prev, vehiclesStatus: newStatuses }));
  };

  // Handler: Remove vehicle from report
  const handleRemoveVehicleFromReport = (key: string) => {
    setFormData(prev => {
      const nextVehicles = { ...prev.vehiclesStatus };
      delete nextVehicles[key];
      return {
        ...prev,
        vehiclesStatus: nextVehicles
      };
    });
  };


  // Quick Counter Helper
  const renderNumberStepper = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    step = 1,
    min = 0,
    accentColor = 'blue'
  ) => {
    return (
      <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - step))}
            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 font-bold transition cursor-pointer"
          >
            -
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
            className="w-14 text-center font-mono font-bold text-xs py-1 px-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onChange(value + step)}
            className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 font-bold transition cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  // Helper for Status Selector
  const renderStatusSelect = (
    label: string,
    currentValue: string,
    onChange: (newVal: any) => void,
    options: string[] = EQUIPMENT_STATUS_OPTIONS
  ) => {
    const isBad = currentValue === 'دارای نقص' || currentValue === 'خارج از مدار' || currentValue === 'خارج از سرویس';
    const isWarn = currentValue === 'در حال سرویس' || currentValue === 'در حال تعمیر' || currentValue === 'دارای نقص جزئی';
    
    return (
      <div className="flex flex-col gap-1 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            isBad ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
            isWarn ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}>
            {currentValue}
          </span>
        </div>
        <select
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  };

  // Save as Draft
  const handleSaveDraft = () => {
    onSave({
      ...formData,
      status: 'DRAFT',
      updatedAt: new Date().toISOString()
    });
  };

  const [isSyncingModules, setIsSyncingModules] = useState(false);

  const handleAutoSync = async () => {
    setIsSyncingModules(true);
    try {
      const res = await fireDailyReportService.autoSyncFromModules(formData.reportDate, formData);
      setFormData(res.syncedReport);
      toast.success(
        isFa
          ? `همگام‌سازی انجام شد: ${res.summary.permitsFound} پروانه کار، ${res.summary.confinedFound} فضای بسته، ${res.summary.vehiclesFound} خودرو ناوگان، ${res.summary.incidentsFound} حادثه.`
          : `Synchronized: ${res.summary.permitsFound} permits, ${res.summary.confinedFound} confined spaces, ${res.summary.vehiclesFound} vehicles, ${res.summary.incidentsFound} incidents.`
      );
    } catch (err) {
      console.error('Failed to sync from modules:', err);
      toast.error(isFa ? 'خطا در ارتباط و همگام‌سازی با ماژول‌های سامانه.' : 'Error syncing from modules.');
    } finally {
      setIsSyncingModules(false);
    }
  };

  const updateAttachedPermit = (key: 'excavation' | 'confinedSpace' | 'vehicleCrane' | 'radiation' | 'electricalIsolation' | 'processIsolation', val: number) => {
    setFormData(p => {
      const currentAtt = {
        excavation: p.workPermitsIssued?.attachedPermits?.excavation || 0,
        confinedSpace: p.workPermitsIssued?.attachedPermits?.confinedSpace ?? p.workPermitsIssued?.confinedSpace ?? 0,
        vehicleCrane: p.workPermitsIssued?.attachedPermits?.vehicleCrane || 0,
        radiation: p.workPermitsIssued?.attachedPermits?.radiation || 0,
        electricalIsolation: p.workPermitsIssued?.attachedPermits?.electricalIsolation || 0,
        processIsolation: p.workPermitsIssued?.attachedPermits?.processIsolation || 0,
        totalAttached: 0
      };
      currentAtt[key] = Math.max(0, val);
      currentAtt.totalAttached = 
        currentAtt.excavation + 
        currentAtt.confinedSpace + 
        currentAtt.vehicleCrane + 
        currentAtt.radiation + 
        currentAtt.electricalIsolation + 
        currentAtt.processIsolation;

      return {
        ...p,
        workPermitsIssued: {
          ...p.workPermitsIssued,
          attachedPermits: currentAtt,
          confinedSpace: currentAtt.confinedSpace
        }
      };
    });
  };

  // Final Submit with global confirm
  const handleFinalSubmit = () => {
    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        onSave({
          ...formData,
          status: 'FINALIZED',
          finalizedAt: new Date().toISOString(),
          finalizedBy: currentUser,
          updatedAt: new Date().toISOString()
        });
      }
    });
  };

  const tabs = [
    { id: 'general', title: isFa ? 'اطلاعات و بازرسی‌ها' : 'General & Inspections' },
    { id: 'permits', title: isFa ? 'مجوز های پروانه کار' : 'Work Permits' },
    { id: 'valves', title: isFa ? 'اطفای آبی و شیرآلات' : 'Water & Valves' },
    { id: 'extinguishers', title: isFa ? 'کپسول‌ها و FM200' : 'Extinguishers & FM200' },
    { id: 'vehicles', title: isFa ? 'وضعیت ناوگان خودروها' : 'Fleet Vehicles' },
    { id: 'gas_detectors', title: isFa ? 'گازیاب‌ها (ثابت و متحرک)' : 'Gas Detectors' },
    { id: 'faults_standby', title: isFa ? 'آلارم، اسکورت و استندبای' : 'Faults & Standby' },
    { id: 'leaks_tasks', title: isFa ? 'نشت گاز، شرح کار و امضا' : 'Gas Leaks & Work Log' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir={isFa ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">
                {initialData ? (isFa ? 'ویرایش گزارش روزانه ایستگاه آتش‌نشانی' : 'Edit Fire Daily Report') : (isFa ? 'ثبت گزارش روزانه ایستگاه آتش‌نشانی معین' : 'New Fire Station Daily Report')}
              </h2>
              <p className="text-xs text-red-100">
                {formData.stationName} | {isFa ? 'شماره:' : 'No:'} <span className="font-mono">{formData.reportNumber}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoSync}
              disabled={isSyncingModules}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              title={isFa ? 'دریافت و ادغام خودکار اطلاعات از ماژول‌های پروانه کار (PTW)، ناوگان خودرویی، تجهیزات و حوادث' : 'Auto-Sync from PTW, Fleet, Equipment & Incidents'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingModules ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isFa ? 'همگام‌سازی از ماژول‌ها' : 'Auto-Sync'}</span>
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 overflow-x-auto p-1.5 gap-1 shrink-0 scrollbar-none text-xs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-750'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs text-slate-800 dark:text-slate-100">
          
          {/* TAB 1: GENERAL & INSPECTIONS */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                {/* 1. نام واحد سازمانی */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      {isFa ? 'نام واحد سازمانی' : 'Unit / Dept'}
                    </span>
                    <span className="text-[9.5px] text-blue-600 dark:text-blue-400 font-normal bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                      {isFa ? 'واحدها و مشاغل' : 'Units'}
                    </span>
                  </label>
                  <select
                    value={formData.unitName || ''}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold focus:ring-2 focus:ring-red-500 cursor-pointer"
                  >
                    <option value="">{isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Department --'}</option>
                    {availableUnits.length === 0 && (
                      <option value="" disabled>
                        {isFa ? '⚠️ هنوز واحدی در ساختار سازمانی تعریف نشده است' : '⚠️ No units defined in Org Structure'}
                      </option>
                    )}
                    {availableUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                    {!availableUnits.includes(formData.unitName || '') && formData.unitName && (
                      <option value={formData.unitName}>{formData.unitName}</option>
                    )}
                  </select>
                </div>

                {/* 2. زیرمجموعه واحد (خودکار بر اساس واحد انتخابی) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {isFa ? 'زیرمجموعه واحد' : 'Sub-Unit'}
                    </span>
                    {availableSubUnits.length > 0 ? (
                      <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                        {availableSubUnits.length} {isFa ? 'زیربخش' : 'subs'}
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-400 font-normal">
                        {isFa ? 'بدون زیرمجموعه' : 'No subs'}
                      </span>
                    )}
                  </label>
                  {availableSubUnits.length > 0 ? (
                    <select
                      value={formData.subUnitName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, subUnitName: e.target.value }))}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold focus:ring-2 focus:ring-red-500 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">{isFa ? '-- انتخاب زیرمجموعه واحد --' : '-- Select Sub-Unit --'}</option>
                      {availableSubUnits.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                      {!availableSubUnits.includes(formData.subUnitName || '') && formData.subUnitName && (
                        <option value={formData.subUnitName}>{formData.subUnitName}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={isFa ? 'نام زیرمجموعه (اختیاری)...' : 'Sub-unit name...'}
                      value={formData.subUnitName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, subUnitName: e.target.value }))}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold placeholder:text-slate-400"
                    />
                  )}
                </div>

                {/* 3. ایستگاه آتش‌نشانی */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    {isFa ? 'ایستگاه آتش‌نشانی' : 'Fire Station'}
                  </label>
                  <input
                    type="text"
                    value={formData.stationName}
                    onChange={(e) => setFormData(prev => ({ ...prev, stationName: e.target.value }))}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold"
                  />
                </div>

                {/* 4. تاریخ گزارش */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    {isFa ? 'تاریخ گزارش' : 'Report Date'}
                  </label>
                  <PersianDatePicker
                    value={formData.reportDate}
                    onChange={(val) => setFormData(prev => ({ ...prev, reportDate: val }))}
                    className="w-full text-xs font-mono font-bold"
                  />
                </div>

                {/* 5. شیفت / نوبتکاری */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    {isFa ? 'شیفت / نوبتکاری' : 'Shift'}
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData(prev => ({ ...prev, shift: e.target.value as ShiftType }))}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold focus:ring-2 focus:ring-red-500"
                  >
                    <option value="DAY">{isFa ? 'نوبتکار روز (DAY)' : 'Day Shift'}</option>
                    <option value="NIGHT">{isFa ? 'نوبتکار شب (NIGHT)' : 'Night Shift'}</option>
                    <option value="ROTATING">{isFa ? 'نوبتکار چرخشی' : 'Rotating'}</option>
                  </select>
                </div>
              </div>

              {/* بازرسی و گزارشات */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  {isFa ? 'بازرسی‌ها و حوادث روزانه' : 'Inspections & Daily Incidents'}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderNumberStepper(
                    isFa ? 'تعداد بازرسی HSE' : 'HSE Inspections Count',
                    formData.inspectionsAndIncidents.hseInspectionsCount,
                    (val) => setFormData(p => ({
                      ...p,
                      inspectionsAndIncidents: { ...p.inspectionsAndIncidents, hseInspectionsCount: val }
                    }))
                  )}

                  {renderNumberStepper(
                    isFa ? 'تعداد بازرسی آتش‌نشانی' : 'Fire Dept Inspections Count',
                    formData.inspectionsAndIncidents.fireInspectionsCount,
                    (val) => setFormData(p => ({
                      ...p,
                      inspectionsAndIncidents: { ...p.inspectionsAndIncidents, fireInspectionsCount: val }
                    }))
                  )}
                </div>

                {/* حوادث انسانی، ماشینی، آتش‌سوزی */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* حوادث انسانی */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                      {isFa ? 'تعداد حوادث انسانی' : 'Human Incidents'}
                    </h4>
                    {renderNumberStepper(isFa ? 'جزئی' : 'Minor', formData.inspectionsAndIncidents.humanIncidents.minor, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, humanIncidents: { ...p.inspectionsAndIncidents.humanIncidents, minor: val } }
                    })))}
                    {renderNumberStepper(isFa ? 'قابل ثبت' : 'Recordable', formData.inspectionsAndIncidents.humanIncidents.recordable, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, humanIncidents: { ...p.inspectionsAndIncidents.humanIncidents, recordable: val } }
                    })))}
                    {renderNumberStepper(isFa ? 'حاد' : 'Severe', formData.inspectionsAndIncidents.humanIncidents.severe, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, humanIncidents: { ...p.inspectionsAndIncidents.humanIncidents, severe: val } }
                    })))}
                  </div>

                  {/* حوادث ماشینی */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                      {isFa ? 'تعداد حوادث ماشینی' : 'Vehicle Incidents'}
                    </h4>
                    {renderNumberStepper(isFa ? 'جزئی' : 'Minor', formData.inspectionsAndIncidents.vehicleIncidents.minor, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, vehicleIncidents: { ...p.inspectionsAndIncidents.vehicleIncidents, minor: val } }
                    })))}
                    {renderNumberStepper(isFa ? 'قابل ثبت' : 'Recordable', formData.inspectionsAndIncidents.vehicleIncidents.recordable, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, vehicleIncidents: { ...p.inspectionsAndIncidents.vehicleIncidents, recordable: val } }
                    })))}
                    {renderNumberStepper(isFa ? 'حاد' : 'Severe', formData.inspectionsAndIncidents.vehicleIncidents.severe, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, vehicleIncidents: { ...p.inspectionsAndIncidents.vehicleIncidents, severe: val } }
                    })))}
                  </div>

                  {/* تعداد آتش‌سوزی */}
                  <div className="p-3.5 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-800/40 space-y-2">
                    <h4 className="font-bold text-xs text-red-800 dark:text-red-300 border-b border-red-200 dark:border-red-800/40 pb-1.5">
                      {isFa ? 'تعداد آتش‌سوزی' : 'Fire Incidents'}
                    </h4>
                    {renderNumberStepper(isFa ? 'جزئی' : 'Minor', formData.inspectionsAndIncidents.fireIncidents.minor, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, fireIncidents: { ...p.inspectionsAndIncidents.fireIncidents, minor: val } }
                    })))}
                    {renderNumberStepper(isFa ? 'قابل ثبت' : 'Recordable', formData.inspectionsAndIncidents.fireIncidents.recordable, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, fireIncidents: { ...p.inspectionsAndIncidents.fireIncidents, recordable: val } }
                    })))}
                    {renderNumberStepper(isFa ? 'حاد' : 'Severe', formData.inspectionsAndIncidents.fireIncidents.severe, (val) => setFormData(p => ({
                      ...p, inspectionsAndIncidents: { ...p.inspectionsAndIncidents, fireIncidents: { ...p.inspectionsAndIncidents.fireIncidents, severe: val } }
                    })))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORK PERMITS */}
          {activeTab === 'permits' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header with Info & Sync from PTW */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    {isFa ? 'مجوز های پروانه کار (PTW)' : 'Work Permits (PTW)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa 
                      ? 'تفکیک پروانه‌های کار اصلی و الحاقی با دریافت خودکار از ماژول PTW' 
                      : 'Main & attached permits breakdown with automatic sync from PTW module'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAutoSync}
                  disabled={isSyncingModules}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingModules ? 'animate-spin' : ''}`} />
                  <span>{isFa ? 'دریافت پروانه‌های امروز از ماژول PTW' : 'Sync from PTW'}</span>
                </button>
              </div>

              {/* 1. پروانه‌های اصلی (Main Permits) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    {isFa ? '۱. پروانه‌های کار اصلی (Main Work Permits)' : '1. Main Work Permits'}
                  </h4>
                  <span className="text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-mono">
                    {isFa ? 'مجموع پروانه‌های اصلی:' : 'Total Main:'} {
                      (Number(formData.workPermitsIssued.hotWork) || 0) +
                      (Number(formData.workPermitsIssued.coldWork) || 0)
                    }
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderNumberStepper(
                    isFa ? 'کار گرم (Hot Work)' : 'Hot Work',
                    formData.workPermitsIssued.hotWork,
                    (val) => setFormData(p => {
                      const updatedPermits = { ...p.workPermitsIssued, hotWork: Math.max(0, val) };
                      updatedPermits.totalMainPermits = updatedPermits.hotWork + (p.workPermitsIssued.coldWork || 0);
                      return { ...p, workPermitsIssued: updatedPermits };
                    })
                  )}

                  {renderNumberStepper(
                    isFa ? 'کار سرد (Cold Work)' : 'Cold Work',
                    formData.workPermitsIssued.coldWork,
                    (val) => setFormData(p => {
                      const updatedPermits = { ...p.workPermitsIssued, coldWork: Math.max(0, val) };
                      updatedPermits.totalMainPermits = (p.workPermitsIssued.hotWork || 0) + updatedPermits.coldWork;
                      return { ...p, workPermitsIssued: updatedPermits };
                    })
                  )}
                </div>
              </div>

              {/* 2. پروانه‌های الحاقی (Attached / Supplementary Permits) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    {isFa ? '۲. پروانه‌های کار الحاقی (Attached Permits)' : '2. Attached Permits'}
                  </h4>
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-mono">
                    {isFa ? 'مجموع الحاقی‌ها:' : 'Total Attached:'} {
                      (Number(formData.workPermitsIssued.attachedPermits?.excavation) || 0) +
                      (Number(formData.workPermitsIssued.attachedPermits?.confinedSpace ?? formData.workPermitsIssued.confinedSpace) || 0) +
                      (Number(formData.workPermitsIssued.attachedPermits?.vehicleCrane) || 0) +
                      (Number(formData.workPermitsIssued.attachedPermits?.radiation) || 0) +
                      (Number(formData.workPermitsIssued.attachedPermits?.electricalIsolation) || 0) +
                      (Number(formData.workPermitsIssued.attachedPermits?.processIsolation) || 0)
                    }
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {renderNumberStepper(
                    isFa ? 'حفاری' : 'Excavation',
                    formData.workPermitsIssued.attachedPermits?.excavation || 0,
                    (val) => updateAttachedPermit('excavation', val)
                  )}

                  {renderNumberStepper(
                    isFa ? 'ورود به فضا بسته' : 'Confined Space Entry',
                    formData.workPermitsIssued.attachedPermits?.confinedSpace ?? formData.workPermitsIssued.confinedSpace ?? 0,
                    (val) => updateAttachedPermit('confinedSpace', val)
                  )}

                  {renderNumberStepper(
                    isFa ? 'ورود خودرو / جرثقیل' : 'Vehicle / Crane Entry',
                    formData.workPermitsIssued.attachedPermits?.vehicleCrane || 0,
                    (val) => updateAttachedPermit('vehicleCrane', val)
                  )}

                  {renderNumberStepper(
                    isFa ? 'منابع پرتوزا' : 'Radiation Sources',
                    formData.workPermitsIssued.attachedPermits?.radiation || 0,
                    (val) => updateAttachedPermit('radiation', val)
                  )}

                  {renderNumberStepper(
                    isFa ? 'جداسازی الکتریکی' : 'Electrical Isolation',
                    formData.workPermitsIssued.attachedPermits?.electricalIsolation || 0,
                    (val) => updateAttachedPermit('electricalIsolation', val)
                  )}

                  {renderNumberStepper(
                    isFa ? 'جداسازی فرایندی/مکانیکی/ابزار دقیق' : 'Process/Mechanical/Inst. Isolation',
                    formData.workPermitsIssued.attachedPermits?.processIsolation || 0,
                    (val) => updateAttachedPermit('processIsolation', val)
                  )}
                </div>
              </div>

              {/* 3. سنجه‌های کنترلی آتش‌نشانی و وضعیت پروانه‌ها */}
              <div className="space-y-3 pt-1">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  {isFa ? '۳. سنجه‌های کنترلی آتش‌نشانی و وضعیت پروانه‌ها' : '3. Fire Dept Controls & Permit Status'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderNumberStepper(
                    isFa ? 'GAS Testers (سنجش گاز)' : 'Gas Testers',
                    formData.workPermitsIssued.gasTesters,
                    (val) => setFormData(p => ({
                      ...p,
                      workPermitsIssued: { ...p.workPermitsIssued, gasTesters: Math.max(0, val) }
                    }))
                  )}

                  {renderNumberStepper(
                    isFa ? 'Stand by (آماده‌باش آتش‌نشانی)' : 'Stand by',
                    formData.workPermitsIssued.standby,
                    (val) => setFormData(p => ({
                      ...p,
                      workPermitsIssued: { ...p.workPermitsIssued, standby: Math.max(0, val) }
                    }))
                  )}

                  {renderNumberStepper(
                    isFa ? 'مجوز های باطل شده' : 'Revoked Permits',
                    formData.workPermitsIssued.revokedPermits,
                    (val) => setFormData(p => ({
                      ...p,
                      workPermitsIssued: { ...p.workPermitsIssued, revokedPermits: Math.max(0, val) }
                    }))
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'یادداشت‌ها و نکات نظارتی مجوزهای کار :' : 'Permit Monitoring Notes :'}
                  </label>
                  <input
                    type="text"
                    value={formData.workPermitsIssued.notes || ''}
                    onChange={(e) => setFormData(p => ({
                      ...p,
                      workPermitsIssued: { ...p.workPermitsIssued, notes: e.target.value }
                    }))}
                    placeholder={isFa ? 'نکات مهم ایمنی، توقفات کار، الزامات تمدید پروانه‌ها...' : 'Permit safety notes...'}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WATER & VALVES */}
          {activeTab === 'valves' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {isFa ? 'Deluge Valve (مخازن ذخیره)' : 'Deluge Valves (Storage Tanks)'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {renderStatusSelect('FB-8001A', formData.waterSuppressionAndValves.delugeValves.fb8001A, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, delugeValves: { ...p.waterSuppressionAndValves.delugeValves, fb8001A: val } }
                  })))}
                  {renderStatusSelect('FB-8001B', formData.waterSuppressionAndValves.delugeValves.fb8001B, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, delugeValves: { ...p.waterSuppressionAndValves.delugeValves, fb8001B: val } }
                  })))}
                  {renderStatusSelect('FB-4501', formData.waterSuppressionAndValves.delugeValves.fb4501, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, delugeValves: { ...p.waterSuppressionAndValves.delugeValves, fb4501: val } }
                  })))}
                  {renderStatusSelect('FB-4502', formData.waterSuppressionAndValves.delugeValves.fb4502, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, delugeValves: { ...p.waterSuppressionAndValves.delugeValves, fb4502: val } }
                  })))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {isFa ? 'شیرآلات، هوزریل، هایدرانت‌ها و مانیتورها' : 'Valves, Hoses, Hydrants & Monitors'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {renderStatusSelect('ON/OFF Valve(u20)', formData.waterSuppressionAndValves.onOffValveU20, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, onOffValveU20: val }
                  })))}
                  {renderStatusSelect('ON/OFF Valve(u40)', formData.waterSuppressionAndValves.onOffValveU40, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, onOffValveU40: val }
                  })))}
                  {renderStatusSelect('Rail hose (ریل هوز)', formData.waterSuppressionAndValves.railHose, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, railHose: val }
                  })))}
                  {renderStatusSelect('Hydrants (هایدرانت‌ها)', formData.waterSuppressionAndValves.hydrants, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, hydrants: val }
                  })))}
                  {renderStatusSelect('Monitors (مانیتورهای اطفاء)', formData.waterSuppressionAndValves.monitors, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, monitors: val }
                  })))}
                  {renderStatusSelect('Fire Box (جعبه‌های آتش‌نشانی)', formData.waterSuppressionAndValves.fireBox, (val) => setFormData(p => ({
                    ...p, waterSuppressionAndValves: { ...p.waterSuppressionAndValves, fireBox: val }
                  })))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXTINGUISHERS & FM200 */}
          {activeTab === 'extinguishers' && (
            <div className="space-y-6 animate-fadeIn">
              {/* کپسول‌های پودری و گازکربنیک موجود */}
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {isFa ? 'تعداد کپسول‌های موجود در سایت' : 'Site Existing Extinguishers'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {renderNumberStepper(isFa ? 'پودری ۶ کیلوگرم (6kg)' : 'Powder 6kg', formData.fireExtinguishers.powderExisting.kg6, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, powderExisting: { ...p.fireExtinguishers.powderExisting, kg6: val } }
                  })))}
                  {renderNumberStepper(isFa ? 'پودری ۴۰ کیلوگرم (40kg)' : 'Powder 40kg', formData.fireExtinguishers.powderExisting.kg40, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, powderExisting: { ...p.fireExtinguishers.powderExisting, kg40: val } }
                  })))}
                  {renderNumberStepper(isFa ? 'گازکربنیک ۶ کیلو (CO2 6kg)' : 'CO2 6kg', formData.fireExtinguishers.co2Existing.kg6, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, co2Existing: { ...p.fireExtinguishers.co2Existing, kg6: val } }
                  })))}
                  {renderNumberStepper(isFa ? 'گازکربنیک ۳۰ کیلو (CO2 30kg)' : 'CO2 30kg', formData.fireExtinguishers.co2Existing.kg30, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, co2Existing: { ...p.fireExtinguishers.co2Existing, kg30: val } }
                  })))}
                  {renderNumberStepper(isFa ? 'گازکربنیک ۱۰ کیلو (CO2 10kg)' : 'CO2 10kg', formData.fireExtinguishers.co2Existing.kg10, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, co2Existing: { ...p.fireExtinguishers.co2Existing, kg10: val } }
                  })))}
                </div>
              </div>

              {/* وضعیت انبار */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    {isFa ? 'تعداد کپسول‌های شارژ شده در انبار' : 'Warehouse Charged Cylinders'}
                  </h4>
                  {renderNumberStepper('40 kg', formData.fireExtinguishers.warehouseCharged.kg40, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, warehouseCharged: { ...p.fireExtinguishers.warehouseCharged, kg40: val } }
                  })))}
                  {renderNumberStepper('6 kg', formData.fireExtinguishers.warehouseCharged.kg6, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, warehouseCharged: { ...p.fireExtinguishers.warehouseCharged, kg6: val } }
                  })))}
                  {renderNumberStepper('CO2', formData.fireExtinguishers.warehouseCharged.co2, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, warehouseCharged: { ...p.fireExtinguishers.warehouseCharged, co2: val } }
                  })))}
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    {isFa ? 'تعداد کپسول‌های شارژ نشده در انبار (نیازمند شارژ)' : 'Warehouse Uncharged Cylinders'}
                  </h4>
                  {renderNumberStepper('40 kg', formData.fireExtinguishers.warehouseUncharged.kg40, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, warehouseUncharged: { ...p.fireExtinguishers.warehouseUncharged, kg40: val } }
                  })))}
                  {renderNumberStepper('6 kg', formData.fireExtinguishers.warehouseUncharged.kg6, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, warehouseUncharged: { ...p.fireExtinguishers.warehouseUncharged, kg6: val } }
                  })))}
                  {renderNumberStepper('CO2', formData.fireExtinguishers.warehouseUncharged.co2, (val) => setFormData(p => ({
                    ...p, fireExtinguishers: { ...p.fireExtinguishers, warehouseUncharged: { ...p.fireExtinguishers.warehouseUncharged, co2: val } }
                  })))}
                </div>
              </div>

              {/* FM200 & سیستم اعلام حریق */}
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {isFa ? 'سیستم اطفاء FM200 و اعلام حریق' : 'FM200 & Fire Alarm Systems'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {renderStatusSelect('FM200 (Unit 51)', formData.gaseousAndAlarmSystems.fm200.unit51, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, fm200: { ...p.gaseousAndAlarmSystems.fm200, unit51: val } }
                  })))}
                  {renderStatusSelect('FM200 (Unit 54)', formData.gaseousAndAlarmSystems.fm200.unit54, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, fm200: { ...p.gaseousAndAlarmSystems.fm200, unit54: val } }
                  })))}
                  {renderStatusSelect('Call Point (شستی اعلام)', formData.gaseousAndAlarmSystems.alarmSystems.callPoints, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, alarmSystems: { ...p.gaseousAndAlarmSystems.alarmSystems, callPoints: val } }
                  })))}
                  {renderStatusSelect('دودیاب‌ها (Smoke Detectors)', formData.gaseousAndAlarmSystems.alarmSystems.smokeDetectors, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, alarmSystems: { ...p.gaseousAndAlarmSystems.alarmSystems, smokeDetectors: val } }
                  })))}
                  {renderStatusSelect('حرارت‌یاب (Heat Detectors)', formData.gaseousAndAlarmSystems.alarmSystems.heatDetectors, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, alarmSystems: { ...p.gaseousAndAlarmSystems.alarmSystems, heatDetectors: val } }
                  })))}
                  {renderStatusSelect('شعله‌یاب (Flame Detectors)', formData.gaseousAndAlarmSystems.alarmSystems.flameDetectors, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, alarmSystems: { ...p.gaseousAndAlarmSystems.alarmSystems, flameDetectors: val } }
                  })))}
                  {renderStatusSelect('آژیرها (Horns / Sirens)', formData.gaseousAndAlarmSystems.alarmSystems.hornsSirens, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, alarmSystems: { ...p.gaseousAndAlarmSystems.alarmSystems, hornsSirens: val } }
                  })))}
                  {renderStatusSelect('تابلو مرکزی (FACP Panel)', formData.gaseousAndAlarmSystems.alarmSystems.mainPanel, (val) => setFormData(p => ({
                    ...p, gaseousAndAlarmSystems: { ...p.gaseousAndAlarmSystems, alarmSystems: { ...p.gaseousAndAlarmSystems.alarmSystems, mainPanel: val } }
                  })))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FLEET VEHICLES */}
          {activeTab === 'vehicles' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Section Header with Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-red-600" />
                    {isFa ? 'وضعیت ناوگان خودروهای آتش‌نشانی و امداد' : 'Fire & Rescue Fleet Status'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa
                      ? 'خودروهای ثبت‌شده در ناوگان ایستگاه آتش‌نشانی - ثبت وضعیت عملیاتی، سوخت و تجهیزات'
                      : 'Registered fire fleet vehicles - Record operational readiness, fuel & equipment'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Button to import vehicles from fleet - Always accessible */}
                  <button
                    type="button"
                    onClick={() => {
                      setFleetVehicles(getFleetVehicles());
                      setIsImportVehiclesModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm hover:shadow"
                  >
                    <Truck className="w-4 h-4" />
                    <span>{isFa ? 'وارد کردن خودرو از ناوگان' : 'Import Vehicle from Fleet'}</span>
                    <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10.5px] font-mono font-black">
                      {fleetVehicles.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Vehicle Cards Grid */}
              {activeReportVehicles.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 space-y-3">
                  <Truck className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    {isFa ? 'هیچ خودرویی در این گزارش ثبت نشده است.' : 'No vehicles in this report.'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {isFa ? 'برای افزودن خودروهای عملیاتی به گزارش روزانه شیفت، روی دکمه «وارد کردن خودرو از ناوگان» کلیک فرمایید.' : 'Click "Import Vehicle from Fleet" to add registered vehicles to this daily shift report.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFleetVehicles(getFleetVehicles());
                      setIsImportVehiclesModalOpen(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    {isFa ? 'وارد کردن خودرو از ناوگان' : 'Import Vehicle from Fleet'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeReportVehicles.map(veh => {
                    return (
                      <div
                        key={veh.key}
                        className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 relative transition hover:border-slate-300 dark:hover:border-slate-600"
                      >
                        {/* Vehicle Title & Info */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {veh.code && (
                              <span className="font-mono text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded-lg shrink-0">
                                {veh.code}
                              </span>
                            )}
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-tight">
                                {veh.name}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>{veh.vehicleType}</span>
                                {veh.plateNumber && <span>| پلاک: {veh.plateNumber}</span>}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveVehicleFromReport(veh.key)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer shrink-0"
                            title={isFa ? 'حذف از این گزارش' : 'Remove from report'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Status Selector & Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              {isFa ? 'وضعیت عملیاتی' : 'Status'}
                            </label>
                            <select
                              value={veh.status}
                              onChange={(e) => {
                                const newStatus = e.target.value as VehicleOperationalStatus;
                                setFormData(p => ({
                                  ...p,
                                  vehiclesStatus: {
                                    ...p.vehiclesStatus,
                                    [veh.key]: {
                                      ...(p.vehiclesStatus[veh.key] || {}),
                                      vehicleId: veh.vehicleId,
                                      vehicleCode: veh.code,
                                      vehicleName: veh.name,
                                      plateNumber: veh.plateNumber,
                                      vehicleType: veh.vehicleType,
                                      status: newStatus
                                    }
                                  }
                                }));
                              }}
                              className={`w-full text-xs p-2 rounded-xl font-bold border ${
                                veh.status === 'خارج از سرویس' ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200' :
                                veh.status === 'در حال تعمیر' ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200' :
                                veh.status === 'دارای نقص جزئی' ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200' :
                                'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                              }`}
                            >
                              {VEHICLE_STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              {isFa ? 'توضیحات، سوخت و آب و پمپ' : 'Notes & Readiness'}
                            </label>
                            <input
                              type="text"
                              placeholder={isFa ? 'توضیحات سوخت، آب، فوم، پمپ و تجهیزات...' : 'Fuel, water, foam, pump notes...'}
                              value={veh.description || ''}
                              onChange={(e) => {
                                const newDesc = e.target.value;
                                setFormData(p => ({
                                  ...p,
                                  vehiclesStatus: {
                                    ...p.vehiclesStatus,
                                    [veh.key]: {
                                      ...(p.vehiclesStatus[veh.key] || {}),
                                      vehicleId: veh.vehicleId,
                                      vehicleCode: veh.code,
                                      vehicleName: veh.name,
                                      plateNumber: veh.plateNumber,
                                      vehicleType: veh.vehicleType,
                                      description: newDesc
                                    }
                                  }
                                }));
                              }}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: GAS DETECTORS */}
          {activeTab === 'gas_detectors' && (
            <div className="space-y-6 animate-fadeIn">
              {/* گازیاب‌های ثابت */}
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {isFa ? 'وضعیت گازیاب‌های ثابت در واحدهای مجتمع' : 'Fixed Gas Detectors'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {renderStatusSelect('Unit 01', formData.gasDetectorsStatus.fixed.unit01, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, unit01: val } }
                  })))}
                  {renderStatusSelect('Unit 20', formData.gasDetectorsStatus.fixed.unit20, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, unit20: val } }
                  })))}
                  {renderStatusSelect('Unit 21', formData.gasDetectorsStatus.fixed.unit21, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, unit21: val } }
                  })))}
                  {renderStatusSelect('Unit 40', formData.gasDetectorsStatus.fixed.unit40, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, unit40: val } }
                  })))}
                  {renderStatusSelect('Utility (یوتیلیتی)', formData.gasDetectorsStatus.fixed.utility, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, utility: val } }
                  })))}
                  {renderStatusSelect('مخازن (Tanks Area)', formData.gasDetectorsStatus.fixed.storageTanks, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, storageTanks: val } }
                  })))}
                  {renderStatusSelect('GD (دتکتور گاز)', formData.gasDetectorsStatus.fixed.gd, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, fixed: { ...p.gasDetectorsStatus.fixed, gd: val } }
                  })))}
                </div>
              </div>

              {/* گازیاب‌های متحرک / پرتابل */}
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  {isFa ? 'وضعیت گازیاب‌های متحرک و پرتابل' : 'Portable Gas Detectors'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {renderStatusSelect('GAS ALERT.B.W', formData.gasDetectorsStatus.portable.gasAlertBW, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, portable: { ...p.gasDetectorsStatus.portable, gasAlertBW: val } }
                  })))}
                  {renderStatusSelect('MSA', formData.gasDetectorsStatus.portable.msa, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, portable: { ...p.gasDetectorsStatus.portable, msa: val } }
                  })))}
                  {renderStatusSelect('Cosmos', formData.gasDetectorsStatus.portable.cosmos, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, portable: { ...p.gasDetectorsStatus.portable, cosmos: val } }
                  })))}
                  {renderStatusSelect('Crowcon', formData.gasDetectorsStatus.portable.crowcon, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, portable: { ...p.gasDetectorsStatus.portable, crowcon: val } }
                  })))}
                  {renderStatusSelect('Crowcon Tripl Plus', formData.gasDetectorsStatus.portable.crowconTriplePlus, (val) => setFormData(p => ({
                    ...p, gasDetectorsStatus: { ...p.gasDetectorsStatus, portable: { ...p.gasDetectorsStatus.portable, crowconTriplePlus: val } }
                  })))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: FAULTS & STANDBY */}
          {activeTab === 'faults_standby' && (
            <div className="space-y-6 animate-fadeIn">
              {/* ایرادات سیستم اعلام حریق */}
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
                  {isFa ? 'ایرادات سیستم اعلام حریق (پنل‌های صنعتی و غیرصنعتی)' : 'Fire Alarm System Faults'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* پنل صنعتی */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                      {isFa ? 'ایرادات سیستم اعلام حریق (پنل صنعتی)' : 'Industrial Panel Alarms'}
                    </h4>
                    {renderNumberStepper('Fault (خطا)', formData.alarmSystemFaults.industrialPanel.fault, (val) => setFormData(p => ({
                      ...p, alarmSystemFaults: { ...p.alarmSystemFaults, industrialPanel: { ...p.alarmSystemFaults.industrialPanel, fault: val } }
                    })))}
                    {renderNumberStepper('Fire (آلارم حریق)', formData.alarmSystemFaults.industrialPanel.fire, (val) => setFormData(p => ({
                      ...p, alarmSystemFaults: { ...p.alarmSystemFaults, industrialPanel: { ...p.alarmSystemFaults.industrialPanel, fire: val } }
                    })))}
                    {renderNumberStepper('Warning (هشدار)', formData.alarmSystemFaults.industrialPanel.warning, (val) => setFormData(p => ({
                      ...p, alarmSystemFaults: { ...p.alarmSystemFaults, industrialPanel: { ...p.alarmSystemFaults.industrialPanel, warning: val } }
                    })))}
                  </div>

                  {/* پنل غیر صنعتی */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                      {isFa ? 'ایرادات سیستم اعلام حریق (پنل غیر صنعتی)' : 'Non-Industrial Panel Alarms'}
                    </h4>
                    {renderNumberStepper('Fault (خطا)', formData.alarmSystemFaults.nonIndustrialPanel.fault, (val) => setFormData(p => ({
                      ...p, alarmSystemFaults: { ...p.alarmSystemFaults, nonIndustrialPanel: { ...p.alarmSystemFaults.nonIndustrialPanel, fault: val } }
                    })))}
                    {renderNumberStepper('Fire (آلارم حریق)', formData.alarmSystemFaults.nonIndustrialPanel.fire, (val) => setFormData(p => ({
                      ...p, alarmSystemFaults: { ...p.alarmSystemFaults, nonIndustrialPanel: { ...p.alarmSystemFaults.nonIndustrialPanel, fire: val } }
                    })))}
                    {renderNumberStepper('Warning (هشدار)', formData.alarmSystemFaults.nonIndustrialPanel.warning, (val) => setFormData(p => ({
                      ...p, alarmSystemFaults: { ...p.alarmSystemFaults, nonIndustrialPanel: { ...p.alarmSystemFaults.nonIndustrialPanel, warning: val } }
                    })))}
                  </div>
                </div>
              </div>

              {/* بازرسی اولیه، حضور استندبای و اسکورت تانکرها */}
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
                  {isFa ? 'انجام بازرسی اولیه و حضور بصورت STANDBY و اسکورت' : 'Initial Inspection, Standby & Tanker Escorts'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderNumberStepper(isFa ? 'اسکورت تانکر پروپیلن' : 'Propylene Tanker Escorts', formData.standbyAndEscort.propyleneTankerEscorts, (val) => setFormData(p => ({
                    ...p, standbyAndEscort: { ...p.standbyAndEscort, propyleneTankerEscorts: val }
                  })))}
                  {renderNumberStepper(isFa ? 'اسکورت تانکر پروپان' : 'Propane Tanker Escorts', formData.standbyAndEscort.propaneTankerEscorts, (val) => setFormData(p => ({
                    ...p, standbyAndEscort: { ...p.standbyAndEscort, propaneTankerEscorts: val }
                  })))}
                  {renderNumberStepper(isFa ? 'ساعات استندبای (h)' : 'Standby Work Hours (h)', formData.standbyAndEscort.standbyHours, (val) => setFormData(p => ({
                    ...p, standbyAndEscort: { ...p.standbyAndEscort, standbyHours: val }
                  })), 0.5)}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: LEAKS, TASKS & SIGNOFF */}
          {activeTab === 'leaks_tasks' && (
            <div className="space-y-6 animate-fadeIn">
              {/* نشت گازهای سمی */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    {isFa ? 'نشت گازهای سمی و قابل اشتعال' : 'Gas Leaks & Toxic Emissions'}
                  </h3>
                </div>

                {/* Table of existing leaks */}
                {formData.gasLeaks && formData.gasLeaks.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl mb-3">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-750 font-bold">
                        <tr>
                          <th className="p-2">نوع گاز</th>
                          <th className="p-2">مقدار (ppm)</th>
                          <th className="p-2">جهت باد</th>
                          <th className="p-2">محل انتشار</th>
                          <th className="p-2">زمان شروع/پایان</th>
                          <th className="p-2">مدت (دقیقه)</th>
                          <th className="p-2 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {formData.gasLeaks.map((leak) => (
                          <tr key={leak.id}>
                            <td className="p-2 font-semibold">{leak.gasType}</td>
                            <td className="p-2 font-mono text-red-600 font-bold">{leak.amountPpm}</td>
                            <td className="p-2">{leak.windDirection}</td>
                            <td className="p-2">{leak.leakLocations}</td>
                            <td className="p-2 font-mono">{leak.startTime} - {leak.endTime}</td>
                            <td className="p-2 font-mono font-bold">{leak.durationMinutes}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLeak(leak.id)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500 text-xs mb-3">
                    {isFa ? 'هیچ مورد نشت گازی ثبت نشده است.' : 'No gas leaks recorded.'}
                  </div>
                )}

                {/* Add new leak inline row */}
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-2">
                  <span className="font-bold text-xs text-amber-900 dark:text-amber-300">
                    {isFa ? '+ افزودن رکورد نشت گاز جدید' : '+ Add Gas Leak Record'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="نوع گاز (مثلاً H2S, Propylene)"
                      value={newLeak.gasType}
                      onChange={(e) => setNewLeak({ ...newLeak, gasType: e.target.value })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    />
                    <input
                      type="number"
                      placeholder="مقدار نشتی (ppm)"
                      value={newLeak.amountPpm || ''}
                      onChange={(e) => setNewLeak({ ...newLeak, amountPpm: Number(e.target.value) || 0 })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="جهت وزش باد"
                      value={newLeak.windDirection}
                      onChange={(e) => setNewLeak({ ...newLeak, windDirection: e.target.value })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="محل انتشار نشتی گاز"
                      value={newLeak.leakLocations}
                      onChange={(e) => setNewLeak({ ...newLeak, leakLocations: e.target.value })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="زمان شروع (مثلاً 10:30)"
                      value={newLeak.startTime}
                      onChange={(e) => setNewLeak({ ...newLeak, startTime: e.target.value })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="زمان پایان (مثلاً 10:45)"
                      value={newLeak.endTime}
                      onChange={(e) => setNewLeak({ ...newLeak, endTime: e.target.value })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="number"
                      placeholder="مدت به دقیقه"
                      value={newLeak.durationMinutes || ''}
                      onChange={(e) => setNewLeak({ ...newLeak, durationMinutes: Number(e.target.value) || 0 })}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddLeak}
                      className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isFa ? 'ثبت نشت' : 'Add Leak'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* شرح کار انجام شده */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  {isFa ? 'شرح کار انجام شده در شیفت :' : 'Description of Work Completed :'}
                </label>
                <textarea
                  rows={3}
                  value={formData.workCompletedDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, workCompletedDescription: e.target.value }))}
                  placeholder={isFa ? 'شرح کامل اقدامات، عملیات، پایش‌ها، تست آژیر و فعالیت‌های شیفت...' : 'Describe all shift activities...'}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl leading-relaxed text-xs"
                />
              </div>

              {/* نواقص */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  {isFa ? 'نواقص و نیازمندی‌ها :' : 'Defects & Maintenance Requirements :'}
                </label>
                <textarea
                  rows={2}
                  value={formData.defectsAndNeeds}
                  onChange={(e) => setFormData(prev => ({ ...prev, defectsAndNeeds: e.target.value }))}
                  placeholder={isFa ? 'ایرادات ادوات، نیاز به قطعات یدکی، شارژ کپسول و...' : 'Defects, spare parts needs...'}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl leading-relaxed text-xs"
                />
              </div>

              {/* نوبتکار روز و شب */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* نوبتکار روز */}
                <PersonnelShiftSelector
                  title={isFa ? 'مشخصات و امضای نوبتکار روز' : 'Day Shift Officer'}
                  nameLabel={isFa ? 'نام مسئول شیفت روز' : 'Day Shift Officer Name'}
                  officerName={formData.signatures?.dayShiftOfficer?.name || ''}
                  personnelCode={formData.signatures?.dayShiftOfficer?.personnelCode || ''}
                  isSigned={formData.signatures?.dayShiftOfficer?.signed || false}
                  isFa={isFa}
                  personnelList={personnelList}
                  onNameChange={(name) => setFormData(prev => ({
                    ...prev,
                    signatures: {
                      ...prev.signatures,
                      dayShiftOfficer: { ...prev.signatures.dayShiftOfficer, name }
                    }
                  }))}
                  onPersonnelCodeChange={(code) => setFormData(prev => ({
                    ...prev,
                    signatures: {
                      ...prev.signatures,
                      dayShiftOfficer: { ...prev.signatures.dayShiftOfficer, personnelCode: code }
                    }
                  }))}
                  onSignedChange={(signed) => setFormData(prev => ({
                    ...prev,
                    signatures: {
                      ...prev.signatures,
                      dayShiftOfficer: { ...prev.signatures.dayShiftOfficer, signed }
                    }
                  }))}
                />

                {/* نوبتکار شب */}
                <PersonnelShiftSelector
                  title={isFa ? 'مشخصات و امضای نوبتکار شب' : 'Night Shift Officer'}
                  nameLabel={isFa ? 'نام مسئول شیفت شب' : 'Night Shift Officer Name'}
                  officerName={formData.signatures?.nightShiftOfficer?.name || ''}
                  personnelCode={formData.signatures?.nightShiftOfficer?.personnelCode || ''}
                  isSigned={formData.signatures?.nightShiftOfficer?.signed || false}
                  isFa={isFa}
                  personnelList={personnelList}
                  onNameChange={(name) => setFormData(prev => ({
                    ...prev,
                    signatures: {
                      ...prev.signatures,
                      nightShiftOfficer: { ...prev.signatures.nightShiftOfficer, name }
                    }
                  }))}
                  onPersonnelCodeChange={(code) => setFormData(prev => ({
                    ...prev,
                    signatures: {
                      ...prev.signatures,
                      nightShiftOfficer: { ...prev.signatures.nightShiftOfficer, personnelCode: code }
                    }
                  }))}
                  onSignedChange={(signed) => setFormData(prev => ({
                    ...prev,
                    signatures: {
                      ...prev.signatures,
                      nightShiftOfficer: { ...prev.signatures.nightShiftOfficer, signed }
                    }
                  }))}
                />
              </div>
            </div>
          )}

          {/* Dynamic Custom Items Section for Active Tab */}
          <DynamicItemsSection
            tabId={activeTab}
            tabTitleFa={tabs.find(t => t.id === activeTab)?.title || activeTab}
            items={formData.dynamicCustomItems || []}
            onChange={(updatedItems) => setFormData(prev => ({
              ...prev,
              dynamicCustomItems: updatedItems
            }))}
            isFa={isFa}
          />

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>{isFa ? 'وضعیت فعلی سند:' : 'Document Status:'}</span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
              formData.status === 'FINALIZED'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            }`}>
              {formData.status === 'FINALIZED' ? (isFa ? 'ثبت نهایی شده' : 'Finalized') : (isFa ? 'پیش‌نویس عملیاتی' : 'Draft')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{isFa ? 'ذخیره پیش‌نویس' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-red-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isFa ? 'ثبت نهایی گزارش' : 'Final Submit'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Import Vehicles Modal */}
      <ImportVehiclesModal
        isOpen={isImportVehiclesModalOpen}
        onClose={() => setIsImportVehiclesModalOpen(false)}
        fleetVehicles={fleetVehicles}
        activeReportVehicles={activeReportVehicles}
        onImportVehicle={handleImportSingleVehicle}
        onRemoveVehicle={handleRemoveVehicleFromReport}
        onImportAllReady={handleImportAllReadyVehicles}
        onImportAll={handleImportAllFleetVehicles}
        isFa={isFa}
      />
    </div>
  );
}

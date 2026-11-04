import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  ArrowRight,
  Pencil,
  ShieldCheck,
  FileText,
  Eye,
  Printer,
  AlertCircle,
  Clock,
  UserCheck,
  Lock,
  Send,
  CheckCircle2,
  History,
  PenTool,
  Trash2,
  RotateCcw,
  Check,
  X,
  FileSignature,
  AlertTriangle
} from 'lucide-react';
import {
  WorkPermit,
  UserProfile,
  PermitSignatures4Tier,
  PermitClosureDetails,
  PermitClosureSignTier,
  AuditLog
} from '../../types';
import PersianDatePicker from '../common/PersianDatePicker';
import PersianTimePicker from '../common/PersianTimePicker';
import { useFinalSubmit } from '../../context/FinalSubmitContext';
import { useSystemBranding } from '../../utils/systemBrandingHelper';
import HseLogo from '../HseLogo';
import { PermitPersonnelAutocomplete } from './PermitPersonnelAutocomplete';
import { PermitQualifiedPersonnelField } from './PermitQualifiedPersonnelField';
import { useUnifiedOrgUnits } from '../../utils/orgUnitsHelper';
import {
  PermitSignatures4TierSection,
  SectionValidationInfo
} from './PermitSignatures4TierSection';
import { PermitDynamicFieldsSection } from './PermitDynamicFieldsSection';
import { PermitMasterPrintModal } from './PermitMasterPrintModal';
import { COLD_INSPECTION_TEXTS, HOT_INSPECTION_TEXTS, ESD_ROWS_NAMES } from './PermitTypes';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import { 
  getPersonnelSignature, 
  findPersonnelFast, 
  isPersonnelPtwAuthorized, 
  PTW_UNAUTHORIZED_ERROR_MESSAGE 
} from '../../utils/personnelHelper';
import { syncPermitReferral } from '../../utils/referralHelper';
import { CentralNotificationService } from '../../services/notificationService';
import { checkIsIranHolidayClient, checkIsSeniorDutyOfficer } from '../../utils/iranCalendarUtils';

interface PermitFormMainProps {
  permitType: 'Hot' | 'Cold';
  currentUser: UserProfile;
  isFa: boolean;
  initialPermit?: WorkPermit;
  mode?: 'create' | 'edit' | 'view';
  initialHolidayWarningConfirmed?: boolean;
  onSave: (permit: WorkPermit) => void;
  onCancel: () => void;
}

export const PermitFormMain: React.FC<PermitFormMainProps> = ({
  permitType,
  currentUser,
  isFa,
  initialPermit,
  mode,
  initialHolidayWarningConfirmed = false,
  onSave,
  onCancel
}) => {
  const { confirmFinalSubmit } = useFinalSubmit();
  const { branding } = useSystemBranding();
  const { units: unifiedUnits } = useUnifiedOrgUnits();
  const isHot = permitType === 'Hot';
  const borderColor = isHot ? 'border-red-600' : 'border-blue-600';
  const headerBg = isHot ? 'bg-red-50 dark:bg-red-950/30' : 'bg-blue-50 dark:bg-blue-950/30';

  const [currentMode, setCurrentMode] = useState<'create' | 'edit' | 'view'>(
    mode || (initialPermit ? 'view' : 'create')
  );
  const isReadOnly = currentMode === 'view';
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const extra = initialPermit?.customFields?.__formExtra || {};
  const initClosure = initialPermit?.closureDetails;

  // Form State
  const [permitNumber, setPermitNumber] = useState(
    initialPermit?.serialNumber || (initialPermit as any)?.permitNumber || '[تولید خودکار در زمان ثبت]'
  );
  const [executionDate, setExecutionDate] = useState(() => {
    if (extra.executionDate) return extra.executionDate;
    if (initialPermit?.year && initialPermit?.month && initialPermit?.day) {
      return `${initialPermit.year}/${initialPermit.month}/${initialPermit.day}`;
    }
    return new Date().toLocaleDateString('fa-IR');
  });
  const [startHour, setStartHour] = useState(initialPermit?.startHour || '08:00');
  const [endHour, setEndHour] = useState(initialPermit?.endHour || '16:00');

  const [unit, setUnit] = useState(initialPermit?.location || '');
  const [equipmentNo, setEquipmentNo] = useState(initialPermit?.equipmentName || '');
  const [woNo, setWoNo] = useState(initialPermit?.woNumber || '');
  const [purpose, setPurpose] = useState<'OH' | 'PM' | 'EM' | 'Other' | ''>(
    (initialPermit?.maintenanceType as any) || ''
  );
  const [purposeOtherText, setPurposeOtherText] = useState(extra.purposeOtherText || '');

  const [description, setDescription] = useState(initialPermit?.description || '');
  const [machineryNeeded, setMachineryNeeded] = useState(initialPermit?.machineryRequired || '');

  const [usedTools, setUsedTools] = useState<{
    electrical: boolean;
    mechanical: boolean;
    flame: boolean;
    other: boolean;
    otherText: string;
  }>(() => {
    const tools = initialPermit?.usedEquipment || [];
    return {
      electrical: tools.includes('electrical'),
      mechanical: tools.includes('mechanical'),
      flame: tools.includes('flame'),
      other: tools.includes('other'),
      otherText: extra.usedToolsOtherText || ''
    };
  });

  const [attachedPermits, setAttachedPermits] = useState(() => {
    const att = initialPermit?.attachedPermits;
    const extAtt = extra.attachedPermits || {};
    return {
      excavation: !!att?.excavation,
      excavationNo: att?.excavationSerial || extAtt.excavationNo || '',
      confinedSpace: !!att?.confinedSpace,
      confinedSpaceNo: att?.confinedSpaceSerial || extAtt.confinedSpaceNo || '',
      radiation: !!att?.radiation,
      radiationNo: extAtt.radiationNo || '',
      electricalIsolation: !!att?.electrical,
      electricalIsolationNo: att?.electricalSerial || extAtt.electricalIsolationNo || '',
      vehicleEntry: !!att?.lifting || !!att?.vehicleCrane,
      vehicleEntryNo: extAtt.vehicleEntryNo || '',
      processIsolation: !!att?.processIsolation,
      processIsolationNo: extAtt.processIsolationNo || ''
    };
  });

  // Inspection Table Responses: key -> 'بله' | 'خیر' | 'لازم نیست'
  const [inspections, setInspections] = useState<Record<number, 'بله' | 'خیر' | 'لازم نیست' | ''>>(() => {
    if (initialPermit?.inspections && typeof initialPermit.inspections === 'object') {
      return initialPermit.inspections as any;
    }
    return {};
  });

  // Sub-options inside inspections
  const [insp3Sub, setInsp3Sub] = useState<{ drain: boolean; vent: boolean; purge: boolean; wash: boolean }>(
    extra.insp3Sub || { drain: false, vent: false, purge: false, wash: false }
  );
  const [insp6PadlockNo, setInsp6PadlockNo] = useState<string>(extra.insp6PadlockNo || '');
  const [insp8Peyvast, setInsp8Peyvast] = useState<{ jsa: boolean; pid: boolean; checklist: boolean }>(
    extra.insp8Peyvast || { jsa: false, pid: false, checklist: false }
  );
  const [insp12Amadebash, setInsp12Amadebash] = useState<{ operator: boolean; hse: boolean; firefighter: boolean }>(
    extra.insp12Amadebash || { operator: false, hse: false, firefighter: false }
  );

  // PPE Checkboxes
  const [ppe, setPpe] = useState(() => {
    const pList = initialPermit?.ppeRequired || [];
    return {
      helmet: pList.includes('helmet'),
      chinStrap: pList.includes('chinStrap'),
      workClothes: pList.includes('workClothes'),
      acidSuit: pList.includes('acidSuit'),
      aluminumSuit: pList.includes('aluminumSuit'),
      safetyShoes: pList.includes('safetyShoes'),
      gogglesCutting: pList.includes('gogglesCutting'),
      gogglesGrinding: pList.includes('gogglesGrinding'),
      gogglesUv: pList.includes('gogglesUv'),
      glovesLeather: pList.includes('glovesLeather'),
      glovesCloth: pList.includes('glovesCloth'),
      glovesPvc: pList.includes('glovesPvc'),
      glovesRefractory: pList.includes('glovesRefractory'),
      glovesAcid: pList.includes('glovesAcid'),
      glovesElectrical: pList.includes('glovesElectrical'),
      glovesAbrasion: pList.includes('glovesAbrasion'),
      glovesCut: pList.includes('glovesCut'),
      faceShieldGrinding: pList.includes('faceShieldGrinding'),
      faceShieldWelding: pList.includes('faceShieldWelding'),
      scbaMask: pList.includes('scbaMask'),
      earPlugs: pList.includes('earPlugs'),
      earMuffs: pList.includes('earMuffs'),
      antiShockHarness: pList.includes('antiShockHarness'),
      boots: pList.includes('boots'),
      maskDust: pList.includes('maskDust'),
      maskHalf: pList.includes('maskHalf'),
      maskFull: pList.includes('maskFull'),
      other1: extra.ppeOther1 || '',
      other2: extra.ppeOther2 || ''
    };
  });

  // Holiday & Senior Duty Officer Control State
  const [showHolidayWarningModal, setShowHolidayWarningModal] = useState(false);
  const [holidayWarningConfirmed, setHolidayWarningConfirmed] = useState(
    initialHolidayWarningConfirmed ||
    Boolean((initialPermit as any)?.holidayWarningConfirmed) ||
    Boolean(initialPermit?.customFields?.__formExtra?.holidayWarningConfirmed) ||
    false
  );

  const holidayInfo = useMemo(() => {
    return checkIsIranHolidayClient(executionDate || new Date());
  }, [executionDate]);

  const isSeniorDuty = useMemo(() => {
    return checkIsSeniorDutyOfficer(currentUser.jobTitle, null, currentUser.role);
  }, [currentUser]);

  const isHotWorkHolidayBlocked = isHot && holidayInfo.isHoliday && !isSeniorDuty;

  // Hazards Checkboxes
  const [hazards, setHazards] = useState(() => {
    const hList = initialPermit?.hazards || [];
    return {
      flammable: hList.includes('flammable'),
      explosive: hList.includes('explosive'),
      toxic: hList.includes('toxic'),
      corrosive: hList.includes('corrosive'),
      radiation: hList.includes('radiation'),
      height: hList.includes('height') || !!initialPermit?.attachedPermits?.workingAtHeight,
      electrocution: hList.includes('electrocution'),
      hotSurface: hList.includes('hotSurface'),
      pressurizedVessel: hList.includes('pressurizedVessel'),
      dust: hList.includes('dust'),
      rain: hList.includes('rain'),
      strongWind: hList.includes('strongWind'),
      wetMoist: hList.includes('wetMoist'),
      slipperySurface: hList.includes('slipperySurface'),
      other1: extra.hazardsOther1 || '',
      other2: extra.hazardsOther2 || ''
    };
  });

  // Page 1 / Page 2 Instructions
  const [instructions, setInstructions] = useState<string>(extra.instructions || '');

  // Hot Work ESD / Fire & Gas Table State (6 rows)
  const [esdTable, setEsdTable] = useState<Array<{
    req: boolean;
    unitZone: string;
    inhibitDate: string;
    inhibitTime: string;
    inhibitSign: string;
    activeDate: string;
    activeTime: string;
    activeSign: string;
  }>>(() => {
    if (Array.isArray(extra.esdTable) && extra.esdTable.length === 6) {
      return extra.esdTable;
    }
    return Array(6).fill(null).map(() => ({
      req: false,
      unitZone: '',
      inhibitDate: '',
      inhibitTime: '',
      inhibitSign: '',
      activeDate: '',
      activeTime: '',
      activeSign: ''
    }));
  });

  // Page 2: Executor completion
  const [qualifiedPersonnel, setQualifiedPersonnel] = useState(
    initialPermit?.qualifiedPersonnel || initialPermit?.responsibles?.jobExecutor || ''
  );
  const [heavyLiftingSafe, setHeavyLiftingSafe] = useState<'بله' | 'خیر' | ''>(extra.heavyLiftingSafe || '');
  const [toolsSuitable, setToolsSuitable] = useState<'بله' | 'خیر' | ''>(extra.toolsSuitable || '');

  // Page 2: Gas Tests (واحد HSE)
  const [gasTypes, setGasTypes] = useState(() => {
    if (extra.gasTypes) return extra.gasTypes;
    return {
      explosive: false,
      oxygen: false,
      toxic: false,
      once: false,
      periodic: false,
      periodicMinutes: '',
      notRequired: initialPermit?.gasTestRequired === 'Not Required'
    };
  });
  const [gasTesterName, setGasTesterName] = useState(
    initialPermit?.gasTest?.testerName || ''
  );
  const [gasRows, setGasRows] = useState(() => {
    if (Array.isArray(extra.gasRows) && extra.gasRows.length === 5) {
      return extra.gasRows;
    }
    const base = Array(5).fill(null).map(() => ({
      testerName: '',
      o2: '',
      lel: '',
      co: '',
      co2: '',
      h2s: '',
      nh2: '',
      so2: '',
      other: '',
      time: ''
    }));
    if (initialPermit?.gasTest && initialPermit.gasTestRequired !== 'Not Required') {
      base[0] = {
        testerName: initialPermit.gasTest.testerName || '',
        o2: initialPermit.gasTest.o2 !== undefined ? String(initialPermit.gasTest.o2) : '',
        lel: initialPermit.gasTest.lel !== undefined ? String(initialPermit.gasTest.lel) : '',
        co: initialPermit.gasTest.co !== undefined ? String(initialPermit.gasTest.co) : '',
        co2: '',
        h2s: initialPermit.gasTest.h2s !== undefined ? String(initialPermit.gasTest.h2s) : '',
        nh2: '',
        so2: '',
        other: '',
        time: initialPermit.gasTest.testTime || ''
      };
    }
    return base;
  });

  // 4-Tier Signatures State
  const [signatures4Tier, setSignatures4Tier] = useState<PermitSignatures4Tier>(() => {
    if (initialPermit?.signatures4Tier) {
      return initialPermit.signatures4Tier;
    }
    return {
      issuer: {
        roleKey: 'issuer',
        roleTitle: 'کشیک ارشد تولید / صادر کننده',
        declarationText: 'اینجانب شخصاً بازرسی‌های لازم را انجام داده و شرایط را مناسب می‌دانم.',
        name: initialPermit?.responsibles?.unitSupervisor || initialPermit?.signatures?.[0]?.name || '',
        time: '07:30',
        status: 'Pending'
      },
      executor: {
        roleKey: 'executor',
        roleTitle: 'مسئول انجام کار',
        declarationText: 'اینجانب با اطلاع کامل از احتیاط های لازم، پس از پایان‌کار مراتب را به مسئول محوطه اطلاع خواهم داد.',
        name: initialPermit?.responsibles?.jobExecutor || initialPermit?.signatures?.[1]?.name || '',
        time: '07:45',
        status: 'Pending'
      },
      areaSupervisor: {
        roleKey: 'areaSupervisor',
        roleTitle: 'مسئول محوطه',
        declarationText: 'اینجانب شخصاً بازرسی‌های فوق را انجام داده و شرایط را مناسب می‌دانم.',
        name: initialPermit?.responsibles?.unitSupervisor || '',
        time: '07:50',
        status: 'Pending'
      },
      safetyUnit: {
        roleKey: 'safetyUnit',
        roleTitle: 'واحد ایمنی',
        declarationText: 'کلیه بازرسی ها و موارد ایمنی انجام گردید و مورد تایید می باشد',
        name: initialPermit?.responsibles?.safetyUnit || initialPermit?.standByHse || '',
        time: '08:00',
        status: 'Pending'
      }
    };
  });

  // Dynamic Custom Fields State
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(() => {
    return initialPermit?.customFields || {};
  });

  // Audit Logs State (حفظ سوابق و تاریخچه تغییرات و تأییدها)
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>(() => {
    return initialPermit?.auditLogs || [];
  });

  // Closure Section State (خاتمه پروانه کار - ۳ نقش: مجری کار، مسئول محوطه، کشیک ارشد/صادرکننده)
  const [delay1From, setDelay1From] = useState(initClosure?.delay1From || extra.delay1From || '');
  const [delay1To, setDelay1To] = useState(initClosure?.delay1To || extra.delay1To || '');
  const [delay1Reason, setDelay1Reason] = useState(initClosure?.delay1Reason || extra.delay1Reason || '');
  const [delay2From, setDelay2From] = useState(initClosure?.delay2From || extra.delay2From || '');
  const [delay2To, setDelay2To] = useState(initClosure?.delay2To || extra.delay2To || '');
  const [delay2Reason, setDelay2Reason] = useState(initClosure?.delay2Reason || extra.delay2Reason || '');

  const [permitStatus, setPermitStatus] = useState<'completed' | 'suspended' | 'continued' | ''>(
    initClosure?.permitStatus || extra.permitStatus || ''
  );
  const [continuedPermitNo, setContinuedPermitNo] = useState(
    initClosure?.continuedPermitNo || extra.continuedPermitNo || ''
  );

  const [closureChecks, setClosureChecks] = useState<Record<number, 'بله' | 'خیر' | 'لازم نیست' | ''>>(
    initClosure?.closureChecks || extra.closureChecks || {}
  );

  const [closureSignatures, setClosureSignatures] = useState<PermitClosureDetails['signatures']>(() => ({
    executor: initClosure?.signatures?.executor || {
      roleKey: 'executor',
      roleTitle: 'مسئول انجام کار (مجری کار)',
      name: initialPermit?.signatures4Tier?.executor?.name || initialPermit?.responsibles?.jobExecutor || '',
      time: '',
      status: 'Pending'
    },
    areaSupervisor: initClosure?.signatures?.areaSupervisor || {
      roleKey: 'areaSupervisor',
      roleTitle: 'مسئول محوطه',
      name: initialPermit?.signatures4Tier?.areaSupervisor?.name || initialPermit?.responsibles?.unitSupervisor || '',
      time: '',
      status: 'Pending'
    }
  }));

  const [activeClosureSignModal, setActiveClosureSignModal] = useState<'executor' | 'areaSupervisor' | null>(null);
  const [tempClosureSignature, setTempClosureSignature] = useState<string>('');
  const [closureValidationError, setClosureValidationError] = useState<{
    roleTitle: string;
    message: string;
    missingItems: string[];
  } | null>(null);
  const [workflowFeedbackBanner, setWorkflowFeedbackBanner] = useState<string | null>(null);

  // Append an entry to the Audit Log
  const appendAuditLog = (actionTitle: string, detailsText: string) => {
    const nowIso = new Date().toISOString();
    const persianDT =
      new Date().toLocaleDateString('fa-IR') +
      ' ' +
      new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const newEntry: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: currentUser.fullName || currentUser.username,
      userRole: currentUser.role,
      timestamp: nowIso,
      persianDateTime: persianDT,
      action: actionTitle,
      details: detailsText,
      version: (initialPermit?.version || 1) + 1
    };
    setAuditLogsList(prev => [...prev, newEntry]);
    return newEntry;
  };

  // =========================================================================================
  // SECTION COMPLETION VALIDATION ENGINE (الزام تکمیل بخش‌ها بر اساس تفکیک مسئولیت‌ها)
  // =========================================================================================
  const sectionValidations = useMemo<Record<'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit', SectionValidationInfo>>(() => {
    // 1. Issuer Validation (کشیک ارشد یا صادرکننده پروانه)
    const issuerMissing: string[] = [];
    if (!executionDate.trim()) issuerMissing.push('تاریخ اجرای کار');
    if (!startHour.trim() || !endHour.trim()) issuerMissing.push('ساعت شروع و پایان کار');
    if (!unit.trim()) issuerMissing.push('واحد سازمانی (محل انجام کار)');
    if (!equipmentNo.trim()) issuerMissing.push('شماره تجهیز');
    if (!woNo.trim()) issuerMissing.push('شماره دستور کار (WO)');
    if (!purpose) {
      issuerMissing.push('هدف انجام کار (OH / PM / EM / سایر)');
    } else if (purpose === 'Other' && !purposeOtherText.trim()) {
      issuerMissing.push('توضیحات گزینه «سایر» در هدف انجام کار');
    }
    if (!description.trim()) issuerMissing.push('شرح کار');

    // Supplementary permits mandatory number check (الزام ثبت شماره در صورت انتخاب پروانه الحاقی)
    if (attachedPermits.excavation && !attachedPermits.excavationNo.trim()) {
      issuerMissing.push('شماره پروانه الحاقی حفاری');
    }
    if (attachedPermits.confinedSpace && !attachedPermits.confinedSpaceNo.trim()) {
      issuerMissing.push('شماره پروانه الحاقی ورود به فضای بسته');
    }
    if (attachedPermits.radiation && !attachedPermits.radiationNo.trim()) {
      issuerMissing.push('شماره پروانه الحاقی پرتونگاری');
    }
    if (attachedPermits.electricalIsolation && !attachedPermits.electricalIsolationNo.trim()) {
      issuerMissing.push('شماره پروانه الحاقی جداسازی الکتریکی');
    }
    if (attachedPermits.vehicleEntry && !attachedPermits.vehicleEntryNo.trim()) {
      issuerMissing.push('شماره پروانه الحاقی ورود ماشین‌آلات');
    }
    if (attachedPermits.processIsolation && !attachedPermits.processIsolationNo.trim()) {
      issuerMissing.push('شماره پروانه الحاقی جداسازی فرایندی، مکانیکی، ابزار دقیق');
    }

    // Inspections table check (1..13 for Cold, 1..14 for Hot)
    const totalInspRows = isHot ? 14 : 13;
    const unansweredInspRows: number[] = [];
    for (let i = 1; i <= totalInspRows; i++) {
      if (!inspections[i]) unansweredInspRows.push(i);
    }
    if (unansweredInspRows.length > 0) {
      issuerMissing.push(`ردیف‌های تکمیل‌نشده جدول بازرسی‌ها (ردیف ${unansweredInspRows.join('، ')})`);
    }
    if (inspections[3] === 'بله' && !insp3Sub.drain && !insp3Sub.vent && !insp3Sub.purge && !insp3Sub.wash) {
      issuerMissing.push('انتخاب حداقل یکی از زیرگزینه‌های ردیف ۳ بازرسی (تخلیه / Vent / Purge / شستشو)');
    }
    if (inspections[6] === 'بله' && !insp6PadlockNo.trim()) {
      issuerMissing.push('ثبت شماره قفل (Padlock No) در ردیف ۶ بازرسی');
    }
    const peyvastRow = isHot ? 9 : 8;
    if (inspections[peyvastRow] === 'بله' && !insp8Peyvast.jsa && !insp8Peyvast.pid && !insp8Peyvast.checklist) {
      issuerMissing.push(`انتخاب نوع پیوست (JSA / نقشه P&ID / چک‌لیست) در ردیف ${peyvastRow} بازرسی`);
    }
    const standbyRow = isHot ? 13 : 12;
    if (inspections[standbyRow] === 'بله' && !insp12Amadebash.operator && !insp12Amadebash.hse && !insp12Amadebash.firefighter) {
      issuerMissing.push(`انتخاب نفر آماده‌باش (بهره‌بردار / HSE / آتش‌نشان) در ردیف ${standbyRow} بازرسی`);
    }

    // PPE check
    const hasAnyPpe = Object.entries(ppe).some(([k, v]) =>
      k === 'other1' || k === 'other2' ? Boolean(String(v).trim()) : v === true
    );
    if (!hasAnyPpe) {
      issuerMissing.push('انتخاب حداقل یک مورد از تجهیزات حفاظت فردی (PPE)');
    }

    // Hazards check
    const hasAnyHazard = Object.entries(hazards).some(([k, v]) =>
      k === 'other1' || k === 'other2' ? Boolean(String(v).trim()) : v === true
    );
    if (!hasAnyHazard) {
      issuerMissing.push('مشخص نمودن حداقل یک مورد از شرایط خطرناک محیط کار');
    }

    // Safety instructions check
    if (!instructions.trim()) {
      issuerMissing.push('ثبت دستورالعمل‌ها و توصیه‌های ایمنی لازم');
    }

    // Hot Work Fire & Gas and ESD requirements check
    if (isHot) {
      esdTable.forEach((row, idx) => {
        if (row.req) {
          if (!row.unitZone.trim() || !row.inhibitDate.trim() || !row.inhibitTime.trim() || !row.inhibitSign.trim()) {
            issuerMissing.push(`تکمیل اطلاعات جداسازی (Unit/Zone, Date, Time, Sign) در جدول Fire & Gas و ESD ردیف ${idx + 1}`);
          }
        }
      });
    }

    // 2. Executor Validation (مسئول انجام کار)
    const executorMissing: string[] = [];
    const hasAnyTool = usedTools.electrical || usedTools.mechanical || usedTools.flame || usedTools.other;
    if (!hasAnyTool) {
      executorMissing.push('انتخاب نوع تجهیزات و ابزار مورد استفاده (برقی / مکانیکی / شعله‌افکن / سایر)');
    } else if (usedTools.other && !usedTools.otherText.trim()) {
      executorMissing.push('توضیحات «سایر موارد» در تجهیزات و ابزار مورد استفاده');
    }
    if (!qualifiedPersonnel.trim()) {
      executorMissing.push('ثبت اسامی افراد دارای صلاحیت (تکمیل توسط مجری)');
    }
    if (!heavyLiftingSafe) {
      executorMissing.push('پاسخ به سؤال «روش‌های صحیح و ایمن جابجایی وسایل سنگین»');
    }
    if (!toolsSuitable) {
      executorMissing.push('پاسخ به سؤال «تناسب مشاغل و ابزار مذکور با افراد انجام‌دهنده»');
    }

    // 3. Area Supervisor Validation (مسئول محوطه)
    const areaMissing: string[] = [];
    if (issuerMissing.length > 0) {
      areaMissing.push('تکمیل نواقص بخش اول (کشیک ارشد / صادرکننده)');
    }
    if (executorMissing.length > 0) {
      areaMissing.push('تکمیل نواقص بخش مجری کار (مسئول انجام کار)');
    }

    // 4. HSE Safety Unit Validation (واحد HSE - آزمایش گازها)
    const hseMissing: string[] = [];
    if (!gasTypes.notRequired) {
      const hasGasKind = gasTypes.explosive || gasTypes.oxygen || gasTypes.toxic;
      if (!hasGasKind) {
        hseMissing.push('انتخاب نوع آزمایش گاز (قابل انفجار / اکسیژن / سمی) یا علامت‌زدن گزینه «لازم نیست»');
      }
      if (!gasTypes.once && !gasTypes.periodic) {
        hseMissing.push('تعیین دفعات آزمایش گاز (یکبار / متناوب)');
      }
      if (gasTypes.periodic && !String(gasTypes.periodicMinutes || '').trim()) {
        hseMissing.push('ثبت فاصله زمانی تناوب آزمایش گاز (دقیقه)');
      }
      const hasCompleteGasRow = gasRows.some(
        r =>
          r.testerName.trim() !== '' &&
          r.time.trim() !== '' &&
          (r.o2.trim() !== '' ||
            r.lel.trim() !== '' ||
            r.co.trim() !== '' ||
            r.co2.trim() !== '' ||
            r.h2s.trim() !== '' ||
            r.nh2.trim() !== '' ||
            r.so2.trim() !== '' ||
            r.other.trim() !== '')
      );
      if (!hasCompleteGasRow) {
        hseMissing.push('ثبت حداقل یک ردیف کامل در جدول نتایج آزمایش گاز (نام آزمایش‌کننده، مقادیر اندازه‌گیری‌شده و ساعت)');
      }
    }

    const isIssuerSigned = Boolean(
      signatures4Tier?.issuer?.signatureImage || signatures4Tier?.issuer?.status === 'Approved'
    );
    const isExecutorSigned = Boolean(
      signatures4Tier?.executor?.signatureImage || signatures4Tier?.executor?.status === 'Approved'
    );
    const isAreaSigned = Boolean(
      signatures4Tier?.areaSupervisor?.signatureImage || signatures4Tier?.areaSupervisor?.status === 'Approved'
    );

    return {
      issuer: {
        isComplete: issuerMissing.length === 0,
        missingFields: issuerMissing,
        canSignSequential: true,
        responsibleRoleLabel: 'کشیک ارشد یا صادرکننده پروانه'
      },
      executor: {
        isComplete: executorMissing.length === 0,
        missingFields: executorMissing,
        canSignSequential: isIssuerSigned,
        sequentialBlockReason: !isIssuerSigned
          ? 'ابتدا مرحله ۱ (کشیک ارشد تولید / صادرکننده) باید تأیید و امضا شود.'
          : undefined,
        responsibleRoleLabel: 'مسئول انجام کار (مجری کار)'
      },
      areaSupervisor: {
        isComplete: areaMissing.length === 0,
        missingFields: areaMissing,
        canSignSequential: isIssuerSigned && isExecutorSigned,
        sequentialBlockReason: !isIssuerSigned
          ? 'ابتدا مرحله ۱ (کشیک ارشد تولید / صادرکننده) باید تأیید و امضا شود.'
          : !isExecutorSigned
          ? 'ابتدا مرحله ۲ (مسئول انجام کار) باید تأیید و امضا شود.'
          : undefined,
        responsibleRoleLabel: 'مسئول محوطه'
      },
      safetyUnit: {
        isComplete: hseMissing.length === 0,
        missingFields: hseMissing,
        canSignSequential: isIssuerSigned && isExecutorSigned && isAreaSigned,
        sequentialBlockReason: !isIssuerSigned
          ? 'ابتدا مرحله ۱ (کشیک ارشد تولید / صادرکننده) باید تأیید و امضا شود.'
          : !isExecutorSigned
          ? 'ابتدا مرحله ۲ (مسئول انجام کار) باید تأیید و امضا شود.'
          : !isAreaSigned
          ? 'ابتدا مرحله ۳ (مسئول محوطه) باید تأیید و امضا شود.'
          : undefined,
        responsibleRoleLabel: 'واحد HSE (ایمنی)'
      }
    };
  }, [
    signatures4Tier,
    executionDate,
    startHour,
    endHour,
    unit,
    equipmentNo,
    woNo,
    purpose,
    purposeOtherText,
    description,
    attachedPermits,
    isHot,
    inspections,
    insp3Sub,
    insp6PadlockNo,
    insp8Peyvast,
    insp12Amadebash,
    ppe,
    hazards,
    instructions,
    esdTable,
    usedTools,
    qualifiedPersonnel,
    heavyLiftingSafe,
    toolsSuitable,
    gasTypes,
    gasRows
  ]);

  // Validation for Permit Closure Section (خاتمه پروانه کار)
  const closureValidation = useMemo(() => {
    const missing: string[] = [];
    const all4Issued =
      signatures4Tier.issuer.status === 'Approved' &&
      signatures4Tier.executor.status === 'Approved' &&
      signatures4Tier.areaSupervisor.status === 'Approved' &&
      signatures4Tier.safetyUnit.status === 'Approved';

    if (!all4Issued) {
      missing.push('تکمیل و تأیید هر ۴ امضای صدور پروانه کار (صادرکننده، مسئول انجام کار، مسئول محوطه، واحد ایمنی)');
    }
    if (!permitStatus) {
      missing.push('تعیین وضعیت نهایی کار (انجام شده / تعلیق / ادامه با پروانه جدید)');
    } else if (permitStatus === 'continued' && !continuedPermitNo.trim()) {
      missing.push('ثبت شماره پروانه کار جدید جهت ادامه کار');
    }

    const unansweredClosure: number[] = [];
    for (let i = 1; i <= 6; i++) {
      if (!closureChecks[i]) unansweredClosure.push(i);
    }
    if (unansweredClosure.length > 0) {
      missing.push(`تکمیل چک‌لیست ۶گانه خاتمه پروانه کار (ردیف‌های ${unansweredClosure.join('، ')})`);
    }

    return {
      isComplete: missing.length === 0,
      missingFields: missing
    };
  }, [signatures4Tier, permitStatus, continuedPermitNo, closureChecks]);

  const handleInspChange = (idx: number, val: 'بله' | 'خیر' | 'لازم نیست') => {
    setInspections(prev => ({ ...prev, [idx]: val }));
  };

  const handleClosureCheckChange = (idx: number, val: 'بله' | 'خیر' | 'لازم نیست') => {
    setClosureChecks(prev => ({ ...prev, [idx]: val }));
    setClosureValidationError(null);
  };

  // Role authorization check for Closure Signatures (جلوگیری از تأیید توسط افراد غیرمجاز)
  const checkClosureRoleAuthorization = (roleKey: 'executor' | 'areaSupervisor'): { allowed: boolean; reason?: string } => {
    const tierData = closureSignatures[roleKey];
    if (!tierData) return { allowed: true };
    const currentFullName = (currentUser.fullName || '').trim();
    const currentUsername = (currentUser.username || '').trim();
    const designatedName = (tierData.name || '').trim();

    // Mandatory PTW Training and Authorization check (Requirement 5.7: closure stage gating)
    const closurePermitCat = isHot ? 'hot' : 'cold';
    if (designatedName) {
      const designatedPerson = findPersonnelFast(designatedName);
      if (designatedPerson) {
        const ptwCheck = isPersonnelPtwAuthorized(designatedPerson, {
          roleKey,
          permitCategory: closurePermitCat,
          allowExemptAdmins: false
        });
        if (!ptwCheck.isAuthorized) {
          return {
            allowed: false,
            reason: ptwCheck.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE
          };
        }
      }
    }

    const userPtwCheck = isPersonnelPtwAuthorized(currentUser, {
      roleKey,
      permitCategory: closurePermitCat,
      allowExemptAdmins: false
    });
    if (!userPtwCheck.isAuthorized) {
      return {
        allowed: false,
        reason: userPtwCheck.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE
      };
    }

    const isAdmin = currentUser.role === 'Administrator';
    if (isAdmin) return { allowed: true };

    if (designatedName && currentFullName && designatedName !== currentFullName && designatedName !== currentUsername) {
      return {
        allowed: false,
        reason: `این بخش به نام «${designatedName}» ثبت شده است و شما (${currentFullName || currentUsername}) مجاز به امضای جایگزین آن نیستید.`
      };
    }
    return { allowed: true };
  };

  // Sequential Gating for 2 Closure Signatures: 1. Executor -> 2. Area Supervisor
  const canSignClosureSequential = (roleKey: 'executor' | 'areaSupervisor'): boolean => {
    if (roleKey === 'executor') return true;
    if (roleKey === 'areaSupervisor') return closureSignatures.executor.status === 'Approved';
    return false;
  };

  const handleInitiateClosureSign = (roleKey: 'executor' | 'areaSupervisor') => {
    setClosureValidationError(null);
    const tier = closureSignatures[roleKey];
    if (!tier) return;

    // 1. Check sequential order
    if (!canSignClosureSequential(roleKey)) {
      setClosureValidationError({
        roleTitle: tier.roleTitle,
        message: 'رعایت ترتیب گردش‌کار خاتمه الزامی است. ابتدا باید «مسئول انجام کار (مجری کار)» خاتمه کار را تأیید و امضا نماید.',
        missingItems: ['تأیید و امضای قبلی (مسئول انجام کار)']
      });
      return;
    }

    // 2. Check closure checklist & prerequisites
    if (!closureValidation.isComplete) {
      setClosureValidationError({
        roleTitle: tier.roleTitle,
        message: 'پیش از تأیید و امضای خاتمه پروانه کار، تکمیل تمامی الزامات زیر اجباری است:',
        missingItems: closureValidation.missingFields
      });
      return;
    }

    // 3. Check name entered
    if (!tier.name.trim()) {
      setClosureValidationError({
        roleTitle: tier.roleTitle,
        message: `لطفاً ابتدا نام و نام خانوادگی «${tier.roleTitle}» را در بخش خاتمه وارد نمایید.`,
        missingItems: [`نام و نام خانوادگی ${tier.roleTitle}`]
      });
      return;
    }

    // 4. Check role authorization
    const auth = checkClosureRoleAuthorization(roleKey);
    if (!auth.allowed) {
      setClosureValidationError({
        roleTitle: tier.roleTitle,
        message: auth.reason || 'شما مجاز به امضای این مرحله نیستید.',
        missingItems: []
      });
      return;
    }

    setActiveClosureSignModal(roleKey);
  };

  const handleSaveClosureDigitalSignature = (roleKey: 'executor' | 'areaSupervisor', dataUrl: string) => {
    const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const persianDT = `${new Date().toLocaleDateString('fa-IR')} ${nowTime}`;
    const signerFullName = currentUser.fullName || currentUser.username;

    setClosureSignatures(prev => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        name: prev[roleKey].name || signerFullName,
        time: prev[roleKey].time || nowTime,
        status: 'Approved',
        signatureImage: dataUrl,
        signedAt: new Date().toISOString(),
        signedByUser: signerFullName,
        signedByRole: currentUser.role,
        persianTimestamp: persianDT
      }
    }));
    setActiveClosureSignModal(null);
    setClosureValidationError(null);
    appendAuditLog(
      `امضای خاتمه پروانه کار (${closureSignatures[roleKey].roleTitle})`,
      `بخش خاتمه پروانه کار توسط «${signerFullName}» (${currentUser.role}) در تاریخ ${persianDT} تأیید و امضا گردید.`
    );
  };

  const handleClearClosureSignature = (roleKey: 'executor' | 'areaSupervisor') => {
    const signerFullName = currentUser.fullName || currentUser.username;
    setClosureSignatures(prev => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        status: 'Pending',
        signatureImage: undefined,
        signedAt: undefined,
        signedByUser: undefined,
        signedByRole: undefined,
        persianTimestamp: undefined
      }
    }));
    appendAuditLog(
      `حذف امضای خاتمه (${closureSignatures[roleKey].roleTitle})`,
      `امضای خاتمه مرحله «${closureSignatures[roleKey].roleTitle}» توسط «${signerFullName}» بازنشانی گردید.`
    );
  };

  const handleReferStageToNext = (tierKey: keyof PermitSignatures4Tier) => {
    const tier = signatures4Tier[tierKey];
    const nextTierMap: Partial<Record<keyof PermitSignatures4Tier, string>> = {
      issuer: 'مسئول انجام کار (مجری کار)',
      executor: 'مسئول محوطه',
      areaSupervisor: 'واحد ایمنی (HSE)',
      safetyUnit: 'شروع عملیات / آماده بهره‌برداری نهایی'
    };
    const nextLabel = nextTierMap[tierKey] || 'مرحله بعدی';
    const currentPermitSnapshot = buildDraftPermit();
    try {
      syncPermitReferral(currentPermitSnapshot, currentUser);
      CentralNotificationService.sendNotification({
        title: `ارجاع پروانه کار ${isHot ? 'گرم' : 'سرد'}`,
        body: `مرحله «${tier.roleTitle}» توسط ${currentUser.fullName || currentUser.username} تأیید و جهت ادامه به «${nextLabel}» ارجاع گردید.`,
        category: 'info',
        priority: isHot ? 'high' : 'medium',
        sourceModule: 'permits',
        recordId: currentPermitSnapshot.id,
        sender: currentUser.fullName || currentUser.username
      }).catch(() => {});
    } catch (err) {
      console.warn('Referral notification error:', err);
    }
    setWorkflowFeedbackBanner(
      `مرحله «${tier.roleTitle}» با موفقیت تأیید و به «${nextLabel}» ارجاع داده شد.`
    );
    setTimeout(() => setWorkflowFeedbackBanner(null), 6000);
  };

  const buildDraftPermit = (): WorkPermit => {
    const allClosureSigned =
      closureSignatures.executor.status === 'Approved' &&
      closureSignatures.areaSupervisor.status === 'Approved';

    const closureDetailsObj: PermitClosureDetails = {
      delay1From,
      delay1To,
      delay1Reason,
      delay2From,
      delay2To,
      delay2Reason,
      permitStatus,
      continuedPermitNo,
      closureChecks,
      signatures: closureSignatures,
      closedAt: allClosureSigned ? new Date().toISOString() : initClosure?.closedAt
    };

    const mergedCustomFields: Record<string, any> = {
      ...customFieldValues,
      __formExtra: {
        executionDate,
        purposeOtherText,
        usedToolsOtherText: usedTools.otherText,
        attachedPermits,
        insp3Sub,
        insp6PadlockNo,
        insp8Peyvast,
        insp12Amadebash,
        ppeOther1: ppe.other1,
        ppeOther2: ppe.other2,
        hazardsOther1: hazards.other1,
        hazardsOther2: hazards.other2,
        instructions,
        esdTable,
        heavyLiftingSafe,
        toolsSuitable,
        gasTypes,
        gasRows,
        delay1From,
        delay1To,
        delay1Reason,
        delay2From,
        delay2To,
        delay2Reason,
        permitStatus,
        continuedPermitNo,
        closureChecks
      }
    };

    return {
      id: initialPermit?.id || '',
      serialNumber: permitNumber,
      rowNumber: initialPermit?.rowNumber || 1,
      day: initialPermit?.day || new Date().getDate(),
      month: initialPermit?.month || 'آبان',
      year: initialPermit?.year || 1403,
      permitType: permitType,
      permitCategory: permitType,
      attachedPermits: {
        confinedSpace: attachedPermits.confinedSpace,
        confinedSpaceSerial: attachedPermits.confinedSpaceNo,
        excavation: attachedPermits.excavation,
        excavationSerial: attachedPermits.excavationNo,
        workingAtHeight: hazards.height,
        electrical: attachedPermits.electricalIsolation,
        electricalSerial: attachedPermits.electricalIsolationNo,
        lifting: attachedPermits.vehicleEntry,
        processIsolation: attachedPermits.processIsolation,
        radiation: attachedPermits.radiation
      },
      description: description || 'عملیات ' + (isHot ? 'کار گرم' : 'کار سرد'),
      location: unit || '',
      equipmentName: equipmentNo || '',
      woNumber: woNo || '',
      maintenanceType: purpose || 'PM',
      machineryRequired: machineryNeeded,
      usedEquipment: Object.entries(usedTools).filter(([k, v]) => k !== 'otherText' && Boolean(v)).map(([k]) => k),
      inspections: inspections as any,
      ppeRequired: Object.entries(ppe).filter(([_, v]) => v === true).map(([k]) => k),
      hazards: Object.entries(hazards).filter(([_, v]) => v === true).map(([k]) => k),
      startHour,
      endHour,
      workShift: initialPermit?.workShift || 'Morning',
      gasTestRequired: gasTypes.notRequired ? 'Not Required' : 'Completed',
      gasTest: {
        testTime: gasRows[0]?.time || '07:45',
        testerName: gasRows[0]?.testerName || gasTesterName || currentUser.username,
        o2: Number(gasRows[0]?.o2) || 20.9,
        lel: Number(gasRows[0]?.lel) || 0,
        h2s: Number(gasRows[0]?.h2s) || 0,
        co: Number(gasRows[0]?.co) || 0,
        voc: 0,
        status: sectionValidations.safetyUnit.isComplete ? 'Approved' : 'Rejected'
      },
      safetyInspection: initialPermit?.safetyInspection || 'Approved',
      standByHse: initialPermit?.standByHse || '',
      responsibles: {
        unitSupervisor: signatures4Tier.issuer.name || initialPermit?.responsibles?.unitSupervisor || '',
        jobExecutor: signatures4Tier.executor.name || qualifiedPersonnel || initialPermit?.responsibles?.jobExecutor || '',
        safetyUnit: signatures4Tier.safetyUnit.name || initialPermit?.responsibles?.safetyUnit || '',
        registeredBy: initialPermit?.responsibles?.registeredBy || currentUser.username
      },
      qualifiedPersonnel: qualifiedPersonnel,
      signatures4Tier: signatures4Tier,
      closureDetails: closureDetailsObj,
      customFields: mergedCustomFields,
      status: allClosureSigned ? 'Closed' : (initialPermit?.status || 'Active'),
      createdDate: initialPermit?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      renewals: initialPermit?.renewals || [],
      signatures: [
        { role: signatures4Tier.issuer.roleTitle, name: signatures4Tier.issuer.name || '', date: `${executionDate} ${signatures4Tier.issuer.time || '07:30'}`, status: signatures4Tier.issuer.status || 'Pending', signatureImage: signatures4Tier.issuer.signatureImage },
        { role: signatures4Tier.executor.roleTitle, name: signatures4Tier.executor.name || '', date: `${executionDate} ${signatures4Tier.executor.time || '07:45'}`, status: signatures4Tier.executor.status || 'Pending', signatureImage: signatures4Tier.executor.signatureImage },
        { role: signatures4Tier.areaSupervisor.roleTitle, name: signatures4Tier.areaSupervisor.name || '', date: `${executionDate} ${signatures4Tier.areaSupervisor.time || '07:50'}`, status: signatures4Tier.areaSupervisor.status || 'Pending', signatureImage: signatures4Tier.areaSupervisor.signatureImage },
        { role: signatures4Tier.safetyUnit.roleTitle, name: signatures4Tier.safetyUnit.name || '', date: `${executionDate} ${signatures4Tier.safetyUnit.time || '08:00'}`, status: signatures4Tier.safetyUnit.status || 'Pending', signatureImage: signatures4Tier.safetyUnit.signatureImage }
      ],
      auditLogs: auditLogsList,
      version: (initialPermit?.version || 1)
    };
  };

  const handleSaveAsDraft = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentMode === 'view') return;

    const base = buildDraftPermit();
    const isUpdatingDraft = initialPermit?.status === 'Draft';
    const draftPermit: WorkPermit = {
      ...base,
      status: 'Draft',
      auditLogs: [
        ...auditLogsList,
        {
          id: `aud-${Date.now()}`,
          user: currentUser.fullName || currentUser.username,
          userRole: currentUser.role,
          timestamp: new Date().toISOString(),
          persianDateTime: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          action: isUpdatingDraft ? 'به‌روزرسانی پیش‌نویس' : 'ثبت به عنوان پیش‌نویس',
          details: 'پروانه کار در وضعیت پیش‌نویس ذخیره گردید تا پس از تکمیل بخش‌های مربوطه، ارجاع و صادر شود.',
          version: (initialPermit?.version || 1) + 1
        }
      ],
      version: (initialPermit?.version || 1) + 1
    };

    try {
      syncPermitReferral(draftPermit, currentUser);
    } catch (err) {
      console.warn('Sync permit referral draft:', err);
    }
    onSave(draftPermit);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentMode === 'view') return;

    // Check Hot Work Permit Holiday Constraints
    if (isHot && holidayInfo.isHoliday) {
      if (!isSeniorDuty) {
        setClosureValidationError({
          roleTitle: 'محدودیت صادرکننده پروانه کار گرم در روز تعطیل',
          message: 'شما مجاز به صدور پروانه کار گرم در روزهای تعطیل نیستید. این مجوز صرفاً برای پرسنل دارای سمت شغلی کشیک ارشد فعال است.',
          missingItems: [
            `مناسبت تقویمی: ${holidayInfo.holidayTitle || 'تعطیل رسمی'} (${holidayInfo.dateShamsi})`,
            `سمت شغلی صادرکننده: ${currentUser.jobTitle || currentUser.role || 'غیر از کشیک ارشد'}`
          ]
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (!holidayWarningConfirmed) {
        setShowHolidayWarningModal(true);
        return;
      }
    }

    // Require at least Section 1 (Issuer) to be completed before official issuance
    if (!sectionValidations.issuer.isComplete) {
      setClosureValidationError({
        roleTitle: 'کشیک ارشد یا صادرکننده پروانه (بخش اول)',
        message: 'جهت ثبت و صدور رسمی پروانه کار، تکمیل تمامی اطلاعات پایه، پروانه‌های الحاقی، بازرسی‌ها، PPE، شرایط خطرناک و دستورالعمل‌های ایمنی در بخش اول الزامی است:',
        missingItems: sectionValidations.issuer.missingFields
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const base = buildDraftPermit();
    const isCompletingDraft = initialPermit?.status === 'Draft';
    const allClosureSigned =
      closureSignatures.executor.status === 'Approved' &&
      closureSignatures.areaSupervisor.status === 'Approved' &&
      closureSignatures.issuer.status === 'Approved';

    const permitToSave: WorkPermit = {
      ...base,
      status: allClosureSigned ? 'Closed' : 'Active',
      createdDate: initialPermit?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      auditLogs: [
        ...auditLogsList,
        {
          id: `aud-${Date.now()}`,
          user: currentUser.fullName || currentUser.username,
          userRole: currentUser.role,
          timestamp: new Date().toISOString(),
          persianDateTime: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          action: allClosureSigned
            ? 'ثبت خاتمه نهایی پروانه کار'
            : isCompletingDraft
              ? 'تکمیل و صدور رسمی پروانه کار'
              : currentMode === 'edit'
                ? 'ویرایش و به‌روزرسانی پروانه کار'
                : 'ثبت و صدور پروانه کار',
          details: allClosureSigned
            ? 'فرایند خاتمه پروانه کار با تأیید مجری کار، مسئول محوطه و کشیک ارشد/صادرکننده تکمیل و پروانه بسته شد.'
            : isCompletingDraft 
              ? 'پیش‌نویس پروانه کار با موفقیت تکمیل و پروانه به صورت رسمی صادر شد.'
              : (currentMode === 'edit' ? 'اطلاعات و وضعیت گردش‌کار پروانه کار به‌روزرسانی گردید.' : 'پروانه کار جدید ثبت و رسماً صادر شد.'),
          version: (initialPermit?.version || 1) + 1
        }
      ],
      version: (initialPermit?.version || 1) + 1
    };

    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        try {
          syncPermitReferral(permitToSave, currentUser);
        } catch (err) {
          console.warn('Sync permit referral:', err);
        }
        onSave(permitToSave);
      }
    });
  };

  const inspectionTexts = isHot ? HOT_INSPECTION_TEXTS : COLD_INSPECTION_TEXTS;
  const esdRowsNames = ESD_ROWS_NAMES;

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* Top Controls Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{isFa ? 'بازگشت به فهرست' : 'Back to List'}</span>
          </button>

          {/* Current Mode Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 ${
              initialPermit?.status === 'Draft'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-400 dark:border-amber-700 shadow-xs'
                : currentMode === 'view'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  : currentMode === 'edit'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            }`}>
              {initialPermit?.status === 'Draft' ? (
                <>
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{isFa ? 'تکمیل و صدور پیش‌نویس' : 'Completing Draft'}</span>
                </>
              ) : currentMode === 'view' ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{isFa ? 'مشاهده فرم پروانه کار صادر شده' : 'Viewing Registered Permit Form'}</span>
                </>
              ) : currentMode === 'edit' ? (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isFa ? 'ویرایش پروانه کار (مدیر اصلی)' : 'Editing Permit (Admin)'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isFa ? 'ثبت پروانه جدید' : 'New Permit Registration'}</span>
                </>
              )}
            </span>
            {initialPermit && (
              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {initialPermit.serialNumber}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Actions */}
          {currentMode === 'view' && (
            <>
              {(currentUser.role === 'Administrator' || initialPermit?.status === 'Draft') && (
                <button
                  type="button"
                  onClick={() => setCurrentMode('edit')}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{isFa ? (initialPermit?.status === 'Draft' ? 'تکمیل و صدور پیش‌نویس' : 'ویرایش پروانه کار') : 'Edit Permit'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>{isFa ? 'چاپ رسمی پروانه' : 'Print Form'}</span>
              </button>
            </>
          )}

          {/* Save as Draft Button */}
          {currentMode !== 'view' && (
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {initialPermit?.status === 'Draft' 
                  ? (isFa ? 'به‌روزرسانی پیش‌نویس' : 'Update Draft') 
                  : (isFa ? 'ثبت به عنوان پیش‌نویس' : 'Save as Draft')}
              </span>
            </button>
          )}

          {/* Submit Button in Edit/Create Mode */}
          {currentMode !== 'view' && (
            <button
              type="button"
              onClick={handleSubmit}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow flex items-center gap-2 cursor-pointer transition-colors ${
                initialPermit?.status === 'Draft'
                  ? (isHot ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
                  : currentMode === 'edit'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : (isHot ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {initialPermit?.status === 'Draft'
                  ? (isFa ? (isHot ? 'تکمیل و صدور رسمی پروانه کار گرم' : 'تکمیل و صدور رسمی پروانه کار سرد') : 'Complete & Issue Permit')
                  : currentMode === 'edit'
                    ? (isFa ? 'ذخیره تغییرات پروانه کار' : 'Save Changes')
                    : (isHot ? 'ثبت و صدور پروانه کار گرم' : 'ثبت و صدور پروانه کار سرد')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Hot Work Permit Holiday Control Alert Banner */}
      {isHot && holidayInfo.isHoliday && (
        <div className={`p-4 rounded-2xl border-2 shadow-md space-y-2 transition-all ${
          isSeniorDuty
            ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200'
            : 'bg-rose-50 dark:bg-rose-950/80 border-rose-500 dark:border-rose-700 text-rose-900 dark:text-rose-100'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 ${isSeniorDuty ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`} />
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap font-black text-sm">
                <span>وضعیت تقویمی: {holidayInfo.holidayTitle || 'روز تعطیل'} ({holidayInfo.dateShamsi})</span>
                {isSeniorDuty ? (
                  <span className="px-3 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    سمت صادرکننده: کشیک ارشد (مجاز با اخذ تأییدیه)
                  </span>
                ) : (
                  <span className="px-3 py-0.5 rounded-full text-xs font-black bg-rose-200 text-rose-900 dark:bg-rose-900/90 dark:text-rose-100 border border-rose-400 dark:border-rose-700">
                    سمت صادرکننده: غیر از کشیک ارشد (صدور مسدود است)
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed opacity-95">
                {isSeniorDuty
                  ? 'صدور پروانه کار گرم در روزهای تعطیل مشمول الزامات و محدودیتهای ویژه مطابق با استاندارد و دستورالعمل صدور پروانه کار در روزهای تعطیل میباشد.'
                  : 'شما مجاز به صدور پروانه کار گرم در روزهای تعطیل نیستید. این مجوز صرفاً برای پرسنل دارای سمت شغلی کشیک ارشد فعال است.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Draft State Notification Banner */}
      {initialPermit?.status === 'Draft' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border-2 border-blue-400/80 dark:border-blue-700/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded-xl shadow-xs shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-amber-900 dark:text-amber-200">
                  {isFa ? 'این پروانه کار در حالت «پیش‌نویس» ذخیره شده است' : 'This permit is currently saved as Draft'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-600">
                  DRAFT
                </span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300 mt-1">
                {isFa 
                  ? 'اطلاعات این فرم به عنوان پیش‌نویس نگهداری شده است. پس از تکمیل بخش‌های باقی‌مانده و امضاهای مربوطه، بر روی «تکمیل و صدور رسمی پروانه کار» کلیک نمایید.'
                  : 'This permit is saved as draft. Complete the required sections and signatures to officially issue it.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-mono font-bold text-amber-900 dark:text-amber-200">
              {initialPermit.serialNumber}
            </span>
          </div>
        </div>
      )}

      {/* Workflow Feedback Banner */}
      {workflowFeedbackBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-xs print:hidden animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-bold">{workflowFeedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setWorkflowFeedbackBanner(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Validation Error Banner (فیلدهای ناقص و هشدار ارجاع/امضای زودهنگام) */}
      {closureValidationError && (
        <div className="bg-red-50 dark:bg-red-950/60 border-2 border-red-300 dark:border-red-800 rounded-xl p-4 text-red-900 dark:text-red-200 shadow-md print:hidden animate-shake">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold text-xs text-red-800 dark:text-red-300">
                  {closureValidationError.roleTitle}: {closureValidationError.message}
                </div>
                {closureValidationError.missingItems.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-[11px] font-medium text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-900/40 p-2.5 rounded-lg border border-red-200 dark:border-red-800/60">
                    {closureValidationError.missingItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setClosureValidationError(null)}
              className="text-xs font-bold text-red-700 hover:text-red-950 px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/50"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* Workflow & Responsibilities Overview Bar (تفکیک مسئولیت‌ها و وضعیت بخش‌ها) */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
              گردش‌کار و وضعیت بخش‌های پروانه کار بر اساس تفکیک مسئولیت‌ها:
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            ارجاع و امضای هر مرحله فقط پس از تکمیل تمام الزامات همان بخش مجاز است
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
          {/* Step 1: Issuer */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between ${
            sectionValidations.issuer.isComplete 
              ? (signatures4Tier.issuer.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200')
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>۱. کشیک ارشد / صادرکننده</span>
              {signatures4Tier.issuer.status === 'Approved' ? (
                <span className="text-emerald-600 font-extrabold text-[10px]">امضا شد ✓</span>
              ) : sectionValidations.issuer.isComplete ? (
                <span className="text-blue-600 font-bold text-[10px]">آماده امضا</span>
              ) : (
                <span className="text-amber-600 font-bold text-[10px]">{sectionValidations.issuer.missingFields.length} نقص</span>
              )}
            </div>
            <div className="text-[10px] opacity-80 mt-1">بخش اول، الحاقی، بازرسی، PPE، F&G</div>
          </div>

          {/* Step 2: Executor */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between ${
            sectionValidations.executor.isComplete 
              ? (signatures4Tier.executor.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200')
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>۲. مسئول انجام کار</span>
              {signatures4Tier.executor.status === 'Approved' ? (
                <span className="text-emerald-600 font-extrabold text-[10px]">امضا شد ✓</span>
              ) : sectionValidations.executor.isComplete ? (
                <span className="text-blue-600 font-bold text-[10px]">آماده امضا</span>
              ) : (
                <span className="text-amber-600 font-bold text-[10px]">{sectionValidations.executor.missingFields.length} نقص</span>
              )}
            </div>
            <div className="text-[10px] opacity-80 mt-1">ابزار، نفرات صلاحیت‌دار، ایمنی</div>
          </div>

          {/* Step 3: Area Supervisor */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between ${
            signatures4Tier.areaSupervisor.status === 'Approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : (signatures4Tier.issuer.status === 'Approved' && signatures4Tier.executor.status === 'Approved'
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500')
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>۳. مسئول محوطه</span>
              {signatures4Tier.areaSupervisor.status === 'Approved' ? (
                <span className="text-emerald-600 font-extrabold text-[10px]">امضا شد ✓</span>
              ) : (signatures4Tier.issuer.status === 'Approved' && signatures4Tier.executor.status === 'Approved') ? (
                <span className="text-blue-600 font-bold text-[10px]">آماده امضا</span>
              ) : (
                <span className="text-slate-400 font-medium text-[10px]">منتظر ۱ و ۲</span>
              )}
            </div>
            <div className="text-[10px] opacity-80 mt-1">بازرسی محوطه و تأیید شروع کار</div>
          </div>

          {/* Step 4: Safety Unit */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between ${
            signatures4Tier.safetyUnit.status === 'Approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : (sectionValidations.safetyUnit.isComplete
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200')
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>۴. واحد HSE (ایمنی)</span>
              {signatures4Tier.safetyUnit.status === 'Approved' ? (
                <span className="text-emerald-600 font-extrabold text-[10px]">امضا شد ✓</span>
              ) : sectionValidations.safetyUnit.isComplete ? (
                <span className="text-blue-600 font-bold text-[10px]">آماده امضا</span>
              ) : (
                <span className="text-amber-600 font-bold text-[10px]">{sectionValidations.safetyUnit.missingFields.length} نقص</span>
              )}
            </div>
            <div className="text-[10px] opacity-80 mt-1">آزمایش گازها و صدور نهایی</div>
          </div>

          {/* Step 5: Closure */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between col-span-2 md:col-span-1 ${
            closureSignatures.executor.status === 'Approved' &&
            closureSignatures.areaSupervisor.status === 'Approved' &&
            closureSignatures.issuer.status === 'Approved'
              ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200'
              : (closureValidation.isComplete
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500')
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>۵. خاتمه پروانه (۳ نقش)</span>
              {closureSignatures.executor.status === 'Approved' &&
              closureSignatures.areaSupervisor.status === 'Approved' &&
              closureSignatures.issuer.status === 'Approved' ? (
                <span className="text-purple-600 font-extrabold text-[10px]">خاتمه یافت ✓</span>
              ) : closureValidation.isComplete ? (
                <span className="text-blue-600 font-bold text-[10px]">آماده امضا</span>
              ) : (
                <span className="text-slate-400 font-medium text-[10px]">پس از اتمام کار</span>
              )}
            </div>
            <div className="text-[10px] opacity-80 mt-1">مجری ← محوطه ← صادرکننده</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 font-sans text-xs">
        <fieldset disabled={isReadOnly} className={`contents ${isReadOnly ? 'cursor-default' : ''}`}>
        
        {/* =========================================================================================
            PAGE 1 FRAME
           ========================================================================================= */}
        <div className={`bg-white text-slate-900 border-4 ${borderColor} p-4 md:p-6 shadow-2xl relative rounded-sm`}>
          
          {/* Header Block */}
          <div className="border border-slate-800 grid grid-cols-12 text-center font-bold">
            {/* Logo (Only Logo, No Text) */}
            <div className="col-span-4 md:col-span-3 print:col-span-3 border-b md:border-b-0 print:border-b-0 border-l border-slate-800 p-2 flex items-center justify-center min-h-[64px]">
              {branding.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt="Official Logo" 
                  className="max-h-14 max-w-full object-contain select-none"
                  style={{
                    height: `${branding.logoHeightPrintMm || 16}mm`,
                    imageRendering: 'auto'
                  }}
                />
              ) : (
                <HseLogo size="md" forceDefault={true} showShadow={false} />
              )}
            </div>

            {/* Title */}
            <div className="col-span-8 md:col-span-5 print:col-span-5 border-b md:border-b-0 print:border-b-0 md:border-l print:border-l border-slate-800 p-3 flex flex-col items-center justify-center">
              <div className="text-sm sm:text-base font-extrabold text-slate-900">شرکت پتروشیمی رجال</div>
              <div className={`text-xs sm:text-sm md:text-base font-extrabold mt-1 ${isHot ? 'text-red-700' : 'text-blue-800'}`}>
                {isHot ? 'پروانه کار گرم PERMIT WORK HOT' : 'پروانه کار سرد COLD WORK PERMIT'}
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="col-span-12 md:col-span-4 print:col-span-4 p-2 text-right text-[11px] space-y-1.5 flex flex-col justify-center">
              <div className="flex items-center gap-1">
                <span className="shrink-0">شماره پروانه کار:</span>
                <input
                  type="text"
                  value={permitNumber}
                  readOnly
                  disabled
                  className="font-mono font-bold w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 rounded-md px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300 cursor-not-allowed shadow-inner"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0 font-bold">تاریخ اجرای کار:</span>
                <div className="w-full">
                  <PersianDatePicker
                    value={executionDate}
                    onChange={(jStr) => setExecutionDate(jStr)}
                    isFa={isFa}
                    disabled={isReadOnly}
                    inputClassName="px-2 py-0.5 text-xs h-7"
                    placeholder="YYYY/MM/DD"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0">ساعت شروع کار:</span>
                <div className="w-full">
                  <PersianTimePicker
                    value={startHour}
                    onChange={(t) => setStartHour(t)}
                    isFa={isFa}
                    disabled={isReadOnly}
                    size="sm"
                    inputClassName="px-2 py-0.5 text-xs h-7"
                    placeholder="08:00"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0">ساعت پایان کار:</span>
                <div className="w-full">
                  <PersianTimePicker
                    value={endHour}
                    onChange={(t) => setEndHour(t)}
                    isFa={isFa}
                    disabled={isReadOnly}
                    size="sm"
                    inputClassName="px-2 py-0.5 text-xs h-7"
                    placeholder="16:00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sub Header Info Rows */}
          <div className="border-x border-b border-slate-800 p-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-1">
                <span className="font-bold shrink-0">واحد:</span>
                <input
                  type="text"
                  list="ptw-units-list"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder={isFa ? 'انتخاب یا ورود واحد سازمانی...' : 'Select or enter unit...'}
                  className="w-full border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs font-bold"
                />
                <datalist id="ptw-units-list">
                  {unifiedUnits.map(u => (
                    <option key={u.id} value={u.name}>
                      {u.fullPath && u.fullPath !== u.name ? `${u.name} (${u.fullPath})` : u.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold shrink-0">شماره تجهیز:</span>
                <input type="text" value={equipmentNo} onChange={e => setEquipmentNo(e.target.value)} className="w-full border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold shrink-0">شماره WO:</span>
                <input type="text" value={woNo} onChange={e => setWoNo(e.target.value)} className="w-full border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold shrink-0">به منظور:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={purpose === 'OH'} onChange={() => setPurpose('OH')} className="w-3.5 h-3.5" />
                <span>OH</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={purpose === 'PM'} onChange={() => setPurpose('PM')} className="w-3.5 h-3.5" />
                <span>PM</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={purpose === 'EM'} onChange={() => setPurpose('EM')} className="w-3.5 h-3.5" />
                <span>EM</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={purpose === 'Other'} onChange={() => setPurpose('Other')} className="w-3.5 h-3.5" />
                <span>سایر:</span>
              </label>
              <input type="text" value={purposeOtherText} onChange={e => setPurposeOtherText(e.target.value)} className="flex-1 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
            </div>

            <div className="flex items-center gap-1">
              <span className="font-bold shrink-0">شرح کار:</span>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
            </div>

            <div className="flex items-center gap-1">
              <span className="font-bold shrink-0">ماشین آلات مورد نیاز (جرثقیل، لیفتراک و...):</span>
              <input type="text" value={machineryNeeded} onChange={e => setMachineryNeeded(e.target.value)} className="w-full border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold shrink-0">نوع تجهیزات و ابزار مورد استفاده: (تکمیل توسط مسئول انجام کار)</span>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={usedTools.electrical} onChange={e => setUsedTools({ ...usedTools, electrical: e.target.checked })} className="w-3.5 h-3.5" /> برقی</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={usedTools.mechanical} onChange={e => setUsedTools({ ...usedTools, mechanical: e.target.checked })} className="w-3.5 h-3.5" /> مکانیکی</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={usedTools.flame} onChange={e => setUsedTools({ ...usedTools, flame: e.target.checked })} className="w-3.5 h-3.5" /> شعله افکن</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={usedTools.other} onChange={e => setUsedTools({ ...usedTools, other: e.target.checked })} className="w-3.5 h-3.5" /> سایر موارد:</label>
              <input type="text" value={usedTools.otherText} onChange={e => setUsedTools({ ...usedTools, otherText: e.target.value })} className="flex-1 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
            </div>

            {/* Attached Permits Grid */}
            <div className="border-t border-slate-400 pt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold">پروانه های الحاقی و تکمیلی:</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                  * در صورت انتخاب هر پروانه الحاقی، ثبت شماره سریال آن الزامی است
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={attachedPermits.excavation} onChange={e => setAttachedPermits({ ...attachedPermits, excavation: e.target.checked })} />
                    <span>حفاری</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`shrink-0 ${attachedPermits.excavation && !attachedPermits.excavationNo.trim() ? 'text-red-600 font-bold' : ''}`}>
                      شماره{attachedPermits.excavation ? ' *' : ''}:
                    </span>
                    <input
                      type="text"
                      value={attachedPermits.excavationNo}
                      onChange={e => setAttachedPermits({ ...attachedPermits, excavationNo: e.target.value })}
                      placeholder={attachedPermits.excavation ? 'شماره الزامی...' : ''}
                      className={`w-28 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                        attachedPermits.excavation && !attachedPermits.excavationNo.trim()
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                          : 'border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={attachedPermits.confinedSpace} onChange={e => setAttachedPermits({ ...attachedPermits, confinedSpace: e.target.checked })} />
                    <span>ورود به فضای بسته</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`shrink-0 ${attachedPermits.confinedSpace && !attachedPermits.confinedSpaceNo.trim() ? 'text-red-600 font-bold' : ''}`}>
                      شماره{attachedPermits.confinedSpace ? ' *' : ''}:
                    </span>
                    <input
                      type="text"
                      value={attachedPermits.confinedSpaceNo}
                      onChange={e => setAttachedPermits({ ...attachedPermits, confinedSpaceNo: e.target.value })}
                      placeholder={attachedPermits.confinedSpace ? 'شماره الزامی...' : ''}
                      className={`w-28 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                        attachedPermits.confinedSpace && !attachedPermits.confinedSpaceNo.trim()
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                          : 'border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={attachedPermits.radiation} onChange={e => setAttachedPermits({ ...attachedPermits, radiation: e.target.checked })} />
                    <span>پرتو نگاری</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`shrink-0 ${attachedPermits.radiation && !attachedPermits.radiationNo.trim() ? 'text-red-600 font-bold' : ''}`}>
                      شماره{attachedPermits.radiation ? ' *' : ''}:
                    </span>
                    <input
                      type="text"
                      value={attachedPermits.radiationNo}
                      onChange={e => setAttachedPermits({ ...attachedPermits, radiationNo: e.target.value })}
                      placeholder={attachedPermits.radiation ? 'شماره الزامی...' : ''}
                      className={`w-28 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                        attachedPermits.radiation && !attachedPermits.radiationNo.trim()
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                          : 'border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={attachedPermits.electricalIsolation} onChange={e => setAttachedPermits({ ...attachedPermits, electricalIsolation: e.target.checked })} />
                    <span>جداسازی الکتریکی</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`shrink-0 ${attachedPermits.electricalIsolation && !attachedPermits.electricalIsolationNo.trim() ? 'text-red-600 font-bold' : ''}`}>
                      شماره{attachedPermits.electricalIsolation ? ' *' : ''}:
                    </span>
                    <input
                      type="text"
                      value={attachedPermits.electricalIsolationNo}
                      onChange={e => setAttachedPermits({ ...attachedPermits, electricalIsolationNo: e.target.value })}
                      placeholder={attachedPermits.electricalIsolation ? 'شماره الزامی...' : ''}
                      className={`w-28 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                        attachedPermits.electricalIsolation && !attachedPermits.electricalIsolationNo.trim()
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                          : 'border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={attachedPermits.vehicleEntry} onChange={e => setAttachedPermits({ ...attachedPermits, vehicleEntry: e.target.checked })} />
                    <span>ورود ماشین آلات</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`shrink-0 ${attachedPermits.vehicleEntry && !attachedPermits.vehicleEntryNo.trim() ? 'text-red-600 font-bold' : ''}`}>
                      شماره{attachedPermits.vehicleEntry ? ' *' : ''}:
                    </span>
                    <input
                      type="text"
                      value={attachedPermits.vehicleEntryNo}
                      onChange={e => setAttachedPermits({ ...attachedPermits, vehicleEntryNo: e.target.value })}
                      placeholder={attachedPermits.vehicleEntry ? 'شماره الزامی...' : ''}
                      className={`w-28 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                        attachedPermits.vehicleEntry && !attachedPermits.vehicleEntryNo.trim()
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                          : 'border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={attachedPermits.processIsolation} onChange={e => setAttachedPermits({ ...attachedPermits, processIsolation: e.target.checked })} />
                    <span>جداسازی فرایندی، مکانیکی، ابزار دقیق</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className={`shrink-0 ${attachedPermits.processIsolation && !attachedPermits.processIsolationNo.trim() ? 'text-red-600 font-bold' : ''}`}>
                      شماره{attachedPermits.processIsolation ? ' *' : ''}:
                    </span>
                    <input
                      type="text"
                      value={attachedPermits.processIsolationNo}
                      onChange={e => setAttachedPermits({ ...attachedPermits, processIsolationNo: e.target.value })}
                      placeholder={attachedPermits.processIsolation ? 'شماره الزامی...' : ''}
                      className={`w-28 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                        attachedPermits.processIsolation && !attachedPermits.processIsolationNo.trim()
                          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                          : 'border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Custom Fields (فیلدهای سفارشی و متغیر پروانه کار) */}
            <div className="mt-3">
              <PermitDynamicFieldsSection
                permitType={permitType}
                values={customFieldValues}
                onChange={(key, val) => setCustomFieldValues(prev => ({ ...prev, [key]: val }))}
                isReadOnly={isReadOnly}
                isFa={isFa}
              />
            </div>
          </div>

          {/* Inspections Table */}
          <div className="mt-3 border border-slate-800">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-100 font-bold">
                  <th className="p-1.5 border-l border-slate-800">بازرسی ها/ INSPECTIONS</th>
                  <th className="p-1.5 border-l border-slate-800 w-12 text-center">بله</th>
                  <th className="p-1.5 border-l border-slate-800 w-12 text-center">خیر</th>
                  <th className="p-1.5 w-20 text-center">لازم نیست</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inspectionTexts.map((text, idx) => {
                  const num = idx + 1;
                  return (
                    <tr key={num} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50">
                      <td className="p-1.5 border-l border-slate-800 leading-normal">
                        <div>{text}</div>

                        {/* Inline custom options for item 3 */}
                        {num === 3 && (
                          <div className="flex items-center gap-3 mt-1 mr-4">
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp3Sub.drain} onChange={e => setInsp3Sub({ ...insp3Sub, drain: e.target.checked })} /> تخلیه شده اند</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp3Sub.vent} onChange={e => setInsp3Sub({ ...insp3Sub, vent: e.target.checked })} /> Vent شده اند</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp3Sub.purge} onChange={e => setInsp3Sub({ ...insp3Sub, purge: e.target.checked })} /> Purge شده اند</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp3Sub.wash} onChange={e => setInsp3Sub({ ...insp3Sub, wash: e.target.checked })} /> شستشو شده اند</label>
                          </div>
                        )}

                        {/* Inline Padlock No for item 6 */}
                        {num === 6 && (
                          <div className="inline-flex items-center gap-1 mr-2">
                            <span>(No Padlock :</span>
                            <input type="text" value={insp6PadlockNo} onChange={e => setInsp6PadlockNo(e.target.value)} className="w-36 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
                            <span>)</span>
                          </div>
                        )}

                        {/* Inline Peyvast for Item 8 (Cold) / Item 9 (Hot) */}
                        {((!isHot && num === 8) || (isHot && num === 9)) && (
                          <div className="flex items-center gap-3 mt-1 mr-4">
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp8Peyvast.jsa} onChange={e => setInsp8Peyvast({ ...insp8Peyvast, jsa: e.target.checked })} /> JSA</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp8Peyvast.pid} onChange={e => setInsp8Peyvast({ ...insp8Peyvast, pid: e.target.checked })} /> نقشه P&ID</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp8Peyvast.checklist} onChange={e => setInsp8Peyvast({ ...insp8Peyvast, checklist: e.target.checked })} /> چک لیست</label>
                          </div>
                        )}

                        {/* Inline Amadebash for Item 12 (Cold) / Item 13 (Hot) */}
                        {((!isHot && num === 12) || (isHot && num === 13)) && (
                          <div className="flex items-center gap-3 mt-1 mr-4">
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp12Amadebash.operator} onChange={e => setInsp12Amadebash({ ...insp12Amadebash, operator: e.target.checked })} /> بهره بردار</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp12Amadebash.hse} onChange={e => setInsp12Amadebash({ ...insp12Amadebash, hse: e.target.checked })} /> HSE</label>
                            <label className="flex items-center gap-1"><input type="checkbox" checked={insp12Amadebash.firefighter} onChange={e => setInsp12Amadebash({ ...insp12Amadebash, firefighter: e.target.checked })} /> آتش نشان با تجهیزات آتش نشانی</label>
                          </div>
                        )}
                      </td>
                      <td className="p-1.5 border-l border-slate-800 text-center">
                        <input type="radio" name={`insp_${num}`} checked={inspections[num] === 'بله'} onChange={() => handleInspChange(num, 'بله')} className="w-3.5 h-3.5" />
                      </td>
                      <td className="p-1.5 border-l border-slate-800 text-center">
                        <input type="radio" name={`insp_${num}`} checked={inspections[num] === 'خیر'} onChange={() => handleInspChange(num, 'خیر')} className="w-3.5 h-3.5" />
                      </td>
                      <td className="p-1.5 text-center">
                        <input type="radio" name={`insp_${num}`} checked={inspections[num] === 'لازم نیست'} onChange={() => handleInspChange(num, 'لازم نیست')} className="w-3.5 h-3.5" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>

          {/* PPE Section */}
          <div className="mt-3 border border-slate-700 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-900 shadow-xs text-[11px] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-4 bg-blue-600 rounded-xs inline-block"></span>
                <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                  وسایل استحفاظی فردی مورد نیاز (Required PPE):
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                انتخاب موارد الزامی متناسب با خطرات محیط کار
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Row 1: عمومی و پوشش بدن (General & Body) */}
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>حفاظت عمومی سر، بدن و پا:</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.helmet} onChange={e => setPpe({ ...ppe, helmet: e.target.checked })} />
                    <span>کلاه ایمنی</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.chinStrap} onChange={e => setPpe({ ...ppe, chinStrap: e.target.checked })} />
                    <span>چانه‌بند کلاه ایمنی</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.workClothes} onChange={e => setPpe({ ...ppe, workClothes: e.target.checked })} />
                    <span>لباس کار</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.safetyShoes} onChange={e => setPpe({ ...ppe, safetyShoes: e.target.checked })} />
                    <span>کفش ایمنی</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.boots} onChange={e => setPpe({ ...ppe, boots: e.target.checked })} />
                    <span>چکمه</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.antiShockHarness} onChange={e => setPpe({ ...ppe, antiShockHarness: e.target.checked })} />
                    <span>کمربند ایمنی آنتی‌شوک‌دار</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.acidSuit} onChange={e => setPpe({ ...ppe, acidSuit: e.target.checked })} />
                    <span>لباس کامل ضد اسید</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.aluminumSuit} onChange={e => setPpe({ ...ppe, aluminumSuit: e.target.checked })} />
                    <span>لباس آلومینیومی ضد حریق</span>
                  </label>
                </div>
              </div>

              {/* Row 2: دستکش‌ها (شامل ضد سایش و ضد برش) */}
              <div className="p-2 bg-blue-50/60 dark:bg-blue-950/25 rounded-lg border border-blue-200/80 dark:border-blue-900/50">
                <div className="text-[10px] font-bold text-blue-900 dark:text-blue-200 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>دستکش‌های حفاظتی:</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesLeather} onChange={e => setPpe({ ...ppe, glovesLeather: e.target.checked })} />
                    <span>چرمی</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesCloth} onChange={e => setPpe({ ...ppe, glovesCloth: e.target.checked })} />
                    <span>پارچه‌ای</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesPvc} onChange={e => setPpe({ ...ppe, glovesPvc: e.target.checked })} />
                    <span>PVC</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesRefractory} onChange={e => setPpe({ ...ppe, glovesRefractory: e.target.checked })} />
                    <span>نسوز</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesAcid} onChange={e => setPpe({ ...ppe, glovesAcid: e.target.checked })} />
                    <span>ضد اسید</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesElectrical} onChange={e => setPpe({ ...ppe, glovesElectrical: e.target.checked })} />
                    <span>عایق برق</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesAbrasion} onChange={e => setPpe({ ...ppe, glovesAbrasion: e.target.checked })} />
                    <span>ضد سایش</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.glovesCut} onChange={e => setPpe({ ...ppe, glovesCut: e.target.checked })} />
                    <span>ضد برش</span>
                  </label>
                </div>
              </div>

              {/* Row 3: چشم و صورت (Eye & Face) */}
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>محافظت چشم و صورت:</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">عینک:</span>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.gogglesCutting} onChange={e => setPpe({ ...ppe, gogglesCutting: e.target.checked })} />
                      <span>برشکاری</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.gogglesGrinding} onChange={e => setPpe({ ...ppe, gogglesGrinding: e.target.checked })} />
                      <span>سنگ‌زنی</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.gogglesUv} onChange={e => setPpe({ ...ppe, gogglesUv: e.target.checked })} />
                      <span>UV</span>
                    </label>
                  </div>

                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">شیلد محافظ صورت:</span>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.faceShieldGrinding} onChange={e => setPpe({ ...ppe, faceShieldGrinding: e.target.checked })} />
                      <span>سنگ‌زنی</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.faceShieldWelding} onChange={e => setPpe({ ...ppe, faceShieldWelding: e.target.checked })} />
                      <span>جوشکاری</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 4: تنفسی و شنوایی (Respiratory & Hearing) */}
              <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>محافظت تنفسی و شنوایی:</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">ماسک:</span>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.maskDust} onChange={e => setPpe({ ...ppe, maskDust: e.target.checked })} />
                      <span>ضدغبار</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.maskHalf} onChange={e => setPpe({ ...ppe, maskHalf: e.target.checked })} />
                      <span>نیم‌صورت</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.maskFull} onChange={e => setPpe({ ...ppe, maskFull: e.target.checked })} />
                      <span>تمام‌صورت</span>
                    </label>
                  </div>

                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>

                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.scbaMask} onChange={e => setPpe({ ...ppe, scbaMask: e.target.checked })} />
                    <span className="font-bold text-slate-800 dark:text-slate-200">ماسک تنفسی مستقل SCBA</span>
                  </label>

                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">محافظ گوش:</span>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.earPlugs} onChange={e => setPpe({ ...ppe, earPlugs: e.target.checked })} />
                      <span>توگوشی</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 accent-blue-600" checked={ppe.earMuffs} onChange={e => setPpe({ ...ppe, earMuffs: e.target.checked })} />
                      <span>روگوشی</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 5: سایر تجهیزات (Other / Custom PPE) */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">سایر موارد:</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={ppe.other1}
                    onChange={e => setPpe({ ...ppe, other1: e.target.value })}
                    placeholder="سایر تجهیزات فردی مورد نیاز ۱..."
                    className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={ppe.other2}
                    onChange={e => setPpe({ ...ppe, other2: e.target.value })}
                    placeholder="سایر تجهیزات فردی مورد نیاز ۲..."
                    className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hazards Section */}
          <div className="mt-3 border border-slate-800 p-2 space-y-1 text-[11px]">
            <div className="font-bold border-b border-slate-300 pb-1">شرایط خطرناک محیط کار:</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.flammable} onChange={e => setHazards({ ...hazards, flammable: e.target.checked })} /> قابل اشتعال</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.explosive} onChange={e => setHazards({ ...hazards, explosive: e.target.checked })} /> قابل انفجار</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.toxic} onChange={e => setHazards({ ...hazards, toxic: e.target.checked })} /> مواد سمی</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.corrosive} onChange={e => setHazards({ ...hazards, corrosive: e.target.checked })} /> مواد خورنده</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.radiation} onChange={e => setHazards({ ...hazards, radiation: e.target.checked })} /> تشعشع پرتوزا</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.height} onChange={e => setHazards({ ...hazards, height: e.target.checked })} /> ارتفاع</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.electrocution} onChange={e => setHazards({ ...hazards, electrocution: e.target.checked })} /> برق گرفتگی</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.hotSurface} onChange={e => setHazards({ ...hazards, hotSurface: e.target.checked })} /> سطح داغ</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.pressurizedVessel} onChange={e => setHazards({ ...hazards, pressurizedVessel: e.target.checked })} /> ظروف تحت فشار</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.dust} onChange={e => setHazards({ ...hazards, dust: e.target.checked })} /> گرد و خاک</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.rain} onChange={e => setHazards({ ...hazards, rain: e.target.checked })} /> بارانی</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.strongWind} onChange={e => setHazards({ ...hazards, strongWind: e.target.checked })} /> باد شدید</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.wetMoist} onChange={e => setHazards({ ...hazards, wetMoist: e.target.checked })} /> خیس و مرطوب</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hazards.slipperySurface} onChange={e => setHazards({ ...hazards, slipperySurface: e.target.checked })} /> سطح لغزنده</label>

              <div className="flex items-center gap-1">
                <span>□</span>
                <input type="text" value={hazards.other1} onChange={e => setHazards({ ...hazards, other1: e.target.value })} className="w-32 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
              </div>
              <div className="flex items-center gap-1">
                <span>□</span>
                <input type="text" value={hazards.other2} onChange={e => setHazards({ ...hazards, other2: e.target.value })} className="w-32 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
              </div>
            </div>
          </div>

          {/* Instructions Box for Cold Work Permit Page 1 */}
          {!isHot && (
            <div className="mt-3 border border-slate-800 p-2 space-y-1 text-[11px]">
              <div className="font-bold">دستورالعمل‌ها و توصیه‌های لازم:</div>
              <textarea
                rows={3}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg text-xs shadow-sm"
              />
            </div>
          )}



          {/* Instructions Box for Hot Work Permit Page 2 Top */}
          {isHot && (
            <>
              <div className="mt-3 border border-slate-800 p-2 space-y-1 text-[11px]">
                <div className="font-bold">دستورالعمل‌ها و توصیه‌های لازم:</div>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg text-xs shadow-sm"
                />
              </div>

              {/* ESD / Fire & Gas Table for Hot Work */}
              <div className="mt-3 border border-slate-800">
                <div className="p-1 font-bold border-b border-slate-800 bg-slate-100 text-[11px]">
                  نیازهای مرتبط با سیستم‌های Fire & Gas و ESD :
                </div>
                <div className="overflow-x-auto">
                  <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full min-w-[680px] text-center text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold">
                        <th className="p-1 border-l border-slate-800 text-right px-2"></th>
                        <th colSpan={5} className="p-1 border-l border-slate-800 bg-red-50">Inhibited / Isolated</th>
                        <th colSpan={3} className="p-1 bg-emerald-50">Active / De-Isolated</th>
                      </tr>
                      <tr className="border-b border-slate-800 bg-slate-100 font-bold">
                        <th className="p-1 border-l border-slate-800"></th>
                        <th className="p-1 border-l border-slate-800 w-8">Req</th>
                        <th className="p-1 border-l border-slate-800">Unit/Zone</th>
                        <th className="p-1 border-l border-slate-800">Date</th>
                        <th className="p-1 border-l border-slate-800">Time</th>
                        <th className="p-1 border-l border-slate-800">Sign</th>
                        <th className="p-1 border-l border-slate-800">Date</th>
                        <th className="p-1 border-l border-slate-800">Time</th>
                        <th className="p-1">Sign</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {esdRowsNames.map((name, idx) => (
                        <tr key={name}>
                          <td className="p-1 border-l border-slate-800 text-right font-medium px-2">{name}</td>
                          <td className="p-1 border-l border-slate-800 text-center">
                            <input
                              type="checkbox"
                              checked={esdTable[idx].req}
                              onChange={e => {
                                const newT = [...esdTable];
                                newT[idx].req = e.target.checked;
                                setEsdTable(newT);
                              }}
                            />
                          </td>
                          <td className="p-1 border-l border-slate-800"><input type="text" value={esdTable[idx].unitZone} onChange={e => { const newT = [...esdTable]; newT[idx].unitZone = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                          <td className="p-1 border-l border-slate-800"><input type="text" value={esdTable[idx].inhibitDate} onChange={e => { const newT = [...esdTable]; newT[idx].inhibitDate = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                          <td className="p-1 border-l border-slate-800"><input type="text" value={esdTable[idx].inhibitTime} onChange={e => { const newT = [...esdTable]; newT[idx].inhibitTime = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                          <td className="p-1 border-l border-slate-800"><input type="text" value={esdTable[idx].inhibitSign} onChange={e => { const newT = [...esdTable]; newT[idx].inhibitSign = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                          <td className="p-1 border-l border-slate-800"><input type="text" value={esdTable[idx].activeDate} onChange={e => { const newT = [...esdTable]; newT[idx].activeDate = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                          <td className="p-1 border-l border-slate-800"><input type="text" value={esdTable[idx].activeTime} onChange={e => { const newT = [...esdTable]; newT[idx].activeTime = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                          <td className="p-1"><input type="text" value={esdTable[idx].activeSign} onChange={e => { const newT = [...esdTable]; newT[idx].activeSign = e.target.value; setEsdTable(newT); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              </div>
            </>
          )}

          {/* Section: تکمیل توسط مجری */}
          <div className="mt-3 border border-slate-800 p-2.5 space-y-2 text-[11px] bg-white dark:bg-slate-900 rounded-sm">
            <div className="font-bold border-b border-slate-300 dark:border-slate-700 pb-1.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-3.5 bg-blue-600 rounded-xs inline-block"></span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">تکمیل توسط مسئول انجام کار (مجری کار):</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800 px-2 py-0.5 rounded-md font-bold">
                  مسئول تکمیل: مجری کار
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                  sectionValidations.executor.isComplete
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300'
                }`}>
                  {sectionValidations.executor.isComplete ? 'تکمیل شده ✓' : `${sectionValidations.executor.missingFields.length} مورد باقی‌مانده`}
                </span>
              </div>
            </div>
            
            <PermitQualifiedPersonnelField
              value={qualifiedPersonnel}
              onChange={setQualifiedPersonnel}
              disabled={isReadOnly}
              isReadOnly={isReadOnly}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="font-medium">آیا روش های صحیح و ایمن لازم، جهت جابجایی وسایل سنگین در نظر گرفته شده اند؟</div>
              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="heavyLifting" checked={heavyLiftingSafe === 'بله'} onChange={() => setHeavyLiftingSafe('بله')} /> بله</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="heavyLifting" checked={heavyLiftingSafe === 'خیر'} onChange={() => setHeavyLiftingSafe('خیر')} /> خیر</label>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="font-medium">آیا مشاغل و ابزار مذکور با انسان و افراد انجام دهنده تناسب دارد؟</div>
              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="toolsSuitable" checked={toolsSuitable === 'بله'} onChange={() => setToolsSuitable('بله')} /> بله</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="toolsSuitable" checked={toolsSuitable === 'خیر'} onChange={() => setToolsSuitable('خیر')} /> خیر</label>
              </div>
            </div>
          </div>

          {/* Section: آزمایش گازها (واحد HSE) */}
          <div className="mt-3 border border-slate-800 p-2.5 space-y-2 text-[11px] bg-white dark:bg-slate-900 rounded-sm">
            <div className="font-bold border-b border-slate-300 dark:border-slate-700 pb-1.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-3.5 bg-red-600 rounded-xs inline-block"></span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">آزمایش گازها (Gas Testing):</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-red-100 dark:bg-red-950/70 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-800 px-2 py-0.5 rounded-md font-bold">
                  مسئول تکمیل: واحد HSE (ایمنی)
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                  sectionValidations.safetyUnit.isComplete
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300'
                }`}>
                  {sectionValidations.safetyUnit.isComplete ? 'تکمیل شده ✓' : `${sectionValidations.safetyUnit.missingFields.length} نقص الزامی`}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-bold">آزمایش‌های مربوط به گاز:</span>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={gasTypes.explosive} onChange={e => setGasTypes({ ...gasTypes, explosive: e.target.checked })} /> گازهای قابل انفجار</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={gasTypes.oxygen} onChange={e => setGasTypes({ ...gasTypes, oxygen: e.target.checked })} /> اکسیژن</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={gasTypes.toxic} onChange={e => setGasTypes({ ...gasTypes, toxic: e.target.checked })} /> گازهای سمی</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={gasTypes.once} onChange={e => setGasTypes({ ...gasTypes, once: e.target.checked })} /> یکبار</label>
              
              <div className="flex items-center gap-1">
                <input type="checkbox" checked={gasTypes.periodic} onChange={e => setGasTypes({ ...gasTypes, periodic: e.target.checked })} />
                <span>متناوب (هر</span>
                <input type="text" value={gasTypes.periodicMinutes} onChange={e => setGasTypes({ ...gasTypes, periodicMinutes: e.target.value })} className="w-14 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" />
                <span>دقیقه)</span>
              </div>

              <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={gasTypes.notRequired} onChange={e => setGasTypes({ ...gasTypes, notRequired: e.target.checked })} /> لازم نیست</label>
            </div>

            {/* Gas Measurements Table */}
            <div className="border border-slate-800 overflow-x-auto">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full min-w-[720px] text-center text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-100 font-bold">
                    <th className="p-1 border-l border-slate-800 text-right px-2">آزمایش کننده (Gas Tester) نام و نام خانوادگی/ امضاء</th>
                    <th className="p-1 border-l border-slate-800 w-12">O₂ (%)</th>
                    <th className="p-1 border-l border-slate-800 w-12">LEL (%)</th>
                    <th className="p-1 border-l border-slate-800 w-14">CO (ppm)</th>
                    <th className="p-1 border-l border-slate-800 w-12">CO₂ (%)</th>
                    <th className="p-1 border-l border-slate-800 w-14">H₂S (PPM)</th>
                    <th className="p-1 border-l border-slate-800 w-14">NH₂ (PPM)</th>
                    <th className="p-1 border-l border-slate-800 w-14">SO₂ (PPM)</th>
                    <th className="p-1 border-l border-slate-800 w-16">Other (SPEC)</th>
                    <th className="p-1 w-16">ساعت (Time)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {gasRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-1 border-l border-slate-800 min-w-[140px]">
                        <PermitPersonnelAutocomplete
                          value={row.testerName}
                          onChange={val => {
                            const newR = [...gasRows];
                            newR[idx].testerName = val;
                            setGasRows(newR);
                            if (idx === 0) setGasTesterName(val);
                          }}
                          placeholder={idx === 0 ? "نام آزمایش‌کننده HSE" : ""}
                          compact={true}
                          disabled={isReadOnly}
                        />
                      </td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.o2} onChange={e => { const newR = [...gasRows]; newR[idx].o2 = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.lel} onChange={e => { const newR = [...gasRows]; newR[idx].lel = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.co} onChange={e => { const newR = [...gasRows]; newR[idx].co = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.co2} onChange={e => { const newR = [...gasRows]; newR[idx].co2 = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.h2s} onChange={e => { const newR = [...gasRows]; newR[idx].h2s = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.nh2} onChange={e => { const newR = [...gasRows]; newR[idx].nh2 = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.so2} onChange={e => { const newR = [...gasRows]; newR[idx].so2 = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1 border-l border-slate-800"><input type="text" value={row.other} onChange={e => { const newR = [...gasRows]; newR[idx].other = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                      <td className="p-1"><input type="text" value={row.time} onChange={e => { const newR = [...gasRows]; newR[idx].time = e.target.value; setGasRows(newR); }} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs" /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>

          {/* Section: 4 Declaration Signatures Boxes (مطابق با فرم رسمی و تصویر پیوست) */}
          <PermitSignatures4TierSection
            signatures={signatures4Tier}
            onChange={setSignatures4Tier}
            isReadOnly={isReadOnly}
            currentUser={currentUser}
            isFa={isFa}
            permitCategory={isHot ? 'hot' : 'cold'}
            sectionValidations={sectionValidations}
            onAuditAction={appendAuditLog}
            onReferTier={handleReferStageToNext}
          />

          {/* Section: خاتمه پروانه کار (PERMIT CLOSURE - ۳ نقش: مجری کار، مسئول محوطه، کشیک ارشد/صادرکننده) */}
          <div className="mt-3 border-2 border-slate-800 p-3 space-y-3 text-[10px] bg-slate-50/40 dark:bg-slate-900/40 rounded-sm">
            <div className="font-bold border-b border-slate-300 dark:border-slate-700 pb-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-4 bg-purple-600 rounded-xs inline-block"></span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                  خاتمه پروانه کار (PERMIT CLOSURE & WORK COMPLETION):
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800 px-2.5 py-0.5 rounded-md font-bold">
                  گردش‌کار خاتمه: مجری کار ← مسئول محوطه ← کشیک ارشد / صادرکننده
                </span>
              </div>
            </div>
            
            {/* وقفه نابهنگام */}
            <div className="space-y-1.5 p-2 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-slate-700 dark:text-slate-300">وقفه نابهنگام:</div>
              <div className="flex flex-wrap items-center gap-2">
                <span>از ساعت</span>
                <div className="w-24">
                  <PersianTimePicker value={delay1From} onChange={setDelay1From} isFa={isFa} size="sm" inputClassName="px-1 py-0.5 text-xs text-center h-6.5 font-bold" placeholder="HH:mm" />
                </div>
                <span>تا ساعت</span>
                <div className="w-24">
                  <PersianTimePicker value={delay1To} onChange={setDelay1To} isFa={isFa} size="sm" inputClassName="px-1 py-0.5 text-xs text-center h-6.5 font-bold" placeholder="HH:mm" />
                </div>
                <span>به دلیل</span>
                <input type="text" value={delay1Reason} onChange={e => setDelay1Reason(e.target.value)} placeholder="شرح دلیل وقفه..." className="flex-1 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs min-w-[140px]" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>از ساعت</span>
                <div className="w-24">
                  <PersianTimePicker value={delay2From} onChange={setDelay2From} isFa={isFa} size="sm" inputClassName="px-1 py-0.5 text-xs text-center h-6.5 font-bold" placeholder="HH:mm" />
                </div>
                <span>تا ساعت</span>
                <div className="w-24">
                  <PersianTimePicker value={delay2To} onChange={setDelay2To} isFa={isFa} size="sm" inputClassName="px-1 py-0.5 text-xs text-center h-6.5 font-bold" placeholder="HH:mm" />
                </div>
                <span>به دلیل</span>
                <input type="text" value={delay2Reason} onChange={e => setDelay2Reason(e.target.value)} placeholder="شرح دلیل وقفه..." className="flex-1 border border-slate-300 bg-white dark:bg-slate-900 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs min-w-[140px]" />
              </div>
            </div>

            {/* وضعیت کار */}
            <div className="flex flex-wrap items-center gap-4 pt-1.5 p-2 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
              <span className="font-bold shrink-0">کار مربوط به این پروانه کار:</span>
              <label className="flex items-center gap-1 cursor-pointer font-medium">
                <input type="radio" name="pStatus" checked={permitStatus === 'completed'} onChange={() => { setPermitStatus('completed'); setClosureValidationError(null); }} />
                <span>انجام شده است.</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer font-medium">
                <input type="radio" name="pStatus" checked={permitStatus === 'suspended'} onChange={() => { setPermitStatus('suspended'); setClosureValidationError(null); }} />
                <span>به حالت تعلیق در آمده است.</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <label className="flex items-center gap-1 cursor-pointer font-medium">
                  <input type="radio" name="pStatus" checked={permitStatus === 'continued'} onChange={() => { setPermitStatus('continued'); setClosureValidationError(null); }} />
                  <span>با پروانه شماره</span>
                </label>
                <input
                  type="text"
                  value={continuedPermitNo}
                  onChange={e => { setContinuedPermitNo(e.target.value); setClosureValidationError(null); }}
                  placeholder="شماره پروانه جدید..."
                  className={`w-32 border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm text-xs ${
                    permitStatus === 'continued' && !continuedPermitNo.trim()
                      ? 'border-red-400 bg-red-50 text-red-900'
                      : 'border-slate-300 bg-white dark:bg-slate-900'
                  }`}
                />
                <span>ادامه خواهد یافت.</span>
              </div>
            </div>

            {/* Closure Checklist Table */}
            <div className="border border-slate-800 mt-2 bg-white dark:bg-slate-900">
              <div className="p-1.5 bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-800 text-[10px] flex items-center justify-between">
                <span>چک‌لیست بررسی‌های پایانی خاتمه کار (تکمیل الزامی است):</span>
                <span className="text-slate-500 font-medium">پاسخ به هر ۶ ردیف جهت خاتمه الزامی است</span>
              </div>
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-[10px] border-collapse">
                <tbody>
                  {[
                    '1- پرسنل درگیر در کار منطقه کاری را ترک کرده اند.',
                    '2- تمامی تجهیزات به صورت ایمن در محل خود می‌باشند.',
                    '3- ایزوله‌های عملیاتی و مکانیکی برداشته شده اند.',
                    '4- تجهیزات ایمنی برداشته شده اند.',
                    '5- تجهیزات به حالت نرمال برگشته‌اند.',
                    '6- عملیات تمیزکاری محل کار انجام شده است.'
                  ].map((text, idx) => {
                    const num = idx + 1;
                    const isAnswered = Boolean(closureChecks[num]);
                    return (
                      <tr key={num} className={`border-b border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        !isAnswered ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}>
                        <td className="p-1.5 border-l border-slate-800 font-medium px-2.5">
                          <span className={!isAnswered ? 'text-amber-900 dark:text-amber-200' : ''}>{text}</span>
                        </td>
                        <td className="p-1 border-l border-slate-800 w-14 text-center">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input type="radio" name={`closeCheck_${num}`} checked={closureChecks[num] === 'بله'} onChange={() => handleClosureCheckChange(num, 'بله')} />
                            <span>بله</span>
                          </label>
                        </td>
                        <td className="p-1 border-l border-slate-800 w-14 text-center">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input type="radio" name={`closeCheck_${num}`} checked={closureChecks[num] === 'خیر'} onChange={() => handleClosureCheckChange(num, 'خیر')} />
                            <span>خیر</span>
                          </label>
                        </td>
                        <td className="p-1 w-20 text-center">
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input type="radio" name={`closeCheck_${num}`} checked={closureChecks[num] === 'لازم نیست'} onChange={() => handleClosureCheckChange(num, 'لازم نیست')} />
                            <span>لازم نیست</span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>

            {/* Section: Closure Signatures Boxes (گردش‌کار ۲ مرحله‌ای خاتمه: مجری کار و مسئول محوطه) */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
              {/* Box 1: مسئول انجام کار (مجری کار) */}
              {(() => {
                const tier = closureSignatures.executor;
                const isSigned = tier.status === 'Approved' && Boolean(tier.signatureImage);
                const canSign = canSignClosureSequential('executor');
                return (
                  <div className={`p-2.5 rounded-lg border-2 flex flex-col justify-between space-y-2 bg-white dark:bg-slate-900 shadow-xs ${
                    isSigned ? 'border-emerald-500' : (canSign ? 'border-blue-400' : 'border-slate-300 opacity-80')
                  }`}>
                    <div>
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">۱</span>
                          <span>مسئول انجام کار (مجری)</span>
                        </span>
                        {isSigned ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[9px] font-bold">
                            تأیید شد ✓
                          </span>
                        ) : (
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[9px]">
                            مرحله ۱ خاتمه
                          </span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-slate-600 dark:text-slate-300 mt-1 leading-normal">
                        اینجانب شخصاً بررسی‌های لازم را انجام داده و انجام همه موارد ذکر شده و تخلیه محل را تایید می‌نمایم.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="shrink-0 font-medium text-[10px]">نام مجری:</span>
                        <div className="flex-1 min-w-0">
                          <PermitPersonnelAutocomplete
                            value={tier.name}
                            onChange={val => setClosureSignatures(prev => ({
                              ...prev,
                              executor: { ...prev.executor, name: val }
                            }))}
                            placeholder="جستجو یا ورود نام..."
                            disabled={isReadOnly || isSigned}
                            compact={true}
                            requiredPtwRole="executor"
                            permitCategory={isHot ? 'hot' : 'cold'}
                            filterPtwQualifiedOnly={true}
                            onUnauthorizedAttempt={(_p, reason) => {
                              setClosureValidationError({
                                roleTitle: tier.roleTitle,
                                message: reason,
                                missingItems: []
                              });
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 w-full">
                        <span className="shrink-0 font-medium text-[10px]">ساعت:</span>
                        <div className="w-24 shrink-0">
                          <PersianTimePicker 
                            value={tier.time} 
                            onChange={time => setClosureSignatures(prev => ({
                              ...prev,
                              executor: { ...prev.executor, time }
                            }))} 
                            isFa={isFa} 
                            size="sm" 
                            disabled={isReadOnly || isSigned}
                            inputClassName="px-1.5 py-0.5 text-xs h-6 text-center font-bold" 
                            placeholder="HH:mm" 
                          />
                        </div>
                      </div>

                      {/* Signature box / button */}
                      {isSigned ? (
                        <div className="p-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 rounded text-center space-y-1">
                          <img src={tier.signatureImage} alt="امضا" className="max-h-10 mx-auto object-contain" />
                          <div className="text-[8.5px] text-emerald-800 font-mono">
                            {tier.signedByUser} ({tier.signedByRole}) - {tier.persianTimestamp}
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleClearClosureSignature('executor')}
                              className="text-[9px] text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                            >
                              حذف و بازنشانی امضا
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleInitiateClosureSign('executor')}
                            className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          >
                            <PenTool className="w-3 h-3" />
                            <span>ثبت امضای دیجیتال مجری کار</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Box 2: مسئول محوطه */}
              {(() => {
                const tier = closureSignatures.areaSupervisor;
                const isSigned = tier.status === 'Approved' && Boolean(tier.signatureImage);
                const canSign = canSignClosureSequential('areaSupervisor');
                return (
                  <div className={`p-2.5 rounded-lg border-2 flex flex-col justify-between space-y-2 bg-white dark:bg-slate-900 shadow-xs ${
                    isSigned ? 'border-emerald-500' : (canSign ? 'border-blue-400' : 'border-slate-300 opacity-70')
                  }`}>
                    <div>
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">۲</span>
                          <span>مسئول محوطه</span>
                        </span>
                        {isSigned ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[9px] font-bold">
                            تأیید شد ✓
                          </span>
                        ) : !canSign ? (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>منتظر مجری</span>
                          </span>
                        ) : (
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[9px]">
                            مرحله ۲ خاتمه
                          </span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-slate-600 dark:text-slate-300 mt-1 leading-normal">
                        اینجانب شخصاً بازرسی‌های فوق را انجام داده و پاکسازی و ایمن بودن محوطه را تایید می‌نمایم.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="shrink-0 font-medium text-[10px]">نام مسئول محوطه:</span>
                        <div className="flex-1 min-w-0">
                          <PermitPersonnelAutocomplete
                            value={tier.name}
                            onChange={val => setClosureSignatures(prev => ({
                              ...prev,
                              areaSupervisor: { ...prev.areaSupervisor, name: val }
                            }))}
                            placeholder="جستجو یا ورود نام..."
                            disabled={isReadOnly || isSigned}
                            compact={true}
                            requiredPtwRole="areaSupervisor"
                            permitCategory={isHot ? 'hot' : 'cold'}
                            filterPtwQualifiedOnly={true}
                            onUnauthorizedAttempt={(_p, reason) => {
                              setClosureValidationError({
                                roleTitle: tier.roleTitle,
                                message: reason,
                                missingItems: []
                              });
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 w-full">
                        <span className="shrink-0 font-medium text-[10px]">ساعت:</span>
                        <div className="w-24 shrink-0">
                          <PersianTimePicker 
                            value={tier.time} 
                            onChange={time => setClosureSignatures(prev => ({
                              ...prev,
                              areaSupervisor: { ...prev.areaSupervisor, time }
                            }))} 
                            isFa={isFa} 
                            size="sm" 
                            disabled={isReadOnly || isSigned}
                            inputClassName="px-1.5 py-0.5 text-xs h-6 text-center font-bold" 
                            placeholder="HH:mm" 
                          />
                        </div>
                      </div>

                      {/* Signature box / button */}
                      {isSigned ? (
                        <div className="p-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 rounded text-center space-y-1">
                          <img src={tier.signatureImage} alt="امضا" className="max-h-10 mx-auto object-contain" />
                          <div className="text-[8.5px] text-emerald-800 font-mono">
                            {tier.signedByUser} ({tier.signedByRole}) - {tier.persianTimestamp}
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleClearClosureSignature('areaSupervisor')}
                              className="text-[9px] text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                            >
                              حذف و بازنشانی امضا
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={isReadOnly || !canSign}
                            onClick={() => handleInitiateClosureSign('areaSupervisor')}
                            className={`w-full py-1.5 px-2 rounded font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-xs transition-colors ${
                              canSign
                                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <PenTool className="w-3 h-3" />
                            <span>ثبت امضای مسئول محوطه</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Footer Box */}
          <div className="mt-3 border border-slate-800 p-2 space-y-1 text-[9px] leading-tight">
            <div>
              * این پروانه کار فقط توسط اشخاص مجاز صادر خواهد شد و به هیچ نحو مسئولیت سرپرست واحد بهره‌برداری و مجری کار در مورد اجرای صحیح و از روی قواعد ایمنی و همچنین آمادگی برای هرگونه اتفاقات فوری را سلب نخواهد کرد.
            </div>
            <div className="flex items-center justify-between font-bold pt-1 border-t border-slate-300">
              <span>توزیع نسخ: نسخه اول (سفید) مجری کار، نسخه دوم (زرد) مسئول محوطه، نسخه سوم (سبز) واحد ایمنی.</span>
              <span className="font-mono">- RHS- F00Rev 00</span>
            </div>
          </div>

        </div>
        </fieldset>

        {/* Audit Trail & Change History (سوابق و تاریخچه تغییرات و تأییدها) */}
        {auditLogsList.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm print:hidden space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  سوابق، ارجاعات و تاریخچه تغییرات پروانه کار ({auditLogsList.length} رویداد ثبت‌شده):
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Audit Trail & History Log
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {auditLogsList.slice().reverse().map((log, idx) => (
                <div key={log.id || idx} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{log.action}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                        {log.user} ({log.userRole})
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">{log.details}</p>
                  </div>
                  <div className="text-[9.5px] text-slate-400 shrink-0 font-mono text-left" dir="ltr">
                    {log.persianDateTime || log.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 print:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{isFa ? 'بازگشت به فهرست پروانه‌ها' : 'Back to Permits'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Print Official Permit Button */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              title="چاپ رسمی پروانه کار مطابق با فرم استاندارد و تأییدیه‌های چهارگانه"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>{isFa ? 'چاپ رسمی پروانه' : 'Print Permit'}</span>
            </button>

            {/* Save as Draft Button */}
            {currentMode !== 'view' && (
              <button
                type="button"
                onClick={handleSaveAsDraft}
                className="px-5 py-2.5 text-xs font-bold rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  {initialPermit?.status === 'Draft' 
                    ? (isFa ? 'به‌روزرسانی پیش‌نویس' : 'Update Draft') 
                    : (isFa ? 'ثبت به عنوان پیش‌نویس' : 'Save as Draft')}
                </span>
              </button>
            )}

            {currentMode !== 'view' && (
              <button
                type="submit"
                className={`px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-colors ${
                  initialPermit?.status === 'Draft'
                    ? (isHot ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
                    : currentMode === 'edit'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : (isHot ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {initialPermit?.status === 'Draft'
                    ? (isFa ? (isHot ? 'تکمیل و صدور رسمی پروانه کار گرم' : 'تکمیل و صدور رسمی پروانه کار سرد') : 'Complete & Issue Permit')
                    : currentMode === 'edit'
                      ? (isFa ? 'ذخیره تغییرات پروانه کار' : 'Save Changes')
                      : (isHot ? 'ثبت و صدور پروانه کار گرم' : 'ثبت و صدور پروانه کار سرد')}
                </span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Digital Signature Modal for Closure Signatures */}
      {activeClosureSignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-4 border border-slate-200 dark:border-slate-800 animate-scale-in" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                  امضای الکترونیکی خاتمه پروانه کار - {closureSignatures[activeClosureSignModal].roleTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveClosureSignModal(null);
                  setTempClosureSignature('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                امضاء‌کننده: <strong>{closureSignatures[activeClosureSignModal].name || currentUser.fullName || currentUser.username}</strong>
              </div>

              <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white p-2">
                <DigitalSignaturePad
                  onSave={sig => setTempClosureSignature(sig)}
                  onClear={() => setTempClosureSignature('')}
                  initialSignature={closureSignatures[activeClosureSignModal].signatureImage || tempClosureSignature}
                  storedSignature={getPersonnelSignature(closureSignatures[activeClosureSignModal].name || currentUser)}
                  signerTarget={closureSignatures[activeClosureSignModal].name || currentUser}
                  isFa={isFa}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveClosureSignModal(null);
                    setTempClosureSignature('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sigToSave = tempClosureSignature || closureSignatures[activeClosureSignModal].signatureImage;
                    if (sigToSave) {
                      handleSaveClosureDigitalSignature(activeClosureSignModal, sigToSave);
                      setTempClosureSignature('');
                    }
                  }}
                  disabled={!tempClosureSignature && !closureSignatures[activeClosureSignModal].signatureImage}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>تأیید و ذخیره امضا</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Master Print Modal with 4-Tier Signatures Layout */}
      {isPrintModalOpen && (
        <PermitMasterPrintModal
          permit={buildDraftPermit()}
          isFa={isFa}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* Hot Work Permit Holiday Confirmation Modal */}
      {showHolidayWarningModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5" dir="rtl">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  تأییدیه صدور پروانه کار گرم در روز تعطیل
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  مناسبت: {holidayInfo.holidayTitle || 'روز تعطیل رسمی'} ({holidayInfo.dateShamsi})
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 text-xs leading-relaxed text-amber-950 dark:text-amber-100 font-bold">
              توجه! صدور پروانه کار گرم در روزهای تعطیل مشمول الزامات و محدودیتهای ویژه مطابق با استاندارد و دستورالعمل صدور پروانه کار در روزهای تعطیل میباشد. آیا از ضرورت و مجاز بودن صدور این پروانه اطمینان دارید؟
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">صادرکننده پروانه:</span>
                <strong className="text-slate-900 dark:text-slate-100">{currentUser.fullName || currentUser.username}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">سمت شغلی استعلام‌شده:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-black">{currentUser.jobTitle || 'کشیک ارشد'}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowHolidayWarningModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setHolidayWarningConfirmed(true);
                  setShowHolidayWarningModal(false);
                  setTimeout(() => {
                    handleSubmit();
                  }, 50);
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید و ادامه صدور</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

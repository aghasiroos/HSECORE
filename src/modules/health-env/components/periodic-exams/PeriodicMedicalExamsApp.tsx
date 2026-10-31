import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import {
  Activity,
  UserCheck,
  Calendar,
  FlaskConical,
  Scale,
  Brain,
  TrendingUp,
  Users,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

import {
  BASE_COLS,
  HEADER_MAP,
  LAB_DEFS,
  BMI_CATS
} from './seedData';

import { parseOccupationalHealthExcel } from './excelParser';
import { workerManager } from '../../../../workers/workerManager';
import { apiDb } from '../../../../services/apiDatabaseClient';
import { getComplexPersonnelList } from '../../../../utils/personnelHelper';
import { AdvancedFilterState, INITIAL_FILTER_STATE } from './AdvancedFilterPanel';
import { DashboardTab } from './tabs/DashboardTab';
import { PersonnelDossierTab } from './tabs/PersonnelDossierTab';
import { ExamsTab } from './tabs/ExamsTab';
import { LabTab } from './tabs/LabTab';
import { BmiTab } from './tabs/BmiTab';
import { SmartReportsTab } from './tabs/SmartReportsTab';
import { AnnualCompareTab } from './tabs/AnnualCompareTab';
import { PersonCompareTab } from './tabs/PersonCompareTab';
import { ImportExcelTab, ImportedBatch } from './tabs/ImportExcelTab';
import { EmptyDatabaseState } from './EmptyDatabaseState';

export type TabKey =
  | 'dashboard'
  | 'personnel'
  | 'exams'
  | 'lab'
  | 'bmi'
  | 'reports'
  | 'compare'
  | 'personcompare'
  | 'import';

import {
  normalizePersianArabicText,
  normalizeForMatching,
  cleanPersianValue,
  normalizeDigits
} from '../../../../utils/textNormalization';

interface Props {
  language?: 'fa' | 'en';
  currentUser?: any;
}

const STORAGE_KEY = 'OCC_HEALTH_EXAMS_DATA_V2';

function personnelKey(rec: any): string {
  const nid = normalizeDigits(rec.nid || '', true);
  if (nid) return 'nid:' + nid;
  const pcode = normalizeDigits(rec.pcode || '', true);
  if (pcode) return 'pcode:' + pcode;
  const normFname = normalizeForMatching(rec.fname || '');
  const normLname = normalizeForMatching(rec.lname || '');
  const normComp = normalizeForMatching(rec.company || '');
  return 'syn:' + normFname + '|' + normLname + '|' + normComp;
}

function jalaliYear(dateStr: any): string | null {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d{4})/);
  return m ? m[1] : null;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function avg(nums: (number | null)[]): number | null {
  const a = nums.filter((n): n is number => n !== null && n !== undefined && !isNaN(n));
  if (!a.length) return null;
  return a.reduce((s, n) => s + n, 0) / a.length;
}

function splitMulti(v: any): string[] {
  if (!v) return [];
  return String(v).split('|').map(s => s.trim()).filter(Boolean);
}

function labStatus(key: string, val: number | null): 'normal' | 'high' | 'low' | 'unknown' {
  const d = LAB_DEFS[key];
  if (!d || val === null || val === undefined) return 'unknown';
  if (d.low !== undefined && val < d.low) return 'low';
  if (d.high !== undefined && val > d.high) return 'high';
  return 'normal';
}

function bmiCat(v: number | null) {
  if (v === null || v === undefined) return null;
  return BMI_CATS.find(c => c.test(v)) || null;
}

function bpCategory(sys: number | null, dia: number | null): string | null {
  if (sys === null && dia === null) return null;
  sys = sys || 0;
  dia = dia || 0;
  if (sys >= 140 || dia >= 90) return 'فشار خون بالا (مرحله ۲)';
  if (sys >= 130 || dia >= 80) return 'فشار خون بالا (مرحله ۱)';
  if (sys >= 120) return 'در آستانه';
  return 'طبیعی';
}

async function saveToStorage(exams: any[], pMap: Record<string, any>, batches: ImportedBatch[]) {
  try {
    const payload = {
      examinations: exams,
      personnelMap: pMap,
      importedBatches: batches
    };
    // Save authoritatively to پایگاه داده database
    await apiDb.saveSetting(STORAGE_KEY, payload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_medical_data_updated'));
      window.dispatchEvent(new CustomEvent('hse_occ_health_data_updated'));
      window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'medical', key: STORAGE_KEY } }));
      window.dispatchEvent(new Event('hse_health_env_updated'));
    }

    // Clean browser local storage to prevent duplicate or stale cache
    try {
      localStorage.removeItem(STORAGE_KEY);
      await idbDel(STORAGE_KEY);
    } catch (_) {}
  } catch (e) {
    console.error('Error saving periodic exam data to پایگاه داده:', e);
  }
}

export const PeriodicMedicalExamsApp: React.FC<Props> = ({ language = 'fa', currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  // Core Data State - START EMPTY BY DEFAULT
  const [personnelMap, setPersonnelMap] = useState<Record<string, any>>({});
  const [examinations, setExaminations] = useState<any[]>([]);
  const [importedBatches, setImportedBatches] = useState<ImportedBatch[]>([]);

  // Selection state
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedPersonYear, setSelectedPersonYear] = useState<string>('all');
  const [pcSelectedId, setPcSelectedId] = useState<string | null>(null);
  const [pcSelectedYears, setPcSelectedYears] = useState<string[]>([]);

  // Advanced Filter state
  const [filters, setFilters] = useState<AdvancedFilterState>(INITIAL_FILTER_STATE);

  // Import state
  const [pendingImport, setPendingImport] = useState<any[]>([]);
  const [pendingImportFile, setPendingImportFile] = useState<{ name: string; size: string } | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  const [dupPolicy, setDupPolicy] = useState<'skip' | 'update' | 'replace'>('skip');

  // Initialize Data from پایگاه داده (with one-time migration from local storage if existing)
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        // 1. Authoritative check from پایگاه داده
        const dbData = await apiDb.getSetting(STORAGE_KEY);
        if (dbData && Array.isArray(dbData.examinations) && isMounted) {
          setExaminations(dbData.examinations || []);
          setPersonnelMap(dbData.personnelMap || {});
          setImportedBatches(dbData.importedBatches || []);
          return;
        }

        // 2. Migration fallback from legacy IndexedDB or localStorage if not yet in پایگاه داده
        try {
          const idbData = await idbGet<any>(STORAGE_KEY);
          if (idbData && Array.isArray(idbData.examinations) && isMounted) {
            setExaminations(idbData.examinations || []);
            setPersonnelMap(idbData.personnelMap || {});
            setImportedBatches(idbData.importedBatches || []);
            // Persist to پایگاه داده and purge IndexedDB
            await apiDb.saveSetting(STORAGE_KEY, idbData);
            await idbDel(STORAGE_KEY);
            return;
          }
        } catch (_) {}

        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.examinations) && isMounted) {
              setExaminations(parsed.examinations || []);
              setPersonnelMap(parsed.personnelMap || {});
              setImportedBatches(parsed.importedBatches || []);
              await apiDb.saveSetting(STORAGE_KEY, parsed);
              localStorage.removeItem(STORAGE_KEY);
              return;
            }
          }
        } catch (_) {}

        if (isMounted) {
          setExaminations([]);
          setPersonnelMap({});
          setImportedBatches([]);
        }
      } catch (err) {
        console.error('Error initializing periodic exam data from پایگاه داده:', err);
        if (isMounted) {
          setExaminations([]);
          setPersonnelMap({});
          setImportedBatches([]);
        }
      }
    }

    loadData();

    // Real-time synchronization across multiple clients/browsers with debounce
    let debounceTimer: any = null;
    const handleRemoteChange = (e: any) => {
      const entity = String(e?.detail?.entity || e?.detail?.key || '').toLowerCase();
      if (entity === STORAGE_KEY.toLowerCase() || entity === 'medical') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          apiDb.getSetting(STORAGE_KEY).then(data => {
            if (data && Array.isArray(data.examinations) && isMounted) {
              setExaminations(data.examinations || []);
              setPersonnelMap(data.personnelMap || {});
              setImportedBatches(data.importedBatches || []);
            }
          }).catch(() => {});
        }, 300);
      }
    };
    window.addEventListener('app_data_mutated', handleRemoteChange);
    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('app_data_mutated', handleRemoteChange);
    };
  }, []);

  const personnelList = useMemo(() => Object.values(personnelMap), [personnelMap]);

  const joinedRecords = useMemo(() => {
    return examinations.map(e => {
      const p = personnelMap[e.personnel_id] || {};
      return { ...p, ...e };
    });
  }, [examinations, personnelMap]);

  const examsFor = (pid: string) => {
    return examinations.filter(e => e.personnel_id === pid).sort((a, b) => (a.exam_year || '').localeCompare(b.exam_year || ''));
  };

  // Priority Search Logic: 1. NID, 2. PCode, 3. Name, 4. Other
  const prioritySearch = (records: any[], q: string) => {
    if (!q || !q.trim()) return records;
    const query = q.trim().toLowerCase();

    const matchesNid: any[] = [];
    const matchesPcode: any[] = [];
    const matchesName: any[] = [];
    const matchesOther: any[] = [];

    records.forEach(r => {
      const nid = (r.nid || '').toString().toLowerCase();
      const pcode = (r.pcode || '').toString().toLowerCase();
      const fullName = `${r.fname || ''} ${r.lname || ''}`.toLowerCase();
      const company = (r.company || '').toString().toLowerCase();
      const opinion = (r.final_opinion || '').toString().toLowerCase();

      if (nid.includes(query)) {
        matchesNid.push(r);
      } else if (pcode.includes(query)) {
        matchesPcode.push(r);
      } else if (fullName.includes(query)) {
        matchesName.push(r);
      } else if (company.includes(query) || opinion.includes(query)) {
        matchesOther.push(r);
      }
    });

    return [...matchesNid, ...matchesPcode, ...matchesName, ...matchesOther];
  };

  // Check if advanced filter criteria matches a record
  const matchesAdvancedFilter = (rec: any, f: AdvancedFilterState): boolean => {
    if (f.company && rec.company !== f.company) return false;
    if (f.year && rec.exam_year !== f.year) return false;
    if (f.gender && rec.gender !== f.gender) return false;
    if (f.opinion && rec.final_opinion !== f.opinion) return false;
    if (f.followup && rec.final_followup_needed !== f.followup) return false;

    if (f.bmiCat) {
      const cat = bmiCat(toNum(rec.bmi));
      if (cat?.key !== f.bmiCat) return false;
    }

    if (f.bpStatus) {
      const bp = bpCategory(toNum(rec.bp_sys), toNum(rec.bp_dia));
      if (f.bpStatus === 'normal' && bp !== 'طبیعی') return false;
      if (f.bpStatus === 'elevated' && bp !== 'در آستانه') return false;
      if (f.bpStatus === 'stage1' && bp !== 'فشار خون بالا (مرحله ۱)') return false;
      if (f.bpStatus === 'stage2' && bp !== 'فشار خون بالا (مرحله ۲)') return false;
    }

    if (f.hazard) {
      const hazards = ['haz_phys', 'haz_chem', 'haz_bio', 'haz_ergo', 'haz_psych', 'haz_other'].flatMap(k => splitMulti(rec[k]));
      if (!hazards.includes(f.hazard)) return false;
    }

    if (f.labAbnormalOnly) {
      let hasAbn = false;
      for (const k of ['chol', 'tg', 'fbs', 'ast', 'alt', 'hb']) {
        if (labStatus(k, toNum(rec[k])) !== 'normal') {
          hasAbn = true;
          break;
        }
      }
      if (!hasAbn) return false;
    }

    return true;
  };

  const isFilterActive = useMemo(() => {
    return (
      Boolean(filters.search && filters.search.trim()) ||
      Boolean(filters.company) ||
      Boolean(filters.year) ||
      Boolean(filters.opinion) ||
      Boolean(filters.followup) ||
      Boolean(filters.gender) ||
      Boolean(filters.bmiCat) ||
      Boolean(filters.bpStatus) ||
      Boolean(filters.hazard) ||
      Boolean(filters.labAbnormalOnly) ||
      Boolean(filters.diseaseOnly) ||
      Boolean(filters.referralOnly)
    );
  }, [filters]);

  const jumpToPerson = (pid: string, year?: string) => {
    setSelectedPersonId(pid);
    if (year) setSelectedPersonYear(year);
    const person = personnelMap[pid];
    if (person) {
      setFilters(prev => ({
        ...prev,
        search: person.nid || person.pcode || `${person.fname || ''} ${person.lname || ''}`.trim()
      }));
    }
    setActiveTab('personnel');
  };

  const renderStatusBadge = (st: string) => {
    if (st === 'high') {
      return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">بالا ⚠️</span>;
    }
    if (st === 'low') {
      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold text-[10px]">پایین ⬇️</span>;
    }
    if (st === 'normal') {
      return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">نرمال ✓</span>;
    }
    return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-normal text-[10px]">نامشخص</span>;
  };

  const renderOpinionBadge = (op: string) => {
    if (!op) return <span className="text-slate-400 text-xs">—</span>;
    if (op === 'بلامانع') {
      return <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 font-extrabold text-xs">بلامانع</span>;
    }
    if (op === 'مشروط') {
      return <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-300 font-extrabold text-xs">مشروط</span>;
    }
    if (op === 'عدم صلاحیت') {
      return <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300 font-extrabold text-xs">عدم صلاحیت</span>;
    }
    return <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-300 font-extrabold text-xs">{op}</span>;
  };

  // Excel template generator with authentic Persian headers and comprehensive occupational health sample
  const downloadExcelTemplate = () => {
    const enToFaMap: Record<string, string> = {};
    Object.entries(HEADER_MAP).forEach(([fa, en]) => {
      enToFaMap[en] = fa;
    });

    const cols = BASE_COLS.map(c => enToFaMap[c] || c);
    const personnelList = getComplexPersonnelList();
    const templateRows = personnelList.slice(0, 2).map((p, idx) => [
      idx + 1, p.firstName || '', p.lastName || '', p.workplace || '', p.nationalCode || '', p.age || 35, p.gender || 'مرد', p.maritalStatus || 'متاهل',
      '', '', '', '', '', '',
      '', 75, 175, 24.5, 120, 80, '1404/01/15', 'معاینات بالینی و سمع قلب و ریه نرمال',
      180, 140, 48, 110, 90, 5.2, 18, 0.9, 22, 25, 180, 4.8, 7.2, 14.5, 43.2, 220,
      'Negative', 'Negative', '1-2', '1-2', 'Negative', 'Negative', '', 'Negative', '',
      10, 10, 10, 10, 10, 10, '', 'Normal', 'Normal', '1404/01/15', 'Normal', '',
      'Normal', '0=GHQ', 'خطر کم', '1404/01/15', '', '', '', '', '',
      '', '', '', '', '', '', '', '',
      'بلامانع', '1405/01/15', '', '',
      '', '', '', '', '', 'خیر', p.personnelCode || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([cols, ...templateRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معاینات ادواری طب کار');
    XLSX.writeFile(wb, 'Occupational_Health_Periodic_Exams_Template.xlsx');
  };

  // Robust File upload handler using smart excel parser with Web Worker support
  const handleFileUpload = async (file: File) => {
    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setImportStatus(`در حال پردازش فایل «${file.name}» (${sizeStr})...`);

    try {
      const buffer = await file.arrayBuffer();

      // Non-blocking parsing with progress updates
      let wb: XLSX.WorkBook | null = null;
      try {
        const workerRes = await workerManager.executeTask(
          'EXCEL_PARSE_MEDICAL_EXAMS',
          { fileBuffer: buffer },
          (prog, msg) => {
            setImportStatus(`در حال پردازش فایل: ${msg || `${prog}%`}`);
          }
        ).promise;
        if (workerRes?.workbook) {
          wb = workerRes.workbook;
        }
      } catch (workerErr) {
        console.warn('Periodic exams parsing via worker notice:', workerErr);
      }

      // Convert buffer with canonical health schema
      if (!wb) {
        wb = XLSX.read(buffer, { type: 'array' });
      }
      const parseResult = parseOccupationalHealthExcel(wb);
      const objs = parseResult.records;

      if (!objs || objs.length === 0) {
        setImportStatus('خطا: هیچ داده معتبری در فایل اکسل شناسایی نشد. لطفاً ساختار ستون‌های فایل را بررسی فرمایید.');
        return;
      }

      setPendingImportFile({
        name: file.name,
        size: sizeStr
      });
      setPendingImport(objs);
      setImportStatus(`فایل «${file.name}» با موفقیت تحلیل شد (${objs.length} رکورد استخراج گردید). لطفاً پیش‌نمایش را بررسی و تأیید نمایید.`);
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setImportStatus('خطا در خواندن و تحلیل فایل اکسل: ' + (err?.message || 'خطای ناشناخته'));
    }
  };

  // Confirm Import Batch
  const confirmImport = () => {
    if (!pendingImport.length) return;

    const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const fileName = pendingImportFile?.name || 'فایل اکسل طب کار';
    const fileSize = pendingImportFile?.size || 'نامشخص';

    const now = new Date();
    const timeStr = new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(now);

    const newPMap = { ...personnelMap };
    const newExams = dupPolicy === 'replace' ? [] : [...examinations];
    const batchPKeys = new Set<string>();
    const batchYears = new Set<string>();
    const batchCompanies = new Set<string>();

    pendingImport.forEach((raw, idx) => {
      if (!raw) return;
      const fname = (raw.fname || '').trim();
      const lname = (raw.lname || '').trim();
      const nid = (raw.nid || '').toString().trim();
      const pcode = (raw.pcode || '').toString().trim();
      const company = (raw.company || '').toString().trim();

      const effectiveFname = fname || (lname ? 'پرسنل' : (nid ? `پرسنل ${nid}` : `پرسنل ${idx + 1}`));
      const effectiveLname = lname || '';

      const pKey = personnelKey({ fname: effectiveFname, lname: effectiveLname, nid, pcode, company });
      batchPKeys.add(pKey);
      if (company) batchCompanies.add(company);

      if (!newPMap[pKey] || dupPolicy === 'update') {
        newPMap[pKey] = {
          personnel_id: pKey,
          fname: effectiveFname,
          lname: effectiveLname,
          nid: nid,
          pcode: pcode,
          company: company,
          gender: raw.gender || 'مرد',
          marital: raw.marital || 'نامشخص',
          age: raw.age || null
        };
      }
      const examYear = jalaliYear(raw.exam_date) || (raw.exam_year ? String(raw.exam_year) : '1404');
      batchYears.add(examYear);

      newExams.push({
        ...raw,
        fname: effectiveFname,
        lname: effectiveLname,
        nid,
        pcode,
        company,
        batch_id: batchId,
        batch_file_name: fileName,
        personnel_id: pKey,
        exam_year: examYear,
        exam_id: `${pKey}_${examYear}_${newExams.length}_${idx}`
      });
    });

    const newBatch: ImportedBatch = {
      id: batchId,
      fileName,
      fileSize,
      importedAt: timeStr,
      recordCount: pendingImport.length,
      personnelCount: batchPKeys.size,
      years: Array.from(batchYears),
      companies: Array.from(batchCompanies)
    };

    const updatedBatches = dupPolicy === 'replace' ? [newBatch] : [newBatch, ...importedBatches];

    setPersonnelMap(newPMap);
    setExaminations(newExams);
    setImportedBatches(updatedBatches);
    saveToStorage(newExams, newPMap, updatedBatches);

    setPendingImport([]);
    setPendingImportFile(null);
    setImportStatus(`فایل «${fileName}» با موفقیت ثبت شد. تعداد ${pendingImport.length} رکورد به سامانه افزوده شد.`);
    setActiveTab('dashboard');
  };

  // Delete Individual Excel File Batch
  const deleteBatch = (batchId: string) => {
    const batch = importedBatches.find(b => b.id === batchId);
    if (!batch) return;

    const remainingExams = examinations.filter(e => e.batch_id !== batchId);

    // Recalculate personnel map from remaining exams
    const remainingPMap: Record<string, any> = {};
    remainingExams.forEach(e => {
      const pKey = e.personnel_id;
      if (pKey && personnelMap[pKey]) {
        remainingPMap[pKey] = personnelMap[pKey];
      }
    });

    const remainingBatches = importedBatches.filter(b => b.id !== batchId);

    setExaminations(remainingExams);
    setPersonnelMap(remainingPMap);
    setImportedBatches(remainingBatches);
    saveToStorage(remainingExams, remainingPMap, remainingBatches);

    setImportStatus(`فایل اکسل «${batch.fileName}» و تمام ${batch.recordCount} رکورد مرتبط با آن با موفقیت حذف گردید.`);
  };

  // Clear All Data
  const clearImportedData = async () => {
    setExaminations([]);
    setPersonnelMap({});
    setImportedBatches([]);
    try {
      await apiDb.saveSetting(STORAGE_KEY, null);
      await idbDel(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setImportStatus('کلیه اطلاعات و فایل‌های سامانه به طور کامل در پایگاه داده پاک‌سازی شدند. پایگاه داده خالی است.');
  };

  const navTabs = [
    { id: 'dashboard' as TabKey, label: 'داشبورد سلامت', icon: <Activity className="w-4 h-4" /> },
    { id: 'personnel' as TabKey, label: 'پرونده پرسنل', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'exams' as TabKey, label: 'معاینات ادواری', icon: <Calendar className="w-4 h-4" /> },
    { id: 'lab' as TabKey, label: 'آزمایشگاه', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'bmi' as TabKey, label: 'شاخص BMI', icon: <Scale className="w-4 h-4" /> },
    { id: 'reports' as TabKey, label: 'گزارش‌های هوشمند', icon: <Brain className="w-4 h-4" /> },
    { id: 'compare' as TabKey, label: 'مقایسه سنواتی', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'personcompare' as TabKey, label: 'مقایسه فردی', icon: <Users className="w-4 h-4" /> },
    { id: 'import' as TabKey, label: 'ورود اطلاعات', icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  const hasData = joinedRecords.length > 0;

  return (
    <div className="relative w-full p-0" dir="rtl">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#132a3a]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Title & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  سامانه جامع پایش معاینات ادواری و طب کار
                </h1>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-bold block -mt-0.5">
                  Occupational Health & Periodic Medical Examination Management System
                </span>
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {personnelList.length} پرسنل | {joinedRecords.length} معاینه
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-xs font-bold transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>ورود اکسل</span>
              </button>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 dark:border-slate-800/80 no-scrollbar">
            {navTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {/* If no data and on an analytical tab, render the clean EmptyDatabaseState */}
        {!hasData && activeTab !== 'import' ? (
          <EmptyDatabaseState
            onGoToImport={() => setActiveTab('import')}
            downloadExcelTemplate={downloadExcelTemplate}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                joinedRecords={joinedRecords}
                personnelList={personnelList}
                toNum={toNum}
                bmiCat={bmiCat}
                bpCategory={bpCategory}
                splitMulti={splitMulti}
                renderOpinionBadge={renderOpinionBadge}
              />
            )}

            {activeTab === 'personnel' && (
              <PersonnelDossierTab
                personnelMap={personnelMap}
                personnelList={personnelList}
                examinations={examinations}
                joinedRecords={joinedRecords}
                selectedPersonId={selectedPersonId}
                selectedPersonYear={selectedPersonYear}
                setSelectedPersonId={setSelectedPersonId}
                setSelectedPersonYear={setSelectedPersonYear}
                filters={filters}
                setFilters={setFilters}
                isFilterActive={isFilterActive}
                prioritySearch={prioritySearch}
                matchesAdvancedFilter={matchesAdvancedFilter}
                examsFor={examsFor}
                toNum={toNum}
                splitMulti={splitMulti}
                labStatus={labStatus}
                renderStatusBadge={renderStatusBadge}
                renderOpinionBadge={renderOpinionBadge}
              />
            )}

            {activeTab === 'exams' && (
              <ExamsTab
                joinedRecords={joinedRecords}
                filters={filters}
                setFilters={setFilters}
                isFilterActive={isFilterActive}
                matchesAdvancedFilter={matchesAdvancedFilter}
                prioritySearch={prioritySearch}
                jumpToPerson={jumpToPerson}
                renderOpinionBadge={renderOpinionBadge}
              />
            )}

            {activeTab === 'lab' && (
              <LabTab
                joinedRecords={joinedRecords}
                filters={filters}
                setFilters={setFilters}
                isFilterActive={isFilterActive}
                matchesAdvancedFilter={matchesAdvancedFilter}
                prioritySearch={prioritySearch}
                toNum={toNum}
                avg={avg}
                labStatus={labStatus}
                renderStatusBadge={renderStatusBadge}
                jumpToPerson={jumpToPerson}
              />
            )}

            {activeTab === 'bmi' && (
              <BmiTab
                joinedRecords={joinedRecords}
                filters={filters}
                setFilters={setFilters}
                isFilterActive={isFilterActive}
                matchesAdvancedFilter={matchesAdvancedFilter}
                prioritySearch={prioritySearch}
                toNum={toNum}
                avg={avg}
                bmiCat={bmiCat}
                jumpToPerson={jumpToPerson}
              />
            )}

            {activeTab === 'reports' && (
              <SmartReportsTab
                joinedRecords={joinedRecords}
                filters={filters}
                setFilters={setFilters}
                isFilterActive={isFilterActive}
                matchesAdvancedFilter={matchesAdvancedFilter}
                prioritySearch={prioritySearch}
                toNum={toNum}
                jumpToPerson={jumpToPerson}
              />
            )}

            {activeTab === 'compare' && (
              <AnnualCompareTab
                joinedRecords={joinedRecords}
                toNum={toNum}
                avg={avg}
              />
            )}

            {activeTab === 'personcompare' && (
              <PersonCompareTab
                personnelList={personnelList}
                personnelMap={personnelMap}
                examsFor={examsFor}
                pcSelectedId={pcSelectedId}
                setPcSelectedId={setPcSelectedId}
                pcSelectedYears={pcSelectedYears}
                setPcSelectedYears={setPcSelectedYears}
                prioritySearch={prioritySearch}
                toNum={toNum}
                labStatus={labStatus}
                renderStatusBadge={renderStatusBadge}
              />
            )}
          </>
        )}

        {activeTab === 'import' && (
          <ImportExcelTab
            downloadExcelTemplate={downloadExcelTemplate}
            handleFileUpload={handleFileUpload}
            importStatus={importStatus}
            joinedRecords={joinedRecords}
            personnelList={personnelList}
            clearImportedData={clearImportedData}
            pendingImport={pendingImport}
            dupPolicy={dupPolicy}
            setDupPolicy={setDupPolicy}
            confirmImport={confirmImport}
            setPendingImport={setPendingImport}
            importedBatches={importedBatches}
            deleteBatch={deleteBatch}
          />
        )}
      </main>
    </div>
  );
};

export default PeriodicMedicalExamsApp;

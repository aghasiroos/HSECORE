import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  FileSpreadsheet, 
  TrendingUp, 
  Download,
  Calendar,
  Search,
  UploadCloud,
  FileDown,
  Info,
  AlertTriangle,
  Check,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { TrirRecord, TrirSeriesPoint } from '../types';
import TrirRecordModal from './trir/TrirRecordModal';
import TrirExcelImportModal from './trir/TrirExcelImportModal';
import TrirProfessionalChart from './trir/TrirProfessionalChart';
import { 
  downloadTrirExcelTemplate, 
  exportTrirFullExcel, 
  PERSIAN_MONTHS 
} from './trir/trirExcelService';
import { apiDb } from '../services/apiDatabaseClient';
import { isUserAdmin, addAuditLog } from '../utils/authHelper';
import { sortRecordsByYearAndMonth, normalizeForMatching, getJalaliMonthIndex } from '../utils/textNormalization';

interface HseMsManagerProps {
  trirRecords: TrirRecord[];
  onTrirRecordsUpdated: (recs: TrirRecord[]) => void;
  trirTarget: number;
  onTrirTargetUpdated: (target: number) => void;
  language: 'en' | 'fa';
  currentUser?: any;
}

const MONTHS = PERSIAN_MONTHS;

export default function HseMsManager({
  trirRecords,
  onTrirRecordsUpdated,
  trirTarget,
  onTrirTargetUpdated,
  language,
  currentUser
}: HseMsManagerProps) {
  const isFa = language === 'fa';

  // --- Modal States ---
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrirRecord | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Table filtering & search & sorting
  const [tableSearch, setTableSearch] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const [confirmDeleteTrirId, setConfirmDeleteTrirId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'year' | 'month'>('year');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleToggleSort = (field: 'year' | 'month') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Check user administrator permission
  const isAdmin = isUserAdmin(currentUser);

  // --- Target TRIR State & User Confirmation Modal ---
  const [localTargetInput, setLocalTargetInput] = useState<string>(() => trirTarget.toString());
  const [isConfirmTargetModalOpen, setIsConfirmTargetModalOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const [targetToast, setTargetToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Keep local input in sync if trirTarget prop changes from outside
  React.useEffect(() => {
    setLocalTargetInput(trirTarget.toString());
  }, [trirTarget]);

  // Real-time synchronization & immediate live fetch from database on mount
  React.useEffect(() => {
    let isMounted = true;
    
    // Fetch initial TRIR records
    apiDb.getTrirRecords().then((records) => {
      if (isMounted && Array.isArray(records)) {
        onTrirRecordsUpdated(records);
      }
    }).catch(console.error);

    // Fetch initial global workshop target from server
    apiDb.getSetting('trir_target').then((val) => {
      if (isMounted && val !== undefined && val !== null) {
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed > 0 && Math.abs(parsed - trirTarget) > 0.001) {
          onTrirTargetUpdated(parsed);
          setLocalTargetInput(parsed.toString());
        }
      }
    }).catch(console.error);

    const handleSync = () => {
      apiDb.getTrirRecords().then((records) => {
        if (isMounted && Array.isArray(records)) {
          onTrirRecordsUpdated(records);
        }
      }).catch(console.error);

      apiDb.getSetting('trir_target').then((val) => {
        if (isMounted && val !== undefined && val !== null) {
          const parsed = parseFloat(val);
          if (!isNaN(parsed) && parsed > 0 && Math.abs(parsed - trirTarget) > 0.001) {
            onTrirTargetUpdated(parsed);
            setLocalTargetInput(parsed.toString());
          }
        }
      }).catch(console.error);
    };

    const handleTargetChangedEvent = (e: any) => {
      const newTarget = e.detail?.target;
      if (typeof newTarget === 'number' && !isNaN(newTarget) && newTarget > 0) {
        setLocalTargetInput(newTarget.toString());
      }
    };

    window.addEventListener('hse_central_data_synced', handleSync);
    window.addEventListener('hse_data_mutated', handleSync);
    window.addEventListener('app_data_mutated', handleSync);
    window.addEventListener('hse_trir_target_changed', handleTargetChangedEvent);
    return () => {
      isMounted = false;
      window.removeEventListener('hse_central_data_synced', handleSync);
      window.removeEventListener('hse_data_mutated', handleSync);
      window.removeEventListener('app_data_mutated', handleSync);
      window.removeEventListener('hse_trir_target_changed', handleTargetChangedEvent);
    };
  }, [onTrirRecordsUpdated, onTrirTargetUpdated, trirTarget]);

  const handleInitiateTargetChange = (valStr: string) => {
    // 1. Strict Administrator Permission Check
    if (!isAdmin) {
      setLocalTargetInput(trirTarget.toString());
      setTargetToast({
        message: isFa 
          ? 'دسترسی غیرمجاز: تغییر عدد هدف کارگاه منحصراً توسط مدیر سیستم (Administrator) امکان‌پذیر است.' 
          : 'Access Denied: Changing workshop target is strictly restricted to the System Administrator.',
        type: 'error'
      });
      setTimeout(() => setTargetToast(null), 4000);
      return;
    }

    const parsed = parseFloat(valStr);
    if (isNaN(parsed) || parsed <= 0) {
      setLocalTargetInput(trirTarget.toString());
      setTargetToast({
        message: isFa 
          ? 'لطفاً یک عدد مثبت و معتبر برای هدف کارگاه وارد کنید' 
          : 'Please enter a valid positive number for workshop target',
        type: 'error'
      });
      setTimeout(() => setTargetToast(null), 3000);
      return;
    }

    // If identical to current confirmed target, do not show confirmation
    if (Math.abs(parsed - trirTarget) < 0.0001) {
      setLocalTargetInput(trirTarget.toString());
      return;
    }

    // Open warning confirmation modal
    setPendingTarget(parsed);
    setIsConfirmTargetModalOpen(true);
  };

  const handleConfirmTargetChange = () => {
    // Strict Administrator Permission Check
    if (!isAdmin) {
      setLocalTargetInput(trirTarget.toString());
      setIsConfirmTargetModalOpen(false);
      setPendingTarget(null);
      setTargetToast({
        message: isFa 
          ? 'خطا: شما مجوز تغییر هدف کارگاه را ندارید.' 
          : 'Error: You do not have permission to modify the workshop target.',
        type: 'error'
      });
      setTimeout(() => setTargetToast(null), 4000);
      return;
    }

    if (pendingTarget !== null && pendingTarget > 0) {
      const confirmedVal = pendingTarget;
      onTrirTargetUpdated(confirmedVal);
      setLocalTargetInput(confirmedVal.toString());
      setIsConfirmTargetModalOpen(false);
      setPendingTarget(null);

      // Audit Log for global administrative change
      if (currentUser?.username) {
        addAuditLog(
          currentUser.username,
          `تغییر سراسری حد هدف کارگاه TRIR به ${confirmedVal}`,
          'موفقیت‌آمیز',
          {
            module: 'پایش نرخ رویدادها (TRIR)',
            description: `مقدار قبلی: ${trirTarget} - مقدار جدید: ${confirmedVal}`
          }
        );
      }

      setTargetToast({
        message: isFa 
          ? `مقدار هدف کارگاه با موفقیت به ${confirmedVal} تغییر یافت و برای تمامی کاربران در سرور اعمال گردید.` 
          : `Workshop target TRIR was successfully updated to ${confirmedVal} and applied globally for all users.`,
        type: 'success'
      });
      setTimeout(() => setTargetToast(null), 4500);
    }
  };

  const handleCancelTargetChange = () => {
    setLocalTargetInput(trirTarget.toString());
    setIsConfirmTargetModalOpen(false);
    setPendingTarget(null);
  };

  // --- Compute Rolling TRIR series points (Chronological Year -> Month sorted) ---
  const sortedTrirRecords = useMemo(() => {
    return sortRecordsByYearAndMonth(trirRecords, true);
  }, [trirRecords]);

  const computedSeries: TrirSeriesPoint[] = useMemo(() => {
    const series: TrirSeriesPoint[] = [];
    for (let i = 0; i < sortedTrirRecords.length; i++) {
      const rec = sortedTrirRecords[i];
      const att = Number(rec.attendance ?? (rec as any).attendanceHours ?? 0) || 0;
      const mis = Number(rec.mission ?? (rec as any).missionHours ?? 0) || 0;
      const con = Number(rec.contractor ?? (rec as any).contractorHours ?? 0) || 0;
      const inc = Number(rec.incidents ?? (rec as any).recordableIncidents ?? 0) || 0;

      const E = att + mis;
      const totalHours = E + con;
      const rawMonthly = totalHours > 0 ? (inc * 1000000) / totalHours : 0;
      const monthlyTRIR = Number((isNaN(rawMonthly) ? 0 : rawMonthly).toFixed(2));
      
      // Rolling 12 Months: sliding window of up to 12 previous months
      const startIdx = Math.max(0, i - 11);
      let gSum = 0;
      let hSum = 0;
      for (let j = startIdx; j <= i; j++) {
        const r2 = sortedTrirRecords[j];
        const r2Att = Number(r2.attendance ?? (r2 as any).attendanceHours ?? 0) || 0;
        const r2Mis = Number(r2.mission ?? (r2 as any).missionHours ?? 0) || 0;
        const r2Con = Number(r2.contractor ?? (r2 as any).contractorHours ?? 0) || 0;
        gSum += Number(r2.incidents ?? (r2 as any).recordableIncidents ?? 0) || 0;
        hSum += (r2Att + r2Mis + r2Con);
      }
      const rawRolling = hSum > 0 ? (gSum * 1000000) / hSum : 0;
      const rollingTRIR = Number((isNaN(rawRolling) ? 0 : rawRolling).toFixed(2));
      const monthsInWindow = i - startIdx + 1;

      series.push({
        ...rec,
        attendance: att,
        mission: mis,
        contractor: con,
        incidents: inc,
        E,
        totalHours,
        monthlyTRIR,
        rollingTRIR,
        monthsInWindow,
        label: `${rec.month} ${rec.year}`
      });
    }
    return series;
  }, [sortedTrirRecords]);

  const lastTrirPoint = computedSeries[computedSeries.length - 1];

  // Helper to get TRIR rating with guaranteed production styles & color codes
  const getTrirStatus = (rawVal: number) => {
    const val = (rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal))) ? Number(rawVal) : 0;
    const target = (typeof trirTarget === 'number' && trirTarget > 0) ? trirTarget : 1.5;

    if (val <= target * 0.8) {
      return {
        level: 'safe' as const,
        cls: 'trir-badge-safe text-emerald-700 bg-emerald-50 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-700',
        rowCls: 'trir-row-safe hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20',
        rowStyle: { borderRight: '4px solid #10b981' },
        cellStyle: { color: '#047857', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
        dotColor: '#10b981',
        badgeBg: '#ecfdf5',
        badgeBorder: '#a7f3d0',
        textColor: '#047857',
        text: isFa ? 'ایمن و مطلوب' : 'Safe',
        shortText: isFa ? 'ایمن' : 'Safe',
        desc: isFa ? `کمتر از ۸۰٪ هدف (≤ ${Number(target * 0.8).toFixed(2)})` : `≤ ${Number(target * 0.8).toFixed(2)}`
      };
    }
    if (val <= target * 1.15) {
      return {
        level: 'warning' as const,
        cls: 'trir-badge-warning text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-700',
        rowCls: 'trir-row-warning hover:bg-amber-50/30 dark:hover:bg-amber-950/20',
        rowStyle: { borderRight: '4px solid #f59e0b' },
        cellStyle: { color: '#b45309', backgroundColor: '#fffbeb', borderColor: '#fde68a' },
        dotColor: '#f59e0b',
        badgeBg: '#fffbeb',
        badgeBorder: '#fde68a',
        textColor: '#b45309',
        text: isFa ? 'نزدیک به هدف (هشدار)' : 'Near Target (Warning)',
        shortText: isFa ? 'هشدار' : 'Warning',
        desc: isFa ? `بین ۸۰٪ تا ۱۱۵٪ هدف (${Number(target * 0.8).toFixed(2)} تا ${Number(target * 1.15).toFixed(2)})` : `Within target band`
      };
    }
    return {
      level: 'danger' as const,
      cls: 'trir-badge-danger text-red-700 bg-red-50 border-red-300 dark:text-red-300 dark:bg-red-950/50 dark:border-red-700',
      rowCls: 'trir-row-danger bg-red-50/20 dark:bg-red-950/15 hover:bg-red-50/50 dark:hover:bg-red-950/30',
      rowStyle: { borderRight: '4px solid #ef4444' },
      cellStyle: { color: '#b91c1c', backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
      dotColor: '#ef4444',
      badgeBg: '#fef2f2',
      badgeBorder: '#fca5a5',
      textColor: '#b91c1c',
      text: isFa ? 'فراتر از هدف (بحرانی)' : 'Critical / Exceeded',
      shortText: isFa ? 'بحرانی' : 'Critical',
      desc: isFa ? `بیشتر از ۱۱۵٪ هدف (> ${Number(target * 1.15).toFixed(2)})` : `> ${Number(target * 1.15).toFixed(2)}`
    };
  };

  // --- Handlers for Record Modal ---
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setIsRecordModalOpen(true);
  };

  const handleOpenEditModal = (rec: TrirRecord) => {
    if (currentUser?.role && currentUser.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ویرایش اطلاعات را دارد.' : 'Only the main Administrator is authorized to edit records.');
      return;
    }
    setEditingRecord(rec);
    setIsRecordModalOpen(true);
  };

  const handleSaveRecord = async (recData: Omit<TrirRecord, 'id'>, editId?: string) => {
    let updatedList: TrirRecord[];
    let targetRecord: TrirRecord;

    if (editId) {
      targetRecord = {
        ...recData,
        id: editId
      };
      updatedList = trirRecords.map(r => r.id === editId ? targetRecord : r);
    } else {
      // Check if a record with the same (year, month) already exists to prevent duplicate entries
      const normNewMonth = normalizeForMatching(recData.month);
      const existingIdx = trirRecords.findIndex(r => r.year === recData.year && (normalizeForMatching(r.month) === normNewMonth || r.month === recData.month));

      if (existingIdx >= 0) {
        targetRecord = {
          ...recData,
          id: trirRecords[existingIdx].id
        };
        updatedList = [...trirRecords];
        updatedList[existingIdx] = targetRecord;
      } else {
        targetRecord = {
          ...recData,
          id: 'tr' + Math.random().toString(36).slice(2, 9)
        };
        updatedList = [...trirRecords, targetRecord];
      }
    }

    onTrirRecordsUpdated(updatedList);

    try {
      const saved = await apiDb.saveTrirRecord(targetRecord);
      if (saved && saved.id) {
        const withRealId = updatedList.map(r => 
          (r.id === targetRecord.id || (r.year === targetRecord.year && r.month === targetRecord.month)) 
            ? { ...r, id: String(saved.id) } 
            : r
        );
        onTrirRecordsUpdated(withRealId);
      }
    } catch (e) {
      console.error('Failed to save TRIR record:', e);
    }
  };

  const isAdminOrManager = useMemo(() => {
    if (!currentUser) return true;
    const role = (currentUser.role || '').toUpperCase().replace(/\s+|_/g, '');
    return role === 'ADMIN' || role === 'ADMINISTRATOR' || role === 'HSEMANAGER' || role === 'SAFETYOFFICER' || role === 'SUPERVISOR';
  }, [currentUser]);

  const handleDeleteRecord = async (id: string) => {
    if (!isAdminOrManager) {
      setTargetToast({
        type: 'error',
        message: isFa ? 'تنها مدیران ارشد و کارشناسان HSE مجاز به حذف آمار می‌باشند.' : 'Only administrators and HSE managers can delete records.'
      });
      return;
    }
    const targetRec = trirRecords.find(r => String(r.id) === String(id));
    const targetYear = targetRec?.year;
    const targetMonth = targetRec?.month;
    const normTargetMonth = targetMonth ? normalizeForMatching(targetMonth) : '';

    const updatedList = trirRecords.filter(r => {
      if (String(r.id) === String(id)) return false;
      if (targetYear && normTargetMonth && r.year === targetYear && normalizeForMatching(r.month) === normTargetMonth) return false;
      return true;
    });

    onTrirRecordsUpdated(updatedList);
    setConfirmDeleteTrirId(null);
    try {
      await apiDb.deleteTrirRecord(id, targetYear, targetMonth);
      try {
        localStorage.removeItem('hse_trir_records_backup');
        localStorage.removeItem('hse_trir_records_v3');
        localStorage.removeItem('trir_records');
      } catch (_) {}

      // Refresh authoritative list from server
      const fresh = await apiDb.getTrirRecords();
      if (Array.isArray(fresh)) {
        onTrirRecordsUpdated(fresh);
      }

      setTargetToast({
        type: 'success',
        message: isFa ? 'رکورد با موفقیت و به صورت دائمی حذف گردید.' : 'Record deleted permanently from database.'
      });
    } catch (e) {
      console.error('Failed to delete TRIR record:', e);
      setTargetToast({
        type: 'error',
        message: isFa ? 'خطا در حذف رکورد از سرور' : 'Failed to delete record from server'
      });
    }
  };

  const handleClearAllRecords = async () => {
    if (!isAdminOrManager) {
      setTargetToast({
        type: 'error',
        message: isFa ? 'تنها مدیر سیستم مجاز به حذف کلی اطلاعات می‌باشد.' : 'Only admin can clear all records.'
      });
      return;
    }
    if (!window.confirm(isFa ? 'آیا از حذف کلیه رکوردهای دفتر ثبت آمار اطمینان دارید؟ این عمل غیرقابل بازگشت است و تمام رکوردها برای همیشه حذف خواهند شد.' : 'Are you sure you want to delete ALL records permanently?')) {
      return;
    }
    onTrirRecordsUpdated([]);
    try {
      await apiDb.clearAllTrirRecords();
      try {
        localStorage.removeItem('hse_trir_records_backup');
        localStorage.removeItem('hse_trir_records_v3');
        localStorage.removeItem('trir_records');
      } catch (_) {}

      const fresh = await apiDb.getTrirRecords();
      onTrirRecordsUpdated(Array.isArray(fresh) ? fresh : []);

      setTargetToast({
        type: 'success',
        message: isFa ? 'کلیه رکوردهای دفتر آمار با موفقیت و برای همیشه از پایگاه داده حذف شدند.' : 'All TRIR records cleared permanently.'
      });
    } catch (e) {
      console.error('Failed to clear all records:', e);
      setTargetToast({
        type: 'error',
        message: isFa ? 'خطا در پاکسازی رکوردها' : 'Failed to clear records'
      });
    }
  };

  // --- Deduplication of TRIR Records ---
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  const duplicateCountInState = useMemo(() => {
    const seen = new Set<string>();
    let dups = 0;
    trirRecords.forEach(r => {
      const key = `${r.year}-${normalizeForMatching(r.month)}`;
      if (seen.has(key)) dups++;
      else seen.add(key);
    });
    return dups;
  }, [trirRecords]);

  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      const removedCount = await apiDb.deduplicateTrirRecords();
      const freshRecords = await apiDb.getTrirRecords();
      onTrirRecordsUpdated(freshRecords);
      setTargetToast({
        type: 'success',
        message: isFa 
          ? (removedCount > 0 ? `تعداد ${removedCount} سطر تکراری با موفقیت حذف گردید.` : 'هیچ سطر تکراری در دفتر آمار یافت نشد (داده‌ها کاملاً یکتا هستند).')
          : (removedCount > 0 ? `${removedCount} duplicate rows removed successfully.` : 'No duplicate rows found.')
      });
    } catch (e) {
      console.error('Failed to deduplicate:', e);
      setTargetToast({
        type: 'error',
        message: isFa ? 'خطا در حذف سطرهای تکراری' : 'Failed to deduplicate records'
      });
    } finally {
      setIsDeduplicating(false);
    }
  };

  // --- PDF Export ---
  const handleExportTrirPDF = () => {
    const jspdf_ = (window as any).jspdf;
    if (!jspdf_) {
      alert(isFa ? "کتابخانه PDF در حال بارگذاری است... لطفاً چند لحظه دیگر مجدداً کلیک فرمایید." : "PDF library is loading... Please wait.");
      return;
    }
    const doc = new jspdf_.jsPDF({ orientation: 'landscape' });
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text('HSE TRIR Monthly Performance & Incident Report', 14, 16);
    doc.setFontSize(10);
    doc.text('Generated: ' + new Date().toLocaleString() + ` | Target: ${trirTarget.toFixed(2)}`, 14, 23);
    
    let y = 35;
    doc.setFontSize(8);
    // Header
    doc.text('Month | Year | Attendance | Mission | E | Contractor | Incidents | Monthly TRIR | 12M Rolling TRIR | Notes', 14, y);
    y += 4;
    doc.line(14, y, 280, y);
    y += 6;

    computedSeries.slice().reverse().forEach((r) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      
      const att = r.attendance.toLocaleString('en-US');
      const mis = r.mission.toLocaleString('en-US');
      const e = r.E.toLocaleString('en-US');
      const con = r.contractor.toLocaleString('en-US');
      const monTrir = (!isNaN(r.monthlyTRIR) ? r.monthlyTRIR : 0).toFixed(3);
      const rolTrir = (!isNaN(r.rollingTRIR) ? r.rollingTRIR : 0).toFixed(3);
      const notes = r.notes ? `(${r.notes.slice(0, 25)})` : '';
      
      const rowStr = `${r.month} | ${r.year} | ${att} | ${mis} | ${e} | ${con} | ${r.incidents} | ${monTrir} | ${rolTrir} | ${notes}`;
      doc.text(rowStr, 14, y);
      y += 5;
    });

    doc.save('HSE_TRIR_Monthly_Report.pdf');
  };

  // Available unique years in records for filtering
  const availableYears = useMemo(() => {
    const yrs = Array.from(new Set(trirRecords.map(r => r.year))).sort((a, b) => b - a);
    return yrs;
  }, [trirRecords]);

  // Filtered table rows with year/month sorting
  const filteredTableRows = useMemo(() => {
    const list = computedSeries.filter(r => {
      if (selectedYearFilter !== 'all' && String(r.year) !== selectedYearFilter) {
        return false;
      }
      if (tableSearch.trim()) {
        const q = tableSearch.trim().toLowerCase();
        const monthMatch = r.month.toLowerCase().includes(q);
        const yearMatch = String(r.year).includes(q);
        const noteMatch = r.notes?.toLowerCase().includes(q) || false;
        return monthMatch || yearMatch || noteMatch;
      }
      return true;
    });

    if (sortField === 'year') {
      return [...list].sort((a, b) => {
        const diff = a.year - b.year;
        if (diff !== 0) {
          return sortOrder === 'asc' ? diff : -diff;
        }
        // Sub-sort by calendar month
        const mA = getJalaliMonthIndex(a.month);
        const mB = getJalaliMonthIndex(b.month);
        return sortOrder === 'asc' ? mA - mB : mB - mA;
      });
    }

    if (sortField === 'month') {
      return [...list].sort((a, b) => {
        const mA = getJalaliMonthIndex(a.month);
        const mB = getJalaliMonthIndex(b.month);
        if (mA !== mB) {
          return sortOrder === 'asc' ? mA - mB : mB - mA;
        }
        return sortOrder === 'asc' ? a.year - b.year : b.year - a.year;
      });
    }

    return list;
  }, [computedSeries, selectedYearFilter, tableSearch, sortField, sortOrder]);

  const fmtInt = (n: number | undefined) => {
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString('en-US');
  };

  return (
    <div className="space-y-6" id="hse-ms-container">
      
      {/* Modals */}
      <TrirRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveRecord}
        editingRecord={editingRecord}
        existingRecords={trirRecords}
        trirTarget={trirTarget}
        isFa={isFa}
      />

      <TrirExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        existingRecords={trirRecords}
        onImport={async (imported, mode) => {
          try {
            if (mode === 'replace') {
              await apiDb.clearAllTrirRecords();
            }
            await apiDb.saveTrirBatch(imported);
            const fresh = await apiDb.getTrirRecords();
            onTrirRecordsUpdated(Array.isArray(fresh) ? fresh : imported);
          } catch (err) {
            console.error('Error importing TRIR excel:', err);
            onTrirRecordsUpdated(imported);
          }
        }}
        isFa={isFa}
      />

      {/* Target TRIR Change Warning & Confirmation Modal */}
      {isConfirmTargetModalOpen && pendingTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-amber-500/10 text-right space-y-5"
            dir={isFa ? 'rtl' : 'ltr'}
          >
            {/* Header & Warning Icon */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'اخطار تغییر حد هدف کارگاه (Target TRIR)' : 'Warning: Change Workshop Target TRIR'}
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  {isFa ? 'این اقدام نیازمند تایید مستقیم شما می‌باشد' : 'This action requires explicit user confirmation'}
                </p>
              </div>
            </div>

            {/* Explanation Note */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
              <p>
                {isFa ? (
                  <>
                    توجه: تغییر دادن عدد هدف کارگاه، مستقیماً بر روی <strong>محاسبه وضعیت ایمنی تمامی ماه‌ها</strong>، 
                    <strong> نمودارهای تحلیل روند ۱۲ ماهه رولینگ</strong>، 
                    <strong> آستانه‌های وضعیت بحرانی/هشدار</strong> و 
                    <strong> گزارشات کل سامانه</strong> برای <strong>تمامی کاربران</strong> اعمال و در پایگاه داده سامانه ذخیره می‌شود.
                  </>
                ) : (
                  <>
                    Caution: Modifying the workshop target will immediately recalculate <strong>monthly safety statuses</strong>, 
                    <strong> 12-month rolling trend charts</strong>, 
                    <strong> critical alert thresholds</strong>, and 
                    <strong> all system reports</strong> for <strong>all users</strong> in system database.
                  </>
                )}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 pt-1 border-t border-amber-200/50 dark:border-amber-800/40">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isFa 
                    ? `تغییرات با نام کاربری مدیر سیستم (${currentUser?.fullName || currentUser?.username || 'مدیر'}) ثبت و در سطح سامانه همگام‌سازی خواهد شد.`
                    : `Changes will be saved and synchronized system-wide under Administrator profile.`}
                </span>
              </div>
            </div>

            {/* Value Comparison */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-400 block font-medium">
                  {isFa ? 'هدف کارگاه فعلی' : 'Current Target'}
                </span>
                <span className="text-lg font-mono font-black text-slate-700 dark:text-slate-200">
                  {trirTarget.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-700">
                <span className="text-[11px] text-amber-700 dark:text-amber-300 block font-medium">
                  {isFa ? 'هدف کارگاه جدید پیشنهادی' : 'New Proposed Target'}
                </span>
                <span className="text-lg font-mono font-black text-amber-600 dark:text-amber-400">
                  {pendingTarget.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {isFa 
                ? 'آیا از تایید و ذخیره دائمی این عدد برای هدف کارگاه اطمینان دارید؟' 
                : 'Are you sure you want to permanently apply and save this new target?'}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCancelTargetChange}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {isFa ? 'انصراف و بازگشت' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmTargetChange}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-black shadow-md shadow-amber-500/25 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isFa ? 'تایید و تغییر هدف کارگاه' : 'Confirm & Apply Target'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {targetToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-300" dir={isFa ? 'rtl' : 'ltr'}>
          {targetToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {targetToast.message}
          </span>
        </div>
      )}

      {/* Header Panel with Target Setter & Primary Action Buttons */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shadow-amber-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'دفتر پایش نرخ رویدادهای ایمنی (TRIR)' : 'Incident Rates (TRIR) Ledger'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {isFa ? 'پایش استاندارد ساعات کارکرد، رویدادهای شغلی و تحلیل رولینگ ۱۲ ماهه بر اساس ضابطه OSHA' : 'Standard OSHA-based man-hours & rolling 12-month TRIR monitoring'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Target TRIR Setting */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              {!isAdmin && (
                <span title={isFa ? 'ویژه مدیر سیستم' : 'Admin only'} className="inline-flex items-center">
                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                </span>
              )}
              <span>{isFa ? 'هدف کارگاه:' : 'Target:'}</span>
            </span>
            <div className="relative flex items-center gap-1.5">
              <input 
                type="number"
                step="0.05"
                min="0.1"
                disabled={!isAdmin}
                readOnly={!isAdmin}
                value={localTargetInput}
                onChange={(e) => {
                  if (isAdmin) setLocalTargetInput(e.target.value);
                }}
                onBlur={() => {
                  if (isAdmin && localTargetInput !== trirTarget.toString()) {
                    handleInitiateTargetChange(localTargetInput);
                  }
                }}
                onKeyDown={(e) => {
                  if (!isAdmin) return;
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setLocalTargetInput(trirTarget.toString());
                  }
                }}
                className={`w-16 border rounded-lg p-1 text-center font-mono text-xs font-black transition-all focus:outline-none ${
                  !isAdmin
                    ? 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none'
                    : localTargetInput !== trirTarget.toString()
                    ? 'bg-white dark:bg-slate-900 border-amber-500 text-amber-600 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-amber-600'
                }`}
                title={
                  !isAdmin
                    ? (isFa ? 'هدف کارگاه سراسری است و صرفاً توسط مدیر سیستم (Administrator) قابل تغییر می‌باشد.' : 'Workshop target is system-wide and can only be modified by the Administrator.')
                    : (isFa ? 'برای تغییر مقدار وارد نمایید (نیازمند تایید و ذخیره)' : 'Enter target value (requires confirmation)')
                }
              />
              {isAdmin && localTargetInput !== trirTarget.toString() && (
                <button
                  type="button"
                  onClick={() => handleInitiateTargetChange(localTargetInput)}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-md text-[10px] font-black shadow-xs cursor-pointer transition-all animate-in fade-in"
                  title={isFa ? 'تایید و بررسی تغییر' : 'Apply change'}
                >
                  {isFa ? 'تایید' : 'Apply'}
                </button>
              )}
            </div>
            {!isAdmin && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold hidden sm:inline-block">
                {isFa ? 'ویژه مدیر' : 'Admin Only'}
              </span>
            )}
          </div>

          {/* Deduplicate TRIR Records Button */}
          <button
            type="button"
            onClick={handleDeduplicate}
            disabled={isDeduplicating}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs cursor-pointer ${
              duplicateCountInState > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700/60'
            }`}
            title={isFa ? 'شناسایی و حذف سطرهای تکراری بر اساس سال و ماه' : 'Deduplicate rows by year and month'}
          >
            <Sparkles className={`w-4 h-4 ${isDeduplicating ? 'animate-spin text-amber-500' : 'text-amber-500'}`} />
            <span>{isFa ? 'حذف سطرهای تکراری' : 'Deduplicate Rows'}</span>
            {duplicateCountInState > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-mono font-bold">
                {duplicateCountInState}
              </span>
            )}
          </button>

          {/* Download Sample Excel Template */}
          <button
            onClick={downloadTrirExcelTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700/80 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-700/60 transition-colors shadow-2xs cursor-pointer"
            title={isFa ? 'دانلود شابلون اکسل نمونه جهت ورود آسان داده‌ها' : 'Download sample Excel template'}
          >
            <FileDown className="w-4 h-4" />
            <span>{isFa ? 'دانلود اکسل نمونه' : 'Sample Excel'}</span>
          </button>

          {/* Import from Excel Modal Trigger */}
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            title={isFa ? 'ورود دسته‌جمعی داده‌ها از طریق فایل اکسل' : 'Import from Excel file'}
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isFa ? 'ورود اطلاعات از اکسل' : 'Import Excel'}</span>
          </button>

          {/* Primary Create New Record Modal Trigger */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت آمار کارکرد جدید' : 'New Monthly Record'}</span>
          </button>

        </div>

      </div>

      {/* Top 4 KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="trir-metrics-cards">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-slate-400 text-xs font-bold">{isFa ? 'آخرین TRIR ماهیانه' : 'Last Monthly TRIR'}</span>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black font-mono text-slate-800 dark:text-slate-100">
              {lastTrirPoint ? (!isNaN(lastTrirPoint.monthlyTRIR) ? lastTrirPoint.monthlyTRIR : 0).toFixed(2) : '—'}
            </h4>
            {lastTrirPoint && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTrirStatus(lastTrirPoint.monthlyTRIR).cls}`}>
                {getTrirStatus(lastTrirPoint.monthlyTRIR).text}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">{isFa ? 'فرمول: (حوادث ماه × ۱,۰۰۰,۰۰۰) ÷ ساعت ماه' : 'Based on 1M man-hours'}</p>
        </div>

        <div 
          className={`p-5 rounded-2xl border shadow-sm space-y-1 transition-all ${
            lastTrirPoint ? getTrirStatus(lastTrirPoint.rollingTRIR).rowCls : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
          style={lastTrirPoint ? { borderRight: `4px solid ${getTrirStatus(lastTrirPoint.rollingTRIR).dotColor}` } : {}}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">{isFa ? 'نرخ TRIR رولینگ ۱۲ ماهه' : 'Rolling 12M TRIR'}</span>
            {lastTrirPoint && (
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: getTrirStatus(lastTrirPoint.rollingTRIR).dotColor }} 
              />
            )}
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <h4 
              className="text-2xl font-black font-mono"
              style={lastTrirPoint ? { color: getTrirStatus(lastTrirPoint.rollingTRIR).textColor } : { color: '#f59e0b' }}
            >
              {lastTrirPoint ? (!isNaN(lastTrirPoint.rollingTRIR) ? lastTrirPoint.rollingTRIR : 0).toFixed(2) : '—'}
            </h4>
            {lastTrirPoint && (
              <span 
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${getTrirStatus(lastTrirPoint.rollingTRIR).cls}`}
                style={{
                  color: getTrirStatus(lastTrirPoint.rollingTRIR).textColor,
                  backgroundColor: getTrirStatus(lastTrirPoint.rollingTRIR).badgeBg,
                  borderColor: getTrirStatus(lastTrirPoint.rollingTRIR).badgeBorder
                }}
              >
                {getTrirStatus(lastTrirPoint.rollingTRIR).text}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">{isFa ? `هدف کارگاه: ${trirTarget.toFixed(2)}` : `Target: ${trirTarget.toFixed(2)}`}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-slate-400 text-xs font-bold">{isFa ? 'کل کارکرد تجمعی (ساعت)' : 'Total Cumulative Hours'}</span>
          <h4 className="text-2xl font-black font-mono text-slate-800 dark:text-slate-100">
            {fmtInt(computedSeries.reduce((acc, c) => acc + c.totalHours, 0))}
          </h4>
          <p className="text-[10px] text-slate-400">{isFa ? 'پرسنل مستقیم + ماموریت + پیمانکاران' : 'Personnel & contractor sum'}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-slate-400 text-xs font-bold">{isFa ? 'کل حوادث قابل ثبت LTI' : 'Total Recordable Incidents'}</span>
          <h4 className="text-2xl font-black font-mono text-red-500">
            {fmtInt(computedSeries.reduce((acc, c) => acc + c.incidents, 0))}
          </h4>
          <p className="text-[10px] text-slate-400">{isFa ? 'وقایع منجر به از دست رفتن زمان کاری' : 'Lost-time injury cases'}</p>
        </div>
      </div>

      {/* Professional & Customizable TRIR Chart */}
      <TrirProfessionalChart 
        data={computedSeries}
        trirTarget={trirTarget}
        onTrirTargetChange={onTrirTargetUpdated}
        isFa={isFa}
      />

      {/* Registered Man-hours & Incident Registry Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4" id="trir-registry-section">
        
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-0.5">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
              {isFa ? 'دفتر ثبت آمار کارکرد و حوادث ماهانه' : 'Monthly Man-hours & Incident Registry'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isFa ? `${computedSeries.length} رکورد ماهانه ثبت شده در سامانه` : `${computedSeries.length} total monthly records recorded`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* Year Filter */}
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">{isFa ? 'همه سال‌ها' : 'All Years'}</option>
              {availableYears.map(yr => (
                <option key={yr} value={String(yr)}>{yr}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                placeholder={isFa ? 'جستجوی ماه، سال یا یادداشت...' : 'Search...'}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 pr-8 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            </div>

            {/* Quick action buttons */}
            <button 
              onClick={() => exportTrirFullExcel(computedSeries, trirTarget)}
              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/80 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={isFa ? 'خروجی فایل اکسل کامل' : 'Export Excel'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isFa ? 'خروجی اکسل' : 'Excel'}</span>
            </button>

            <button 
              onClick={handleExportTrirPDF}
              className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 rounded-xl text-xs font-bold border border-sky-200 dark:border-sky-800/80 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={isFa ? 'خروجی PDF' : 'Export PDF'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            {/* Deduplicate Action */}
            {duplicateCountInState > 0 && (
              <button 
                onClick={handleDeduplicate}
                disabled={isDeduplicating}
                className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                title={isFa ? 'حذف سطرهای تکراری ماهانه' : 'Deduplicate records'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeduplicating ? (isFa ? 'در حال پاکسازی...' : 'Cleaning...') : (isFa ? `حذف تکراری‌ها (${duplicateCountInState})` : 'Deduplicate')}</span>
              </button>
            )}

            {/* Clear All Action (Admin Only) */}
            {isAdminOrManager && trirRecords.length > 0 && (
              <button 
                onClick={handleClearAllRecords}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl text-xs font-bold border border-red-200 dark:border-red-800/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                title={isFa ? 'حذف کلیه رکوردهای دفتر آمار' : 'Clear All Records'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'پاکسازی کلی دفتر' : 'Clear All'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Guaranteed Color Coding Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-black">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>{isFa ? 'راهنمای رنگ‌بندی ردیف‌های TRIR رولینگ ۱۲ ماهه:' : '12M Rolling TRIR Status Color Code:'}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black trir-badge-safe" style={{ color: '#047857', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#10b981' }} />
              <span>{isFa ? `ایمن و مطلوب (≤ ${Number(trirTarget * 0.8).toFixed(2)})` : `Safe (≤ ${Number(trirTarget * 0.8).toFixed(2)})`}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black trir-badge-warning" style={{ color: '#b45309', backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} />
              <span>{isFa ? `نزدیک به هدف / هشدار (${Number(trirTarget * 0.8).toFixed(2)} تا ${Number(trirTarget * 1.15).toFixed(2)})` : `Warning`}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black trir-badge-danger" style={{ color: '#b91c1c', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#ef4444' }} />
              <span>{isFa ? `فراتر از هدف / بحرانی (> ${Number(trirTarget * 1.15).toFixed(2)})` : `Critical (> ${Number(trirTarget * 1.15).toFixed(2)})`}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">
              {isFa ? `حد هدف کارگاه: ${trirTarget.toFixed(2)}` : `Workshop Target: ${trirTarget.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto text-xs" id="trir-registry-table">
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold bg-slate-50/50 dark:bg-slate-800/30 select-none">
                  <th className="p-3 text-right">#</th>
                  
                  {/* Distinct Year Column with Interactive Sort */}
                  <th 
                    onClick={() => handleToggleSort('year')}
                    className="p-3 text-center cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors group"
                    title={isFa ? `مرتب‌سازی بر اساس سال (${sortField === 'year' && sortOrder === 'asc' ? 'صعودی' : 'نزولی'})` : 'Sort by Year'}
                  >
                    <div className="inline-flex items-center justify-center gap-1.5 font-black text-slate-700 dark:text-slate-200">
                      <span>{isFa ? 'سال' : 'Year'}</span>
                      {sortField === 'year' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-500 font-black shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-500 font-black shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />
                      )}
                    </div>
                  </th>

                  {/* Distinct Month Column */}
                  <th 
                    onClick={() => handleToggleSort('month')}
                    className="p-3 text-center cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors group"
                    title={isFa ? `مرتب‌سازی بر اساس ماه (${sortField === 'month' && sortOrder === 'asc' ? 'صعودی' : 'نزولی'})` : 'Sort by Month'}
                  >
                    <div className="inline-flex items-center justify-center gap-1.5 font-black text-slate-700 dark:text-slate-200">
                      <span>{isFa ? 'ماه' : 'Month'}</span>
                      {sortField === 'month' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-500 font-black shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-500 font-black shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors shrink-0 opacity-40 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th className="p-3 text-right">{isFa ? 'حضور پرسنل (ساعت)' : 'Attendance'}</th>
                  <th className="p-3 text-right">{isFa ? 'ماموریت (ساعت)' : 'Mission'}</th>
                  <th className="p-3 text-right">{isFa ? 'پیمانکاران (ساعت)' : 'Contractors'}</th>
                  <th className="p-3 text-right font-black text-slate-700 dark:text-slate-200">{isFa ? 'مجموع کارکرد' : 'Total'}</th>
                  <th className="p-3 text-center text-red-500 font-black">{isFa ? 'حوادث LTI' : 'LTI'}</th>
                  <th className="p-3 text-center text-sky-600 font-bold">{isFa ? 'TRIR ماهیانه' : 'Monthly TRIR'}</th>
                  <th className="p-3 text-center font-black text-slate-800 dark:text-slate-100 bg-amber-500/10 dark:bg-amber-500/15 border-x border-amber-300/40 dark:border-amber-700/40">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                      <span>{isFa ? 'TRIR رولینگ ۱۲ ماهه' : 'Rolling 12M TRIR'}</span>
                    </div>
                  </th>
                  <th className="p-3 text-right">{isFa ? 'یادداشت / توضیحات' : 'Notes'}</th>
                  <th className="p-3 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                {filteredTableRows.map((r, idx) => {
                  const rolStatus = getTrirStatus(r.rollingTRIR);
                  return (
                    <tr 
                      key={r.id} 
                      className={`transition-colors duration-150 ${rolStatus.rowCls} ${
                        confirmDeleteTrirId === r.id ? 'bg-red-50 dark:bg-red-950/30' : ''
                      }`}
                      style={rolStatus.rowStyle}
                    >
                      <td className="p-3 text-right font-mono text-slate-400">{sortOrder === 'asc' ? (idx + 1) : (filteredTableRows.length - idx)}</td>
                      
                      {/* Separate Year Cell */}
                      <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-100 font-mono">
                        <span className="inline-block bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md text-xs font-mono font-bold border border-slate-200 dark:border-slate-700">
                          {r.year}
                        </span>
                      </td>

                      {/* Separate Month Cell */}
                      <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {r.month}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{fmtInt(r.attendance)}</td>
                      <td className="p-3 text-right font-mono">{fmtInt(r.mission)}</td>
                      <td className="p-3 text-right font-mono">{fmtInt(r.contractor)}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">{fmtInt(r.totalHours)}</td>
                      <td className="p-3 text-center font-mono font-black">
                        <span className={`px-2 py-0.5 rounded-md ${r.incidents > 0 ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                          {r.incidents}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-sky-600 dark:text-sky-400 font-bold">
                        {(!isNaN(r.monthlyTRIR) ? r.monthlyTRIR : 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center bg-slate-50/40 dark:bg-slate-800/30 border-x border-slate-100 dark:border-slate-800/50">
                        <div 
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black border shadow-xs ${rolStatus.cls}`}
                          style={{
                            color: rolStatus.textColor,
                            backgroundColor: rolStatus.badgeBg,
                            borderColor: rolStatus.badgeBorder
                          }}
                          title={`${isFa ? 'وضعیت شاخص:' : 'Status:'} ${rolStatus.text} (${rolStatus.desc})`}
                        >
                          <span 
                            className="w-2 h-2 rounded-full inline-block flex-shrink-0" 
                            style={{ backgroundColor: rolStatus.dotColor }} 
                          />
                          <span className="font-mono text-sm tracking-tight font-black">
                            {(!isNaN(r.rollingTRIR) ? r.rollingTRIR : 0).toFixed(2)}
                          </span>
                          <span 
                            className="text-[10px] font-sans font-black px-1.5 py-0.5 rounded-sm"
                            style={{ 
                              backgroundColor: rolStatus.dotColor + '22',
                              color: rolStatus.textColor 
                            }}
                          >
                            {rolStatus.shortText}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-[11px] text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={r.notes}>
                        {r.notes || '—'}
                      </td>
                      <td className="p-3 text-center">
                        {confirmDeleteTrirId === r.id ? (
                          <div className="flex gap-1.5 justify-center items-center">
                            <button 
                              onClick={() => handleDeleteRecord(r.id)} 
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              {isFa ? 'تایید' : 'OK'}
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteTrirId(null)} 
                              className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[11px] cursor-pointer"
                            >
                              {isFa ? 'لغو' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-center items-center">
                            <button 
                              onClick={() => handleOpenEditModal(r)} 
                              className="p-1.5 text-sky-500 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title={isFa ? 'ویرایش این رکورد در پنجره جداگانه' : 'Edit record in modal'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteTrirId(r.id)} 
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title={isFa ? 'حذف این رکورد' : 'Delete record'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTableRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Calendar className="w-6 h-6 text-slate-300 stroke-1" />
                        <span>{isFa ? 'رکوردی مطابق با فیلتر جستجو یافت نشد.' : 'No records found matching filter.'}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}

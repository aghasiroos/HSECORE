import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile, PpeItem, PpeIssuanceRecord, OshaPpeCategory } from '../types';
import { getUnits, translatePpeNameToEn } from '../utils/orgHelper';
import { downloadCsvFile } from '../utils/fileHelpers';
import { findPersonnelByCode, getComplexPersonnelList } from '../utils/personnelHelper';
import { getSystemUsers } from '../utils/authHelper';
import CentralPersonnelSelector from './CentralPersonnelSelector';
import PersianDatePicker from './common/PersianDatePicker';
import DualDateBadge from './common/DualDateBadge';
import {
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Clock,
  CheckCircle2,
  HardHat,
  Glasses,
  FileText,
  Info,
  Award,
  Pencil,
  Trash2,
  Eye,
  Send,
  History
} from 'lucide-react';
import { CreateReferralModal } from './referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from './referral/DocumentWorkflowTrackerModal';
import { PrintDocumentSignaturesBox } from './referral/PrintDocumentSignaturesBox';
import { printService } from '../services/printService';
import { apiDb } from '../services/apiDatabaseClient';

interface PpeManagementProps {
  isFa: boolean;
  currentUser: UserProfile;
}

// Initial Sample Seed Data for PPE Catalog according to OSHA
const INITIAL_PPE_ITEMS: PpeItem[] = [];

// Initial Sample Seed Data for Issuance Ledger
const INITIAL_ISSUANCE_RECORDS: PpeIssuanceRecord[] = [];

export default function PpeManagement({ isFa, currentUser }: PpeManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<'issuance' | 'catalog' | 'osha_guide' | 'inspections'>('issuance');

  // State collections
  const [ppeItems, setPpeItems] = useState<PpeItem[]>([]);
  const [issuanceRecords, setIssuanceRecords] = useState<PpeIssuanceRecord[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);

  // Centralized database synchronization & Real-time listeners
  const loadPpeDataFromDb = useCallback(async () => {
    try {
      const [dbItems, dbIssuance, dbCats] = await Promise.all([
        apiDb.getPpeItems(),
        apiDb.getPpeIssuance(),
        apiDb.getPpeCategories()
      ]);

      if (Array.isArray(dbItems)) {
        setPpeItems(dbItems);
      }
      if (Array.isArray(dbIssuance)) {
        setIssuanceRecords(dbIssuance);
      }
      if (Array.isArray(dbCats)) {
        setCustomCategories(dbCats);
      }
    } catch (err) {
      console.warn('[PPE] Failed to sync data with database:', err);
    }
  }, []);

  useEffect(() => {
    loadPpeDataFromDb();

    const handleDataMutation = (e: any) => {
      const entity = e?.detail?.entityType || e?.detail?.key || e?.detail?.entity;
      if (
        !entity ||
        entity === 'settings' ||
        entity === 'ppe' ||
        String(entity).startsWith('hse_ppe_')
      ) {
        loadPpeDataFromDb();
      }
    };

    window.addEventListener('app_data_mutated', handleDataMutation);
    window.addEventListener('hse_data_mutated', handleDataMutation);
    window.addEventListener('hse_ppe_updated', loadPpeDataFromDb);
    return () => {
      window.removeEventListener('app_data_mutated', handleDataMutation);
      window.removeEventListener('hse_data_mutated', handleDataMutation);
      window.removeEventListener('hse_ppe_updated', loadPpeDataFromDb);
    };
  }, [loadPpeDataFromDb]);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // OSHA & Custom Categories list for dropdowns
  const OSHA_CATEGORIES = useMemo(() => {
    const baseList: { value: OshaPpeCategory; labelFa: string; labelEn: string }[] = [
      { value: 'Head Protection (OSHA 1910.135)', labelFa: 'محافظت از سر', labelEn: 'Head Protection' },
      { value: 'Eye & Face Protection (OSHA 1910.133)', labelFa: 'محافظت از چشم و صورت', labelEn: 'Eye & Face Protection' },
      { value: 'Respiratory Protection (OSHA 1910.134)', labelFa: 'محافظت از دستگاه تنفسی', labelEn: 'Respiratory Protection' },
      { value: 'Foot Protection (OSHA 1910.136)', labelFa: 'محافظت از پا', labelEn: 'Foot Protection' },
      { value: 'Hand & Arm Protection (OSHA 1910.138)', labelFa: 'محافظت از دست و بازو', labelEn: 'Hand & Arm Protection' },
      { value: 'Hearing Protection (OSHA 1910.95)', labelFa: 'محافظت شنیداری', labelEn: 'Hearing Protection' },
      { value: 'Fall Protection (OSHA 1926.502)', labelFa: 'سیستم‌های مهار سقوط', labelEn: 'Fall Protection' },
      { value: 'Body & High-Vis Clothing', labelFa: 'لباس کار و جلیقه شبرنگ', labelEn: 'Body & High-Vis Clothing' }
    ];

    if (Array.isArray(customCategories) && customCategories.length > 0) {
      customCategories.forEach((c: any) => {
        const val = c.nameEn ? `${c.nameEn} (${c.oshaCode || 'OSHA'})` : c.nameFa;
        if (!baseList.some(item => item.value === val || item.labelFa === c.nameFa)) {
          baseList.push({
            value: val as OshaPpeCategory,
            labelFa: c.nameFa,
            labelEn: c.nameEn || c.nameFa
          });
        }
      });
    }

    return baseList;
  }, [customCategories]);

  // Modals & Editing
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingPpeItem, setEditingPpeItem] = useState<PpeItem | null>(null);

  // Referral and Workflow Tracker Modals
  const [referralTargetPpe, setReferralTargetPpe] = useState<PpeIssuanceRecord | null>(null);
  const [trackerTargetPpe, setTrackerTargetPpe] = useState<PpeIssuanceRecord | null>(null);
  const [selectedIssuanceForPrint, setSelectedIssuanceForPrint] = useState<PpeIssuanceRecord | null>(null);

  // Print PPE Issuance Slip
  const handlePrintPpeSlip = () => {
    if (!selectedIssuanceForPrint) return;
    printService.printElement('printable-ppe-issuance-modal', {
      title: `رسید تحویل تجهیزات حفاظت فردی - ${selectedIssuanceForPrint.issueCode} - ${selectedIssuanceForPrint.personnelName}`,
      orientation: 'portrait',
      pageSize: 'A4',
      documentCode: selectedIssuanceForPrint.issueCode,
      documentDate: selectedIssuanceForPrint.issueDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  // Delete Confirm Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  // Catalog Form State
  const [catalogForm, setCatalogForm] = useState({
    code: '',
    nameFa: '',
    nameEn: '',
    category: 'Head Protection (OSHA 1910.135)' as OshaPpeCategory,
    oshaStandard: '',
    totalStock: 100,
    allocatedStock: 0,
    reorderLevel: 20,
    unitCostToman: 500000,
    lifespanMonths: 12,
    status: 'In Stock' as 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Discontinued'
  });

  // Open modal for creating new PPE item
  const handleOpenAddCatalogItem = () => {
    setEditingPpeItem(null);
    setCatalogForm({
      code: `PPE-HD-${Math.floor(100 + Math.random() * 900)}`,
      nameFa: '',
      nameEn: '',
      category: 'Head Protection (OSHA 1910.135)',
      oshaStandard: 'ANSI Z89.1 / OSHA 1910',
      totalStock: 100,
      allocatedStock: 0,
      reorderLevel: 20,
      unitCostToman: 500000,
      lifespanMonths: 12,
      status: 'In Stock'
    });
    setShowCatalogModal(true);
  };

  // Open modal for editing PPE item
  const handleOpenEditCatalogItem = (item: PpeItem) => {
    setEditingPpeItem(item);
    setCatalogForm({
      code: item.code,
      nameFa: item.nameFa,
      nameEn: item.nameEn,
      category: item.category,
      oshaStandard: item.oshaStandard,
      totalStock: item.totalStock,
      allocatedStock: item.allocatedStock,
      reorderLevel: item.reorderLevel,
      unitCostToman: item.unitCostToman,
      lifespanMonths: item.lifespanMonths,
      status: item.status
    });
    setShowCatalogModal(true);
  };

  // Save (Create or Update) Catalog Item
  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogForm.nameFa.trim()) return;

    const totalStock = Number(catalogForm.totalStock) || 0;
    const allocatedStock = Number(catalogForm.allocatedStock) || 0;
    const availableStock = Math.max(0, totalStock - allocatedStock);
    const reorderLevel = Number(catalogForm.reorderLevel) || 0;

    let computedStatus = catalogForm.status;
    if (availableStock <= 0) {
      computedStatus = 'Out of Stock';
    } else if (availableStock <= reorderLevel) {
      computedStatus = 'Low Stock';
    } else if (computedStatus === 'Out of Stock' || computedStatus === 'Low Stock') {
      computedStatus = 'In Stock';
    }

    if (editingPpeItem) {
      const updatedItems = ppeItems.map(item => {
        if (item.id === editingPpeItem.id) {
          return {
            ...item,
            code: catalogForm.code,
            nameFa: catalogForm.nameFa,
            nameEn: catalogForm.nameEn || catalogForm.nameFa,
            category: catalogForm.category,
            oshaStandard: catalogForm.oshaStandard,
            totalStock,
            allocatedStock,
            availableStock,
            reorderLevel,
            unitCostToman: Number(catalogForm.unitCostToman) || 0,
            lifespanMonths: Number(catalogForm.lifespanMonths) || 12,
            status: computedStatus
          };
        }
        return item;
      });
      saveCatalogToStorage(updatedItems);
    } else {
      const newItem: PpeItem = {
        id: 'ppe-' + Date.now(),
        code: catalogForm.code || `PPE-${Date.now().toString().slice(-4)}`,
        nameFa: catalogForm.nameFa,
        nameEn: catalogForm.nameEn || catalogForm.nameFa,
        category: catalogForm.category,
        oshaStandard: catalogForm.oshaStandard || 'ANSI / OSHA Standard',
        totalStock,
        allocatedStock,
        availableStock,
        reorderLevel,
        unitCostToman: Number(catalogForm.unitCostToman) || 0,
        lifespanMonths: Number(catalogForm.lifespanMonths) || 12,
        status: computedStatus
      };
      saveCatalogToStorage([...ppeItems, newItem]);
    }

    setShowCatalogModal(false);
  };

  // Delete Catalog Item
  const handleDeleteCatalogItem = (itemId: string, nameFa: string) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? `آیا از حذف تجهیز "${nameFa}" از کاتالوگ انبار اطمینان دارید؟` : `Delete PPE item "${nameFa}" from catalog?`,
      description: isFa ? 'این تجهیز از لیست کاتالوگ و انبارداری PPE پاک خواهد شد.' : 'This item will be removed from the catalog.',
      onConfirm: () => {
        const updated = ppeItems.filter(item => item.id !== itemId);
        saveCatalogToStorage(updated);
        if (editingPpeItem?.id === itemId) {
          setShowCatalogModal(false);
        }
        setDeleteConfirm(null);
      }
    });
  };

  // Delete Issuance Record
  const handleDeleteIssuanceRecord = (record: PpeIssuanceRecord) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? `آیا از حذف سابقه تحویل کد "${record.issueCode}" برای "${record.personnelName}" اطمینان دارید؟` : `Delete issuance record #${record.issueCode} for "${record.personnelName}"?`,
      description: isFa ? 'این رکورد تحویل به طور کامل از لیست رکوردهای تخصیص داده شده پاک می‌شود.' : 'This issuance record will be permanently deleted.',
      onConfirm: () => {
        const updated = issuanceRecords.filter(item => item.id !== record.id);
        saveIssuanceToStorage(updated);
        setDeleteConfirm(null);
      }
    });
  };

  // New Issuance Form
  const [newIssuance, setNewIssuance] = useState({
    personnelName: '',
    personnelCode: '',
    department: '',
    jobTitle: '',
    ppeItemId: '',
    quantity: 1,
    sizeOrSpec: '',
    serialNumber: '',
    issueDate: new Date().toLocaleDateString('fa-IR'),
    expiryDate: '',
    notes: ''
  });

  // Loaded Personnel List for Auto-Extraction
  const registeredPersonnelList = useMemo(() => {
    const list: Array<{
      personnelCode: string;
      fullName: string;
      department: string;
      jobTitle?: string;
    }> = [];

    // 1. From Central Personnel Master Data
    try {
      const pList = getComplexPersonnelList();
      if (Array.isArray(pList)) {
        pList.forEach((p: any) => {
          const code = String((p.personnelCode && p.personnelCode.trim()) || p.id || p.nationalCode || '').trim();
          const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
          if (code || name) {
            list.push({
              personnelCode: code,
              fullName: name,
              department: p.unit || p.department || '',
              jobTitle: p.jobTitle || ''
            });
          }
        });
      }
    } catch (e) {
      console.error(e);
    }

    // 2. From system users (database state)
    try {
      const uList = getSystemUsers();
      if (Array.isArray(uList)) {
        uList.forEach((u: any) => {
          const code = String((u.personnelNumber && u.personnelNumber.trim()) || u.id || '').trim();
          const name = u.fullName || u.username || '';
          if (code && name) {
            if (!list.some(r => r.personnelCode === code)) {
              list.push({
                personnelCode: code,
                fullName: name,
                department: u.department || '',
                jobTitle: u.jobTitle || u.role || ''
              });
            }
          }
        });
      }
    } catch (e) {
      console.error(e);
    }

    return list;
  }, [showIssueModal]);

  // List of organizational units for department selection
  const availableUnits = useMemo(() => {
    return getUnits();
  }, []);

  // Function to match and auto-fill personnel details when code changes
  const handlePersonnelCodeChange = (codeVal: string) => {
    const cleanCode = codeVal.trim();
    if (!cleanCode) {
      setNewIssuance(prev => ({ ...prev, personnelCode: '', personnelName: '' }));
      return;
    }
    
    // First try findPersonnelByCode from complex personnel
    const complexMatched = findPersonnelByCode(cleanCode);
    if (complexMatched) {
      setNewIssuance(prev => ({
        ...prev,
        personnelCode: codeVal,
        personnelName: complexMatched.fullName,
        department: complexMatched.unit || prev.department,
        jobTitle: complexMatched.jobTitle || prev.jobTitle
      }));
      return;
    }

    // Fallback to registeredPersonnelList
    const matched = registeredPersonnelList.find(
      p => (p.personnelCode && p.personnelCode.toLowerCase() === cleanCode.toLowerCase()) ||
           (p.fullName && p.fullName.toLowerCase() === cleanCode.toLowerCase())
    );

    if (matched) {
      setNewIssuance(prev => ({
        ...prev,
        personnelCode: codeVal,
        personnelName: matched.fullName,
        department: matched.department,
        jobTitle: matched.jobTitle || prev.jobTitle
      }));
    } else {
      setNewIssuance(prev => ({
        ...prev,
        personnelCode: codeVal,
        personnelName: ''
      }));
    }
  };

  // Save changes helper
  const saveIssuanceToStorage = (records: PpeIssuanceRecord[]) => {
    setIssuanceRecords(records);
    apiDb.savePpeIssuance(records).catch(console.error);
  };

  const saveCatalogToStorage = (items: PpeItem[]) => {
    setPpeItems(items);
    apiDb.savePpeItems(items).catch(console.error);
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalAssigned = issuanceRecords.length;
    const activeAssigned = issuanceRecords.filter(r => r.status === 'Active').length;
    const dueReplacement = issuanceRecords.filter(r => r.status === 'Due for Replacement' || r.status === 'Expired').length;
    const lowStockCount = ppeItems.filter(i => i.availableStock <= i.reorderLevel).length;

    return { totalAssigned, activeAssigned, dueReplacement, lowStockCount };
  }, [issuanceRecords, ppeItems]);

  // Filtered Issuance List
  const filteredIssuance = useMemo(() => {
    return issuanceRecords.filter(r => {
      const matchSearch = 
        r.personnelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.personnelCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ppeItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.issueCode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = deptFilter === 'ALL' || r.department === deptFilter;
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;

      return matchSearch && matchDept && matchStatus;
    });
  }, [issuanceRecords, searchTerm, deptFilter, statusFilter]);

  // Handle New Issuance Submit
  const handleCreateIssuance = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItem = ppeItems.find(i => i.id === newIssuance.ppeItemId);
    if (!selectedItem) return;

    if (selectedItem.availableStock < newIssuance.quantity) {
      alert(isFa ? 'موجودی انبار برای این تجهیز کافی نیست!' : 'Insufficient stock!');
      return;
    }

    const newRecord: PpeIssuanceRecord = {
      id: 'iss-' + Date.now(),
      issueCode: `ISS-1405-${Math.floor(100 + Math.random() * 900)}`,
      personnelName: newIssuance.personnelName,
      personnelCode: newIssuance.personnelCode,
      department: newIssuance.department,
      jobTitle: newIssuance.jobTitle || '',
      ppeItemId: selectedItem.id,
      ppeItemName: selectedItem.nameFa,
      category: selectedItem.category,
      quantity: Number(newIssuance.quantity) || 1,
      sizeOrSpec: newIssuance.sizeOrSpec || 'استاندارد',
      serialNumber: newIssuance.serialNumber || `SN-${Math.floor(1000 + Math.random() * 9000)}`,
      issueDate: newIssuance.issueDate || '1404/11/01',
      expiryDate: newIssuance.expiryDate || '1405/11/01',
      conditionOnIssue: 'New',
      status: 'Active',
      issuerName: currentUser.fullName || 'افسر ایمنی',
      acknowledgedByWorker: true,
      notes: newIssuance.notes
    };

    // Update stock count
    const updatedItems = ppeItems.map(item => {
      if (item.id === selectedItem.id) {
        const newAllocated = item.allocatedStock + newRecord.quantity;
        const newAvailable = Math.max(0, item.totalStock - newAllocated);
        return {
          ...item,
          allocatedStock: newAllocated,
          availableStock: newAvailable,
          status: newAvailable <= item.reorderLevel ? 'Low Stock' : 'In Stock'
        };
      }
      return item;
    });

    saveCatalogToStorage(updatedItems as PpeItem[]);
    saveIssuanceToStorage([newRecord, ...issuanceRecords]);

    setShowIssueModal(false);
    setNewIssuance({
      personnelName: '',
      personnelCode: '',
      department: '',
      jobTitle: '',
      ppeItemId: ppeItems[0]?.id || '',
      quantity: 1,
      sizeOrSpec: '',
      serialNumber: '',
      issueDate: new Date().toLocaleDateString('fa-IR'),
      expiryDate: '',
      notes: ''
    });
  };

  // Export CSV
  const exportToCsv = () => {
    let csvContent = 'کد تحویل,نام پرسنل,کد پرسنلی,واحد,تجهیز حفاظت فردی,استاندارد OSHA,تاریخ تحویل,تاریخ انقضا/تعویض,وضعیت\n';
    issuanceRecords.forEach(r => {
      csvContent += `${r.issueCode},${r.personnelName},${r.personnelCode},${r.department},${r.ppeItemName},${r.category},${r.issueDate},${r.expiryDate},${r.status}\n`;
    });
    downloadCsvFile(`OSHA_PPE_Issuance_Report_${Date.now()}.csv`, csvContent);
  };

  return (
    <div className="space-y-6 pb-12" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                OSHA 29 CFR 1910 Subpart I
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 text-[10px] font-bold px-2.5 py-1 rounded-full">
                {isFa ? 'سامانه هوشمند تحویل و انبارداری PPE' : 'PPE Asset Ledger'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3 text-white">
              <HardHat className="w-8 h-8 text-amber-400 animate-pulse" />
              {isFa ? 'مدیریت تجهیزات حفاظت فردی (PPE)' : 'Personal Protective Equipment Management'}
            </h1>
            <p className="text-slate-300 text-xs max-w-3xl leading-relaxed">
              {isFa 
                ? 'پایش دقیق تخصیص و تحویل PPE، کنترل تاریخ انقضا، تست‌های برازش (Fit Test)، بازرسی‌های فنی طبق استانداردهای OSHA (29 CFR 1910.132-138) و ANSI.' 
                : 'Asset tracking, worker issuance ledger, fit testing logs, and expiry control compliant with OSHA subpart I & ANSI standards.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowIssueModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-lg transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isFa ? 'ثبت تحویل جدید PPE' : 'Issue PPE to Worker'}
            </button>
            <button
              onClick={exportToCsv}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-3 rounded-2xl border border-white/10 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              {isFa ? 'خروجی اکسل / CSV' : 'Export Ledger'}
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('issuance')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'issuance' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <UserCheck className={`w-4 h-4 ${activeSubTab === 'issuance' ? 'text-white' : 'text-indigo-400'}`} />
            <span>{isFa ? 'دفتر تحویل و تحول پرسنل' : 'Worker Issuance Ledger'}</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeSubTab === 'issuance' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
              {issuanceRecords.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('osha_guide')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'osha_guide' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${activeSubTab === 'osha_guide' ? 'text-white' : 'text-amber-400'}`} />
            <span>{isFa ? 'راهنما و الزامات استاندارد OSHA' : 'OSHA Standard Guidelines'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'کل تحویل‌های فعال' : 'Total Active Issuance'}</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 font-mono">{kpis.activeAssigned}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'نیازمند تعویض / انقضا' : 'Due / Expired PPE'}</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1 font-mono">{kpis.dueReplacement}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'هشدار کسر موجودی انبار' : 'Low Stock Alerts'}</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono">{kpis.lowStockCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'استاندارد مرجع' : 'Reference Standard'}</p>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1">OSHA 29 CFR 1910</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: ISSUANCE LEDGER */}
      {activeSubTab === 'issuance' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={isFa ? 'جستجو بر اساس نام پرسنل، کد تحویل، نام تجهیز...' : 'Search worker, code, PPE item...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه واحدها' : 'All Departments'}</option>
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
                <option value="Active">{isFa ? 'فعال (معتبر)' : 'Active'}</option>
                <option value="Due for Replacement">{isFa ? 'نیازمند تعویض' : 'Due Replacement'}</option>
                <option value="Expired">{isFa ? 'منقضی‌شده' : 'Expired'}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-black border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">{isFa ? 'کد تحویل' : 'Issue ID'}</th>
                  <th className="p-3.5">{isFa ? 'گیرنده تجهیز' : 'Worker Name'}</th>
                  <th className="p-3.5">{isFa ? 'واحد / عنوان شغلی' : 'Dept / Job Title'}</th>
                  <th className="p-3.5">{isFa ? 'تجهیز تحویلی' : 'PPE Item'}</th>
                  <th className="p-3.5">{isFa ? 'مشخصات / شماره سریال' : 'Spec / Serial'}</th>
                  <th className="p-3.5">{isFa ? 'تاریخ تحویل' : 'Issue Date'}</th>
                  <th className="p-3.5">{isFa ? 'تاریخ انقضا / تعویض' : 'Expiry / Replace'}</th>
                  <th className="p-3.5">{isFa ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIssuance.length > 0 ? (
                  filteredIssuance.map((row, idx) => (
                    <tr key={`${row.id || 'row'}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-indigo-600">{row.issueCode}</td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">
                        {row.personnelName}
                        <span className="block text-[10px] text-slate-400 font-mono font-normal">{row.personnelCode}</span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">
                        {row.department}
                        <span className="block text-[10px] text-slate-400 font-normal">{row.jobTitle}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{row.ppeItemName}</span>
                        <span className="text-[10px] text-slate-400 block">{row.category}</span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {row.sizeOrSpec}
                        {row.serialNumber && <span className="block text-[10px] text-indigo-500">{row.serialNumber}</span>}
                      </td>
                      <td className="p-3.5"><DualDateBadge dateStr={row.issueDate} showTime={false} /></td>
                      <td className="p-3.5"><DualDateBadge dateStr={row.expiryDate} showTime={false} /></td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                          row.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          row.status === 'Due for Replacement' ? 'bg-amber-50 text-amber-700 border border-blue-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {row.status === 'Active' && <CheckCircle2 className="w-3 h-3" />}
                          {row.status === 'Due for Replacement' && <Clock className="w-3 h-3" />}
                          {row.status === 'Expired' && <AlertTriangle className="w-3 h-3" />}
                          {row.status === 'Active' ? (isFa ? 'فعال' : 'Active') :
                           row.status === 'Due for Replacement' ? (isFa ? 'تعویض لازم' : 'Due') : (isFa ? 'منقضی' : 'Expired')}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedIssuanceForPrint(row)}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title={isFa ? 'مشاهده و چاپ رسید A4' : 'View & Print Slip'}
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            {isFa ? 'رسید / چاپ' : 'Slip'}
                          </button>
                          <button
                            onClick={() => setReferralTargetPpe(row)}
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title={isFa ? 'ارجاع سند جهت تأیید و امضا' : 'Referral & Sign'}
                          >
                            <Send className="w-3.5 h-3.5 text-blue-600" />
                            {isFa ? 'ارجاع' : 'Refer'}
                          </button>
                          <button
                            onClick={() => setTrackerTargetPpe(row)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title={isFa ? 'رهگیری گردش کار و امضاها' : 'Workflow Tracker'}
                          >
                            <History className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <button
                            onClick={() => {
                              if (currentUser?.role !== 'Administrator') {
                                alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
                                return;
                              }
                              const updated = issuanceRecords.map(item => 
                                item.id === row.id 
                                  ? { ...item, status: 'Active' as const, expiryDate: '1406/01/01', notes: 'تعویض دوره انجام شد' } 
                                  : item
                              );
                              saveIssuanceToStorage(updated);
                            }}
                            className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[11px] transition cursor-pointer"
                          >
                            {isFa ? 'تعویض' : 'Replace'}
                          </button>
                          {currentUser?.role === 'Administrator' && (
                            <button
                              onClick={() => handleDeleteIssuanceRecord(row)}
                              className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title={isFa ? 'حذف سابقه تحویل' : 'Delete Issuance'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                      {isFa ? 'هیچ رکوردی یافت نشد' : 'No Issuance Records Found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}



      {/* SUB-TAB 3: OSHA STANDARD GUIDELINE CARDS */}
      {activeSubTab === 'osha_guide' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              {isFa ? 'خلاصه الزامات و مقررات تجهیزات حفاظت فردی در OSHA' : 'OSHA PPE Standard Directives'}
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              {isFa 
                ? 'طبق استانداردهای بخش ۱۹۱۰ (صنعت عمومی) و بخش ۱۹۲۶ (ساختمان) سازمان OSHA آمریکا' 
                : 'Key regulatory requirements under OSHA General Industry (1910) and Construction (1926)'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2.5 border border-slate-800">
                <span className="bg-amber-500/20 text-amber-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">
                  OSHA 1910.132(h)
                </span>
                <h3 className="font-black text-sm text-indigo-200">
                  {isFa ? 'تأمین رایگان PPE توسط کارفرما' : 'Employer Provision at No Cost'}
                </h3>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isFa 
                    ? 'کارفرما مکلف است تمامی تجهیزات حفاظت فردی مورد نیاز را بدون دریافت هیچ‌گونه هزینه از کارگر تأمین نماید.' 
                    : 'Employers must provide all required PPE at no cost to employees, including replacement of worn equipment.'}
                </p>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2.5 border border-slate-800">
                <span className="bg-sky-500/20 text-sky-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">
                  OSHA 1910.134
                </span>
                <h3 className="font-black text-sm text-sky-200">
                  {isFa ? 'تست برازش ماسک (Respirator Fit Test)' : 'Respirator Fit Testing'}
                </h3>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isFa 
                    ? 'پیش از استفاده از هرگونه ماسک تنفسی آب‌بندی شونده، تست برازش کیفی (Qualitative) یا کمی (Quantitative) سالانه الزامی است.' 
                    : 'Annual fit test is mandatory for tight-fitting respirators before workplace deployment.'}
                </p>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2.5 border border-slate-800">
                <span className="bg-emerald-500/20 text-emerald-300 font-black px-2 py-0.5 rounded text-[10px] inline-block">
                  OSHA 1926.502
                </span>
                <h3 className="font-black text-sm text-emerald-200">
                  {isFa ? 'سیستم مهار سقوط (Fall Protection)' : 'Fall Protection Harnesses'}
                </h3>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isFa 
                    ? 'در ارتفاع بیش از ۱.۸ متر (۶ فوت)، استفاده از هارنس کامل بدن با شوک‌گیر استاندارد ANSI Z359 الزامی است.' 
                    : 'Full body harness with lanyard energy absorbers required for heights exceeding 6 feet.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW ISSUANCE MODAL */}
      {showIssueModal && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto" dir={isFa ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                {isFa ? 'فرم تحویل و تخصیص تجهیز حفاظت فردی' : 'PPE Issuance Form'}
              </h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 font-bold text-sm w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIssuance} className="space-y-4 text-xs">
              {/* Central Master Data Personnel Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <CentralPersonnelSelector
                  language={isFa ? 'fa' : 'en'}
                  label={isFa ? 'پرسنل تحویل‌گیرنده تجهیز حفاظت فردی (PPE)' : 'Employee Receiving PPE'}
                  required
                  selectedPersonnelCode={newIssuance.personnelCode}
                  onSelectPersonnel={(p, org) => {
                    if (p) {
                      setNewIssuance(prev => ({
                        ...prev,
                        personnelCode: p.effectiveCode || p.personnelCode,
                        personnelName: p.fullName,
                        department: org.unit || p.unit,
                        jobTitle: p.jobTitle || prev.jobTitle
                      }));
                    } else {
                      setNewIssuance(prev => ({
                        ...prev,
                        personnelCode: '',
                        personnelName: '',
                        department: '',
                        jobTitle: ''
                      }));
                    }
                  }}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'تجهیز انتخابی از کاتالوگ' : 'Select PPE Item'}</label>
                <select
                  value={newIssuance.ppeItemId}
                  onChange={e => setNewIssuance({ ...newIssuance, ppeItemId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                >
                  {ppeItems.map((item, idx) => (
                    <option key={`${item.id || 'item'}-${idx}`} value={item.id}>
                      {item.nameFa} ({isFa ? 'موجودی آزاد:' : 'Avail:'} {item.availableStock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'تعداد' : 'Quantity'}</label>
                  <input
                    type="number"
                    min={1}
                    value={newIssuance.quantity}
                    onChange={e => setNewIssuance({ ...newIssuance, quantity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'سایز / مشخصه' : 'Size/Spec'}</label>
                  <input
                    type="text"
                    placeholder="مثال: سایز L"
                    value={newIssuance.sizeOrSpec}
                    onChange={e => setNewIssuance({ ...newIssuance, sizeOrSpec: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'شماره سریال / کد ردیابی' : 'Serial No'}</label>
                  <input
                    type="text"
                    placeholder="اختیاری"
                    value={newIssuance.serialNumber}
                    onChange={e => setNewIssuance({ ...newIssuance, serialNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'تاریخ تحویل' : 'Issue Date'}</label>
                  <PersianDatePicker
                    value={newIssuance.issueDate}
                    onChange={(jStr) => setNewIssuance({ ...newIssuance, issueDate: jStr })}
                    isFa={isFa}
                    placeholder={isFa ? 'انتخاب تاریخ تحویل...' : 'Issue date...'}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'تاریخ موعد تعویض' : 'Expiry / Replace Date'}</label>
                  <PersianDatePicker
                    value={newIssuance.expiryDate}
                    onChange={(jStr) => setNewIssuance({ ...newIssuance, expiryDate: jStr })}
                    isFa={isFa}
                    placeholder={isFa ? 'انتخاب تاریخ انقضا...' : 'Expiry date...'}
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-md transition cursor-pointer"
                >
                  {isFa ? 'ثبت و صدور تحویل‌نامه' : 'Submit Issuance'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ADD / EDIT CATALOG PPE ITEM MODAL */}
      {showCatalogModal && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto" dir={isFa ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {editingPpeItem ? <Pencil className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                {editingPpeItem 
                  ? (isFa ? 'ویرایش مشخصات تجهیز در کاتالوگ انبار' : 'Edit PPE Catalog Item') 
                  : (isFa ? 'افزودن تجهیز جدید به کاتالوگ انبار PPE' : 'Add New PPE Catalog Item')}
              </h3>
              <button 
                onClick={() => setShowCatalogModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:text-slate-400 font-bold text-sm w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'کد اختصاصی تجهیز' : 'PPE Item Code'}</label>
                  <input
                    type="text"
                    required
                    value={catalogForm.code}
                    onChange={e => setCatalogForm({ ...catalogForm, code: e.target.value })}
                    placeholder="مثال: PPE-HD-001"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نام تجهیز (فارسی)' : 'PPE Name (Persian)'}</label>
                  <input
                    type="text"
                    required
                    value={catalogForm.nameFa}
                    onChange={e => {
                      const newFa = e.target.value;
                      setCatalogForm(prev => ({
                        ...prev,
                        nameFa: newFa,
                        nameEn: translatePpeNameToEn(newFa)
                      }));
                    }}
                    placeholder="مثال: کلاه ایمنی صنعتی کلاس E"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نام تجهیز (انگلیسی)' : 'PPE Name (English)'}</label>
                  <input
                    type="text"
                    value={catalogForm.nameEn}
                    onChange={e => setCatalogForm({ ...catalogForm, nameEn: e.target.value })}
                    placeholder="Industrial Hard Hat Class E"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'دسته‌بندی استاندارد OSHA' : 'OSHA Standard Category'}</label>
                  <select
                    value={catalogForm.category}
                    onChange={e => setCatalogForm({ ...catalogForm, category: e.target.value as OshaPpeCategory })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    {OSHA_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {isFa ? cat.labelFa : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'استاندارد بین‌المللی/داخلی ایمنی (ANSI / NIOSH / ISIRI)' : 'International/National Safety Standard'}</label>
                <input
                  type="text"
                  value={catalogForm.oshaStandard}
                  onChange={e => setCatalogForm({ ...catalogForm, oshaStandard: e.target.value })}
                  placeholder="مثال: ANSI/ISEA Z89.1 / ISIRI 4998"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'موجودی کل' : 'Total Stock'}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={catalogForm.totalStock}
                    onChange={e => setCatalogForm({ ...catalogForm, totalStock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'تخصیص‌یافته' : 'Allocated'}</label>
                  <input
                    type="number"
                    min={0}
                    value={catalogForm.allocatedStock}
                    onChange={e => setCatalogForm({ ...catalogForm, allocatedStock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'موجودی آزاد' : 'Available'}</label>
                  <div className="p-2.5 bg-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-bold text-emerald-700 text-center">
                    {Math.max(0, (catalogForm.totalStock || 0) - (catalogForm.allocatedStock || 0))}
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نقطه سفارش' : 'Reorder Level'}</label>
                  <input
                    type="number"
                    min={0}
                    value={catalogForm.reorderLevel}
                    onChange={e => setCatalogForm({ ...catalogForm, reorderLevel: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'عمر مفید (ماه)' : 'Lifespan (Months)'}</label>
                  <input
                    type="number"
                    min={1}
                    value={catalogForm.lifespanMonths}
                    onChange={e => setCatalogForm({ ...catalogForm, lifespanMonths: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'وضعیت در انبار' : 'Stock Status'}</label>
                  <select
                    value={catalogForm.status}
                    onChange={e => setCatalogForm({ ...catalogForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="In Stock">{isFa ? 'موجودی کافی (In Stock)' : 'In Stock'}</option>
                    <option value="Low Stock">{isFa ? 'کمبود موجودی (Low Stock)' : 'Low Stock'}</option>
                    <option value="Out of Stock">{isFa ? 'ناموجود (Out of Stock)' : 'Out of Stock'}</option>
                    <option value="Discontinued">{isFa ? 'غیرفعال / خروج از رده (Discontinued)' : 'Discontinued'}</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                {editingPpeItem ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCatalogItem(editingPpeItem.id, editingPpeItem.nameFa)}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isFa ? 'حذف این تجهیز' : 'Delete Item'}
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatalogModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
                  >
                    {isFa ? 'انصراف' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    {editingPpeItem ? (isFa ? 'ذخیره تغییرات تجهیز' : 'Save Changes') : (isFa ? 'افزودن به کاتالوگ انبار' : 'Add to Catalog')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200" dir={isFa ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h4 className="font-black text-slate-900 text-sm">{isFa ? 'تایید حذف اطلاعات' : 'Confirm Deletion'}</h4>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-relaxed">{deleteConfirm.title}</p>
              {deleteConfirm.description && (
                <p className="text-[11px] text-slate-500 leading-relaxed">{deleteConfirm.description}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={deleteConfirm.onConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isFa ? 'حذف قطعی' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PPE ISSUANCE A4 PRINTABLE DETAIL MODAL */}
      {selectedIssuanceForPrint && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto" dir={isFa ? 'rtl' : 'ltr'}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
                    {isFa ? 'فرم و رسید رسمی تحویل لوازم حفاظت فردی (PPE)' : 'PPE Issuance & Delivery Slip'}
                  </h3>
                  <span className="text-[11px] font-mono text-indigo-600 font-bold">{selectedIssuanceForPrint.issueCode}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReferralTargetPpe(selectedIssuanceForPrint)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title={isFa ? 'ارجاع سند جهت تأیید و امضا' : 'Refer Document'}
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isFa ? 'ارجاع سند' : 'Refer'}</span>
                </button>
                <button
                  onClick={() => setTrackerTargetPpe(selectedIssuanceForPrint)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title={isFa ? 'رهگیری گردش کار و امضاها' : 'Workflow Tracker'}
                >
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isFa ? 'گردش کار' : 'Workflow'}</span>
                </button>
                <button
                  onClick={handlePrintPpeSlip}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isFa ? 'چاپ رسید A4' : 'Print A4 Slip'}</span>
                </button>
                <button
                  onClick={() => setSelectedIssuanceForPrint(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div id="printable-ppe-issuance-modal" className="space-y-4 text-xs">
              {/* Document Header Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                      HSE
                    </div>
                    <div>
                      <h2 className="font-black text-sm text-slate-900">سامانه مدیریت ایمنی، بهداشت و محیط‌زیست (HSE)</h2>
                      <p className="text-[11px] text-slate-500 font-bold">فرم رسمی تحویل و تعهد استفاده از تجهیزات حفاظت فردی (PPE-F04)</p>
                    </div>
                  </div>
                  <div className="text-left font-mono text-[11px] space-y-0.5">
                    <div><span className="text-slate-400">شماره برگه: </span><strong>{selectedIssuanceForPrint.issueCode}</strong></div>
                    <div><span className="text-slate-400">تاریخ صدور: </span><strong>{selectedIssuanceForPrint.issueDate}</strong></div>
                    <div><span className="text-slate-400">تاریخ انقضا: </span><strong>{selectedIssuanceForPrint.expiryDate}</strong></div>
                  </div>
                </div>

                {/* Worker Information */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border-b border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block">نام و نام خانوادگی تحویل‌گیرنده:</span>
                    <strong className="text-slate-800 text-xs">{selectedIssuanceForPrint.personnelName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">کد پرسنلی:</span>
                    <strong className="text-slate-800 font-mono text-xs">{selectedIssuanceForPrint.personnelCode}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">واحد سازمانی:</span>
                    <strong className="text-slate-800 text-xs">{selectedIssuanceForPrint.department}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">سمت / شغل:</span>
                    <strong className="text-slate-800 text-xs">{selectedIssuanceForPrint.jobTitle}</strong>
                  </div>
                </div>

                {/* Equipment Information */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block">نام تجهیز تحویلی:</span>
                    <strong className="text-indigo-700 text-xs">{selectedIssuanceForPrint.ppeItemName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">رده استاندارد OSHA:</span>
                    <strong className="text-slate-800 text-xs">{selectedIssuanceForPrint.category}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">سایز / مشخصات فنی:</span>
                    <strong className="text-slate-800 text-xs">{selectedIssuanceForPrint.sizeOrSpec || 'استاندارد'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">تعداد تحویلی:</span>
                    <strong className="text-slate-800 text-xs font-mono">{selectedIssuanceForPrint.quantity || 1} عدد</strong>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white border-b border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block">شماره سریال / بارکد:</span>
                    <strong className="text-slate-700 font-mono text-xs">{selectedIssuanceForPrint.serialNumber || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">تحویل‌دهنده (افسر HSE):</span>
                    <strong className="text-slate-700 text-xs">{selectedIssuanceForPrint.issuerName || currentUser.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">وضعیت تجهیز هنگام تحویل:</span>
                    <strong className="text-emerald-700 text-xs">{selectedIssuanceForPrint.conditionOnIssue === 'New' ? 'آکبند و نو' : 'سالم'}</strong>
                  </div>
                </div>

                {/* Commitment Note */}
                <div className="p-4 bg-amber-50/60 text-slate-700 text-[11px] leading-relaxed border-b border-slate-200">
                  <strong>تعهدنامه تحویل‌گیرنده: </strong>
                  اینجانب تحویل‌گیرنده فوق متعهد می‌گردم که کلیه اصول و الزامات استفاده، نگهداری و بازرسی روزانه تجهیز فوق‌الذکر را طبق آیین‌نامه‌های حفاظت فردی و الزامات HSE به طور کامل رعایت نموده و در صورت هرگونه نقص فنی یا حادثه فوراً واحد ایمنی را مطلع نمایم.
                </div>
              </div>

              {/* UNIFIED SIGNATURES & APPROVALS PRINT BOX */}
              <div className="pt-2">
                <PrintDocumentSignaturesBox
                  documentType="PPE_REQUEST"
                  documentId={selectedIssuanceForPrint.id}
                  isFa={isFa}
                  title={isFa ? 'تأییدات و امضاهای گردش کار تحویل تجهیزات حفاظت فردی (PPE Signatures)' : 'PPE Approvals & Signatures'}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 print:hidden">
              <button
                onClick={() => setSelectedIssuanceForPrint(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
              >
                {isFa ? 'بستن' : 'Close'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReferralTargetPpe(selectedIssuanceForPrint)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isFa ? 'ارجاع سند جهت تأیید' : 'Refer Document'}</span>
                </button>
                <button
                  onClick={handlePrintPpeSlip}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isFa ? 'چاپ فرم A4' : 'Print Slip'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* UNIFIED REFERRAL MODAL */}
      {referralTargetPpe && (
        <CreateReferralModal
          documentType="PPE_REQUEST"
          documentId={referralTargetPpe.id}
          documentNumber={referralTargetPpe.issueCode}
          documentTitle={`${referralTargetPpe.ppeItemName} - ${referralTargetPpe.personnelName}`}
          currentUser={currentUser}
          isFa={isFa}
          onClose={() => setReferralTargetPpe(null)}
          onSuccess={() => {
            setReferralTargetPpe(null);
            alert(isFa ? 'سند با موفقیت جهت تأیید و امضا ارجاع شد.' : 'PPE slip referred successfully.');
          }}
        />
      )}

      {/* UNIFIED WORKFLOW TRACKER MODAL */}
      {trackerTargetPpe && (
        <DocumentWorkflowTrackerModal
          documentType="PPE_REQUEST"
          documentId={trackerTargetPpe.id}
          documentNumber={trackerTargetPpe.issueCode}
          documentTitle={`${trackerTargetPpe.ppeItemName} - ${trackerTargetPpe.personnelName}`}
          currentUser={currentUser}
          isFa={isFa}
          onClose={() => setTrackerTargetPpe(null)}
        />
      )}
    </div>
  );
}

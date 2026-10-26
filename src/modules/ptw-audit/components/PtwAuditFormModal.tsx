import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Building2, 
  FileText, 
  UserCheck, 
  Flame, 
  Snowflake, 
  Box, 
  ShieldAlert, 
  CheckCheck, 
  RotateCcw,
  Sparkles,
  Info,
  Check,
  AlertOctagon,
  HardHat,
  Eye,
  Plus,
  Trash2,
  MinusCircle,
  HelpCircle,
  Filter,
  Search,
  ShieldCheck,
  User,
  Layers,
  Link2,
  Zap,
  Radio,
  Truck,
  CheckSquare,
  Square,
  Paperclip,
  UploadCloud,
  FileImage,
  Download,
  ExternalLink,
  Maximize2,
  AlertCircle,
  FileCheck,
  ImageIcon
} from 'lucide-react';
import { formatFileSize, readFileAsDataUrl, compressImageFile } from '../../../utils/fileHelpers';
import { 
  PtwAuditRecord, 
  PtwAuditItem, 
  PtwAuditAttachment,
  PermitType, 
  AttachedPermitType,
  AuditStatusType, 
  AuditLifecycleStatus,
  EnvironmentalHazardItem,
  RequiredPpeItem,
  PrecautionItem,
  ATTACHED_PERMIT_OPTIONS
} from '../types';
import { 
  calculateAuditMetrics, 
  getActiveIssuedSupplementaryPermits,
  generateDefectSummaryReport
} from '../services/ptwAuditService';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { getOrgUnitsStructure, findUnitDetail } from '../../../utils/orgHelper';
import { useUnifiedOrgUnits } from '../../../utils/orgUnitsHelper';
import { PermitPersonnelAutocomplete as PtwPersonnelAutocomplete } from '../../../components/permit/PermitPersonnelAutocomplete';

interface PtwAuditFormModalProps {
  initialData: PtwAuditRecord;
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: PtwAuditRecord) => void;
  isFa?: boolean;
}

export default function PtwAuditFormModal({
  initialData,
  isOpen,
  onClose,
  onSave,
  isFa = true
}: PtwAuditFormModalProps) {
  const [formData, setFormData] = useState<PtwAuditRecord>(initialData);
  const [activeFormTab, setActiveFormTab] = useState<'info' | 'checklist' | 'hazards_ppe' | 'attachments' | 'conclusion'>('info');
  const [checklistFilter, setChecklistFilter] = useState<'ALL' | 'UNANSWERED' | 'PASS' | 'DEFECT' | 'NA'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Attachment handling state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewModalAttachment, setPreviewModalAttachment] = useState<PtwAuditAttachment | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Custom addition inputs
  const [newHazardText, setNewHazardText] = useState('');
  const [newPpeText, setNewPpeText] = useState('');
  const [newPpeGroup, setNewPpeGroup] = useState('سایر');
  const [newPrecautionText, setNewPrecautionText] = useState('');

  // تاریخ و ساعت تاییدیه و امضاء نماینده واحد ایمنی (مشابه تاریخ و ساعت ممیزی)
  const [signatureDate, setSignatureDate] = useState<string>(() => {
    const parts = (initialData.hseAuditor?.signedAt || '').trim().split(' ');
    return parts[0] || initialData.auditDate || '';
  });
  const [signatureTime, setSignatureTime] = useState<string>(() => {
    const parts = (initialData.hseAuditor?.signedAt || '').trim().split(' ');
    return parts[1] || initialData.auditTime || '10:30';
  });

  // پروانه‌های کار الحاقی و تکمیلی ثبت شده در ماژول پروانه کار مجتمع
  const [activeSuppPermits, setActiveSuppPermits] = useState<ReturnType<typeof getActiveIssuedSupplementaryPermits>>([]);

  useEffect(() => {
    setFormData(initialData);
    setActiveSuppPermits(getActiveIssuedSupplementaryPermits());
    const parts = (initialData.hseAuditor?.signedAt || '').trim().split(' ');
    setSignatureDate(parts[0] || initialData.auditDate || '');
    setSignatureTime(parts[1] || initialData.auditTime || '10:30');
  }, [initialData]);

  const { units: unifiedUnits } = useUnifiedOrgUnits();

  // Available sub-units based on selected unit strictly from Org Structure
  const availableSubUnits = useMemo(() => {
    const unit = formData.unitName;
    if (!unit) return [];
    const struct = getOrgUnitsStructure();
    const match = findUnitDetail(unit, struct);
    if (match?.subUnits) {
      return Object.keys(match.subUnits);
    }
    return [];
  }, [formData.unitName]);

  // Real-time compliance calculations
  const metrics = useMemo(() => {
    return calculateAuditMetrics(
      formData.inspectionItems,
      formData.environmentalHazards,
      formData.requiredPpe,
      formData.precautionsTaken
    );
  }, [formData.inspectionItems, formData.environmentalHazards, formData.requiredPpe, formData.precautionsTaken]);

  // Filtered checklist items
  const filteredInspectionItems = useMemo(() => {
    return formData.inspectionItems.filter(item => {
      // Search filter
      const matchesSearch = searchQuery.trim() === '' || 
        item.questionFa.includes(searchQuery) || 
        (item.category && item.category.includes(searchQuery)) ||
        (item.remarks && item.remarks.includes(searchQuery));
      
      if (!matchesSearch) return false;

      // Status filter
      if (checklistFilter === 'UNANSWERED') {
        return !item.status;
      }
      if (checklistFilter === 'PASS') {
        return item.status === 'P' || item.status === 'PASS';
      }
      if (checklistFilter === 'DEFECT') {
        return item.status === 'O' || item.status === 'DEFECT';
      }
      if (checklistFilter === 'NA') {
        return item.status === '-' || item.status === 'NA';
      }
      return true;
    });
  }, [formData.inspectionItems, checklistFilter, searchQuery]);

  if (!isOpen) return null;

  const handleUpdateItemStatus = (itemId: number, status: AuditStatusType) => {
    setFormData(prev => {
      const updatedItems = prev.inspectionItems.map(item => 
        item.id === itemId ? { ...item, status } : item
      );

      let updatedReport = prev.auditSummaryReport || '';

      // اگر آیتم به وضعیت نامطلوب (عدم انطباق) تغییر کرد، متن آن را به صورت شماره‌گذاری‌شده به گزارش ممیزی بیفزاییم
      if (status === 'O' || status === 'DEFECT') {
        const targetItem = prev.inspectionItems.find(i => i.id === itemId);
        if (targetItem) {
          const keyword = `بند ${targetItem.questionNumber}`;
          if (!updatedReport.includes(keyword)) {
            const lines = updatedReport.trim().split('\n').filter(l => l.trim().length > 0);
            const rowNumber = lines.length + 1;
            const remarkPart = targetItem.remarks?.trim() ? ` (توضیحات: ${targetItem.remarks.trim()})` : '';
            const newRow = `${rowNumber}. [بند ${targetItem.questionNumber} چک‌لیست] ${targetItem.questionFa}${remarkPart}`;
            updatedReport = updatedReport.trim() ? `${updatedReport.trim()}\n${newRow}` : newRow;
          }
        }
      }

      return {
        ...prev,
        inspectionItems: updatedItems,
        auditSummaryReport: updatedReport
      };
    });
  };

  const handleUpdateItemRemarks = (itemId: number, remarks: string) => {
    setFormData(prev => ({
      ...prev,
      inspectionItems: prev.inspectionItems.map(item => 
        item.id === itemId ? { ...item, remarks } : item
      )
    }));
  };

  const handleBatchSetStatus = (status: AuditStatusType) => {
    setFormData(prev => {
      const updatedItems = prev.inspectionItems.map(item => ({ ...item, status }));
      let updatedReport = prev.auditSummaryReport;
      if (status === 'O' || status === 'DEFECT') {
        updatedReport = generateDefectSummaryReport(
          updatedItems,
          prev.environmentalHazards,
          prev.requiredPpe,
          prev.precautionsTaken
        );
      }
      return {
        ...prev,
        inspectionItems: updatedItems,
        auditSummaryReport: updatedReport
      };
    });
  };

  // بازتولید یا ادغام خودکار کل گزارش عدم انطباق‌ها از چک‌لیست و تمهیدات
  const handleAutoGenerateDefectReport = (forceOverwrite = true) => {
    const generated = generateDefectSummaryReport(
      formData.inspectionItems,
      formData.environmentalHazards,
      formData.requiredPpe,
      formData.precautionsTaken
    );

    if (forceOverwrite || !formData.auditSummaryReport?.trim()) {
      setFormData(prev => ({ ...prev, auditSummaryReport: generated }));
    } else {
      setFormData(prev => ({
        ...prev,
        auditSummaryReport: `${prev.auditSummaryReport.trim()}\n\n[گزارش تکمیلی عدم انطباق‌ها]:\n${generated}`
      }));
    }
  };

  // 1. Environmental Hazards Handlers
  const toggleHazardSelected = (hazardId: string) => {
    setFormData(prev => ({
      ...prev,
      environmentalHazards: prev.environmentalHazards.map(h => {
        if (h.id === hazardId) {
          const newSelected = !h.selected;
          return { ...h, selected: newSelected, missed: newSelected ? false : h.missed };
        }
        return h;
      })
    }));
  };

  const toggleHazardMissed = (hazardId: string) => {
    setFormData(prev => ({
      ...prev,
      environmentalHazards: prev.environmentalHazards.map(h => {
        if (h.id === hazardId) {
          const newMissed = !h.missed;
          return { ...h, missed: newMissed, selected: newMissed ? false : h.selected };
        }
        return h;
      })
    }));
  };

  const handleClearHazard = (hazardId: string) => {
    setFormData(prev => ({
      ...prev,
      environmentalHazards: prev.environmentalHazards.map(h => 
        h.id === hazardId ? { ...h, selected: false, missed: false } : h
      )
    }));
  };

  const handleAddCustomHazard = (asMissed = false) => {
    if (!newHazardText.trim()) return;
    const customId = `custom_haz_${Date.now()}`;
    const newHazard: EnvironmentalHazardItem = {
      id: customId,
      labelFa: newHazardText.trim(),
      selected: !asMissed,
      missed: asMissed,
      isCustom: true
    };
    setFormData(prev => ({
      ...prev,
      environmentalHazards: [...prev.environmentalHazards, newHazard]
    }));
    setNewHazardText('');
  };

  const handleRemoveCustomHazard = (id: string) => {
    setFormData(prev => ({
      ...prev,
      environmentalHazards: prev.environmentalHazards.filter(h => h.id !== id)
    }));
  };

  // 2. Required PPE Handlers
  const togglePpeSelected = (ppeId: string) => {
    setFormData(prev => ({
      ...prev,
      requiredPpe: prev.requiredPpe.map(p => {
        if (p.id === ppeId) {
          const newSelected = !p.selected;
          return { ...p, selected: newSelected, missed: newSelected ? false : p.missed };
        }
        return p;
      })
    }));
  };

  const togglePpeMissed = (ppeId: string) => {
    setFormData(prev => ({
      ...prev,
      requiredPpe: prev.requiredPpe.map(p => {
        if (p.id === ppeId) {
          const newMissed = !p.missed;
          return { ...p, missed: newMissed, selected: newMissed ? false : p.selected };
        }
        return p;
      })
    }));
  };

  const handleClearPpe = (ppeId: string) => {
    setFormData(prev => ({
      ...prev,
      requiredPpe: prev.requiredPpe.map(p => 
        p.id === ppeId ? { ...p, selected: false, missed: false } : p
      )
    }));
  };

  const handleAddCustomPpe = (asMissed = false) => {
    if (!newPpeText.trim()) return;
    const customId = `custom_ppe_${Date.now()}`;
    const newPpe: RequiredPpeItem = {
      id: customId,
      groupFa: newPpeGroup || 'سایر',
      labelFa: newPpeText.trim(),
      selected: !asMissed,
      missed: asMissed,
      isCustom: true
    };
    setFormData(prev => ({
      ...prev,
      requiredPpe: [...prev.requiredPpe, newPpe]
    }));
    setNewPpeText('');
  };

  const handleRemoveCustomPpe = (id: string) => {
    setFormData(prev => ({
      ...prev,
      requiredPpe: prev.requiredPpe.filter(p => p.id !== id)
    }));
  };

  // 3. Precautions Handlers
  const togglePrecautionSelected = (precId: string) => {
    setFormData(prev => ({
      ...prev,
      precautionsTaken: prev.precautionsTaken.map(p => {
        if (p.id === precId) {
          const newSelected = !p.selected;
          return { ...p, selected: newSelected, missed: newSelected ? false : p.missed };
        }
        return p;
      })
    }));
  };

  const togglePrecautionMissed = (precId: string) => {
    setFormData(prev => ({
      ...prev,
      precautionsTaken: prev.precautionsTaken.map(p => {
        if (p.id === precId) {
          const newMissed = !p.missed;
          return { ...p, missed: newMissed, selected: newMissed ? false : p.selected };
        }
        return p;
      })
    }));
  };

  const handleClearPrecaution = (precId: string) => {
    setFormData(prev => ({
      ...prev,
      precautionsTaken: prev.precautionsTaken.map(p => 
        p.id === precId ? { ...p, selected: false, missed: false } : p
      )
    }));
  };

  const handleAddCustomPrecaution = (asMissed = false) => {
    if (!newPrecautionText.trim()) return;
    const customId = `custom_prec_${Date.now()}`;
    const newPrec: PrecautionItem = {
      id: customId,
      labelFa: newPrecautionText.trim(),
      selected: !asMissed,
      missed: asMissed,
      isCustom: true
    };
    setFormData(prev => ({
      ...prev,
      precautionsTaken: [...prev.precautionsTaken, newPrec]
    }));
    setNewPrecautionText('');
  };

  const handleRemoveCustomPrecaution = (id: string) => {
    setFormData(prev => ({
      ...prev,
      precautionsTaken: prev.precautionsTaken.filter(p => p.id !== id)
    }));
  };

  // Helper to compress images on client side and parse PDFs safely
  const processAndCompressAttachmentFile = async (file: File): Promise<{ dataUrl: string; size: number }> => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, size: file.size };
    }
    const { dataUrl, sizeBytes } = await compressImageFile(file);
    return { dataUrl, size: sizeBytes };
  };

  // Process uploaded files (images and PDFs)
  const handleProcessFiles = async (files: FileList | File[]) => {
    setUploadError(null);
    setIsProcessingFiles(true);
    const fileArray = Array.from(files);

    if (fileArray.length === 0) {
      setIsProcessingFiles(false);
      return;
    }

    const validFiles = fileArray.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return isImage || isPdf;
    });

    if (validFiles.length === 0) {
      setUploadError('تنها فایل‌های تصویری (PNG, JPG, JPEG, WEBP) یا فایل‌های PDF مجاز می‌باشند.');
      setIsProcessingFiles(false);
      return;
    }

    const nowJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    try {
      const newAttachments: PtwAuditAttachment[] = [];
      for (const file of validFiles) {
        if (file.size > 20 * 1024 * 1024) {
          setUploadError(`حجم فایل «${file.name}» بیشتر از سقف مجاز است.`);
          continue;
        }

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        const { dataUrl, size } = await processAndCompressAttachmentFile(file);

        if (dataUrl) {
          newAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            type: isImage ? 'image' : (isPdf ? 'pdf' : 'other'),
            mimeType: isImage ? 'image/jpeg' : (file.type || 'application/pdf'),
            size,
            dataUrl,
            uploadedAt: `${nowJalali} ${nowTime}`,
            description: ''
          });
        }
      }

      if (newAttachments.length > 0) {
        setFormData(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), ...newAttachments]
        }));
      }
    } catch (err) {
      console.error('Error processing attachments:', err);
      setUploadError('خطا در بارگذاری و پردازش پیوست‌ها.');
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter(a => a.id !== attachmentId)
    }));
  };

  const handleUpdateAttachmentDescription = (attachmentId: string, description: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).map(a => 
        a.id === attachmentId ? { ...a, description } : a
      )
    }));
  };

  const handleSave = (statusOverride?: AuditLifecycleStatus) => {
    const finalRecord: PtwAuditRecord = {
      ...formData,
      status: statusOverride || formData.status,
      passedCount: metrics.passedCount,
      defectsCount: metrics.defectsCount,
      naCount: metrics.naCount,
      complianceScore: metrics.complianceScore,
      updatedAt: new Date().toISOString()
    };
    onSave(finalRecord);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-2 sm:p-4">
      <div 
        dir="rtl"
        className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[94vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ========================================================================= */}
        {/* Modal Header */}
        {/* ========================================================================= */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {formData.id.startsWith('ptw-aud-') && formData.inspectionItems.some(i => i.status) ? 'ویرایش فرم ممیزی پروانه کار (Audit permit)' : 'ثبت ممیزی جدید پروانه کار (Audit permit)'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-mono">
                  {formData.documentCode || 'REG-HSE-FO-024'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                فرم ارزیابی انطباق، ایزولاسیون، الزامات HSE و ایمنی صدور پروانه‌های کار گرم، سرد و ورود به فضای بسته
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick score pill */}
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black ${
              metrics.complianceScore >= 95 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' :
              metrics.complianceScore >= 80 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' :
              'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
            }`}>
              <span>درصد انطباق:</span>
              <span className="font-mono text-sm">{metrics.complianceScore}%</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Navigation Tabs Bar */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveFormTab('info')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeFormTab === 'info'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>مشخصات پرمیت و ۴ امضاکننده</span>
          </button>

          <button
            onClick={() => setActiveFormTab('checklist')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeFormTab === 'checklist'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>چک‌لیست بازرسی کنترلی</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-mono">
              {metrics.passedCount + metrics.defectsCount + metrics.naCount}/30
            </span>
          </button>

          <button
            onClick={() => setActiveFormTab('hazards_ppe')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeFormTab === 'hazards_ppe'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>خطرات محیط، PPE و پیش‌بینی‌ها</span>
          </button>

          <button
            onClick={() => setActiveFormTab('attachments')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeFormTab === 'attachments'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span>مستندات و پیوست‌ها (عکس / PDF)</span>
            {(formData.attachments?.length || 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold">
                {formData.attachments?.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFormTab('conclusion')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeFormTab === 'conclusion'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>گزارش نهایی و امضاء واحد ایمنی</span>
            {metrics.defectsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                {metrics.defectsCount} نقص
              </span>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* Tab Content Container */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ───────────────────────────────────────────────────────────────────── */}
          {/* TAB 1: Redesigned Checklist (Clean Persian User Interface) */}
          {/* ───────────────────────────────────────────────────────────────────── */}
          {activeFormTab === 'checklist' && (
            <div className="space-y-4">
              
              {/* Controls Header & Quick Actions */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                
                {/* Status Badges & Explanation */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    وضعیت هر آیتم:
                  </span>
                  
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>مطلوب (انطباق)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>نامطلوب (عدم انطباق / نقص)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>عدم شمول (نامرتبط)</span>
                    </span>
                  </div>
                </div>

                {/* Batch Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBatchSetStatus('P')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>تایید همه به «مطلوب»</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchSetStatus('-')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تنظیم همه به «عدم شمول»</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو در متن سئوالات یا توضیحات..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs font-bold">
                  <span className="text-slate-500 text-[11px] shrink-0">فیلتر:</span>
                  <button
                    type="button"
                    onClick={() => setChecklistFilter('ALL')}
                    className={`px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap ${
                      checklistFilter === 'ALL' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    همه (۳۰)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistFilter('PASS')}
                    className={`px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap ${
                      checklistFilter === 'PASS' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    مطلوب ({metrics.passedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistFilter('DEFECT')}
                    className={`px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap ${
                      checklistFilter === 'DEFECT' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    دارای نقص ({metrics.defectsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistFilter('NA')}
                    className={`px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap ${
                      checklistFilter === 'NA' ? 'bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    عدم شمول ({metrics.naCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistFilter('UNANSWERED')}
                    className={`px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap ${
                      checklistFilter === 'UNANSWERED' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-amber-600'
                    }`}
                  >
                    پاسخ داده نشده ({30 - (metrics.passedCount + metrics.defectsCount + metrics.naCount)})
                  </button>
                </div>
              </div>

              {/* 30 Items Interactive Redesigned Cards Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInspectionItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    موردی با شرایط فیلتر انتخاب شده یافت نشد.
                  </div>
                ) : (
                  filteredInspectionItems.map((item) => {
                    const isPassed = item.status === 'P' || item.status === 'PASS';
                    const isDefect = item.status === 'O' || item.status === 'DEFECT';
                    const isNA = item.status === '-' || item.status === 'NA';

                    return (
                      <div 
                        key={item.id}
                        className={`p-4 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                          isDefect ? 'bg-rose-50/60 dark:bg-rose-950/20 border-r-4 border-rose-500' : 
                          isPassed ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-r-4 border-emerald-500/40' : 
                          isNA ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-r-4 border-slate-300 dark:border-slate-700' :
                          'hover:bg-amber-50/30 dark:hover:bg-slate-800/20 border-r-4 border-amber-300'
                        }`}
                      >
                        {/* Question Text */}
                        <div className="flex items-start gap-3 flex-1">
                          <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            {item.questionNumber}
                          </span>
                          <div className="space-y-1">
                            <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">
                              {item.questionFa}
                            </div>
                            {item.category && (
                              <span className="inline-block text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Interactive Status Segmented Controls & Notes */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                          
                          {/* Segmented Persian Status Buttons */}
                          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
                            
                            {/* مطلوب (Pass) */}
                            <button
                              type="button"
                              onClick={() => handleUpdateItemStatus(item.id, 'P')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                isPassed 
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>مطلوب</span>
                            </button>

                            {/* نامطلوب (Defect) */}
                            <button
                              type="button"
                              onClick={() => handleUpdateItemStatus(item.id, 'O')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                isDefect 
                                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>نامطلوب</span>
                            </button>

                            {/* عدم شمول (N/A) */}
                            <button
                              type="button"
                              onClick={() => handleUpdateItemStatus(item.id, '-')}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                                isNA 
                                  ? 'bg-slate-600 text-white shadow-sm ring-2 ring-slate-400' 
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>عدم شمول</span>
                            </button>
                          </div>

                          {/* Item Remarks Input */}
                          <input
                            type="text"
                            placeholder="توضیحات، شماره اقدام یا شرح نقص..."
                            value={item.remarks}
                            onChange={(e) => handleUpdateItemRemarks(item.id, e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────── */}
          {/* TAB 2: Permit Metadata & 4 Signers (Including HSE Unit Signer) */}
          {/* ───────────────────────────────────────────────────────────────────── */}
          {activeFormTab === 'info' && (
            <div className="space-y-6">
              
              {/* Document Code, Date, Time, Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    کد سند فرم
                  </label>
                  <input
                    type="text"
                    value={formData.documentCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, documentCode: e.target.value }))}
                    className="w-full text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    شماره بازنگری
                  </label>
                  <input
                    type="text"
                    value={formData.revisionNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, revisionNumber: e.target.value }))}
                    className="w-full text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    تاریخ ممیزی
                  </label>
                  <PersianDatePicker
                    value={formData.auditDate}
                    onChange={(jalaliStr) => setFormData(prev => ({ ...prev, auditDate: jalaliStr }))}
                    isFa={isFa}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    ساعت ممیزی
                  </label>
                  <input
                    type="text"
                    placeholder="10:30"
                    value={formData.auditTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, auditTime: e.target.value }))}
                    className="w-full text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </div>

              {/* Unit, Sub-unit, Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    واحد سازمانی
                  </label>
                  <select
                    value={formData.unitName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitName: e.target.value, subUnitName: '' }))}
                    className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">-- انتخاب واحد سازمانی --</option>
                    {unifiedUnits.length === 0 && (
                      <option value="" disabled>هیچ واحدی در ساختار سازمانی تعریف نشده است</option>
                    )}
                    {unifiedUnits.map(u => (
                      <option key={u.id} value={u.name}>
                        {u.fullPath && u.fullPath !== u.name ? `${u.name} (${u.fullPath})` : u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    زیرمجموعه / بخش واحد (تکمیل دستی)
                  </label>
                  <input
                    type="text"
                    placeholder="نام زیرمجموعه، بخش، تجهیز یا موقعیت..."
                    value={formData.subUnitName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, subUnitName: e.target.value }))}
                    className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {availableSubUnits.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400">پیشنهادات:</span>
                      {availableSubUnits.map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, subUnitName: sub }))}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                            formData.subUnitName === sub
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شیفت کاری
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData(prev => ({ ...prev, shift: e.target.value }))}
                    className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="روزکار (DAY)">روزکار (DAY)</option>
                    <option value="شب‌کار (NIGHT)">شب‌کار (NIGHT)</option>
                    <option value="شیفت A">شیفت A</option>
                    <option value="شیفت B">شیفت B</option>
                    <option value="شیفت C">شیفت C</option>
                    <option value="شیفت D">شیفت D</option>
                  </select>
                </div>

              </div>

              {/* Primary Permit Type & Permit Number */}
              <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 space-y-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-800/40 pb-2.5">
                  <div className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <span>۱. نوع پروانه کار اصلی (Primary Permit) و شماره ثبت پرمیت</span>
                  </div>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    پرمیت اصلی مبنای صدور (گرم یا سرد)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, permitType: 'HOT' }))}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-black transition cursor-pointer ${
                      formData.permitType === 'HOT'
                        ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-400'
                    }`}
                  >
                    <Flame className="w-4 h-4 shrink-0" />
                    <span>پروانه کار گرم (Hot Work)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, permitType: 'COLD' }))}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-black transition cursor-pointer ${
                      formData.permitType === 'COLD' || formData.permitType === 'CONFINED_SPACE'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    <Snowflake className="w-4 h-4 shrink-0" />
                    <span>پروانه کار سرد (Cold Work)</span>
                  </button>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      شماره پروانه کار اصلی
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HW-1405-0842 یا CW-1405-0158"
                      value={formData.permitNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, permitNumber: e.target.value }))}
                      className="w-full text-xs font-mono font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* 2. Supplementary / Attached Permits (پروانه کار الحاقی) */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="pt-3 border-t border-amber-200/60 dark:border-amber-800/40 space-y-3">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !formData.hasAttachedPermit;
                          setFormData(prev => ({
                            ...prev,
                            hasAttachedPermit: nextState,
                            attachedPermitType: nextState ? (prev.attachedPermitType && prev.attachedPermitType !== 'NONE' ? prev.attachedPermitType : 'ConfinedSpace') : 'NONE',
                            attachedPermitNumber: nextState ? (prev.attachedPermitNumber || '') : ''
                          }));
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                          formData.hasAttachedPermit
                            ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {formData.hasAttachedPermit ? (
                          <CheckSquare className="w-4 h-4 text-white" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>دارای پروانه کار الحاقی / تکمیلی (Attached Permit)</span>
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ورود به فضای بسته، حفاری، ایزولاسیون مکانیکی/برق، پرتونگاری، جرثقیل و...
                    </span>
                  </div>

                  {formData.hasAttachedPermit && (
                    <div className="p-3.5 bg-white dark:bg-slate-850 rounded-2xl border border-purple-200 dark:border-purple-900/60 shadow-xs space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        
                        {/* Attached Permit Dropdown */}
                        <div>
                          <label className="block text-xs font-bold text-purple-950 dark:text-purple-300 mb-1 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            <span>نوع پروانه کار الحاقی (انتخاب از لیست)</span>
                          </label>
                          <select
                            value={formData.attachedPermitType || 'ConfinedSpace'}
                            onChange={(e) => {
                              const chosen = e.target.value as AttachedPermitType;
                              setFormData(prev => ({
                                ...prev,
                                attachedPermitType: chosen,
                                // If switching to a type, suggest matching prefix if empty
                                attachedPermitNumber: prev.attachedPermitNumber || (chosen === 'ConfinedSpace' ? 'CS-' : chosen === 'Excavation' ? 'EX-' : chosen === 'ElectricalIsolation' ? 'EI-' : chosen === 'ProcessMechanical' ? 'PI-' : chosen === 'Radiation' ? 'RAD-' : 'ATT-')
                              }));
                            }}
                            className="w-full text-xs font-bold bg-purple-50/50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                          >
                            {ATTACHED_PERMIT_OPTIONS.map(opt => (
                              <option key={opt.id} value={opt.id}>
                                {opt.titleFa}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Attached Permit Number */}
                        <div>
                          <label className="block text-xs font-bold text-purple-950 dark:text-purple-300 mb-1 flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-purple-600" />
                            <span>شماره پروانه کار الحاقی (ثبت دستی یا انتخاب از سیستم)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. CS-1405-0319 یا EX-1405-0104"
                            value={formData.attachedPermitNumber || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, attachedPermitNumber: e.target.value }))}
                            className="w-full text-xs font-mono font-black bg-purple-50/50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                      </div>

                      {/* Quick selector from issued permits in PTW module */}
                      {activeSuppPermits.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                            انتخاب سریع از پروانه‌های الحاقی صادر شده در سیستم PTW:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeSuppPermits.map((sp, idx) => (
                              <button
                                key={`${sp.id}-${idx}`}
                                type="button"
                                onClick={() => {
                                  let mappedType: AttachedPermitType = 'ConfinedSpace';
                                  if (sp.category === 'Excavation') mappedType = 'Excavation';
                                  else if (sp.category === 'ProcessMechanical') mappedType = 'ProcessMechanical';
                                  else if (sp.category === 'ElectricalIsolation') mappedType = 'ElectricalIsolation';
                                  else if (sp.category === 'Radiation') mappedType = 'Radiation';
                                  else if (sp.category === 'VehicleCrane') mappedType = 'VehicleCrane';
                                  else if (sp.category === 'WorkingAtHeight') mappedType = 'WorkingAtHeight';

                                  setFormData(prev => ({
                                    ...prev,
                                    hasAttachedPermit: true,
                                    attachedPermitType: mappedType,
                                    attachedPermitNumber: sp.serialNumber
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                                  formData.attachedPermitNumber === sp.serialNumber
                                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-950/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <span className="font-mono text-purple-700 dark:text-purple-300 font-black">{sp.serialNumber}</span>
                                <span>({sp.categoryFa})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>

              </div>

              {/* 4 Signers Block: Area Responsible, Senior Shift, Work Performer, Permit Safety Signer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-black text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>مشخصات و اسامی ۴ امضاء‌کننده برگه پروانه کار (جستجو از لیست پرسنل یا ثبت دستی)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    امضاکننده واحد ایمنی در پرمیت صادر شده
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <PtwPersonnelAutocomplete
                      id="signer_area"
                      label="۱. امضاء‌کننده مسئول محوطه"
                      placeholder="جستجوی پرسنل یا تایپ نام مسئول محوطه..."
                      value={formData.signers.areaResponsibleName}
                      onChange={(val) => setFormData(prev => ({
                        ...prev,
                        signers: { ...prev.signers, areaResponsibleName: val }
                      }))}
                    />
                  </div>

                  <div>
                    <PtwPersonnelAutocomplete
                      id="signer_shift"
                      label="۲. امضاء‌کننده کشیک ارشد"
                      placeholder="جستجوی پرسنل یا تایپ نام کشیک ارشد..."
                      value={formData.signers.seniorShiftSupervisorName}
                      onChange={(val) => setFormData(prev => ({
                        ...prev,
                        signers: { ...prev.signers, seniorShiftSupervisorName: val }
                      }))}
                    />
                  </div>

                  <div>
                    <PtwPersonnelAutocomplete
                      id="signer_performer"
                      label="۳. امضاء‌کننده مجری کار"
                      placeholder="جستجوی پرسنل یا تایپ نام مجری کار..."
                      value={formData.signers.workPerformerName}
                      onChange={(val) => setFormData(prev => ({
                        ...prev,
                        signers: { ...prev.signers, workPerformerName: val }
                      }))}
                    />
                  </div>

                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <PtwPersonnelAutocomplete
                      id="signer_permit_safety"
                      variant="emerald"
                      label="۴. امضاء‌کننده واحد ایمنی در پرمیت"
                      helperText="امضاکننده پروانه"
                      placeholder="جستجوی کارشناس ایمنی صادرکننده پرمیت..."
                      value={formData.signers.safetyUnitSignerName || ''}
                      onChange={(val) => setFormData(prev => ({
                        ...prev,
                        signers: { ...prev.signers, safetyUnitSignerName: val }
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Work Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شرح کامل فعالیت و کار تحت پروانه
                </label>
                <textarea
                  rows={3}
                  placeholder="شرح دقیق عملیات، تجهیزات مورد استفاده، لاین و موقعیت فیزیکی..."
                  value={formData.workDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, workDescription: e.target.value }))}
                  className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────── */}
          {/* TAB 3: Hazards, PPE & Precautions - DUAL SECTIONS (انتخاب‌شده در پروانه / الزامیِ انتخاب‌نشده - عدم انطباق) */}
          {/* ───────────────────────────────────────────────────────────────────── */}
          {activeFormTab === 'hazards_ppe' && (() => {
            const selectedHazards = formData.environmentalHazards.filter(h => h.selected);
            const missedHazards = formData.environmentalHazards.filter(h => h.missed);

            const selectedPpe = formData.requiredPpe.filter(p => p.selected);
            const missedPpe = formData.requiredPpe.filter(p => p.missed);

            const selectedPrecautions = formData.precautionsTaken.filter(p => p.selected);
            const missedPrecautions = formData.precautionsTaken.filter(p => p.missed);

            return (
              <div className="space-y-6">
                
                {/* ───────────────────────────────────────────────────────────── */}
                {/* 1. شرایط خطرناک محیط (Environmental Hazards) */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-amber-500" />
                      <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                          شرایط خطرناک محیط (Environmental Hazards)
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          تفکیک موارد قید شده در پروانه از خطرات الزامیِ قید نشده (عدم انطباق)
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                        {selectedHazards.length} انتخاب در پروانه
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{missedHazards.length} عدم انطباق (الزامیِ انتخاب‌نشده)</span>
                      </span>
                    </div>
                  </div>

                  {/* 1.A: بخش ۱: انتخاب‌شده در پروانه کار */}
                  <div className="p-3.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/40 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-blue-800 dark:text-blue-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>بخش ۱: انتخاب‌شده در پروانه کار (موارد قید شده در برگه پرمیت)</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        {selectedHazards.length} مورد
                      </span>
                    </div>

                    {selectedHazards.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {selectedHazards.map((hazard) => (
                          <div
                            key={hazard.id}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-600 shadow-xs flex items-center justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1">
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                ✓
                              </span>
                              <span className="text-xs font-bold text-blue-950 dark:text-blue-100 truncate">
                                {hazard.labelFa}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleHazardMissed(hazard.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                title="تغییر به عدم انطباق (الزامی ولی انتخاب‌نشده)"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearHazard(hazard.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="حذف انتخاب"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {hazard.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomHazard(hazard.id)}
                                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md cursor-pointer"
                                  title="حذف کامل مورد سفارشی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-dashed border-blue-300 dark:border-blue-800/60 text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">
                        هیچ خطری در پروانه انتخاب نشده است.
                      </div>
                    )}
                  </div>

                  {/* 1.B: بخش ۲: انتخاب‌نشده / مورد نیاز ولی انتخاب نشده (عدم انطباق) */}
                  <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border-2 border-rose-300 dark:border-rose-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>بخش ۲: انتخاب‌نشده / مورد نیاز ولی انتخاب‌نشده در پروانه (عدم انطباق NC)</span>
                      </div>
                      <span className="text-[11px] font-mono font-black bg-rose-600 text-white px-2 py-0.5 rounded-md">
                        {missedHazards.length} عدم انطباق
                      </span>
                    </div>

                    {missedHazards.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {missedHazards.map((hazard) => (
                          <div
                            key={hazard.id}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-500 dark:border-rose-600 shadow-xs flex items-center justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1">
                              <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                ✗
                              </span>
                              <span className="text-xs font-black text-rose-900 dark:text-rose-100 truncate">
                                {hazard.labelFa}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleHazardSelected(hazard.id)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                                title="تغییر به انتخاب‌شده در پروانه"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearHazard(hazard.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="حذف عدم انطباق"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {hazard.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomHazard(hazard.id)}
                                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md cursor-pointer"
                                  title="حذف کامل مورد سفارشی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-dashed border-rose-300 dark:border-rose-800/60 text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">
                        هیچ عدم انطباقی (خطر الزامیِ قید نشده) ثبت نشده است.
                      </div>
                    )}
                  </div>

                  {/* 1.C: فهرست جامع تعیین وضعیت سریع خطرات محیطی */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300">
                      <span>فهرست جامع خطرات محیطی برای تعیین وضعیت در ممیزی:</span>
                      <span className="text-[11px] text-slate-500">
                        کلیک روی دکمه آبی = انتخاب در پروانه | کلیک روی دکمه قرمز = عدم انطباق (الزامیِ قید نشده)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {formData.environmentalHazards.map((hazard) => (
                        <div
                          key={hazard.id}
                          className={`p-2 rounded-xl border text-xs transition flex items-center justify-between gap-1.5 ${
                            hazard.selected 
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700' 
                              : hazard.missed 
                              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className="truncate flex-1 font-bold text-slate-800 dark:text-slate-200">
                            {hazard.labelFa}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleHazardSelected(hazard.id)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                                hazard.selected
                                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              }`}
                              title="انتخاب در پروانه کار"
                            >
                              ✓ پروانه
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleHazardMissed(hazard.id)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                                hazard.missed
                                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              }`}
                              title="الزامی ولی انتخاب نشده (عدم انطباق)"
                            >
                              ⚠️ الزام
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Manual Add Custom Hazard */}
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span>افزودن خطر محیطی جدید:</span>
                      </div>
                      <input
                        type="text"
                        placeholder="مثال: غلظت H2S بالا، ترافیک جرثقیل، ریزش ترنچ..."
                        value={newHazardText}
                        onChange={(e) => setNewHazardText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomHazard(false))}
                        className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddCustomHazard(false)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          + انتخاب در پروانه
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCustomHazard(true)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          + ثبت عدم انطباق
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Optional Custom Hazard Free Textarea */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      توضیحات تکمیلی یا سایر خطرات محیطی اختصاصی (دست‌نویس):
                    </label>
                    <input
                      type="text"
                      placeholder="ثبت سایر شرایط خاص محیطی..."
                      value={formData.customOtherHazardsText || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customOtherHazardsText: e.target.value }))}
                      className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* 2. وسایل استحفاظی فردی مورد نیاز (PPE) */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <HardHat className="w-5 h-5 text-blue-500" />
                      <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                          وسایل استحفاظی فردی مورد نیاز (Required PPE)
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          تفکیک تجهیزات انتخاب‌شده در پروانه از لوازم الزامیِ انتخاب‌نشده (عدم انطباق)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                        {selectedPpe.length} انتخاب در پروانه
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{missedPpe.length} عدم انطباق (الزامیِ انتخاب‌نشده)</span>
                      </span>
                    </div>
                  </div>

                  {/* 2.A: بخش ۱: تجهیزات PPE انتخاب شده در پروانه */}
                  <div className="p-3.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/40 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-blue-800 dark:text-blue-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>بخش ۱: انتخاب‌شده در پروانه کار (تجهیزات PPE قید شده در پروانه)</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        {selectedPpe.length} قلم
                      </span>
                    </div>

                    {selectedPpe.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {selectedPpe.map((ppe) => (
                          <div
                            key={ppe.id}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-600 shadow-xs flex items-center justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1">
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                ✓
                              </span>
                              <div className="truncate">
                                <div className="text-xs font-bold text-blue-950 dark:text-blue-100 truncate">{ppe.labelFa}</div>
                                <div className="text-[9px] font-normal text-blue-500 dark:text-blue-400">{ppe.groupFa}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => togglePpeMissed(ppe.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                title="تغییر به عدم انطباق (الزامی ولی انتخاب‌نشده)"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearPpe(ppe.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="حذف انتخاب"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {ppe.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomPpe(ppe.id)}
                                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md cursor-pointer"
                                  title="حذف کامل مورد سفارشی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-dashed border-blue-300 dark:border-blue-800/60 text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">
                        هنوز تجهیزی در پروانه انتخاب نشده است.
                      </div>
                    )}
                  </div>

                  {/* 2.B: بخش ۲: تجهیزات PPE الزامی ولی انتخاب نشده در پروانه (عدم انطباق) */}
                  <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border-2 border-rose-300 dark:border-rose-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>بخش ۲: انتخاب‌نشده / مورد نیاز ولی انتخاب‌نشده در پروانه (عدم انطباق PPE)</span>
                      </div>
                      <span className="text-[11px] font-mono font-black bg-rose-600 text-white px-2 py-0.5 rounded-md">
                        {missedPpe.length} عدم انطباق
                      </span>
                    </div>

                    {missedPpe.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {missedPpe.map((ppe) => (
                          <div
                            key={ppe.id}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-500 dark:border-rose-600 shadow-xs flex items-center justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1">
                              <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                ✗
                              </span>
                              <div className="truncate">
                                <div className="text-xs font-black text-rose-900 dark:text-rose-100 truncate">{ppe.labelFa}</div>
                                <div className="text-[9px] font-normal text-rose-600 dark:text-rose-400">{ppe.groupFa}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => togglePpeSelected(ppe.id)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                                title="تغییر به انتخاب‌شده در پروانه"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearPpe(ppe.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="حذف عدم انطباق"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {ppe.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomPpe(ppe.id)}
                                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md cursor-pointer"
                                  title="حذف کامل مورد سفارشی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-dashed border-rose-300 dark:border-rose-800/60 text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">
                        هیچ عدم انطباقی (تجهیز الزامیِ قید نشده) ثبت نشده است.
                      </div>
                    )}
                  </div>

                  {/* 2.C: فهرست جامع تعیین وضعیت سریع PPE */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300">
                      <span>فهرست جامع تجهیزات حفاظت فردی (PPE) برای تعیین وضعیت در ممیزی:</span>
                      <span className="text-[11px] text-slate-500">
                        کلیک روی دکمه آبی = انتخاب در پروانه | کلیک روی دکمه قرمز = عدم انطباق (الزامیِ قید نشده)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {formData.requiredPpe.map((ppe) => (
                        <div
                          key={ppe.id}
                          className={`p-2 rounded-xl border text-xs transition flex items-center justify-between gap-1.5 ${
                            ppe.selected 
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700' 
                              : ppe.missed 
                              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="truncate flex-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{ppe.labelFa}</div>
                            <div className="text-[9px] text-slate-400">{ppe.groupFa}</div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => togglePpeSelected(ppe.id)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                                ppe.selected
                                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              }`}
                              title="انتخاب در پروانه کار"
                            >
                              ✓ پروانه
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePpeMissed(ppe.id)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                                ppe.missed
                                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              }`}
                              title="الزامی ولی انتخاب نشده (عدم انطباق)"
                            >
                              ⚠️ الزام
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Manual Add Custom PPE */}
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        <Plus className="w-3.5 h-3.5 text-blue-500" />
                        <span>افزودن تجهیز PPE جدید:</span>
                      </div>
                      <input
                        type="text"
                        placeholder="مثال: لنیارد شوک‌گیر دوتایی، پیش‌بند سربی، گتر چرمی..."
                        value={newPpeText}
                        onChange={(e) => setNewPpeText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomPpe(false))}
                        className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddCustomPpe(false)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          + انتخاب در پروانه
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCustomPpe(true)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          + ثبت عدم انطباق
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Optional Custom PPE Free Text */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      سایر وسایل استحفاظی و توضیحات تکمیلی PPE (دست‌نویس):
                    </label>
                    <input
                      type="text"
                      placeholder="ثبت سایر تجهیزات حفاظت فردی مورد نیاز..."
                      value={formData.customOtherPpeText || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customOtherPpeText: e.target.value }))}
                      className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* 3. پیش‌بینی‌های در نظر گرفته شده و اقدامات کنترلی */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-emerald-500" />
                      <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                          پیش‌بینی‌های در نظر گرفته شده و تمهیدات ایمنی (Precautions Taken)
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          تفکیک تمهیدات تایید شده در پروانه از اقدامات الزامیِ انتخاب‌نشده (عدم انطباق)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                        {selectedPrecautions.length} انتخاب در پروانه
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{missedPrecautions.length} عدم انطباق (الزامیِ انتخاب‌نشده)</span>
                      </span>
                    </div>
                  </div>

                  {/* 3.A: بخش ۱: تمهیدات و پیش‌بینی‌های انتخاب شده در پروانه */}
                  <div className="p-3.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/40 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-blue-800 dark:text-blue-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>بخش ۱: انتخاب‌شده در پروانه کار (تمهیدات قید شده در پروانه)</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        {selectedPrecautions.length} اقدام
                      </span>
                    </div>

                    {selectedPrecautions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedPrecautions.map((prec) => (
                          <div
                            key={prec.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-600 shadow-xs flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 truncate flex-1">
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                ✓
                              </span>
                              <span className="text-xs font-bold text-blue-950 dark:text-blue-100 leading-snug">
                                {prec.labelFa}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => togglePrecautionMissed(prec.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                title="تغییر به عدم انطباق (الزامی ولی انتخاب‌نشده)"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearPrecaution(prec.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="حذف انتخاب"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {prec.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomPrecaution(prec.id)}
                                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md cursor-pointer"
                                  title="حذف کامل اقدام سفارشی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-dashed border-blue-300 dark:border-blue-800/60 text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">
                        هیچ تمهیدی در پروانه انتخاب نشده است.
                      </div>
                    )}
                  </div>

                  {/* 3.B: بخش ۲: تمهیدات الزامی ولی انتخاب نشده در پروانه (عدم انطباق) */}
                  <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border-2 border-rose-300 dark:border-rose-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>بخش ۲: انتخاب‌نشده / مورد نیاز ولی انتخاب‌نشده در پروانه (عدم انطباق تمهیدات)</span>
                      </div>
                      <span className="text-[11px] font-mono font-black bg-rose-600 text-white px-2 py-0.5 rounded-md">
                        {missedPrecautions.length} عدم انطباق
                      </span>
                    </div>

                    {missedPrecautions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {missedPrecautions.map((prec) => (
                          <div
                            key={prec.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-500 dark:border-rose-600 shadow-xs flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 truncate flex-1">
                              <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                ✗
                              </span>
                              <span className="text-xs font-black text-rose-900 dark:text-rose-100 leading-snug">
                                {prec.labelFa}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => togglePrecautionSelected(prec.id)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                                title="تغییر به انتخاب‌شده در پروانه"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearPrecaution(prec.id)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="حذف عدم انطباق"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {prec.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomPrecaution(prec.id)}
                                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md cursor-pointer"
                                  title="حذف کامل اقدام سفارشی"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 px-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-dashed border-rose-300 dark:border-rose-800/60 text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">
                        هیچ عدم انطباقی (تمهید الزامیِ قید نشده) ثبت نشده است.
                      </div>
                    )}
                  </div>

                  {/* 3.C: فهرست جامع تعیین وضعیت سریع تمهیدات */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300">
                      <span>فهرست جامع تمهیدات و پیش‌بینی‌ها برای تعیین وضعیت در ممیزی:</span>
                      <span className="text-[11px] text-slate-500">
                        کلیک روی دکمه آبی = انتخاب در پروانه | کلیک روی دکمه قرمز = عدم انطباق (الزامیِ قید نشده)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {formData.precautionsTaken.map((prec) => (
                        <div
                          key={prec.id}
                          className={`p-2.5 rounded-xl border text-xs transition flex items-center justify-between gap-2 ${
                            prec.selected 
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700' 
                              : prec.missed 
                              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className="leading-snug flex-1 font-bold text-slate-800 dark:text-slate-200">
                            {prec.labelFa}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => togglePrecautionSelected(prec.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                                prec.selected
                                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              }`}
                              title="انتخاب در پروانه کار"
                            >
                              ✓ پروانه
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePrecautionMissed(prec.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-black transition cursor-pointer border ${
                                prec.missed
                                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              }`}
                              title="الزامی ولی انتخاب نشده (عدم انطباق)"
                            >
                              ⚠️ الزام
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Manual Add Custom Precaution */}
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        <Plus className="w-3.5 h-3.5 text-emerald-500" />
                        <span>افزودن اقدام و تمهید جدید:</span>
                      </div>
                      <input
                        type="text"
                        placeholder="مثال: استقرار خودرو آتش‌نشانی، نصب توری ضد جرقه روی کانال..."
                        value={newPrecautionText}
                        onChange={(e) => setNewPrecautionText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomPrecaution(false))}
                        className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddCustomPrecaution(false)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          + انتخاب در پروانه
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCustomPrecaution(true)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          + ثبت عدم انطباق
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Optional Custom Precaution Free Text */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      سایر تمهیدات و پیش‌بینی‌های تکمیلی (دست‌نویس):
                    </label>
                    <input
                      type="text"
                      placeholder="ثبت سایر تمهیدات و اقدامات کنترلی..."
                      value={formData.customOtherPrecautionsText || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customOtherPrecautionsText: e.target.value }))}
                      className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

              </div>
            );
          })()}

          {/* ───────────────────────────────────────────────────────────────────── */}
          {/* TAB 4: Attachments (پیوست‌ها، تصاویر و اسناد PDF) */}
          {/* ───────────────────────────────────────────────────────────────────── */}
          {activeFormTab === 'attachments' && (
            <div className="space-y-6">
              
              {/* Informational Header */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      مستندات، عکس‌ها و فایل‌های پیوست ممیزی (Evidence & Attachments)
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      تصاویر موقعیت کار، پروانه کار اسکن‌شده، برگه گازسنجی، برچسب‌های Lockout/Tagout و مستندات PDF مرتبط را در این بخش پیوست نمایید.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <label 
                    htmlFor="ptw-file-input-btn"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>انتخاب و الصاق فایل جدید</span>
                  </label>
                  <input
                    id="ptw-file-input-btn"
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleProcessFiles(e.target.files);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Error Alert */}
              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleProcessFiles(e.dataTransfer.files);
                  }
                }}
                className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 scale-[0.99]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  id="ptw-dropzone-input"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleProcessFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                    {isProcessingFiles ? (
                      <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UploadCloud className="w-7 h-7" />
                    )}
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      تصاویر یا فایل‌های PDF را به این کادر بکشید و رها کنید (Drag & Drop)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      یا برای انتخاب از حافظه دستگاه روی دکمه زیر کلیک کنید
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <label
                      htmlFor="ptw-dropzone-input"
                      className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                    >
                      مرور و انتخاب فایل‌ها (Browse)
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-400 font-medium pt-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80">تصاویر JPG, PNG, WEBP</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80">اسناد PDF</span>
                    <span>•</span>
                    <span>حداکثر ۱۵ مگابایت برای هر فایل</span>
                  </div>
                </div>
              </div>

              {/* Attachments List & Gallery */}
              {formData.attachments && formData.attachments.length > 0 ? (
                <div className="space-y-4">
                  {/* Status Bar */}
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">فایل‌های پیوست شده:</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold font-mono text-xs">
                        {formData.attachments.length} فایل
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      حجم کل: {formatFileSize(formData.attachments.reduce((acc, curr) => acc + (curr.size || 0), 0))}
                    </div>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {formData.attachments.map((att, index) => {
                      const isImg = att.type === 'image' || att.mimeType.startsWith('image/');
                      const isPdf = att.type === 'pdf' || att.mimeType.includes('pdf');

                      return (
                        <div
                          key={att.id}
                          className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition space-y-3"
                        >
                          {/* File Preview Area */}
                          <div className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 aspect-video flex items-center justify-center">
                            {isImg ? (
                              <>
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalAttachment(att)}
                                  className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold cursor-pointer"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                  <span>بزرگ‌نمایی عکس</span>
                                </button>
                              </>
                            ) : isPdf ? (
                              <div className="flex flex-col items-center justify-center p-3 text-center space-y-1.5">
                                <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                                  <FileText className="w-6 h-6" />
                                </div>
                                <span className="text-[11px] font-black text-rose-700 dark:text-rose-300 font-mono">
                                  PDF DOCUMENT
                                </span>
                              </div>
                            ) : (
                              <FileCheck className="w-8 h-8 text-slate-400" />
                            )}

                            {/* Badge */}
                            <div className="absolute top-2 right-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs ${
                                isImg 
                                  ? 'bg-amber-600 text-white' 
                                  : 'bg-rose-600 text-white'
                              }`}>
                                {isImg ? 'تصویر' : 'سند PDF'}
                              </span>
                            </div>
                          </div>

                          {/* File Info */}
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={att.name}>
                              {att.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span>{formatFileSize(att.size)}</span>
                              <span>{att.uploadedAt}</span>
                            </div>
                          </div>

                          {/* Editable Description */}
                          <div>
                            <input
                              type="text"
                              placeholder="توضیح یا عنوان پیوست (اختیاری)..."
                              value={att.description || ''}
                              onChange={(e) => handleUpdateAttachmentDescription(att.id, e.target.value)}
                              className="w-full text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                            <div className="flex items-center gap-1">
                              {isImg ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalAttachment(att)}
                                  className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                  title="نمایش تمام‌صفحه تصویر"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <a
                                  href={att.dataUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                  title="مشاهده سند PDF"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              <a
                                href={att.dataUrl}
                                download={att.name}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                title="دریافت فایل"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(att.id)}
                              className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاکنون هیچ تصویر یا سند PDF به این ممیزی پیوست نشده است
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    برای ضمیمه کردن مستندات نظارت میدانی، عکس پروانه‌های کار یا تگ‌های ایمنی از کادر بالا استفاده فرمایید.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────── */}
          {/* TAB 5: Conclusion, Findings & HSE Sign-off */}
          {/* ───────────────────────────────────────────────────────────────────── */}
          {activeFormTab === 'conclusion' && (
            <div className="space-y-6">
              
              {/* Score & Compliance Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">موارد مطلوب (انطباق)</div>
                  <div className="text-2xl font-mono font-black text-emerald-800 dark:text-emerald-200 mt-1">
                    {metrics.passedCount}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">منطبق بر ضوابط ایمنی</div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-300">موارد دارای نقص (عدم انطباق)</div>
                  <div className="text-2xl font-mono font-black text-rose-800 dark:text-rose-200 mt-1">
                    {metrics.defectsCount}
                  </div>
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">نیازمند اقدام اصلاحی فوری</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">موارد عدم شمول (نامرتبط)</div>
                  <div className="text-2xl font-mono font-black text-slate-800 dark:text-slate-200 mt-1">
                    {metrics.naCount}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">خارج از دامنه عملیات فعلی</div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-300">شاخص انطباق نهایی</div>
                  <div className="text-2xl font-mono font-black text-amber-800 dark:text-amber-200 mt-1">
                    {metrics.complianceScore}%
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                    {metrics.complianceScore >= 90 ? 'سطح ایمنی عالی' : 'نیازمند نظارت ویژه میدانی'}
                  </div>
                </div>

              </div>

              {/* Audit Summary Report Textarea & Defect Auto-Generation Controls */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span>گزارش ممیزی اجرای سیستم پروانه کار (Audit Summary Report)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      موارد نامطلوب چک‌لیست و عدم انطباق‌ها به صورت خودکار، خط به خط و شماره‌گذاری شده در این کادر قرار می‌گیرند و به صورت کامل قابل ویرایش و پیرایش هستند.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateDefectReport(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      title="بازتولید گزارش خط به خط شماره‌گذاری شده بر اساس موارد نامطلوب چک‌لیست و تمهیدات"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تولید و بروزرسانی خودکار گزارش عدم انطباق‌ها</span>
                    </button>

                    {formData.auditSummaryReport && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, auditSummaryReport: '' }))}
                        className="text-xs text-slate-400 hover:text-rose-500 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-300 transition cursor-pointer"
                      >
                        پاک‌سازی
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={6}
                  placeholder="گزارش ممیزی اجرای سیستم پروانه کار، عدم انطباق‌های مشاهده شده، الزامات اصلاحی و شرایط ایمنی..."
                  value={formData.auditSummaryReport}
                  onChange={(e) => setFormData(prev => ({ ...prev, auditSummaryReport: e.target.value }))}
                  className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                  dir="rtl"
                />
              </div>

              {/* Non-conformances / Defects Description */}
              {metrics.defectsCount > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-rose-800 dark:text-rose-200">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>اقدامات اصلاحی اختصاصی و مهلت رفع نقص</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
                      {metrics.defectsCount} مورد عدم انطباق شناسایی شده
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="شرح مهلت رفع نقص و مسئول پیگیری اقدامات اصلاحی..."
                    value={formData.defectsAndNonConformances || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, defectsAndNonConformances: e.target.value }))}
                    className="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-xl p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
                  />
                </div>
              )}

              {/* Attachments Summary Widget */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <Paperclip className="w-4 h-4 text-amber-500" />
                    <span>مستندات و عکس‌های ضمیمه شده به ممیزی</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold font-mono text-[10px]">
                      {formData.attachments?.length || 0} فایل
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveFormTab('attachments')}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>مدیریت یا افزودن پیوست</span>
                  </button>
                </div>

                {formData.attachments && formData.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.attachments.map((att) => (
                      <div
                        key={att.id}
                        onClick={() => att.type === 'image' && setPreviewModalAttachment(att)}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:border-blue-400 transition"
                      >
                        {att.type === 'image' ? (
                          <FileImage className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span className="text-[11px] truncate max-w-[140px]">{att.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(att.size)})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>هنوز عکسی یا سندی ضمیمه نشده است. برای پیوست اسناد می‌توانید از تب «مستندات و پیوست‌ها» استفاده کنید.</span>
                  </div>
                )}
              </div>

              {/* HSE Unit Signature Sign-off Box */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-black text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>تایید و امضاء کارشناس / نماینده ممیزی‌کننده واحد ایمنی (HSE)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    ثبت‌کننده ممیزی (نام ممیز مستقل از امضاکننده پرمیت است)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <PtwPersonnelAutocomplete
                      id="hse_auditor_name"
                      variant="emerald"
                      label="نام کارشناس / نماینده ممیزی‌کننده HSE"
                      placeholder="جستجوی نام کارشناس HSE از لیست پرسنل یا ثبت دستی..."
                      value={formData.hseAuditor.auditorName}
                      onChange={(val) => setFormData(prev => ({
                        ...prev,
                        hseAuditor: { ...prev.hseAuditor, auditorName: val }
                      }))}
                      onSelectPersonnel={(person) => {
                        setFormData(prev => ({
                          ...prev,
                          hseAuditor: {
                            ...prev.hseAuditor,
                            auditorName: person.fullName || `${person.firstName} ${person.lastName}`.trim(),
                            auditorId: person.personnelCode || person.effectiveCode || prev.hseAuditor.auditorId
                          }
                        }));
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      کد پرسنلی / شناسه ممیز
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: HSE-408"
                      value={formData.hseAuditor.auditorId || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hseAuditor: { ...prev.hseAuditor, auditorId: e.target.value }
                      }))}
                      className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      تاریخ تاییدیه و امضاء
                    </label>
                    <PersianDatePicker
                      value={signatureDate}
                      onChange={(jalaliStr) => {
                        setSignatureDate(jalaliStr);
                        setFormData(prev => ({
                          ...prev,
                          hseAuditor: { ...prev.hseAuditor, signedAt: `${jalaliStr} ${signatureTime}` }
                        }));
                      }}
                      isFa={isFa}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                        ساعت تاییدیه و امضاء
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="10:30"
                      value={signatureTime}
                      onChange={(e) => {
                        const t = e.target.value;
                        setSignatureTime(t);
                        setFormData(prev => ({
                          ...prev,
                          hseAuditor: { ...prev.hseAuditor, signedAt: `${signatureDate} ${t}` }
                        }));
                      }}
                      className="w-full text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="confirmHseSign"
                      checked={formData.hseAuditor.isSigned}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hseAuditor: { ...prev.hseAuditor, isSigned: e.target.checked }
                      }))}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                    <label htmlFor="confirmHseSign" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      تایید میدانی و امضاء دیجیتال توسط کارشناس ممیزی واحد ایمنی (HSE) در سیستم ثبت گردد
                    </label>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* Modal Footer Actions */}
        {/* ========================================================================= */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>وضعیت نهایی فرم:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {metrics.defectsCount > 0 ? 'دارای عدم انطباق' : 'منطبق و تایید شده'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={() => handleSave('DRAFT')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 transition cursor-pointer"
            >
              ذخیره به عنوان پیش‌نویس
            </button>

            <button
              type="button"
              onClick={() => handleSave(metrics.defectsCount > 0 ? 'CRITICAL_NC' : 'FINALIZED')}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-lg shadow-amber-600/30 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ثبت و تایید نهایی ممیزی</span>
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* Lightbox / Full Image Preview Modal */}
      {/* ========================================================================= */}
      {previewModalAttachment && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewModalAttachment(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="px-4 py-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <FileImage className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold truncate max-w-xs sm:max-w-md">
                  {previewModalAttachment.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({formatFileSize(previewModalAttachment.size)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewModalAttachment.dataUrl}
                  download={previewModalAttachment.name}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                  title="دانلود تصویر"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalAttachment(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image Body */}
            <div className="flex-1 overflow-auto p-2 bg-slate-950/80 flex items-center justify-center">
              <img
                src={previewModalAttachment.dataUrl}
                alt={previewModalAttachment.name}
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>

            {/* Description Footer */}
            {previewModalAttachment.description && (
              <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-amber-400">توضیح: </span>
                <span>{previewModalAttachment.description}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

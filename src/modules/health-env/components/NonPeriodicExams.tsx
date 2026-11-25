import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, Plus, Search, Filter, Trash2, Edit3, Eye, 
  Calendar, FileText, CheckCircle2, AlertTriangle, Clock, 
  User, Building2, Stethoscope, Paperclip, X, Download, RefreshCw,
  Printer, Maximize2, Minimize2, Upload, ShieldCheck, BarChart3, 
  TrendingUp, HeartPulse, Scale, Brain, Award, CheckSquare, 
  FileSpreadsheet, ChevronRight, ChevronLeft, UserCheck, Users, 
  ArrowUpDown, SlidersHorizontal, MapPin, Briefcase, Phone, Sparkles,
  FileCheck, Image as ImageIcon, ExternalLink, ZoomIn
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { 
  NonPeriodicMedicalExam, 
  NonPeriodicReason, 
  MedicalExamStatus, 
  MedicalExamType,
  MedicalFindings,
  MedicalExamAttachment
} from '../types';
import { healthEnvService } from '../services/healthEnvService';
import { 
  findPersonnelByCode, 
  findPersonnelByNationalCode, 
  getComplexPersonnelList, 
  ComplexPersonnel 
} from '../../../utils/personnelHelper';
import { getUnits, getJobTitles } from '../../../utils/orgHelper';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import { printService } from '../../../services/printService';
import { getSystemBrandingConfig } from '../../../utils/systemBrandingHelper';
import { VirtualizedDataTable, VirtualizedColumn } from '../../../components/common/virtualized/VirtualizedDataTable';
import { toast } from 'react-hot-toast';
import { formatFileSize, downloadCsvFile } from '../../../utils/fileHelpers';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

type NonPeriodicTabKey = 'dashboard' | 'exams' | 'register' | 'certificates' | 'reports';

const REASONS_LIST: NonPeriodicReason[] = [
  'معاینه بدو استخدام',
  'بازگشت به کار پس از مرخصی استعلاجی',
  'بازگشت به کار پس از حادثه شغلی',
  'تغییر عنوان شغلی / پست سازمانی',
  'معاینه شکایت پزشکی و علائم بالینی',
  'بررسی مواجهه حاد با آلاینده‌های شغلی',
  'ارزیابی کمیسیون پزشکی'
];

const JOB_RESTRICTIONS_PRESETS = [
  'ممنوعیت کار در ارتفاع (> ۲ متر)',
  'ممنوعیت بلند کردن و جابجایی بار بیش از ۱۰ کیلوگرم',
  'ممنوعیت کار در شیفت شب و نوبت‌کاری متوالی',
  'ممنوعیت مواجهه با حلال‌های آلی و گازهای سمی',
  'ممنوعیت کار در محیط‌های دارای تراز صوتی بیش از ۸۵ دسی‌بل',
  'ممنوعیت رانندگی با وسایل نقلیه سنگین، جرثقیل و لیفتراک',
  'ممنوعیت کار با ماشین‌آلات دوار و فاقد حفاظ',
  'لزوم استفاده مستمر از رسپیراتور تصفیه‌کننده با فیلتر کربن فعال',
  'لزوم رعایت استراحت ارگونومیک هر ۴۵ دقیقه'
];

const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#8b5cf6'];

export default function NonPeriodicExams({ language, currentUser }: Props) {
  const isFa = language === 'fa';
  const [exams, setExams] = useState<NonPeriodicMedicalExam[]>(() => healthEnvService.getAllNonPeriodicExams());
  const [activeTab, setActiveTab] = useState<NonPeriodicTabKey>('dashboard');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('examDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal / Detail states
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [viewingExam, setViewingExam] = useState<NonPeriodicMedicalExam | null>(null);
  const [printingCertificate, setPrintingCertificate] = useState<NonPeriodicMedicalExam | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedPersonnel, setMatchedPersonnel] = useState<ComplexPersonnel | null>(null);
  const [formRestrictionsList, setFormRestrictionsList] = useState<string[]>([]);
  const [customRestrictionInput, setCustomRestrictionInput] = useState('');

  // Attachment states (PDF & Images)
  const [formAttachments, setFormAttachments] = useState<MedicalExamAttachment[]>([]);
  const [attachmentTitleInput, setAttachmentTitleInput] = useState('');
  const [attachmentDescInput, setAttachmentDescInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<MedicalExamAttachment | null>(null);

  const [formData, setFormData] = useState<{
    id?: string;
    recordId: string;
    employeeCode: string;
    employeeName: string;
    nationalCode: string;
    department: string;
    jobTitle: string;
    workplace: string;
    examDate: string;
    reason: NonPeriodicReason;
    examType: MedicalExamType;
    medicalCenter: string;
    doctor: string;
    status: MedicalExamStatus;
    clinicalSymptoms: string;
    recommendations: string;
    description: string;
    returnToWorkDate: string;
    limitations: string;
    // Vital signs & findings
    findings: {
      bloodPressure: string;
      pulseRate?: string;
      heightCm?: number;
      weightKg?: number;
      bmi?: number;
      vision?: string;
      audiometry?: string;
      spirometry?: string;
      ecg?: string;
      bloodTests?: string;
      generalConclusion?: string;
    };
  }>({
    recordId: '',
    employeeCode: '',
    employeeName: '',
    nationalCode: '',
    department: '',
    jobTitle: '',
    workplace: '',
    examDate: new Date().toLocaleDateString('fa-IR'),
    reason: 'بازگشت به کار پس از مرخصی استعلاجی',
    examType: 'بازگشت به کار',
    medicalCenter: 'مرکز بهداری و طب کار مجتمع پتروشیمی',
    doctor: '',
    status: 'fit',
    clinicalSymptoms: '',
    recommendations: '',
    description: '',
    returnToWorkDate: '',
    limitations: '',
    findings: {
      bloodPressure: '120/80',
      pulseRate: '75',
      heightCm: 175,
      weightKg: 78,
      bmi: 25.5,
      vision: 'دید هر دو چشم 10/10 بدون عیب انکساری',
      audiometry: 'شنوایی دو گوش در محدوده نرمال (PTA < 25 dB)',
      spirometry: 'FVC: 95%, FEV1: 92% (الگوی نرمال ریوی)',
      ecg: 'ریتم سینوسی نرمال بدون آریتمی و علائم ایسکمی',
      bloodTests: 'FBS: 88, CBC: Normal, Chol: 185',
      generalConclusion: 'تناسب کامل پزشکی جهت اشتغال در عنوان شغلی مربوطه.'
    }
  });

  // Data reload listeners
  useEffect(() => {
    const handleUpdate = () => {
      setExams(healthEnvService.getAllNonPeriodicExams());
    };
    window.addEventListener('hse_health_env_updated', handleUpdate);
    window.addEventListener('app_data_mutated', handleUpdate);
    return () => {
      window.removeEventListener('hse_health_env_updated', handleUpdate);
      window.removeEventListener('app_data_mutated', handleUpdate);
    };
  }, []);

  const reloadData = () => {
    setExams(healthEnvService.getAllNonPeriodicExams());
  };

  // Personnel search in registration form
  const handleSearchPersonnel = (query: string) => {
    setSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setMatchedPersonnel(null);
      return;
    }
    const clean = query.trim();
    // 1. National code lookup
    let match = findPersonnelByNationalCode(clean);
    // 2. Personnel code lookup
    if (!match) {
      match = findPersonnelByCode(clean);
    }
    // 3. Name lookup in complex personnel list
    if (!match) {
      const all = getComplexPersonnelList();
      match = all.find(p => 
        p.fullName.includes(clean) || 
        p.personnelCode.includes(clean) ||
        (p.nationalCode && p.nationalCode.includes(clean))
      ) || null;
    }

    if (match) {
      setMatchedPersonnel(match);
      setFormData(prev => ({
        ...prev,
        recordId: match.id || prev.recordId,
        employeeCode: match.personnelCode || prev.employeeCode,
        employeeName: match.fullName || `${match.firstName} ${match.lastName}`,
        nationalCode: match.nationalCode || prev.nationalCode,
        department: match.unit || match.department || prev.department,
        jobTitle: match.jobTitle || prev.jobTitle,
        workplace: match.workplace || prev.workplace
      }));
    } else {
      setMatchedPersonnel(null);
    }
  };

  // Auto calculate BMI
  const updateHeightWeight = (height?: number, weight?: number) => {
    const h = height !== undefined ? height : formData.findings.heightCm;
    const w = weight !== undefined ? weight : formData.findings.weightKg;
    let bmiValue: number | undefined = undefined;
    if (h && w && h > 50 && w > 20) {
      const hM = h / 100;
      bmiValue = Number((w / (hM * hM)).toFixed(1));
    }
    setFormData(prev => ({
      ...prev,
      findings: {
        ...prev.findings,
        heightCm: h,
        weightKg: w,
        bmi: bmiValue
      }
    }));
  };

  // Toggle predefined job restriction
  const toggleRestriction = (restriction: string) => {
    let updated: string[];
    if (formRestrictionsList.includes(restriction)) {
      updated = formRestrictionsList.filter(r => r !== restriction);
    } else {
      updated = [...formRestrictionsList, restriction];
    }
    setFormRestrictionsList(updated);
    setFormData(prev => ({
      ...prev,
      limitations: updated.join(' | ')
    }));
  };

  const addCustomRestriction = () => {
    if (!customRestrictionInput.trim()) return;
    const clean = customRestrictionInput.trim();
    if (!formRestrictionsList.includes(clean)) {
      const updated = [...formRestrictionsList, clean];
      setFormRestrictionsList(updated);
      setFormData(prev => ({
        ...prev,
        limitations: updated.join(' | ')
      }));
    }
    setCustomRestrictionInput('');
  };

  // Keyboard listener for Escape to close preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewAttachment) {
          setPreviewAttachment(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAttachment]);

  // Attachment upload and processing (PDF and Images)
  const handleProcessFiles = (files: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    const maxSizeBytes = 15 * 1024 * 1024; // 15MB

    fileArray.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isPdf = ext === 'pdf' || file.type === 'application/pdf';
      const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/');

      if (!isPdf && !isImg) {
        setUploadError(`فرمت فایل «${file.name}» مجاز نمی‌باشد. تنها اسناد PDF و تصاویر (JPG, PNG, WEBP) پشتیبانی می‌شوند.`);
        return;
      }

      if (file.size > maxSizeBytes) {
        setUploadError(`حجم فایل «${file.name}» (${formatFileSize(file.size)}) بیش از سقف مجاز (۱۵ مگابایت) است.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        const fileType = isPdf ? 'pdf' : (ext as any || 'jpg');
        const now = new Date().toLocaleDateString('fa-IR');
        
        const newAtt: MedicalExamAttachment = {
          id: `att-np-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          examId: editingExamId || '',
          recordId: formData.recordId || '',
          examYear: 1405,
          originalFileName: file.name,
          displayName: attachmentTitleInput.trim() || file.name.replace(/\.[^/.]+$/, ''),
          description: attachmentDescInput.trim(),
          fileType: fileType,
          mimeType: file.type || (isPdf ? 'application/pdf' : `image/${fileType}`),
          fileSize: file.size,
          fileSizeFormatted: formatFileSize(file.size),
          fileData: base64Data,
          uploadedAt: now,
          uploadedBy: currentUser?.fullName || currentUser?.username || 'کارشناس بهداشت حرفه‌ای'
        };

        setFormAttachments(prev => [newAtt, ...prev]);
        setAttachmentTitleInput('');
        setAttachmentDescInput('');
      };
      reader.onerror = () => {
        setUploadError(`خطا در پردازش و بارگذاری فایل «${file.name}»`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setFormAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // Reset form to default
  const resetForm = () => {
    setEditingExamId(null);
    setSearchQuery('');
    setMatchedPersonnel(null);
    setFormRestrictionsList([]);
    setCustomRestrictionInput('');
    setFormAttachments([]);
    setAttachmentTitleInput('');
    setAttachmentDescInput('');
    setUploadError(null);
    setFormData({
      recordId: '',
      employeeCode: '',
      employeeName: '',
      nationalCode: '',
      department: '',
      jobTitle: '',
      workplace: '',
      examDate: new Date().toLocaleDateString('fa-IR'),
      reason: 'بازگشت به کار پس از مرخصی استعلاجی',
      examType: 'بازگشت به کار',
      medicalCenter: 'مرکز بهداری و طب کار مجتمع پتروشیمی',
      doctor: '',
      status: 'fit',
      clinicalSymptoms: '',
      recommendations: '',
      description: '',
      returnToWorkDate: '',
      limitations: '',
      findings: {
        bloodPressure: '120/80',
        pulseRate: '75',
        heightCm: 175,
        weightKg: 78,
        bmi: 25.5,
        vision: 'دید هر دو چشم 10/10 بدون عیب انکساری',
        audiometry: 'شنوایی دو گوش در محدوده نرمال (PTA < 25 dB)',
        spirometry: 'FVC: 95%, FEV1: 92% (الگوی نرمال ریوی)',
        ecg: 'ریتم سینوسی نرمال بدون آریتمی و علائم ایسکمی',
        bloodTests: 'FBS: 88, CBC: Normal, Chol: 185',
        generalConclusion: 'تناسب کامل پزشکی جهت اشتغال در عنوان شغلی مربوطه.'
      }
    });
  };

  // Open Edit
  const handleOpenEdit = (exam: NonPeriodicMedicalExam) => {
    setEditingExamId(exam.id);
    const existingRestrictions = exam.limitations 
      ? exam.limitations.split('|').map(s => s.trim()).filter(Boolean)
      : [];
    setFormRestrictionsList(existingRestrictions);
    setFormAttachments(exam.attachments || []);
    setAttachmentTitleInput('');
    setAttachmentDescInput('');
    setUploadError(null);
    setSearchQuery(exam.employeeCode || exam.employeeName);
    setMatchedPersonnel({
      id: exam.recordId,
      personnelCode: exam.employeeCode,
      nationalCode: exam.nationalCode,
      firstName: exam.employeeName.split(' ')[0] || '',
      lastName: exam.employeeName.split(' ').slice(1).join(' ') || '',
      fullName: exam.employeeName,
      unit: exam.department,
      jobTitle: exam.jobTitle,
      department: exam.department,
      gender: 'مرد',
      age: 35
    } as any);

    setFormData({
      id: exam.id,
      recordId: exam.recordId || '',
      employeeCode: exam.employeeCode || '',
      employeeName: exam.employeeName || '',
      nationalCode: exam.nationalCode || '',
      department: exam.department || '',
      jobTitle: exam.jobTitle || '',
      workplace: (exam as any).workplace || '',
      examDate: exam.examDate || new Date().toLocaleDateString('fa-IR'),
      reason: exam.reason || 'بازگشت به کار پس از مرخصی استعلاجی',
      examType: exam.examType || 'بازگشت به کار',
      medicalCenter: exam.medicalCenter || 'مرکز بهداری و طب کار مجتمع پتروشیمی',
      doctor: exam.doctor || '',
      status: exam.status || 'fit',
      clinicalSymptoms: exam.clinicalSymptoms || '',
      recommendations: exam.recommendations || '',
      description: exam.description || '',
      returnToWorkDate: exam.returnToWorkDate || '',
      limitations: exam.limitations || '',
      findings: {
        bloodPressure: exam.findings?.bloodPressure || '120/80',
        pulseRate: (exam.findings as any)?.pulseRate || '75',
        heightCm: exam.findings?.heightCm || 175,
        weightKg: exam.findings?.weightKg || 78,
        bmi: exam.findings?.bmi || 25.5,
        vision: exam.findings?.vision || '',
        audiometry: exam.findings?.audiometry || '',
        spirometry: exam.findings?.spirometry || '',
        ecg: exam.findings?.ecg || '',
        bloodTests: exam.findings?.bloodTests || '',
        generalConclusion: exam.findings?.generalConclusion || ''
      }
    });

    setActiveTab('register');
  };

  // Save Form Handler
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeName || !formData.employeeCode) {
      toast.error(isFa ? 'لطفاً مشخصات و کد پرسنلی را وارد یا از سامانه پرسنلی انتخاب نمایید.' : 'Please enter or select personnel.');
      return;
    }

    const payload: Partial<NonPeriodicMedicalExam> = {
      id: editingExamId || undefined,
      recordId: formData.recordId,
      employeeCode: formData.employeeCode,
      employeeName: formData.employeeName,
      nationalCode: formData.nationalCode,
      department: formData.department,
      jobTitle: formData.jobTitle,
      examDate: formData.examDate,
      reason: formData.reason,
      examType: formData.examType,
      medicalCenter: formData.medicalCenter,
      doctor: formData.doctor,
      status: formData.status,
      clinicalSymptoms: formData.clinicalSymptoms,
      recommendations: formData.recommendations,
      description: formData.description,
      returnToWorkDate: formData.returnToWorkDate,
      limitations: formRestrictionsList.join(' | '),
      attachmentsCount: formAttachments.length,
      attachments: formAttachments,
      findings: {
        ...formData.findings,
        generalConclusion: formData.findings.generalConclusion || (
          formData.status === 'fit' ? 'تناسب کامل پزشکی جهت انجام امور شغلی.' :
          formData.status === 'fit_with_limitations' ? `مناسب کار مشروط به رعایت محدودیت‌های: ${formRestrictionsList.join(', ')}` :
          formData.status === 'needs_specialist' ? 'نیازمند ارجاع به کمیسیون پزشکی و بررسی تخصصی.' :
          'عدم احراز صلاحیت و تناسب شغلی برای پست فعلی.'
        )
      }
    };

    const username = currentUser?.fullName || currentUser?.username || 'کارشناس بهداشت حرفه‌ای';
    healthEnvService.saveNonPeriodicExam(payload, username);
    reloadData();
    resetForm();
    setActiveTab('exams');
  };

  // Delete Exam Handler
  const handleDeleteExam = (id: string) => {
    const username = currentUser?.fullName || currentUser?.username || 'کارشناس بهداشت حرفه‌ای';
    healthEnvService.deleteNonPeriodicExam(id, username);
    setDeleteConfirmId(null);
    reloadData();
  };

  // Print Official Certificate
  const handlePrintCertificate = (exam: NonPeriodicMedicalExam) => {
    setPrintingCertificate(exam);
    setTimeout(() => {
      printService.printElement('printable-medical-fitness-cert', {
        title: `گواهی صلاحیت سلامت و طب کار - ${exam.employeeName} - ${exam.employeeCode}`,
        orientation: 'portrait',
        pageSize: 'A4',
        documentCode: `MED-FIT-${exam.employeeCode}`,
        documentDate: exam.examDate,
        isFa: true,
        autoPrint: true
      });
    }, 150);
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (exams.length === 0) return;
    const headers = [
      'کد پرسنلی', 'نام و نام خانوادگی', 'کد ملی', 'واحد سازمانی', 'عنوان شغلی', 
      'علت مراجعه', 'تاریخ معاینه', 'نتیجه صلاحیت', 'پزشک معاین', 'محدودیت‌های شغلی', 'تاریخ بازگشت به کار'
    ];
    const rows = filteredExams.map(e => [
      e.employeeCode,
      e.employeeName,
      e.nationalCode,
      e.department,
      e.jobTitle,
      e.reason,
      e.examDate,
      e.status === 'fit' ? 'مناسب کار' : e.status === 'fit_with_limitations' ? 'مناسب با محدودیت' : e.status === 'needs_specialist' ? 'نیازمند بررسی تخصصی' : 'عدم صلاحیت',
      e.doctor,
      e.limitations || '-',
      e.returnToWorkDate || '-'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadCsvFile(`non_periodic_exams_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  // Filtered & Sorted Records
  const filteredExams = useMemo(() => {
    return exams.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        item.employeeName.toLowerCase().includes(q) ||
        item.employeeCode.includes(q) ||
        item.nationalCode.includes(q) ||
        item.department.toLowerCase().includes(q) ||
        (item.jobTitle && item.jobTitle.toLowerCase().includes(q)) ||
        (item.limitations && item.limitations.toLowerCase().includes(q));

      const matchReason = selectedReason === 'all' || item.reason === selectedReason;
      const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchDept = selectedDept === 'all' || item.department === selectedDept;

      return matchSearch && matchReason && matchStatus && matchDept;
    }).sort((a, b) => {
      let aVal = (a as any)[sortField] || '';
      let bVal = (b as any)[sortField] || '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [exams, searchTerm, selectedReason, selectedStatus, selectedDept, sortField, sortDirection]);

  // Unique Departments for filter
  const departmentsList = useMemo(() => {
    return Array.from(new Set(exams.map(e => e.department).filter(Boolean))).sort();
  }, [exams]);

  // Summary Metrics & Statistics
  const stats = useMemo(() => {
    const total = exams.length;
    const fitCount = exams.filter(e => e.status === 'fit').length;
    const withLimitationCount = exams.filter(e => e.status === 'fit_with_limitations').length;
    const needsSpecialistCount = exams.filter(e => e.status === 'needs_specialist').length;
    const unfitCount = exams.filter(e => e.status === 'unfit').length;

    // By reason
    const reasonCounts: Record<string, number> = {};
    REASONS_LIST.forEach(r => { reasonCounts[r] = 0; });
    exams.forEach(e => {
      if (reasonCounts[e.reason] !== undefined) {
        reasonCounts[e.reason]++;
      } else {
        reasonCounts[e.reason] = (reasonCounts[e.reason] || 0) + 1;
      }
    });

    const statusChartData = [
      { name: 'مناسب کار (Fit)', value: fitCount, color: '#10b981' },
      { name: 'مناسب با محدودیت', value: withLimitationCount, color: '#f59e0b' },
      { name: 'نیازمند بررسی تخصصی', value: needsSpecialistCount, color: '#6366f1' },
      { name: 'نامناسب (Unfit)', value: unfitCount, color: '#ef4444' }
    ].filter(d => d.value > 0);

    const reasonChartData = Object.entries(reasonCounts)
      .map(([name, count]) => ({ name, count }))
      .filter(d => d.count > 0);

    return {
      total,
      fitCount,
      fitPercent: total > 0 ? Math.round((fitCount / total) * 100) : 0,
      withLimitationCount,
      needsSpecialistCount,
      unfitCount,
      statusChartData,
      reasonChartData
    };
  }, [exams]);

  // Virtualized Table Columns definition
  const tableColumns: VirtualizedColumn<NonPeriodicMedicalExam>[] = useMemo(() => [
    {
      key: 'employee',
      header: 'مشخصات پرسنل',
      width: 220,
      render: (exam) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-black flex items-center justify-center text-xs shrink-0">
            {exam.employeeName ? exam.employeeName[0] : 'پ'}
          </div>
          <div>
            <div className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">
              {exam.employeeName}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              کد: {exam.employeeCode} | کدملی: {exam.nationalCode}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'department',
      header: 'واحد و عنوان شغلی',
      width: 180,
      render: (exam) => (
        <div>
          <div className="font-bold text-slate-700 dark:text-slate-200 text-xs">{exam.department}</div>
          <div className="text-[10px] text-slate-400 font-medium">{exam.jobTitle || '-'}</div>
        </div>
      )
    },
    {
      key: 'reason',
      header: 'علت مراجعه و ارجاع',
      width: 190,
      render: (exam) => (
        <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold">
          {exam.reason}
        </span>
      )
    },
    {
      key: 'examDate',
      header: 'تاریخ معاینه',
      width: 110,
      headerClassName: 'text-center',
      className: 'text-center font-mono font-bold text-slate-600 dark:text-slate-300',
      render: (exam) => exam.examDate
    },
    {
      key: 'status',
      header: 'نتیجه صلاحیت و تناسب',
      width: 150,
      headerClassName: 'text-center',
      className: 'text-center',
      render: (exam) => {
        const isFit = exam.status === 'fit';
        const isLim = exam.status === 'fit_with_limitations';
        const isSpec = exam.status === 'needs_specialist';
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${
            isFit ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300' :
            isLim ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300' :
            isSpec ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300' :
            'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
          }`}>
            {isFit ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {isFit ? 'مناسب کار (Fit)' :
             isLim ? 'مناسب با محدودیت' :
             isSpec ? 'نیازمند بررسی تخصصی' : 'عدم صلاحیت شغلی'}
          </span>
        );
      }
    },
    {
      key: 'limitations',
      header: 'محدودیت‌های شغلی تجویزی',
      render: (exam) => (
        exam.limitations ? (
          <span className="text-rose-600 dark:text-rose-400 font-bold text-[11px] line-clamp-1" title={exam.limitations}>
            {exam.limitations}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )
      )
    },
    {
      key: 'doctor',
      header: 'پزشک معاین',
      width: 140,
      className: 'text-slate-600 dark:text-slate-300 font-medium text-xs',
      render: (exam) => exam.doctor
    },
    {
      key: 'attachments',
      header: 'پیوست‌ها',
      width: 100,
      headerClassName: 'text-center',
      className: 'text-center',
      render: (exam) => {
        const attCount = exam.attachments?.length || exam.attachmentsCount || 0;
        if (attCount === 0) {
          return <span className="text-slate-300 dark:text-slate-600 text-[11px] font-mono">-</span>;
        }
        return (
          <button
            type="button"
            onClick={() => setViewingExam(exam)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-black hover:bg-indigo-100 dark:hover:bg-indigo-900 transition cursor-pointer"
            title={`${attCount} مدرک پیوست (PDF / تصویر) - کلیک جهت مشاهده`}
          >
            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-mono">{attCount}</span>
          </button>
        );
      }
    },
    {
      key: 'actions',
      header: 'عملیات',
      width: 140,
      headerClassName: 'text-center',
      className: 'text-center',
      render: (exam) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setViewingExam(exam)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="مشاهده پرونده کامل"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePrintCertificate(exam)}
            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="چاپ گواهی رسمی تناسب شغلی"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(exam)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="ویرایش پرونده"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirmId(exam.id)}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="حذف رکورد"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], []);

  const navTabs = [
    { id: 'dashboard' as NonPeriodicTabKey, label: 'داشبورد سلامت و آمار', icon: <Activity className="w-4 h-4" /> },
    { id: 'exams' as NonPeriodicTabKey, label: `کارتابل معاینات (${exams.length})`, icon: <Calendar className="w-4 h-4" /> },
    { id: 'register' as NonPeriodicTabKey, label: editingExamId ? 'ویرایش پرونده معاینه' : 'ثبت معاینه جدید', icon: <Plus className="w-4 h-4" /> },
    { id: 'certificates' as NonPeriodicTabKey, label: 'گواهی‌های تناسب شغلی', icon: <Award className="w-4 h-4" /> },
    { id: 'reports' as NonPeriodicTabKey, label: 'گزارش‌های تحلیلی', icon: <Brain className="w-4 h-4" /> }
  ];

  return (
    <div 
      className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 font-sans pb-16 transition-all duration-300 relative w-full" 
      dir="rtl"
    >
      {/* Top Header Bar - Matches PeriodicMedicalExamsApp standard */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#132a3a]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl 2xl:max-w-[1720px] w-full mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2.5 min-h-16 py-2.5">
            {/* Title & Brand */}
            <div className="flex items-center gap-3 min-w-0 flex-1 basis-[240px]">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-700/20 shrink-0">
                <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base lg:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                  سامانه جامع معاینات غیر دوره‌ای و ارزیابی‌های اختصاصی طب کار
                </h1>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-bold block truncate">
                  Occupational Health Non-Periodic & Fitness Examination System
                </span>
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <span className="hidden sm:inline-flex text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                {exams.length} پرونده معاینه | {stats.fitPercent}٪ تناسب کامل
              </span>

              <button
                type="button"
                onClick={() => { resetForm(); setActiveTab('register'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>ثبت معاینه جدید</span>
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
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
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

      {/* Main Content Viewport */}
      <main className="max-w-7xl 2xl:max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {/* TAB 1: DASHBOARD & KPI ANALYTICS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">کل پرونده‌های ثبت‌شده</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{stats.total}</span>
                    <span className="text-[11px] text-slate-400 font-bold">معاینه</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">تناسب شغلی کامل (Fit)</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-emerald-600 font-mono">{stats.fitCount}</span>
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-bold">
                      {stats.fitPercent}٪
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">دارای محدودیت شغلی</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-amber-600 font-mono">{stats.withLimitationCount}</span>
                    <span className="text-[11px] text-slate-400 font-bold">پرونده تحت‌نظر</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">عدم صلاحیت / ارجاع کمیسیون</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-rose-600 font-mono">{stats.unfitCount + stats.needsSpecialistCount}</span>
                    <span className="text-[11px] text-slate-400 font-bold">مورد</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Fitness Status Distribution */}
              <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    <span>توزیع آماری صلاحیت و تناسب شغلی پرسنل</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono font-bold">
                    مجموع: {stats.total}
                  </span>
                </div>

                <div className="h-64 w-full min-h-[256px]">
                  <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={240} debounce={50}>
                    <PieChart>
                      <Pie
                        data={stats.statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {stats.statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [`${val} مورد`, 'تعداد']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Reasons Breakdown */}
              <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>تفکیک مراجعات بر اساس علت معاینه</span>
                  </h3>
                </div>

                <div className="h-64 w-full min-h-[256px]">
                  <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={240} debounce={50}>
                    <BarChart data={stats.reasonChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} name="تعداد پرونده" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Records Banner */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
              <div className="space-y-1 text-center md:text-right">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-bold border border-indigo-400/30">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  <span>انطباق با استانداردهای طب کار وزارت بهداشت و صنعت نفت</span>
                </div>
                <h3 className="text-lg font-black mt-2">ثبت و پایش سریع پرونده‌های بازگشت به کار و بدو استخدام</h3>
                <p className="text-xs text-indigo-200 max-w-xl">
                  کلیه نتایج معاینات اختصاصی، ارزیابی محدودیت‌های شغلی و گواهی‌های طب کار به صورت یکپارچه با پرونده پرسنلی سینک می‌گردند.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { resetForm(); setActiveTab('register'); }}
                  className="px-5 py-2.5 bg-white text-indigo-900 font-extrabold rounded-2xl hover:bg-indigo-50 transition text-xs shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>ثبت معاینه جدید</span>
                </button>
                <button
                  onClick={() => setActiveTab('exams')}
                  className="px-4 py-2.5 bg-indigo-800/80 hover:bg-indigo-700 text-white font-bold rounded-2xl transition text-xs border border-indigo-500/40 cursor-pointer"
                >
                  مشاهده کارتابل
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXAMS WORKSPACE & TABLE */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            {/* Filter and Search Action Bar */}
            <div className="bg-white dark:bg-slate-800/90 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو بر اساس نام، شماره پرسنلی، کدملی، واحد یا محدودیت..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="w-44">
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    aria-label="فیلتر بر اساس علت مراجعه"
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none cursor-pointer"
                  >
                    <option value="all">همه علل مراجعه</option>
                    {REASONS_LIST.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="w-40">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    aria-label="فیلتر بر اساس نتیجه صلاحیت"
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none cursor-pointer"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="fit">مناسب کار (Fit)</option>
                    <option value="fit_with_limitations">مناسب با محدودیت</option>
                    <option value="needs_specialist">نیازمند ارزیابی تخصصی</option>
                    <option value="unfit">عدم صلاحیت شغلی</option>
                  </select>
                </div>

                {departmentsList.length > 0 && (
                  <div className="w-36">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      aria-label="فیلتر بر اساس واحد سازمانی"
                      className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none cursor-pointer"
                    >
                      <option value="all">همه واحدها</option>
                      {departmentsList.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition cursor-pointer"
                  title="خروجی اکسل"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>اکسل</span>
                </button>
                <button
                  onClick={() => { resetForm(); setActiveTab('register'); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>معاینه جدید</span>
                </button>
              </div>
            </div>

            {/* Virtualized Table Container */}
            <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-xs">
              <VirtualizedDataTable
                data={filteredExams}
                columns={tableColumns}
                height={580}
                isFa={true}
                emptyMessage="هیچ پرونده معاینه غیر دوره‌ای با شرایط انتخابی یافت نشد."
              />
            </div>
          </div>
        )}

        {/* TAB 3: REGISTER & COMPREHENSIVE DATA ENTRY FORM */}
        {activeTab === 'register' && (
          <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs p-6 sm:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingExamId ? 'ویرایش پرونده معاینه غیر دوره‌ای و تناسب شغلی' : 'ثبت پرونده جدید معاینه غیر دوره‌ای و ارزیابی طب کار'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    فرم استاندارد ثبت علائم بالینی، نتایج پاراکلینیک، نظریه پزشک و صدور گواهی صلاحیت سلامت
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { resetForm(); setActiveTab('exams'); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  انصراف و بازگشت
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-8 text-xs">
              
              {/* SECTION 1: PERSONNEL LOOKUP & SELECTION */}
              <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>بخش ۱: اطلاعات هویتی و پرسنلی (اتصال خودکار به بانک اطلاعات پرسنل)</span>
                  </h3>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-100/60 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">
                    Auto-Lookup
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <CentralPersonnelSelector
                      label="جستجو و انتخاب پرسنل از «اطلاعات پرسنل» (کد پرسنلی، نام یا کد ملی)"
                      value={formData.employeeName ? `${formData.employeeName} (${formData.employeeCode})` : searchQuery}
                      selectedPersonnelCode={formData.employeeCode || ''}
                      isFa={true}
                      onSelect={(person) => {
                        if (!person) {
                          setMatchedPersonnel(null);
                          return;
                        }
                        setMatchedPersonnel(person);
                        setSearchQuery(person.personnelCode);
                        setFormData(prev => ({
                          ...prev,
                          recordId: person.id || prev.recordId,
                          employeeCode: person.personnelCode || prev.employeeCode,
                          employeeName: person.fullName || `${person.firstName} ${person.lastName}`,
                          nationalCode: person.nationalCode || prev.nationalCode,
                          department: person.unit || person.department || prev.department,
                          jobTitle: person.jobTitle || prev.jobTitle,
                          workplace: person.workplace || prev.workplace
                        }));
                      }}
                    />
                  </div>

                  <div className="sm:col-span-1 flex items-center">
                    {matchedPersonnel ? (
                      <div className="w-full p-3 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                            {matchedPersonnel.firstName?.[0] || '✓'}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 dark:text-white text-sm">
                              {matchedPersonnel.fullName}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex gap-2">
                              <span>کد: {matchedPersonnel.personnelCode}</span>
                              <span>•</span>
                              <span>واحد: {matchedPersonnel.unit || matchedPersonnel.department}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">
                        با جستجوی کد پرسنلی، نام یا کد ملی، مشخصات فرد به صورت خودکار تکمیل می‌گردد.
                      </span>
                    )}
                  </div>
                </div>

                {/* Explicit Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">نام و نام خانوادگی *</label>
                    <input
                      type="text"
                      required
                      value={formData.employeeName}
                      onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">شماره پرسنلی *</label>
                    <input
                      type="text"
                      required
                      value={formData.employeeCode}
                      onChange={(e) => {
                        handleSearchPersonnel(e.target.value);
                        setFormData(prev => ({ ...prev, employeeCode: e.target.value }));
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">کد ملی</label>
                    <input
                      type="text"
                      value={formData.nationalCode}
                      onChange={(e) => {
                        handleSearchPersonnel(e.target.value);
                        setFormData(prev => ({ ...prev, nationalCode: e.target.value }));
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">واحد سازمانی</label>
                    <input
                      type="text"
                      list="np-exam-units-list"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    />
                    <datalist id="np-exam-units-list">
                      {getUnits().map(u => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان شغلی</label>
                    <input
                      type="text"
                      list="np-exam-jobs-list"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    />
                    <datalist id="np-exam-jobs-list">
                      {getJobTitles().map(j => <option key={j} value={j} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* SECTION 2: EXAM SPECIFICATIONS */}
              <div className="p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-3xl space-y-4">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>بخش ۲: مشخصات نوبت و علت مراجعه معاینه</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">علت مراجعه و ارجاع *</label>
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value as NonPeriodicReason })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold"
                    >
                      {REASONS_LIST.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">تاریخ معاینه (شمسی) *</label>
                    <input
                      type="text"
                      required
                      value={formData.examDate}
                      onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="1405/04/01"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">مرکز درمانی / بهداری</label>
                    <input
                      type="text"
                      value={formData.medicalCenter}
                      onChange={(e) => setFormData({ ...formData, medicalCenter: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">پزشک معاینه‌کننده طب کار</label>
                    <input
                      type="text"
                      value={formData.doctor}
                      onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">شرح شکایت بالینی / سوابق حادثه و مرخصی استعلاجی</label>
                  <textarea
                    rows={2}
                    value={formData.clinicalSymptoms}
                    onChange={(e) => setFormData({ ...formData, clinicalSymptoms: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="شرح کامل علت غیبت، نوع عمل جراحی، حادثه شغلی و علائم بیماری فعلی..."
                  />
                </div>
              </div>

              {/* SECTION 3: VITAL SIGNS & PARACLINICAL FINDINGS */}
              <div className="p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-3xl space-y-4">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-indigo-600" />
                  <span>بخش ۳: علائم حیاتی و نتایج ارزیابی‌های پاراکلینیک</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">فشار خون (mmHg)</label>
                    <input
                      type="text"
                      value={formData.findings.bloodPressure}
                      onChange={(e) => setFormData({
                        ...formData,
                        findings: { ...formData.findings, bloodPressure: e.target.value }
                      })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="120/80"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">قد (سانتی‌متر)</label>
                    <input
                      type="number"
                      value={formData.findings.heightCm || ''}
                      onChange={(e) => updateHeightWeight(Number(e.target.value), undefined)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="175"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">وزن (کیلوگرم)</label>
                    <input
                      type="number"
                      value={formData.findings.weightKg || ''}
                      onChange={(e) => updateHeightWeight(undefined, Number(e.target.value))}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="78"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">شاخص BMI (محاسبه خودکار)</label>
                    <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-black text-indigo-600">
                      {formData.findings.bmi || '-'}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">ضربان قلب (bpm)</label>
                    <input
                      type="text"
                      value={formData.findings.pulseRate || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        findings: { ...formData.findings, pulseRate: e.target.value }
                      })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="75"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">ارزیابی بینایی و اپتومتری</label>
                    <input
                      type="text"
                      value={formData.findings.vision || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        findings: { ...formData.findings, vision: e.target.value }
                      })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                      placeholder="دید دید در حد نرمال، میدان دید کامل..."
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">ارزیابی شنوایی (ادیومتری)</label>
                    <input
                      type="text"
                      value={formData.findings.audiometry || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        findings: { ...formData.findings, audiometry: e.target.value }
                      })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                      placeholder="آستانه شنوایی در فرکانس‌های مختلف..."
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">اسپیرومتری و تست ریه</label>
                    <input
                      type="text"
                      value={formData.findings.spirometry || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        findings: { ...formData.findings, spirometry: e.target.value }
                      })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                      placeholder="شاخص‌های FVC، FEV1 و الگوی تنفسی..."
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">نوار قلب و آزمایشات خون</label>
                    <input
                      type="text"
                      value={formData.findings.bloodTests || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        findings: { ...formData.findings, bloodTests: e.target.value }
                      })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                      placeholder="ECG، آزمایشات بیوشیمی و تست‌های تشخیصی..."
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: OCCUPATIONAL FITNESS VERDICT & RESTRICTIONS */}
              <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-3xl space-y-4">
                <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>بخش ۴: نظریه نهایی پزشک طب کار و محدودیت‌های شغلی تجویزی</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نظریه صلاحیت شغلی *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as MedicalExamStatus })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-bold text-xs"
                    >
                      <option value="fit">مناسب کار بدون محدودیت (Fit)</option>
                      <option value="fit_with_limitations">مناسب با محدودیت شغلی</option>
                      <option value="needs_specialist">نیازمند ارزیابی تخصصی / کمیسیون</option>
                      <option value="unfit">عدم صلاحیت شغلی (Unfit)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاریخ مجاز بازگشت به کار</label>
                    <input
                      type="text"
                      value={formData.returnToWorkDate}
                      onChange={(e) => setFormData({ ...formData, returnToWorkDate: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="1405/04/15"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاریخ پیگیری بعدی</label>
                    <input
                      type="text"
                      value={formData.recommendations}
                      onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                      placeholder="1405/07/01 (سه ماه آینده)"
                    />
                  </div>
                </div>

                {/* Job Restrictions Presets Checkboxes */}
                <div className="space-y-2 pt-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    انتخاب محدودیت‌های کاری تجویزی (جهت درج در گواهی رسمی طب کار):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {JOB_RESTRICTIONS_PRESETS.map((rest, idx) => {
                      const isSelected = formRestrictionsList.includes(rest);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleRestriction(rest)}
                          className={`p-2 rounded-xl text-right text-[11px] font-bold border transition flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-900/50 dark:text-amber-200 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                            isSelected ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-300'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                          <span>{rest}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Restriction */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="درج محدودیت شغلی اختصاصی دیگر..."
                      value={customRestrictionInput}
                      onChange={(e) => setCustomRestrictionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRestriction(); } }}
                      className="flex-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomRestriction}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition"
                    >
                      افزودن
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نتیجه‌گیری و توضیحات نهایی پزشک معتمد</label>
                  <textarea
                    rows={2}
                    value={formData.findings.generalConclusion || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      findings: { ...formData.findings, generalConclusion: e.target.value }
                    })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                    placeholder="جمع‌بندی نهایی وضعیت بیمار و توصیه‌های ایمنی به سرپرست کارگاه..."
                  />
                </div>
              </div>

              {/* SECTION 5: MEDICAL ATTACHMENTS (PDF & IMAGES) */}
              <div className="p-5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/40 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-600" />
                    <span>بخش ۵: مدارک، گزارش‌های تشخیصی و پیوست‌های پرونده (PDF و تصویر)</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {formAttachments.length} پیوست انتخاب‌شده
                  </span>
                </div>

                {/* Upload Zone & Inputs */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center space-y-3 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-100/50 dark:bg-indigo-900/40 scale-[1.01]' 
                      : 'border-indigo-300 dark:border-indigo-800 bg-white/80 dark:bg-slate-900/80 hover:bg-indigo-50/30'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <h4 className="font-black text-slate-800 dark:text-white text-xs">
                      فایل‌های پیوست را به اینجا بکشید و رها کنید یا دکمه زیر را انتخاب کنید
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      فرمت‌های مجاز: <strong className="text-indigo-600">PDF (.pdf)</strong> و تصاویر <strong className="text-indigo-600">JPG, PNG, WEBP</strong> (حداکثر ۱۵ مگابایت برای هر فایل)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                      onChange={handleFileInputChange}
                      className="hidden"
                      id="np-exam-file-input"
                    />
                    <label
                      htmlFor="np-exam-file-input"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>انتخاب فایل از سیستم (PDF / تصویر)</span>
                    </label>
                  </div>

                  {uploadError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                </div>

                {/* Attachment List / Grid */}
                {formAttachments.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                      فهرست اسناد پیوست‌شده به این معاینه ({formAttachments.length}):
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {formAttachments.map((att) => {
                        const isPdf = att.fileType === 'pdf';
                        return (
                          <div
                            key={att.id}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-xs space-y-2 relative group hover:border-indigo-300 transition"
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Thumbnail / Icon */}
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                                {isPdf ? (
                                  <FileText className="w-5 h-5 text-rose-600" />
                                ) : att.fileData ? (
                                  <img src={att.fileData} alt={att.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-indigo-500" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={att.displayName}>
                                  {att.displayName}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                                  <span className="uppercase font-bold text-indigo-600 dark:text-indigo-400">{att.fileType}</span>
                                  <span>•</span>
                                  <span>{att.fileSizeFormatted}</span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                                title="حذف این پیوست"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Optional description input */}
                            <input
                              type="text"
                              placeholder="عنوان یا توضیح مدرک (مثال: برگه ترخیص بیمارستان)..."
                              value={att.description || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormAttachments(prev => prev.map(a => a.id === att.id ? { ...a, description: val } : a));
                              }}
                              className="w-full p-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] outline-none"
                            />

                            {/* Quick action buttons */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                              {att.fileData && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment(att)}
                                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>پیش‌نمایش</span>
                                </button>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">{att.uploadedAt}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { resetForm(); setActiveTab('exams'); }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingExamId ? 'بروزرسانی پرونده معاینه' : 'ثبت قطعی در پرونده طب کار'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: OFFICIAL FITNESS CERTIFICATES */}
        {activeTab === 'certificates' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800/90 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                  کارتابل گواهی‌های رسمی صلاحیت و تناسب شغلی طب کار
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  صدور، مشاهده و چاپ رسمی برگه‌های صلاحیت پزشکی طبق استانداردهای رسمی وزارت نفت و بهداشت
                </p>
              </div>
              <button
                onClick={() => { resetForm(); setActiveTab('register'); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>صدور گواهی جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-xs space-y-3 relative hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{exam.employeeName}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">کد: {exam.employeeCode}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      exam.status === 'fit' ? 'bg-emerald-100 text-emerald-800' :
                      exam.status === 'fit_with_limitations' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {exam.status === 'fit' ? 'مناسب کار' : exam.status === 'fit_with_limitations' ? 'مشروط' : 'عدم صلاحیت'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">واحد:</span>
                      <span className="font-bold">{exam.department}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">عنوان شغلی:</span>
                      <span className="font-bold">{exam.jobTitle}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">علت ارجاع:</span>
                      <span className="font-bold text-indigo-600">{exam.reason}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">تاریخ صدور:</span>
                      <span className="font-mono font-bold">{exam.examDate}</span>
                    </div>
                  </div>

                  {exam.limitations && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                      <span className="font-bold block mb-0.5">محدودیت‌ها:</span>
                      <p className="line-clamp-2">{exam.limitations}</p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      onClick={() => setViewingExam(exam)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده جزئیات</span>
                    </button>
                    <button
                      onClick={() => handlePrintCertificate(exam)}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>چاپ رسمی</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800/90 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                <span>گزارش جامع تحلیلی معاینات اختصاصی و غیردوره‌ای</span>
              </h3>
              <p className="text-xs text-slate-500">
                تحلیل آماری نسبت‌های تناسب شغلی، شایع‌ترین علل مرخصی‌های استعلاجی طولانی‌مدت و توزیع محدودیت‌های پزشکی در سطح مجتمع
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800/90 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
                <span className="text-xs text-slate-400 font-bold">بیشترین علت مراجعه</span>
                <div className="font-extrabold text-sm text-indigo-700 dark:text-indigo-400">
                  بازگشت به کار پس از مرخصی استعلاجی
                </div>
                <p className="text-[11px] text-slate-500">شامل بیماران قلبی، ارتوپدی و جراحی‌های عمومی</p>
              </div>

              <div className="bg-white dark:bg-slate-800/90 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
                <span className="text-xs text-slate-400 font-bold">شایع‌ترین محدودیت تجویزی</span>
                <div className="font-extrabold text-sm text-amber-700 dark:text-amber-400">
                  ممنوعیت کار در ارتفاع و جابجایی بار سنگین
                </div>
                <p className="text-[11px] text-slate-500">نیازمند تطبیق ارگونومیک ایستگاه‌های کاری</p>
              </div>

              <div className="bg-white dark:bg-slate-800/90 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
                <span className="text-xs text-slate-400 font-bold">نرخ بازگشت به کار موفق</span>
                <div className="text-2xl font-black text-emerald-600 font-mono">
                  {stats.fitPercent}%
                </div>
                <p className="text-[11px] text-slate-500">پرسنل آماده خدمت بدون آسیب و خطر شغلی</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* VIEW DETAILS MODAL */}
      {viewingExam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl sm:max-w-4xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-6 sm:p-8 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    برگه پرونده معاینه اختصاصی و غیردوره‌ای
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    شناسه ثبت: {viewingExam.id}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewingExam(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 block mb-1">نام پرسنل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{viewingExam.employeeName}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 block mb-1">کد پرسنلی / ملی:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{viewingExam.employeeCode}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 block mb-1">واحد و شغل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{viewingExam.department}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 block mb-1">تاریخ معاینه:</span>
                <span className="font-mono font-bold text-indigo-600">{viewingExam.examDate}</span>
              </div>
            </div>

            {/* Clinical & Vital Signs */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl space-y-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block border-b pb-1">علائم حیاتی و یافته‌های پاراکلینیک:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div>فشار خون: <span className="font-bold text-slate-800 dark:text-white">{viewingExam.findings?.bloodPressure || '-'}</span></div>
                <div>قد/وزن: <span className="font-bold text-slate-800 dark:text-white">{viewingExam.findings?.heightCm || '-'}cm / {viewingExam.findings?.weightKg || '-'}kg</span></div>
                <div>BMI: <span className="font-bold text-indigo-600">{viewingExam.findings?.bmi || '-'}</span></div>
                <div>ضربان: <span className="font-bold text-slate-800 dark:text-white">{(viewingExam.findings as any)?.pulseRate || '-'} bpm</span></div>
              </div>
            </div>

            {viewingExam.clinicalSymptoms && (
              <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 rounded-2xl text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">شرح شکایت بالینی / علت مرخصی:</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewingExam.clinicalSymptoms}</p>
              </div>
            )}

            {viewingExam.limitations && (
              <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/50 rounded-2xl text-xs">
                <span className="font-bold text-rose-900 dark:text-rose-300 block mb-1">محدودیت‌های شغلی تجویزی:</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewingExam.limitations}</p>
              </div>
            )}

            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 rounded-2xl text-xs">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">نظریه نهایی و نتیجه صلاحیت:</span>
              <p className="text-slate-800 dark:text-slate-200 font-bold">
                {viewingExam.findings?.generalConclusion || (
                  viewingExam.status === 'fit' ? 'تناسب کامل پزشکی جهت انجام امور شغلی.' :
                  viewingExam.status === 'fit_with_limitations' ? 'مناسب کار مشروط به رعایت محدودیت‌های تجویزی.' :
                  'عدم صلاحیت شغلی.'
                )}
              </p>
            </div>

            {/* Attachments Section in Viewing Modal */}
            {viewingExam.attachments && viewingExam.attachments.length > 0 && (
              <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-800/60 pb-2">
                  <span className="font-extrabold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-indigo-600" />
                    <span>مدارک و مستندات پیوست پرونده ({viewingExam.attachments.length}):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">PDF & تصاویر</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {viewingExam.attachments.map((att) => {
                    const isPdf = att.fileType === 'pdf';
                    return (
                      <div
                        key={att.id}
                        className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {isPdf ? (
                              <FileText className="w-4 h-4 text-rose-600" />
                            ) : att.fileData ? (
                              <img src={att.fileData} alt={att.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-indigo-500" />
                            )}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={att.displayName}>
                              {att.displayName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex gap-1.5 mt-0.5">
                              <span className="uppercase text-indigo-600 font-bold">{att.fileType}</span>
                              <span>•</span>
                              <span>{att.fileSizeFormatted}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {att.fileData && (
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(att)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="مشاهده پیش‌نمایش"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {att.fileData && (
                            <a
                              href={att.fileData}
                              download={att.originalFileName || `${att.displayName}.${att.fileType}`}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="دانلود فایل"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => handlePrintCertificate(viewingExam)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ گواهی رسمی</span>
              </button>
              <button
                onClick={() => setViewingExam(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE OFFICIAL OCCUPATIONAL HEALTH FITNESS CERTIFICATE (Hidden from UI, used by printService) */}
      {printingCertificate && (
        <div id="printable-medical-fitness-cert" className="hidden print:block p-8 bg-white text-slate-900 font-sans" dir="rtl">
          {/* Header */}
          <div className="border-2 border-slate-900 rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div className="text-right">
              <h2 className="text-base font-black text-slate-900">وزارت نفت - شرکت ملی صنایع پتروشیمی</h2>
              <h3 className="text-sm font-bold text-slate-800 mt-0.5">مرکز بهداشت، ایمنی و محیط زیست (HSE) - واحد بهداشت و طب کار</h3>
              <span className="text-xs font-bold text-indigo-900 block mt-1">برگه رسمی گواهی تناسب و صلاحیت پزشکی اشتغال (Medical Fitness Certificate)</span>
            </div>
            <div className="text-left font-mono text-xs space-y-1">
              <div>شماره گواهی: <strong>MED-FIT-{printingCertificate.employeeCode}</strong></div>
              <div>تاریخ صدور: <strong>{printingCertificate.examDate}</strong></div>
              <div>طبقه معاینه: <strong>{printingCertificate.reason}</strong></div>
            </div>
          </div>

          {/* Section 1: Personnel Info */}
          <div className="border border-slate-300 rounded-xl p-4 mb-4 text-xs space-y-3">
            <h4 className="font-bold text-indigo-900 border-b pb-1">۱. مشخصات هویتی و شغلی شاغل</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>نام و نام خانوادگی: <strong>{printingCertificate.employeeName}</strong></div>
              <div>شماره پرسنلی: <strong>{printingCertificate.employeeCode}</strong></div>
              <div>کد ملی: <strong>{printingCertificate.nationalCode}</strong></div>
              <div>واحد سازمانی: <strong>{printingCertificate.department}</strong></div>
              <div>عنوان شغلی: <strong>{printingCertificate.jobTitle}</strong></div>
              <div>مرکز معاینه‌کننده: <strong>{printingCertificate.medicalCenter}</strong></div>
            </div>
          </div>

          {/* Section 2: Clinical & Paraclinical Findings */}
          <div className="border border-slate-300 rounded-xl p-4 mb-4 text-xs space-y-3">
            <h4 className="font-bold text-indigo-900 border-b pb-1">۲. خلاصه وضعیت علائم حیاتی و معاینات پاراکلینیک</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>فشار خون: <strong>{printingCertificate.findings?.bloodPressure || '-'} mmHg</strong></div>
              <div>قد: <strong>{printingCertificate.findings?.heightCm || '-'} cm</strong></div>
              <div>وزن: <strong>{printingCertificate.findings?.weightKg || '-'} kg</strong></div>
              <div>شاخص BMI: <strong>{printingCertificate.findings?.bmi || '-'}</strong></div>
            </div>
            <div className="text-[11px] pt-1 space-y-1">
              <div>بینایی و اپتومتری: {printingCertificate.findings?.vision || 'دید طبیعی'}</div>
              <div>شنوایی‌سنجی: {printingCertificate.findings?.audiometry || 'آستانه شنوایی در محدوده نرمال'}</div>
              <div>تست عملکرد ریه: {printingCertificate.findings?.spirometry || 'اسپیرومتری نرمال'}</div>
            </div>
          </div>

          {/* Section 3: Final Occupational Opinion & Limitations */}
          <div className="border-2 border-slate-800 rounded-xl p-4 mb-6 text-xs space-y-3 bg-slate-50">
            <h4 className="font-black text-slate-900 border-b border-slate-300 pb-1">۳. نظریه نهایی کمیسیون / پزشک طب کار</h4>
            <div className="flex items-center gap-4 text-sm font-black">
              <span>نتیجه احراز صلاحیت:</span>
              <span className={`px-3 py-1 rounded-lg border ${
                printingCertificate.status === 'fit' ? 'bg-emerald-100 text-emerald-900 border-emerald-400' :
                printingCertificate.status === 'fit_with_limitations' ? 'bg-amber-100 text-amber-900 border-amber-400' :
                'bg-rose-100 text-rose-900 border-rose-400'
              }`}>
                {printingCertificate.status === 'fit' ? '✓ صلاحیت کامل پزشکی برای شغل مربوطه (Fit)' :
                 printingCertificate.status === 'fit_with_limitations' ? '⚠ صلاحیت پزشکی مشروط به رعایت محدودیت‌ها (Fit with Limitations)' :
                 '✕ عدم احراز صلاحیت پزشکی برای شغل مربوطه (Unfit)'}
              </span>
            </div>

            {printingCertificate.limitations && (
              <div className="p-3 bg-white border border-slate-300 rounded-lg">
                <span className="font-bold text-rose-900 block mb-1">محدودیت‌های شغلی لازم‌الاجرا:</span>
                <p className="text-slate-800">{printingCertificate.limitations}</p>
              </div>
            )}

            {printingCertificate.returnToWorkDate && (
              <div>تاریخ مجاز شروع / بازگشت به کار: <strong>{printingCertificate.returnToWorkDate}</strong></div>
            )}

            <div>
              توضیحات پزشک: {printingCertificate.findings?.generalConclusion || 'بلامانع است.'}
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-6 text-xs text-center">
            <div className="border-t border-slate-400 pt-2">
              <span className="font-bold block">امضای شاغل</span>
              <span className="text-[10px] text-slate-500">ملاحظه و تایید محدودیت‌ها</span>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <span className="font-bold block">کارشناس بهداشت حرفه‌ای</span>
              <span className="text-[10px] text-slate-500">نظارت بر تطبیق شرایط شغلی</span>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <span className="font-bold block">{printingCertificate.doctor}</span>
              <span className="text-[10px] text-slate-500">مهر و امضای پزشک معتمد طب کار</span>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              حذف پرونده معاینه غیر دوره‌ای
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              آیا از حذف کامل این پرونده معاینه از سامانه اطمینان دارید؟ این عملیات غیرقابل بازگشت است.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteExam(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                حذف پرونده
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTACHMENT PREVIEW LIGHTBOX / VIEWER MODAL */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-xl">
                  {previewAttachment.fileType === 'pdf' ? <FileText className="w-5 h-5 text-rose-600" /> : <ImageIcon className="w-5 h-5 text-indigo-600" />}
                </div>
                <div className="truncate">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                    {previewAttachment.displayName}
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span className="uppercase font-bold text-indigo-600">{previewAttachment.fileType}</span>
                    <span>•</span>
                    <span>{previewAttachment.fileSizeFormatted}</span>
                    <span>•</span>
                    <span>{previewAttachment.originalFileName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewAttachment.fileData && (
                  <a
                    href={previewAttachment.fileData}
                    download={previewAttachment.originalFileName || `${previewAttachment.displayName}.${previewAttachment.fileType}`}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود فایل</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center bg-slate-100/50 dark:bg-slate-950/50 min-h-[350px]">
              {previewAttachment.fileType === 'pdf' ? (
                previewAttachment.fileData ? (
                  <div className="w-full h-full flex flex-col items-center gap-4">
                    <iframe
                      src={previewAttachment.fileData}
                      title={previewAttachment.displayName}
                      className="w-full h-[65vh] rounded-2xl border border-slate-300 dark:border-slate-700 shadow-inner bg-white"
                    />
                    <div className="text-center text-xs text-slate-500 flex items-center gap-3">
                      <span>در صورت عدم نمایش در مرورگر، از دکمه دانلود بالا یا لینک مستقیم استفاده کنید:</span>
                      <a
                        href={previewAttachment.fileData}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>باز کردن در تب مجزا</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto text-rose-500 mb-2 opacity-60" />
                    <p>فایل PDF یافت نشد.</p>
                  </div>
                )
              ) : (
                previewAttachment.fileData ? (
                  <div className="text-center">
                    <img
                      src={previewAttachment.fileData}
                      alt={previewAttachment.displayName}
                      className="max-h-[70vh] max-w-full object-contain mx-auto rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800"
                    />
                    {previewAttachment.description && (
                      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 font-medium bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border inline-block">
                        {previewAttachment.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <ImageIcon className="w-12 h-12 mx-auto text-indigo-500 mb-2 opacity-60" />
                    <p>تصویر یافت نشد.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

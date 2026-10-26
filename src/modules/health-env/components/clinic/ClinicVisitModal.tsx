import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  Save,
  AlertTriangle,
  Stethoscope,
  Activity,
  Pill,
  Ambulance,
  FileText,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Building,
  CheckCircle2,
  HeartPulse
} from 'lucide-react';
import {
  ClinicVisit,
  ClinicTriageLevel,
  ClinicVisitType,
  ClinicVisitOutcome,
  ClinicConsciousness,
  ClinicMedicationItem
} from '../../types/clinicTypes';
import CentralPersonnelSelector from '../../../../components/CentralPersonnelSelector';
import { ComplexPersonnel, PersonnelOrgDetails } from '../../../../utils/personnelHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (visit: Partial<ClinicVisit>) => Promise<void>;
  initialData?: ClinicVisit | null;
  currentUser?: any;
  todayJalali: string;
}

const VISIT_TYPES: ClinicVisitType[] = [
  'مراجعه معمول / سرپایی',
  'حادثه شغلی / اورژانس کارگاهی',
  'حادثه غیر شغلی',
  'مسمومیت / استنشاق گاز و مواد شیمیایی',
  'گرمازدگی / سرمازدگی',
  'تزریقات و پانسمان',
  'چکاپ و کنترل علائم حیاتی',
  'پیگیری درمان قبلی'
];

const OUTCOMES: ClinicVisitOutcome[] = [
  'بهبود و بازگشت به کار',
  'استراحت در بهداری (تحت نظر)',
  'استراحت پزشکی در منزل',
  'ارجاع به متخصص / بیمارستان',
  'اعزام اورژانسی با آمبولانس به بیمارستان'
];

const COMMON_ACTIONS = [
  'کنترل علائم حیاتی',
  'پانسمان و شستشوی زخم',
  'تزریق عضلانی/وریدی',
  'اکسیژن‌تراپی',
  'سرم‌تراپی',
  'نوار قلب (ECG)',
  'شستشوی چشم اضطراری',
  'تست قند خون (BS)',
  'آتل‌بندی و بی‌حرکت‌سازی',
  'سوختگی و پانسمان استریل'
];

const TRIAGE_LABELS: Record<ClinicTriageLevel, { label: string; desc: string; color: string; badge: string }> = {
  1: { label: 'سطح ۱ - احیا (Resuscitation)', desc: 'تهدید حیات فوری / نیاز به اقدام بلادرنگ', color: 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300', badge: 'bg-red-600 text-white' },
  2: { label: 'سطح ۲ - بسیار فوری (Emergent)', desc: 'خطر جدی / اقدام زیر ۱۰ دقیقه', color: 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300', badge: 'bg-orange-600 text-white' },
  3: { label: 'سطح ۳ - فوری (Urgent)', desc: 'وضعیت بالقوه ناپایدار / اقدام زیر ۳۰ دقیقه', color: 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', badge: 'bg-amber-600 text-white' },
  4: { label: 'سطح ۴ - نیمه‌فوری (Semi-Urgent)', desc: 'وضعیت پایدار / بررسی تا ۶۰ دقیقه', color: 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', badge: 'bg-emerald-600 text-white' },
  5: { label: 'سطح ۵ - غیرفوری (Non-Urgent)', desc: 'مراجعه روتین / تعویض پانسمان و چکاپ', color: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300', badge: 'bg-blue-600 text-white' }
};

export default function ClinicVisitModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentUser,
  todayJalali
}: Props) {
  const [activeTab, setActiveTab] = useState<'triage' | 'exam' | 'treatments' | 'meds' | 'outcome'>('triage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ClinicVisit>>(() => {
    if (initialData) return { ...initialData };

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return {
      visitDate: todayJalali,
      visitTime: timeStr,
      shift: 'عادی‌کار',
      visitType: 'مراجعه معمول / سرپایی',
      chiefComplaint: '',
      personnelCode: '',
      nationalCode: '',
      fullName: '',
      unit: '',
      jobTitle: '',
      triageLevel: 4,
      consciousnessLevel: 'هوشیار (Alert)',
      isWorkRelated: false,
      primaryDiagnosis: '',
      actionsPerformed: [],
      medications: [],
      outcome: 'بهبود و بازگشت به کار',
      ambulanceDispatch: { dispatched: false },
      attendingMedic: currentUser?.name || 'کادر بهداری',
      medicRole: 'پرستار',
      status: 'COMPLETED'
    };
  });

  // New Medication input temporary state
  const [newMed, setNewMed] = useState<ClinicMedicationItem>({
    id: '',
    name: '',
    dosage: '',
    route: 'خوراکی',
    count: 1,
    instructions: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData });
      } else {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setFormData({
          visitDate: todayJalali,
          visitTime: timeStr,
          shift: 'عادی‌کار',
          visitType: 'مراجعه معمول / سرپایی',
          chiefComplaint: '',
          personnelCode: '',
          nationalCode: '',
          fullName: '',
          unit: '',
          jobTitle: '',
          triageLevel: 4,
          consciousnessLevel: 'هوشیار (Alert)',
          isWorkRelated: false,
          primaryDiagnosis: '',
          actionsPerformed: [],
          medications: [],
          outcome: 'بهبود و بازگشت به کار',
          ambulanceDispatch: { dispatched: false },
          attendingMedic: currentUser?.name || 'کادر بهداری',
          medicRole: 'پرستار',
          status: 'COMPLETED'
        });
      }
      setActiveTab('triage');
      setError(null);
    }
  }, [isOpen, initialData, todayJalali, currentUser]);

  const handleSelectPersonnel = (person: ComplexPersonnel | null, orgDetails: PersonnelOrgDetails) => {
    if (!person) {
      setFormData(prev => ({
        ...prev,
        personnelId: undefined,
        personnelCode: '',
        nationalCode: '',
        fullName: '',
        unit: '',
        jobTitle: '',
        gender: undefined,
        phone: undefined,
        bloodGroup: undefined,
        underlyingConditions: undefined,
        allergies: undefined
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      personnelId: person.id,
      personnelCode: person.personnelCode || '',
      nationalCode: person.nationalCode || '',
      fullName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      unit: orgDetails.unit || person.unit || '',
      department: orgDetails.department || person.department,
      jobTitle: person.jobTitle || '',
      phone: person.phone || (person as any).mobile || '',
      gender: (person as any).gender,
      bloodGroup: (person as any).bloodGroup || (person as any).blood_type,
      underlyingConditions: (person as any).underlyingConditions || (person as any).medicalHistory,
      allergies: (person as any).allergies
    }));
  };

  const toggleAction = (act: string) => {
    setFormData(prev => {
      const current = prev.actionsPerformed || [];
      if (current.includes(act)) {
        return { ...prev, actionsPerformed: current.filter(a => a !== act) };
      } else {
        return { ...prev, actionsPerformed: [...current, act] };
      }
    });
  };

  const addMedication = () => {
    if (!newMed.name.trim()) return;
    const item: ClinicMedicationItem = {
      ...newMed,
      id: `med-${Date.now()}`
    };
    setFormData(prev => ({
      ...prev,
      medications: [...(prev.medications || []), item]
    }));
    setNewMed({
      id: '',
      name: '',
      dosage: '',
      route: 'خوراکی',
      count: 1,
      instructions: ''
    });
  };

  const removeMedication = (id: string) => {
    setFormData(prev => ({
      ...prev,
      medications: (prev.medications || []).filter(m => m.id !== id)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.personnelCode || !formData.fullName) {
      setError('لطفاً پرسنل مورد نظر را از رجیستری مرکزی انتخاب کنید.');
      setActiveTab('triage');
      return;
    }

    if (!formData.chiefComplaint?.trim()) {
      setError('علت و شکایت اصلی مراجعه (Chief Complaint) الزامی است.');
      setActiveTab('triage');
      return;
    }

    if (!formData.primaryDiagnosis?.trim()) {
      setError('ثبت تشخیص اولیه / شرح بالینی الزامی است.');
      setActiveTab('exam');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت اطلاعات در پایگاه داده');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Stethoscope className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">
                {initialData ? 'ویرایش پرونده مراجعه بهداری' : 'ثبت مراجعه جدید به بهداری مجتمع'}
              </h2>
              <p className="text-xs text-teal-100">
                سیستم یکپارچه بهداشت و درمان صنعتی HSECORE — اتصال به رجیستری مرکزی و کارنامه سلامت
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 gap-2 overflow-x-auto shrink-0">
          {[
            { id: 'triage', label: '۱. پرسنل، تریاژ و علائم حیاتی', icon: Activity },
            { id: 'exam', label: '۲. معاینه و تشخیص بالینی', icon: Stethoscope },
            { id: 'treatments', label: '۳. اقدامات درمانی و پروسیجرها', icon: HeartPulse },
            { id: 'meds', label: '۴. داروها و تجهیزات مصرفی', icon: Pill },
            { id: 'outcome', label: '۵. تعیین تکلیف، استراحت و اعزام', icon: Ambulance }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-700 dark:text-teal-400 bg-white dark:bg-slate-900 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: PERSONNEL & TRIAGE & VITALS */}
          {activeTab === 'triage' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Personnel Master Data Selector */}
              <div className="p-4 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    <span>انتخاب پرسنل از رجیستری مرکزی (بدون ایجاد داده تکراری)</span>
                  </h3>
                  <span className="text-[11px] text-teal-700 dark:text-teal-400 font-bold">الزامی</span>
                </div>

                <CentralPersonnelSelector
                  language="fa"
                  label=""
                  selectedPersonnelCode={formData.personnelCode}
                  onSelectPersonnel={handleSelectPersonnel}
                  placeholder="جستجو با نام، نام خانوادگی یا کد پرسنلی..."
                />

                {formData.personnelCode && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs border-t border-teal-200 dark:border-teal-800/40">
                    <div>
                      <span className="text-slate-400 block text-[10px]">کد پرسنلی:</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{formData.personnelCode}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">کد ملی:</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{formData.nationalCode || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">واحد / بخش:</span>
                      <strong className="text-slate-900 dark:text-white">{formData.unit || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">سمت شغلی:</span>
                      <strong className="text-slate-900 dark:text-white">{formData.jobTitle || '-'}</strong>
                    </div>
                    {formData.bloodGroup && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">گروه خونی:</span>
                        <strong className="font-mono text-rose-600">{formData.bloodGroup}</strong>
                      </div>
                    )}
                    {formData.allergies && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">حساسیت دارویی/غذایی:</span>
                        <strong className="text-amber-600">{formData.allergies}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date, Time, Shift & Visit Type */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاریخ مراجعه (شمسی) *
                  </label>
                  <input
                    type="text"
                    value={formData.visitDate || ''}
                    onChange={e => setFormData({ ...formData, visitDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    placeholder="1404/07/16"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ساعت مراجعه *
                  </label>
                  <input
                    type="time"
                    value={formData.visitTime || ''}
                    onChange={e => setFormData({ ...formData, visitTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوبت کاری (شیفت)
                  </label>
                  <select
                    value={formData.shift || 'عادی‌کار'}
                    onChange={e => setFormData({ ...formData, shift: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="عادی‌کار">عادی‌کار روزانه</option>
                    <option value="نوبتکار روز">نوبت‌کار شیفت روز (Day)</option>
                    <option value="نوبتکار شب">نوبت‌کار شیفت شب (Night)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع مراجعه *
                  </label>
                  <select
                    value={formData.visitType || VISIT_TYPES[0]}
                    onChange={e => setFormData({ ...formData, visitType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {VISIT_TYPES.map(vt => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  علت اصلی و شکایت بیمار (Chief Complaint) *
                </label>
                <textarea
                  rows={2}
                  value={formData.chiefComplaint || ''}
                  onChange={e => setFormData({ ...formData, chiefComplaint: e.target.value })}
                  placeholder="مثال: سردرد شدید و سرگیجه از ۲ ساعت قبل، بریدگی انگشت دست چپ حین کار با ابزار..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed"
                  required
                />
              </div>

              {/* Triage Level Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  سطح تریاژ اورژانس (Emergency Triage Index - ESI):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {([1, 2, 3, 4, 5] as ClinicTriageLevel[]).map(lvl => {
                    const info = TRIAGE_LABELS[lvl];
                    const isSelected = formData.triageLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setFormData({ ...formData, triageLevel: lvl })}
                        className={`p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          isSelected ? `${info.color} ring-2 ring-teal-500 font-black shadow-xs` : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${info.badge}`}>
                            سطح {lvl}
                          </span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-[11px] block font-bold truncate">{info.label.split(' - ')[1]}</span>
                        <span className="text-[9px] text-slate-400 block line-clamp-2 mt-0.5">{info.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vital Signs Grid */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>ثبت علائم حیاتی بیمار (Vital Signs):</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      فشار خون سیستول (mmHg)
                    </label>
                    <input
                      type="number"
                      value={formData.systolicBp ?? ''}
                      onChange={e => setFormData({ ...formData, systolicBp: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="120"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      فشار خون دیاستول (mmHg)
                    </label>
                    <input
                      type="number"
                      value={formData.diastolicBp ?? ''}
                      onChange={e => setFormData({ ...formData, diastolicBp: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="80"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      ضربان قلب (PR - bpm)
                    </label>
                    <input
                      type="number"
                      value={formData.pulseRate ?? ''}
                      onChange={e => setFormData({ ...formData, pulseRate: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="78"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      دمای بدن (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature ?? ''}
                      onChange={e => setFormData({ ...formData, temperature: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="36.8"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      اشباع اکسیژن (SpO2 %)
                    </label>
                    <input
                      type="number"
                      value={formData.spo2 ?? ''}
                      onChange={e => setFormData({ ...formData, spo2: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="98"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      تعداد تنفس (RR /min)
                    </label>
                    <input
                      type="number"
                      value={formData.respiratoryRate ?? ''}
                      onChange={e => setFormData({ ...formData, respiratoryRate: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="16"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      قند خون (BS - mg/dL)
                    </label>
                    <input
                      type="number"
                      value={formData.bloodSugar ?? ''}
                      onChange={e => setFormData({ ...formData, bloodSugar: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="110"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      نمره درد (VAS 0-10)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.painScore ?? ''}
                      onChange={e => setFormData({ ...formData, painScore: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Consciousness Level */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">سطح هوشیاری (AVPU):</span>
                  <div className="flex flex-wrap gap-2">
                    {(['هوشیار (Alert)', 'پاسخ به صدا (Voice)', 'پاسخ به درد (Pain)', 'بیهوش (Unresponsive)'] as ClinicConsciousness[]).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, consciousnessLevel: c })}
                        className={`px-3 py-1 text-xs rounded-xl border transition cursor-pointer ${
                          formData.consciousnessLevel === c
                            ? 'bg-teal-600 text-white border-teal-600 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CLINICAL EXAM & DIAGNOSIS */}
          {activeTab === 'exam' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تشخیص اولیه / بالینی (Primary Diagnosis) *
                  </label>
                  <input
                    type="text"
                    value={formData.primaryDiagnosis || ''}
                    onChange={e => setFormData({ ...formData, primaryDiagnosis: e.target.value })}
                    placeholder="مثال: بحران فشار خون، ضرب‌دیدگی مچ دست، سرماخوردگی حاد..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عضو یا ارگان درگیر (Affected Organ)
                  </label>
                  <input
                    type="text"
                    value={formData.affectedOrgan || ''}
                    onChange={e => setFormData({ ...formData, affectedOrgan: e.target.value })}
                    placeholder="مثال: دست چپ، چشم راست، سیستم تنفسی، سر و گردن..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Work Related Toggle */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                    ارتباط با کار / حادثه شغلی (Work-Related Incident):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    در صورت تایید، در شاخص‌های حوادث شغلی و کارنامه سلامت ثبت خواهد شد.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isWorkRelated: true })}
                    className={`px-4 py-1.5 text-xs rounded-xl font-bold border transition cursor-pointer ${
                      formData.isWorkRelated
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    بله (حادثه شغلی)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isWorkRelated: false })}
                    className={`px-4 py-1.5 text-xs rounded-xl font-bold border transition cursor-pointer ${
                      !formData.isWorkRelated
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    خیر (بیماری غیرشغلی)
                  </button>
                </div>
              </div>

              {formData.isWorkRelated && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    محل وقوع حادثه در سایت / واحد عملیاتی
                  </label>
                  <input
                    type="text"
                    value={formData.incidentLocation || ''}
                    onChange={e => setFormData({ ...formData, incidentLocation: e.target.value })}
                    placeholder="مثال: واحد الفین، سکوی تقطیر، کارگاه تراشکاری..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              )}

              {/* Physical Exam Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شرح مشاهدات و معاینه بالینی (Physical Examination Notes)
                </label>
                <textarea
                  rows={4}
                  value={formData.physicalExamNotes || ''}
                  onChange={e => setFormData({ ...formData, physicalExamNotes: e.target.value })}
                  placeholder="ثبت معاینه سمع ریه، لمس شکم، معاینه مردمک، ادم، دامنه حرکت مفاصل، شرح زخم و ترشحات..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: TREATMENTS & PROCEDURES */}
          {activeTab === 'treatments' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                  اقدامات درمانی انجام شده (Treatments & Nursing Interventions):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_ACTIONS.map(act => {
                    const isChecked = (formData.actionsPerformed || []).includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => toggleAction(act)}
                        className={`p-2.5 rounded-xl border text-right text-xs transition cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-800 dark:text-teal-300 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{act}</span>
                        {isChecked && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شرح تکمیلی پروسیجرها و مراقبت‌های بالینی
                </label>
                <textarea
                  rows={4}
                  value={formData.actionDetails || ''}
                  onChange={e => setFormData({ ...formData, actionDetails: e.target.value })}
                  placeholder="ثبت جزئیات مراقبت، تعداد بخیه‌ها، نوع سرم تزریقی، شدت جریان اکسیژن‌تراپی و..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 4: MEDICATIONS */}
          {activeTab === 'meds' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Add New Medication Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <span>ثبت دارو یا سرم تحویلی به بیمار:</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نام دارو *</label>
                    <input
                      type="text"
                      value={newMed.name}
                      onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                      placeholder="استامینوفن، سرم رینگر..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">دوز / فرم</label>
                    <input
                      type="text"
                      value={newMed.dosage}
                      onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                      placeholder="500mg, 1000cc..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">روش مصرف</label>
                    <select
                      value={newMed.route}
                      onChange={e => setNewMed({ ...newMed, route: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    >
                      <option value="خوراکی">خوراکی (PO)</option>
                      <option value="عضلانی">عضلانی (IM)</option>
                      <option value="وریدی">وریدی (IV)</option>
                      <option value="موضعی">موضعی (Topical)</option>
                      <option value="استنشاقی">استنشاقی (Inhalation)</option>
                      <option value="چشمی">چشمی (Eye)</option>
                      <option value="زیرزبانی">زیرزبانی (SL)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">دستور مصرف</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newMed.instructions}
                        onChange={e => setNewMed({ ...newMed, instructions: e.target.value })}
                        placeholder="هر ۸ ساعت ۱ عدد"
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                      <button
                        type="button"
                        onClick={addMedication}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center justify-center cursor-pointer"
                        title="افزودن دارو"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medication Table */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  داروهای تجویز شده: ({(formData.medications || []).length} قلم)
                </span>

                {(formData.medications || []).length > 0 ? (
                  <table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-700 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">نام دارو</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">دوز</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">روش</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">دستور مصرف</th>
                        <th className="p-2 w-16 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.medications || []).map((m, idx) => (
                        <tr key={m.id || idx} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{m.name}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono">{m.dosage || '-'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{m.route}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">{m.instructions || '-'}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeMedication(m.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    هیچ دارویی برای این مراجعه ثبت نشده است.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: OUTCOME, MEDICAL REST & DISPATCH */}
          {activeTab === 'outcome' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Disposition Outcome */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                  نتیجه و تعیین تکلیف نهایی بیمار (Disposition / Outcome) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {OUTCOMES.map(out => {
                    const isSelected = formData.outcome === out;
                    return (
                      <button
                        key={out}
                        type="button"
                        onClick={() => setFormData({ ...formData, outcome: out })}
                        className={`p-3 rounded-2xl border text-right text-xs transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 text-teal-800 dark:text-teal-300 font-black ring-2 ring-teal-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{out}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Medical Rest Section */}
              {(formData.outcome === 'استراحت پزشکی در منزل' || formData.outcome === 'استراحت در بهداری (تحت نظر)') && (
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-3">
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>جزئیات استراحت پزشکی و غیبت ناشی از بیماری:</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        تعداد روزهای استراحت پزشکی
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.medicalRestDays ?? ''}
                        onChange={e => setFormData({ ...formData, medicalRestDays: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="مثال: ۲ روز"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        از تاریخ (شمسی)
                      </label>
                      <input
                        type="text"
                        value={formData.medicalRestFrom || formData.visitDate || ''}
                        onChange={e => setFormData({ ...formData, medicalRestFrom: e.target.value })}
                        placeholder="1404/07/16"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        تا تاریخ (شمسی)
                      </label>
                      <input
                        type="text"
                        value={formData.medicalRestTo || ''}
                        onChange={e => setFormData({ ...formData, medicalRestTo: e.target.value })}
                        placeholder="1404/07/18"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Ambulance Dispatch Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Ambulance className="w-4 h-4 text-red-600" />
                    <span>اعزام بیمار با آمبولانس مجتمع (Ambulance Dispatch):</span>
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.ambulanceDispatch?.dispatched}
                      onChange={e => setFormData({
                        ...formData,
                        ambulanceDispatch: {
                          ...formData.ambulanceDispatch,
                          dispatched: e.target.checked
                        }
                      })}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">اعزام انجام شد</span>
                  </label>
                </div>

                {formData.ambulanceDispatch?.dispatched && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">کد آمبولانس</label>
                      <input
                        type="text"
                        value={formData.ambulanceDispatch?.ambulanceCode || ''}
                        onChange={e => setFormData({
                          ...formData,
                          ambulanceDispatch: { ...formData.ambulanceDispatch!, ambulanceCode: e.target.value }
                        })}
                        placeholder="AMB-01"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نام راننده آمبولانس</label>
                      <input
                        type="text"
                        value={formData.ambulanceDispatch?.driverName || ''}
                        onChange={e => setFormData({
                          ...formData,
                          ambulanceDispatch: { ...formData.ambulanceDispatch!, driverName: e.target.value }
                        })}
                        placeholder="نام راننده"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">پرستار / تکنسین اسکورت</label>
                      <input
                        type="text"
                        value={formData.ambulanceDispatch?.escortNurse || ''}
                        onChange={e => setFormData({
                          ...formData,
                          ambulanceDispatch: { ...formData.ambulanceDispatch!, escortNurse: e.target.value }
                        })}
                        placeholder="نام کادر اسکورت"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">بیمارستان مقصد</label>
                      <input
                        type="text"
                        value={formData.ambulanceDispatch?.destinationHospital || ''}
                        onChange={e => setFormData({
                          ...formData,
                          ambulanceDispatch: { ...formData.ambulanceDispatch!, destinationHospital: e.target.value }
                        })}
                        placeholder="بیمارستان تخصصی امام رضا..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">شرح تحویل به اورژانس بیمارستان</label>
                      <input
                        type="text"
                        value={formData.ambulanceDispatch?.handoverNotes || ''}
                        onChange={e => setFormData({
                          ...formData,
                          ambulanceDispatch: { ...formData.ambulanceDispatch!, handoverNotes: e.target.value }
                        })}
                        placeholder="تحویل به پزشک اورژانس، وضعیت علائم حیاتی حین تحویل..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Attending Medic & Staff Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام کادر درمانی ثبت‌کننده (Attending Medic) *
                  </label>
                  <input
                    type="text"
                    value={formData.attendingMedic || ''}
                    onChange={e => setFormData({ ...formData, attendingMedic: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سمت درمانی
                  </label>
                  <select
                    value={formData.medicRole || 'پرستار'}
                    onChange={e => setFormData({ ...formData, medicRole: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="پزشک عمومی">پزشک عمومی</option>
                    <option value="پزشک طب کار">پزشک متخصص طب کار</option>
                    <option value="پرستار">کارشناس پرستاری</option>
                    <option value="بهیار">بهیار</option>
                    <option value="تکنیسین فوریت‌های پزشکی (EMS)">تکنیسین فوریت‌های پزشکی (EMS)</option>
                  </select>
                </div>
              </div>

            </div>
          )}

          {/* Footer Actions */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <div className="flex items-center gap-2">
              {activeTab !== 'outcome' ? (
                <button
                  type="button"
                  onClick={() => {
                    const tabs: ('triage' | 'exam' | 'treatments' | 'meds' | 'outcome')[] = ['triage', 'exam', 'treatments', 'meds', 'outcome'];
                    const idx = tabs.indexOf(activeTab);
                    if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  مرحله بعد
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center gap-2 transition cursor-pointer shadow-lg shadow-teal-600/20"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'در حال ثبت در پایگاه داده...' : 'ثبت قطعی در پرونده بهداری'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { FireEquipment, MonthlyInspection, DefectRecord, EquipmentStatus } from '../types';
import { 
  ArrowRight, ArrowLeft, Plus, Calendar, AlertTriangle, Wrench, Clock, CheckCircle2, 
  Edit2, Trash2, ShieldCheck, AlertOctagon, XCircle, Info, Sparkles, Check, CheckCircle
} from 'lucide-react';
import { CATEGORY_COLUMNS } from '../config/columns';
import { SHIFT_OPTIONS } from '../config/columns';
import DefectModal from './DefectModal';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';

interface Props {
  language: 'fa' | 'en';
  equipment: FireEquipment;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<FireEquipment>) => void;
}

const MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];
const MONTHS_EN = [
  'Farvardin (Apr)', 'Ordibehesht (May)', 'Khordad (Jun)', 'Tir (Jul)', 'Mordad (Aug)', 'Shahrivar (Sep)',
  'Mehr (Oct)', 'Aban (Nov)', 'Azar (Dec)', 'Dey (Jan)', 'Bahman (Feb)', 'Esfand (Mar)'
];

export default function EquipmentDetailsView({ language, equipment, onBack, onUpdate }: Props) {
  const isFa = language === 'fa';
  const columns = CATEGORY_COLUMNS[equipment.category] || [];
  const months = isFa ? MONTHS_FA : MONTHS_EN;
  
  const [activeTab, setActiveTab] = useState<'inspections' | 'defects'>('inspections');
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<DefectRecord | null>(null);
  const [deletingDefect, setDeletingDefect] = useState<DefectRecord | null>(null);
  const [deletingInspectionMonth, setDeletingInspectionMonth] = useState<number | null>(null);

  // Inspection quick modal state
  const [inspectingMonth, setInspectingMonth] = useState<number | null>(null);
  const [inspectStatus, setInspectStatus] = useState<EquipmentStatus>('مطلوب');
  const [inspectDate, setInspectDate] = useState<string>(new Date().toLocaleDateString('fa-IR'));
  const [inspectorName, setInspectorName] = useState<string>('کارشناس ایمنی آتش‌نشانی');
  const [inspectShift, setInspectShift] = useState<string>('A');

  const getInspectionForMonth = (mIdx: number) => {
    return equipment.inspections.find(ins => ins.month === mIdx + 1);
  };

  const handleOpenInspectModal = (monthIdx: number) => {
    const existing = getInspectionForMonth(monthIdx);
    setInspectingMonth(monthIdx + 1);
    if (existing) {
      setInspectStatus(existing.status);
      setInspectDate(existing.date);
      setInspectorName(existing.inspectorName);
      setInspectShift(existing.shift || 'shift A');
    } else {
      setInspectStatus('مطلوب');
      setInspectDate(new Date().toLocaleDateString('fa-IR'));
      setInspectorName('کارشناس بازرسی آتش‌نشانی');
      setInspectShift('shift A');
    }
  };

  const handleSaveInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (inspectingMonth === null) return;

    const newIns: MonthlyInspection = {
      month: inspectingMonth,
      date: inspectDate,
      inspectorName,
      status: inspectStatus,
      shift: inspectShift
    };

    const updatedInspections = [
      ...equipment.inspections.filter(i => i.month !== inspectingMonth),
      newIns
    ];

    onUpdate(equipment.id, { inspections: updatedInspections });
    setInspectingMonth(null);
  };

  const handleOpenDefectModal = (defect?: DefectRecord) => {
    setEditingDefect(defect || null);
    setIsDefectModalOpen(true);
  };

  const handleSaveDefect = (defectData: DefectRecord) => {
    if (editingDefect) {
      onUpdate(equipment.id, {
        defects: equipment.defects.map(d => d.id === defectData.id ? defectData : d)
      });
    } else {
      onUpdate(equipment.id, {
        defects: [
          ...equipment.defects, 
          { 
            ...defectData, 
            id: 'def-' + Date.now(), 
            date: defectData.date || new Date().toLocaleDateString('fa-IR') 
          }
        ]
      });
    }
    setIsDefectModalOpen(false);
  };

  const goodCount = equipment.inspections.filter(i => i.status === 'مطلوب').length;
  const badCount = equipment.inspections.filter(i => i.status === 'نامطلوب').length;
  const openDefects = equipment.defects.filter(d => d.status === 'باز').length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            {isFa ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {equipment.category}
              </span>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isFa ? 'شناسنامه و سوابق بازرسی تجهیز' : 'Equipment Passport & Inspection History'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">ID: {equipment.id} | {equipment.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isFa ? `${goodCount} ماه مطلوب` : `${goodCount} Good`}</span>
          </div>
          {badCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>{isFa ? `${badCount} ماه نامطلوب` : `${badCount} Defective`}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Technical Specs Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-red-500" />
            {isFa ? 'مشخصات فنی و موقعیت استقرار' : 'Technical Specifications & Location'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {columns.map(col => (
              <div key={col.key} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {isFa ? col.labelFa : col.labelEn}
                </span>
                <span className="block font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {Array.isArray((equipment as any)[col.key]) 
                    ? ((equipment as any)[col.key] as string[]).join('، ')
                    : (equipment as any)[col.key] ?? '-'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4">
          <button 
            onClick={() => setActiveTab('inspections')}
            className={`pb-3 font-bold text-sm border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'inspections' 
                ? 'border-red-500 text-red-600 dark:text-red-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            {isFa ? 'جدول بازرسی ماهیانه (۱۲ ماه سال)' : '12-Month Inspection Sheet'}
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs">
              {equipment.inspections.length} / 12
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('defects')}
            className={`pb-3 font-bold text-sm border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'defects' 
                ? 'border-red-500 text-red-600 dark:text-red-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            {isFa ? 'نواقص و اقدامات اصلاحی (CAPA)' : 'Defects & CAPA'}
            {openDefects > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-full text-xs font-bold animate-pulse">
                {openDefects} باز
              </span>
            )}
          </button>
        </div>

        {/* Inspections Tab */}
        {activeTab === 'inspections' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {isFa ? 'چک‌لیست نظارت دوره‌ای ماه‌های سال' : 'Periodic Monthly Inspection Checklist'}
              </span>
              <span className="text-xs text-slate-500">
                {isFa ? 'کلیک روی دکمه ثبت جهت ثبت یا ویرایش گزارش ماه مربوطه' : 'Click log button to record monthly inspection'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{isFa ? 'ماه بازرسی' : 'Month'}</th>
                    <th className="px-4 py-3 font-semibold">{isFa ? 'وضعیت' : 'Condition'}</th>
                    <th className="px-4 py-3 font-semibold">{isFa ? 'تاریخ بازرسی' : 'Date'}</th>
                    <th className="px-4 py-3 font-semibold">{isFa ? 'بازرس مسئول' : 'Inspector'}</th>
                    <th className="px-4 py-3 font-semibold">{isFa ? 'شیفت' : 'Shift'}</th>
                    <th className="px-4 py-3 font-semibold text-center">{isFa ? 'عملیات' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {months.map((mName, idx) => {
                    const ins = getInspectionForMonth(idx);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          {mName}
                        </td>
                        <td className="px-4 py-3.5">
                          {ins ? (
                            ins.status === 'مطلوب' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {isFa ? 'مطلوب' : 'Good'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                <XCircle className="w-3.5 h-3.5" />
                                {isFa ? 'نامطلوب' : 'Defective'}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              {isFa ? 'ثبت نشده' : 'Not recorded'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs">{ins?.date || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 text-xs">{ins?.inspectorName || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 text-xs">{ins?.shift || '-'}</td>
                        <td className="px-4 py-3.5 text-center">
                          <button 
                            onClick={() => handleOpenInspectModal(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              ins 
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200' 
                                : 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300'
                            }`}
                          >
                            {ins ? (isFa ? 'ویرایش' : 'Edit') : (isFa ? '+ ثبت بازرسی' : '+ Log')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {/* Defects Tab */}
        {activeTab === 'defects' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-red-500" />
                  {isFa ? 'لیست نواقص ثبت شده و پیگیری اقدامات اصلاحی' : 'Registered Defects & Corrective Action Tracking'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isFa ? 'مدیریت و ثبت سوابق خرابی، درخواست‌های تعمیرات و وضعیت رفع نقص' : 'Manage defects, maintenance requests, and closure status'}
                </p>
              </div>
              <button 
                onClick={() => handleOpenDefectModal()} 
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                {isFa ? 'ثبت نقص جدید' : 'Log New Defect'}
              </button>
            </div>
            
            {equipment.defects.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                  {isFa ? 'هیچ نقصی برای این تجهیز ثبت نشده است' : 'No defects recorded for this equipment'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {isFa ? 'تجهیز در وضعیت مطلوب قرار دارد یا هنوز نقصی گزارش نشده است.' : 'Equipment is in good condition.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {equipment.defects.map(def => (
                  <div 
                    key={def.id} 
                    className={`border rounded-xl p-5 transition-colors ${
                      def.status === 'باز' 
                        ? 'border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${def.status === 'باز' ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-base">{def.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          def.status === 'بسته' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        }`}>
                          {def.status === 'بسته' ? (isFa ? '✓ بسته شده' : 'Closed') : (isFa ? '⚠ در دست اقدام' : 'Open')}
                        </span>
                        <button 
                          onClick={() => handleOpenDefectModal(def)} 
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title={isFa ? 'ویرایش نقص' : 'Edit Defect'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeletingDefect(def)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title={isFa ? 'حذف نقص' : 'Delete Defect'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isFa ? 'تاریخ ثبت' : 'Log Date'}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{def.date || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isFa ? 'شماره دستور کار' : 'Work Order No'}</span>
                        <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">{def.workOrderNo || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isFa ? 'مسئول پیگیری' : 'Responsible'}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{def.responsiblePerson || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isFa ? 'تاریخ اقدام / رفع' : 'Action Date'}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{def.actionDate || '-'}</span>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block mb-1 font-medium">{isFa ? 'اقدام اصلاحی انجام شده / برنامه‌ریزی‌شده:' : 'Corrective Action:'}</span>
                        <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                          {def.correctiveAction || (isFa ? 'هنوز اقدام اصلاحی درج نشده است.' : 'No action entered.')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly Inspection Logging Modal */}
      {inspectingMonth !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-slate-800 dark:text-white">
                {isFa ? `ثبت بازرسی ماه ${months[inspectingMonth - 1]}` : `Log Inspection for ${months[inspectingMonth - 1]}`}
              </h3>
              <button onClick={() => setInspectingMonth(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveInspection} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'وضعیت تجهیز در این بازرسی' : 'Equipment Status'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectStatus('مطلوب')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      inspectStatus === 'مطلوب' 
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isFa ? 'مطلوب' : 'Good'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectStatus('نامطلوب')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      inspectStatus === 'نامطلوب' 
                        ? 'bg-rose-500 text-white border-rose-600 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    {isFa ? 'نامطلوب' : 'Defective'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'تاریخ بازرسی' : 'Inspection Date'}
                </label>
                <input 
                  type="text" 
                  value={inspectDate}
                  onChange={e => setInspectDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'نام بازرس' : 'Inspector Name'}
                </label>
                <input 
                  type="text" 
                  value={inspectorName}
                  onChange={e => setInspectorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'شیفت کاری' : 'Shift'}
                </label>
                <select 
                  value={inspectShift}
                  onChange={e => setInspectShift(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  {SHIFT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                {inspectingMonth !== null && getInspectionForMonth(inspectingMonth - 1) ? (
                  <button 
                    type="button" 
                    onClick={() => {
                      setDeletingInspectionMonth(inspectingMonth);
                      setInspectingMonth(null);
                    }}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isFa ? 'حذف این رکورد بازرسی' : 'Delete Record'}</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setInspectingMonth(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    {isFa ? 'انصراف' : 'Cancel'}
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm cursor-pointer"
                  >
                    {isFa ? 'ذخیره بازرسی' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Defect Modal */}
      {isDefectModalOpen && (
        <DefectModal 
          language={language}
          initialData={editingDefect}
          onSave={handleSaveDefect}
          onClose={() => setIsDefectModalOpen(false)}
        />
      )}

      {/* Delete Defect Confirmation Modal */}
      {deletingDefect && (
        <ConfirmDeleteModal
          isOpen={!!deletingDefect}
          language={language}
          itemName={deletingDefect.description}
          itemType={isFa ? 'نقص گزارش‌شده' : 'Defect Record'}
          onConfirm={() => {
            if (deletingDefect) {
              onUpdate(equipment.id, {
                defects: equipment.defects.filter(d => d.id !== deletingDefect.id)
              });
              setDeletingDefect(null);
            }
          }}
          onClose={() => setDeletingDefect(null)}
        />
      )}

      {/* Delete Monthly Inspection Confirmation Modal */}
      {deletingInspectionMonth !== null && (
        <ConfirmDeleteModal
          isOpen={deletingInspectionMonth !== null}
          language={language}
          itemName={months[deletingInspectionMonth - 1]}
          itemType={isFa ? 'سوابق بازرسی ماه' : 'Inspection Record'}
          onConfirm={() => {
            if (deletingInspectionMonth !== null) {
              onUpdate(equipment.id, {
                inspections: equipment.inspections.filter(i => i.month !== deletingInspectionMonth)
              });
              setDeletingInspectionMonth(null);
            }
          }}
          onClose={() => setDeletingInspectionMonth(null)}
        />
      )}
    </div>
  );
}

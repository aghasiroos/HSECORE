import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Activity, 
  Save, 
  Printer, 
  ArrowRight, 
  Info,
  Sliders
} from 'lucide-react';
import { FmeaAssessment, FmeaRowItem } from '../types';
import { calculateRiskLevel, getRiskLevelColor } from '../services/riskAssessmentService';
import RiskPersonnelSignatures from './RiskPersonnelSignatures';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { printService } from '../../../services/printService';
import { getUnits } from '../../../utils/orgHelper';

interface FmeaFormProps {
  initialData?: FmeaAssessment | null;
  onSave: (assessment: FmeaAssessment) => void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

export default function FmeaForm({ initialData, onSave, onCancel, isFa, currentUser }: FmeaFormProps) {
  const [formData, setFormData] = useState<FmeaAssessment>(() => {
    if (initialData) return initialData;
    const nowJalali = '1404/06/05';
    return {
      id: `fmea-${Date.now()}`,
      code: `FMEA-1404-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: '',
      unit: '',
      areaLocation: '',
      assessorName: '',
      assessmentDate: nowJalali,
      teamMembers: [],
      status: 'APPROVED',
      method: 'FMEA',
      overallRiskLevel: 'HIGH',
      equipmentTag: '',
      systemName: '',
      rows: [
        {
          id: `fmea-row-${Date.now()}-1`,
          itemFunction: '',
          failureMode: '',
          failureEffects: '',
          severity: 8,
          causesOfFailure: '',
          occurrence: 5,
          currentControls: '',
          detection: 4,
          rpn: 160,
          rpnLevel: 'HIGH',
          recommendedActions: '',
          responsibility: '',
          targetDate: '1404/07/01',
          revisedSeverity: 8,
          revisedOccurrence: 2,
          revisedDetection: 2,
          revisedRpn: 32,
          revisedRpnLevel: 'LOW'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const handleAddRow = () => {
    const newRow: FmeaRowItem = {
      id: `fmea-row-${Date.now()}-${formData.rows.length + 1}`,
      itemFunction: '',
      failureMode: '',
      failureEffects: '',
      severity: 7,
      causesOfFailure: '',
      occurrence: 4,
      currentControls: '',
      detection: 3,
      rpn: 84,
      rpnLevel: 'MEDIUM',
      recommendedActions: '',
      responsibility: '',
      targetDate: '1404/07/01',
      revisedSeverity: 7,
      revisedOccurrence: 2,
      revisedDetection: 2,
      revisedRpn: 28,
      revisedRpnLevel: 'LOW'
    };
    setFormData(prev => ({ ...prev, rows: [...prev.rows, newRow] }));
  };

  const handleRemoveRow = (rowId: string) => {
    if (formData.rows.length <= 1) return;
    setFormData(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== rowId) }));
  };

  const handleRowChange = (rowId: string, field: keyof FmeaRowItem, value: any) => {
    setFormData(prev => {
      const updatedRows = prev.rows.map(row => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };

        // Initial RPN Calculation: S * O * D
        const s = field === 'severity' ? Number(value) : row.severity;
        const o = field === 'occurrence' ? Number(value) : row.occurrence;
        const d = field === 'detection' ? Number(value) : row.detection;
        updated.rpn = s * o * d;
        updated.rpnLevel = calculateRiskLevel(updated.rpn, 'RPN');

        // Revised RPN Calculation
        const rs = field === 'revisedSeverity' ? Number(value) : (row.revisedSeverity || s);
        const ro = field === 'revisedOccurrence' ? Number(value) : (row.revisedOccurrence || o);
        const rd = field === 'revisedDetection' ? Number(value) : (row.revisedDetection || d);
        updated.revisedRpn = rs * ro * rd;
        updated.revisedRpnLevel = calculateRiskLevel(updated.revisedRpn, 'RPN');

        return updated;
      });

      const maxRpn = Math.max(...updatedRows.map(r => r.rpn));
      const overallLevel = calculateRiskLevel(maxRpn, 'RPN');

      return {
        ...prev,
        rows: updatedRows,
        overallRiskLevel: overallLevel
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert(isFa ? 'لطفاً عنوان مطالعه FMEA را وارد فرمایید' : 'Please enter FMEA title');
      return;
    }
    onSave(formData);
  };

  const overallColors = getRiskLevelColor(formData.overallRiskLevel);

  const handlePrint = () => {
    printService.printElement('fmea-assessment-form-print', {
      title: `آنالیز حالات و اثرات خرابی (FMEA) - ${formData.code} - ${formData.equipmentTag || formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-FMEA-01',
      documentDate: formData.assessmentDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  return (
    <form id="fmea-assessment-form-print" onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      {/* ── Form Header ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {initialData ? (isFa ? 'ویرایش مطالعه FMEA تجهیزات' : 'Edit FMEA Study') : (isFa ? 'فرم استاندارد آنالیز حالات و اثرات خرابی (FMEA)' : 'New FMEA Assessment Form')}
            </h2>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap" dir="ltr">
              {formData.code}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold mt-1 mr-7">
            {isFa ? 'فرمول استاندارد اولویت ریسک: RPN = شدت (Severity 1-10) × وقوع (Occurrence 1-10) × کشف (Detection 1-10)' : 'RPN Formula = Severity × Occurrence × Detection'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{isFa ? 'سطح بحرانیت RPN:' : 'RPN Status:'}</span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black whitespace-nowrap ${overallColors.badge}`}>
              {isFa ? overallColors.labelFa : overallColors.labelEn}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isFa ? 'چاپ استاندارد فرم FMEA' : 'Print FMEA Form'}
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isFa ? 'ذخیره پرونده FMEA' : 'Save FMEA Record'}</span>
          </button>
        </div>
      </div>

      {/* ── Header Metadata ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Info className="w-4 h-4 text-amber-600" />
          {isFa ? 'مشخصات تجهیز و سیستم مورد مطالعه' : 'Equipment & System Overview'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'عنوان مطالعه / پروژه ارزیابی خرابی *' : 'Study / Project Title *'}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder={isFa ? 'مثال: ارزیابی FMEA پمپ خوراک اصلی P-101 A/B' : 'e.g. FMEA for Feed Pump P-101 A/B'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'تگ تجهیز (Equipment Tag)' : 'Equipment Tag'}
            </label>
            <input
              type="text"
              value={formData.equipmentTag}
              onChange={e => setFormData({ ...formData, equipmentTag: e.target.value })}
              placeholder={isFa ? 'مثال: P-101 A/B' : 'e.g. P-101 A/B'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'نام سیستم / زیرسیستم' : 'System / Subsystem'}
            </label>
            <input
              type="text"
              value={formData.systemName}
              onChange={e => setFormData({ ...formData, systemName: e.target.value })}
              placeholder={isFa ? 'مثال: سیستم روانکاری و سیلینگ هیدرولیک' : 'e.g. Lube Oil & Sealing'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'واحد عملیاتی' : 'Unit'}
            </label>
            <input
              type="text"
              list="fmea-units-list"
              value={formData.unit}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <datalist id="fmea-units-list">
              {getUnits().map(u => <option key={u} value={u} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'تاریخ مطالعه' : 'Assessment Date'}
            </label>
            <PersianDatePicker
              value={formData.assessmentDate}
              onChange={(jStr) => setFormData({ ...formData, assessmentDate: jStr })}
              isFa={isFa}
              placeholder={isFa ? 'انتخاب تاریخ مطالعه...' : 'Assessment date...'}
            />
          </div>
        </div>
      </div>

      {/* Personnel Signatures Block */}
      <RiskPersonnelSignatures
        formData={formData}
        onChange={(updated) => setFormData(prev => ({ ...prev, ...updated, method: 'FMEA' }))}
        isFa={isFa}
      />

      {/* ── FMEA Matrix Worksheet ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600" />
              {isFa ? 'جدول تحلیل حالات بالقوه خرابی، علل، اثرات و شاخص RPN' : 'FMEA Analysis Matrix'}
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              {isFa ? 'مقادیر S (شدت ۱-۱۰)، O (وقوع ۱-۱۰)، D (تشخیص ۱-۱۰) و RPN (۱ تا ۱۰۰۰)' : 'S (1-10), O (1-10), D (1-10) -> RPN = S*O*D'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-300 rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFa ? '+ افزودن ردیف خرابی' : '+ Add Failure Mode'}</span>
          </button>
        </div>

        <div className="space-y-4">
          {formData.rows.map((row, index) => {
            const rpnColor = getRiskLevelColor(row.rpnLevel);
            const revisedColor = getRiskLevelColor(row.revisedRpnLevel || 'LOW');

            return (
              <div 
                key={row.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    {isFa ? `آیتم تحلیل خرابی شماره ${index + 1}` : `Item #${index + 1}`}
                  </span>
                  {formData.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-red-500 hover:text-red-700 p-1 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'قطعه / کارکرد تجهیز (Item & Function) *' : 'Item & Function *'}
                    </label>
                    <input
                      type="text"
                      value={row.itemFunction}
                      onChange={e => handleRowChange(row.id, 'itemFunction', e.target.value)}
                      placeholder={isFa ? 'مثال: آب‌بند مکانیکی (Mechanical Seal)' : 'e.g. Mechanical Seal'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-red-600 dark:text-red-400 mb-1">
                      {isFa ? 'حالت بالقوه خرابی (Failure Mode) *' : 'Potential Failure Mode *'}
                    </label>
                    <input
                      type="text"
                      value={row.failureMode}
                      onChange={e => handleRowChange(row.id, 'failureMode', e.target.value)}
                      placeholder={isFa ? 'مثال: سایش فیس سیل و نشتی سیال' : 'e.g. Seal face wear'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden text-red-700 dark:text-red-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {isFa ? 'اثرات خرابی بر ایمنی و فرآیند (Effects) *' : 'Failure Effects *'}
                    </label>
                    <input
                      type="text"
                      value={row.failureEffects}
                      onChange={e => handleRowChange(row.id, 'failureEffects', e.target.value)}
                      placeholder={isFa ? 'مثال: ایجاد اتمسفر انفجاری و شات‌دان واحد' : 'e.g. Hydrocarbon release'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>
                </div>

                {/* S, O, D and RPN */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="md:col-span-4 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black text-slate-500 mb-1 block">
                      {isFa ? 'محاسبه شاخص اولیه RPN (قبل از اصلاح)' : 'Initial RPN (S × O × D)'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'شدت (S)' : 'S (1-10)'}</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.severity}
                          onChange={e => handleRowChange(row.id, 'severity', Number(e.target.value))}
                          className="w-12 p-1 text-center font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <span className="font-bold text-slate-400">×</span>
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'وقوع (O)' : 'O (1-10)'}</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.occurrence}
                          onChange={e => handleRowChange(row.id, 'occurrence', Number(e.target.value))}
                          className="w-12 p-1 text-center font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <span className="font-bold text-slate-400">×</span>
                      <div>
                        <span className="text-[9px] text-slate-400 block">{isFa ? 'کشف (D)' : 'D (1-10)'}</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.detection}
                          onChange={e => handleRowChange(row.id, 'detection', Number(e.target.value))}
                          className="w-12 p-1 text-center font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div className="mr-auto text-center">
                        <span className="text-[9px] text-slate-400 block">RPN</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-black ${rpnColor.badge}`}>
                          {row.rpn}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300">
                      {isFa ? 'اقدامات اصلاحی و پیشنهادی (Recommended Actions) *' : 'Recommended Actions *'}
                    </label>
                    <input
                      type="text"
                      value={row.recommendedActions}
                      onChange={e => handleRowChange(row.id, 'recommendedActions', e.target.value)}
                      placeholder={isFa ? 'مثال: نصب ترانسمیتر آنلاین با آلارم DCS و تعویض با متریال SiC' : 'Action items'}
                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>

                  <div className="md:col-span-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-1 block">
                      {isFa ? 'RPN بازنگری‌شده' : 'Revised RPN'}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <div>
                        <span className="text-[8px] text-slate-400 block">S'</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.revisedSeverity || row.severity}
                          onChange={e => handleRowChange(row.id, 'revisedSeverity', Number(e.target.value))}
                          className="w-10 p-1 text-center font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block">O'</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.revisedOccurrence || 2}
                          onChange={e => handleRowChange(row.id, 'revisedOccurrence', Number(e.target.value))}
                          className="w-10 p-1 text-center font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block">D'</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.revisedDetection || 2}
                          onChange={e => handleRowChange(row.id, 'revisedDetection', Number(e.target.value))}
                          className="w-10 p-1 text-center font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div className="mr-auto text-center">
                        <span className="text-[8px] text-slate-400 block">RPN'</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${revisedColor.badge}`}>
                          {row.revisedRpn || 28}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
}

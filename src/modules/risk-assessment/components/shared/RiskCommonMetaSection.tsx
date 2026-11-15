import React, { useEffect, useState } from 'react';
import {
  Info,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Building2,
  Wrench,
  FileWarning,
  ClipboardCheck,
  FileText,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  BaseRiskAssessment,
  LinkedHseContext,
} from '../../types';
import PersianDatePicker from '../../../../components/common/PersianDatePicker';
import UniversalOrgUnitSelect from '../../../../components/common/UniversalOrgUnitSelect';
import RiskPersonnelSignatures from '../RiskPersonnelSignatures';
import { apiDb } from '../../../../services/apiDatabaseClient';
import {
  findSimilarHazardSuggestions,
  SimilarHazardSuggestion,
} from '../../services/riskWorkflowEngine';

interface RiskCommonMetaSectionProps {
  formData: BaseRiskAssessment;
  onChange: (updated: Partial<BaseRiskAssessment>) => void;
  isFa: boolean;
  allAssessments?: AnyRiskAssessment[];
  titleLabelFa?: string;
  titlePlaceholderFa?: string;
  onApplySuggestion?: (suggestion: SimilarHazardSuggestion) => void;
  extraFields?: React.ReactNode;
}

export default function RiskCommonMetaSection({
  formData,
  onChange,
  isFa,
  allAssessments = [],
  titleLabelFa = 'عنوان ارزیابی ریسک *',
  titlePlaceholderFa = 'عنوان دقیق فعالیت، تجهیز، فرآیند یا شغل را وارد کنید...',
  onApplySuggestion,
  extraFields,
}: RiskCommonMetaSectionProps) {
  const [showCrossLinks, setShowCrossLinks] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contractors, setContractors] = useState<any[]>([]);
  const [permits, setPermits] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [fireEquipment, setFireEquipment] = useState<any[]>([]);
  const [contextLoaded, setContextLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadRefs = async () => {
      try {
        const [ctrs, ptList, incList, inspList, eqList] = await Promise.all([
          apiDb.getSetting('hse_training_contractors').catch(() => []),
          apiDb.getWorkPermits().catch(() => []),
          apiDb.getIncidents().catch(() => []),
          apiDb.getSafetyInspections().catch(() => []),
          apiDb.getFireEquipment().catch(() => []),
        ]);
        if (!mounted) return;
        setContractors(Array.isArray(ctrs) ? ctrs : []);
        setPermits(Array.isArray(ptList) ? ptList.slice(0, 60) : []);
        setIncidents(Array.isArray(incList) ? incList.slice(0, 60) : []);
        setInspections(Array.isArray(inspList) ? inspList.slice(0, 60) : []);
        setFireEquipment(Array.isArray(eqList) ? eqList.slice(0, 80) : []);
        setContextLoaded(true);
      } catch {
        if (mounted) setContextLoaded(true);
      }
    };
    loadRefs();
    return () => {
      mounted = false;
    };
  }, []);

  const suggestions = React.useMemo(() => {
    if (!contextLoaded) return [];
    return findSimilarHazardSuggestions(
      {
        title: formData.title,
        unit: formData.unit,
        equipmentTag: (formData as any).equipmentTag || formData.linkedRefs?.equipmentTag,
      },
      allAssessments.filter(a => String(a.id) !== String(formData.id)),
      incidents,
      inspections
    );
  }, [contextLoaded, formData.title, formData.unit, formData.id, formData.linkedRefs?.equipmentTag, allAssessments, incidents, inspections]);

  const updateLinkedRef = (patch: Partial<LinkedHseContext>) => {
    onChange({
      linkedRefs: {
        ...(formData.linkedRefs || {}),
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Core Metadata */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{isFa ? 'مشخصات پایه و اطلاعات زمینه ارزیابی' : 'Assessment Context & Metadata'}</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCrossLinks(v => !v)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isFa ? 'اتصال به ماژول‌های HSE' : 'Cross-Module Links'}</span>
              {showCrossLinks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSuggestions(v => !v)}
                className="px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isFa ? `پیشنهاد سوابق مشابه (${suggestions.length})` : `Similar Records (${suggestions.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? titleLabelFa : 'Assessment Title *'}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => onChange({ title: e.target.value })}
              placeholder={isFa ? titlePlaceholderFa : 'Enter title...'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'تاریخ ارزیابی *' : 'Assessment Date *'}
            </label>
            <PersianDatePicker
              value={formData.assessmentDate}
              onChange={jStr => onChange({ assessmentDate: jStr })}
              isFa={isFa}
              placeholder={isFa ? 'انتخاب تاریخ...' : 'Select date...'}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'سایت / مجتمع' : 'Site / Plant'}
            </label>
            <input
              type="text"
              value={formData.site}
              onChange={e => onChange({ site: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'واحد عملیاتی / سازمانی *' : 'Operational Unit *'}
            </label>
            <UniversalOrgUnitSelect
              value={formData.unit}
              unitId={formData.unitId ? String(formData.unitId) : undefined}
              onChange={(uid, unitName) =>
                onChange({
                  unit: unitName || uid,
                  unitId: uid && !Number.isNaN(Number(uid)) ? Number(uid) : null,
                })
              }
              isFa={isFa}
              placeholder={isFa ? 'انتخاب یا جستجوی واحد...' : 'Select unit...'}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'محل دقیق / ناحیه عملیاتی' : 'Exact Area / Location'}
            </label>
            <input
              type="text"
              value={formData.areaLocation}
              onChange={e => onChange({ areaLocation: e.target.value })}
              placeholder={isFa ? 'مثال: خط A، برج تقطیر T-101' : 'e.g. Line A, Tower T-101'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'شرکت پیمانکار مرتبط (اختیاری)' : 'Contractor (Optional)'}
            </label>
            <select
              value={formData.contractorName || ''}
              onChange={e => {
                const name = e.target.value;
                const found = contractors.find((c: any) => (c.companyName || c.name) === name);
                onChange({
                  contractorName: name,
                  contractorId: found?.id ? String(found.id) : undefined,
                });
                updateLinkedRef({
                  contractorName: name,
                  contractorId: found?.id ? String(found.id) : undefined,
                });
              }}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
            >
              <option value="">{isFa ? 'داخلی / بدون پیمانکار' : 'Internal / None'}</option>
              {contractors.map((c: any, idx: number) => {
                const cname = c.companyName || c.name || `پیمانکار ${idx + 1}`;
                return (
                  <option key={c.id || idx} value={cname}>
                    {cname}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {extraFields && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {extraFields}
          </div>
        )}

        {/* Cross-Module HSE Connections */}
        {showCrossLinks && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {isFa
                ? 'ارتباط اختیاری این ارزیابی ریسک با سوابق سایر ماژول‌های HSECORE (تنها جهت ردیابی متقاطع):'
                : 'Optional cross-module references in HSECORE:'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isFa ? 'پروانه کار (PTW)' : 'Work Permit'}</span>
                </label>
                <select
                  value={formData.linkedRefs?.permitNumber || ''}
                  onChange={e => {
                    const pNo = e.target.value;
                    const found = permits.find(p => p.permitNumber === pNo);
                    updateLinkedRef({ permitNumber: pNo, permitTitle: found?.workDescription || found?.title || '' });
                  }}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                >
                  <option value="">{isFa ? 'انتخاب پروانه کار...' : 'Select PTW...'}</option>
                  {permits.map((p: any) => (
                    <option key={p.id || p.permitNumber} value={p.permitNumber}>
                      {p.permitNumber} — {String(p.workDescription || p.unit || '').slice(0, 32)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <Wrench className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isFa ? 'تجهیز / کد دارایی' : 'Equipment / Asset'}</span>
                </label>
                <input
                  type="text"
                  list="risk-equipment-tags"
                  value={formData.linkedRefs?.equipmentTag || ''}
                  onChange={e => updateLinkedRef({ equipmentTag: e.target.value })}
                  placeholder={isFa ? 'کد تگ یا انتخاب تجهیز...' : 'Tag / Equipment...'}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                />
                <datalist id="risk-equipment-tags">
                  {fireEquipment.map((eq: any, idx: number) => (
                    <option key={eq.id || idx} value={eq.tagNumber || eq.code || eq.name}>
                      {eq.name || eq.equipmentType}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <FileWarning className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isFa ? 'حادثه / شبه‌حادثه مرتبط' : 'Related Incident'}</span>
                </label>
                <select
                  value={formData.linkedRefs?.incidentNumber || ''}
                  onChange={e => {
                    const iNo = e.target.value;
                    const found = incidents.find(i => (i.incidentNumber || String(i.id)) === iNo);
                    updateLinkedRef({ incidentNumber: iNo, incidentTitle: found?.description?.slice(0, 50) || '' });
                  }}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                >
                  <option value="">{isFa ? 'انتخاب حادثه...' : 'Select Incident...'}</option>
                  {incidents.map((inc: any) => {
                    const key = inc.incidentNumber || String(inc.id);
                    return (
                      <option key={key} value={key}>
                        {key} — {String(inc.description || '').slice(0, 32)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isFa ? 'بازرسی ایمنی مرتبط' : 'Related Inspection'}</span>
                </label>
                <select
                  value={formData.linkedRefs?.inspectionId || ''}
                  onChange={e => {
                    const id = e.target.value;
                    const found = inspections.find(i => String(i.id) === id);
                    updateLinkedRef({ inspectionId: id, inspectionTitle: found?.title || '' });
                  }}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                >
                  <option value="">{isFa ? 'انتخاب بازرسی...' : 'Select Inspection...'}</option>
                  {inspections.map((ins: any) => (
                    <option key={ins.id} value={String(ins.id)}>
                      {ins.title || ins.code || `بازرسی ${ins.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Advisory Similar-Hazard Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isFa
                    ? 'پیشنهادهای مشورتی از سوابق ارزیابی ریسک، حوادث و بازرسی‌های مشابه (تصمیم نهایی با کارشناس HSE است):'
                    : 'Advisory suggestions from historical risks, incidents, and inspections:'}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {suggestions.map(sug => (
                <div
                  key={sug.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-700 flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                        {sug.sourceType === 'RISK_ASSESSMENT'
                          ? (isFa ? 'ارزیابی قبلی' : 'Risk Record')
                          : sug.sourceType === 'INCIDENT'
                          ? (isFa ? 'سابقه حادثه' : 'Incident')
                          : (isFa ? 'سابقه بازرسی' : 'Inspection')}
                        {' • '}
                        {sug.sourceCode}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {sug.unit}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{sug.hazardText}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-bold">{isFa ? 'کنترل پیشنهادی:' : 'Suggested Control:'}</span>{' '}
                      {sug.recommendedControl}
                    </p>
                  </div>
                  {onApplySuggestion && (
                    <button
                      type="button"
                      onClick={() => onApplySuggestion(sug)}
                      className="self-end px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black transition cursor-pointer"
                    >
                      {isFa ? '+ درج به عنوان پیش‌نویس قابل ویرایش' : '+ Insert Draft Row'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Signatures & Assessment Team */}
      <RiskPersonnelSignatures
        formData={formData}
        onChange={onChange}
        isFa={isFa}
      />
    </div>
  );
}

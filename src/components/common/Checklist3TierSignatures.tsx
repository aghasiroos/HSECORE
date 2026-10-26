import React from 'react';
import CentralPersonnelSelector from '../CentralPersonnelSelector';
import { X, UserCheck, ShieldCheck, Award } from 'lucide-react';
import { ComplexPersonnel, PersonnelOrgDetails } from '../../utils/personnelHelper';

export interface ChecklistSignatoryData {
  inspectorName?: string;
  inspectorCode?: string;
  supervisorName?: string;
  supervisorCode?: string;
  hseManagerName?: string;
  hseManagerCode?: string;
  [key: string]: any;
}

export interface Checklist3TierSignaturesProps {
  formData: ChecklistSignatoryData;
  onChange: (updated: Partial<ChecklistSignatoryData>) => void;
  isFa: boolean;
  tier1Title?: string;
  tier1Subtitle?: string;
  tier2Title?: string;
  tier2Subtitle?: string;
  tier3Title?: string;
  tier3Subtitle?: string;
  readOnly?: boolean;
}

/**
 * Universal Unified 3-Tier Signatures Component for HSECORE Checklists
 * Tiers:
 * 1. کارشناس / نماینده واحد (Unit Expert / Representative)
 * 2. سرپرست / مسئول واحد (Unit Supervisor / Lead)
 * 3. رئیس مرکز HSE (Head of HSE Center)
 */
export const Checklist3TierSignatures: React.FC<Checklist3TierSignaturesProps> = ({
  formData,
  onChange,
  isFa = true,
  tier1Title,
  tier1Subtitle,
  tier2Title,
  tier2Subtitle,
  tier3Title,
  tier3Subtitle,
  readOnly = false
}) => {
  const formatPersonnelString = (person: ComplexPersonnel, org: PersonnelOrgDetails) => {
    const title = person.jobTitle || 'پرسنل';
    return `${person.fullName} (${org.unit} - ${title})`;
  };

  const handleSelectTier1 = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      onChange({
        inspectorName: formatPersonnelString(person, org),
        inspectorCode: person.personnelCode || person.effectiveCode || ''
      });
    } else {
      onChange({ inspectorName: '', inspectorCode: '' });
    }
  };

  const handleSelectTier2 = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      onChange({
        supervisorName: formatPersonnelString(person, org),
        supervisorCode: person.personnelCode || person.effectiveCode || ''
      });
    } else {
      onChange({ supervisorName: '', supervisorCode: '' });
    }
  };

  const handleSelectTier3 = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      onChange({
        hseManagerName: formatPersonnelString(person, org),
        hseManagerCode: person.personnelCode || person.effectiveCode || ''
      });
    } else {
      onChange({ hseManagerName: '', hseManagerCode: '' });
    }
  };

  const t1Label = tier1Title || (isFa ? 'کارشناس / نماینده واحد' : 'Unit Expert / Representative');
  const t1Sub = tier1Subtitle || (isFa ? 'بازرس و ثبت‌کننده میدانی' : 'Field Inspector & Auditor');

  const t2Label = tier2Title || (isFa ? 'سرپرست / مسئول واحد' : 'Unit Supervisor / In-Charge');
  const t2Sub = tier2Subtitle || (isFa ? 'بررسی‌کننده و ناظر محل' : 'Area Supervisor & Reviewer');

  const t3Label = tier3Title || (isFa ? 'رئیس مرکز HSE' : 'Head of HSE Center');
  const t3Sub = tier3Subtitle || (isFa ? 'تصویب و تأیید نهایی' : 'Final HSE Approval');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{isFa ? 'جایگاه‌های یکپارچه امضا و تأییدات چک‌لیست (۳ سطح سازمانی)' : 'Checklist 3-Tier Signatures Matrix'}</span>
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">3-TIER HSE AUDIT SIGNATURES</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Tier 1: کارشناس / نماینده واحد */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                ۱
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
                  {t1Label}
                </h5>
                <span className="text-[10px] text-slate-500 block">{t1Sub}</span>
              </div>
            </div>

            {!readOnly && (
              <div className="mb-2">
                <CentralPersonnelSelector
                  language={isFa ? 'fa' : 'en'}
                  placeholder={isFa ? 'جستجو و انتخاب کارشناس...' : 'Search Personnel...'}
                  onSelectPersonnel={handleSelectTier1}
                  compact
                />
              </div>
            )}
          </div>

          <div>
            {formData.inspectorName ? (
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-indigo-900/50 text-xs font-bold text-slate-800 dark:text-slate-200">
                <div className="truncate">
                  <div className="truncate">{formData.inspectorName}</div>
                  {formData.inspectorCode && (
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      کد: {formData.inspectorCode}
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onChange({ inspectorName: '', inspectorCode: '' })}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer shrink-0"
                    title={isFa ? 'حذف انتخاب' : 'Clear'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-dashed border border-slate-300 dark:border-slate-700 rounded-lg text-center text-[11px] text-slate-400 font-medium">
                {isFa ? 'انتخاب نشده' : 'Not assigned'}
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: سرپرست / مسئول واحد */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                ۲
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
                  {t2Label}
                </h5>
                <span className="text-[10px] text-slate-500 block">{t2Sub}</span>
              </div>
            </div>

            {!readOnly && (
              <div className="mb-2">
                <CentralPersonnelSelector
                  language={isFa ? 'fa' : 'en'}
                  placeholder={isFa ? 'جستجو و انتخاب سرپرست واحد...' : 'Search Supervisor...'}
                  onSelectPersonnel={handleSelectTier2}
                  compact
                />
              </div>
            )}
          </div>

          <div>
            {formData.supervisorName ? (
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs font-bold text-slate-800 dark:text-slate-200">
                <div className="truncate">
                  <div className="truncate">{formData.supervisorName}</div>
                  {formData.supervisorCode && (
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      کد: {formData.supervisorCode}
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onChange({ supervisorName: '', supervisorCode: '' })}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer shrink-0"
                    title={isFa ? 'حذف انتخاب' : 'Clear'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-dashed border border-slate-300 dark:border-slate-700 rounded-lg text-center text-[11px] text-slate-400 font-medium">
                {isFa ? 'انتخاب نشده' : 'Not assigned'}
              </div>
            )}
          </div>
        </div>

        {/* Tier 3: رئیس مرکز HSE */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                ۳
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
                  {t3Label}
                </h5>
                <span className="text-[10px] text-slate-500 block">{t3Sub}</span>
              </div>
            </div>

            {!readOnly && (
              <div className="mb-2">
                <CentralPersonnelSelector
                  language={isFa ? 'fa' : 'en'}
                  placeholder={isFa ? 'جستجو و انتخاب رئیس مرکز HSE...' : 'Search HSE Head...'}
                  onSelectPersonnel={handleSelectTier3}
                  compact
                />
              </div>
            )}
          </div>

          <div>
            {formData.hseManagerName ? (
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-900/50 text-xs font-bold text-slate-800 dark:text-slate-200">
                <div className="truncate">
                  <div className="truncate">{formData.hseManagerName}</div>
                  {formData.hseManagerCode && (
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      کد: {formData.hseManagerCode}
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onChange({ hseManagerName: '', hseManagerCode: '' })}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer shrink-0"
                    title={isFa ? 'حذف انتخاب' : 'Clear'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-dashed border border-slate-300 dark:border-slate-700 rounded-lg text-center text-[11px] text-slate-400 font-medium">
                {isFa ? 'انتخاب نشده' : 'Not assigned'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checklist3TierSignatures;

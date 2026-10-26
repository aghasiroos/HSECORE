import React from 'react';
import { BaseRiskAssessment } from '../types';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import { X, Users, UserCheck, ShieldAlert, PenTool } from 'lucide-react';
import { ComplexPersonnel, PersonnelOrgDetails, getPersonnelSignature } from '../../../utils/personnelHelper';

interface RiskPersonnelSignaturesProps {
  formData: BaseRiskAssessment;
  onChange: (updated: Partial<BaseRiskAssessment>) => void;
  isFa: boolean;
}

export default function RiskPersonnelSignatures({ formData, onChange, isFa }: RiskPersonnelSignaturesProps) {
  const formatPersonnelString = (person: ComplexPersonnel, org: PersonnelOrgDetails) => {
    const title = person.jobTitle || 'پرسنل';
    return `${person.fullName} (${org.unit} - ${title})`;
  };

  const handleSelectAssessor = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      onChange({ assessorName: formatPersonnelString(person, org) });
    } else {
      onChange({ assessorName: '' });
    }
  };

  const handleSelectHse = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      onChange({ hseEngineerName: formatPersonnelString(person, org) });
    } else {
      onChange({ hseEngineerName: '' });
    }
  };

  const handleSelectApprover = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      onChange({ approverName: formatPersonnelString(person, org) });
    } else {
      onChange({ approverName: '' });
    }
  };

  const handleAddTeamMember = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      const newMemberStr = formatPersonnelString(person, org);
      const current = formData.teamMembers || [];
      if (!current.includes(newMemberStr)) {
        onChange({ teamMembers: [...current, newMemberStr] });
      }
    }
  };

  const removeTeamMember = (idx: number) => {
    const current = formData.teamMembers || [];
    onChange({ teamMembers: current.filter((_, i) => i !== idx) });
  };

  const renderSignaturePreview = (nameStr?: string) => {
    if (!nameStr) return null;
    const sig = getPersonnelSignature(nameStr);
    if (!sig) return null;
    return (
      <div className="mt-2 p-2 bg-white dark:bg-slate-950 rounded-lg border border-dashed border-indigo-200 dark:border-slate-700 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
          <PenTool className="w-3 h-3" />
          <span>{isFa ? 'نمونه امضای پرسنل:' : 'Signature:'}</span>
        </span>
        <img
          src={sig}
          alt="Signature"
          className="max-h-10 max-w-[110px] object-contain mix-blend-multiply dark:mix-blend-normal"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Assessor / Team Leader */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isFa ? 'ارزیاب / سرپرست تیم ارزیابی' : 'Lead Assessor / Team Leader'}
            </h4>
          </div>
          <div className="space-y-3">
            <CentralPersonnelSelector
              language={isFa ? 'fa' : 'en'}
              placeholder={isFa ? 'جستجوی پرسنل...' : 'Search Personnel...'}
              onSelectPersonnel={handleSelectAssessor}
              compact
            />
            {formData.assessorName && (
              <div>
                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{formData.assessorName}</span>
                  <button type="button" onClick={() => onChange({ assessorName: '' })} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderSignaturePreview(formData.assessorName)}
              </div>
            )}
          </div>
        </div>

        {/* HSE Engineer */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isFa ? 'سرپرست ایمنی فرآیند' : 'Process Safety / HSE Engineer'}
            </h4>
          </div>
          <div className="space-y-3">
            <CentralPersonnelSelector
              language={isFa ? 'fa' : 'en'}
              placeholder={isFa ? 'جستجوی پرسنل...' : 'Search Personnel...'}
              onSelectPersonnel={handleSelectHse}
              compact
            />
            {formData.hseEngineerName && (
              <div>
                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{formData.hseEngineerName}</span>
                  <button type="button" onClick={() => onChange({ hseEngineerName: '' })} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderSignaturePreview(formData.hseEngineerName)}
              </div>
            )}
          </div>
        </div>

        {/* Final Approver */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isFa ? 'تصویب‌کننده نهایی' : 'Final Approver'}
            </h4>
          </div>
          <div className="space-y-3">
            <CentralPersonnelSelector
              language={isFa ? 'fa' : 'en'}
              placeholder={isFa ? 'جستجوی پرسنل...' : 'Search Personnel...'}
              onSelectPersonnel={handleSelectApprover}
              compact
            />
            {formData.approverName && (
              <div>
                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>{formData.approverName}</span>
                  <button type="button" onClick={() => onChange({ approverName: '' })} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderSignaturePreview(formData.approverName)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isFa ? 'اعضای تیم ارزیابی ریسک' : 'Assessment Team Members'}
          </h4>
        </div>
        
        <div className="max-w-sm mb-3">
          <CentralPersonnelSelector
            language={isFa ? 'fa' : 'en'}
            placeholder={isFa ? 'افزودن عضو جدید (جستجو)...' : 'Add team member (search)...'}
            onSelectPersonnel={handleAddTeamMember}
            compact
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {formData.teamMembers && formData.teamMembers.length > 0 ? (
            formData.teamMembers.map((member, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm"
              >
                <span>{member}</span>
                <button
                  type="button"
                  onClick={() => removeTeamMember(idx)}
                  className="p-0.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">
              {isFa ? 'عضوی انتخاب نشده است' : 'No team members added'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

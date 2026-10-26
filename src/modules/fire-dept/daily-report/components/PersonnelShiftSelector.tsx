import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, User, Check, X, Building2, Briefcase, CheckCircle2, ChevronDown } from 'lucide-react';
import { ComplexPersonnel } from '../../../../utils/personnelHelper';
import { useOnClickOutside } from '../../../../hooks/useOnClickOutside';

interface Props {
  title: string;
  nameLabel: string;
  officerName: string;
  personnelCode: string;
  isSigned: boolean;
  isFa?: boolean;
  personnelList: ComplexPersonnel[];
  onNameChange: (name: string) => void;
  onPersonnelCodeChange: (code: string) => void;
  onSignedChange: (signed: boolean) => void;
}

export default function PersonnelShiftSelector({
  title,
  nameLabel,
  officerName,
  personnelCode,
  isSigned,
  isFa = true,
  personnelList,
  onNameChange,
  onPersonnelCodeChange,
  onSignedChange
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useOnClickOutside(wrapperRef, () => setIsOpen(false), isOpen);

  // Filter personnel list based on input or search query
  const filteredPersonnel = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      // Prioritize Fire / HSE personnel first, then all others
      return [...personnelList].sort((a, b) => {
        const aIsFire = (a.unit || '').includes('آتش') || (a.jobTitle || '').includes('آتش');
        const bIsFire = (b.unit || '').includes('آتش') || (b.jobTitle || '').includes('آتش');
        if (aIsFire && !bIsFire) return -1;
        if (!aIsFire && bIsFire) return 1;
        return 0;
      }).slice(0, 15);
    }

    return personnelList.filter(p => {
      const matchName = (p.fullName || '').toLowerCase().includes(query);
      const matchCode = (p.personnelCode || '').toLowerCase().includes(query) || (p.effectiveCode || '').toLowerCase().includes(query);
      const matchJob = (p.jobTitle || '').toLowerCase().includes(query);
      const matchUnit = (p.unit || '').toLowerCase().includes(query);
      return matchName || matchCode || matchJob || matchUnit;
    }).slice(0, 20);
  }, [personnelList, searchQuery]);

  // Find exact match if any
  const matchedPerson = useMemo(() => {
    if (!personnelCode && !officerName) return null;
    return personnelList.find(p => {
      const codeMatch = personnelCode && (p.personnelCode === personnelCode || p.effectiveCode === personnelCode);
      const nameMatch = officerName && (p.fullName === officerName || officerName.startsWith(p.fullName));
      return codeMatch || nameMatch;
    });
  }, [personnelList, personnelCode, officerName]);

  // Handle selecting a person
  const handleSelectPerson = (person: ComplexPersonnel) => {
    const job = person.jobTitle || person.position || 'پرسنل آتش‌نشانی';
    // Format strictly as "نام و نام خانوادگی - سمت شغلی"
    const formattedName = `${person.fullName} - ${job}`;
    onNameChange(formattedName);
    onPersonnelCodeChange(person.personnelCode || person.effectiveCode || '');
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle personnel code change and attempt smart match
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    onPersonnelCodeChange(code);

    if (code.trim().length >= 2) {
      const found = personnelList.find(p => 
        p.personnelCode === code.trim() || 
        p.effectiveCode === code.trim() ||
        p.employeeCode === code.trim()
      );
      if (found && !officerName) {
        const job = found.jobTitle || found.position || 'پرسنل آتش‌نشانی';
        onNameChange(`${found.fullName} - ${job}`);
      }
    }
  };

  return (
    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          <span>{title}</span>
        </h4>
        {matchedPerson && (
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>{isFa ? 'پرسنل ثبت‌شده مجتمع' : 'Registered'}</span>
          </span>
        )}
      </div>

      {/* Officer Name & Search Input */}
      <div className="relative" ref={wrapperRef}>
        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center justify-between">
          <span>{nameLabel}</span>
          <span className="text-[9.5px] font-normal text-slate-400">
            {isFa ? 'جستجو با نام یا کد پرسنلی' : 'Search by name/code'}
          </span>
        </label>

        <div className="relative">
          <input
            type="text"
            placeholder={isFa ? 'مثال: البرز اشرف پور - سرپرست آتش‌نشانی یا جستجوی کد پرسنلی...' : 'Officer name - Job position...'}
            value={officerName}
            onFocus={() => {
              setSearchQuery(officerName.split('-')[0].trim());
              setIsOpen(true);
            }}
            onChange={(e) => {
              const val = e.target.value;
              onNameChange(val);
              setSearchQuery(val);
              setIsOpen(true);
            }}
            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 focus:border-red-500 transition text-slate-900 dark:text-white"
          />

          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
            title={isFa ? 'نمایش لیست پرسنل مجتمع' : 'Show personnel list'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-red-600' : ''}`} />
          </button>
        </div>

        {/* Dropdown Results */}
        {isOpen && (
          <div className="absolute z-50 right-0 left-0 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto p-1.5 space-y-1 animate-fadeIn">
            <div className="px-2.5 py-1 text-[10.5px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-750 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Search className="w-3 h-3 text-slate-400" />
                {isFa ? 'انتخاب از پرسنل مجتمع (تنظیمات):' : 'Select from Complex Personnel:'}
              </span>
              <span className="text-[9px] font-normal text-slate-400">
                {filteredPersonnel.length} {isFa ? 'مورد' : 'items'}
              </span>
            </div>

            {filteredPersonnel.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {isFa ? 'پرسنلی با این مشخصات یافت نشد.' : 'No personnel found.'}
              </div>
            ) : (
              filteredPersonnel.map((person) => {
                const isSelected = matchedPerson?.id === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelectPerson(person)}
                    className={`w-full text-right p-2 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-900 dark:text-red-200'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate">{person.fullName}</span>
                        {person.personnelCode && (
                          <span className="font-mono text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded">
                            {person.personnelCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <Briefcase className="w-2.5 h-2.5 text-slate-400" />
                          {person.jobTitle || person.position || 'پرسنل'}
                        </span>
                        {person.unit && (
                          <span className="flex items-center gap-0.5 truncate max-w-[140px]">
                            <Building2 className="w-2.5 h-2.5 text-slate-400" />
                            {person.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-left">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg">
                        {isFa ? 'انتخاب و درج' : 'Select'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Personnel Code & Signature Checkbox */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <div>
          <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            {isFa ? 'کد پرسنلی' : 'Personnel Code'}
          </label>
          <input
            type="text"
            placeholder={isFa ? 'کد پرسنلی' : 'Emp Code'}
            value={personnelCode}
            onChange={handleCodeChange}
            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:border-red-400 transition select-none h-[35px]">
            <input
              type="checkbox"
              checked={isSigned}
              onChange={(e) => onSignedChange(e.target.checked)}
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <CheckCircle2 className={`w-3.5 h-3.5 ${isSigned ? 'text-emerald-600' : 'text-slate-400'}`} />
              {isFa ? 'تأیید امضا' : 'Confirm Signature'}
            </span>
          </label>
        </div>
      </div>

      {/* Matched Details Info Hint */}
      {matchedPerson && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
          <span className="truncate">
            {isFa ? 'سمت سازمانی:' : 'Position:'} <strong className="text-slate-700 dark:text-slate-200">{matchedPerson.jobTitle || matchedPerson.position || '-'}</strong>
          </span>
          <span className="font-mono text-[9px] text-slate-400">
            {matchedPerson.unit || 'پتروشیمی'}
          </span>
        </div>
      )}
    </div>
  );
}

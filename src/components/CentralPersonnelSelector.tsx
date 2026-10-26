import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  UserCheck, 
  Phone, 
  ShieldCheck, 
  X, 
  Building,
  Layers,
  AlertCircle
} from 'lucide-react';
import { 
  ComplexPersonnel, 
  PersonnelOrgDetails, 
  findPersonnelByCode, 
  getPersonnelOrgDetails, 
  searchMasterPersonnel,
  getComplexPersonnelList
} from '../utils/personnelHelper';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

export interface CentralPersonnelSelectorProps {
  language?: 'fa' | 'en';
  isFa?: boolean;
  label?: string;
  required?: boolean;
  selectedPersonnelCode?: string;
  value?: string;
  onSelectPersonnel?: (person: ComplexPersonnel | null, orgDetails: PersonnelOrgDetails) => void;
  onSelect?: (person: ComplexPersonnel | null, orgDetails: PersonnelOrgDetails) => void;
  placeholder?: string;
  helperText?: string;
  showOrgBadges?: boolean;
  compact?: boolean;
  disabled?: boolean;
  filterUnit?: string;
  className?: string;
  id?: string;
}

export default function CentralPersonnelSelector({
  language = 'fa',
  isFa: isFaProp,
  label,
  required = false,
  selectedPersonnelCode = '',
  value,
  onSelectPersonnel,
  onSelect,
  placeholder,
  helperText,
  showOrgBadges = true,
  compact = false,
  disabled = false,
  filterUnit,
  className = '',
  id
}: CentralPersonnelSelectorProps) {
  const isFa = isFaProp !== undefined ? isFaProp : language === 'fa';
  const lookupCode = React.useMemo(() => {
    if (selectedPersonnelCode && selectedPersonnelCode.trim()) {
      return selectedPersonnelCode.trim();
    }
    if (value && value.trim()) {
      const matchInParens = value.match(/\(([^)]+)\)/);
      if (matchInParens && matchInParens[1]?.trim()) {
        return matchInParens[1].trim();
      }
      return value.trim();
    }
    return '';
  }, [selectedPersonnelCode, value]);

  const handlePersonnelCallback = useCallback(
    (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
      onSelectPersonnel?.(person, org);
      onSelect?.(person, org);
    },
    [onSelectPersonnel, onSelect]
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ComplexPersonnel[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<ComplexPersonnel | null>(null);
  const [orgDetails, setOrgDetails] = useState<PersonnelOrgDetails>(() => getPersonnelOrgDetails(null));

  // Initialize from selectedPersonnelCode or value prop
  useEffect(() => {
    if (lookupCode) {
      const found = findPersonnelByCode(lookupCode);
      if (found) {
        setSelectedPerson(found);
        const org = getPersonnelOrgDetails(found);
        setOrgDetails(org);
        setQuery(found.fullName ? `${found.fullName} (${found.effectiveCode || found.personnelCode})` : (found.effectiveCode || found.personnelCode));
      } else {
        setQuery(value || lookupCode);
      }
    } else {
      setSelectedPerson(null);
      setOrgDetails(getPersonnelOrgDetails(null));
      setQuery('');
    }
  }, [lookupCode, value]);

  const [totalSystemPersonnelCount, setTotalSystemPersonnelCount] = useState<number>(() => {
    return getComplexPersonnelList().length;
  });

  // Load and refresh suggestions reactively from Central Personnel Master Data
  const refreshSuggestions = useCallback(() => {
    const all = getComplexPersonnelList();
    setTotalSystemPersonnelCount(all.length);

    if (!isOpen) return;

    if (query.trim().length >= 1) {
      const results = searchMasterPersonnel(query, {
        unit: filterUnit,
        status: 'active',
        limit: 12
      });
      setSuggestions(results);
    } else {
      // Show up to 10 active personnel when opened before typing
      const results = searchMasterPersonnel('', {
        unit: filterUnit,
        status: 'active',
        limit: 10
      });
      setSuggestions(results);
    }
  }, [query, isOpen, filterUnit]);

  useEffect(() => {
    refreshSuggestions();
  }, [refreshSuggestions]);

  // Global listeners for realtime Personnel updates
  useEffect(() => {
    const handlePersonnelUpdate = () => {
      refreshSuggestions();
      // Re-verify currently selected person if any
      if (lookupCode) {
        const found = findPersonnelByCode(lookupCode);
        if (found) {
          setSelectedPerson(found);
          const org = getPersonnelOrgDetails(found);
          setOrgDetails(org);
        } else if (selectedPerson !== null) {
          // If an actively selected person was revoked or removed, clear selection
          setSelectedPerson(null);
          setOrgDetails(getPersonnelOrgDetails(null));
          setQuery('');
          handlePersonnelCallback(null, getPersonnelOrgDetails(null));
        }
      }
    };

    window.addEventListener('hse_personnel_updated', handlePersonnelUpdate);
    window.addEventListener('hse_user_assignments_updated', handlePersonnelUpdate);
    window.addEventListener('app_data_mutated', handlePersonnelUpdate);
    window.addEventListener('storage', handlePersonnelUpdate);
    return () => {
      window.removeEventListener('hse_personnel_updated', handlePersonnelUpdate);
      window.removeEventListener('hse_user_assignments_updated', handlePersonnelUpdate);
      window.removeEventListener('app_data_mutated', handlePersonnelUpdate);
      window.removeEventListener('storage', handlePersonnelUpdate);
    };
  }, [refreshSuggestions, lookupCode, selectedPerson, handlePersonnelCallback]);

  // Close dropdown on click outside
  useOnClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const handleSelect = (person: ComplexPersonnel) => {
    setSelectedPerson(person);
    const org = getPersonnelOrgDetails(person);
    setOrgDetails(org);
    const code = person.effectiveCode || person.personnelCode || person.id;
    setQuery(person.fullName ? `${person.fullName} (${code})` : code);
    setIsOpen(false);
    handlePersonnelCallback(person, org);
  };

  const handleClear = () => {
    setSelectedPerson(null);
    setOrgDetails(getPersonnelOrgDetails(null));
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    handlePersonnelCallback(null, getPersonnelOrgDetails(null));
  };

  return (
    <div id={id} ref={containerRef} className={`relative space-y-1.5 ${className}`}>
      {/* Label */}
      {label && (
        <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>{label}</span>
            {required && <span className="text-rose-500 font-bold">*</span>}
          </span>
          <span className="text-[10px] text-slate-400 font-bold">
            {isFa ? 'Master Data پرسنل مجتمع' : 'Master Personnel Data'}
          </span>
        </label>
      )}

      {/* Input Search Container */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            type="text"
            disabled={disabled}
            value={query}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!isOpen) setIsOpen(true);
              if (!val.trim()) {
                handleClear();
              } else if (selectedPerson) {
                const expectedText = selectedPerson.fullName 
                  ? `${selectedPerson.fullName} (${selectedPerson.effectiveCode || selectedPerson.personnelCode})` 
                  : (selectedPerson.effectiveCode || selectedPerson.personnelCode);
                if (val !== expectedText) {
                  setSelectedPerson(null);
                  setOrgDetails(getPersonnelOrgDetails(null));
                  onSelectPersonnel(null, getPersonnelOrgDetails(null));
                }
              }
            }}
            placeholder={
              placeholder || 
              (isFa 
                ? 'جستجوی پرسنل با نام، کد پرسنلی، کد ملی، واحد یا سمت...' 
                : 'Search personnel by name, code, national ID, unit or job title...')
            }
            className={`w-full bg-white dark:bg-slate-900 border ${
              selectedPerson 
                ? 'border-emerald-500/60 dark:border-emerald-500/60 ring-1 ring-emerald-500/20' 
                : 'border-slate-200 dark:border-slate-800'
            } rounded-xl pr-9 rtl:pr-9 ltr:pl-9 ltr:pr-8 rtl:pl-8 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition shadow-xs disabled:opacity-50`}
          />

          <span className="absolute inset-y-0 right-0 pr-3 rtl:pr-3 ltr:left-0 ltr:right-auto ltr:pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>

          {query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 left-0 pl-2.5 rtl:left-0 rtl:pl-2.5 ltr:right-0 ltr:pr-2.5 flex items-center text-slate-400 hover:text-rose-500 cursor-pointer"
              title={isFa ? 'پاک کردن انتخاب' : 'Clear selection'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown List */}
        {isOpen && !disabled && (
          <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto animate-in fade-in-50 duration-150">
            <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building className="w-3 h-3 text-blue-500" />
                {isFa ? 'پایگاه مرکزی پرسنل مجتمع' : 'Master Personnel Records'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {totalSystemPersonnelCount > 0 ? `${suggestions.length} ${isFa ? 'مورد' : 'records'}` : (isFa ? 'خالی' : 'Empty')}
              </span>
            </div>

            <div className="p-1.5 space-y-1">
              {totalSystemPersonnelCount === 0 ? (
                <div className="p-4 text-center text-amber-600 dark:text-amber-400 text-xs font-bold space-y-1.5">
                  <div className="flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{isFa ? 'هنوز پرسنلی در ماژول تنظیمات سیستم (اطلاعات پرسنل مجتمع) تعریف نشده است.' : 'No personnel records defined in System Settings.'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {isFa ? 'لطفاً ابتدا پرسنل را از طریق اکسل یا فرم دستی در تنظیمات سیستم وارد نمایید.' : 'Please add personnel in System Settings > Personnel.'}
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((p, idx) => {
                  const pCode = p.effectiveCode || p.personnelCode || p.id;
                  const isCurSelected = selectedPerson?.id === p.id;
                  const pOrg = getPersonnelOrgDetails(p);

                  return (
                    <div
                      key={`${p.id || 'p'}-${idx}`}
                      onClick={() => handleSelect(p)}
                      className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                        isCurSelected 
                          ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0 border border-blue-500/20">
                          {p.firstName?.[0] || 'پ'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{p.fullName}</span>
                            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800/60">
                              #{pCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate mt-0.5">
                            <span>{pOrg.unit || (isFa ? 'بدون واحد' : 'No Unit')}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{p.jobTitle || (isFa ? 'پرسنل' : 'Staff')}</span>
                            {p.phone && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px]">{p.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {isFa ? 'شاغل' : 'Active'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs">
                  {query.trim().length === 0 
                    ? (isFa ? '🔍 جهت انتخاب، لطفاً نام یا کد پرسنلی را در کادر جستجو تایپ کنید.' : '🔍 Type a name or personnel ID to search.')
                    : (isFa ? 'هیچ پرسنلی با این مشخصات در پایگاه داده یافت نشد.' : 'No matching personnel found in Master Data.')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper text */}
      {helperText && !selectedPerson && (
        <p className="text-[10px] text-slate-400 font-medium">{helperText}</p>
      )}

      {/* Auto-Populated Organizational & Identity Card (Read-Only) */}
      {showOrgBadges && selectedPerson && !compact && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isFa ? 'اطلاعات سازمانی استخراج‌شده از Master Data (تکمیل خودکار):' : 'Auto-Populated Org Metadata from Master Data:'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border">
              ID: {selectedPerson.id}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {/* Unit / Plant */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'واحد / پلنت' : 'Unit / Plant'}</span>
              <strong className="text-slate-800 dark:text-slate-100 font-bold block truncate">{orgDetails.unit}</strong>
            </div>

            {/* Department */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'اداره / دپارتمان' : 'Department'}</span>
              <strong className="text-slate-800 dark:text-slate-100 font-bold block truncate">{orgDetails.department}</strong>
            </div>

            {/* Job Title / Position */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'سمت سازمانی' : 'Position'}</span>
              <strong className="text-slate-800 dark:text-slate-100 font-bold block truncate">{selectedPerson.jobTitle || 'پرسنل'}</strong>
            </div>

            {/* Supervisor */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'سرپرست مستقیم' : 'Supervisor'}</span>
              <strong className="text-blue-700 dark:text-blue-400 font-bold block truncate">{orgDetails.supervisor}</strong>
            </div>

            {/* Location */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'موقعیت فیزیکی' : 'Location'}</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium block truncate">{orgDetails.location}</span>
            </div>

            {/* Cost Center */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'مرکز هزینه' : 'Cost Center'}</span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-bold block">{orgDetails.costCenter}</span>
            </div>

            {/* National Code */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'کد ملی' : 'National Code'}</span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 block">{selectedPerson.nationalCode || '—'}</span>
            </div>

            {/* Phone */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">{isFa ? 'تلفن تماس' : 'Phone'}</span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 block">{selectedPerson.phone || '—'}</span>
            </div>
          </div>

          {/* Full Path Breadcrumb */}
          {orgDetails.fullOrgPath && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700/40 flex items-center gap-1 truncate">
              <Layers className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="font-bold">{isFa ? 'مسیر سازمانی:' : 'Path:'}</span>
              <span className="truncate">{orgDetails.fullOrgPath}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

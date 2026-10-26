import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, UserCheck, X, Check, Briefcase, Building, ChevronDown, User, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useMasterPersonnelList, ComplexPersonnel, isPersonnelPtwAuthorized, evaluatePtwQualificationStatus, PTW_UNAUTHORIZED_ERROR_MESSAGE } from '../../utils/personnelHelper';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

export interface PermitPersonnelAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelectPersonnel?: (person: ComplexPersonnel) => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'emerald' | 'blue' | 'amber';
  className?: string;
  inputClassName?: string;
  compact?: boolean;
  id?: string;
  // PTW qualification filtering and gating
  requiredPtwRole?: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit' | string;
  permitCategory?: string;
  filterPtwQualifiedOnly?: boolean;
  onUnauthorizedAttempt?: (person: ComplexPersonnel, reason: string) => void;
}

export const PermitPersonnelAutocomplete: React.FC<PermitPersonnelAutocompleteProps> = ({
  value,
  onChange,
  onSelectPersonnel,
  defaultValue = '',
  placeholder = 'جستجو در پرسنل یا تایپ دستی نام...',
  label,
  helperText,
  disabled = false,
  variant = 'default',
  className = '',
  inputClassName = '',
  compact = false,
  id,
  requiredPtwRole,
  permitCategory,
  filterPtwQualifiedOnly,
  onUnauthorizedAttempt,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalVal, setInternalVal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const currentVal = isControlled ? value : internalVal;
  const [searchTerm, setSearchTerm] = useState(currentVal || '');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal search input with incoming value prop
  useEffect(() => {
    if (isControlled) {
      setSearchTerm(value || '');
    }
  }, [value, isControlled]);

  // Reactive master personnel list & search
  const { personnelList, filteredPersonnel } = useMasterPersonnelList(searchTerm, {
    limit: 18,
    defaultLimit: 12
  });

  // PTW authorization options
  const ptwCheckOptions = useMemo(() => {
    if (!requiredPtwRole && !permitCategory) return null;
    return {
      roleKey: requiredPtwRole,
      permitCategory
    };
  }, [requiredPtwRole, permitCategory]);

  const [ptwErrorToast, setPtwErrorToast] = useState<string | null>(null);

  // Compute displayed personnel with PTW qualification awareness
  const displayPersonnel = useMemo(() => {
    if (!ptwCheckOptions && !filterPtwQualifiedOnly) {
      return filteredPersonnel.map(p => ({
        person: p,
        auth: { isAuthorized: true },
        status: evaluatePtwQualificationStatus(p.ptwQualification)
      }));
    }

    const annotated = filteredPersonnel.map(p => {
      const auth = isPersonnelPtwAuthorized(p, ptwCheckOptions || undefined);
      const status = evaluatePtwQualificationStatus(p.ptwQualification);
      return { person: p, auth, status };
    });

    if (filterPtwQualifiedOnly || (requiredPtwRole && filterPtwQualifiedOnly !== false)) {
      return annotated.filter(item => item.auth.isAuthorized);
    }

    return annotated;
  }, [filteredPersonnel, ptwCheckOptions, filterPtwQualifiedOnly, requiredPtwRole]);

  // Handle click outside to close dropdown
  useOnClickOutside(containerRef, () => {
    setIsOpen(false);
    setPtwErrorToast(null);
  }, isOpen);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchTerm(text);
    if (!isControlled) {
      setInternalVal(text);
    }
    setPtwErrorToast(null);
    onChange?.(text);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelectPerson = (person: ComplexPersonnel) => {
    // If PTW check applies, verify authorization
    if (ptwCheckOptions) {
      const check = isPersonnelPtwAuthorized(person, ptwCheckOptions);
      if (!check.isAuthorized) {
        const errorMsg = check.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE;
        setPtwErrorToast(errorMsg);
        onUnauthorizedAttempt?.(person, errorMsg);
        return;
      }
    }

    setPtwErrorToast(null);
    const name = person.fullName || `${person.firstName} ${person.lastName}`.trim();
    setSearchTerm(name);
    if (!isControlled) {
      setInternalVal(name);
    }
    onChange?.(name);
    if (onSelectPersonnel) {
      onSelectPersonnel(person);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    setPtwErrorToast(null);
    if (!isControlled) {
      setInternalVal('');
    }
    onChange?.('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < displayPersonnel.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : displayPersonnel.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < displayPersonnel.length) {
        handleSelectPerson(displayPersonnel[selectedIndex].person);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setPtwErrorToast(null);
    }
  };

  const variantBorderMap = {
    default: 'border-slate-300 dark:border-slate-700 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500',
    emerald: 'border-emerald-300 dark:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500',
    blue: 'border-blue-300 dark:border-blue-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
    amber: 'border-amber-300 dark:border-amber-700 focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500',
  }[variant];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={id} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {helperText && (
            <span className="text-[10px] text-slate-400 font-normal">{helperText}</span>
          )}
        </div>
      )}
      <div 
        className={`flex items-center relative ${label ? 'rounded-xl py-1.5 px-2' : 'rounded-md'} border ${variantBorderMap} bg-white dark:bg-slate-900 transition-all shadow-xs ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-800' : ''
        } ${!label ? (compact ? 'py-0 px-1' : 'px-1.5 py-0.5') : ''}`}
      >
        <div className="text-slate-400 shrink-0 pointer-events-none pr-1">
          {compact ? (
            <User className="w-2.5 h-2.5 text-slate-400" />
          ) : (
            <Search className="w-3 h-3 text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full text-xs bg-transparent px-1 py-0.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none ${
            compact ? 'text-[11px] leading-tight py-0' : ''
          } ${label ? 'font-bold' : ''} ${inputClassName}`}
          autoComplete="off"
        />

        {searchTerm && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="پاک کردن"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {!disabled && (
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer shrink-0"
            title="نمایش فهرست پرسنل مجتمع"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && !disabled && (
        <div 
          className="absolute z-50 right-0 left-0 mt-1 max-h-60 min-w-[260px] overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 py-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs animate-in fade-in slide-in-from-top-1 duration-100"
        >
          {/* PTW Unauthorized Error Banner if user attempted an invalid selection */}
          {ptwErrorToast && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-bold">
                {ptwErrorToast}
              </div>
              <button
                type="button"
                onClick={() => setPtwErrorToast(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
            <span className="flex items-center gap-1">
              {ptwCheckOptions ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-800 dark:text-emerald-300 font-extrabold">
                    پرسنل واجد صلاحیت PTW ({displayPersonnel.length} نفر)
                  </span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3 h-3 text-blue-500" />
                  <span>پرسنل مجتمع ({displayPersonnel.length} مورد)</span>
                </>
              )}
            </span>
            <span className="text-[9px] text-slate-400 font-normal">کلیک جهت انتخاب</span>
          </div>

          {displayPersonnel.length > 0 ? (
            displayPersonnel.map((item, idx) => {
              const person = item.person;
              const name = person.fullName || `${person.firstName} ${person.lastName}`.trim();
              const isSelected = searchTerm.trim() === name;
              const isHighlighted = idx === selectedIndex;
              const isAuth = item.auth.isAuthorized;

              return (
                <div
                  key={person.id || `p-${idx}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectPerson(person);
                  }}
                  className={`px-2.5 py-1.5 cursor-pointer transition flex items-center justify-between gap-2 text-right ${
                    isHighlighted 
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200' 
                      : isSelected 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold' 
                      : !isAuth
                      ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                      item.status === 'valid'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : item.status === 'expired' || item.status === 'unqualified'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      <User className="w-3 h-3" />
                    </div>
                    
                    <div className="truncate flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                        <span>{name}</span>
                        {(person.personnelCode || person.effectiveCode) && (
                          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                            {person.personnelCode || person.effectiveCode}
                          </span>
                        )}
                        {/* Status tag */}
                        {item.status === 'valid' && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            صلاحیت معتبر
                          </span>
                        )}
                        {item.status === 'expired' && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            منقضی
                          </span>
                        )}
                        {item.status === 'unqualified' && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            فاقد صلاحیت
                          </span>
                        )}
                        {item.status === 'incomplete' && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            نیازمند تکمیل
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                        {person.jobTitle && (
                          <span className="flex items-center gap-0.5 truncate">
                            <Briefcase className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate">{person.jobTitle}</span>
                          </span>
                        )}
                        {person.unit && (
                          <span className="flex items-center gap-0.5 truncate text-slate-400">
                            <Building className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{person.unit}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] shrink-0 font-bold">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-3 text-center text-slate-400 text-[11px] space-y-1">
              <div className="font-bold text-slate-600 dark:text-slate-300">
                {ptwCheckOptions
                  ? 'پرسنل واجد شرایط و دارای گواهینامه معتبر برای این جایگاه یافت نشد.'
                  : 'موردی با این نام در پرسنل یافت نشد.'}
              </div>
              <div className="text-[10px] text-slate-500">
                جهت صلاحیت امضا، پرسنل باید دوره آموزشی صدور پروانه کار را با موفقیت گذرانده و گواهینامه معتبر داشته باشند.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PermitPersonnelAutocomplete;

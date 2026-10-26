import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Users,
  UserCheck,
  X,
  Check,
  Briefcase,
  Building,
  Plus,
  User,
  CheckSquare,
  Square
} from 'lucide-react';
import { useMasterPersonnelList, ComplexPersonnel } from '../../utils/personnelHelper';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

export interface PermitQualifiedPersonnelFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isReadOnly?: boolean;
  className?: string;
}

export const PermitQualifiedPersonnelField: React.FC<PermitQualifiedPersonnelFieldProps> = ({
  value,
  onChange,
  disabled = false,
  isReadOnly = false,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<ComplexPersonnel[]>([]);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchFilterUnit, setBatchFilterUnit] = useState<string>('all');
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reactive master personnel list & inline suggestions
  const { personnelList, filteredPersonnel: suggestions } = useMasterPersonnelList(searchTerm, {
    limit: 15,
    defaultLimit: 10
  });

  // Extract units for batch filter
  const allUnits = useMemo(() => {
    const set = new Set<string>();
    personnelList.forEach(p => {
      if (p.unit) set.add(p.unit);
      if (p.department) set.add(p.department);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [personnelList]);

  // Batch modal filtered list
  const batchFilteredList = useMemo(() => {
    return personnelList.filter(p => {
      if (batchFilterUnit !== 'all') {
        const u = p.unit || p.department || '';
        if (u !== batchFilterUnit) return false;
      }
      if (batchSearchTerm.trim()) {
        const q = batchSearchTerm.trim().toLowerCase();
        const name = (p.fullName || `${p.firstName} ${p.lastName}`).toLowerCase();
        const code = (p.personnelCode || p.effectiveCode || p.nationalCode || '').toLowerCase();
        const job = (p.jobTitle || '').toLowerCase();
        return name.includes(q) || code.includes(q) || job.includes(q);
      }
      return true;
    });
  }, [personnelList, batchFilterUnit, batchSearchTerm]);

  // Close search dropdown on click outside
  useOnClickOutside(containerRef, () => setIsOpen(false), isOpen);

  // Format a person's display name string
  const formatPersonText = (p: ComplexPersonnel): string => {
    const name = p.fullName || `${p.firstName} ${p.lastName}`.trim();
    const job = p.jobTitle ? ` (${p.jobTitle})` : '';
    const code = p.personnelCode ? ` [کد: ${p.personnelCode}]` : '';
    return `${name}${job}${code}`;
  };

  // Add a single person to the list/textarea
  const handleAddPerson = (person: ComplexPersonnel) => {
    const personFormatted = formatPersonText(person);

    // Add to tags if not already present
    if (!selectedPersonnel.some(p => p.id === person.id || p.fullName === person.fullName)) {
      setSelectedPersonnel(prev => [...prev, person]);
    }

    // Append to textarea if not already included in the text
    const currentVal = value.trim();
    if (!currentVal) {
      onChange(personFormatted);
    } else if (!currentVal.includes(person.fullName) && !currentVal.includes(personFormatted)) {
      onChange(`${currentVal}، ${personFormatted}`);
    }

    setSearchTerm('');
    setIsOpen(false);
    searchInputRef.current?.focus();
  };

  // Remove a person from tags
  const handleRemovePerson = (person: ComplexPersonnel) => {
    setSelectedPersonnel(prev => prev.filter(p => p.id !== person.id && p.fullName !== person.fullName));
    
    // Also remove from textarea if desired
    const formatted = formatPersonText(person);
    const plainName = person.fullName || `${person.firstName} ${person.lastName}`.trim();
    
    let updated = value;
    if (updated.includes(formatted)) {
      updated = updated.replace(new RegExp(`,?\\s*${escapeRegExp(formatted)},?\\s*`, 'g'), ' ');
    } else if (updated.includes(plainName)) {
      updated = updated.replace(new RegExp(`,?\\s*${escapeRegExp(plainName)}[^،,\n]*,?\\s*`, 'g'), ' ');
    }
    updated = updated.trim().replace(/^،\s*|،\s*$/g, '');
    onChange(updated);
  };

  // Helper for regex escaping
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Toggle selection in batch modal
  const toggleBatchSelect = (id: string) => {
    setBatchSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Confirm batch addition
  const handleConfirmBatch = () => {
    const addedPersons = personnelList.filter(p => batchSelectedIds.has(p.id));
    if (addedPersons.length === 0) {
      setIsBatchModalOpen(false);
      return;
    }

    // Update tags
    const newTags = [...selectedPersonnel];
    addedPersons.forEach(p => {
      if (!newTags.some(existing => existing.id === p.id || existing.fullName === p.fullName)) {
        newTags.push(p);
      }
    });
    setSelectedPersonnel(newTags);

    // Update textarea
    let currentVal = value.trim();
    const formattedItems = addedPersons
      .map(p => formatPersonText(p))
      .filter(str => !currentVal.includes(str));

    if (formattedItems.length > 0) {
      if (currentVal) {
        currentVal += `، ${formattedItems.join('، ')}`;
      } else {
        currentVal = formattedItems.join('، ');
      }
      onChange(currentVal);
    }

    setBatchSelectedIds(new Set());
    setIsBatchModalOpen(false);
  };

  const isInteractive = !disabled && !isReadOnly;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Field Label and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>نام افراد دارای صلاحیت مهارت فنی و سلامت فردی جهت انجام فعالیت های برعهده:</span>
        </div>

        {isInteractive && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="انتخاب چند نفر از پرسنل مجتمع به طور همزمان"
            >
              <UserPlus className="w-3 h-3 text-blue-600" />
              <span>انتخاب چندگانه از پرسنل مجتمع</span>
            </button>
          </div>
        )}
      </div>

      {/* Personnel Quick Search & Dropdown Bar */}
      {isInteractive && (
        <div ref={containerRef} className="relative">
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 shadow-2xs focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="جستجوی پرسنل بر اساس نام، کد پرسنلی، شغل (جوشکار، برقکار، مکانیک و...) جهت افزودن..."
              className="w-full text-xs bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {isOpen && (
            <div className="absolute z-50 right-0 left-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 py-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>انتخاب افراد دارای صلاحیت از لیست پرسنل مجتمع ({suggestions.length} مورد)</span>
                <span className="text-blue-600 dark:text-blue-400">کلیک روی هر شخص برای افزودن به لیست</span>
              </div>

              {suggestions.length > 0 ? (
                suggestions.map((person, idx) => {
                  const name = person.fullName || `${person.firstName} ${person.lastName}`.trim();
                  const isAlreadySelected = selectedPersonnel.some(p => p.id === person.id) || value.includes(name);

                  return (
                    <div
                      key={person.id || `p-${idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddPerson(person);
                      }}
                      className={`px-3 py-2 cursor-pointer transition flex items-center justify-between gap-2 text-right ${
                        isAlreadySelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 text-xs font-bold">
                          <User className="w-3 h-3" />
                        </div>

                        <div className="truncate flex-1">
                          <div className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
                            <span>{name}</span>
                            {(person.personnelCode || person.effectiveCode) && (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                کد: {person.personnelCode || person.effectiveCode}
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                            {person.jobTitle && (
                              <span className="flex items-center gap-1 truncate font-medium text-slate-700 dark:text-slate-300">
                                <Briefcase className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                <span className="truncate">{person.jobTitle}</span>
                              </span>
                            )}
                            {person.unit && (
                              <span className="flex items-center gap-1 truncate text-slate-400">
                                <Building className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{person.unit}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isAlreadySelected ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>افزوده شده</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 text-[10px] font-bold flex items-center gap-0.5">
                            <Plus className="w-3 h-3" />
                            <span>افزودن</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs">
                  پرسنلی با عبارت «{searchTerm}» یافت نشد. می‌توانید نام را مستقیماً در کادر زیر به صورت دستی تایپ نمایید.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Personnel Chips (Badges) */}
      {selectedPersonnel.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-1 flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            <span>افراد منتخب ({selectedPersonnel.length} نفر):</span>
          </span>
          {selectedPersonnel.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] shadow-2xs"
            >
              <span className="font-bold">{p.fullName}</span>
              {p.jobTitle && <span className="text-[9px] text-slate-500 dark:text-slate-400">({p.jobTitle})</span>}
              {isInteractive && (
                <button
                  type="button"
                  onClick={() => handleRemovePerson(p)}
                  className="p-0.5 hover:bg-red-50 hover:text-red-600 rounded cursor-pointer transition text-slate-400"
                  title="حذف از لیست"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {isInteractive && (
            <button
              type="button"
              onClick={() => setSelectedPersonnel([])}
              className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer mr-auto transition"
            >
              پاکسازی تگ‌ها
            </button>
          )}
        </div>
      )}

      {/* Main Textarea for Free Manual Typing & Editing */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isReadOnly}
          placeholder="نام افراد دارای صلاحیت را تایپ کنید یا از جستجوی پرسنل بالا انتخاب نمایید..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg text-xs shadow-sm leading-relaxed"
        />
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-0.5">
          <span>* امکان تایپ دستی مستقیم و افزودن اسامی دلخواه، پیمانکاران یا ویرایش متن فراهم است.</span>
          {value && <span>{value.length} کاراکتر</span>}
        </div>
      </div>

      {/* Modal: Batch Personnel Selector */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    انتخاب دسته‌جمعی پرسنل مجتمع
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    پرسنل و افراد دارای صلاحیت مهارت فنی را انتخاب و همزمان به پروانه کار بیفزایید.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filters */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  value={batchSearchTerm}
                  onChange={e => setBatchSearchTerm(e.target.value)}
                  placeholder="جستجوی نام، کد پرسنلی یا شغل..."
                  className="w-full pl-2 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <select
                  value={batchFilterUnit}
                  onChange={e => setBatchFilterUnit(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">همه واحدها و دپارتمان‌ها ({personnelList.length} نفر)</option>
                  {allUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Body: Personnel Checklist */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800 max-h-[50vh]">
              {batchFilteredList.length > 0 ? (
                batchFilteredList.map((person) => {
                  const isChecked = batchSelectedIds.has(person.id);
                  const isAlreadyAdded = selectedPersonnel.some(p => p.id === person.id) || value.includes(person.fullName);

                  return (
                    <div
                      key={person.id}
                      onClick={() => toggleBatchSelect(person.id)}
                      className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-3 ${
                        isChecked 
                          ? 'bg-blue-50 dark:bg-blue-950/40' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate flex-1">
                        <div className="text-blue-600 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>

                        <div className="truncate flex-1">
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{person.fullName}</span>
                            {person.personnelCode && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                کد: {person.personnelCode}
                              </span>
                            )}
                            {isAlreadyAdded && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                                قبلاً ثبت شده
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            {person.jobTitle && (
                              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                <Briefcase className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                <span>{person.jobTitle}</span>
                              </span>
                            )}
                            {person.unit && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Building className="w-2.5 h-2.5 shrink-0" />
                                <span>{person.unit}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  پرسنلی با معیارهای جستجو یافت نشد.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {batchSelectedIds.size > 0 ? (
                  <span className="text-blue-600 dark:text-blue-400">
                    {batchSelectedIds.size} نفر انتخاب شده است.
                  </span>
                ) : (
                  <span>هیچ پرسنلی انتخاب نشده است.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatch}
                  disabled={batchSelectedIds.size === 0}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن گزینه‌های انتخاب‌شده</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermitQualifiedPersonnelField;

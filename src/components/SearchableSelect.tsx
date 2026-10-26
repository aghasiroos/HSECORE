import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Plus, Check } from 'lucide-react';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

export default function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder,
  isFa,
  allowCustom = true
}: { 
  options: string[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder: string,
  isFa: boolean,
  allowCustom?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useOnClickOutside(wrapperRef, () => setIsOpen(false), isOpen);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const isExactMatch = options.some(opt => opt.trim().toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div 
        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs cursor-pointer min-h-[38px] flex items-center justify-between transition-colors hover:border-blue-400 dark:hover:border-blue-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? "text-slate-800 dark:text-slate-100 font-bold truncate" : "text-slate-400 font-medium"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          <div className="sticky top-0 bg-white dark:bg-slate-900 p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <input 
                ref={inputRef}
                type="text" 
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 pr-7"
                placeholder={isFa ? "جستجو یا نوشتن عنوان جدید..." : "Search or enter new..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (search.trim()) {
                      onChange(search.trim());
                      setIsOpen(false);
                      setSearch('');
                    }
                  }
                }}
                onClick={e => e.stopPropagation()}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 right-2" />
            </div>
          </div>
          
          <div className="py-1">
            {allowCustom && search.trim() && !isExactMatch && (
              <div 
                className="px-3 py-2 text-xs bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer font-bold flex items-center gap-1.5 border-b border-blue-100 dark:border-blue-900/50"
                onClick={() => {
                  onChange(search.trim());
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>{isFa ? `ثبت و استفاده از «${search.trim()}»` : `Use custom "${search.trim()}"`}</span>
              </div>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt === value;
                return (
                  <div 
                    key={idx}
                    className={`px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-blue-50/60 dark:bg-slate-800/80 text-blue-700 dark:text-blue-400 font-black' : 'text-slate-700 dark:text-slate-200 font-medium'
                    }`}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                );
              })
            ) : (
              !allowCustom || !search.trim() ? (
                <div className="px-3 py-4 text-xs text-center text-slate-400 font-medium">
                  {isFa ? "موردی در چارت سازمانی یافت نشد" : "No matching items"}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}

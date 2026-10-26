import React, { useMemo } from 'react';
import { useUnifiedOrgUnits, UnifiedOrgUnit, resolveOrgUnit } from '../../utils/orgUnitsHelper';
import { Building2, AlertCircle } from 'lucide-react';

export interface UniversalOrgUnitSelectProps {
  /** Selected unit ID or unit Name */
  value?: string;
  /** Unit ID specifically (if separating ID and Name) */
  unitId?: string;
  /** Callback returning (selectedId, selectedName, fullUnitObject) */
  onChange: (unitId: string, unitName: string, unit?: UnifiedOrgUnit) => void;
  /** HTML name attribute */
  name?: string;
  /** Placeholder when nothing is selected */
  placeholder?: string;
  /** Whether the field is mandatory */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Whether this is a filter with an "All Units" option */
  allowAll?: boolean;
  /** Label for the "All Units" option */
  allLabel?: string;
  /** Value for the "All Units" option (default: 'ALL') */
  allValue?: string;
  /** Show hierarchical path (e.g. "مجتمع > پلنت ۱ > واحد تعمیرات") in options */
  showPath?: boolean;
  /** Optional CSS classes */
  className?: string;
  /** Language */
  isFa?: boolean;
  /** Optional filter to restrict by node type */
  filterTypes?: string[];
  /** Optional ID attribute */
  id?: string;
}

export default function UniversalOrgUnitSelect({
  value = '',
  unitId,
  onChange,
  name,
  placeholder,
  required = false,
  disabled = false,
  allowAll = false,
  allLabel,
  allValue = 'ALL',
  showPath = true,
  className = '',
  isFa = true,
  filterTypes,
  id
}: UniversalOrgUnitSelectProps) {
  const { units, isLoading } = useUnifiedOrgUnits();

  // Filter units if filterTypes is specified
  const filteredUnits = useMemo(() => {
    if (!filterTypes || filterTypes.length === 0) return units;
    return units.filter(u => filterTypes.includes(u.type));
  }, [units, filterTypes]);

  // Determine currently selected value (match by ID or Name)
  const currentSelectedValue = useMemo(() => {
    if (allowAll && (value === allValue || value === 'all' || value === '')) {
      return allValue;
    }
    if (unitId) {
      const match = units.find(u => u.id === unitId);
      if (match) return match.id;
    }
    if (value) {
      const match = resolveOrgUnit(value);
      if (match) return match.id;
    }
    return '';
  }, [value, unitId, units, allowAll, allValue]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    if (allowAll && selectedVal === allValue) {
      onChange(allValue, allLabel || (isFa ? 'همه واحدها' : 'All Units'), undefined);
      return;
    }

    const matchedUnit = units.find(u => u.id === selectedVal);
    if (matchedUnit) {
      onChange(matchedUnit.id, matchedUnit.name, matchedUnit);
    } else {
      onChange('', '', undefined);
    }
  };

  const defaultPlaceholder = isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Organizational Unit --';
  const defaultAllLabel = isFa ? 'همه واحدهای سازمانی' : 'All Organizational Units';

  return (
    <div className="relative w-full">
      <select
        id={id}
        name={name}
        value={currentSelectedValue}
        onChange={handleChange}
        required={required}
        disabled={disabled || isLoading}
        className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer ${className}`}
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* All Units option for filters */}
        {allowAll && (
          <option value={allValue}>
            {allLabel || defaultAllLabel}
          </option>
        )}

        {/* Placeholder / Empty option */}
        {!allowAll && (
          <option value="" disabled={required}>
            {placeholder || defaultPlaceholder}
          </option>
        )}

        {/* If no units exist in Org Structure */}
        {filteredUnits.length === 0 && !allowAll && (
          <option value="" disabled>
            {isFa 
              ? '⚠️ هنوز واحدی در ساختار سازمانی (تنظیمات سیستم) تعریف نشده است' 
              : '⚠️ No organizational units defined in System Settings > Org Structure'}
          </option>
        )}

        {/* Real units list */}
        {filteredUnits.map(unit => (
          <option key={unit.id} value={unit.id}>
            {showPath && unit.fullPath && unit.fullPath !== unit.name
              ? `${unit.name} (${unit.fullPath})`
              : unit.name}
          </option>
        ))}
      </select>
    </div>
  );
}

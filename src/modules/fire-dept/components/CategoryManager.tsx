import React, { useState, useMemo, useEffect } from 'react';
import { FireEquipment } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Eye,
  Filter,
  FileSpreadsheet,
  MapPin,
  Activity,
  RotateCcw,
} from 'lucide-react';
import {
  CATEGORY_COLUMNS,
  GEOGRAPHICAL_DIRECTIONS,
  FLOOR_OPTIONS,
  OPERATIONAL_STATUS_OPTIONS,
  extractEquipmentUniqueCode,
} from '../config/columns';
import { CategoryIcon } from '../config/categoryIcons';
import EquipmentModal from './EquipmentModal';
import EquipmentDetailsView from './EquipmentDetailsView';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';
import { downloadCsvFile } from '../../../utils/fileHelpers';
import { VirtualizedDataTable, VirtualizedColumn } from '../../../components/common/virtualized/VirtualizedDataTable';

interface Props {
  language: 'fa' | 'en';
  category: string;
  data: FireEquipment[];
  allEquipment?: FireEquipment[];
  onAdd: (item: any) => Promise<any> | void;
  onUpdate: (id: string, item: any) => Promise<any> | void;
  onDelete: (id: string) => Promise<any> | void;
  onNavigateCategory?: (targetCategory: string) => void;
}

export default function CategoryManager({
  language,
  category,
  data,
  allEquipment = [],
  onAdd,
  onUpdate,
  onDelete,
  onNavigateCategory,
}: Props) {
  const isFa = language === 'fa';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_defects' | 'healthy'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [complexFilter, setComplexFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [opStatusFilter, setOpStatusFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FireEquipment | null>(null);
  const [viewingItem, setViewingItem] = useState<FireEquipment | null>(null);
  const [deletingItem, setDeletingItem] = useState<FireEquipment | null>(null);

  const columns = CATEGORY_COLUMNS[category] || [];
  const typeColumn = columns.find(
    (c) => (c.key === 'detectorType' || c.key === 'type') && c.options && c.options.length > 0
  );

  useEffect(() => {
    setSelectedType('all');
    setSearchTerm('');
    setStatusFilter('all');
    setComplexFilter('all');
    setUnitFilter('all');
    setDirectionFilter('all');
    setFloorFilter('all');
    setOpStatusFilter('all');
    setViewingItem(null);
  }, [category]);

  // Distinct Complexes and Units present in current category data for fast filtering
  const complexOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => {
      const c = item.locationDetails?.complex || item.complex;
      if (c && c.trim()) set.add(c.trim());
    });
    return Array.from(set);
  }, [data]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => {
      const u = item.locationDetails?.unit || item.unit;
      if (u && u.trim()) set.add(u.trim());
    });
    return Array.from(set);
  }, [data]);

  const handleAddClick = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (item: FireEquipment) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (item: any) => {
    if (editingItem) {
      await onUpdate(editingItem.id, item);
    } else {
      const uniqueCode = extractEquipmentUniqueCode(item);
      const generatedId =
        uniqueCode || `${category.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      await onAdd({
        ...item,
        id: item.id || generatedId,
        code: uniqueCode || generatedId,
        category,
        inspections: Array.isArray(item.inspections) ? item.inspections : [],
        defects: Array.isArray(item.defects) ? item.defects : [],
      });
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSelectExistingFromModal = (existing: FireEquipment) => {
    setIsModalOpen(false);
    setEditingItem(null);
    if (existing.category && existing.category !== category && onNavigateCategory) {
      onNavigateCategory(existing.category);
    } else {
      setViewingItem(existing);
    }
  };

  // Filter items across all structured location & operational status dimensions
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const term = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      if (term) {
        const itemStr = JSON.stringify(item).toLowerCase();
        matchesSearch = itemStr.includes(term);
      }

      let matchesType = true;
      if (selectedType !== 'all' && typeColumn) {
        matchesType = (item as any)[typeColumn.key] === selectedType;
      }

      let matchesComplex = true;
      if (complexFilter !== 'all') {
        const c = (item.locationDetails?.complex || item.complex || '').trim();
        matchesComplex = c === complexFilter;
      }

      let matchesUnit = true;
      if (unitFilter !== 'all') {
        const u = (item.locationDetails?.unit || item.unit || '').trim();
        matchesUnit = u === unitFilter;
      }

      let matchesDirection = true;
      if (directionFilter !== 'all') {
        const d = (item.locationDetails?.direction || item.direction || '').trim();
        matchesDirection = d === directionFilter;
      }

      let matchesFloor = true;
      if (floorFilter !== 'all') {
        const f = (item.locationDetails?.floor || item.floor || '').trim();
        matchesFloor = f === floorFilter;
      }

      let matchesOpStatus = true;
      if (opStatusFilter !== 'all') {
        const op = (item.operationalStatus || 'فعال').trim();
        matchesOpStatus = op === opStatusFilter;
      }

      let matchesStatus = true;
      if (statusFilter === 'has_defects') {
        matchesStatus = item.defects.length > 0 || item.inspections.some((i) => i.status === 'نامطلوب');
      } else if (statusFilter === 'healthy') {
        matchesStatus = item.defects.length === 0 && !item.inspections.some((i) => i.status === 'نامطلوب');
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesComplex &&
        matchesUnit &&
        matchesDirection &&
        matchesFloor &&
        matchesOpStatus &&
        matchesStatus
      );
    });
  }, [
    data,
    searchTerm,
    selectedType,
    complexFilter,
    unitFilter,
    directionFilter,
    floorFilter,
    opStatusFilter,
    statusFilter,
    typeColumn,
  ]);

  const hasActiveAdvancedFilters =
    complexFilter !== 'all' ||
    unitFilter !== 'all' ||
    directionFilter !== 'all' ||
    floorFilter !== 'all' ||
    opStatusFilter !== 'all' ||
    selectedType !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(searchTerm.trim());

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setComplexFilter('all');
    setUnitFilter('all');
    setDirectionFilter('all');
    setFloorFilter('all');
    setOpStatusFilter('all');
    setStatusFilter('all');
  };

  // Export to CSV with UTF-8 BOM including structured location & operational status
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = [
      'ID / Code',
      isFa ? 'مجتمع / شرکت' : 'Complex',
      isFa ? 'واحد' : 'Unit',
      isFa ? 'جهت جغرافیایی' : 'Direction',
      isFa ? 'طبقه' : 'Floor',
      isFa ? 'موقعیت دقیق' : 'Exact Location',
      isFa ? 'وضعیت عملیاتی' : 'Operational Status',
      ...columns.map((c) => (isFa ? c.labelFa : c.labelEn)),
      isFa ? 'تعداد بازرسی' : 'Inspections',
      isFa ? 'تعداد نقص' : 'Defects',
    ];
    const rows = filteredData.map((item) => {
      const colValues = columns.map((c) => {
        const val = (item as any)[c.key];
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        return `"${val ?? ''}"`;
      });
      const loc = item.locationDetails || ({} as any);
      return [
        `"${extractEquipmentUniqueCode(item) || item.id}"`,
        `"${loc.complex || item.complex || ''}"`,
        `"${loc.unit || item.unit || ''}"`,
        `"${loc.direction || item.direction || ''}"`,
        `"${loc.floor || item.floor || ''}"`,
        `"${loc.exactLocation || item.exactLocation || ''}"`,
        `"${item.operationalStatus || 'فعال'}"`,
        ...colValues,
        item.inspections.length,
        item.defects.length,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCsvFile(`${category.replace(/\s+/g, '_')}_Inspections.csv`, csvContent);
  };

  // Dynamic virtualized columns definition
  const gridColumns = useMemo<VirtualizedColumn<FireEquipment>[]>(() => {
    const cols: VirtualizedColumn<FireEquipment>[] = [
      {
        key: 'id',
        header: isFa ? 'کد / شناسه یکتا' : 'Unique Code',
        width: 110,
        className: 'font-mono font-bold text-red-600 dark:text-red-400',
        render: (item) => extractEquipmentUniqueCode(item) || item.id,
      },
      {
        key: 'operationalStatus',
        header: isFa ? 'وضعیت عملیاتی' : 'Operational Status',
        width: 155,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => {
          const op = item.operationalStatus || 'فعال';
          const isTempOut = op === 'انتقال جهت شارژ' || op === 'انتقال جهت تست';
          const styleClass =
            op === 'فعال'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : op === 'غیرفعال'
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
              : op === 'انتقال جهت شارژ'
              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';

          return (
            <div className="flex flex-col items-center gap-0.5">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-black ${styleClass}`}>
                <Activity className="w-3 h-3 shrink-0" />
                <span>{op}</span>
              </span>
              {isTempOut && (
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                  {isFa ? 'خارج از سرویس موقت در محل اصلی' : 'Temp Out of Service'}
                </span>
              )}
            </div>
          );
        },
      },
    ];

    columns.forEach((col) => {
      if (col.key === 'location') {
        cols.push({
          key: 'location',
          header: isFa ? 'موقعیت استقرار (مجتمع / واحد / جهت / طبقه / محل دقیق)' : 'Structured Location',
          width: 260,
          render: (item) => {
            const loc = item.locationDetails || ({} as any);
            const hasStructured = Boolean(loc.complex || loc.unit || loc.direction || loc.floor || loc.exactLocation);
            if (!hasStructured) {
              return <span className="text-xs text-slate-700 dark:text-slate-200">{item.location || '-'}</span>;
            }
            return (
              <div className="flex flex-col gap-0.5 py-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(loc.complex || item.complex) && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold">
                      {loc.complex || item.complex}
                    </span>
                  )}
                  {(loc.unit || item.unit) && (
                    <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                      {loc.unit || item.unit}
                    </span>
                  )}
                  {(loc.direction || item.direction) && (
                    <span className="px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-mono font-bold">
                      {loc.direction || item.direction}
                    </span>
                  )}
                  {(loc.floor || item.floor) && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                      {loc.floor === 'همکف' || loc.floor === 'فاقد طبقه' ? loc.floor : `طبقه ${loc.floor}`}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  {loc.exactLocation || item.exactLocation || item.location}
                </span>
              </div>
            );
          },
        });
        return;
      }

      cols.push({
        key: col.key,
        header: isFa ? col.labelFa : col.labelEn,
        render: (item) => {
          const val = (item as any)[col.key];
          return Array.isArray(val) ? val.join('، ') : val || '-';
        },
      });
    });

    cols.push(
      {
        key: 'inspections',
        header: isFa ? 'بازرسی‌های ماهانه' : 'Inspections',
        width: 120,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => {
          const badInspections = item.inspections.filter((i) => i.status === 'نامطلوب').length;
          return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold">
              <span>{item.inspections.length} / 12</span>
              {badInspections > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500" title={`${badInspections} مورد نامطلوب`} />
              )}
            </div>
          );
        },
      },
      {
        key: 'defects',
        header: isFa ? 'نواقص و CAPA' : 'Defects',
        width: 120,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => {
          const openDefects = item.defects.filter((d) => d.status === 'باز').length;
          return (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                item.defects.length === 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : openDefects > 0
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-black animate-pulse'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {item.defects.length === 0 ? '✓ سالم' : `${item.defects.length} نقص (${openDefects} باز)`}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: isFa ? 'عملیات' : 'Actions',
        width: 105,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setViewingItem(item)}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title={isFa ? 'مشاهده شناسنامه، وضعیت و بازرسی‌ها' : 'View Passport & Inspections'}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleEditClick(item)}
              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
              title={isFa ? 'ویرایش مشخصات، موقعیت و وضعیت عملیاتی' : 'Edit Equipment'}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeletingItem(item)}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title={isFa ? 'حذف تجهیز' : 'Delete Equipment'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      }
    );

    return cols;
  }, [columns, isFa]);

  if (viewingItem) {
    const latestItem = data.find((d) => d.id === viewingItem.id) || viewingItem;
    return (
      <EquipmentDetailsView
        language={language}
        equipment={latestItem}
        onBack={() => setViewingItem(null)}
        onUpdate={onUpdate}
        onEditEquipment={(eq) => {
          setViewingItem(null);
          handleEditClick(eq);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Top action header */}
      <div className="p-4 md:p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl shadow-2xs">
              <CategoryIcon category={category} className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{category}</h2>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              {filteredData.length} / {data.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFa
              ? `مدیریت شناسنامه، موقعیت ۵ بخشی، وضعیت عملیاتی و چک‌لیست‌های ماهیانه برای ${category}`
              : `Inspection records, structured location, and operational status tracking for ${category}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
            title={isFa ? 'دریافت خروجی اکسل / CSV' : 'Export to CSV/Excel'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isFa ? 'خروجی اکسل' : 'Export Excel'}
          </button>

          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors text-xs font-bold shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isFa ? 'ثبت تجهیز جدید' : 'Add Equipment'}
          </button>
        </div>
      </div>

      {/* Filter and search bar (including 5-part location & operational status filters) */}
      <div className="px-4 md:px-5 py-3 bg-white dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shrink-0">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                isFa
                  ? 'جستجو بر اساس کد یکتا، مجتمع، واحد، موقعیت دقیق یا مشخصات...'
                  : 'Search by unique code, complex, unit, location...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {typeColumn && typeColumn.options && (
              <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs">
                <span className="px-2 text-slate-500 font-semibold hidden md:inline">
                  {isFa ? typeColumn.labelFa : typeColumn.labelEn}:
                </span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  aria-label={isFa ? typeColumn.labelFa : typeColumn.labelEn}
                  className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-none rounded-lg px-2.5 py-1 font-bold text-xs shadow-xs outline-none cursor-pointer"
                >
                  <option value="all">{isFa ? `همه انواع (${data.length})` : `All (${data.length})`}</option>
                  {typeColumn.options.map((opt) => {
                    const cnt = data.filter((d) => (d as any)[typeColumn.key] === opt).length;
                    return (
                      <option key={opt} value={opt}>
                        {opt} ({cnt})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isFa ? 'همه بازرسی‌ها' : 'All'} ({data.length})
              </button>
              <button
                onClick={() => setStatusFilter('healthy')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'healthy'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isFa ? 'بدون نقص' : 'Healthy'}
              </button>
              <button
                onClick={() => setStatusFilter('has_defects')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'has_defects'
                    ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isFa ? 'دارای نقص' : 'With Defects'}
              </button>
            </div>
          </div>
        </div>

        {/* Structured Location & Operational Status Filter Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-400 font-bold text-[11px]">
            <Filter className="w-3.5 h-3.5" />
            <span>{isFa ? 'فیلتر موقعیت و وضعیت:' : 'Location & Status Filters:'}</span>
          </span>

          {/* Complex Filter */}
          <select
            value={complexFilter}
            onChange={(e) => setComplexFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-semibold outline-none cursor-pointer"
          >
            <option value="all">{isFa ? 'همه مجتمع‌ها / شرکت‌ها' : 'All Complexes'}</option>
            {complexOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Unit Filter */}
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-semibold outline-none cursor-pointer"
          >
            <option value="all">{isFa ? 'همه واحدها' : 'All Units'}</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {/* Geographical Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-semibold outline-none cursor-pointer"
          >
            <option value="all">{isFa ? 'همه جهات جغرافیایی' : 'All Directions'}</option>
            {GEOGRAPHICAL_DIRECTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {dir}
              </option>
            ))}
          </select>

          {/* Floor Filter */}
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-semibold outline-none cursor-pointer"
          >
            <option value="all">{isFa ? 'همه طبقات' : 'All Floors'}</option>
            {FLOOR_OPTIONS.map((fl) => (
              <option key={fl} value={fl}>
                {fl === 'همکف' || fl === 'فاقد طبقه' ? fl : isFa ? `طبقه ${fl}` : `Floor ${fl}`}
              </option>
            ))}
          </select>

          {/* Operational Status Filter */}
          <select
            value={opStatusFilter}
            onChange={(e) => setOpStatusFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-semibold outline-none cursor-pointer"
          >
            <option value="all">{isFa ? 'همه وضعیت‌های عملیاتی' : 'All Operational Statuses'}</option>
            {OPERATIONAL_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {hasActiveAdvancedFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-lg text-[11px] font-bold flex items-center gap-1 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isFa ? 'پاک‌سازی فیلترها' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table with Virtualization */}
      <div className="flex-1 overflow-hidden p-4 md:p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs h-full">
          <VirtualizedDataTable
            data={filteredData}
            columns={gridColumns}
            height="100%"
            isFa={isFa}
            emptyMessage={isFa ? 'هیچ رکوردی یافت نشد.' : 'No equipment records found.'}
          />
        </div>
      </div>

      {isModalOpen && (
        <EquipmentModal
          language={language}
          category={category}
          columns={columns}
          initialData={editingItem}
          allEquipment={allEquipment}
          onSave={handleSave}
          onSelectExisting={handleSelectExistingFromModal}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {deletingItem && (
        <ConfirmDeleteModal
          isOpen={!!deletingItem}
          language={language}
          itemName={`${extractEquipmentUniqueCode(deletingItem) || deletingItem.id} (${deletingItem.location || ''})`}
          itemType={isFa ? 'تجهیز آتش‌نشانی' : 'Fire Equipment'}
          onConfirm={() => {
            if (deletingItem) {
              onDelete(deletingItem.id);
              setDeletingItem(null);
            }
          }}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}

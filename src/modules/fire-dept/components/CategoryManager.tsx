import React, { useState, useMemo, useEffect } from 'react';
import { FireEquipment } from '../types';
import { Plus, Edit2, Trash2, Search, Eye, Filter, FileSpreadsheet, Download, ShieldCheck, Layers } from 'lucide-react';
import { CATEGORY_COLUMNS } from '../config/columns';
import { CategoryIcon, getCategoryMeta } from '../config/categoryIcons';
import EquipmentModal from './EquipmentModal';
import EquipmentDetailsView from './EquipmentDetailsView';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';
import { downloadCsvFile } from '../../../utils/fileHelpers';
import { VirtualizedDataTable, VirtualizedColumn } from '../../../components/common/virtualized/VirtualizedDataTable';

interface Props {
  language: 'fa' | 'en';
  category: string;
  data: FireEquipment[];
  onAdd: (item: any) => void;
  onUpdate: (id: string, item: any) => void;
  onDelete: (id: string) => void;
}

export default function CategoryManager({ language, category, data, onAdd, onUpdate, onDelete }: Props) {
  const isFa = language === 'fa';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_defects' | 'healthy'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FireEquipment | null>(null);
  const [viewingItem, setViewingItem] = useState<FireEquipment | null>(null);
  const [deletingItem, setDeletingItem] = useState<FireEquipment | null>(null);
  
  const columns = CATEGORY_COLUMNS[category] || [];
  const typeColumn = columns.find(c => (c.key === 'detectorType' || c.key === 'type') && c.options && c.options.length > 0);

  useEffect(() => {
    setSelectedType('all');
    setSearchTerm('');
    setStatusFilter('all');
  }, [category]);

  const handleAddClick = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (item: FireEquipment) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = (item: any) => {
    if (editingItem) {
      onUpdate(editingItem.id, item);
    } else {
      const generatedId = `${category.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      onAdd({
        ...item,
        id: item.id || generatedId,
        category,
        inspections: [],
        defects: []
      });
    }
    setIsModalOpen(false);
  };

  // Filter items
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search
      const term = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      if (term) {
        const itemStr = JSON.stringify(item).toLowerCase();
        matchesSearch = itemStr.includes(term);
      }

      // Type sub-filter
      let matchesType = true;
      if (selectedType !== 'all' && typeColumn) {
        matchesType = (item as any)[typeColumn.key] === selectedType;
      }

      // Defect status
      let matchesStatus = true;
      if (statusFilter === 'has_defects') {
        matchesStatus = item.defects.length > 0 || item.inspections.some(i => i.status === 'نامطلوب');
      } else if (statusFilter === 'healthy') {
        matchesStatus = item.defects.length === 0 && !item.inspections.some(i => i.status === 'نامطلوب');
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [data, searchTerm, selectedType, statusFilter, typeColumn]);

  // Export to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (data.length === 0) return;

    const headers = ['ID', ...columns.map(c => isFa ? c.labelFa : c.labelEn), isFa ? 'تعداد بازرسی' : 'Inspections', isFa ? 'تعداد نقص' : 'Defects'];
    const rows = data.map(item => {
      const colValues = columns.map(c => {
        const val = (item as any)[c.key];
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        return `"${val ?? ''}"`;
      });
      return [
        `"${item.id}"`,
        ...colValues,
        item.inspections.length,
        item.defects.length
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
        header: 'ID',
        width: 80,
        className: 'font-mono font-bold text-red-600 dark:text-red-400',
        render: (item) => item.id
      }
    ];

    columns.forEach(col => {
      cols.push({
        key: col.key,
        header: isFa ? col.labelFa : col.labelEn,
        render: (item) => {
          const val = (item as any)[col.key];
          return Array.isArray(val) ? val.join('، ') : (val || '-');
        }
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
          const badInspections = item.inspections.filter(i => i.status === 'نامطلوب').length;
          return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold">
              <span>{item.inspections.length} / 12</span>
              {badInspections > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500" title={`${badInspections} مورد نامطلوب`} />
              )}
            </div>
          );
        }
      },
      {
        key: 'defects',
        header: isFa ? 'نواقص و CAPA' : 'Defects',
        width: 120,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => {
          const openDefects = item.defects.filter(d => d.status === 'باز').length;
          return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
              item.defects.length === 0 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                : openDefects > 0 
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-black animate-pulse' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {item.defects.length === 0 ? '✓ سالم' : `${item.defects.length} نقص (${openDefects} باز)`}
            </span>
          );
        }
      },
      {
        key: 'actions',
        header: isFa ? 'عملیات' : 'Actions',
        width: 100,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => (
          <div className="flex items-center justify-center gap-1.5">
            <button 
              onClick={() => setViewingItem(item)} 
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title={isFa ? 'مشاهده جزئیات و بازرسی‌ها' : 'View Details & Inspection'}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleEditClick(item)} 
              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
              title={isFa ? 'ویرایش مشخصات تجهیز' : 'Edit Equipment'}
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
        )
      }
    );

    return cols;
  }, [columns, isFa]);

  if (viewingItem) {
    const latestItem = data.find(d => d.id === viewingItem.id) || viewingItem;
    return (
      <EquipmentDetailsView 
        language={language}
        equipment={latestItem}
        onBack={() => setViewingItem(null)}
        onUpdate={onUpdate}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Top action header */}
      <div className="p-4 md:p-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl shadow-2xs">
              <CategoryIcon category={category} className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{category}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFa ? `مدیریت و ثبت چک‌لیست‌های ماهیانه برای ${category}` : `Inspection records and tracking for ${category}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-xs font-semibold"
            title={isFa ? 'دریافت خروجی اکسل / CSV' : 'Export to CSV/Excel'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isFa ? 'خروجی اکسل' : 'Export Excel'}
          </button>

          <button 
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isFa ? 'افزودن تجهیز جدید' : 'Add Equipment'}
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="px-4 md:px-6 py-3 bg-white dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder={isFa ? 'جستجو بر اساس شناسه، محل، کد یا مشخصات...' : 'Search by ID, location, code...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {typeColumn && typeColumn.options && (
            <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs">
              <span className="px-2 text-slate-500 font-semibold hidden md:inline">
                {isFa ? typeColumn.labelFa : typeColumn.labelEn}:
              </span>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                aria-label={isFa ? typeColumn.labelFa : typeColumn.labelEn}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-none rounded-lg px-2.5 py-1 font-bold text-xs shadow-xs outline-none cursor-pointer"
              >
                <option value="all">{isFa ? `همه انواع (${data.length})` : `All (${data.length})`}</option>
                {typeColumn.options.map(opt => {
                  const cnt = data.filter(d => (d as any)[typeColumn.key] === opt).length;
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
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {isFa ? 'همه وضعیت‌ها' : 'All'} ({data.length})
            </button>
            <button
              onClick={() => setStatusFilter('healthy')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'healthy' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {isFa ? 'بدون نقص' : 'Healthy'}
            </button>
            <button
              onClick={() => setStatusFilter('has_defects')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
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
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {deletingItem && (
        <ConfirmDeleteModal
          isOpen={!!deletingItem}
          language={language}
          itemName={`${deletingItem.id} (${deletingItem.location || ''})`}
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

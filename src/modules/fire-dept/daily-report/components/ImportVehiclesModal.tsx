import React, { useState, useMemo } from 'react';
import { 
  X, Truck, Search, Check, Plus, AlertTriangle, 
  CheckCircle2, Droplets, Shield, ExternalLink, RefreshCw, Trash2
} from 'lucide-react';
import { FireVehicle } from '../../vehicles/types/vehicleTypes';
import { DailyReportVehicleItem } from '../types/dailyReportTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fleetVehicles: FireVehicle[];
  activeReportVehicles: Array<{
    key: string;
    vehicleId: string;
    code: string;
    name: string;
    plateNumber?: string;
    vehicleType?: string;
    status: string;
  }>;
  onImportVehicle: (vehicle: FireVehicle) => void;
  onRemoveVehicle: (key: string) => void;
  onImportAllReady: () => void;
  onImportAll: () => void;
  isFa?: boolean;
}

export default function ImportVehiclesModal({
  isOpen,
  onClose,
  fleetVehicles,
  activeReportVehicles,
  onImportVehicle,
  onRemoveVehicle,
  onImportAllReady,
  onImportAll,
  isFa = true
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unadded' | 'added'>('all');

  const addedVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    activeReportVehicles.forEach(v => {
      if (v.vehicleId) ids.add(v.vehicleId);
      if (v.code) ids.add(v.code);
      if (v.key) ids.add(v.key);
    });
    return ids;
  }, [activeReportVehicles]);

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return fleetVehicles.filter(v => {
      const isAdded = addedVehicleIds.has(v.id) || addedVehicleIds.has(v.code);
      if (filterMode === 'unadded' && isAdded) return false;
      if (filterMode === 'added' && !isAdded) return false;

      if (!query) return true;
      const inCode = (v.code || '').toLowerCase().includes(query);
      const inModel = (v.brandModel || '').toLowerCase().includes(query);
      const inPlate = (v.plateNumber || '').toLowerCase().includes(query);
      const inType = (v.vehicleType || '').toLowerCase().includes(query);
      const inStation = (v.fireStation || '').toLowerCase().includes(query);
      return inCode || inModel || inPlate || inType || inStation;
    });
  }, [fleetVehicles, searchQuery, filterMode, addedVehicleIds]);

  const unaddedCount = useMemo(() => {
    return fleetVehicles.filter(v => !addedVehicleIds.has(v.id) && !addedVehicleIds.has(v.code)).length;
  }, [fleetVehicles, addedVehicleIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col animate-fadeIn overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base">
                {isFa ? 'وارد کردن خودرو از ناوگان آتش‌نشانی' : 'Import Vehicle from Fire Fleet'}
              </h3>
              <p className="text-[11px] text-red-100 mt-0.5">
                {isFa 
                  ? 'انتخاب از میان خودروهای ثبت‌شده در ماژول ناوگان و اضافه کردن به گزارش روزانه شیفت'
                  : 'Select registered fleet vehicles to include in current shift daily report'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isFa ? 'جستجوی کد (FT-01)، برند، پلاک یا نوع خودرو...' : 'Search code, model, plate...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Batch Actions */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {unaddedCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={onImportAllReady}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title={isFa ? 'وارد کردن خودروهایی که وضعیت آماده به کار دارند' : 'Import Ready Vehicles'}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isFa ? 'وارد کردن همه آماده‌ها' : 'Import Ready'}
                  </button>
                  <button
                    type="button"
                    onClick={onImportAll}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title={isFa ? 'وارد کردن کلیه خودروهای ناوگان' : 'Import All Fleet Vehicles'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isFa ? `وارد کردن کل ناوگان (${fleetVehicles.length})` : 'Import All'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {isFa ? 'همه خودروها' : 'All'} ({fleetVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unadded')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterMode === 'unadded'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {isFa ? 'وارد نشده به گزارش' : 'Available'} ({unaddedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('added')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterMode === 'added'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {isFa ? 'وارد شده در گزارش' : 'In Report'} ({fleetVehicles.length - unaddedCount})
            </button>
          </div>
        </div>

        {/* Vehicle List */}
        <div className="p-3.5 flex-1 overflow-y-auto space-y-2.5">
          {fleetVehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Truck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                {isFa ? 'هیچ خودرویی در ماژول ناوگان آتش‌نشانی ثبت نشده است.' : 'No vehicles found in Fleet module.'}
              </p>
              <p className="text-xs text-slate-400">
                {isFa 
                  ? 'برای افزودن خودرو به ناوگان، لطفاً به بخش مدیریت ناوگان خودرویی آتش‌نشانی مراجعه فرمایید.'
                  : 'Please register vehicles in the Fire Fleet Management module first.'}
              </p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-semibold">
              {isFa ? 'هیچ خودرویی با این مشخصات یافت نشد.' : 'No matching vehicles found.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredVehicles.map((veh) => {
                const isAdded = addedVehicleIds.has(veh.id) || addedVehicleIds.has(veh.code);
                const isReady = veh.status === 'آماده به کار';

                return (
                  <div
                    key={veh.id}
                    className={`p-3 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                      isAdded
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div>
                      {/* Top Code & Status */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded-md">
                            {veh.code}
                          </span>
                          <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                            {veh.plateNumber || 'بدون پلاک'}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isReady
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}>
                          {veh.status}
                        </span>
                      </div>

                      {/* Brand / Model */}
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {veh.brandModel || veh.vehicleType}
                      </h4>

                      {/* Type and specs */}
                      <div className="mt-1 space-y-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                        <div className="truncate">{veh.vehicleType}</div>
                        {(veh.waterTankCapacity || veh.foamTankCapacity) && (
                          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-600 dark:text-slate-300 pt-0.5">
                            {veh.waterTankCapacity ? <span>آب: {veh.waterTankCapacity}L</span> : null}
                            {veh.foamTankCapacity ? <span>فوم: {veh.foamTankCapacity}L</span> : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-750 flex items-center justify-between">
                      {isAdded ? (
                        <>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {isFa ? 'درج شده در گزارش روزانه' : 'Included in Report'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveVehicle(veh.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                            title={isFa ? 'حذف از این گزارش' : 'Remove from report'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onImportVehicle(veh)}
                          className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {isFa ? 'وارد کردن به گزارش' : 'Import to Report'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-semibold">
            {isFa 
              ? `${activeReportVehicles.length} خودرو در حال حاضر در گزارش درج شده است` 
              : `${activeReportVehicles.length} vehicles currently in report`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

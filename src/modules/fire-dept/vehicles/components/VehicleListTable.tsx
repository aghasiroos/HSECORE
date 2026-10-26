import React, { useState, useMemo } from 'react';
import { 
  Truck, Plus, Search, Filter, QrCode, ShieldCheck, 
  Edit3, Trash2, ChevronRight, CheckCircle2, AlertTriangle, 
  XCircle, Wrench, FileSpreadsheet, Printer, LayoutGrid, 
  List, ArrowUpDown, Eye
} from 'lucide-react';
import { FireVehicle, VehicleStatus } from '../types/vehicleTypes';
import VehicleQrModal from './VehicleQrModal';
import ConfirmDeleteModal from '../../../../components/common/ConfirmDeleteModal';
import { printService } from '../../../../services/printService';
import { getSystemBrandingConfig } from '../../../../utils/systemBrandingHelper';

interface Props {
  language: 'fa' | 'en';
  vehicles: FireVehicle[];
  onSelectVehicle: (vehicle: FireVehicle) => void;
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: FireVehicle) => void;
  onDeleteVehicle: (id: string) => void;
  onStartInspection: (vehicle: FireVehicle) => void;
}

export default function VehicleListTable({
  language,
  vehicles,
  onSelectVehicle,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onStartInspection
}: Props) {
  const isFa = language === 'fa';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stationFilter, setStationFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedQrVehicle, setSelectedQrVehicle] = useState<FireVehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<FireVehicle | null>(null);

  const stations = useMemo(() => {
    return Array.from(new Set(vehicles.map(v => v.fireStation))).filter(Boolean);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (stationFilter !== 'all' && v.fireStation !== stationFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = v.code.toLowerCase().includes(q);
        const matchModel = v.brandModel.toLowerCase().includes(q);
        const matchPlate = v.plateNumber.toLowerCase().includes(q);
        const matchType = v.vehicleType.toLowerCase().includes(q);
        if (!matchCode && !matchModel && !matchPlate && !matchType) return false;
      }
      return true;
    });
  }, [vehicles, statusFilter, stationFilter, searchQuery]);

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'آماده به کار':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3" />{status}</span>;
      case 'آماده به کار با محدودیت':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><AlertTriangle className="w-3 h-3" />{status}</span>;
      case 'در تعمیرات':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800"><Wrench className="w-3 h-3" />{status}</span>;
      case 'خارج از سرویس':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><XCircle className="w-3 h-3" />{status}</span>;
    }
  };

  const exportToExcelSimulated = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["کد,مدل,پلاک,نوع,ایستگاه,وضعیت,امتیاز انطباق,کارکرد,مخزن آب,مخزن فوم"]
      .concat(filteredVehicles.map(v => `${v.code},"${v.brandModel}","${v.plateNumber}","${v.vehicleType}","${v.fireStation}","${v.status}",${v.complianceScore}%,${v.mileage},${v.waterTankCapacity},${v.foamTankCapacity}`))
      .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fire_vehicles_fleet_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const branding = getSystemBrandingConfig();
    const today = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const listToPrint = filteredVehicles;

    const rowsHtml = listToPrint.map((v, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
        <td style="padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace; font-weight: bold;">${v.code}</td>
        <td style="padding: 6px; font-weight: bold;">${v.brandModel}</td>
        <td style="padding: 6px; text-align: center;">${v.vehicleType}</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace;">${v.plateNumber}</td>
        <td style="padding: 6px; text-align: center;">${v.fireStation}</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${v.status}</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace;">${v.complianceScore}%</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace;">${v.lastInspectionDate}</td>
        <td style="padding: 6px; text-align: center;">${v.assignedDriver || '-'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif;">
        <div style="border: 2px solid #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${branding.logoUrl ? `<img src="${branding.logoUrl}" style="height: 18mm; max-width: 45mm; object-fit: contain;" alt="Logo" />` : ''}
            <div>
              <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">${branding.organizationNameFa || 'واحد آتش‌نشانی و امداد و نجات مجتمع'}</h2>
              <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 700; color: #475569;">گزارش رسمی ناوگان خودروها و تجهیزات متحرک آتش‌نشانی</p>
            </div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; font-size: 10px; line-height: 1.6; background: #f8fafc;">
            <div><strong>کد سند:</strong> <span style="font-family: 'JetBrains Mono', monospace;">FIRE-VEH-FLEET</span></div>
            <div><strong>تاریخ گزارش:</strong> <span style="font-family: 'JetBrains Mono', monospace;">${today}</span></div>
            <div><strong>تعداد ناوگان:</strong> <strong>${listToPrint.length} دستگاه</strong></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #0f172a; font-weight: 800; font-size: 10.5px;">
              <th style="padding: 8px; text-align: center; width: 35px;">ردیف</th>
              <th style="padding: 8px; text-align: center; width: 75px;">کد ناوگان</th>
              <th style="padding: 8px; text-align: right;">نام و مدل خودرو</th>
              <th style="padding: 8px; text-align: center;">رده تخصصی</th>
              <th style="padding: 8px; text-align: center; width: 90px;">شماره پلاک</th>
              <th style="padding: 8px; text-align: center;">ایستگاه مستقر</th>
              <th style="padding: 8px; text-align: center;">وضعیت عملیاتی</th>
              <th style="padding: 8px; text-align: center; width: 65px;">ضریب آماده‌بک</th>
              <th style="padding: 8px; text-align: center; width: 85px;">آخرین بازرسی</th>
              <th style="padding: 8px; text-align: center;">راننده/مسئول</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="avoid-break" style="margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; font-size: 11px;">
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 30px;">مسئول ترابری و لجستیک آتش‌نشانی</div>
            <div style="color: #94a3b8; font-size: 10px;">امضا و تاریخ</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 30px;">رئیس ایستگاه و عملیات آتش‌نشانی</div>
            <div style="color: #94a3b8; font-size: 10px;">امضا و مهر</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 30px;">مدیر بهداشت، ایمنی و محیط زیست</div>
            <div style="color: #94a3b8; font-size: 10px;">تأیید نهایی</div>
          </div>
        </div>
      </div>
    `;

    printService.printHtml(html, {
      title: 'فهرست رسمی ناوگان خودروهای آتش‌نشانی',
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: 'FIRE-VEH-FLEET',
      documentDate: today,
      isFa: true,
      autoPrint: true
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600 text-white rounded-2xl shadow-xs">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              {isFa ? 'مدیریت و فهرست تفصیلی خودروهای آتش‌نشانی' : 'Fire Vehicles Fleet Directory'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFa ? 'ثبت خودرو جدید، صدور بارکد QR، بررسی پرونده‌های جامع و گزارش‌گیری' : 'Vehicle Registry, QR generator, profile manager & export'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToExcelSimulated}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isFa ? 'خروجی اکسل' : 'Export Excel'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ لیست' : 'Print'}</span>
          </button>

          <button
            onClick={onAddVehicle}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت خودرو جدید' : 'Add Vehicle'}</span>
          </button>
        </div>
      </div>

      {/* Toolbar Filters & Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-[0px] w-full md:min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={isFa ? 'جستجوی کد، مدل، پلاک، نوع خودرو...' : 'Search vehicles...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
          >
            <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
            <option value="آماده به کار">{isFa ? 'آماده به کار' : 'Ready'}</option>
            <option value="آماده به کار با محدودیت">{isFa ? 'آماده به کار با محدودیت' : 'Ready with Limit'}</option>
            <option value="در تعمیرات">{isFa ? 'در تعمیرات' : 'In Repair'}</option>
            <option value="خارج از سرویس">{isFa ? 'خارج از سرویس' : 'Out of Service'}</option>
          </select>

          <select
            value={stationFilter}
            onChange={e => setStationFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
          >
            <option value="all">{isFa ? 'همه ایستگاه‌ها' : 'All Stations'}</option>
            {stations.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'table' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-xs' : 'text-slate-400'
            }`}
            title={isFa ? 'نمای جدولی' : 'Table View'}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-xs' : 'text-slate-400'
            }`}
            title={isFa ? 'نمای کارتی' : 'Grid View'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table / Grid View */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">{isFa ? 'کد خودرو' : 'Code'}</th>
                  <th className="p-3.5">{isFa ? 'مشخصات و مدل' : 'Brand & Model'}</th>
                  <th className="p-3.5">{isFa ? 'نوع و کاربری' : 'Type'}</th>
                  <th className="p-3.5">{isFa ? 'شماره پلاک' : 'Plate'}</th>
                  <th className="p-3.5">{isFa ? 'ایستگاه استقرار' : 'Station'}</th>
                  <th className="p-3.5">{isFa ? 'مخزن آب / فوم' : 'Water / Foam'}</th>
                  <th className="p-3.5">{isFa ? 'امتیاز انطباق' : 'Compliance'}</th>
                  <th className="p-3.5">{isFa ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredVehicles.map(vehicle => (
                  <tr key={vehicle.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition-colors">
                    <td className="p-3.5">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-red-600 text-white font-mono font-black text-xs shadow-xs tracking-wider whitespace-nowrap min-w-[65px]">
                        {vehicle.code}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{vehicle.brandModel}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{vehicle.mileage.toLocaleString()} km</div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300 font-bold">{vehicle.vehicleType}</td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">{vehicle.plateNumber}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{vehicle.fireStation}</td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                      {vehicle.waterTankCapacity}L / {vehicle.foamTankCapacity}L
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-mono font-black text-xs">
                        <span className={vehicle.complianceScore >= 90 ? 'text-emerald-600' : vehicle.complianceScore >= 75 ? 'text-amber-600' : 'text-rose-600'}>
                          {vehicle.complianceScore}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">({vehicle.overallReadiness})</span>
                      </div>
                    </td>
                    <td className="p-3.5">{getStatusBadge(vehicle.status)}</td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectVehicle(vehicle)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          title={isFa ? 'مشاهده پرونده جامع' : 'View Profile'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onStartInspection(vehicle)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg cursor-pointer"
                          title={isFa ? 'شروع بازرسی جدید' : 'Inspect'}
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedQrVehicle(vehicle)}
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg cursor-pointer"
                          title={isFa ? 'شناسنامه و QR Code' : 'QR Code'}
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditVehicle(vehicle)}
                          className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg cursor-pointer"
                          title={isFa ? 'ویرایش مشخصات' : 'Edit'}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingVehicle(vehicle)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                          title={isFa ? 'حذف خودرو' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map(vehicle => (
            <div
              key={vehicle.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-xl bg-red-600 text-white font-mono font-black text-xs shadow-xs tracking-wider whitespace-nowrap min-w-[65px]">
                      {vehicle.code}
                    </span>
                    <h3 className="font-black text-xs text-slate-900 dark:text-white">
                      {vehicle.brandModel}
                    </h3>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{vehicle.plateNumber}</div>
                </div>
                {getStatusBadge(vehicle.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'نوع خودرو:' : 'Type:'}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">{vehicle.vehicleType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'ایستگاه:' : 'Station:'}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">{vehicle.fireStation}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'مخازن:' : 'Tanks:'}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{vehicle.waterTankCapacity}L / {vehicle.foamTankCapacity}L</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'انطباق بازرسی:' : 'Compliance:'}</span>
                  <span className="font-mono font-black text-emerald-600">{vehicle.complianceScore}% ({vehicle.overallReadiness})</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <button
                  onClick={() => onSelectVehicle(vehicle)}
                  className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                >
                  <span>{isFa ? 'مشاهده پرونده جامع' : 'View Profile'}</span>
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onStartInspection(vehicle)}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                    title={isFa ? 'بازرسی' : 'Inspect'}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedQrVehicle(vehicle)}
                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg cursor-pointer"
                    title={isFa ? 'QR Code' : 'QR'}
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditVehicle(vehicle)}
                    className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg cursor-pointer"
                    title={isFa ? 'ویرایش' : 'Edit'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingVehicle(vehicle)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                    title={isFa ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {selectedQrVehicle && (
        <VehicleQrModal
          language={language}
          vehicle={selectedQrVehicle}
          isOpen={true}
          onClose={() => setSelectedQrVehicle(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingVehicle && (
        <ConfirmDeleteModal
          isOpen={!!deletingVehicle}
          language={language}
          itemName={`${deletingVehicle.code} - ${deletingVehicle.brandModel}`}
          itemType={isFa ? 'خودروی آتش‌نشانی' : 'Fire Vehicle'}
          onConfirm={() => {
            if (deletingVehicle) {
              onDeleteVehicle(deletingVehicle.id);
              setDeletingVehicle(null);
            }
          }}
          onClose={() => setDeletingVehicle(null)}
        />
      )}
    </div>
  );
}

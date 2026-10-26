import React from 'react';
import { X, QrCode, Printer, Download, CheckCircle2, AlertTriangle, XCircle, Wrench, ShieldCheck, Truck } from 'lucide-react';
import { FireVehicle } from '../types/vehicleTypes';
import { printService } from '../../../../services/printService';

interface Props {
  language: 'fa' | 'en';
  vehicle: FireVehicle;
  isOpen: boolean;
  onClose: () => void;
}

export default function VehicleQrModal({
  language,
  vehicle,
  isOpen,
  onClose
}: Props) {
  const isFa = language === 'fa';
  if (!isOpen) return null;

  const openDefects = vehicle.defects.filter(d => d.status === 'باز' || d.status === 'در حال اقدام');

  // Compute next inspection estimate (e.g. 7 days or 30 days)
  const nextInspectionEstimate = '1404/05/25';

  const handlePrint = () => {
    printService.printElement('vehicle-qr-card', {
      title: `برچسب و شناسنامه QR Code خودرو ${vehicle.code} - ${vehicle.brandModel}`,
      orientation: 'portrait',
      pageSize: 'A4',
      documentCode: `FIRE-VEH-${vehicle.code}`,
      documentDate: new Date().toLocaleDateString('fa-IR'),
      isFa: isFa,
      autoPrint: true
    });
  };

  // Generate SVG QR Code pattern visualization
  const qrDataText = encodeURIComponent(
    `HSE-FIRE-VEHICLE:${vehicle.code}|VIN:${vehicle.vin}|STATUS:${vehicle.status}|SCORE:${vehicle.complianceScore}%`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn print:border-none print:shadow-none">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-850 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-600 text-white rounded-xl">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              {isFa ? `شناسنامه QR Code خودرو ${vehicle.code}` : `QR Code Badge ${vehicle.code}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badge Card for Print / Scanning */}
        <div className="p-6 text-center space-y-4" id="vehicle-qr-card">
          {/* Header of Badge */}
          <div className="border-b pb-3 border-slate-200 dark:border-slate-700">
            <div className="inline-flex items-center justify-center p-2 bg-red-600 text-white rounded-2xl mb-2">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isFa ? 'سامانه هوشمند پایش ناوگان آتش‌نشانی' : 'Smart Fire Fleet Monitoring'}
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {vehicle.code} - {vehicle.brandModel}
            </h2>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono mt-0.5">
              {vehicle.plateNumber}
            </div>
          </div>

          {/* QR Code Canvas Representation */}
          <div className="flex justify-center py-2">
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-md inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrDataText}&color=0f172a&bgcolor=ffffff`}
                alt={`QR Code ${vehicle.code}`}
                className="w-44 h-44 object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-2 gap-2 text-right text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 block">{isFa ? 'نوع خودرو:' : 'Type:'}</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">{vehicle.vehicleType}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">{isFa ? 'محل استقرار:' : 'Station:'}</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">{vehicle.fireStation}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">{isFa ? 'وضعیت فعلی:' : 'Status:'}</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 block">{vehicle.status}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">{isFa ? 'امتیاز انطباق:' : 'Compliance:'}</span>
              <span className="font-black font-mono text-emerald-600 block">{vehicle.complianceScore}% ({vehicle.overallReadiness})</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">{isFa ? 'آخرین بازرسی:' : 'Last Insp:'}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 block">{vehicle.lastInspectionDate || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">{isFa ? 'بازرسی بعدی:' : 'Next Insp:'}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 block">{nextInspectionEstimate}</span>
            </div>
          </div>

          {/* Defect Alert */}
          {openDefects.length > 0 ? (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{openDefects.length} {isFa ? 'مغایرت/نقص باز در انتظار اقدام' : 'Open Defects Recorded'}</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{isFa ? 'کلیه آیتم‌های بازرسی در وضعیت مطلوب' : 'All Inspection Items Compliant'}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex items-center justify-between print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ برچسب QR Code' : 'Print Badge'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

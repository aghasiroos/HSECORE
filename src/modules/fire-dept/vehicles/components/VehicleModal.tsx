import React, { useState } from 'react';
import { X, Truck, Save, Upload, AlertCircle } from 'lucide-react';
import { FireVehicle, VehicleStatus } from '../types/vehicleTypes';

interface Props {
  language: 'fa' | 'en';
  vehicle?: FireVehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicleData: any) => void;
}

const VEHICLE_TYPES = [
  'خودرو سنگین اطفاء حریق',
  'خودرو نیمه‌سنگین اطفاء',
  'خودرو فوم و پودر',
  'خودرو امداد و نجات',
  'خودرو پیشرو / فرماندهی',
  'تانکر آب پشتیبان',
  'نردبان هیدرولیکی / پلتفرم',
  'آمبولانس آتش‌نشانی'
];

const FUEL_TYPES = [
  'دیزل (گازوئیل)',
  'بنزین',
  'دوگانه‌سوز',
  'CNG'
];

const STATUS_OPTIONS: VehicleStatus[] = [
  'آماده به کار',
  'آماده به کار با محدودیت',
  'در تعمیرات',
  'خارج از سرویس'
];

export default function VehicleModal({
  language,
  vehicle,
  isOpen,
  onClose,
  onSave
}: Props) {
  const isFa = language === 'fa';

  const [code, setCode] = useState(vehicle?.code || '');
  const [plateNumber, setPlateNumber] = useState(vehicle?.plateNumber || '');
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType || VEHICLE_TYPES[0]);
  const [brandModel, setBrandModel] = useState(vehicle?.brandModel || '');
  const [buildYear, setBuildYear] = useState(vehicle?.buildYear || '1401 / 2022');
  const [country, setCountry] = useState(vehicle?.country || 'ایران');
  const [chassisNumber, setChassisNumber] = useState(vehicle?.chassisNumber || '');
  const [engineNumber, setEngineNumber] = useState(vehicle?.engineNumber || '');
  const [vin, setVin] = useState(vehicle?.vin || '');
  const [waterTankCapacity, setWaterTankCapacity] = useState(vehicle?.waterTankCapacity || 0);
  const [foamTankCapacity, setFoamTankCapacity] = useState(vehicle?.foamTankCapacity || 0);
  const [foamType, setFoamType] = useState(vehicle?.foamType || 'AFFF 3%');
  const [pumpCapacityPressure, setPumpCapacityPressure] = useState(vehicle?.pumpCapacityPressure || '4000 L/min @ 10 Bar');
  const [fuelType, setFuelType] = useState(vehicle?.fuelType || FUEL_TYPES[0]);
  const [mileage, setMileage] = useState(vehicle?.mileage || 0);
  const [location, setLocation] = useState(vehicle?.location || 'ایستگاه مرکزی');
  const [fireStation, setFireStation] = useState(vehicle?.fireStation || 'ایستگاه ۱ - مرکزی');
  const [responsiblePerson, setResponsiblePerson] = useState(vehicle?.responsiblePerson || '');
  const [commissionDate, setCommissionDate] = useState(vehicle?.commissionDate || '1401/01/15');
  const [lastServiceDate, setLastServiceDate] = useState(vehicle?.lastServiceDate || '');
  const [lastInspectionDate, setLastInspectionDate] = useState(vehicle?.lastInspectionDate || '');
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status || 'آماده به کار');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      code,
      plateNumber,
      vehicleType,
      brandModel,
      buildYear,
      country,
      chassisNumber,
      engineNumber,
      vin: vin || chassisNumber,
      waterTankCapacity: Number(waterTankCapacity),
      foamTankCapacity: Number(foamTankCapacity),
      foamType,
      pumpCapacityPressure,
      fuelType,
      mileage: Number(mileage),
      location,
      fireStation,
      responsiblePerson,
      commissionDate,
      lastServiceDate,
      lastInspectionDate,
      status
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-2xl shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {vehicle ? (isFa ? `ویرایش مشخصات خودرو ${vehicle.code}` : `Edit Vehicle ${vehicle.code}`) : (isFa ? 'ثبت خودروی آتش‌نشانی جدید' : 'Register New Fire Vehicle')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isFa ? 'ورود اطلاعات شناسنامه‌ای، مشخصات فنی، پمپ و ظرفیت مخازن اطفاء' : 'Identification, technical specs, pump & extinguishing tanks'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Group 1: General & Identifiers */}
          <div className="space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white text-xs border-b pb-1 dark:border-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              <span>{isFa ? 'اطلاعات هویتی و انتظامی خودرو' : 'Vehicle Identity & Plate'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'کد خودرو:' : 'Vehicle Code:'} *
                </label>
                <input
                  type="text"
                  placeholder="مثال: FT-06"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'شماره پلاک:' : 'License Plate:'} *
                </label>
                <input
                  type="text"
                  placeholder="مثال: ۱۲ الف ۳۴۵ ایران ۲۲"
                  value={plateNumber}
                  onChange={e => setPlateNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'نوع خودرو:' : 'Vehicle Type:'} *
                </label>
                <select
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {VEHICLE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'برند و مدل:' : 'Brand & Model:'} *
                </label>
                <input
                  type="text"
                  placeholder="مثال: Scania P380"
                  value={brandModel}
                  onChange={e => setBrandModel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'سال ساخت:' : 'Build Year:'}
                </label>
                <input
                  type="text"
                  value={buildYear}
                  onChange={e => setBuildYear(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'کشور سازنده / تجهیزکننده:' : 'Country:'}
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'شماره شاسی:' : 'Chassis No:'}
                </label>
                <input
                  type="text"
                  value={chassisNumber}
                  onChange={e => setChassisNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'شماره موتور:' : 'Engine No:'}
                </label>
                <input
                  type="text"
                  value={engineNumber}
                  onChange={e => setEngineNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Group 2: Technical & Extinguishing Specs */}
          <div className="space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white text-xs border-b pb-1 dark:border-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{isFa ? 'مشخصات پمپ، مخازن و سیستم اطفاء' : 'Extinguishing System & Pump Specs'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'ظرفیت مخزن آب (لیتر):' : 'Water Tank Capacity (L):'}
                </label>
                <input
                  type="number"
                  value={waterTankCapacity}
                  onChange={e => setWaterTankCapacity(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'ظرفیت مخزن فوم (لیتر):' : 'Foam Tank Capacity (L):'}
                </label>
                <input
                  type="number"
                  value={foamTankCapacity}
                  onChange={e => setFoamTankCapacity(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'نوع فوم مصرفی:' : 'Foam Type:'}
                </label>
                <input
                  type="text"
                  placeholder="AFFF 3% / AR-AFFF"
                  value={foamType}
                  onChange={e => setFoamType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'ظرفیت و فشار پمپ:' : 'Pump Capacity & Pressure:'}
                </label>
                <input
                  type="text"
                  placeholder="4000 L/min @ 10 Bar"
                  value={pumpCapacityPressure}
                  onChange={e => setPumpCapacityPressure(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'نوع سوخت:' : 'Fuel Type:'}
                </label>
                <select
                  value={fuelType}
                  onChange={e => setFuelType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {FUEL_TYPES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'کیلومتر کارکرد:' : 'Mileage (km):'}
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={e => setMileage(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Location, Status & Responsible */}
          <div className="space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white text-xs border-b pb-1 dark:border-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{isFa ? 'محل استقرار، مسئولیت و وضعیت عملیاتی' : 'Deployment, Responsibility & Status'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'ایستگاه آتش‌نشانی:' : 'Fire Station:'}
                </label>
                <input
                  type="text"
                  placeholder="ایستگاه ۱ - مرکزی"
                  value={fireStation}
                  onChange={e => setFireStation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'محل دقیق استقرار / آشیانه:' : 'Bay / Location:'}
                </label>
                <input
                  type="text"
                  placeholder="آشیانه شماره ۱"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'مسئول خودرو / راننده آتش‌نشان:' : 'Responsible Officer:'}
                </label>
                <input
                  type="text"
                  placeholder="استوار رضایی"
                  value={responsiblePerson}
                  onChange={e => setResponsiblePerson(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'وضعیت عملیاتی خودرو:' : 'Vehicle Status:'}
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as VehicleStatus)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'تاریخ ورود به سرویس:' : 'Commission Date:'}
                </label>
                <input
                  type="text"
                  placeholder="1401/01/15"
                  value={commissionDate}
                  onChange={e => setCommissionDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'تاریخ آخرین سرویس PM:' : 'Last Service Date:'}
                </label>
                <input
                  type="text"
                  placeholder="1404/04/10"
                  value={lastServiceDate}
                  onChange={e => setLastServiceDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isFa ? 'ذخیره مشخصات خودرو' : 'Save Vehicle'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  ArrowRight, ShieldCheck, QrCode, Edit3, Trash2, CheckCircle2,
  AlertTriangle, XCircle, Wrench, ShieldAlert, Award, FileText,
  Calendar, User, Plus, Clock, ExternalLink, Download, Search,
  Filter, Eye, Image as ImageIcon, Sparkles, Layers, Check, AlertCircle,
  FileCheck, Shield, ChevronLeft, ChevronRight, Hash, Tag, Truck,
  Flame, Fuel, MapPin, Gauge, Droplets
} from 'lucide-react';
import {
  FireVehicle, VehicleInspectionRecord, VehicleDefectRecord,
  VehicleMaintenanceRecord, VehicleTestCertificate, VehicleDocument,
  VehicleDocumentCategory, VehicleStatus
} from '../types/vehicleTypes';
import VehicleQrModal from './VehicleQrModal';
import ConfirmDeleteModal from '../../../../components/common/ConfirmDeleteModal';
import VehicleDocumentModal from './VehicleDocumentModal';
import VehicleDocumentViewerModal from './VehicleDocumentViewerModal';
import VehicleMaintenanceModal, { VehicleMaintenanceModal as NamedVehicleMaintenanceModal } from './VehicleMaintenanceModal';
import VehicleCertificateModal from './VehicleCertificateModal';
import VehicleDefectModal from './VehicleDefectModal';
import VehicleInspectionEditModal from './VehicleInspectionEditModal';

const ResolvedVehicleMaintenanceModal = (VehicleMaintenanceModal || NamedVehicleMaintenanceModal) as typeof VehicleMaintenanceModal;

interface Props {
  language: 'fa' | 'en';
  vehicle: FireVehicle;
  onBack: () => void;
  onEdit: (vehicle: FireVehicle) => void;
  onDelete: (id: string) => void;
  onStartInspection: (vehicle?: FireVehicle) => void;
  onUpdateInspection?: (vehicleId: string, inspectionId: string, data: Partial<VehicleInspectionRecord>) => void;
  onDeleteInspection?: (vehicleId: string, inspectionId: string) => void;
  onAddDefect?: (vehicleId: string, defect: Omit<VehicleDefectRecord, 'id' | 'code'>) => void;
  onUpdateDefect?: (vehicleId: string, defectId: string, updates: Partial<VehicleDefectRecord>) => void;
  onDeleteDefect?: (vehicleId: string, defectId: string) => void;
  onAddMaintenance?: (vehicleId: string, record: Omit<VehicleMaintenanceRecord, 'id'>) => void;
  onUpdateMaintenance?: (vehicleId: string, maintenanceId: string, record: Partial<VehicleMaintenanceRecord>) => void;
  onDeleteMaintenance?: (vehicleId: string, maintenanceId: string) => void;
  onAddCertificate?: (vehicleId: string, cert: Omit<VehicleTestCertificate, 'id'>) => void;
  onUpdateCertificate?: (vehicleId: string, certificateId: string, cert: Partial<VehicleTestCertificate>) => void;
  onDeleteCertificate?: (vehicleId: string, certificateId: string) => void;
  onAddDocument?: (vehicleId: string, doc: Omit<VehicleDocument, 'id'>) => void;
  onUpdateDocument?: (vehicleId: string, docId: string, doc: Partial<VehicleDocument>) => void;
  onDeleteDocument?: (vehicleId: string, docId: string) => void;
}

type TabKey = 'specs' | 'inspections' | 'defects' | 'maintenance' | 'certificates' | 'docs';

export default function VehicleProfileDetail({
  language,
  vehicle,
  onBack,
  onEdit,
  onDelete,
  onStartInspection,
  onUpdateInspection,
  onDeleteInspection,
  onAddDefect,
  onUpdateDefect,
  onDeleteDefect,
  onAddMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
  onAddCertificate,
  onUpdateCertificate,
  onDeleteCertificate,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument
}: Props) {
  const isFa = language === 'fa';
  const [activeTab, setActiveTab] = useState<TabKey>('specs');

  // Modals for General
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteVehicleModal, setShowDeleteVehicleModal] = useState(false);

  // Modals for Inspections
  const [selectedInspectionForView, setSelectedInspectionForView] = useState<VehicleInspectionRecord | null>(null);
  const [editingInspection, setEditingInspection] = useState<VehicleInspectionRecord | null>(null);
  const [deletingInspection, setDeletingInspection] = useState<VehicleInspectionRecord | null>(null);

  // Modals for Defects
  const [showAddDefectModal, setShowAddDefectModal] = useState(false);
  const [editingDefect, setEditingDefect] = useState<VehicleDefectRecord | null>(null);
  const [deletingDefect, setDeletingDefect] = useState<VehicleDefectRecord | null>(null);
  const [selectedDefectForCapa, setSelectedDefectForCapa] = useState<VehicleDefectRecord | null>(null);

  // CAPA Form state inside CAPA modal
  const [capaRootCause, setCapaRootCause] = useState('');
  const [capaImmediateAction, setCapaImmediateAction] = useState('');
  const [capaPlan, setCapaPlan] = useState('');
  const [capaResponsible, setCapaResponsible] = useState('');
  const [capaDueDate, setCapaDueDate] = useState('');
  const [capaHseApproval, setCapaHseApproval] = useState(false);
  const [capaStatus, setCapaStatus] = useState<VehicleDefectRecord['status']>('باز');

  // Modals for Maintenance
  const [showAddMaintModal, setShowAddMaintModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<VehicleMaintenanceRecord | null>(null);
  const [deletingMaintenance, setDeletingMaintenance] = useState<VehicleMaintenanceRecord | null>(null);

  // Modals for Certificates
  const [showAddCertModal, setShowAddCertModal] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<VehicleTestCertificate | null>(null);
  const [deletingCertificate, setDeletingCertificate] = useState<VehicleTestCertificate | null>(null);

  // Modals for Documents
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<VehicleDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<VehicleDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<VehicleDocument | null>(null);
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Handle open CAPA Modal
  const handleOpenCapa = (defect: VehicleDefectRecord) => {
    setSelectedDefectForCapa(defect);
    setCapaRootCause(defect.rootCauseAnalysis || '');
    setCapaImmediateAction(defect.immediateAction || '');
    setCapaPlan(defect.capaPlan || '');
    setCapaResponsible(defect.responsiblePerson || '');
    setCapaDueDate(defect.dueDate || '');
    setCapaHseApproval(defect.hseSignOff || false);
    setCapaStatus(defect.status);
  };

  const handleSaveCapa = () => {
    if (!selectedDefectForCapa || !onUpdateDefect) return;
    onUpdateDefect(vehicle.id, selectedDefectForCapa.id, {
      rootCauseAnalysis: capaRootCause,
      immediateAction: capaImmediateAction,
      capaPlan: capaPlan,
      responsiblePerson: capaResponsible,
      dueDate: capaDueDate,
      hseSignOff: capaHseApproval,
      status: capaStatus
    });
    setSelectedDefectForCapa(null);
  };

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'آماده به کار':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />{status}
          </span>
        );
      case 'آماده به کار با محدودیت':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />{status}
          </span>
        );
      case 'در تعمیرات':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Wrench className="w-3.5 h-3.5" />{status}
          </span>
        );
      case 'خارج از سرویس':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />{status}
          </span>
        );
    }
  };

  // Filter documents
  const allDocs = vehicle.documents || [];
  const filteredDocs = allDocs.filter(doc => {
    const matchesCategory = docCategoryFilter === 'all' || doc.category === docCategoryFilter;
    const matchesSearch = !docSearchQuery || 
      doc.title.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
      (doc.docNumber && doc.docNumber.toLowerCase().includes(docSearchQuery.toLowerCase())) ||
      (doc.notes && doc.notes.toLowerCase().includes(docSearchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-colors cursor-pointer"
              title={isFa ? 'بازگشت به لیست ناوگان' : 'Back to Fleet List'}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center justify-center px-3 py-1 bg-red-600 text-white font-black text-xs rounded-xl font-mono shadow-xs tracking-wider whitespace-nowrap min-w-[70px]">
                  {vehicle.code}
                </span>
                <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {vehicle.brandModel}
                </h1>
                {getStatusBadge(vehicle.status)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                <span>{isFa ? 'پلاک انتظامی:' : 'Plate:'} <strong>{vehicle.plateNumber}</strong></span>
                <span>•</span>
                <span>{isFa ? 'کاربری:' : 'Type:'} <strong>{vehicle.vehicleType}</strong></span>
                <span>•</span>
                <span>{isFa ? 'ایستگاه:' : 'Station:'} <strong>{vehicle.fireStation}</strong></span>
                <span>•</span>
                <span>{isFa ? 'کارکرد:' : 'Mileage:'} <strong>{vehicle.currentMileage?.toLocaleString()} km</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onStartInspection(vehicle)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform hover:scale-105 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isFa ? 'شروع بازرسی جدید' : 'Run Inspection'}</span>
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-slate-500" />
              <span>{isFa ? 'کد QR شناسنامه' : 'QR Profile'}</span>
            </button>
            <button
              onClick={() => onEdit(vehicle)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={isFa ? 'ویرایش مشخصات خودرو' : 'Edit Vehicle'}
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteVehicleModal(true)}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
              title={isFa ? 'حذف خودرو' : 'Delete Vehicle'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Readiness Bar */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {isFa ? 'شاخص انطباق استاندارد و آمادگی عملیاتی (Readiness & Compliance Index):' : 'Readiness & Compliance Index:'}
              </span>
              <span className="font-mono font-black text-sm text-red-600 dark:text-red-400">
                {vehicle.complianceScore}% ({vehicle.overallReadiness})
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  vehicle.complianceScore >= 90 ? 'bg-emerald-500' :
                  vehicle.complianceScore >= 75 ? 'bg-amber-500' :
                  vehicle.complianceScore >= 50 ? 'bg-blue-500' : 'bg-rose-500'
                }`}
                style={{ width: `${vehicle.complianceScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('specs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'specs'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isFa ? 'مشخصات فنی و شناسنامه' : 'Specs & Identity'}</span>
        </button>

        <button
          onClick={() => setActiveTab('inspections')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'inspections'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isFa ? 'سوابق بازرسی‌ها' : 'Inspections'}</span>
          <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] rounded-full font-mono">
            {vehicle.inspectionHistory?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('defects')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'defects'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{isFa ? 'نواقص و اقدامات CAPA' : 'Defects & CAPA'}</span>
          <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] rounded-full font-mono">
            {vehicle.defects?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'maintenance'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>{isFa ? 'نگهداری و تعمیرات PM/CM' : 'Maintenance'}</span>
          <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] rounded-full font-mono">
            {vehicle.maintenanceHistory?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('certificates')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'certificates'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>{isFa ? 'تست‌ها و گواهینامه‌ها' : 'Certificates & Tests'}</span>
          <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] rounded-full font-mono">
            {vehicle.testCertificates?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'docs'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isFa ? 'اسناد، دفترچه‌ها و مدارک' : 'Documents & Manuals'}</span>
          <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] rounded-full font-mono">
            {vehicle.documents?.length || 0}
          </span>
        </button>
      </div>

      {/* Tab 1: Specs & Identity */}
      {activeTab === 'specs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Card 1: Identity & Chassis Specs */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/40">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {isFa ? 'اطلاعات هویتی و انتظامی خودرو' : 'Vehicle Identity & Chassis'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isFa ? 'شناسنامه انتظامی، شاسی و مشخصات سازنده' : 'Chassis, VIN, plate & manufacturer specs'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => onEdit(vehicle)} 
                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer" 
                title={isFa ? 'ویرایش اطلاعات خودرو' : 'Edit Specs'}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'کد اختصاصی خودرو:' : 'Vehicle Code:'}</span>
                <span className="font-mono font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2.5 py-0.5 rounded-lg border border-red-200 dark:border-red-800/60">
                  {vehicle.code}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'شماره پلاک انتظامی:' : 'License Plate:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-mono">
                  {vehicle.plateNumber || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'نوع خودرو و کاربری:' : 'Vehicle Type:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-left">
                  {vehicle.vehicleType || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'برند و مدل شاسی:' : 'Brand & Model:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {vehicle.brandModel || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'سال ساخت:' : 'Build Year:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.buildYear || vehicle.year || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'کشور سازنده / تجهیز:' : 'Country:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.country || (isFa ? 'ایران' : 'Iran')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'شماره شاسی (VIN):' : 'Chassis No (VIN):'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100 select-all">
                  {vehicle.chassisNumber || vehicle.vin || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'شماره موتور:' : 'Engine No:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100 select-all">
                  {vehicle.engineNumber || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Extinguishing System & Tanks */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {isFa ? 'مشخصات پمپ، مخازن و سیستم اطفاء' : 'Extinguishing System & Pump'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isFa ? 'ظرفیت مخازن آب، فوم، پمپ و سوخت' : 'Water/foam tanks, pump rating & fuel'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => onEdit(vehicle)} 
                className="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer" 
                title={isFa ? 'ویرایش مشخصات اطفاء' : 'Edit Extinguishing Specs'}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ظرفیت مخزن آب:' : 'Water Tank Capacity:'}</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800/60">
                  {vehicle.waterTankCapacity ? `${vehicle.waterTankCapacity.toLocaleString()} L` : (isFa ? 'فاقد مخزن آب' : 'N/A')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ظرفیت مخزن فوم:' : 'Foam Tank Capacity:'}</span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/60">
                  {vehicle.foamTankCapacity ? `${vehicle.foamTankCapacity.toLocaleString()} L` : (isFa ? 'فاقد مخزن فوم' : 'N/A')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'نوع فوم مصرفی:' : 'Foam Type:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.foamType || 'AFFF 3%'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ظرفیت و فشار پمپ:' : 'Pump Rating:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {vehicle.pumpCapacityPressure || vehicle.pumpModel || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'نوع سوخت مصرفی:' : 'Fuel Type:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.fuelType || (isFa ? 'دیزل (گازوئیل)' : 'Diesel')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'کیلومتر کارکرد فعلی:' : 'Mileage:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {(vehicle.mileage || vehicle.currentMileage)?.toLocaleString() || '0'} km
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">
                  {isFa ? (vehicle.ladderHeight ? 'طول نردبان / بوم:' : 'مدل مانیتور سقفی:') : (vehicle.ladderHeight ? 'Ladder Height:' : 'Roof Monitor:')}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.ladderHeight ? `${vehicle.ladderHeight} m` : (vehicle.monitorModel || (isFa ? 'مانیتور استاندارد' : 'Standard Monitor'))}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Location, Responsibility & Operational Status */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {isFa ? 'محل استقرار، مسئولیت و وضعیت عملیاتی' : 'Deployment & Operational Status'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isFa ? 'ایستگاه، آشیانه، مسئول خودرو و چرخه‌های بازرسی' : 'Station, bay, driver & inspection timeline'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => onEdit(vehicle)} 
                className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer" 
                title={isFa ? 'ویرایش وضعیت و استقرار' : 'Edit Deployment'}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ایستگاه آتش‌نشانی:' : 'Fire Station:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {vehicle.fireStation || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'محل استقرار / آشیانه:' : 'Bay / Location:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.location || (isFa ? 'آشیانه اصلی' : 'Main Bay')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'مسئول خودرو / راننده:' : 'Responsible / Driver:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {vehicle.responsiblePerson || vehicle.assignedDriver || (isFa ? 'راننده شیفت' : 'Shift Driver')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'وضعیت عملیاتی خودرو:' : 'Vehicle Status:'}</span>
                <div>
                  {getStatusBadge(vehicle.status)}
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'تاریخ ورود به سرویس:' : 'Commission Date:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.commissionDate || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'تاریخ آخرین سرویس PM:' : 'Last PM Service:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.lastServiceDate || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'تاریخ آخرین بازرسی:' : 'Last Inspection:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {vehicle.lastInspectionDate || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'سررسید بازرسی بعدی:' : 'Next Due Date:'}</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/60">
                  {vehicle.nextInspectionDue || (isFa ? 'طبق تقویم دوره‌ای' : 'Scheduled')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'انطباق با استاندارد NFPA:' : 'NFPA Standard:'}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  {vehicle.standardsCompliance?.standardRef || 'NFPA 1901 / 1911'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Inspection History */}
      {activeTab === 'inspections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>{isFa ? 'سوابق بازرسی‌های ادواری و روزانه خودرو' : 'Vehicle Inspection History'}</span>
            </h3>
            <button
              onClick={() => onStartInspection(vehicle)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'ثبت بازرسی جدید' : 'New Inspection'}</span>
            </button>
          </div>

          {(!vehicle.inspectionHistory || vehicle.inspectionHistory.length === 0) ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">
                {isFa ? 'هنوز سابقه بازرسی برای این خودرو ثبت نشده است.' : 'No inspection records found.'}
              </p>
              <button
                onClick={() => onStartInspection(vehicle)}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'اجرای اولین بازرسی' : 'Run First Inspection'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicle.inspectionHistory.map((insp) => (
                <div
                  key={insp.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                        {insp.inspectionType}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {insp.date}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {insp.shift}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        insp.overallState === 'تأیید آماده‌به‌کار کامل'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {insp.overallState}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
                      <span>{isFa ? 'بازرس:' : 'Inspector:'} <strong>{insp.inspectorName}</strong></span>
                      {insp.mileageAtInspection ? (
                        <span>{isFa ? 'کیلومتر:' : 'Mileage:'} <strong>{insp.mileageAtInspection.toLocaleString()} km</strong></span>
                      ) : null}
                      {insp.notes && (
                        <span className="text-slate-400 truncate max-w-sm">{insp.notes}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-center px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">{isFa ? 'انطباق' : 'Score'}</span>
                      <span className="font-mono font-black text-sm text-red-600 dark:text-red-400">
                        {insp.complianceScore}%
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedInspectionForView(insp)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      {isFa ? 'ریز چک‌لیست' : 'Details'}
                    </button>

                    <button
                      onClick={() => setEditingInspection(insp)}
                      className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      title={isFa ? 'ویرایش بازرسی' : 'Edit Inspection'}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeletingInspection(insp)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                      title={isFa ? 'حذف بازرسی' : 'Delete Inspection'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Defects & CAPA */}
      {activeTab === 'defects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>{isFa ? 'نواقص، عیوب و اقدامات اصلاحی (CAPA) خودرو' : 'Defects & Corrective Actions'}</span>
            </h3>
            <button
              onClick={() => setShowAddDefectModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'ثبت نقص جدید' : 'New Defect'}</span>
            </button>
          </div>

          {(!vehicle.defects || vehicle.defects.length === 0) ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">
                {isFa ? 'هیچ نقص یا مغایرت فعالی برای این خودرو ثبت نشده است.' : 'No active defects logged for this vehicle.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicle.defects.map(def => (
                <div
                  key={def.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                        {def.code || def.id}
                      </span>
                      <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                        {def.itemTitle}
                      </h4>
                      <span className="text-xs text-slate-400 font-medium">({def.category})</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        def.severity === 'بحرانی (Critical)'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : def.severity === 'متوسط (Major)'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {def.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        def.status === 'باز'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : def.status === 'در حال اقدام'
                          ? 'bg-sky-50 text-sky-600 border border-sky-200'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}>
                        {def.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenCapa(def)}
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        {isFa ? 'مدیریت CAPA' : 'Manage CAPA'}
                      </button>
                      <button
                        onClick={() => setEditingDefect(def)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title={isFa ? 'ویرایش نقص' : 'Edit Defect'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingDefect(def)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                        title={isFa ? 'حذف نقص' : 'Delete Defect'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {def.description}
                  </p>

                  {/* CAPA Box */}
                  {(def.rootCauseAnalysis || def.capaPlan || def.responsiblePerson) && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                      <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                        <span>{isFa ? 'اقدام اصلاحی و برنامه پیشگیرانه (CAPA):' : 'CAPA Plan:'}</span>
                      </div>
                      {def.rootCauseAnalysis && (
                        <p className="text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-700 dark:text-slate-200">{isFa ? 'علت ریشه‌ای:' : 'Root Cause:'}</strong> {def.rootCauseAnalysis}
                        </p>
                      )}
                      {def.capaPlan && (
                        <p className="text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-700 dark:text-slate-200">{isFa ? 'برنامه اقدام:' : 'Action Plan:'}</strong> {def.capaPlan}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-slate-500 text-[11px] pt-1">
                        {def.responsiblePerson && (
                          <span>{isFa ? 'مسئول:' : 'Responsible:'} <strong>{def.responsiblePerson}</strong></span>
                        )}
                        {def.dueDate && (
                          <span>{isFa ? 'مهلت اقدام:' : 'Due Date:'} <strong className="font-mono">{def.dueDate}</strong></span>
                        )}
                        {def.hseSignOff && (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {isFa ? 'تأیید HSE انجام شد' : 'HSE Approved'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Maintenance PM/CM */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-600" />
              <span>{isFa ? 'سوابق نگهداری و تعمیرات دوره‌ای و اضطراری' : 'Maintenance & PM/CM History'}</span>
            </h3>
            <button
              onClick={() => setShowAddMaintModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'ثبت گزارش تعمیرات / PM' : 'Add Maintenance'}</span>
            </button>
          </div>

          {(!vehicle.maintenanceHistory || vehicle.maintenanceHistory.length === 0) ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Wrench className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">
                {isFa ? 'هیچ سابقه‌ای برای تعمیرات ثبت نشده است.' : 'No maintenance records found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicle.maintenanceHistory.map(maint => (
                <div
                  key={maint.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                        {maint.repairType}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {maint.date}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        maint.status === 'تکمیل شده'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {maint.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {maint.failureDescription}
                    </p>

                    {maint.replacedParts && maint.replacedParts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-400 font-bold">{isFa ? 'قطعات مصرفی:' : 'Parts:'}</span>
                        {maint.replacedParts.map((part, pidx) => (
                          <span key={pidx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-mono">
                            {part}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono pt-1">
                      {maint.mechanicName && (
                        <span>{isFa ? 'مجری:' : 'Mechanic:'} <strong>{maint.mechanicName}</strong></span>
                      )}
                      {maint.downtimeDurationHours ? (
                        <span>{isFa ? 'مدت توقف:' : 'Downtime:'} <strong>{maint.downtimeDurationHours} h</strong></span>
                      ) : null}
                      {maint.cost ? (
                        <span>{isFa ? 'هزینه:' : 'Cost:'} <strong>{maint.cost.toLocaleString()} IRR</strong></span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingMaintenance(maint)}
                      className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      title={isFa ? 'ویرایش گزارش' : 'Edit Log'}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingMaintenance(maint)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                      title={isFa ? 'حذف گزارش' : 'Delete Log'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Certificates & Tests */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              <span>{isFa ? 'گواهینامه‌های استاندارد، تست هیدرواستاتیک و بازرسی‌های ویژه' : 'Standard & Test Certificates'}</span>
            </h3>
            <button
              onClick={() => setShowAddCertModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'ثبت گواهی / تست جدید' : 'New Certificate'}</span>
            </button>
          </div>

          {(!vehicle.testCertificates || vehicle.testCertificates.length === 0) ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Award className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">
                {isFa ? 'هیچ گواهینامه یا تستی برای این خودرو ثبت نشده است.' : 'No certificates recorded.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicle.testCertificates.map(cert => (
                <div
                  key={cert.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-xl">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                          {cert.testType}
                        </h4>
                        <span className="text-xs text-slate-400 font-bold">{cert.equipment}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        cert.result.includes('Pass') || cert.result.includes('مطلوب')
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200'
                      }`}>
                        {cert.result}
                      </span>
                      <button
                        onClick={() => setEditingCertificate(cert)}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={isFa ? 'ویرایش' : 'Edit'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingCertificate(cert)}
                        className="p-1 text-rose-400 hover:text-rose-600 cursor-pointer"
                        title={isFa ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {cert.testValue && (
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400">{isFa ? 'مقدار ثبت‌شده:' : 'Test Value:'}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cert.testValue}</span>
                      </div>
                    )}
                    {cert.allowedLimit && (
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400">{isFa ? 'حد مجاز استاندارد:' : 'Standard Limit:'}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cert.allowedLimit}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">{isFa ? 'شماره گواهینامه:' : 'Cert No:'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cert.certificateNumber}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">{isFa ? 'تاریخ صدور / انقضا:' : 'Issued / Expiry:'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cert.testDate} تا {cert.expiryDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Documents, Technical Manuals, Insurance & Ownership */}
      {activeTab === 'docs' && (
        <div className="space-y-5">
          {/* Header & Upload Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600" />
                <span>{isFa ? 'پرونده اسناد، مدارک، دفترچه‌های فنی، بیمه‌نامه‌ها و اسناد مالکیت' : 'Documents, Manuals & Insurance'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFa ? 'پشتیبانی کامل از بارگذاری و مشاهده فایل‌های PDF ، PNG و JPG با امکان ویرایش و حذف اختصاصی' : 'Upload and manage PDF, PNG, and JPG documents'}
              </p>
            </div>

            <button
              onClick={() => setShowAddDocModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition-transform hover:scale-105 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'بارگذاری مدرک / سند جدید' : 'Upload Document'}</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <button
                onClick={() => setDocCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  docCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {isFa ? 'همه مدارک' : 'All'} ({allDocs.length})
              </button>

              <button
                onClick={() => setDocCategoryFilter('manual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  docCategoryFilter === 'manual'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {isFa ? 'دفترچه و کاتالوگ فنی' : 'Manuals'}
              </button>

              <button
                onClick={() => setDocCategoryFilter('insurance')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  docCategoryFilter === 'insurance'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {isFa ? 'بیمه‌نامه و گواهی' : 'Insurance'}
              </button>

              <button
                onClick={() => setDocCategoryFilter('ownership')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  docCategoryFilter === 'ownership'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {isFa ? 'اسناد مالکیت و شناسنامه' : 'Ownership'}
              </button>

              <button
                onClick={() => setDocCategoryFilter('license')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  docCategoryFilter === 'license'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {isFa ? 'مجوزها و معاینه فنی' : 'Licenses'}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isFa ? 'جستجو در عنوان، شماره سند...' : 'Search documents...'}
                value={docSearchQuery}
                onChange={e => setDocSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Document Grid */}
          {filteredDocs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-3xl flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                {isFa ? 'مدرکی در این دسته‌بندی یافت نشد' : 'No documents found'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isFa ? 'می‌توانید مدارک دفترچه فنی، گواهی بیمه، اسناد مالکیت و مجوزهای خودرو را با فرمت‌های PDF، PNG و JPG بارگذاری کنید.' : 'Upload vehicle manuals, insurance policies, or title documents in PDF, PNG, or JPG formats.'}
              </p>
              <button
                onClick={() => setShowAddDocModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? 'بارگذاری مدرک' : 'Upload Now'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map(doc => {
                const isPdf = doc.fileType === 'PDF';
                const isImg = doc.fileType === 'PNG' || doc.fileType === 'JPG' || doc.fileType === 'JPEG';

                return (
                  <div
                    key={doc.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-800/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black font-mono tracking-wider ${
                          isPdf 
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                        }`}>
                          {doc.fileType}
                        </span>

                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
                          {doc.category === 'manual' ? (isFa ? 'دفترچه فنی' : 'Manual') :
                           doc.category === 'insurance' ? (isFa ? 'بیمه‌نامه' : 'Insurance') :
                           doc.category === 'ownership' ? (isFa ? 'سند مالکیت' : 'Ownership') :
                           doc.category === 'license' ? (isFa ? 'معاینه/مجوز' : 'License') :
                           doc.category === 'technical' ? (isFa ? 'نقشه فنی' : 'Technical') : (isFa ? 'سند' : 'Doc')}
                        </span>
                      </div>

                      {/* Title & Preview / Icon */}
                      <div className="flex items-start gap-3">
                        <div 
                          onClick={() => setViewingDoc(doc)}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border transition-transform group-hover:scale-105 ${
                            isPdf
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-600 border-red-200 dark:border-red-900/50'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 border-blue-200 dark:border-blue-900/50'
                          }`}
                        >
                          {doc.fileData && isImg ? (
                            <img src={doc.fileData} alt={doc.title} className="w-full h-full object-cover" />
                          ) : isPdf ? (
                            <FileText className="w-6 h-6" />
                          ) : (
                            <ImageIcon className="w-6 h-6" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 
                            onClick={() => setViewingDoc(doc)}
                            className="font-black text-sm text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-red-600 transition-colors"
                            title={doc.title}
                          >
                            {doc.title}
                          </h4>
                          {doc.docNumber && (
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {isFa ? 'شماره:' : 'No:'} {doc.docNumber}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between items-center">
                          <span>{isFa ? 'تاریخ بارگذاری:' : 'Uploaded:'}</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{doc.uploadDate}</span>
                        </div>
                        {doc.expiryDate && (
                          <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 font-bold">
                            <span>{isFa ? 'سررسید اعتبار:' : 'Expires:'}</span>
                            <span className="font-mono">{doc.expiryDate}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span>{isFa ? 'حجم فایل:' : 'Size:'}</span>
                          <span className="font-mono">{doc.size || '1.2 MB'}</span>
                        </div>
                      </div>

                      {doc.notes && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                          {doc.notes}
                        </p>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-850/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingDoc(doc)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isFa ? 'مشاهده' : 'View'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                          title={isFa ? 'ویرایش مشخصات سند' : 'Edit Document'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingDoc(doc)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                          title={isFa ? 'حذف سند' : 'Delete Document'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- ALL MODALS INTEGRATION --- */}

      {/* Modal: Document Add / Upload */}
      {showAddDocModal && (
        <VehicleDocumentModal
          isOpen={showAddDocModal}
          language={language}
          vehicleCode={vehicle.code}
          document={null}
          onSave={(newDoc) => {
            if (onAddDocument) {
              onAddDocument(vehicle.id, newDoc);
            }
          }}
          onClose={() => setShowAddDocModal(false)}
        />
      )}

      {/* Modal: Document Edit */}
      {editingDoc && (
        <VehicleDocumentModal
          isOpen={!!editingDoc}
          language={language}
          vehicleCode={vehicle.code}
          document={editingDoc}
          onSave={(updatedDoc) => {
            if (onUpdateDocument) {
              onUpdateDocument(vehicle.id, editingDoc.id, updatedDoc);
            }
            setEditingDoc(null);
          }}
          onClose={() => setEditingDoc(null)}
        />
      )}

      {/* Modal: Document Viewer / Preview */}
      {viewingDoc && (
        <VehicleDocumentViewerModal
          isOpen={!!viewingDoc}
          language={language}
          vehicleCode={vehicle.code}
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* Modal: Document Confirm Delete */}
      {deletingDoc && (
        <ConfirmDeleteModal
          isOpen={!!deletingDoc}
          language={language}
          title={isFa ? 'تایید حذف مدرک پیوست' : 'Confirm Document Deletion'}
          itemName={`${deletingDoc.title} (${deletingDoc.fileType})`}
          itemType={isFa ? 'سند / مدرک فنی خودرو' : 'Vehicle Document'}
          message={isFa ? `آیا از حذف کامل فایل "${deletingDoc.title}" از پرونده جامع خودرو ${vehicle.code} اطمینان دارید؟` : undefined}
          onConfirm={() => {
            if (onDeleteDocument && deletingDoc) {
              onDeleteDocument(vehicle.id, deletingDoc.id);
            }
            setDeletingDoc(null);
          }}
          onClose={() => setDeletingDoc(null)}
        />
      )}

      {/* Modal: Inspection Details Viewer */}
      {selectedInspectionForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn my-6">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-red-600" />
                  <span>{isFa ? `ریز چک‌لیست بازرسی ${selectedInspectionForView.inspectionType}` : 'Checklist Details'}</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {isFa ? `تاریخ: ${selectedInspectionForView.date} • نمره انطباق: ${selectedInspectionForView.complianceScore}%` : `${selectedInspectionForView.date} • ${selectedInspectionForView.complianceScore}%`}
                </p>
              </div>
              <button
                onClick={() => setSelectedInspectionForView(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2 text-xs">
              {selectedInspectionForView.items.map((it, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{it.itemTitle}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">{it.category} {it.description && `• ${it.description}`}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl font-bold text-[11px] shrink-0 ${
                    it.result === 'مطابق'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {it.result}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-5 pt-0 space-y-2 text-xs">
              {/* 3-Tier Signatures Summary */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-850">
                <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 mb-2">
                  {isFa ? 'تأییدات و امضاهای سازمانی (۳ سطح یکپارچه):' : 'Official 3-Tier Signatures:'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px]">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">{isFa ? '۱. کارشناس بازرسی:' : '1. Inspector:'}</span>
                    <strong className="text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                      {selectedInspectionForView.inspectorName || selectedInspectionForView.inspector || '-'}
                    </strong>
                    {selectedInspectionForView.inspectorCode && (
                      <span className="text-[9px] text-slate-400 font-mono">کد: {selectedInspectionForView.inspectorCode}</span>
                    )}
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">{isFa ? '۲. سرپرست ایستگاه:' : '2. Station Lead:'}</span>
                    <strong className="text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                      {selectedInspectionForView.supervisorName || '-'}
                    </strong>
                    {selectedInspectionForView.supervisorCode && (
                      <span className="text-[9px] text-slate-400 font-mono">کد: {selectedInspectionForView.supervisorCode}</span>
                    )}
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block">{isFa ? '۳. رئیس مرکز HSE:' : '3. Head of HSE:'}</span>
                    <strong className="text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                      {selectedInspectionForView.hseManagerName || '-'}
                    </strong>
                    {selectedInspectionForView.hseManagerCode && (
                      <span className="text-[9px] text-slate-400 font-mono">کد: {selectedInspectionForView.hseManagerCode}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inspection Edit */}
      {editingInspection && (
        <VehicleInspectionEditModal
          isOpen={!!editingInspection}
          language={language}
          vehicleCode={vehicle.code}
          inspection={editingInspection}
          onSave={(data) => {
            if (onUpdateInspection && editingInspection) {
              onUpdateInspection(vehicle.id, editingInspection.id, data);
            }
            setEditingInspection(null);
          }}
          onClose={() => setEditingInspection(null)}
        />
      )}

      {/* Modal: Inspection Confirm Delete */}
      {deletingInspection && (
        <ConfirmDeleteModal
          isOpen={!!deletingInspection}
          language={language}
          title={isFa ? 'تایید حذف رکورد بازرسی' : 'Confirm Inspection Deletion'}
          itemName={`${deletingInspection.inspectionType} (${deletingInspection.date})`}
          itemType={isFa ? 'رکورد بازرسی ادواری' : 'Inspection Record'}
          onConfirm={() => {
            if (onDeleteInspection && deletingInspection) {
              onDeleteInspection(vehicle.id, deletingInspection.id);
            }
            setDeletingInspection(null);
          }}
          onClose={() => setDeletingInspection(null)}
        />
      )}

      {/* Modal: Defect Add */}
      {showAddDefectModal && (
        <VehicleDefectModal
          isOpen={showAddDefectModal}
          language={language}
          vehicleCode={vehicle.code}
          defect={null}
          onSave={(data) => {
            if (onAddDefect) {
              onAddDefect(vehicle.id, data);
            }
          }}
          onClose={() => setShowAddDefectModal(false)}
        />
      )}

      {/* Modal: Defect Edit */}
      {editingDefect && (
        <VehicleDefectModal
          isOpen={!!editingDefect}
          language={language}
          vehicleCode={vehicle.code}
          defect={editingDefect}
          onSave={(data) => {
            if (onUpdateDefect && editingDefect) {
              onUpdateDefect(vehicle.id, editingDefect.id, data);
            }
            setEditingDefect(null);
          }}
          onClose={() => setEditingDefect(null)}
        />
      )}

      {/* Modal: Defect Confirm Delete */}
      {deletingDefect && (
        <ConfirmDeleteModal
          isOpen={!!deletingDefect}
          language={language}
          title={isFa ? 'تایید حذف نقص فنی' : 'Confirm Defect Deletion'}
          itemName={`${deletingDefect.itemTitle} (${deletingDefect.code || deletingDefect.id})`}
          itemType={isFa ? 'رکورد نقص فنی' : 'Defect Record'}
          onConfirm={() => {
            if (onDeleteDefect && deletingDefect) {
              onDeleteDefect(vehicle.id, deletingDefect.id);
            }
            setDeletingDefect(null);
          }}
          onClose={() => setDeletingDefect(null)}
        />
      )}

      {/* Modal: CAPA Action Form */}
      {selectedDefectForCapa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn my-6">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>{isFa ? `ثبت اقدام اصلاحی و پیشگیرانه (CAPA) برای ${selectedDefectForCapa.code || selectedDefectForCapa.id}` : 'CAPA Management'}</span>
              </h3>
              <button onClick={() => setSelectedDefectForCapa(null)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900/50">
                <span className="text-red-700 dark:text-red-300 font-bold block">{isFa ? 'شرح نقص / مغایرت:' : 'Defect:'}</span>
                <p className="text-slate-800 dark:text-slate-100 font-bold mt-1">{selectedDefectForCapa.description}</p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  {isFa ? 'تحلیل علت ریشه‌ای (Root Cause Analysis):' : 'Root Cause:'}
                </label>
                <textarea
                  rows={2}
                  value={capaRootCause}
                  onChange={e => setCapaRootCause(e.target.value)}
                  placeholder={isFa ? 'علت وقوع نقص بر اثر فرسودگی، خطای اپراتوری، کیفیت نامناسب قطعه و...' : 'Root cause...'}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  {isFa ? 'اقدام فوری و کنترلی (Immediate Action):' : 'Immediate Action:'}
                </label>
                <input
                  type="text"
                  value={capaImmediateAction}
                  onChange={e => setCapaImmediateAction(e.target.value)}
                  placeholder={isFa ? 'اقدام سریع جهت جلوگیری از تشدید خطر' : 'Immediate action'}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  {isFa ? 'برنامه اقدام اصلاحی ریشه‌ای (Corrective Action Plan):' : 'Action Plan:'}
                </label>
                <textarea
                  rows={2}
                  value={capaPlan}
                  onChange={e => setCapaPlan(e.target.value)}
                  placeholder={isFa ? 'مراحل تعمیر، تعویض قطعه، کالیبراسیون و اصلاح فرآیند' : 'CAPA plan...'}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">{isFa ? 'مسئول پیگیری:' : 'Responsible:'}</label>
                  <input
                    type="text"
                    value={capaResponsible}
                    onChange={e => setCapaResponsible(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">{isFa ? 'مهلت اقدام:' : 'Due Date:'}</label>
                  <input
                    type="text"
                    value={capaDueDate}
                    onChange={e => setCapaDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capaHseApproval}
                    onChange={e => setCapaHseApproval(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600"
                  />
                  <span>{isFa ? 'تأییدیه نهایی واحد ایمنی و آتش‌نشانی (HSE Sign-off)' : 'HSE Approved'}</span>
                </label>

                <select
                  value={capaStatus}
                  onChange={e => setCapaStatus(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold outline-none text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="باز">{isFa ? 'وضعیت: باز' : 'Open'}</option>
                  <option value="در حال اقدام">{isFa ? 'وضعیت: در حال اقدام' : 'In Progress'}</option>
                  <option value="بسته شده">{isFa ? 'وضعیت: بسته شده' : 'Closed'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDefectForCapa(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCapa}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow-xs transition-all cursor-pointer"
                >
                  {isFa ? 'ذخیره اقدام اصلاحی' : 'Save CAPA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Maintenance Add */}
      {showAddMaintModal && (
        <ResolvedVehicleMaintenanceModal
          isOpen={showAddMaintModal}
          language={language}
          vehicleCode={vehicle.code}
          maintenance={null}
          onSave={(data) => {
            if (onAddMaintenance) {
              onAddMaintenance(vehicle.id, data);
            }
          }}
          onClose={() => setShowAddMaintModal(false)}
        />
      )}

      {/* Modal: Maintenance Edit */}
      {editingMaintenance && (
        <ResolvedVehicleMaintenanceModal
          isOpen={!!editingMaintenance}
          language={language}
          vehicleCode={vehicle.code}
          maintenance={editingMaintenance}
          onSave={(data) => {
            if (onUpdateMaintenance && editingMaintenance) {
              onUpdateMaintenance(vehicle.id, editingMaintenance.id, data);
            }
            setEditingMaintenance(null);
          }}
          onClose={() => setEditingMaintenance(null)}
        />
      )}

      {/* Modal: Maintenance Confirm Delete */}
      {deletingMaintenance && (
        <ConfirmDeleteModal
          isOpen={!!deletingMaintenance}
          language={language}
          title={isFa ? 'تایید حذف گزارش تعمیرات' : 'Confirm Maintenance Deletion'}
          itemName={`${deletingMaintenance.repairType} (${deletingMaintenance.date})`}
          itemType={isFa ? 'رکورد تعمیرات و سرویس' : 'Maintenance Record'}
          onConfirm={() => {
            if (onDeleteMaintenance && deletingMaintenance) {
              onDeleteMaintenance(vehicle.id, deletingMaintenance.id);
            }
            setDeletingMaintenance(null);
          }}
          onClose={() => setDeletingMaintenance(null)}
        />
      )}

      {/* Modal: Certificate Add */}
      {showAddCertModal && (
        <VehicleCertificateModal
          isOpen={showAddCertModal}
          language={language}
          vehicleCode={vehicle.code}
          certificate={null}
          onSave={(data) => {
            if (onAddCertificate) {
              onAddCertificate(vehicle.id, data);
            }
          }}
          onClose={() => setShowAddCertModal(false)}
        />
      )}

      {/* Modal: Certificate Edit */}
      {editingCertificate && (
        <VehicleCertificateModal
          isOpen={!!editingCertificate}
          language={language}
          vehicleCode={vehicle.code}
          certificate={editingCertificate}
          onSave={(data) => {
            if (onUpdateCertificate && editingCertificate) {
              onUpdateCertificate(vehicle.id, editingCertificate.id, data);
            }
            setEditingCertificate(null);
          }}
          onClose={() => setEditingCertificate(null)}
        />
      )}

      {/* Modal: Certificate Confirm Delete */}
      {deletingCertificate && (
        <ConfirmDeleteModal
          isOpen={!!deletingCertificate}
          language={language}
          title={isFa ? 'تایید حذف گواهینامه / تست' : 'Confirm Certificate Deletion'}
          itemName={`${deletingCertificate.testType} - ${deletingCertificate.certificateNumber}`}
          itemType={isFa ? 'گواهینامه فنی و تست' : 'Certificate Record'}
          onConfirm={() => {
            if (onDeleteCertificate && deletingCertificate) {
              onDeleteCertificate(vehicle.id, deletingCertificate.id);
            }
            setDeletingCertificate(null);
          }}
          onClose={() => setDeletingCertificate(null)}
        />
      )}

      {/* Modal: Vehicle QR Code */}
      <VehicleQrModal
        language={language}
        vehicle={vehicle}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />

      {/* Modal: Vehicle Main Delete */}
      {showDeleteVehicleModal && (
        <ConfirmDeleteModal
          isOpen={showDeleteVehicleModal}
          language={language}
          title={isFa ? 'تایید حذف کامل خودرو از ناوگان' : 'Confirm Vehicle Deletion'}
          itemName={`${vehicle.code} - ${vehicle.brandModel}`}
          itemType={isFa ? 'خودروی آتش‌نشانی' : 'Fire Vehicle'}
          message={isFa ? `آیا از حذف کامل خودروی کد ${vehicle.code} به همراه تمامی پرونده‌ها، سوابق بازرسی و اسناد آن اطمینان دارید؟` : undefined}
          onConfirm={() => {
            onDelete(vehicle.id);
            setShowDeleteVehicleModal(false);
            onBack();
          }}
          onClose={() => setShowDeleteVehicleModal(false)}
        />
      )}
    </div>
  );
}

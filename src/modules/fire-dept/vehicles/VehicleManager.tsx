import React, { useState } from 'react';
import { 
  Truck, LayoutDashboard, ShieldCheck, ShieldAlert, 
  Award, List, Plus, Activity
} from 'lucide-react';
import { useVehicleData } from './hooks/useVehicleData';
import { FireVehicle, VehicleInspectionRecord, VehicleDefectRecord } from './types/vehicleTypes';
import VehicleFleetDashboard from './components/VehicleFleetDashboard';
import VehicleListTable from './components/VehicleListTable';
import VehicleProfileDetail from './components/VehicleProfileDetail';
import VehicleInspectionRunner from './components/VehicleInspectionRunner';
import VehicleDefectsView from './components/VehicleDefectsView';
import VehicleStandardsView from './components/VehicleStandardsView';
import VehicleModal from './components/VehicleModal';

interface Props {
  language: 'fa' | 'en';
}

type TabType = 'dashboard' | 'vehicles' | 'inspect' | 'defects' | 'standards' | 'profile';

export default function VehicleManager({ language }: Props) {
  const isFa = language === 'fa';

  const {
    vehicles,
    standards,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addInspection,
    updateInspection,
    deleteInspection,
    updateDefect,
    deleteDefect,
    addDefectManually,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
    addCertificate,
    updateCertificate,
    deleteCertificate,
    addDocument,
    updateDocument,
    deleteDocument,
    addStandard,
    updateStandard,
    deleteStandard
  } = useVehicleData();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleForInspection, setVehicleForInspection] = useState<FireVehicle | undefined>(undefined);

  // Derive active vehicle dynamically so changes reflect immediately
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;

  // Vehicle Create / Edit Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<FireVehicle | null>(null);

  // Handlers
  const handleSelectVehicle = (vehicle: FireVehicle) => {
    setSelectedVehicleId(vehicle.id);
    setActiveTab('profile');
  };

  const handleStartInspection = (vehicle?: FireVehicle) => {
    setVehicleForInspection(vehicle || (vehicles.length > 0 ? vehicles[0] : undefined));
    setActiveTab('inspect');
  };

  const handleSaveInspection = (inspection: VehicleInspectionRecord, autoDefects: VehicleDefectRecord[]) => {
    addInspection(inspection, autoDefects);
    setSelectedVehicleId(inspection.vehicleId);
    setActiveTab('profile');
  };

  const handleOpenAddVehicle = () => {
    setEditingVehicle(null);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (vehicle: FireVehicle) => {
    setEditingVehicle(vehicle);
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicleModal = (data: any) => {
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, data);
    } else {
      const created = addVehicle(data);
      setSelectedVehicleId(created.id);
    }
  };

  // Compute Defect counts
  const totalOpenDefects = vehicles.reduce((acc, v) => {
    return acc + v.defects.filter(d => d.status === 'باز' || d.status === 'در حال اقدام').length;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Bar */}
      <div className="bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isFa ? 'داشبورد ناوگان' : 'Fleet Dashboard'}</span>
          </button>

          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'vehicles' || activeTab === 'profile'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{isFa ? 'فهرست خودروها' : 'Vehicles Directory'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'vehicles' || activeTab === 'profile' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {vehicles.length}
            </span>
          </button>

          <button
            onClick={() => handleStartInspection()}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'inspect'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isFa ? 'ثبت بازرسی چک‌لیست' : 'Run Inspection'}</span>
          </button>

          <button
            onClick={() => setActiveTab('defects')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'defects'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{isFa ? 'مغایرت‌ها و CAPA' : 'Defects & CAPA'}</span>
            {totalOpenDefects > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-mono font-bold">
                {totalOpenDefects}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('standards')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'standards'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{isFa ? 'استانداردها (NFPA/EN)' : 'Standards'}</span>
            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-full text-[10px] font-mono font-bold">
              {standards.length}
            </span>
          </button>
        </div>

        <button
          onClick={handleOpenAddVehicle}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isFa ? 'خودرو جدید' : 'New Vehicle'}</span>
        </button>
      </div>

      {/* View Switcher */}
      {activeTab === 'dashboard' && (
        <VehicleFleetDashboard
          language={language}
          vehicles={vehicles}
          onSelectVehicle={handleSelectVehicle}
          onStartInspection={handleStartInspection}
          onNavigateTab={tab => setActiveTab(tab as TabType)}
        />
      )}

      {activeTab === 'vehicles' && (
        <VehicleListTable
          language={language}
          vehicles={vehicles}
          onSelectVehicle={handleSelectVehicle}
          onAddVehicle={handleOpenAddVehicle}
          onEditVehicle={handleOpenEditVehicle}
          onDeleteVehicle={deleteVehicle}
          onStartInspection={handleStartInspection}
        />
      )}

      {activeTab === 'profile' && selectedVehicle && (
        <VehicleProfileDetail
          language={language}
          vehicle={selectedVehicle}
          onBack={() => setActiveTab('vehicles')}
          onEdit={handleOpenEditVehicle}
          onDelete={deleteVehicle}
          onStartInspection={handleStartInspection}
          onUpdateInspection={updateInspection}
          onDeleteInspection={deleteInspection}
          onAddDefect={addDefectManually}
          onUpdateDefect={updateDefect}
          onDeleteDefect={deleteDefect}
          onAddMaintenance={addMaintenance}
          onUpdateMaintenance={updateMaintenance}
          onDeleteMaintenance={deleteMaintenance}
          onAddCertificate={addCertificate}
          onUpdateCertificate={updateCertificate}
          onDeleteCertificate={deleteCertificate}
          onAddDocument={addDocument}
          onUpdateDocument={updateDocument}
          onDeleteDocument={deleteDocument}
        />
      )}

      {activeTab === 'inspect' && (
        <VehicleInspectionRunner
          language={language}
          vehicles={vehicles}
          initialVehicle={vehicleForInspection}
          onSaveInspection={handleSaveInspection}
          onCancel={() => setActiveTab('dashboard')}
        />
      )}

      {activeTab === 'defects' && (
        <VehicleDefectsView
          language={language}
          vehicles={vehicles}
          onSelectVehicle={handleSelectVehicle}
          onUpdateDefect={updateDefect}
        />
      )}

      {activeTab === 'standards' && (
        <VehicleStandardsView
          language={language}
          standards={standards}
          onAddStandard={addStandard}
          onUpdateStandard={updateStandard}
          onDeleteStandard={deleteStandard}
        />
      )}

      {/* Vehicle Add / Edit Modal */}
      <VehicleModal
        language={language}
        vehicle={editingVehicle}
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={handleSaveVehicleModal}
      />
    </div>
  );
}

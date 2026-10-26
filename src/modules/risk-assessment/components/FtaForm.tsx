import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Save, 
  Printer, 
  ArrowRight, 
  Info,
  GitFork,
  Network
} from 'lucide-react';
import { FtaAssessment, FtaEventNode } from '../types';
import { getRiskLevelColor } from '../services/riskAssessmentService';
import RiskPersonnelSignatures from './RiskPersonnelSignatures';
import { printService } from '../../../services/printService';
import { getUnits } from '../../../utils/orgHelper';

interface FtaFormProps {
  initialData?: FtaAssessment | null;
  onSave: (assessment: FtaAssessment) => void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

export default function FtaForm({ initialData, onSave, onCancel, isFa, currentUser }: FtaFormProps) {
  const [formData, setFormData] = useState<FtaAssessment>(() => {
    if (initialData) return initialData;
    const nowJalali = '1404/06/05';
    return {
      id: `fta-${Date.now()}`,
      code: `FTA-1404-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: '',
      unit: '',
      areaLocation: '',
      assessorName: '',
      assessmentDate: nowJalali,
      teamMembers: [],
      status: 'APPROVED',
      method: 'FTA',
      overallRiskLevel: 'CRITICAL',
      topEventTitle: '',
      topEventProbability: 0.002,
      nodes: [
        {
          id: 'node-top',
          parentId: null,
          type: 'TOP_EVENT',
          gateType: 'OR',
          description: '',
          code: 'TOP',
          probability: 0.002
        },
        {
          id: `node-${Date.now()}-1`,
          parentId: 'node-top',
          type: 'INTERMEDIATE_EVENT',
          gateType: 'AND',
          description: '',
          code: 'G1',
          probability: 0.01
        },
        {
          id: `node-${Date.now()}-2`,
          parentId: `node-${Date.now()}-1`,
          type: 'BASIC_EVENT',
          description: '',
          code: 'E1',
          probability: 0.05
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  const handleAddNode = (parentId: string, type: FtaEventNode['type']) => {
    const newNode: FtaEventNode = {
      id: `node-${Date.now()}-${formData.nodes.length + 1}`,
      parentId: parentId || 'node-top',
      type,
      gateType: type === 'BASIC_EVENT' ? null : 'AND',
      description: '',
      code: type === 'BASIC_EVENT' ? `E${formData.nodes.length}` : `G${formData.nodes.length}`,
      probability: type === 'BASIC_EVENT' ? 0.01 : 0.001
    };
    setFormData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  };

  const handleRemoveNode = (nodeId: string) => {
    if (nodeId === 'node-top') return;
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId && n.parentId !== nodeId)
    }));
  };

  const handleNodeChange = (nodeId: string, field: keyof FtaEventNode, value: any) => {
    setFormData(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        if (node.id !== nodeId) return node;
        return { ...node, [field]: value };
      })
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.topEventTitle.trim()) {
      alert(isFa ? 'لطفاً عنوان مطالعه و رویداد رأس (Top Event) را وارد فرمایید' : 'Please enter title and Top Event');
      return;
    }
    onSave(formData);
  };

  const overallColors = getRiskLevelColor(formData.overallRiskLevel);

  const handlePrint = () => {
    printService.printElement('fta-assessment-form-print', {
      title: `تحلیل درخت خطا (FTA) - ${formData.code} - ${formData.topEventTitle || formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-FTA-01',
      documentDate: formData.assessmentDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  return (
    <form id="fta-assessment-form-print" onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {initialData ? (isFa ? 'ویرایش درخت خطای فرآیندی (FTA)' : 'Edit Fault Tree') : (isFa ? 'فرم مدل‌سازی و تحلیل درخت خطا (FTA)' : 'New Fault Tree Analysis Form')}
            </h2>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 whitespace-nowrap" dir="ltr">
              {formData.code}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold mt-1 mr-7">
            {isFa ? 'تحلیل گرافیکی علی و معلولی رویدادهای فاجعه‌بار با گیت‌های منطقی AND و OR و محاسبه احتمال وقوع' : 'Deductive top-down hazard logic modeling'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{isFa ? 'سطح ریسک رویداد:' : 'Risk Level:'}</span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black whitespace-nowrap ${overallColors.badge}`}>
              {isFa ? overallColors.labelFa : overallColors.labelEn}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isFa ? 'چاپ استاندارد فرم FTA' : 'Print FTA Form'}
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-red-500/20 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isFa ? 'ذخیره درخت خطا' : 'Save FTA'}</span>
          </button>
        </div>
      </div>

      {/* ── Metadata ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'عنوان سناریوی درخت خطا *' : 'FTA Scenario Title *'}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder={isFa ? 'مثال: نشت گاز H2S از شیرهای برج گوگردزدایی' : 'e.g. H2S Gas Release'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'واحد عملیاتی' : 'Unit'}
            </label>
            <input
              type="text"
              list="fta-units-list"
              value={formData.unit}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold outline-hidden"
            />
            <datalist id="fta-units-list">
              {getUnits().map(u => <option key={u} value={u} />)}
            </datalist>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-red-600 dark:text-red-400 mb-1">
              {isFa ? 'شرح رویداد نهایی رأس (Top Event Definition) *' : 'Top Event Definition *'}
            </label>
            <input
              type="text"
              value={formData.topEventTitle}
              onChange={e => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  topEventTitle: val,
                  nodes: formData.nodes.map(n => n.id === 'node-top' ? { ...n, description: val } : n)
                });
              }}
              placeholder={isFa ? 'مثال: رهایش ابر گاز سمی H2S بالای 100ppm در محوطه سایت' : 'Top catastrophic event'}
              className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-800/60 bg-red-50/50 dark:bg-red-950/20 text-xs font-bold text-red-700 dark:text-red-300 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'احتمال وقوع کل (Top Event Probability)' : 'Top Probability'}
            </label>
            <input
              type="number"
              step="0.0001"
              value={formData.topEventProbability || 0.002}
              onChange={e => setFormData({ ...formData, topEventProbability: Number(e.target.value) })}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Personnel Signatures Block */}
      <RiskPersonnelSignatures
        formData={formData}
        onChange={(updated) => setFormData(prev => ({ ...prev, ...updated, method: 'FTA' }))}
        isFa={isFa}
      />

      {/* ── Tree Visual Nodes ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Network className="w-4 h-4 text-red-600" />
              {isFa ? 'ساختار منطقی شاخه‌ها، رویدادهای میانی، پایه‌ای و گیت‌های منطقی' : 'Fault Tree Logic Nodes'}
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              {isFa ? 'گیت AND: همزمانی همه علل | گیت OR: وقوع حداقل یکی از علل' : 'AND Gate: all causes | OR Gate: at least one cause'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {formData.nodes.map((node, index) => {
            const isTop = node.type === 'TOP_EVENT';
            const isBasic = node.type === 'BASIC_EVENT';

            return (
              <div 
                key={node.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isTop 
                    ? 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-800' 
                    : isBasic
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 mr-6'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 mr-3'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-slate-800 text-white">
                      {node.code || `N${index + 1}`}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {isTop 
                        ? (isFa ? 'رویداد رأس (Top Catastrophic Event)' : 'Top Event')
                        : isBasic
                        ? (isFa ? 'رویداد پایه‌ای / علت اولیه (Basic Event - Circle)' : 'Basic Event')
                        : (isFa ? 'رویداد میانی (Intermediate Event - Rectangle)' : 'Intermediate Event')
                      }
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isBasic && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500">{isFa ? 'گیت منطقی:' : 'Gate:'}</span>
                        <select
                          value={node.gateType || 'AND'}
                          onChange={e => handleNodeChange(node.id, 'gateType', e.target.value)}
                          className="text-[11px] font-black p-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-indigo-700 dark:text-indigo-300"
                        >
                          <option value="AND">گیت AND (و)</option>
                          <option value="OR">گیت OR (یا)</option>
                          <option value="VOTING">گیت Voting</option>
                        </select>
                      </div>
                    )}

                    {!isTop && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNode(node.id)}
                        className="text-red-500 hover:text-red-700 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-8">
                    <input
                      type="text"
                      value={node.description}
                      onChange={e => handleNodeChange(node.id, 'description', e.target.value)}
                      placeholder={isFa ? 'شرح رویداد یا نقص فنی...' : 'Event description...'}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      required
                    />
                  </div>

                  <div className="md:col-span-4 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500">{isFa ? 'احتمال:' : 'Prob:'}</span>
                    <input
                      type="number"
                      step="0.001"
                      value={node.probability || 0.01}
                      onChange={e => handleNodeChange(node.id, 'probability', Number(e.target.value))}
                      className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold outline-hidden"
                    />

                    {!isBasic && (
                      <div className="flex items-center gap-1 mr-auto">
                        <button
                          type="button"
                          onClick={() => handleAddNode(node.id, 'INTERMEDIATE_EVENT')}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-[10px] font-bold rounded-lg transition"
                          title={isFa ? 'افزودن رویداد میانی زیرمجموعه' : 'Add intermediate child'}
                        >
                          + رویداد میانی
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNode(node.id, 'BASIC_EVENT')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition"
                          title={isFa ? 'افزودن علت پایه‌ای' : 'Add basic cause'}
                        >
                          + علت پایه‌ای
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
}

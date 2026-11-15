import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Network,
  Calculator,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  FtaAssessment,
  FtaEventNode,
  RiskLevel,
} from '../types';
import { getMethodMeta } from '../services/riskAssessmentService';
import {
  computeFtaTreeProbabilities,
  getTodayJalali,
} from '../services/riskWorkflowEngine';
import { printService } from '../../../services/printService';
import RiskAssessmentHeaderBar from './shared/RiskAssessmentHeaderBar';
import RiskCommonMetaSection from './shared/RiskCommonMetaSection';
import RiskControlActionsPanel from './shared/RiskControlActionsPanel';
import { useRiskFormWorkflow } from './shared/useRiskFormWorkflow';

interface FtaFormProps {
  initialData?: FtaAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: FtaAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const probabilityToRiskLevel = (p: number): RiskLevel => {
  if (p >= 0.05) return 'CRITICAL';
  if (p >= 0.01) return 'HIGH';
  if (p >= 0.001) return 'MEDIUM';
  return 'LOW';
};

export default function FtaForm({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: FtaFormProps) {
  const [formData, setFormData] = useState<FtaAssessment>(() => {
    if (initialData) {
      return {
        ...initialData,
        nodes: Array.isArray(initialData.nodes) && initialData.nodes.length > 0
          ? initialData.nodes
          : [
              { id: 'node-top', parentId: null, type: 'TOP_EVENT', gateType: 'OR', description: initialData.topEventTitle || '', code: 'TOP', probability: 0.01 },
            ],
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    const g1Id = `node-${Date.now()}-1`;
    return {
      id: `fta-${Date.now()}`,
      code: `FTA-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'FTA',
      overallRiskLevel: 'HIGH',
      topEventTitle: '',
      topEventProbability: 0.005,
      nodes: [
        {
          id: 'node-top',
          parentId: null,
          type: 'TOP_EVENT',
          gateType: 'OR',
          description: '',
          code: 'TOP',
          probability: 0.005,
        },
        {
          id: g1Id,
          parentId: 'node-top',
          type: 'INTERMEDIATE_EVENT',
          gateType: 'AND',
          description: '',
          code: 'G1',
          probability: 0.005,
        },
        {
          id: `node-${Date.now()}-2`,
          parentId: g1Id,
          type: 'BASIC_EVENT',
          gateType: null,
          description: '',
          code: 'E1',
          probability: 0.05,
        },
        {
          id: `node-${Date.now()}-3`,
          parentId: g1Id,
          type: 'BASIC_EVENT',
          gateType: null,
          description: '',
          code: 'E2',
          probability: 0.1,
        },
      ],
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const treeCalc = useMemo(() => computeFtaTreeProbabilities(formData.nodes), [formData.nodes]);

  const syncedFormData: FtaAssessment = useMemo(
    () => ({
      ...formData,
      topEventProbability: treeCalc.topEventProbability,
      overallRiskLevel: probabilityToRiskLevel(treeCalc.topEventProbability),
    }),
    [formData, treeCalc]
  );

  const wf = useRiskFormWorkflow(syncedFormData, setFormData as any, onSave, currentUser, isFa);
  const meta = getMethodMeta('FTA');

  const handleAddNode = (parentId: string, type: FtaEventNode['type']) => {
    const isLeaf = type === 'BASIC_EVENT' || type === 'UNDEVELOPED_EVENT';
    const newNode: FtaEventNode = {
      id: `node-${Date.now()}-${formData.nodes.length + 1}`,
      parentId: parentId || 'node-top',
      type,
      gateType: isLeaf ? null : 'AND',
      votingThreshold: 2,
      description: '',
      code: type === 'BASIC_EVENT' ? `E${formData.nodes.length}` : type === 'UNDEVELOPED_EVENT' ? `U${formData.nodes.length}` : `G${formData.nodes.length}`,
      probability: isLeaf ? 0.01 : 0.001,
    };
    setFormData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
  };

  const handleRemoveNode = (nodeId: string) => {
    if (nodeId === 'node-top') return;
    // Remove subtree recursively
    setFormData(prev => {
      const toRemove = new Set<string>([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of prev.nodes) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id);
            changed = true;
          }
        }
      }
      return {
        ...prev,
        nodes: prev.nodes.filter(n => !toRemove.has(n.id)),
      };
    });
  };

  const handleNodeChange = (nodeId: string, field: keyof FtaEventNode, value: any) => {
    setFormData(prev => {
      const nextNodes = prev.nodes.map(n => (n.id === nodeId ? { ...n, [field]: value } : n));
      const calc = computeFtaTreeProbabilities(nextNodes);
      return {
        ...prev,
        nodes: nextNodes,
        topEventProbability: calc.topEventProbability,
        overallRiskLevel: probabilityToRiskLevel(calc.topEventProbability),
        ...(nodeId === 'node-top' && field === 'description' ? { topEventTitle: String(value) } : {}),
      };
    });
  };

  const handlePrint = () => {
    printService.printElement('fta-assessment-form-print', {
      title: `تحلیل درخت خطا (FTA) - ${formData.code} - ${formData.topEventTitle || formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-FTA-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  const renderVisualBranch = (node: FtaEventNode, depth = 0): React.ReactNode => {
    const children = formData.nodes.filter(n => n.parentId === node.id);
    const computedProb = treeCalc.nodeProbabilities[node.id] ?? node.probability ?? 0;
    const isLeaf = node.type === 'BASIC_EVENT' || node.type === 'UNDEVELOPED_EVENT';
    const isTop = node.type === 'TOP_EVENT';

    return (
      <div key={node.id} className={depth > 0 ? 'pr-6 border-r-2 border-slate-200 dark:border-slate-700 mr-3 mt-2' : ''}>
        <div
          className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
            isTop
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              : isLeaf
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-mono text-[10px] font-black shrink-0">
              {node.code || 'N'}
            </span>
            {!isLeaf && node.gateType && (
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black shrink-0">
                {node.gateType === 'VOTING' ? `VOTING (${node.votingThreshold || 2}/N)` : `GATE: ${node.gateType}`}
              </span>
            )}
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {node.description || (isFa ? '(بدون شرح)' : '(Untitled)')}
            </span>
          </div>

          <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums" dir="ltr">
            P = {computedProb.toExponential(3)} ({(computedProb * 100).toFixed(3)}%)
          </span>
        </div>

        {children.length > 0 && (
          <div className="space-y-1">
            {children.map(ch => renderVisualBranch(ch, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const topNode = formData.nodes.find(n => n.type === 'TOP_EVENT') || formData.nodes[0];

  return (
    <div id="fta-assessment-form-print" className="space-y-5 animate-in fade-in duration-300">
      <RiskAssessmentHeaderBar
        formData={syncedFormData}
        methodTitleFa={meta.titleFa}
        methodTitleEn={meta.titleEn}
        isEdit={Boolean(initialData)}
        isFa={isFa}
        canApprove={wf.canApprove}
        saving={wf.saving}
        validationIssues={wf.validationIssues}
        onCancel={onCancel}
        onPrint={handlePrint}
        onSaveDraft={wf.saveDraft}
        onSubmitReview={wf.submitForReview}
        onApprove={wf.approveAssessment}
        onArchive={wf.archiveAssessment}
        onStageClick={stage => setFormData(prev => ({ ...prev, workflowStage: stage }))}
      />

      {wf.feedbackBanner && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold ${
            wf.feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {wf.feedbackBanner.text}
        </div>
      )}

      <RiskCommonMetaSection
        formData={syncedFormData}
        onChange={patch => setFormData(prev => ({ ...prev, ...patch, method: 'FTA' }))}
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان سناریوی درخت خطا (FTA) *"
        titlePlaceholderFa="مثال: رهایش ابر گاز سمی H2S از واحد گوگردزدایی"
        extraFields={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">
                {isFa ? 'تعریف رویداد نهایی رأس (Top Event) *' : 'Top Event Definition *'}
              </label>
              <input
                type="text"
                value={formData.topEventTitle}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    topEventTitle: val,
                    nodes: prev.nodes.map(n => (n.type === 'TOP_EVENT' ? { ...n, description: val } : n)),
                  }));
                }}
                placeholder={isFa ? 'مثال: نشت کنترل‌نشده گاز H2S و آتش‌سوزی مخزن' : 'Top undesirable event'}
                className="w-full p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 text-xs font-bold outline-hidden"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-rose-600" />
                <span>{isFa ? 'احتمال محاسبه‌شده رویداد رأس (خودکار)' : 'Computed Top Probability'}</span>
              </span>
              <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400 tabular-nums mt-0.5" dir="ltr">
                {treeCalc.topEventProbability.toFixed(6)} ({(treeCalc.topEventProbability * 100).toFixed(3)}%)
              </span>
            </div>
          </div>
        }
      />

      {/* Interactive Tree Diagram Preview */}
      {topNode && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Network className="w-4 h-4 text-rose-600" />
            <span>{isFa ? 'نمای درختی سلسله‌مراتبی و محاسبه زنده گیت‌ها (AND / OR / VOTING)' : 'Live Fault Tree Hierarchy & Gate Probabilities'}</span>
          </h3>
          <div>{renderVisualBranch(topNode)}</div>
        </div>
      )}

      {/* Node Editor */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'ویرایشگر گره‌ها، رویدادهای میانی/پایه‌ای و گیت‌های منطقی' : 'Fault Tree Nodes & Logic Gates Editor'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isFa
                ? 'گیت AND: حاصلضرب احتمالات | گیت OR: اجتماع احتمالات مستقل | VOTING: رای اکثریت k از n'
                : 'AND: product | OR: union | VOTING: k-out-of-n'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {formData.nodes.map((node, index) => {
            const isTop = node.type === 'TOP_EVENT';
            const isLeaf = node.type === 'BASIC_EVENT' || node.type === 'UNDEVELOPED_EVENT';
            const computedP = treeCalc.nodeProbabilities[node.id] ?? node.probability ?? 0;
            const hasChildren = formData.nodes.some(n => n.parentId === node.id);

            return (
              <div
                key={node.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  isTop
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                    : isLeaf
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-slate-800 text-white">
                      {node.code || `N${index + 1}`}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {isTop
                        ? (isFa ? 'رویداد رأس (Top Event)' : 'Top Event')
                        : node.type === 'BASIC_EVENT'
                        ? (isFa ? 'رویداد پایه‌ای (Basic Event)' : 'Basic Event')
                        : node.type === 'UNDEVELOPED_EVENT'
                        ? (isFa ? 'رویداد توسعه‌نیافته (Undeveloped)' : 'Undeveloped Event')
                        : (isFa ? 'رویداد میانی (Intermediate Event)' : 'Intermediate Event')}
                    </span>
                    {node.parentId && (
                      <span className="text-[10px] font-mono text-slate-500">
                        ← {formData.nodes.find(p => p.id === node.parentId)?.code || node.parentId}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isLeaf && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={node.gateType || 'AND'}
                          onChange={e => handleNodeChange(node.id, 'gateType', e.target.value)}
                          className="text-[11px] font-black p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-indigo-700 dark:text-indigo-300"
                        >
                          <option value="AND">گیت AND (و)</option>
                          <option value="OR">گیت OR (یا)</option>
                          <option value="VOTING">گیت VOTING (k از n)</option>
                          <option value="INHIBIT">گیت INHIBIT (بازدارنده)</option>
                        </select>
                        {node.gateType === 'VOTING' && (
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={node.votingThreshold || 2}
                            onChange={e => handleNodeChange(node.id, 'votingThreshold', Math.max(1, Number(e.target.value)))}
                            className="w-14 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                            title="k"
                          />
                        )}
                      </div>
                    )}

                    {!isTop && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNode(node.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6">
                    <input
                      type="text"
                      value={node.description}
                      onChange={e => handleNodeChange(node.id, 'description', e.target.value)}
                      placeholder={isFa ? 'شرح دقیق رویداد یا نقص فنی...' : 'Event description...'}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                      {hasChildren ? (isFa ? 'محاسبه‌شده:' : 'Computed:') : (isFa ? 'احتمال:' : 'Prob:')}
                    </span>
                    {hasChildren ? (
                      <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums" dir="ltr">
                        {computedP.toFixed(6)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        max={1}
                        value={node.probability ?? 0.01}
                        onChange={e => handleNodeChange(node.id, 'probability', Math.max(0, Math.min(1, Number(e.target.value))))}
                        className="w-28 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold outline-hidden tabular-nums"
                        dir="ltr"
                      />
                    )}
                  </div>

                  {!isLeaf && (
                    <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddNode(node.id, 'INTERMEDIATE_EVENT')}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isFa ? 'رویداد میانی' : 'Intermediate'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddNode(node.id, 'BASIC_EVENT')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isFa ? 'علت پایه‌ای' : 'Basic Event'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddNode(node.id, 'UNDEVELOPED_EVENT')}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                      >
                        + {isFa ? 'توسعه‌نیافته' : 'Undeveloped'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <RiskControlActionsPanel
        assessment={syncedFormData}
        actions={syncedFormData.controlActions || []}
        reviewHistory={syncedFormData.reviewHistory || []}
        onChangeActions={actions => setFormData(prev => ({ ...prev, controlActions: actions }))}
        isFa={isFa}
        actorName={wf.actorName}
        onStatusMessage={(text, type) => wf.setFeedbackBanner({ text, type: type || 'success' })}
      />
    </div>
  );
}

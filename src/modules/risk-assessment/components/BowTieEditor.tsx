import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Shield,
  AlertOctagon,
  GitCommitHorizontal,
  ShieldAlert,
  ArrowRightLeft,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  BowTieAssessment,
  BowTieBarrier,
  BowTieConsequence,
  BowTieEscalationFactor,
  BowTieThreat,
  RiskActionItem,
  RiskLevel,
} from '../types';
import { getMethodMeta } from '../services/riskAssessmentService';
import { getTodayJalali } from '../services/riskWorkflowEngine';
import { printService } from '../../../services/printService';
import RiskAssessmentHeaderBar from './shared/RiskAssessmentHeaderBar';
import RiskCommonMetaSection from './shared/RiskCommonMetaSection';
import RiskControlActionsPanel from './shared/RiskControlActionsPanel';
import { useRiskFormWorkflow } from './shared/useRiskFormWorkflow';

interface BowTieEditorProps {
  initialData?: BowTieAssessment | null;
  allAssessments?: AnyRiskAssessment[];
  onSave: (assessment: BowTieAssessment) => Promise<void> | void;
  onCancel: () => void;
  isFa: boolean;
  currentUser: any;
}

const createBarrier = (title = 'مانع کنترلی جدید'): BowTieBarrier => ({
  id: `bar-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  title,
  barrierType: 'ENGINEERING',
  owner: '',
  effectiveness: 'HIGH',
  status: 'ACTIVE',
  escalationFactors: [],
});

export default function BowTieEditor({
  initialData,
  allAssessments = [],
  onSave,
  onCancel,
  isFa,
  currentUser,
}: BowTieEditorProps) {
  const [formData, setFormData] = useState<BowTieAssessment>(() => {
    if (initialData && initialData.bowtie) {
      return {
        ...initialData,
        controlActions: Array.isArray(initialData.controlActions) ? initialData.controlActions : [],
      };
    }
    const today = getTodayJalali();
    return {
      id: `bowtie-${Date.now()}`,
      code: `BT-${today.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      site: 'مجتمع پتروشیمی رجال',
      unit: '',
      areaLocation: '',
      assessorName: currentUser?.name || '',
      assessmentDate: today,
      teamMembers: [],
      status: 'DRAFT',
      workflowStage: 'INITIAL_INFO',
      method: 'BOWTIE',
      overallRiskLevel: 'HIGH',
      initialRiskScore: 15,
      bowtie: {
        hazard: 'مواد هیدروکربنی تحت فشار و دمای بالا',
        topEvent: 'از دست رفتن مهار و نشت گاز اشتعال‌پذیر (Loss of Containment)',
        threats: [
          {
            id: 'th-1',
            title: 'خوردگی داخلی خط لوله',
            likelihood: 3,
            barriers: [
              createBarrier('بازرسی ضخامت‌سنجی دوره‌ای (NDT) و تزریق ممانعت‌کننده خوردگی'),
            ],
          },
          {
            id: 'th-2',
            title: 'افزایش فشار بیش از حد مجاز (Overpressure)',
            likelihood: 3,
            barriers: [
              createBarrier('شیر اطمینان فشار (PSV) و سیستم توقف اضطراری (ESD)'),
            ],
          },
        ],
        consequences: [
          {
            id: 'co-1',
            title: 'آتش‌سوزی جت یا انفجار ابر بخار (VCE)',
            severity: 5,
            category: 'SAFETY',
            barriers: [
              createBarrier('دتکتور گاز و حریق (F&G) + سیستم سیلابی آب/فوم خودکار'),
            ],
          },
          {
            id: 'co-2',
            title: 'مواجهه حاد پرسنل و آسیب جانی',
            severity: 4,
            category: 'HEALTH',
            barriers: [
              createBarrier('آژیر تخلیه اضطراری و نقاط تجمع ایمن (ERP)'),
            ],
          },
        ],
      },
      controlActions: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const [selectedBarrierRef, setSelectedBarrierRef] = useState<{
    side: 'THREAT' | 'CONSEQUENCE';
    parentId: string;
    barrierId: string;
  } | null>(null);

  const wf = useRiskFormWorkflow(formData, setFormData, onSave, currentUser, isFa);
  const meta = getMethodMeta('BOWTIE');
  const bt = formData.bowtie;

  const updateBowTie = (nextBt: typeof bt) => {
    const maxLik = Math.max(1, ...nextBt.threats.map(t => t.likelihood || 1));
    const maxSev = Math.max(1, ...nextBt.consequences.map(c => c.severity || 1));
    const score = maxLik * maxSev;
    const level: RiskLevel = score >= 15 ? 'CRITICAL' : score >= 10 ? 'HIGH' : score >= 5 ? 'MEDIUM' : 'LOW';
    setFormData(prev => ({
      ...prev,
      bowtie: nextBt,
      initialRiskScore: score,
      overallRiskLevel: level,
    }));
  };

  const addThreat = () => {
    const t: BowTieThreat = {
      id: `th-${Date.now()}`,
      title: isFa ? 'تهدید جدید' : 'New Threat',
      likelihood: 3,
      barriers: [createBarrier(isFa ? 'مانع پیشگیرانه' : 'Preventive Barrier')],
    };
    updateBowTie({ ...bt, threats: [...bt.threats, t] });
  };

  const addConsequence = () => {
    const c: BowTieConsequence = {
      id: `co-${Date.now()}`,
      title: isFa ? 'پیامد جدید' : 'New Consequence',
      severity: 4,
      category: 'SAFETY',
      barriers: [createBarrier(isFa ? 'مانع کاهنده' : 'Mitigative Barrier')],
    };
    updateBowTie({ ...bt, consequences: [...bt.consequences, c] });
  };

  const addBarrier = (side: 'THREAT' | 'CONSEQUENCE', parentId: string) => {
    const bar = createBarrier(side === 'THREAT' ? 'مانع پیشگیرانه جدید' : 'مانع کاهنده جدید');
    if (side === 'THREAT') {
      updateBowTie({
        ...bt,
        threats: bt.threats.map(t => (t.id === parentId ? { ...t, barriers: [...t.barriers, bar] } : t)),
      });
    } else {
      updateBowTie({
        ...bt,
        consequences: bt.consequences.map(c => (c.id === parentId ? { ...c, barriers: [...c.barriers, bar] } : c)),
      });
    }
    setSelectedBarrierRef({ side, parentId, barrierId: bar.id });
  };

  const updateBarrier = (
    side: 'THREAT' | 'CONSEQUENCE',
    parentId: string,
    barrierId: string,
    patch: Partial<BowTieBarrier>
  ) => {
    if (side === 'THREAT') {
      updateBowTie({
        ...bt,
        threats: bt.threats.map(t =>
          t.id === parentId
            ? { ...t, barriers: t.barriers.map(b => (b.id === barrierId ? { ...b, ...patch } : b)) }
            : t
        ),
      });
    } else {
      updateBowTie({
        ...bt,
        consequences: bt.consequences.map(c =>
          c.id === parentId
            ? { ...c, barriers: c.barriers.map(b => (b.id === barrierId ? { ...b, ...patch } : b)) }
            : c
        ),
      });
    }
  };

  const removeBarrier = (side: 'THREAT' | 'CONSEQUENCE', parentId: string, barrierId: string) => {
    if (side === 'THREAT') {
      updateBowTie({
        ...bt,
        threats: bt.threats.map(t => (t.id === parentId ? { ...t, barriers: t.barriers.filter(b => b.id !== barrierId) } : t)),
      });
    } else {
      updateBowTie({
        ...bt,
        consequences: bt.consequences.map(c => (c.id === parentId ? { ...c, barriers: c.barriers.filter(b => b.id !== barrierId) } : c)),
      });
    }
    if (selectedBarrierRef?.barrierId === barrierId) setSelectedBarrierRef(null);
  };

  const selectedBarrier: BowTieBarrier | null = React.useMemo(() => {
    if (!selectedBarrierRef) return null;
    if (selectedBarrierRef.side === 'THREAT') {
      return bt.threats.find(t => t.id === selectedBarrierRef.parentId)?.barriers.find(b => b.id === selectedBarrierRef.barrierId) || null;
    }
    return bt.consequences.find(c => c.id === selectedBarrierRef.parentId)?.barriers.find(b => b.id === selectedBarrierRef.barrierId) || null;
  }, [bt, selectedBarrierRef]);

  const handleSyncDegradedBarriersToCapa = () => {
    const allBarriers: BowTieBarrier[] = [
      ...bt.threats.flatMap(t => t.barriers),
      ...bt.consequences.flatMap(c => c.barriers),
    ];
    const existing = formData.controlActions || [];
    const additions: RiskActionItem[] = [];
    for (const b of allBarriers) {
      if (b.status === 'DEGRADED' || b.status === 'FAILED' || b.effectiveness === 'LOW') {
        const title = `تقویت/اصلاح مانع پاپیونی: ${b.title}`;
        if (!existing.some(a => a.title === title)) {
          additions.push({
            id: `act-bt-${b.id}`,
            title,
            hierarchyControl: b.barrierType === 'ENGINEERING' ? 'ENGINEERING' : 'ADMINISTRATIVE',
            owner: b.owner || '',
            deadline: getTodayJalali(),
            status: 'OPEN',
          });
        }
      }
    }
    if (additions.length === 0) {
      wf.setFeedbackBanner({
        text: isFa ? 'مانع تضعیف‌شده یا ناکارآمد جدیدی برای انتقال به CAPA یافت نشد (یا قبلاً ثبت شده است).' : 'No new degraded/failed barriers to sync.',
        type: 'error',
      });
      return;
    }
    setFormData(prev => ({ ...prev, controlActions: [...(prev.controlActions || []), ...additions] }));
    wf.setFeedbackBanner({
      text: isFa ? `${additions.length} مانع نیازمند تقویت به لیست اقدامات CAPA منتقل شد.` : `${additions.length} barriers synced to CAPA.`,
      type: 'success',
    });
  };

  const handlePrint = () => {
    printService.printElement('bowtie-assessment-form-print', {
      title: `تحلیل گرافیکی پاپیونی (Bow-Tie) - ${formData.code} - ${formData.title}`,
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: formData.code || 'HSE-BOWTIE-01',
      documentDate: formData.assessmentDate,
      isFa,
      autoPrint: true,
    });
  };

  return (
    <div id="bowtie-assessment-form-print" className="space-y-5 animate-in fade-in duration-300">
      <RiskAssessmentHeaderBar
        formData={formData}
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
        formData={formData}
        onChange={patch => setFormData(prev => ({ ...prev, ...patch, method: 'BOWTIE' }))}
        isFa={isFa}
        allAssessments={allAssessments}
        titleLabelFa="عنوان سناریوی تحلیل پاپیونی (Bow-Tie) *"
        titlePlaceholderFa="مثال: تحلیل موانع ایمنی نشت گاز در واحد الفین"
        extraFields={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                {isFa ? 'منبع خطر اصلی (Hazard) *' : 'Hazard Source *'}
              </label>
              <input
                type="text"
                value={bt.hazard}
                onChange={e => updateBowTie({ ...bt, hazard: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 text-xs font-bold outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-rose-700 dark:text-rose-300 mb-1">
                {isFa ? 'رویداد مرکزی از دست رفتن کنترل (Top Event) *' : 'Top Event *'}
              </label>
              <input
                type="text"
                value={bt.topEvent}
                onChange={e => updateBowTie({ ...bt, topEvent: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 text-xs font-bold outline-hidden"
              />
            </div>
          </div>
        }
      />

      {/* Interactive Bow-Tie Diagram Canvas */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GitCommitHorizontal className="w-4 h-4 text-violet-600" />
              <span>{isFa ? 'نمودار تعاملی پاپیونی (تهدیدها ← موانع پیشگیرانه ← رویداد رأس → موانع کاهنده → پیامدها)' : 'Interactive Bow-Tie Diagram'}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isFa ? 'روی هر مانع کلیک کنید تا نوع، مسئول، اثربخشی و عوامل تشدید (Escalation Factors) آن را ویرایش کنید.' : 'Click any barrier to edit details & escalation factors.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncDegradedBarriersToCapa}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-violet-600" />
              <span>{isFa ? 'انتقال موانع تضعیف‌شده به CAPA' : 'Sync Weak Barriers'}</span>
            </button>
            <button
              type="button"
              onClick={addThreat}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن تهدید' : 'Add Threat'}</span>
            </button>
            <button
              type="button"
              onClick={addConsequence}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن پیامد' : 'Add Consequence'}</span>
            </button>
          </div>
        </div>

        {/* 3-Column Visual Bow-Tie Grid (RTL: Right = Threats -> Center = Top Event -> Left = Consequences, or logical flow) */}
        <div className="overflow-x-auto pb-2 custom-scrollbar">
          <div className="min-w-[920px] grid grid-cols-12 gap-4 items-center">
            {/* Threats + Preventive Barriers (5 cols) */}
            <div className="col-span-5 space-y-3">
              <div className="text-[11px] font-black text-sky-700 dark:text-sky-300 text-center pb-1 border-b border-slate-200 dark:border-slate-700">
                {isFa ? 'تهدیدها (Threats) و موانع پیشگیرانه (Preventive)' : 'Threats & Preventive Barriers'}
              </div>

              {bt.threats.map(threat => (
                <div key={threat.id} className="flex items-center gap-2">
                  {/* Threat Box */}
                  <div className="w-44 shrink-0 p-2.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black text-sky-700 dark:text-sky-300">{isFa ? 'تهدید' : 'Threat'}</span>
                      {bt.threats.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateBowTie({ ...bt, threats: bt.threats.filter(t => t.id !== threat.id) })}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={threat.title}
                      onChange={e =>
                        updateBowTie({
                          ...bt,
                          threats: bt.threats.map(t => (t.id === threat.id ? { ...t, title: e.target.value } : t)),
                        })
                      }
                      className="w-full p-1.5 rounded bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 text-[11px] font-bold outline-hidden"
                    />
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>{isFa ? 'احتمال (1-5):' : 'Lik:'}</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={threat.likelihood}
                        onChange={e =>
                          updateBowTie({
                            ...bt,
                            threats: bt.threats.map(t =>
                              t.id === threat.id ? { ...t, likelihood: Math.max(1, Math.min(5, Number(e.target.value))) } : t
                            ),
                          })
                        }
                        className="w-11 p-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* Connector Line */}
                  <div className="w-4 h-0.5 bg-slate-300 dark:bg-slate-600 shrink-0" />

                  {/* Preventive Barriers Chain */}
                  <div className="flex-1 space-y-1.5">
                    {threat.barriers.map(bar => {
                      const isSel = selectedBarrierRef?.barrierId === bar.id;
                      const statusRing =
                        bar.status === 'FAILED'
                          ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
                          : bar.status === 'DEGRADED'
                          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                          : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/25';
                      return (
                        <button
                          key={bar.id}
                          type="button"
                          onClick={() => setSelectedBarrierRef({ side: 'THREAT', parentId: threat.id, barrierId: bar.id })}
                          className={`w-full text-right p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${statusRing} ${
                            isSel ? 'ring-2 ring-violet-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1 truncate">
                              <Shield className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{bar.title}</span>
                            </span>
                            {bar.escalationFactors.length > 0 && (
                              <span className="text-[9px] font-mono px-1 rounded bg-amber-200/70 text-amber-900 shrink-0">
                                +{bar.escalationFactors.length} EF
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addBarrier('THREAT', threat.id)}
                      className="w-full py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      + {isFa ? 'افزودن مانع پیشگیرانه' : 'Add Barrier'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Center Knot: Hazard + Top Event (2 cols) */}
            <div className="col-span-2 flex flex-col items-center justify-center gap-3 px-2">
              <div className="w-full p-3 rounded-xl border-2 border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-center space-y-1">
                <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 block">
                  {isFa ? 'منبع خطر (HAZARD)' : 'HAZARD'}
                </span>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-snug">{bt.hazard}</p>
              </div>

              <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />

              <div className="w-full p-4 rounded-full aspect-square flex flex-col items-center justify-center border-4 border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-center shadow-sm">
                <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400 mb-1" />
                <span className="text-[10px] font-black text-rose-700 dark:text-rose-300">TOP EVENT</span>
                <p className="text-[11px] font-black text-slate-900 dark:text-slate-100 leading-tight mt-1 line-clamp-3">
                  {bt.topEvent}
                </p>
              </div>
            </div>

            {/* Mitigative Barriers + Consequences (5 cols) */}
            <div className="col-span-5 space-y-3">
              <div className="text-[11px] font-black text-rose-700 dark:text-rose-300 text-center pb-1 border-b border-slate-200 dark:border-slate-700">
                {isFa ? 'موانع کاهنده (Mitigative) و پیامدها (Consequences)' : 'Mitigative Barriers & Consequences'}
              </div>

              {bt.consequences.map(cons => (
                <div key={cons.id} className="flex items-center gap-2">
                  {/* Mitigative Barriers Chain */}
                  <div className="flex-1 space-y-1.5">
                    {cons.barriers.map(bar => {
                      const isSel = selectedBarrierRef?.barrierId === bar.id;
                      const statusRing =
                        bar.status === 'FAILED'
                          ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
                          : bar.status === 'DEGRADED'
                          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                          : 'border-violet-300 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/25';
                      return (
                        <button
                          key={bar.id}
                          type="button"
                          onClick={() => setSelectedBarrierRef({ side: 'CONSEQUENCE', parentId: cons.id, barrierId: bar.id })}
                          className={`w-full text-right p-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${statusRing} ${
                            isSel ? 'ring-2 ring-violet-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1 truncate">
                              <ShieldAlert className="w-3 h-3 text-violet-600 shrink-0" />
                              <span className="truncate">{bar.title}</span>
                            </span>
                            {bar.escalationFactors.length > 0 && (
                              <span className="text-[9px] font-mono px-1 rounded bg-amber-200/70 text-amber-900 shrink-0">
                                +{bar.escalationFactors.length} EF
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addBarrier('CONSEQUENCE', cons.id)}
                      className="w-full py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      + {isFa ? 'افزودن مانع کاهنده' : 'Add Barrier'}
                    </button>
                  </div>

                  {/* Connector Line */}
                  <div className="w-4 h-0.5 bg-slate-300 dark:bg-slate-600 shrink-0" />

                  {/* Consequence Box */}
                  <div className="w-44 shrink-0 p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black text-rose-700 dark:text-rose-300">{isFa ? 'پیامد' : 'Consequence'}</span>
                      {bt.consequences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateBowTie({ ...bt, consequences: bt.consequences.filter(c => c.id !== cons.id) })}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={cons.title}
                      onChange={e =>
                        updateBowTie({
                          ...bt,
                          consequences: bt.consequences.map(c => (c.id === cons.id ? { ...c, title: e.target.value } : c)),
                        })
                      }
                      className="w-full p-1.5 rounded bg-white dark:bg-slate-900 border border-rose-200 dark:border-slate-700 text-[11px] font-bold outline-hidden"
                    />
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>{isFa ? 'شدت (1-5):' : 'Sev:'}</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={cons.severity}
                        onChange={e =>
                          updateBowTie({
                            ...bt,
                            consequences: bt.consequences.map(c =>
                              c.id === cons.id ? { ...c, severity: Math.max(1, Math.min(5, Number(e.target.value))) } : c
                            ),
                          })
                        }
                        className="w-11 p-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Barrier Inspector & Escalation Factors Editor */}
        {selectedBarrier && selectedBarrierRef && (
          <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black text-violet-900 dark:text-violet-200">
                {isFa ? 'ویرایش جزئیات مانع و عوامل تشدید (Escalation Factors)' : 'Barrier & Escalation Factor Inspector'}
              </h4>
              <button
                type="button"
                onClick={() => removeBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId)}
                className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'حذف این مانع' : 'Remove Barrier'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'عنوان مانع کنترلی' : 'Barrier Title'}
                </label>
                <input
                  type="text"
                  value={selectedBarrier.title}
                  onChange={e =>
                    updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                      title: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'نوع مانع' : 'Barrier Type'}
                </label>
                <select
                  value={selectedBarrier.barrierType}
                  onChange={e =>
                    updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                      barrierType: e.target.value as any,
                    })
                  }
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                >
                  <option value="ENGINEERING">{isFa ? 'مهندسی / سخت‌افزاری' : 'Engineering'}</option>
                  <option value="DETECTIVE">{isFa ? 'کشف و هشدار (Detective)' : 'Detective'}</option>
                  <option value="PROCEDURAL">{isFa ? 'رویه‌ای / دستوری' : 'Procedural'}</option>
                  <option value="EMERGENCY_RESPONSE">{isFa ? 'واکنش اضطراری' : 'Emergency Response'}</option>
                  <option value="PPE">{isFa ? 'تجهیزات حفاظت فردی' : 'PPE'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'مسئول سلامت مانع' : 'Barrier Owner'}
                </label>
                <input
                  type="text"
                  value={selectedBarrier.owner}
                  onChange={e =>
                    updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                      owner: e.target.value,
                    })
                  }
                  placeholder={isFa ? 'نام مسئول...' : 'Owner...'}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'وضعیت و اثربخشی' : 'Status / Effectiveness'}
                </label>
                <select
                  value={selectedBarrier.status || 'ACTIVE'}
                  onChange={e =>
                    updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                      status: e.target.value as any,
                    })
                  }
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                >
                  <option value="ACTIVE">{isFa ? 'فعال و اثربخش' : 'Active'}</option>
                  <option value="DEGRADED">{isFa ? 'تضعیف‌شده (نیازمند سرویس)' : 'Degraded'}</option>
                  <option value="FAILED">{isFa ? 'خراب / غیرفعال' : 'Failed'}</option>
                </select>
              </div>
            </div>

            {/* Escalation Factors */}
            <div className="space-y-2 pt-2 border-t border-violet-200/60 dark:border-violet-800/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {isFa ? 'عوامل تشدیدکننده (تضعیف‌کننده مانع) و کنترل‌های جبرانی آن‌ها:' : 'Escalation Factors & Controls:'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const ef: BowTieEscalationFactor = {
                      id: `ef-${Date.now()}`,
                      title: '',
                      controlMeasure: '',
                      owner: '',
                    };
                    updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                      escalationFactors: [...selectedBarrier.escalationFactors, ef],
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black cursor-pointer"
                >
                  + {isFa ? 'افزودن عامل تشدید' : 'Add Escalation Factor'}
                </button>
              </div>

              {selectedBarrier.escalationFactors.map(ef => (
                <div key={ef.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={ef.title}
                    onChange={e =>
                      updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                        escalationFactors: selectedBarrier.escalationFactors.map(x =>
                          x.id === ef.id ? { ...x, title: e.target.value } : x
                        ),
                      })
                    }
                    placeholder={isFa ? 'عامل تشدید (مثلاً قطع برق ابزاردقیق یا تاخیر کالیبراسیون)' : 'Escalation factor...'}
                    className="md:col-span-5 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                  />
                  <input
                    type="text"
                    value={ef.controlMeasure}
                    onChange={e =>
                      updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                        escalationFactors: selectedBarrier.escalationFactors.map(x =>
                          x.id === ef.id ? { ...x, controlMeasure: e.target.value } : x
                        ),
                      })
                    }
                    placeholder={isFa ? 'کنترل عامل تشدید (مثلاً تغذیه اضطراری UPS و برنامه PM)' : 'Escalation control...'}
                    className="md:col-span-6 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateBarrier(selectedBarrierRef.side, selectedBarrierRef.parentId, selectedBarrierRef.barrierId, {
                        escalationFactors: selectedBarrier.escalationFactors.filter(x => x.id !== ef.id),
                      })
                    }
                    className="md:col-span-1 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg justify-self-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RiskControlActionsPanel
        assessment={formData}
        actions={formData.controlActions || []}
        reviewHistory={formData.reviewHistory || []}
        onChangeActions={actions => setFormData(prev => ({ ...prev, controlActions: actions }))}
        isFa={isFa}
        actorName={wf.actorName}
        onStatusMessage={(text, type) => wf.setFeedbackBanner({ text, type: type || 'success' })}
      />
    </div>
  );
}

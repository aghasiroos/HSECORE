import React, { useEffect, useMemo, useState } from 'react';
import {
  Grid3X3,
  Settings2,
  Download,
  Printer,
  Save,
  RotateCcw,
  Eye,
  Edit3,
  CheckCircle2,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  RiskMatrixConfig,
} from '../types';
import {
  DEFAULT_RISK_MATRIX_CONFIG,
  evaluateMatrixScore,
  exportRiskRegisterToExcel,
  extractMatrixPointsFromAssessments,
  loadOrganizationMatrixConfig,
  MatrixCellAssessmentPoint,
  saveOrganizationMatrixConfig,
} from '../services/riskMatrixConfig';
import { getRiskLevelColor } from '../services/riskAssessmentService';
import { printService } from '../../../services/printService';

interface RiskMatrixWorkspaceProps {
  assessments: AnyRiskAssessment[];
  isFa: boolean;
  canEditConfig?: boolean;
  onViewAssessment: (assessment: AnyRiskAssessment) => void;
  onEditAssessment: (assessment: AnyRiskAssessment) => void;
}

export default function RiskMatrixWorkspace({
  assessments,
  isFa,
  canEditConfig = true,
  onViewAssessment,
  onEditAssessment,
}: RiskMatrixWorkspaceProps) {
  const [config, setConfig] = useState<RiskMatrixConfig>(DEFAULT_RISK_MATRIX_CONFIG);
  const [phase, setPhase] = useState<'INITIAL' | 'RESIDUAL'>('INITIAL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [selectedCell, setSelectedCell] = useState<{ p: number; s: number } | null>(null);
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizationMatrixConfig().then(setConfig).catch(() => {});
  }, []);

  const distinctUnits = useMemo(
    () => Array.from(new Set(assessments.map(a => a.unit).filter(Boolean))).sort(),
    [assessments]
  );

  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      if (methodFilter !== 'ALL' && a.method !== methodFilter) return false;
      if (unitFilter !== 'ALL' && a.unit !== unitFilter) return false;
      return true;
    });
  }, [assessments, methodFilter, unitFilter]);

  const points = useMemo(
    () => extractMatrixPointsFromAssessments(filteredAssessments, config, phase),
    [filteredAssessments, config, phase]
  );

  const levelDistribution = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const pt of points) {
      counts[pt.level] = (counts[pt.level] || 0) + 1;
    }
    return counts;
  }, [points]);

  const selectedCellPoints: MatrixCellAssessmentPoint[] = useMemo(() => {
    if (!selectedCell) return [];
    return points.filter(pt => pt.probability === selectedCell.p && pt.severity === selectedCell.s);
  }, [points, selectedCell]);

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      const ok = await saveOrganizationMatrixConfig(config);
      setFeedback(
        ok
          ? (isFa ? 'تنظیمات ماتریس و آستانه‌های ریسک سازمان با موفقیت ذخیره شد.' : 'Matrix policy saved.')
          : (isFa ? 'خطا در ذخیره‌سازی تنظیمات ماتریس.' : 'Failed to save matrix config.')
      );
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleResetDefault = () => {
    setConfig(DEFAULT_RISK_MATRIX_CONFIG);
  };

  const handlePrintMatrix = () => {
    printService.printElement('risk-matrix-workspace-print', {
      title: isFa ? 'ماتریس پویا و تحلیل توزیع ریسک سازمان' : 'Dynamic Risk Assessment Matrix',
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: 'HSE-MATRIX-01',
      isFa,
      autoPrint: true,
    });
  };

  const pDesc = [...config.probabilityScale].sort((a, b) => b.value - a.value);
  const sAsc = [...config.severityScale].sort((a, b) => a.value - b.value);

  return (
    <div id="risk-matrix-workspace-print" className="space-y-5 animate-in fade-in duration-300">
      {/* Toolbar & Export Actions */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{isFa ? config.nameFa : 'Configurable Dynamic Risk Matrix'}</span>
          </h3>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {config.standardRef} — {isFa ? `تعداد کل نقاط ریسک پایش‌شده: ${points.length}` : `Total risk items mapped: ${points.length}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setPhase('INITIAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                phase === 'INITIAL' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {isFa ? 'ریسک اولیه' : 'Initial Risk'}
            </button>
            <button
              type="button"
              onClick={() => setPhase('RESIDUAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                phase === 'RESIDUAL' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {isFa ? 'ریسک باقیمانده' : 'Residual Risk'}
            </button>
          </div>

          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-hidden"
          >
            <option value="ALL">{isFa ? 'همه متدولوژی‌ها' : 'All Methods'}</option>
            <option value="FMEA">FMEA</option>
            <option value="JSA">JSA</option>
            <option value="FTA">FTA</option>
            <option value="HHA">HHA</option>
            <option value="WHAT_IF">What-If</option>
            <option value="BOWTIE">Bow-Tie</option>
            <option value="JOB_ACTIVITY">{isFa ? 'فعالیت‌ها و مشاغل' : 'Job Activity'}</option>
          </select>

          <select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-hidden"
          >
            <option value="ALL">{isFa ? 'همه واحدها' : 'All Units'}</option>
            {distinctUnits.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {canEditConfig && (
            <button
              type="button"
              onClick={() => setShowPolicyEditor(v => !v)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <span>{isFa ? 'تنظیم سطوح و آستانه‌ها' : 'Configure Scales'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportRiskRegisterToExcel(filteredAssessments, config)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isFa ? 'خروجی Excel (.xlsx)' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintMatrix}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ / PDF' : 'Print / PDF'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Distribution KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.thresholds.map(band => {
          const count = levelDistribution[band.level] || 0;
          const pct = points.length > 0 ? Math.round((count / points.length) * 100) : 0;
          return (
            <div
              key={band.level}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
            >
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">{band.labelFa}</span>
                <span className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">{count}</span>
                <span className="text-[10px] font-mono text-slate-400 mr-1.5" dir="ltr">({pct}%)</span>
              </div>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-mono text-xs font-black tabular-nums"
                style={{ backgroundColor: band.colorHex }}
              >
                {band.minScore}-{band.maxScore}
              </div>
            </div>
          );
        })}
      </div>

      {/* Organization Matrix Policy Configurator */}
      {showPolicyEditor && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                {isFa ? 'پیکربندی پویا ماتریس و حدود پذیرش ریسک سازمان' : 'Organization Risk Matrix Policy Editor'}
              </h4>
              <p className="text-[11px] text-slate-500">
                {isFa ? 'تغییر حدود امتیاز، برچسب‌ها، رنگ‌بندی و معیارهای پذیرش مطابق خط‌مشی HSE سازمان' : 'Customize score thresholds, labels, and acceptability'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isFa ? 'بازنشانی پیش‌فرض' : 'Reset'}</span>
              </button>
              <button
                type="button"
                disabled={savingPolicy}
                onClick={handleSavePolicy}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingPolicy ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره خط‌مشی ماتریس' : 'Save Policy')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.thresholds.map((band, idx) => (
              <div key={band.level} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={band.colorHex}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        thresholds: prev.thresholds.map((t, i) => (i === idx ? { ...t, colorHex: e.target.value } : t)),
                      }))
                    }
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={band.labelFa}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        thresholds: prev.thresholds.map((t, i) => (i === idx ? { ...t, labelFa: e.target.value } : t)),
                      }))
                    }
                    className="flex-1 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                  />
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={band.minScore}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        thresholds: prev.thresholds.map((t, i) => (i === idx ? { ...t, minScore: Number(e.target.value) } : t)),
                      }))
                    }
                    className="w-14 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    title="Min Score"
                  />
                  <span className="text-xs font-bold">-</span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={band.maxScore}
                    onChange={e =>
                      setConfig(prev => ({
                        ...prev,
                        thresholds: prev.thresholds.map((t, i) => (i === idx ? { ...t, maxScore: Number(e.target.value) } : t)),
                      }))
                    }
                    className="w-14 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                    title="Max Score"
                  />
                </div>
                <input
                  type="text"
                  value={band.acceptabilityFa}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      thresholds: prev.thresholds.map((t, i) => (i === idx ? { ...t, acceptabilityFa: e.target.value } : t)),
                    }))
                  }
                  placeholder={isFa ? 'معیار پذیرش...' : 'Acceptability...'}
                  className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                />
                <input
                  type="text"
                  value={band.requiredActionFa}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      thresholds: prev.thresholds.map((t, i) => (i === idx ? { ...t, requiredActionFa: e.target.value } : t)),
                    }))
                  }
                  placeholder={isFa ? 'اقدام الزامی...' : 'Required action...'}
                  className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold outline-hidden"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive 5x5 Matrix Grid */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
        <table className="w-full border-collapse text-center min-w-[720px]">
          <thead>
            <tr>
              <th className="p-3 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 w-44">
                {isFa ? 'احتمال وقوع (P) \\ شدت پیامد (S)' : 'Probability (P) \\ Severity (S)'}
              </th>
              {sAsc.map(sev => (
                <th
                  key={sev.value}
                  className="p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-black text-slate-800 dark:text-slate-100"
                >
                  <div className="font-mono text-sm tabular-nums">{sev.value}</div>
                  <div className="text-[11px]">{sev.labelFa}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pDesc.map(prob => (
              <tr key={prob.value}>
                <th className="p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-right text-xs font-black text-slate-800 dark:text-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span>{prob.labelFa}</span>
                    <span className="font-mono text-sm tabular-nums px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">{prob.value}</span>
                  </div>
                </th>
                {sAsc.map(sev => {
                  const score = prob.value * sev.value;
                  const band = evaluateMatrixScore(score, config);
                  const cellCount = points.filter(pt => pt.probability === prob.value && pt.severity === sev.value).length;
                  const isSel = selectedCell?.p === prob.value && selectedCell?.s === sev.value;
                  return (
                    <td key={`${prob.value}-${sev.value}`} className="p-1 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setSelectedCell({ p: prob.value, s: sev.value })}
                        style={{ backgroundColor: `${band.colorHex}20`, borderColor: band.colorHex }}
                        className={`w-full p-3 rounded-xl border-2 transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSel ? 'ring-2 ring-slate-900 dark:ring-white scale-[1.02]' : 'hover:opacity-90'
                        }`}
                      >
                        <span
                          className="font-mono text-base font-black tabular-nums"
                          style={{ color: band.colorHex }}
                        >
                          {score}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                          {band.labelFa.split('(')[0].trim()}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black tabular-nums ${
                            cellCount > 0 ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200/70 dark:bg-slate-700 text-slate-500'
                          }`}
                        >
                          {cellCount} {isFa ? 'مورد' : 'items'}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Drilldown */}
      {selectedCell && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                {isFa
                  ? `پرونده‌های ریسک در خانه ماتریس (احتمال ${selectedCell.p} × شدت ${selectedCell.s} = امتیاز ${selectedCell.p * selectedCell.s})`
                  : `Risks in Matrix Cell (P=${selectedCell.p} × S=${selectedCell.s})`}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {evaluateMatrixScore(selectedCell.p * selectedCell.s, config).acceptabilityFa}
              </p>
            </div>
            <span className="text-xs font-mono font-black text-slate-600 dark:text-slate-300 tabular-nums">
              {selectedCellPoints.length} {isFa ? 'مورد یافت شد' : 'matching items'}
            </span>
          </div>

          {selectedCellPoints.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 text-center py-6">
              {isFa ? 'هیچ خطر یا ارزیابی ریسکی در این امتیاز ماتریس ثبت نشده است.' : 'No risks registered in this cell.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {selectedCellPoints.map((pt, i) => {
                const col = getRiskLevelColor(pt.level);
                return (
                  <div key={`${pt.assessment.id}-${i}`} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">
                          {pt.assessment.code}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold">
                          {pt.assessment.method}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{pt.assessment.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {pt.assessment.unit} — {pt.itemLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${col.badge}`}>
                        {isFa ? col.shortLabelFa : col.shortLabelEn}
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewAssessment(pt.assessment)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                        title={isFa ? 'مشاهده' : 'View'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditAssessment(pt.assessment)}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 cursor-pointer"
                        title={isFa ? 'ویرایش' : 'Edit'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { 
  Printer, 
  X, 
  ShieldAlert, 
  FileText, 
  Calendar, 
  User, 
  Users, 
  MapPin, 
  Building, 
  CheckCircle2, 
  AlertTriangle,
  Edit3,
  Flame,
  Activity,
  HeartPulse,
  GitFork
} from 'lucide-react';
import { 
  AnyRiskAssessment, 
  JsaAssessment, 
  FmeaAssessment, 
  FtaAssessment, 
  HhaAssessment, 
  RiskLevel 
} from '../types';
import { getMethodMeta, getRiskLevelColor } from '../services/riskAssessmentService';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import HseLogo from '../../../components/HseLogo';
import { printService } from '../../../services/printService';

interface RiskAssessmentPrintModalProps {
  assessment: AnyRiskAssessment;
  isFa: boolean;
  onClose: () => void;
  onEdit: (assessment: AnyRiskAssessment) => void;
}

export default function RiskAssessmentPrintModal({
  assessment,
  isFa,
  onClose,
  onEdit
}: RiskAssessmentPrintModalProps) {
  const { branding } = useSystemBranding();
  const methodMeta = getMethodMeta(assessment.method);
  const overallColors = getRiskLevelColor(assessment.overallRiskLevel);

  const handlePrint = () => {
    printService.printElement('risk-assessment-printable-sheet', {
      title: `فرم ارزیابی ریسک ${assessment.method} - ${assessment.code || ''} - ${assessment.title || ''}`,
      orientation: assessment.method === 'HHA' || assessment.method === 'FMEA' ? 'landscape' : 'portrait',
      pageSize: 'A4',
      documentCode: assessment.code,
      documentDate: assessment.assessmentDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  const renderJsaDetails = (jsa: JsaAssessment) => (
    <div className="space-y-4">
      {/* Job & PPE Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'عنوان شغل / فعالیت تحت بررسی:' : 'Job Title / Activity:'}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            {jsa.jobTitle || jsa.title}
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'تجهیزات حفاظت فردی (PPE) الزامی:' : 'Required PPE:'}
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {jsa.requiredPpe && jsa.requiredPpe.length > 0 ? (
              jsa.requiredPpe.map((ppe, idx) => (
                <span 
                  key={idx}
                  className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md text-[11px] font-bold"
                >
                  {ppe}
                </span>
              ))
            ) : (
              <span className="text-slate-400 font-bold">{isFa ? 'ثبت نشده' : 'None specified'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Steps Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="font-black text-xs text-slate-800 dark:text-slate-200">
            {isFa ? 'جدول تحلیل ایمنی مراحل شغلی (JSA Matrix)' : 'Job Steps Safety Analysis'}
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            {jsa.steps.length} {isFa ? 'گام شغلی' : 'Steps'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold text-[11px]">
                <th className="p-2.5 text-center w-10">#</th>
                <th className="p-2.5 min-w-[140px]">{isFa ? 'شرح مرحله کار' : 'Job Step'}</th>
                <th className="p-2.5 min-w-[160px]">{isFa ? 'خطرات و پیامدهای احتمالی' : 'Hazards & Consequences'}</th>
                <th className="p-2.5 text-center w-24">{isFa ? 'ریسک اولیه (P×S)' : 'Initial Risk'}</th>
                <th className="p-2.5 min-w-[200px]">{isFa ? 'اقدامات کنترلی و پیشگیرانه' : 'Control Measures'}</th>
                <th className="p-2.5 text-center w-24">{isFa ? 'ریسک نهایی' : 'Residual Risk'}</th>
                <th className="p-2.5 min-w-[100px]">{isFa ? 'مسئول پیگیری' : 'Responsible'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jsa.steps.map((step, idx) => {
                const initCol = getRiskLevelColor(step.initialRiskLevel);
                const resCol = getRiskLevelColor(step.residualRiskLevel);
                return (
                  <tr key={step.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 text-center font-bold text-slate-500">{step.stepNumber || idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{step.taskDescription}</td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300 space-y-1">
                      <div className="font-bold text-rose-700 dark:text-rose-400">{step.hazards}</div>
                      {step.potentialConsequences && (
                        <div className="text-[11px] text-slate-500">{step.potentialConsequences}</div>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${initCol.badge}`}>
                        {isFa ? initCol.labelFa : initCol.labelEn}
                        <span className="block text-[9px] font-mono">({step.initialProbability}×{step.initialSeverity}={step.initialRiskScore})</span>
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300">
                      <div className="font-medium">{step.controlMeasures}</div>
                      {step.hierarchyControl && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] rounded">
                          {step.hierarchyControl}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${resCol.badge}`}>
                        {isFa ? resCol.labelFa : resCol.labelEn}
                        <span className="block text-[9px] font-mono">({step.residualProbability}×{step.residualSeverity}={step.residualRiskScore})</span>
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400 font-medium">
                      <div>{step.actionOwner || '-'}</div>
                      {step.actionDeadline && (
                        <div className="text-[10px] font-mono text-slate-400">{step.actionDeadline}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );

  const renderFmeaDetails = (fmea: FmeaAssessment) => (
    <div className="space-y-4">
      {/* Equipment & Process Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'تگ و نام تجهیز (Equipment Tag):' : 'Equipment Tag:'}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm font-mono">
            {fmea.equipmentTag || '-'}
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'نام سیستم / زیرسیستم تحت ارزیابی:' : 'System / Sub-system:'}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            {fmea.systemName || '-'}
          </span>
        </div>
      </div>

      {/* FMEA Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="font-black text-xs text-slate-800 dark:text-slate-200">
            {isFa ? 'برگه کارشناسی تحلیل حالات و اثرات خرابی (FMEA Worksheet)' : 'FMEA Worksheet'}
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            {fmea.rows.length} {isFa ? 'حالت خرابی' : 'Failure Modes'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                <th className="p-2 text-center w-8">#</th>
                <th className="p-2 min-w-[100px]">{isFa ? 'کارکرد آیتم' : 'Item Function'}</th>
                <th className="p-2 min-w-[110px]">{isFa ? 'حالت بالقوه خرابی' : 'Failure Mode'}</th>
                <th className="p-2 min-w-[110px]">{isFa ? 'اثرات خرابی' : 'Effects'}</th>
                <th className="p-2 text-center w-8" title={isFa ? 'شدت (Severity 1-10)' : 'Severity'}>S</th>
                <th className="p-2 min-w-[110px]">{isFa ? 'علل بالقوه' : 'Causes'}</th>
                <th className="p-2 text-center w-8" title={isFa ? 'وقوع (Occurrence 1-10)' : 'Occurrence'}>O</th>
                <th className="p-2 min-w-[110px]">{isFa ? 'کنترل‌های فعلی' : 'Current Controls'}</th>
                <th className="p-2 text-center w-8" title={isFa ? 'تشخیص (Detection 1-10)' : 'Detection'}>D</th>
                <th className="p-2 text-center w-12 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-black">RPN</th>
                <th className="p-2 min-w-[130px]">{isFa ? 'اقدامات پیشنهادی' : 'Recommended Actions'}</th>
                <th className="p-2 min-w-[90px]">{isFa ? 'مسئول' : 'Responsible'}</th>
                <th className="p-2 text-center w-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-black">{isFa ? 'RPN جدید' : 'New RPN'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fmea.rows.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-2 font-medium text-slate-700 dark:text-slate-300">{row.itemFunction}</td>
                  <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{row.failureMode}</td>
                  <td className="p-2 text-slate-600 dark:text-slate-400">{row.failureEffects}</td>
                  <td className="p-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{row.severity}</td>
                  <td className="p-2 text-slate-600 dark:text-slate-400">{row.causesOfFailure}</td>
                  <td className="p-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{row.occurrence}</td>
                  <td className="p-2 text-slate-600 dark:text-slate-400">{row.currentControls}</td>
                  <td className="p-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{row.detection}</td>
                  <td className="p-2 text-center font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20">{row.rpn}</td>
                  <td className="p-2 text-slate-700 dark:text-slate-300 font-medium">{row.recommendedActions}</td>
                  <td className="p-2 text-slate-600 dark:text-slate-400">{row.responsibility}</td>
                  <td className="p-2 text-center font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20">{row.revisedRpn || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );

  const renderFtaDetails = (fta: FtaAssessment) => (
    <div className="space-y-4">
      {/* Top Event & System Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800">
          <span className="font-bold text-red-600 dark:text-red-400 block mb-1">
            {isFa ? 'رویداد رأس نامطلوب (Top Event):' : 'Top Undesired Event:'}
          </span>
          <span className="font-black text-red-800 dark:text-red-200 text-sm">
            {fta.topEventTitle}
          </span>
          {fta.topEventProbability && (
            <span className="block mt-1 font-mono text-[11px] text-red-700 dark:text-red-300" dir="ltr">
              P(Top Event) = {fta.topEventProbability.toExponential(2)}
            </span>
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'تعداد گره‌ها و گیت‌های منطقی:' : 'Logic Nodes & Gates:'}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            {fta.nodes.length} {isFa ? 'گره در ساختار درخت خطا' : 'Nodes'}
          </span>
        </div>
      </div>

      {/* FTA Logic Nodes Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="font-black text-xs text-slate-800 dark:text-slate-200">
            {isFa ? 'گره‌ها و گیت‌های منطقی درخت خطا (FTA Logic Nodes)' : 'Fault Tree Logic Nodes'}
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            {fta.nodes.length} {isFa ? 'گره منطقی' : 'Nodes'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                <th className="p-2.5 text-center w-10">#</th>
                <th className="p-2.5 text-center w-20">{isFa ? 'کد گره' : 'Code'}</th>
                <th className="p-2.5 min-w-[200px]">{isFa ? 'شرح رویداد / خطا' : 'Event Description'}</th>
                <th className="p-2.5 text-center w-28">{isFa ? 'نوع رویداد' : 'Event Type'}</th>
                <th className="p-2.5 text-center w-24">{isFa ? 'گیت منطقی' : 'Logic Gate'}</th>
                <th className="p-2.5 text-center w-28">{isFa ? 'احتمال وقوع' : 'Probability'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fta.nodes.map((node, idx) => (
                <tr key={node.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-2.5 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">{node.code || `N${idx + 1}`}</td>
                  <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{node.description}</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {node.type}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    {node.gateType ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        node.gateType === 'OR' 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                          : node.gateType === 'AND'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}>
                        {node.gateType}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">BASIC</span>
                    )}
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300" dir="ltr">
                    {node.probability !== undefined ? node.probability.toExponential(2) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );

  const renderHhaDetails = (hha: HhaAssessment) => (
    <div className="space-y-4">
      {/* Department & Headcount Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'دپارتمان / واحد شغلی تحت ارزیابی:' : 'Assessed Department:'}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            {hha.assessedDepartment || hha.unit}
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">
            {isFa ? 'تعداد افراد در معرض مواجهه شغلی:' : 'Headcount Exposed:'}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            {hha.headcountExposed} {isFa ? 'نفر شاغل' : 'Persons'}
          </span>
        </div>
      </div>

      {/* HHA Items Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="font-black text-xs text-slate-800 dark:text-slate-200">
            {isFa ? 'ماتریس شناسایی و ارزیابی خطرات بهداشت حرفه‌ای و طب کار (HHA)' : 'Health Hazard Assessment Matrix'}
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            {hha.items.length} {isFa ? 'عامل زیان‌آور' : 'Hazard Agents'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                <th className="p-2.5 text-center w-10">#</th>
                <th className="p-2.5 text-center w-24">{isFa ? 'دسته‌بندی' : 'Category'}</th>
                <th className="p-2.5 min-w-[130px]">{isFa ? 'عامل زیان‌آور' : 'Hazard Agent'}</th>
                <th className="p-2.5 min-w-[110px]">{isFa ? 'شغل / بخش' : 'Job Role / Area'}</th>
                <th className="p-2.5 min-w-[100px]">{isFa ? 'مسیر مواجهه' : 'Route'}</th>
                <th className="p-2.5 min-w-[110px]">{isFa ? 'اندازه‌گیری / OEL' : 'Measured / OEL'}</th>
                <th className="p-2.5 text-center w-24">{isFa ? 'سطح ریسک' : 'Risk Level'}</th>
                <th className="p-2.5 min-w-[160px]">{isFa ? 'اقدامات کنترلی پیشنهادی' : 'Proposed Controls'}</th>
                <th className="p-2.5 min-w-[120px]">{isFa ? 'آزمایش‌های طب کار' : 'Medical Tests'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {hha.items.map((item, idx) => {
                const itemCol = getRiskLevelColor(item.riskRating);
                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.hazardCategory}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{item.agentName}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      <div>{item.jobRole}</div>
                      <div className="text-[10px] text-slate-400">{item.workplaceArea}</div>
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px]">{item.exposureRoute}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px]" dir="ltr">
                      {item.measuredLevel || '-'} / {item.standardOel || '-'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${itemCol.badge}`}>
                        {isFa ? itemCol.labelFa : itemCol.labelEn}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">{item.proposedControls || item.existingControls}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px]">{item.targetMedicalTests || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Printable Sheet Container */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden print:max-w-none print:w-full print:max-h-none print:shadow-none print:border-none print:rounded-none print:text-black" dir={isFa ? 'rtl' : 'ltr'}>
        
        {/* ── Top Bar Controls (Hidden in print) ── */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'مشاهده و چاپ استاندارد سند ارزیابی ریسک' : 'Risk Assessment Standard Sheet'}
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {assessment.code} - {methodMeta.titleFa}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(assessment)}
              className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isFa ? 'ویرایش سند' : 'Edit Document'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isFa ? 'چاپ فرم (Print / PDF)' : 'Print / PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={isFa ? 'بستن' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Document Body (This is the official printed sheet) ── */}
        <div id="risk-assessment-printable-sheet" className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-0 print:overflow-visible print:space-y-4">
          
          {/* Header Form Layout (Official HSE-MS Standard) */}
          <div className="border-2 border-slate-800 dark:border-slate-200 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 print:border-black print:rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center border-b-2 border-slate-200 dark:border-slate-800 pb-4 print:border-black">
              {/* Logo (Only Logo, No Text) */}
              <div className="md:col-span-1 flex items-center justify-start min-h-[56px]">
                {branding.logoUrl ? (
                  <img 
                    src={branding.logoUrl} 
                    alt="Official Logo" 
                    className="max-h-14 max-w-full object-contain select-none"
                    style={{
                      height: `${branding.logoHeightPrintMm || 16}mm`,
                      imageRendering: 'auto'
                    }}
                  />
                ) : (
                  <HseLogo size="md" forceDefault={true} showShadow={false} />
                )}
              </div>

              {/* Document Title Center */}
              <div className="md:col-span-2 text-center">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isFa ? `فرم استاندارد ارزیابی ریسک به روش ${assessment.method}` : `${assessment.method} Risk Assessment Form`}
                </h2>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                  {isFa ? methodMeta.titleFa : methodMeta.titleEn}
                </p>
              </div>

              {/* Doc Control Box Right */}
              <div className="md:col-span-1 text-left md:text-left text-[11px] font-mono space-y-1 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 print:bg-white print:border-black">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-slate-500">{isFa ? 'کد سند:' : 'Doc Code:'}</span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">{assessment.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-slate-500">{isFa ? 'ویرایش:' : 'Rev:'}</span>
                  <span className="font-bold">01</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-slate-500">{isFa ? 'تاریخ ارزیابی:' : 'Date:'}</span>
                  <span className="font-bold">{assessment.assessmentDate}</span>
                </div>
              </div>
            </div>

            {/* Assessment Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'عنوان ارزیابی:' : 'Assessment Title:'}
                </span>
                <span className="font-black text-slate-900 dark:text-white block">
                  {assessment.title}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'سایت / واحد عملیاتی:' : 'Site / Unit:'}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {assessment.site} - {assessment.unit}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'موقعیت مکانی دقیق:' : 'Specific Location:'}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {assessment.areaLocation}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'سطح ریسک کلی:' : 'Overall Risk Level:'}
                </span>
                <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-black ${overallColors.badge}`}>
                  {isFa ? overallColors.labelFa : overallColors.labelEn}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'سرپرست ارزیابی:' : 'Lead Assessor:'}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {assessment.assessorName}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'اعضای تیم ارزیابی ریسک:' : 'Assessment Team Members:'}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {assessment.teamMembers && assessment.teamMembers.length > 0 
                    ? assessment.teamMembers.join('، ') 
                    : (isFa ? 'ثبت نشده' : 'None')}
                </span>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                  {isFa ? 'وضعیت سند:' : 'Document Status:'}
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 block">
                  {isFa ? 'تأییدشده و لازم‌الاجرا' : 'Approved & Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Method Specific Main Content */}
          <div className="space-y-4">
            {assessment.method === 'JSA' && renderJsaDetails(assessment as JsaAssessment)}
            {assessment.method === 'FMEA' && renderFmeaDetails(assessment as FmeaAssessment)}
            {assessment.method === 'FTA' && renderFtaDetails(assessment as FtaAssessment)}
            {assessment.method === 'HHA' && renderHhaDetails(assessment as HhaAssessment)}
          </div>

          {/* Control Hierarchy & Legend */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 print:bg-white print:border-black">
            <h5 className="font-black text-slate-800 dark:text-slate-200">
              {isFa ? 'سلسله‌مراتب تدابیر کنترلی استاندارد (Hierarchy of Controls):' : 'Hierarchy of Controls:'}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px] font-bold text-center">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                1. {isFa ? 'حذف خطر (Elimination)' : 'Elimination'}
              </div>
              <div className="p-2 rounded-lg bg-teal-100 text-teal-900 border border-teal-300">
                2. {isFa ? 'جایگزینی (Substitution)' : 'Substitution'}
              </div>
              <div className="p-2 rounded-lg bg-sky-100 text-sky-900 border border-sky-300">
                3. {isFa ? 'کنترل‌های مهندسی' : 'Engineering Controls'}
              </div>
              <div className="p-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                4. {isFa ? 'کنترل‌های اداری و TBT' : 'Administrative Controls'}
              </div>
              <div className="p-2 rounded-lg bg-purple-100 text-purple-900 border border-purple-300">
                5. {isFa ? 'تجهیزات حفاظت فردی (PPE)' : 'Personal Protective Equipment'}
              </div>
            </div>
          </div>

          {/* Sign-off / Signatures Block */}
          <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs print:border-black">
            <div className="space-y-6">
              <div className="font-bold text-slate-600 dark:text-slate-400">
                {isFa ? 'ارزیاب / سرپرست تیم ارزیابی' : 'Lead Assessor Signature'}
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {assessment.assessorName || (isFa ? 'ثبت نشده' : 'Not recorded')}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {assessment.assessmentDate}
              </div>
            </div>

            <div className="space-y-6 sm:border-r sm:border-l border-slate-200 dark:border-slate-700 print:border-black">
              <div className="font-bold text-slate-600 dark:text-slate-400">
                {isFa ? 'سرپرست ایمنی فرآیند / مهندس HSE' : 'Process Safety / HSE Engineer'}
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {assessment.hseEngineerName || (isFa ? 'ثبت نشده' : 'Not recorded')}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {assessment.assessmentDate}
              </div>
            </div>

            <div className="space-y-6">
              <div className="font-bold text-slate-600 dark:text-slate-400">
                {isFa ? 'تصویب‌کننده نهایی (مدیر واحد / مجتمع)' : 'Approver (Unit / Plant Manager)'}
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {assessment.approverName || (isFa ? 'ثبت نشده' : 'Not recorded')}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {assessment.assessmentDate}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

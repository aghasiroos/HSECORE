import React from 'react';
import {
  Save,
  UploadCloud,
  Download,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Scan,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Plus,
  Trash2,
  MousePointer,
  Hand,
  SlidersHorizontal,
  FileCode,
  Layers,
  ChevronDown,
  Users
} from 'lucide-react';

interface Props {
  language: 'fa' | 'en';
  processName: string;
  setProcessName: (name: string) => void;
  moduleType: string;
  setModuleType: (type: string) => void;
  availableWorkflows: any[];
  onLoadTemplate: (id: string) => void;
  onNewDiagram: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoomReset: () => void;
  onDeleteSelected: () => void;
  onImportClick: () => void;
  onExportXml: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onSaveCustom: () => void;
  onDeploy: () => void;
  isSaving: boolean;
  isDeploying: boolean;
  onValidate: () => void;
  validationIssueCount: number;
  liveTrackingActive: boolean;
  onToggleLiveTracking: () => void;
  showProperties: boolean;
  onToggleProperties: () => void;
  onOpenApproverMatrix?: () => void;
  approverCount?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function BpmnToolbar({
  language,
  processName,
  setProcessName,
  moduleType,
  setModuleType,
  availableWorkflows,
  onLoadTemplate,
  onNewDiagram,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onZoomReset,
  onDeleteSelected,
  onImportClick,
  onExportXml,
  onExportSvg,
  onExportPng,
  onSaveCustom,
  onDeploy,
  isSaving,
  isDeploying,
  onValidate,
  validationIssueCount,
  liveTrackingActive,
  onToggleLiveTracking,
  showProperties,
  onToggleProperties,
  onOpenApproverMatrix,
  approverCount,
  isFullscreen = false,
  onToggleFullscreen
}: Props) {
  const isFa = language === 'fa';

  return (
    <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
      {/* Primary Top Bar */}
      <div className="flex flex-wrap items-center justify-between p-2.5 px-3.5 gap-2.5">
        {/* Left: Process Identity & Metadata */}
        <div className="flex flex-wrap items-center gap-2">
          {/* New Diagram */}
          <button
            onClick={onNewDiagram}
            title={isFa ? 'ایجاد فرآیند خام جدید' : 'New Diagram'}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">{isFa ? 'فرآیند نو' : 'New'}</span>
          </button>

          {/* Process Name Input */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder={isFa ? 'نام فرآیند...' : 'Process name...'}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none w-44 md:w-56 font-bold truncate"
              title={isFa ? 'نام فرآیند را وارد کنید' : 'Process Name'}
            />
          </div>

          {/* Module Type Selector */}
          <select
            value={moduleType}
            onChange={(e) => setModuleType(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer max-w-[160px] md:max-w-[210px] font-medium"
          >
            <option value="ptw-management">{isFa ? 'پروانه کار (PTW)' : 'Permit to Work'}</option>
            <option value="safety-checklists">{isFa ? 'چک‌لیست‌های عملیاتی ایمنی' : 'Operational Safety Checklists'}</option>
            <option value="incident-report">{isFa ? 'ناهنجاری و حوادث (RCA)' : 'Incidents & RCA'}</option>
            <option value="risk-assessment">{isFa ? 'ارزیابی ریسک و JSA' : 'Risk Assessment'}</option>
            <option value="ppe-management">{isFa ? 'تجهیزات حفاظت فردی (PPE)' : 'PPE Management'}</option>
            <option value="safety-warning">{isFa ? 'اخطارهای کتبی ایمنی' : 'Safety Warning'}</option>
            <option value="training-management">{isFa ? 'آموزش و گواهینامه‌ها' : 'Training'}</option>
            <option value="ptw-audit">{isFa ? 'ممیزی پروانه کار ۳۰ گانه' : 'PTW Audit'}</option>
            <option value="periodic-exams">{isFa ? 'معاینات ادواری طب کار' : 'Periodic Medical Exams'}</option>
            <option value="non-periodic-exams">{isFa ? 'معاینات بدو استخدام' : 'Pre-Employment Medical'}</option>
            <option value="waste-management">{isFa ? 'مدیریت پسماند ویژه (EMP)' : 'Hazardous Waste'}</option>
            <option value="env-monitoring">{isFa ? 'پایش دودکش و محیط زیست' : 'Environmental'}</option>
            <option value="wastewater">{isFa ? 'کنترل کیفی پساب و ETP' : 'Wastewater ETP'}</option>
            <option value="five-s">{isFa ? 'نظام آراستگی ۵S' : '5S System'}</option>
            <option value="fire-dept">{isFa ? 'ناوگان آتش‌نشانی' : 'Fire Dept'}</option>
            <option value="emergency-alert">{isFa ? 'واکنش در شرایط اضطراری و مانور' : 'Emergency & ERP'}</option>
          </select>

          {/* Quick-load saved workflow */}
          {availableWorkflows && availableWorkflows.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 bg-blue-50/80 dark:bg-blue-900/30 px-2 py-1 rounded-xl border border-blue-200/80 dark:border-blue-800/40">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <select
                onChange={(e) => {
                  if (e.target.value) onLoadTemplate(e.target.value);
                }}
                defaultValue=""
                className="bg-transparent text-xs text-blue-800 dark:text-blue-300 font-bold outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="" disabled>{isFa ? 'بارگذاری فرآیند...' : 'Load Process...'}</option>
                {availableWorkflows.map(wf => (
                  <option key={wf.id} value={wf.id} className="text-slate-800 bg-white">
                    {wf.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Actions & Integration */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Validation Button */}
          <button
            onClick={onValidate}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              validationIssueCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title={isFa ? 'اعتبارسنجی ساختار فرآیند' : 'Validate BPMN'}
          >
            {validationIssueCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isFa ? 'اعتبارسنجی' : 'Validate'}</span>
            {validationIssueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-white">
                {validationIssueCount}
              </span>
            )}
          </button>

          {/* Live Tracking Toggle */}
          <button
            onClick={onToggleLiveTracking}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              liveTrackingActive
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm shadow-blue-500/20 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title={isFa ? 'رهگیری زنده اجرای فرآیند در سایت' : 'Toggle Live Execution Tracking'}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isFa ? 'رهگیری زنده' : 'Live Tracking'}</span>
          </button>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          {/* Save to System */}
          <button
            onClick={onSaveCustom}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
            title={isFa ? 'ذخیره در پایگاه داده سازمانی (Ctrl+S)' : 'Save Workflow (Ctrl+S)'}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? '...' : (isFa ? 'ذخیره' : 'Save')}</span>
          </button>

          {/* Deploy to Camunda 8 */}
          <button
            onClick={onDeploy}
            disabled={isDeploying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50"
            title={isFa ? 'انتشار فرآیند در موتور Camunda 8' : 'Deploy to Camunda 8 Engine'}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{isDeploying ? '...' : (isFa ? 'انتشار' : 'Deploy')}</span>
          </button>

          {/* Approvers & Assignees Configuration */}
          {onOpenApproverMatrix && (
            <button
              onClick={onOpenApproverMatrix}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/90 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all text-xs font-bold shadow-2xs"
              title={isFa ? 'تخصیص و مدیریت تأییدکنندگان گردش‌کار' : 'Configure Workflow Approvers'}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isFa ? 'تخصیص تأییدکنندگان' : 'Approvers'}</span>
              {approverCount !== undefined && approverCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-mono">
                  {approverCount}
                </span>
              )}
            </button>
          )}

          {/* Properties Panel Toggle */}
          <button
            onClick={onToggleProperties}
            className={`p-1.5 rounded-xl border transition-all ${
              showProperties
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title={isFa ? 'نمایش/مخفی‌سازی پنل ویژگی‌ها' : 'Toggle Properties Panel'}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary Ribbon: Modeler Controls & Shortcuts (Matching bpmn.io) */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-1.5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200/60 dark:border-slate-800 text-xs">
        {/* Undo/Redo & Zoom Group */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title={isFa ? 'بازگشت به عقب (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title={isFa ? 'انجام مجدد (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            onClick={onZoomIn}
            title={isFa ? 'بزرگ‌نمایی (+)' : 'Zoom In (+)'}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onZoomOut}
            title={isFa ? 'کوچک‌نمایی (-)' : 'Zoom Out (-)'}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onZoomFit}
            title={isFa ? 'تراز و متناسب‌سازی با بوم (Ctrl+0)' : 'Fit to Viewport (Ctrl+0)'}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <Scan className="w-3.5 h-3.5" />
          </button>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={
                isFullscreen
                  ? (isFa ? 'خروج از حالت تمام‌صفحه (Esc)' : 'Exit Fullscreen (Esc)')
                  : (isFa ? 'حالت تمام‌صفحه و گسترده (فول‌اسکرین)' : 'Toggle Fullscreen Mode')
              }
              className={`p-1 rounded-lg transition-all ${
                isFullscreen
                  ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 ring-2 ring-blue-400/50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700'
              }`}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-white" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={onZoomReset}
            title={isFa ? 'اندازه پیش‌فرض (1:1)' : 'Reset Zoom (1:1)'}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            100%
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            onClick={onDeleteSelected}
            title={isFa ? 'حذف عنصر انتخاب‌شده (Delete)' : 'Delete Selected (Del)'}
            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Import & Export Tools (bpmn.io style) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onImportClick}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors text-[11px] font-medium"
            title={isFa ? 'ورود فایل BPMN یا XML' : 'Import BPMN 2.0 XML'}
          >
            <Upload className="w-3 h-3 text-slate-500" />
            <span>{isFa ? 'ورود فایل' : 'Import'}</span>
          </button>

          <button
            onClick={onExportXml}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors text-[11px] font-medium font-mono"
            title={isFa ? 'دانلود فایل BPMN 2.0 XML' : 'Download BPMN XML'}
          >
            <FileCode className="w-3 h-3 text-slate-500" />
            <span>XML</span>
          </button>

          <button
            onClick={onExportSvg}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors text-[11px] font-medium font-mono"
            title={isFa ? 'دانلود خروجی وکتور SVG' : 'Download SVG'}
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span>SVG</span>
          </button>

          <button
            onClick={onExportPng}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors text-[11px] font-medium font-mono"
            title={isFa ? 'دانلود تصویر شطرنجی PNG' : 'Download PNG'}
          >
            <ImageIcon className="w-3 h-3 text-slate-500" />
            <span>PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
}

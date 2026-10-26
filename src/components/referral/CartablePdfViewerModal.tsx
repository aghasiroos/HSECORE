import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Lock,
  Download,
  Copy,
  Check,
  Eye,
  Calendar,
  User,
  Building,
  Tag,
  Flame,
  HardHat,
  FileSpreadsheet,
  Layers,
  Sparkles
} from 'lucide-react';
import { DocumentReferral, DocumentSourceType, ReferralAssignee } from '../../types';
import { canUserActOnAssignee } from '../../utils/referralHelper';
import { PrintDocumentSignaturesBox } from './PrintDocumentSignaturesBox';
import { HseLogo } from '../HseLogo';
import { apiDb } from '../../services/apiDatabaseClient';

interface CartablePdfViewerModalProps {
  referral: DocumentReferral;
  isFa?: boolean;
  onClose: () => void;
  onTakeAction?: (referral: DocumentReferral, assignee?: ReferralAssignee) => void;
  currentUser?: any;
}

export const CartablePdfViewerModal: React.FC<CartablePdfViewerModalProps> = ({
  referral,
  isFa = true,
  onClose,
  onTakeAction,
  currentUser
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [documentContent, setDocumentContent] = useState<any>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Load underlying document content from central database (with fallback to referral metadata)
  useEffect(() => {
    let isMounted = true;
    const loadDocFromDb = async () => {
      try {
        const { documentType, documentId, documentNumber } = referral;
        const matchDoc = (item: any, numField?: string) =>
          String(item?.id) === String(documentId) ||
          (numField && item?.[numField] && String(item[numField]) === String(documentNumber)) ||
          (item?.code && String(item.code) === String(documentNumber));

        if (documentType === 'PERMIT' || (documentType as string) === 'PTW' || documentType === 'FIRE_PERMIT') {
          const list = await apiDb.getWorkPermits();
          const found = Array.isArray(list) ? list.find((p: any) => matchDoc(p, 'permitNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        } else if (documentType === 'INCIDENT' || documentType === 'INCIDENT_SUPPLEMENT') {
          const list = await apiDb.getIncidents();
          const found = Array.isArray(list) ? list.find((i: any) => matchDoc(i, 'incidentNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        } else if (documentType === 'SAFETY_WARNING' || documentType === 'WARNING') {
          const list = await apiDb.getSafetyWarnings();
          const found = Array.isArray(list) ? list.find((w: any) => matchDoc(w, 'warningNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        } else if (documentType === 'RISK_ASSESSMENT') {
          const list = await apiDb.getRiskAssessments();
          const found = Array.isArray(list) ? list.find((r: any) => matchDoc(r, 'assessmentNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        } else if (documentType === 'NON_CONFORMANCE') {
          const list = await apiDb.getNonConformances();
          const found = Array.isArray(list) ? list.find((nc: any) => matchDoc(nc, 'ncNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        } else if (documentType === 'PTW_AUDIT') {
          const list = await apiDb.getPtwAuditRecords();
          const found = Array.isArray(list) ? list.find((a: any) => matchDoc(a, 'auditNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        } else if (documentType === 'AUDIT_CHECKLIST') {
          const list = await apiDb.getSafetyInspections();
          const found = Array.isArray(list) ? list.find((s: any) => matchDoc(s, 'inspectionNumber')) : null;
          if (isMounted && found) setDocumentContent(found);
        }
      } catch {
        // Fallback to referral metadata
      }
    };
    loadDocFromDb();
    return () => {
      isMounted = false;
    };
  }, [referral]);

  // Handle direct browser print for PDF export
  const handlePrint = () => {
    window.print();
  };

  const handleCopyDocNumber = () => {
    navigator.clipboard.writeText(referral.documentNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const docTypeLabels: Record<DocumentSourceType, { fa: string; en: string; icon: any; color: string }> = {
    PERMIT: { fa: 'پروانه کار ایمن (PTW)', en: 'Permit To Work', icon: ShieldCheck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    PTW_AUDIT: { fa: 'ممیزی پروانه کار', en: 'PTW Audit', icon: ShieldCheck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    NON_CONFORMANCE: { fa: 'پرونده عدم انطباق و اقدامات اصلاحی (CAPA)', en: 'Non-Conformance & CAPA', icon: ShieldCheck, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200' },
    INCIDENT: { fa: 'گزارش رویداد و حادثه', en: 'Incident Report', icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200' },
    INCIDENT_SUPPLEMENT: { fa: 'فرم تکمیلی گزارش رویداد', en: 'Incident Supplement', icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200' },
    AUDIT_CHECKLIST: { fa: 'چک‌لیست ممیزی و بازرسی ایمنی', en: 'Safety Audit Checklist', icon: CheckCircle2, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
    SAFETY_WARNING: { fa: 'اخطار کتبی عدم انطباق ایمنی', en: 'Safety Warning Notice', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    WARNING: { fa: 'اخطار و تذکر انضباطی', en: 'Disciplinary Warning', icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    RISK_ASSESSMENT: { fa: 'ارزیابی ریسک و شناسایی خطرات', en: 'Risk Assessment (JSA/HIRA)', icon: Layers, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200' },
    PPE_REQUEST: { fa: 'فرم درخواست و تحویل تجهیزات حفاظت فردی', en: 'PPE Request Form', icon: HardHat, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
    FIRE_PERMIT: { fa: 'پروانه و مجوز آتش‌نشانی', en: 'Fire Permit', icon: Flame, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200' },
    OTHER_DOC: { fa: 'سند رسمی و دستورالعمل', en: 'Official Document', icon: FileText, color: 'text-slate-600 bg-slate-50 dark:bg-slate-950/40 border-slate-200' }
  };

  const currentTypeMeta = docTypeLabels[referral.documentType] || docTypeLabels.OTHER_DOC;
  const TypeIcon = currentTypeMeta.icon;

  const priorityMeta = {
    LOW: { fa: 'عادی', color: 'text-slate-700 bg-slate-100 dark:bg-slate-800' },
    MEDIUM: { fa: 'متوسط', color: 'text-blue-700 bg-blue-100 dark:bg-blue-900/50' },
    HIGH: { fa: 'فوری', color: 'text-amber-800 bg-amber-100 dark:bg-amber-900/50' },
    CRITICAL: { fa: 'خیلی فوری / بحرانی', color: 'text-rose-800 bg-rose-100 dark:bg-rose-900/50' }
  };

  // Find if current user has an authorized active pending action
  const myPendingAssignee = useMemo(() => {
    if (!currentUser) return undefined;
    return referral.assignees.find(a => canUserActOnAssignee(currentUser, referral, a).allowed);
  }, [referral, currentUser]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      <div
        className={`bg-slate-100 dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col transition-all duration-300 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[92vh]'
        }`}
      >
        {/* TOP TOOLBAR: View-Only PDF Controls */}
        <div className="px-4 py-3 bg-slate-900 text-white rounded-t-3xl flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-white truncate max-w-[220px] sm:max-w-md">
                  {referral.documentTitle}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {isFa ? 'فقط قابل مشاهده (View Only)' : 'View Only'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                <span>{referral.documentNumber}</span>
                <span>•</span>
                <span>{referral.createdDatePersian}</span>
                {referral.version && (
                  <>
                    <span>•</span>
                    <span className="text-blue-300">{referral.version}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Copy Doc ID */}
            <button
              type="button"
              onClick={handleCopyDocNumber}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
              title={isFa ? 'کپی شماره سند' : 'Copy Number'}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Zoom Out */}
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(60, prev - 15))}
              disabled={zoomLevel <= 60}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition cursor-pointer"
              title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="font-mono text-xs font-bold text-slate-300 px-1">{zoomLevel}%</span>

            {/* Zoom In */}
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
              disabled={zoomLevel >= 150}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition cursor-pointer"
              title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer hidden sm:flex"
              title={isFullscreen ? (isFa ? 'خروج از تمام‌صفحه' : 'Exit Fullscreen') : isFa ? 'تمام‌صفحه' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Print / Save as PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{isFa ? 'چاپ / خروجی PDF' : 'Print / PDF'}</span>
            </button>

            {/* Action button if user has pending turn */}
            {myPendingAssignee && onTakeAction && (
              <button
                type="button"
                onClick={() => onTakeAction(referral, myPendingAssignee)}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isFa ? 'ثبت اقدام و امضا' : 'Action / Sign'}</span>
              </button>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
              title={isFa ? 'بستن' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* DOCUMENT PREVIEW CONTAINER (A4 Simulation View) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/80 dark:bg-slate-950/70 flex justify-center custom-scrollbar">
          <div
            ref={printContainerRef}
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full max-w-[820px] min-h-[1080px] bg-white text-slate-900 shadow-2xl rounded-xl border border-slate-300 p-8 sm:p-12 relative flex flex-col justify-between print:shadow-none print:border-none print:w-full print:m-0 print:p-6 select-text"
          >
            {/* Watermark for View-Only Security */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.035] select-none rotate-[-35deg]">
              <span className="text-6xl sm:text-7xl font-black text-slate-900 uppercase tracking-widest text-center">
                HSECORE DIGITAL CARTABLE<br />VIEW ONLY • غیرقابل ویرایش
              </span>
            </div>

            <div>
              {/* 1. OFFICIAL LETTERHEAD / HEADER */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Right: Emblem / Company */}
                  <div className="flex items-center gap-3">
                    <HseLogo className="w-14 h-14 text-blue-700" />
                    <div>
                      <h1 className="text-base font-black text-slate-900 leading-tight">
                        سامانه جامع مدیریت سلامت، ایمنی و محیط زیست (HSECORE)
                      </h1>
                      <h2 className="text-xs font-bold text-slate-600 mt-0.5">
                        {isFa ? 'کارتابل الکترونیک گردش اسناد، پروانه‌ها و فرم‌های اجرایی' : 'Enterprise Document & Workflow Cartable'}
                      </h2>
                      <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold border bg-slate-50 text-slate-700 border-slate-300">
                        <TypeIcon className="w-3.5 h-3.5" />
                        <span>{currentTypeMeta.fa}</span>
                      </div>
                    </div>
                  </div>

                  {/* Left: Document Metadata Box */}
                  <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50 text-[11px] space-y-1 font-mono shrink-0 min-w-[170px] text-right">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-sans">شماره سند:</span>
                      <strong className="text-slate-900">{referral.documentNumber}</strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-sans">تاریخ ثبت:</span>
                      <span>{referral.createdDatePersian}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-sans">نسخه:</span>
                      <span>{referral.version || 'Rev 1.0'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-sans">اولویت:</span>
                      <span className="font-bold text-amber-700">{priorityMeta[referral.priority]?.fa || 'عادی'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-sans">طبقه‌بندی:</span>
                      <span className="font-bold text-slate-700">محرمانه / سازمانی</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. REFERRAL DISPATCH & INSTRUCTION BANNER */}
              <div className="mb-6 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Send className="w-4 h-4 text-blue-700" />
                    <span>مشخصات ارجاع و گردش‌کار الکترونیک</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    حالت گردش: <strong className="text-slate-800">{referral.workflowMode === 'SEQUENTIAL' ? 'ترتیبی و مرحله‌ای' : 'موازی و همزمان'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">ارجاع‌دهنده (فرستنده):</span>
                    <strong className="text-slate-900">{referral.senderName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">سمت / واحد سازمانی:</span>
                    <span>{referral.senderRole || referral.senderDepartment || 'مدیریت HSE'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">مهلت اقدام:</span>
                    <span className="font-mono font-bold text-amber-700">{referral.deadline || 'تعیین نشده'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">وضعیت گردش کار:</span>
                    <span
                      className={`font-bold ${
                        referral.overallStatus === 'COMPLETED'
                          ? 'text-emerald-700'
                          : referral.overallStatus === 'REJECTED'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {referral.overallStatus === 'COMPLETED'
                        ? 'تکمیل و مختومه'
                        : referral.overallStatus === 'REJECTED'
                        ? 'مردود شده'
                        : 'در جریان بررسی و امضا'}
                    </span>
                  </div>
                </div>

                {referral.notes && (
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 text-xs leading-relaxed">
                    <strong className="text-slate-900 block mb-0.5">توضیحات و دستور اقدام ارجاع‌دهنده:</strong>
                    {referral.notes}
                  </div>
                )}
              </div>

              {/* 3. CORE DOCUMENT BODY (PAYLOAD) */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5">
                  <FileText className="w-4 h-4 text-slate-800" />
                  <h3 className="font-black text-sm text-slate-900">
                    محتوای رسمی سند: {referral.documentTitle}
                  </h3>
                </div>

                {/* A. If PTW document details exist */}
                {(referral.documentType === 'PERMIT' || (referral.documentType as string) === 'PTW') && (
                  <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-500 block text-[11px]">نوع پروانه کار:</span>
                        <strong className="text-slate-900">{documentContent?.permitType || 'پروانه کار گرم / سرد'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">محل دقیق عملیات:</span>
                        <strong className="text-slate-900">{documentContent?.location || documentContent?.unit || 'سایت صنعتی و پالایشگاهی'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">مجری / پیمانکار:</span>
                        <strong className="text-slate-900">{documentContent?.contractor || documentContent?.executor || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">سرپرست اجرا:</span>
                        <span>{documentContent?.supervisor || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">اعتبار زمانی:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {documentContent?.startDate || referral.createdDatePersian} الی {documentContent?.endDate || 'پایان نوبت کاری'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">تست گاز و ارزیابی اتمسفر:</span>
                        <span className="text-emerald-700 font-bold">{documentContent?.gasTestDone ? 'انجام و تایید شد' : 'ثبت در چک‌لیست ضمیمه'}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <span className="text-slate-500 block text-[11px] mb-1">شرح کامل فعالیت و تمهیدات ایمنی:</span>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                        {documentContent?.description ||
                          documentContent?.workDescription ||
                          'کلیه تمهیدات ایمنی شامل قطع انرژی (LOTO)، تجهیزات اطفای حریق، گازسنجی دوره‌ای و نظارت مستمر افسر ایمنی بررسی و الزامات رعایت گردیده است.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* B. If Incident document details exist */}
                {(referral.documentType === 'INCIDENT' || referral.documentType === 'INCIDENT_SUPPLEMENT') && (
                  <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-500 block text-[11px]">نوع رویداد:</span>
                        <strong className="text-rose-700">{documentContent?.incidentType || 'شبه‌حادثه / حادثه شغلی'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">سطح شدت رویداد:</span>
                        <strong className="text-slate-900">{documentContent?.severity || 'متوسط (سطح ۲)'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">زمان و تاریخ وقوع:</span>
                        <span className="font-mono">{documentContent?.incidentDate || referral.createdDatePersian}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">واحد / محل وقوع:</span>
                        <span>{documentContent?.location || 'محوطه عملیاتی'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">تعداد مصدومان:</span>
                        <span className="font-bold">{documentContent?.injuredCount !== undefined ? documentContent.injuredCount : '۰ (بدون آسیب جانی)'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">وضعیت بررسی و ریشه‌یابی:</span>
                        <span className="text-blue-700 font-bold">{documentContent?.status || 'در جریان بررسی تیم RCA'}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <span className="text-slate-500 block text-[11px] mb-1">شرح واقعه و اقدامات اصلاحی فوری:</span>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                        {documentContent?.description ||
                          documentContent?.rootCause ||
                          'گزارش اولیه ثبت و اقدامات مهار مخاطره، ایمن‌سازی محیط و ثبت شواهد فنی جهت تکمیل فرم جامع تحلیل علل ریشه‌ای (RCA) انجام گردیده است.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* C. If Safety Warning / Disciplinary details */}
                {(referral.documentType === 'SAFETY_WARNING' || referral.documentType === 'WARNING') && (
                  <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-500 block text-[11px]">شخص / پیمانکار متخلف:</span>
                        <strong className="text-slate-900">{documentContent?.recipientName || 'پرسنل / شرکت پیمانکار'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">نوع عدم انطباق:</span>
                        <strong className="text-amber-700">{documentContent?.warningType || 'عدم استفاده از تجهیزات حفاظت فردی'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">درجه اخطار:</span>
                        <span className="font-bold text-rose-700">{documentContent?.level || 'کتبی درجه ۱'}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <span className="text-slate-500 block text-[11px] mb-1">متن اخطار و دستور اصلاح:</span>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                        {documentContent?.description ||
                          documentContent?.text ||
                          'پیرو بازرسی ایمنی و مشاهده عدم انطباق با آیین‌نامه‌های مصوب حفاظت فنی، اخطار کتبی صادر و مهلت مقرر جهت رفع نقص و ارایه گزارش به اداره HSE ابلاغ می‌گردد.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* D. General / Risk / Other fallback view */}
                {!['PTW', 'INCIDENT', 'INCIDENT_SUPPLEMENT', 'SAFETY_WARNING', 'WARNING'].includes(referral.documentType) && (
                  <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-500 block text-[11px]">عنوان سند ارجاعی:</span>
                        <strong className="text-slate-900">{referral.documentTitle}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">شناسه ارجاع:</span>
                        <span className="font-mono">{referral.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">تاریخ اعتبار / اقدام:</span>
                        <span className="font-mono">{referral.deadline || referral.createdDatePersian}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <span className="text-slate-500 block text-[11px] mb-1">شرح مفاد و الزامات سند:</span>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                        {referral.notes ||
                          'این سند جهت بررسی کارشناسی، کنترل انطباق با ضوابط HSE و اخذ تاییدات سلسله‌مراتبی به مسئولان مربوطه ارسال گردیده است.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. OFFICIAL DIGITAL SIGNATURES & APPROVAL MATRIX */}
              <div className="mt-6">
                <PrintDocumentSignaturesBox
                  documentType={referral.documentType}
                  documentId={referral.documentId}
                  isFa={isFa}
                  title="ماتریس تاییدات، امضاهای دیجیتال و احراز اصالت الکترونیکی سند"
                />
              </div>

              {/* 5. WORKFLOW ASSIGNEES TIMELINE / LOG */}
              <div className="mt-6 border border-slate-300 rounded-lg overflow-hidden bg-white text-[11px]">
                <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 flex items-center justify-between border-b border-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-700" />
                    <span>سوابق اقدامات و گیرندگان در فرآیند ارجاع</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    تعداد مراحل: {referral.assignees.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-200">
                  {referral.assignees.map((asg, idx) => (
                    <div key={asg.id} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="text-slate-900">{asg.userName}</strong>
                          <span className="text-slate-500 mr-2 text-[10px]">
                            ({asg.userRole || asg.userJobTitle || 'مسئول بررسی'})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {asg.statusDate && <span className="font-mono text-[10px] text-slate-500">{asg.statusDate}</span>}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            asg.status === 'SIGNED'
                              ? 'bg-purple-100 text-purple-800'
                              : asg.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : asg.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : asg.status === 'DELEGATED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {asg.status === 'SIGNED'
                            ? 'امضا شده'
                            : asg.status === 'APPROVED'
                            ? 'تأیید شده'
                            : asg.status === 'REJECTED'
                            ? 'رد شده'
                            : asg.status === 'DELEGATED'
                            ? 'ارجاع مجدد'
                            : 'در انتظار اقدام'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. OFFICIAL FOOTER */}
            <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-center justify-between text-[10px] text-slate-600 font-mono">
              <div>
                <span>تولید شده توسط سامانه یکپارچه HSECORE</span>
                <span className="mr-2">|</span>
                <span className="mr-2">شناسه اصالت: {referral.id.slice(0, 16).toUpperCase()}</span>
              </div>
              <div>
                <span>صفحه ۱ از ۱</span>
                <span className="mr-2">|</span>
                <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM STATUS BAR */}
        <div className="px-5 py-2.5 bg-slate-900 text-slate-400 text-xs border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">
              {isFa
                ? 'حالت نمایش امن: کلیه اطلاعات در وضعیت غیرقابل ویرایش (Read-Only) می‌باشند.'
                : 'Secure Read-Only Mode: All document fields are locked against modifications.'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono">Zoom: {zoomLevel}%</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              {isFa ? 'بستن پنجره' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

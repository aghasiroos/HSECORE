import React, { useState } from 'react';
import { X, Award, Check, AlertCircle } from 'lucide-react';
import { QualificationCertificateItem } from '../../types/personnelDossierTypes';
import { personnelDossierService } from '../../services/personnelDossierService';

interface PersonnelQualificationModalProps {
  personnelCode: string;
  personnelName: string;
  isFa: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function PersonnelQualificationModal({
  personnelCode,
  personnelName,
  isFa,
  onClose,
  onSaved
}: PersonnelQualificationModalProps) {
  const [certificateName, setCertificateName] = useState<string>('');
  const [category, setCategory] = useState<QualificationCertificateItem['category']>('CRITICAL_WORKS');
  const [issuingAuthority, setIssuingAuthority] = useState<string>('مرکز تحقیقات و تعلیمات حفاظت فنی و بهداشت کار');
  const [certificateNumber, setCertificateNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [scoreOrGrade, setScoreOrGrade] = useState<string>('قبول با درجه عالی');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSave = () => {
    if (!certificateName.trim()) {
      setErrorMsg(isFa ? 'لطفاً عنوان گواهینامه یا صلاحیت را وارد نمایید.' : 'Please enter certificate title.');
      return;
    }

    try {
      personnelDossierService.addQualification({
        personnelCode,
        certificateName: certificateName.trim(),
        category,
        issuingAuthority: issuingAuthority.trim() || 'مرجع رسمی',
        certificateNumber: certificateNumber.trim() || `CERT-${Date.now().toString().slice(-6)}`,
        issueDate,
        expiryDate: expiryDate || undefined,
        isValid: true,
        scoreOrGrade: scoreOrGrade.trim()
      });

      onSaved();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'خطا در ثبت صلاحیت');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">
                {isFa ? 'ثبت مجوز، گواهینامه و صلاحیت شغلی' : 'Add Professional Qualification'}
              </h3>
              <p className="text-xs text-slate-400">
                {personnelName} (کد: {personnelCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] text-slate-800 dark:text-slate-100">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
              {isFa ? 'عنوان صلاحیت یا گواهینامه *:' : 'Certificate Title *:'}
            </label>
            <input
              type="text"
              value={certificateName}
              onChange={(e) => setCertificateName(e.target.value)}
              placeholder={isFa ? 'مثال: گواهینامه رانندگی لیفتراک، بازرسی جوش NDT، داربست‌بندی...' : 'e.g. Forklift License...'}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'رسته صلاحیت:' : 'Category:'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CRITICAL_WORKS">کارهای ویژه و بحرانی (ارتفاع، فضای بسته)</option>
                <option value="HEAVY_MACHINERY">ماشین‌آلات سنگین، جرثقیل و بالابر</option>
                <option value="FIRE_SAFETY">اطفای حریق و فرماندهی عملیات</option>
                <option value="FIRST_AID">امداد و نجات و کمک‌های اولیه</option>
                <option value="TECHNICAL">فنی، جوشکاری، برق و تأسیسات</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'شماره گواهینامه:' : 'Certificate Number:'}
              </label>
              <input
                type="text"
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder={isFa ? 'مثال: CERT-1403-98102' : 'CERT-1403-98102'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {isFa ? 'مرجع و سازمان صادرکننده:' : 'Issuing Authority:'}
            </label>
            <input
              type="text"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'تاریخ صدور:' : 'Issue Date:'}
              </label>
              <input
                type="text"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                placeholder="1403/01/01"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'تاریخ انقضا:' : 'Expiry Date:'}
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder={isFa ? 'مثال: 1406/01/01 (خالی = دائمی)' : '1406/01/01'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {isFa ? 'نمره یا درجه احراز صلاحیت:' : 'Score / Grade:'}
            </label>
            <input
              type="text"
              value={scoreOrGrade}
              onChange={(e) => setScoreOrGrade(e.target.value)}
              placeholder="۹۵ از ۱۰۰ یا عالی"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Check className="w-4 h-4" />
            <span>{isFa ? 'ثبت و تایید صلاحیت' : 'Save Qualification'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

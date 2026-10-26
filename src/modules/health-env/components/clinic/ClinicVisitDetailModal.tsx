import React from 'react';
import {
  X,
  Printer,
  Stethoscope,
  Activity,
  HeartPulse,
  Pill,
  Ambulance,
  Calendar,
  Clock,
  Building,
  User,
  ShieldAlert,
  FileText
} from 'lucide-react';
import { ClinicVisit } from '../../types/clinicTypes';

interface Props {
  visit: ClinicVisit | null;
  onClose: () => void;
}

export default function ClinicVisitDetailModal({ visit, onClose }: Props) {
  if (!visit) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn print:max-h-none print:shadow-none print:border-none">
        
        {/* Modal Header (Hidden in Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-700 to-cyan-800 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Stethoscope className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black">
                پرونده بالینی مراجعه به بهداری — شماره: {visit.visitNumber}
              </h2>
              <span className="text-[11px] text-teal-100">
                تاریخ: {visit.visitDate} | ساعت: {visit.visitTime}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ پرونده</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          
          {/* Header Title for Print Only */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4 text-center">
            <h1 className="text-base font-black">مجتمع پتروشیمی — اداره بهداشت و درمان صنعتی (HSECORE)</h1>
            <h2 className="text-sm font-bold mt-1">برگه معاینه و شرح مراجعه سرپایی بهداری</h2>
            <div className="flex justify-between text-[10px] text-slate-600 mt-2 font-mono">
              <span>شماره پرونده: {visit.visitNumber}</span>
              <span>تاریخ مراجعه: {visit.visitDate} - {visit.visitTime}</span>
              <span>شیفت: {visit.shift}</span>
            </div>
          </div>

          {/* Personnel Identity Banner */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-400 block text-[10px]">نام و نام خانوادگی:</span>
              <strong className="text-slate-900 dark:text-white font-bold">{visit.fullName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">کد پرسنلی:</span>
              <strong className="font-mono text-slate-900 dark:text-white">{visit.personnelCode}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">واحد سازمانی:</span>
              <strong className="text-slate-900 dark:text-white">{visit.unit || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">سمت شغلی:</span>
              <strong className="text-slate-900 dark:text-white">{visit.jobTitle || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">کد ملی:</span>
              <strong className="font-mono text-slate-900 dark:text-white">{visit.nationalCode || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">گروه خونی:</span>
              <strong className="font-mono text-rose-600">{visit.bloodGroup || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">نوع مراجعه:</span>
              <strong className="text-teal-700 dark:text-teal-400">{visit.visitType}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ماهیت حادثه:</span>
              <strong className={visit.isWorkRelated ? 'text-rose-600' : 'text-emerald-600'}>
                {visit.isWorkRelated ? 'حادثه شغلی' : 'غیر شغلی'}
              </strong>
            </div>
          </div>

          {/* Chief Complaint & Triage */}
          <div className="p-4 bg-teal-50/40 dark:bg-teal-950/20 rounded-2xl border border-teal-200 dark:border-teal-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-teal-900 dark:text-teal-300">علت مراجعه و شکایت اصلی:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-600 text-white">
                سطح تریاژ: {visit.triageLevel}
              </span>
            </div>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-bold">
              {visit.chiefComplaint}
            </p>
          </div>

          {/* Vitals */}
          <div className="space-y-2">
            <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>علائم حیاتی ثبت‌شده در تریاژ:</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">فشار خون (BP)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {visit.systolicBp && visit.diastolicBp ? `${visit.systolicBp}/${visit.diastolicBp} mmHg` : '-'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">ضربان قلب (PR)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {visit.pulseRate ? `${visit.pulseRate} bpm` : '-'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">دمای بدن (T)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {visit.temperature ? `${visit.temperature} °C` : '-'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">اکسیژن خون (SpO2)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {visit.spo2 ? `${visit.spo2} %` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnosis & Physical Exam */}
          <div className="space-y-2">
            <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <span>تشخیص بالینی و معاینات فیزیکی:</span>
            </h3>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 block">تشخیص اولیه (Primary Diagnosis):</span>
                <strong className="text-slate-900 dark:text-white text-xs">{visit.primaryDiagnosis}</strong>
              </div>
              {visit.affectedOrgan && (
                <div>
                  <span className="text-[10px] text-slate-400 block">ارگان درگیر:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">{visit.affectedOrgan}</span>
                </div>
              )}
              {visit.physicalExamNotes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block">شرح معاینه:</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{visit.physicalExamNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions & Treatments */}
          {visit.actionsPerformed && visit.actionsPerformed.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-teal-600" />
                <span>اقدامات درمانی انجام شده:</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {visit.actionsPerformed.map((act, i) => (
                  <span key={i} className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 rounded-xl border border-teal-200 dark:border-teal-800 text-[11px] font-bold">
                    ✓ {act}
                  </span>
                ))}
              </div>
              {visit.actionDetails && (
                <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                  {visit.actionDetails}
                </p>
              )}
            </div>
          )}

          {/* Medications */}
          {visit.medications && visit.medications.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-teal-600" />
                <span>داروهای تحویلی:</span>
              </h3>
              <table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-700 text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                    <th className="p-2 border-r border-slate-200 dark:border-slate-700">نام دارو</th>
                    <th className="p-2 border-r border-slate-200 dark:border-slate-700">دوز</th>
                    <th className="p-2 border-r border-slate-200 dark:border-slate-700">روش مصرف</th>
                    <th className="p-2">دستور مصرف</th>
                  </tr>
                </thead>
                <tbody>
                  {visit.medications.map((m, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{m.name}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono">{m.dosage || '-'}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-700">{m.route}</td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">{m.instructions || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Final Outcome & Dispatch */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-white">نتیجه و وضعیت خروج بیمار:</span>
              <strong className="text-teal-700 dark:text-teal-400 text-xs">{visit.outcome}</strong>
            </div>

            {visit.medicalRestDays && visit.medicalRestDays > 0 ? (
              <div className="text-[11px] text-amber-800 dark:text-amber-300 pt-1">
                استراحت پزشکی تجویز شده: <strong>{visit.medicalRestDays} روز</strong> (از {visit.medicalRestFrom || '-'} تا {visit.medicalRestTo || '-'})
              </div>
            ) : null}

            {visit.ambulanceDispatch?.dispatched && (
              <div className="text-[11px] text-rose-700 dark:text-rose-300 pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <Ambulance className="w-4 h-4 shrink-0 text-red-600" />
                <span>اعزام بیمار با آمبولانس مجتمع (کد {visit.ambulanceDispatch.ambulanceCode || '-'}) به {visit.ambulanceDispatch.destinationHospital || 'بیمارستان'}</span>
              </div>
            )}
          </div>

          {/* Signature & Attending Staff */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-slate-500 text-[11px]">
            <div>
              <span>کادر درمانی معالج: </span>
              <strong className="text-slate-800 dark:text-slate-200">{visit.attendingMedic} ({visit.medicRole})</strong>
            </div>
            <div className="text-left font-mono">
              سیستم یکپارچه HSECORE
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

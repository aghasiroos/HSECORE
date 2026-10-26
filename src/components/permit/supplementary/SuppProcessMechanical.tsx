import React, { useState } from 'react';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import HseLogo from '../../HseLogo';
import PersianDatePicker from '../../common/PersianDatePicker';
import PersianTimePicker from '../../common/PersianTimePicker';
import { PermitPersonnelAutocomplete } from '../PermitPersonnelAutocomplete';
import { SuppFormProps, useSupplementarySignatureHelpers } from './index';

export const SuppProcessMechanical: React.FC<SuppFormProps> = ({
  signatures,
  onSignaturesChange,
  isReadOnly = false
}) => {
  const { branding } = useSystemBranding();
  const [execDate, setExecDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const { updateTierName, selectTierPerson } = useSupplementarySignatureHelpers(signatures, onSignaturesChange);

  return (
    <div className="bg-white dark:bg-slate-900 p-2 text-[10px] md:text-[11px] text-slate-900 mx-auto" dir="rtl">
      <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse border-2 border-black">
        <tbody>
          {/* Header */}
          <tr className="border-b-2 border-black">
            <td className="w-[15%] p-2 text-center align-middle">
              {branding.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt="Logo" 
                  className="max-h-12 max-w-full mx-auto object-contain select-none"
                  style={{ height: `${branding.logoHeightPrintMm || 14}mm` }}
                />
              ) : (
                <HseLogo size="sm" forceDefault={true} showShadow={false} />
              )}
            </td>
            <td className="w-[65%] border-x-2 border-black p-2 text-center align-middle bg-slate-100">
              <h1 className="font-extrabold text-base md:text-lg">شرکت پتروشیمی رجال</h1>
              <h2 className="font-bold text-sm md:text-base mt-1">پروانه کار الحاقی جداسازی فرآیندی / مکانیکی / ابزاردقیق</h2>
            </td>
            <td className="w-[20%] p-2 align-middle font-bold">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <span>شماره پروانه کار:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
            </td>
          </tr>

          {/* Section 1 */}
          <tr className="border-b border-black">
            <td colSpan={2} className="p-1 align-top border-l border-black">
              <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 mb-2 rounded border border-slate-400">۱- درخواست جداسازی:</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>محل انجام کار:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>کدام تجهیز باید جدا شود:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>تگ تجهیز:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                <span>شرح کار:</span>
                <textarea rows={2} className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm"></textarea>
              </div>
            </td>
            <td className="p-1 align-top space-y-2">
              <div className="flex items-center gap-1">
                <span className="">شماره پروانه کار اصلی:</span>
                <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0">تاریخ اجرای کار:</span>
                <div className="flex-1 min-w-0">
                  <PersianDatePicker 
                    value={execDate} 
                    onChange={setExecDate} 
                    isFa={true} 
                    inputClassName="h-6 text-[10px] px-1 py-0.5" 
                    placeholder="YYYY/MM/DD"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0">ساعت شروع کار:</span>
                <div className="flex-1 min-w-0">
                  <PersianTimePicker 
                    value={startTime} 
                    onChange={setStartTime} 
                    isFa={true} 
                    size="sm" 
                    inputClassName="h-6 text-[10px] px-1 py-0.5" 
                    placeholder="08:00" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="shrink-0">ساعت پایان کار:</span>
                <div className="flex-1 min-w-0">
                  <PersianTimePicker 
                    value={endTime} 
                    onChange={setEndTime} 
                    isFa={true} 
                    size="sm" 
                    inputClassName="h-6 text-[10px] px-1 py-0.5" 
                    placeholder="16:00" 
                  />
                </div>
              </div>
            </td>
          </tr>
          
          <tr className="border-b border-black bg-green-50 text-center">
            <td colSpan={3} className="p-1 font-bold">
              راهنما: جهت ثبت وضعیت از این علائم استفاده شود: <span className="mx-2">✓ وضعیت مطلوب</span> <span className="mx-2">✗ وضعیت نامطلوب</span> <span className="mx-2">- موارد نامرتبط</span>
            </td>
          </tr>
        </tbody>
      </table></div>

      {/* Inspections Table */}
      <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse border-x-2 border-black">
        <thead>
          <tr className="bg-green-100 font-bold border-b border-black text-center">
            <td className="w-[40%] p-1 border-l border-black">بازرسی ها</td>
            <td className="w-[10%] p-1 border-l border-black">وضعیت</td>
            <td className="w-[40%] p-1 border-l border-black">بازرسی ها</td>
            <td className="w-[10%] p-1">وضعیت</td>
          </tr>
        </thead>
        <tbody>
          {[
            ['آیا P&ID پیوست است؟', 'آیا نیروی Stand By بهره بردار در محل حاضر است؟'],
            ['آیا تجهیزات یا خطوطی که نیازمند ایزولاسیون هستند در P&ID مشخص شده اند؟', 'نیاز به اعمال تغییر (Override) یا Simulation در سیستم DCS وجود دارد؟'],
            ['آیا فشار خطوط تخلیه شده است؟', 'آیا تجهیزات استحفاظ فردی مناسب به همراه است؟'],
            ['آیا خطوط با نیتروژن Purge شده و Gas Free گردیده اند؟', 'آیا تجهیز از سرویس خارج شده است؟'],
            ['آیا دمای خط مناسب است؟', 'آیا تجهیز بی برق شده است؟'],
            ['آیا تست گاز انجام شده است؟', 'آیا مسیرهای ورودی به تجهیز ایزوله شده اند؟'],
            ['آیا سطح LEL برابر استاندارد است؟', 'آیا وضعیت Inter Lock تجهیز بررسی شده است؟']
          ].map((row, idx) => (
            <tr key={idx} className="border-b border-black">
              <td className="p-1 border-l border-black bg-green-50/30">{row[0]}</td>
              <td className="p-1 border-l border-black text-center"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
              <td className="p-1 border-l border-black bg-green-50/30">{row[1]}</td>
              <td className="p-1 text-center"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse border-2 border-black">
        <tbody>
          <tr className="border-b-2 border-black bg-slate-50 dark:bg-slate-800/50">
            <td colSpan={2} className="p-1">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۲- مجوز جداسازی</div>
                <div className="text-justify leading-relaxed mt-0.5 font-bold">
                  اینجانب بدینوسیله جداسازی تجهیزات مشروح در بند (۱) را مطابق با توضیحات داده شده و P&ID مجاز می دانم.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                <div className="flex items-center gap-2 flex-[1.5]">
                  <span className="shrink-0 font-bold">کشیک ارشد تولید/ صادر کننده:</span>
                  <div className="flex-1 min-w-[140px]">
                    <PermitPersonnelAutocomplete
                      value={signatures?.issuer?.name || ''}
                      onChange={val => updateTierName('issuer', val)}
                      onSelectPersonnel={p => selectTierPerson('issuer', p)}
                      disabled={isReadOnly}
                      placeholder="جستجوی پرسنل یا تایپ..."
                    />
                    {(signatures?.issuer?.userJobTitle || signatures?.issuer?.personnelCode) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300 mt-0.5">
                        {signatures?.issuer?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.issuer.userJobTitle}</strong></span>}
                        {signatures?.issuer?.personnelCode && <span className="font-mono">کد: <strong>{signatures.issuer.personnelCode}</strong></span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span>امضاء:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span>تاریخ و ساعت:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
            </td>
          </tr>

          <tr className="border-b border-black">
            <td colSpan={2} className="p-1 font-bold bg-slate-200">۳- جداسازی:</td>
          </tr>
          <tr>
            <td colSpan={2} className="p-0">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black bg-slate-100 text-center font-bold">
                    <td colSpan={3} className="p-1 border-l border-black">۳-۱ جداسازی های فرایندی / مکانیکی / ابزاردقیق</td>
                    <td colSpan={2} className="p-1 border-l border-black">جداسازی</td>
                    <td colSpan={2} className="p-1">نصب مجدد</td>
                  </tr>
                  <tr className="border-b border-black text-center font-bold">
                    <td className="w-[10%] p-1 border-l border-black">Lock No.</td>
                    <td className="w-[10%] p-1 border-l border-black">Tag No.</td>
                    <td className="w-[40%] p-1 border-l border-black">محل</td>
                    <td className="w-[10%] p-1 border-l border-black">تاریخ</td>
                    <td className="w-[10%] p-1 border-l border-black">ساعت</td>
                    <td className="w-[10%] p-1 border-l border-black">تاریخ</td>
                    <td className="w-[10%] p-1">ساعت</td>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6].map((i) => (
                    <tr key={i} className="border-b border-black">
                      <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                      <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                      <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                      <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                      <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                      <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                      <td className="p-1"><input type="text" className="w-full border border-slate-300 rounded text-center" /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </td>
          </tr>
          <tr className="border-b-2 border-black bg-slate-50 dark:bg-slate-800/50">
            <td colSpan={2} className="p-2">
              <div className="mb-2">اینجانب بدینوسیله تایید می نمایم که کلیه تجهیزات مشروح در بند (۱) در حضور مسئول محوطه جداسازی شده و مشخص شده اند.</div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 flex-[1.5] min-w-[200px]">
                  <span className="shrink-0 font-bold">مسئول اجرای کار:</span>
                  <div className="flex-1 min-w-0">
                    <PermitPersonnelAutocomplete
                      value={signatures?.executor?.name || ''}
                      onChange={val => updateTierName('executor', val)}
                      onSelectPersonnel={p => selectTierPerson('executor', p)}
                      disabled={isReadOnly}
                      className="flex-1 min-w-0"
                      placeholder="جستجوی پرسنل یا تایپ..."
                    />
                    {(signatures?.executor?.userJobTitle || signatures?.executor?.personnelCode) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300 mt-0.5">
                        {signatures?.executor?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.executor.userJobTitle}</strong></span>}
                        {signatures?.executor?.personnelCode && <span className="font-mono">کد: <strong>{signatures.executor.personnelCode}</strong></span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <span className="shrink-0 font-medium">تاریخ:</span>
                  <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                </div>
                <div className="flex items-center gap-1.5 w-36">
                  <span className="shrink-0 font-medium">ساعت:</span>
                  <div className="w-24 shrink-0">
                    <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr className="border-b-2 border-black">
            <td colSpan={2} className="p-1">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۴- تایید جداسازی:</div>
                <div className="text-justify leading-relaxed mt-0.5">
                  بدینوسیله تایید می کنم که کلیه فعالیت های تحت این مجوز انجام شده / به حالت تعلیق درآمده و تمام افراد از منطقه خارج شده و کلیه ابزارآلات و تجهیزات لازم جا به جا شده و در حالت ایمن قرار دارند و محوطه به صورت کامل پاکسازی شده است.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 flex-[1.5] min-w-[200px]">
                  <span className="shrink-0 font-bold">مسئول محوطه:</span>
                  <div className="flex-1 min-w-0">
                    <PermitPersonnelAutocomplete
                      value={signatures?.areaSupervisor?.name || ''}
                      onChange={val => updateTierName('areaSupervisor', val)}
                      onSelectPersonnel={p => selectTierPerson('areaSupervisor', p)}
                      disabled={isReadOnly}
                      className="flex-1 min-w-0"
                      placeholder="جستجوی پرسنل یا تایپ..."
                    />
                    {(signatures?.areaSupervisor?.userJobTitle || signatures?.areaSupervisor?.personnelCode) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300 mt-0.5">
                        {signatures?.areaSupervisor?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.areaSupervisor.userJobTitle}</strong></span>}
                        {signatures?.areaSupervisor?.personnelCode && <span className="font-mono">کد: <strong>{signatures.areaSupervisor.personnelCode}</strong></span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <span className="shrink-0 font-medium">تاریخ:</span>
                  <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                </div>
                <div className="flex items-center gap-1.5 w-36">
                  <span className="shrink-0 font-medium">ساعت:</span>
                  <div className="w-24 shrink-0">
                    <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr className="border-b-2 border-black">
            <td colSpan={2} className="p-1">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۵- خاتمه پروانه کار:</div>
                <div className="text-justify leading-relaxed mt-0.5">
                  اینجانب تایید می نمایم که کار مذکور در این پروانه کار تکمیل / معلق شده و کلیه کارکنان محل کار را ترک کرده اند و به آنها ابلاغ شده است که از این لحظه انجام هرگونه کاری در محل فوق الذکر ممنوع و غیر ایمن بوده و کلیه وسایل و تجهیزات نیز به صورت ایمن در آمده و از محل خارج شده اند.
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="shrink-0 font-medium">علت معلق شدن پروانه کار (در صورت تعلیق کار):</span>
                <input type="text" className="flex-1 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div className="space-y-1.5 border border-slate-200 dark:border-slate-700 p-2 rounded">
                  <div className="font-bold text-red-600">مسئول اجرای کار پرمیت اصلی:</div>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="shrink-0 font-medium">نام و امضاء:</span>
                    <PermitPersonnelAutocomplete className="flex-1 min-w-0" placeholder="جستجوی پرسنل یا تایپ..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-medium">تاریخ:</span>
                    <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                    <span className="shrink-0 font-medium mr-2">ساعت:</span>
                    <div className="w-24 shrink-0">
                      <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 border border-slate-200 dark:border-slate-700 p-2 rounded">
                  <div className="font-bold text-slate-800 dark:text-slate-200">مسئول محوطه:</div>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="shrink-0 font-medium">نام و امضاء:</span>
                    <PermitPersonnelAutocomplete className="flex-1 min-w-0" placeholder="جستجوی پرسنل یا تایپ..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-medium">تاریخ:</span>
                    <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                    <span className="shrink-0 font-medium mr-2">ساعت:</span>
                    <div className="w-24 shrink-0">
                      <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr className="border-b border-black">
            <td colSpan={2} className="p-1">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۶- مجوز نصب مجدد:</div>
                <div className="text-justify leading-relaxed mt-0.5">
                  اینجانب بدینوسیله تایید می نمایم که تجهیزات جداسازی شده در بند (۱) به حالت نرمال برگردند.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 mt-2 mb-1">
                <div className="flex items-center gap-1.5 flex-[1.5] min-w-[200px]">
                  <span className="shrink-0 font-bold">کشیک ارشد تولید / صادر کننده:</span>
                  <div className="flex-1 min-w-0">
                    <PermitPersonnelAutocomplete
                      value={signatures?.issuer?.name || ''}
                      onChange={val => updateTierName('issuer', val)}
                      onSelectPersonnel={p => selectTierPerson('issuer', p)}
                      disabled={isReadOnly}
                      className="flex-1 min-w-0"
                      placeholder="جستجوی پرسنل یا تایپ..."
                    />
                    {(signatures?.issuer?.userJobTitle || signatures?.issuer?.personnelCode) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300 mt-0.5">
                        {signatures?.issuer?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.issuer.userJobTitle}</strong></span>}
                        {signatures?.issuer?.personnelCode && <span className="font-mono">کد: <strong>{signatures.issuer.personnelCode}</strong></span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <span className="shrink-0 font-medium">تاریخ:</span>
                  <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                </div>
                <div className="flex items-center gap-1.5 w-36">
                  <span className="shrink-0 font-medium">ساعت:</span>
                  <div className="w-24 shrink-0">
                    <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr className="border-b-2 border-black bg-slate-50 dark:bg-slate-800/50">
            <td colSpan={2} className="p-1">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۷- نصب مجدد:</div>
                <div className="text-justify leading-relaxed mt-0.5">
                  اینجانب تایید می نمایم که کلیه تجهیزات مشخص شده در بند (۱) مجدداً احیاء شده و تمامی جداسازی ها برداشته شده اند و کلیه هشدارها از محل کار جمع آوری شده اند. و مجوز کار اصلی بسته شده است.
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 mt-2">
                <div className="space-y-1.5 border border-slate-200 dark:border-slate-700 p-2 rounded">
                  <div className="font-bold text-slate-800 dark:text-slate-200">مسئول اجرای کار:</div>
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="shrink-0 font-medium">نام و امضاء:</span>
                      <PermitPersonnelAutocomplete
                        value={signatures?.executor?.name || ''}
                        onChange={val => updateTierName('executor', val)}
                        onSelectPersonnel={p => selectTierPerson('executor', p)}
                        disabled={isReadOnly}
                        className="flex-1 min-w-0"
                        placeholder="جستجوی پرسنل یا تایپ..."
                      />
                    </div>
                    {(signatures?.executor?.userJobTitle || signatures?.executor?.personnelCode) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300">
                        {signatures?.executor?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.executor.userJobTitle}</strong></span>}
                        {signatures?.executor?.personnelCode && <span className="font-mono">کد: <strong>{signatures.executor.personnelCode}</strong></span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-medium">تاریخ:</span>
                    <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                    <span className="shrink-0 font-medium mr-2">ساعت:</span>
                    <div className="w-24 shrink-0">
                      <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 border border-slate-200 dark:border-slate-700 p-2 rounded">
                  <div className="font-bold text-slate-800 dark:text-slate-200">مسئول محوطه:</div>
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="shrink-0 font-medium">نام و امضاء:</span>
                      <PermitPersonnelAutocomplete
                        value={signatures?.areaSupervisor?.name || ''}
                        onChange={val => updateTierName('areaSupervisor', val)}
                        onSelectPersonnel={p => selectTierPerson('areaSupervisor', p)}
                        disabled={isReadOnly}
                        className="flex-1 min-w-0"
                        placeholder="جستجوی پرسنل یا تایپ..."
                      />
                    </div>
                    {(signatures?.areaSupervisor?.userJobTitle || signatures?.areaSupervisor?.personnelCode) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-700 dark:text-slate-300">
                        {signatures?.areaSupervisor?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.areaSupervisor.userJobTitle}</strong></span>}
                        {signatures?.areaSupervisor?.personnelCode && <span className="font-mono">کد: <strong>{signatures.areaSupervisor.personnelCode}</strong></span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-medium">تاریخ:</span>
                    <PersianDatePicker isFa={true} inputClassName="h-6 text-xs px-1 py-0.5" placeholder="YYYY/MM/DD" />
                    <span className="shrink-0 font-medium mr-2">ساعت:</span>
                    <div className="w-24 shrink-0">
                      <PersianTimePicker isFa={true} size="sm" inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold" placeholder="HH:mm" />
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr className="bg-slate-100">
            <td colSpan={2} className="p-1 font-bold text-center">
              <div className="flex justify-between w-full px-2">
                <span>توزیع نسخ: نسخه اول (سفید) مجری کار، نسخه دوم (زرد) مسئول محوطه، نسخه سوم (سبز) واحد ایمنی.</span>
                <span className="text-red-700">RHS-F00-Rev 00</span>
              </div>
            </td>
          </tr>

        </tbody>
      </table></div>
    </div>
  );
};

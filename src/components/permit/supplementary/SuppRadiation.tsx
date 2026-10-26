import React, { useState } from 'react';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import HseLogo from '../../HseLogo';
import PersianDatePicker from '../../common/PersianDatePicker';
import PersianTimePicker from '../../common/PersianTimePicker';
import { PermitPersonnelAutocomplete } from '../PermitPersonnelAutocomplete';
import { SuppFormProps, useSupplementarySignatureHelpers } from './index';

export const SuppRadiation: React.FC<SuppFormProps> = ({
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
              <h2 className="font-bold text-sm md:text-base mt-1">پروانه کار الحاقی منابع پرتوزا</h2>
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
              <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 mb-2 rounded border border-slate-400">۱- درخواست کننده (بازرس فنی/ شخص دارای صلاحیت از سازمان انرژی اتمی):</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2 mt-1">
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>محل انجام کار:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>شماره تجهیز:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
              <div className="flex items-center gap-1 mb-2">
                <span>تجهیزات / لوله:</span>
                <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
              </div>
              <div className="flex items-center gap-1 mb-2">
                <span>فعالیت/ قدرت:</span>
                <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-1">
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>نوع منبع رادیو اکتیو:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>پیش بینی مدت زمان انجام کار:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
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
          
          <tr className="border-b-2 border-black bg-slate-50 dark:bg-slate-800/50">
            <td colSpan={3} className="p-2">
              <div className="flex gap-2">
                <div className="font-bold ">۲-اقدامات پیشگیرانه:</div>
                <div className="font-bold text-center w-full">این قسمت توسط درخواست کننده تکمیل و توسط واحد ایمنی تایید می گردد.</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table></div>

      {/* Inspections Table */}
      <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse border-x-2 border-black">
        <thead>
          <tr className="bg-green-100 font-bold border-b-2 border-black text-center">
            <td className="w-[70%] p-1 border-l border-black">بازرسی ها / INSPECTIONS</td>
            <td className="w-[10%] p-1 border-l border-black">بله</td>
            <td className="w-[10%] p-1 border-l border-black">خیر</td>
            <td className="w-[10%] p-1">لازم نیست</td>
          </tr>
        </thead>
        <tbody>
          {[
            '۱- آیا پرتونگاران وسایل حفاظت فردی به همراه دارد؟',
            '۲- آیا نیاز به حضور نگهبان در محل وجود دارد؟',
            '۳- آیا محوطه تحت نظارت با نوار ایمنی و تابلوهای هشدار دهنده یا چراغ چشمک زن محصور شده است؟',
            '۴- آیا در صورت وقوع حریق/ حادثه امکان جداسازی ایمن منبع رادیواکتیو وجود دارد؟',
            '۵- آیا اطمینان از صحت و کارایی دستگاه پرتونگاری وجود دارد؟',
            '۶- آیا دستگاه سنجش اشعه (دوزیمتر محیطی) بازرسی شده و دارای گواهینامه کالیبراسیون معتبر است؟',
            '۷- آیا حد ایمن 5.7 µSv/hr در محوطه اندازه گیری رعایت شده است؟',
            '۸- آیا در صورت خارج شدن چشمه از دستگاه تمهیدات لازم پیش بینی شده است؟',
            '۹- آیا نیاز به اخذ مجوز از سازمان منطقه ویژه است؟',
            '۱۰- آیا پرتونگار دارای مجوز از سازمان انرژی اتمی است؟',
            '۱۱- آیا نیاز است در هنگام تشعشع افرادی در معرض آن قرار گیرند؟ (در صورت جواب مثبت نام آن افراد در زیر نوشته شود.)',
            '۱۲- آیا بی سیم در اختیار مجری قرار دارد؟',
            '۱۳- آیا طب کار پرتونگار جهت فعالیت های برعهده بررسی گردیده است؟'
          ].map((text, idx) => (
            <tr key={idx} className="border-b border-black hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50">
              <td className="p-1.5 border-l border-black bg-green-50/20">{text}</td>
              <td className="p-1 border-l border-black text-center"><input type="checkbox" className="w-4 h-4 rounded text-blue-600" /></td>
              <td className="p-1 border-l border-black text-center"><input type="checkbox" className="w-4 h-4 rounded text-blue-600" /></td>
              <td className="p-1 text-center"><input type="checkbox" className="w-4 h-4 rounded text-blue-600" /></td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse border-2 border-black">
        <tbody>
          <tr className="border-b border-black">
            <td className="p-1 h-12 align-top">
              <div className="font-bold">سایر اقدامات لازم:</div>
              <textarea className="w-full border border-slate-300 rounded-md p-1 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm h-8"></textarea>
            </td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-1 h-12 align-top">
              <div className="font-bold">نام افرادی که در محدوده تشعشع قرار دارند:</div>
              <textarea className="w-full border border-slate-300 rounded-md p-1 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm h-8"></textarea>
            </td>
          </tr>
          <tr className="border-b-2 border-black bg-slate-50 dark:bg-slate-800/50">
            <td className="p-1">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-none">
                <tbody>
                  <tr>
                    <td className="w-[10%] font-bold text-center align-middle">تذکرات:</td>
                    <td className="w-[90%] p-1 font-bold">
                      <div>۱- همواره باید نظارت مستمر بر روی منبع پرتوزا وجود داشته باشد.</div>
                      <div>۲- در صورتیکه منبع پرتوزا مورد استفاده قرار نمی گیرد باید بلافاصله به محل امن نگهداری خود عودت شود.</div>
                    </td>
                  </tr>
                </tbody>
              </table></div>
            </td>
          </tr>

          <tr className="border-b border-black">
            <td className="p-0">
              <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 m-1">۳- هماهنگی:</div>
              <div className="flex w-full text-center border-t border-black">
                <div className="w-[25%] p-1 border-l border-black flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed">اینجانب با اطلاع کامل از احتیاط های لازم، پس از پایانکار مراتب را به سرپرست واحد بهره برداری اطلاع خواهم داد.</div>
                  <div>
                    <div className="font-bold mb-1">مسئول انجام کار (بازرس فنی/ دارای صلاحیت)</div>
                    <div className="flex flex-col items-center justify-center gap-1.5 mt-2 w-full px-1 text-right">
                      <div className="flex items-center gap-1 w-full">
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
                        <div className="w-full text-[9px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                          {signatures?.executor?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.executor.userJobTitle}</strong></span>}
                          {signatures?.executor?.personnelCode && <span className="font-mono">کد: <strong>{signatures.executor.personnelCode}</strong></span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1 w-full">
                        <span className="shrink-0 font-medium">ساعت:</span>
                        <div className="w-24 shrink-0">
                          <PersianTimePicker
                            value={signatures?.executor?.time || ''}
                            onChange={time => onSignaturesChange?.({ ...signatures!, executor: { ...signatures!.executor, time } })}
                            disabled={isReadOnly}
                            isFa={true}
                            size="sm"
                            inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold"
                            placeholder="HH:mm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-[25%] p-1 border-l border-black flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed">اینجانب شخصاً بازرسیهای لازم را انجام داده و شرایط را مناسب می دانم.</div>
                  <div>
                    <div className="font-bold mb-1">کشیک ارشد تولید/ صادر کننده</div>
                    <div className="flex flex-col items-center justify-center gap-1.5 mt-2 w-full px-1 text-right">
                      <div className="flex items-center gap-1 w-full">
                        <span className="shrink-0 font-medium">نام و امضاء:</span>
                        <PermitPersonnelAutocomplete
                          value={signatures?.issuer?.name || ''}
                          onChange={val => updateTierName('issuer', val)}
                          onSelectPersonnel={p => selectTierPerson('issuer', p)}
                          disabled={isReadOnly}
                          className="flex-1 min-w-0"
                          placeholder="جستجوی پرسنل یا تایپ..."
                        />
                      </div>
                      {(signatures?.issuer?.userJobTitle || signatures?.issuer?.personnelCode) && (
                        <div className="w-full text-[9px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                          {signatures?.issuer?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.issuer.userJobTitle}</strong></span>}
                          {signatures?.issuer?.personnelCode && <span className="font-mono">کد: <strong>{signatures.issuer.personnelCode}</strong></span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1 w-full">
                        <span className="shrink-0 font-medium">ساعت:</span>
                        <div className="w-24 shrink-0">
                          <PersianTimePicker
                            value={signatures?.issuer?.time || ''}
                            onChange={time => onSignaturesChange?.({ ...signatures!, issuer: { ...signatures!.issuer, time } })}
                            disabled={isReadOnly}
                            isFa={true}
                            size="sm"
                            inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold"
                            placeholder="HH:mm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-[25%] p-1 border-l border-black flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed">اینجانب شخصاً بازرسیهای لازم را انجام داده و شرایط را مناسب می دانم.</div>
                  <div>
                    <div className="font-bold mb-1">مسئول محوطه</div>
                    <div className="flex flex-col items-center justify-center gap-1.5 mt-2 w-full px-1 text-right">
                      <div className="flex items-center gap-1 w-full">
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
                        <div className="w-full text-[9px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                          {signatures?.areaSupervisor?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.areaSupervisor.userJobTitle}</strong></span>}
                          {signatures?.areaSupervisor?.personnelCode && <span className="font-mono">کد: <strong>{signatures.areaSupervisor.personnelCode}</strong></span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1 w-full">
                        <span className="shrink-0 font-medium">ساعت:</span>
                        <div className="w-24 shrink-0">
                          <PersianTimePicker
                            value={signatures?.areaSupervisor?.time || ''}
                            onChange={time => onSignaturesChange?.({ ...signatures!, areaSupervisor: { ...signatures!.areaSupervisor, time } })}
                            disabled={isReadOnly}
                            isFa={true}
                            size="sm"
                            inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold"
                            placeholder="HH:mm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-[25%] p-1 flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed font-bold">کلیه بازرسیها و موارد ایمنی انجام گردید و مورد تایید میباشد.</div>
                  <div>
                    <div className="font-bold mb-1">واحد ایمنی</div>
                    <div className="flex flex-col items-center justify-center gap-1.5 mt-2 w-full px-1 text-right">
                      <div className="flex items-center gap-1 w-full">
                        <span className="shrink-0 font-medium">نام و امضاء:</span>
                        <PermitPersonnelAutocomplete
                          value={signatures?.safetyUnit?.name || ''}
                          onChange={val => updateTierName('safetyUnit', val)}
                          onSelectPersonnel={p => selectTierPerson('safetyUnit', p)}
                          disabled={isReadOnly}
                          className="flex-1 min-w-0"
                          placeholder="جستجوی پرسنل یا تایپ..."
                        />
                      </div>
                      {(signatures?.safetyUnit?.userJobTitle || signatures?.safetyUnit?.personnelCode) && (
                        <div className="w-full text-[9px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                          {signatures?.safetyUnit?.userJobTitle && <span>سمت: <strong className="text-blue-700">{signatures.safetyUnit.userJobTitle}</strong></span>}
                          {signatures?.safetyUnit?.personnelCode && <span className="font-mono">کد: <strong>{signatures.safetyUnit.personnelCode}</strong></span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1 w-full">
                        <span className="shrink-0 font-medium">ساعت:</span>
                        <div className="w-24 shrink-0">
                          <PersianTimePicker
                            value={signatures?.safetyUnit?.time || ''}
                            onChange={time => onSignaturesChange?.({ ...signatures!, safetyUnit: { ...signatures!.safetyUnit, time } })}
                            disabled={isReadOnly}
                            isFa={true}
                            size="sm"
                            inputClassName="h-6 text-xs px-1 py-0.5 text-center font-bold"
                            placeholder="HH:mm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr className="border-b border-black">
            <td className="p-2">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۴- خاتمه کار:</div>
                <div className="text-justify leading-relaxed mt-0.5">
                  بدینوسیله تایید می نمایم که موارد ذکر شده در این پروانه کار <label className="inline-flex items-center gap-1"><input type="checkbox" className="rounded" />تکمیل</label> / <label className="inline-flex items-center gap-1"><input type="checkbox" className="rounded" />معلق شده</label> و کلیه افراد و تجهیزات و ابزار آلات از محوطه خارج شده اند.
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div className="space-y-1.5 border border-slate-200 dark:border-slate-700 p-2 rounded">
                  <div className="font-bold text-slate-800 dark:text-slate-200">مسئول اجرای کار:</div>
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
              
              <div className="text-justify leading-relaxed mt-4 mb-2">
                بدینوسیله تایید می نمایم که همه افراداز محوطه خارج شده ورادیومتری انجام شده وهیچ گونه Source واشعه درمحل مشاهده نشده است و این پروانه کار خاتمه یافته است.
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2 flex-[1.5]">
                  <span>مسئول محوطه:</span>
                  <PermitPersonnelAutocomplete className="flex-1 min-w-[140px]" placeholder="جستجوی پرسنل یا تایپ..." />
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

          <tr className="bg-slate-100">
            <td className="p-1 font-bold text-center">
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

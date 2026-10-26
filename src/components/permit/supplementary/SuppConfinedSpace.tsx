import React, { useState } from 'react';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import HseLogo from '../../HseLogo';
import PersianDatePicker from '../../common/PersianDatePicker';
import PersianTimePicker from '../../common/PersianTimePicker';
import { PermitPersonnelAutocomplete } from '../PermitPersonnelAutocomplete';
import { SuppFormProps, useSupplementarySignatureHelpers } from './index';

export const SuppConfinedSpace: React.FC<SuppFormProps> = ({
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
              <h2 className="font-bold text-sm md:text-base mt-1">پروانه کار الحاقی ورود به فضای بسته</h2>
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
              <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 mb-2 rounded border border-slate-400">۱- صادر کننده:</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>محل انجام کار:</span>
                  <input type="text" className="flex-1 min-w-0 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-1 flex-1 w-full md:flex-1">
                  <span>شماره تجهیز:</span>
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
          
          <tr className="border-b-2 border-black bg-slate-50 dark:bg-slate-800/50">
            <td colSpan={3} className="p-2">
              <div className="flex gap-2 items-center flex-wrap">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۲-اقدامات پیشگیرانه:</div>
                <div className="font-bold flex-1 flex flex-wrap items-center gap-4">
                  <span>* تذکر: حضور نیروی آماده به کار (Stand By)</span>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> بهره بردار</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> H.S.E</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> نگهداری و تعمیرات در محل الزامی است.</label>
                </div>
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
            '۱- آیا محل کاملاً تهویه شده است؟',
            '۲- آیا محل با بخار و آب شست و شو شده است؟',
            '۳- آیا دمای ظرف (ظروف) برای ورود مناسب است؟',
            '۴- آیا محل از مواد قابل اشتعال، سمی، شیمیایی، خورنده و خفه کننده پاکسازی شده است؟',
            '۵- آیا شخصاً از کلیه نقاطی که ممکن است بخار، گاز و یا مواد نفتی داخل فضای بسته شود بازرسی کرده و کلیه آنها مسدود شده است؟',
            '۶- آیا امکانات لازم جهت مراقبت، امداد و نجات افراد داخل فضای بسته پیش بینی شده است؟',
            '۷- آیا رسوبات و متعلقات داخل ظروف از لحاظ سمی بودن، خورنده و اشتعال زایی بی خطر هستند؟',
            '۸- آیا جریان برق دستگاه ها قطع گردیده، قفل ایمنی و علائم خطر روی تابلوی آن نصب شده است؟',
            '۹- آیا Source یا منبع رادیواکتیو از محل خارج شده است؟',
            '۱۰- آیا روشنایی دائمی از نوع ضد انفجار و ۲۴ ولت فراهم شده است؟',
            '۱۱- آیا تهویه دائمی از نوع ضد انفجار و ۲۴ ولت فراهم شده است؟',
            '۱۲- آیا نیاز به حضور آماده به کار (Stand By) با خودرو آتش نشانی در محل وجود دارد؟',
            '۱۳- آیا محل ورود دارای پلکان دسترسی مناسب می باشد؟',
            '۱۴- آیا ارتباط به وسیله دیداری/ کلامی/ بی سیم برقرار است؟'
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

      {/* Gas Tests */}
      <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full border-collapse border-2 border-black">
        <tbody>
          <tr className="border-b border-black bg-blue-50/30">
            <td colSpan={10} className="p-2">
              <div className="flex flex-wrap items-center gap-4 font-bold">
                <span className="">آزمایش‌های مربوط به گاز:</span>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded text-blue-600" /> گازهای قابل انفجار</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded text-blue-600" /> اکسیژن</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded text-blue-600" /> گازهای سمی</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded text-blue-600" /> یکبار</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded text-blue-600" /> متناوب (هر <input type="text" className="w-12 border border-slate-300 rounded text-center mx-1 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" /> دقیقه)</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded text-blue-600" /> لازم نیست</label>
              </div>
            </td>
          </tr>
          <tr className="bg-slate-100 text-center font-bold border-b border-black text-[10px]">
            <td className="p-1 border-l border-black w-[15%]">آزمایش کننده (Gas Tester)<br/>نام و نام خانوادگی/ امضاء</td>
            <td className="p-1 border-l border-black">No. of Gas<br/>Detector</td>
            <td className="p-1 border-l border-black">Other<br/>(SPEC)</td>
            <td className="p-1 border-l border-black">SO2<br/>(PPM)</td>
            <td className="p-1 border-l border-black">NH3<br/>(PPM)</td>
            <td className="p-1 border-l border-black">CO2<br/>(%)</td>
            <td className="p-1 border-l border-black">CO<br/>(ppm)</td>
            <td className="p-1 border-l border-black">LEL<br/>(%)</td>
            <td className="p-1 border-l border-black">O2<br/>(%)</td>
            <td className="p-1 w-[10%]">ساعت (Time)</td>
          </tr>
          {[1,2,3].map((i) => (
            <tr key={i} className="border-b border-black h-8">
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1 border-l border-black"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
              <td className="p-1"><input type="text" className="w-full border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm text-center" /></td>
            </tr>
          ))}

          {/* Section 3 */}
          <tr className="border-b border-black">
            <td colSpan={10} className="p-2 align-top">
              <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 mb-2 rounded border border-slate-400">۳- وسایل استحفاظی فردی مورد نیاز:</div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 mb-2">
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> کلاه ایمنی</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> چانه بند کلاه ایمنی</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> لباس کار</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> لباس کامل ضد اسید</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> لباس آلومینیومی ضد حریق</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> کفش ایمنی</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> کمربند ایمنی آنتی شوک دار</label>
                <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> چکمه</label>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center gap-2">
                  <span>عینک:</span>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> جوشکاری</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> سنگ‌زنی</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> UV</label>
                </div>
                <div className="flex items-center gap-2">
                  <span>شیلد محافظ صورت:</span>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> سنگ زنی</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> جوشکاری</label>
                </div>
                <div className="flex items-center gap-2">
                  <span>محافظ گوش:</span>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> توگوشی</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> روگوشی</label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center gap-2">
                  <span>دستکش:</span>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> چرمی</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> پارچه‌ای</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> PVC</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> نسوز</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> ضد اسید</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> عایق برق</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> ضد سایش</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> ضد برش</label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> ماسک تنفسی مستقل SCBA</label>
                </div>
                <div className="flex items-center gap-2">
                  <span>ماسک:</span>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> ضدغبار</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> نیم صورت</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> تمام صورت</label>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input type="checkbox" className="rounded" />
                  <input type="text" className="flex-1 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
            </td>
          </tr>
          
          <tr className="border-b border-black bg-slate-50 dark:bg-slate-800/50">
            <td colSpan={10} className="p-1 h-12 align-top">
              <div className="font-bold">دستورالعمل‌ها و توصیه‌های لازم:</div>
              <textarea className="w-full border border-slate-300 rounded-md p-1 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm h-8"></textarea>
            </td>
          </tr>

          <tr className="border-b border-black">
            <td colSpan={10} className="p-0">
              <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 m-1">۴- هماهنگی:</div>
              <div className="flex w-full text-center border-t border-black">
                <div className="w-[33%] p-1 border-l border-black flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed">اینجانب شخصاً بازرسیهای فوق را انجام داده و شرایط را مناسب می دانم.</div>
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
                <div className="w-[33%] p-1 border-l border-black flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed">اینجانب با اطلاع کامل از احتیاطهای لازم، پس از پایانکار مراتب را به مسئول محوطه اطلاع خواهم داد.</div>
                  <div>
                    <div className="font-bold mb-1">مسئول انجام کار</div>
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
                <div className="w-[34%] p-1 flex flex-col justify-between">
                  <div className="text-[10px] mb-2 leading-relaxed">اینجانب شخصاً بازرسیهای فوق را انجام داده و شرایط را مناسب می دانم.</div>
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
              </div>
            </td>
          </tr>

          <tr className="border-b border-black">
            <td colSpan={10} className="p-2">
              <div className="flex gap-2 mb-2">
                <div className="font-bold bg-slate-200 inline-block px-2 py-0.5 rounded border border-slate-400 ">۵- خاتمه کار:</div>
                <div className="text-justify leading-relaxed mt-0.5 flex-1">
                  بدینوسیله تایید می نمایم که موارد ذکر شده در این پروانه کار <label className="inline-flex items-center gap-1 mx-1"><input type="checkbox" className="rounded" />انجام پذیرفته</label> <label className="inline-flex items-center gap-1 mx-1"><input type="checkbox" className="rounded" />معلق شده</label> با پروانه شماره <input type="text" className="w-20 border border-slate-300 rounded-md px-1 py-0.5 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-blue-500 shadow-sm inline-block mx-1" /> ادامه می یابد و این پروانه کار خاتمه یافته است.
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 px-2">
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
            </td>
          </tr>

          <tr className="bg-slate-100">
            <td colSpan={10} className="p-1 font-bold text-center">
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

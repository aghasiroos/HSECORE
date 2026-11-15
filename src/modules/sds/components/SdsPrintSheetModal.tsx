import React, { useState } from 'react';
import { Printer, X, Languages, Edit3 } from 'lucide-react';
import { SdsRecordItem } from '../types';
import {
  SDS_16_SECTIONS,
  PHYSICAL_STATE_LABELS,
  SIGNAL_WORD_META,
  SDS_STATUS_META,
} from '../constants';
import { GhsPictogramIcon } from './GhsPictograms';
import { useSystemBranding } from '../../../utils/systemBrandingHelper';
import HseLogo from '../../../components/HseLogo';
import { printService } from '../../../services/printService';

interface SdsPrintSheetModalProps {
  record: SdsRecordItem | null;
  defaultLanguage: 'fa' | 'en';
  canEdit: boolean;
  onClose: () => void;
  onEdit?: (record: SdsRecordItem) => void;
}

export const SdsPrintSheetModal: React.FC<SdsPrintSheetModalProps> = ({
  record,
  defaultLanguage,
  canEdit,
  onClose,
  onEdit,
}) => {
  const [printLang, setPrintLang] = useState<'fa' | 'en'>(defaultLanguage);
  const { branding } = useSystemBranding();

  if (!record) return null;

  const isPrintFa = printLang === 'fa';
  const statusMeta = SDS_STATUS_META[record.status] || SDS_STATUS_META.DRAFT;
  const signalMeta = SIGNAL_WORD_META[record.ghsData?.signalWord || 'NONE'];
  const physLabel = PHYSICAL_STATE_LABELS[record.physicalState] || PHYSICAL_STATE_LABELS.LIQUID;

  const handlePrint = () => {
    printService.printElement('sds-printable-a4-sheet', {
      title: `SDS-${record.documentNumber}-Rev${record.revisionNumber}-${record.materialNameEn || record.materialNameFa}`,
      orientation: 'portrait',
      pageSize: 'A4',
      margin: '10mm 10mm',
      documentCode: `${record.documentNumber} / Rev.${record.revisionNumber}`,
      documentDate: record.lastRevisionDate || record.preparedDate,
      isFa: isPrintFa,
      autoPrint: true,
    });
  };

  const s = record.sections;

  const renderSectionRow = (labelFa: string, labelEn: string, value?: string) => {
    if (!value || !String(value).trim()) return null;
    return (
      <tr key={labelEn}>
        <td className="w-[30%] bg-slate-50 font-bold text-slate-700 p-2 border border-slate-300 align-top">
          {isPrintFa ? labelFa : labelEn}
        </td>
        <td className="p-2 border border-slate-300 text-slate-900 whitespace-pre-wrap leading-relaxed align-top">
          {value}
        </td>
      </tr>
    );
  };

  const hasAnyField = (obj: Record<string, any> | undefined, excludeKeys: string[] = []): boolean => {
    if (!obj) return false;
    return Object.entries(obj).some(([k, v]) => {
      if (excludeKeys.includes(k)) return false;
      if (Array.isArray(v)) return v.length > 0;
      return Boolean(v && String(v).trim());
    });
  };

  return (
    <div className="fixed inset-0 z-[10060] bg-slate-950/75 backdrop-blur-xs flex flex-col p-2 sm:p-4">
      {/* Screen Toolbar */}
      <div className="bg-slate-900 text-white rounded-t-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 max-w-5xl w-full mx-auto border border-slate-700 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-black truncate">
            {isPrintFa ? 'پیش‌نمایش چاپ استاندارد A4 برگه SDS (۱۶ بخشی GHS)' : 'A4 SDS Print Sheet Preview (16-Section GHS)'}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs font-bold">
            {record.documentNumber} | Rev.{record.revisionNumber}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrintLang((l) => (l === 'fa' ? 'en' : 'fa'))}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Languages className="w-4 h-4 text-sky-400" />
            <span>{isPrintFa ? 'تغییر به English (LTR)' : 'Switch to فارسی (RTL)'}</span>
          </button>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isPrintFa ? 'ویرایش / بازنگری' : 'Edit / Revise'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrintFa ? 'چاپ مستقیم / ذخیره PDF (A4)' : 'Print / Save PDF (A4)'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable A4 Sheet Canvas */}
      <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-3 sm:p-6 max-w-5xl w-full mx-auto rounded-b-2xl border-x border-b border-slate-300 dark:border-slate-800">
        <div
          id="sds-printable-a4-sheet"
          dir={isPrintFa ? 'rtl' : 'ltr'}
          className="bg-white text-slate-900 mx-auto p-6 sm:p-8 shadow-xl rounded-sm max-w-[210mm] text-[11px] leading-relaxed"
        >
          {/* Official Header Table */}
          <div className="avoid-break border-2 border-slate-800 mb-4">
            <div className="grid grid-cols-12 items-stretch">
              <div className="col-span-3 p-3 border-e border-slate-800 flex flex-col items-center justify-center text-center gap-1 bg-slate-50">
                <HseLogo size="sm" />
                <div className="text-[10px] font-black text-slate-800">
                  HSECORE
                </div>
                <div className="text-[9px] font-bold text-slate-600">
                  {isPrintFa
                    ? branding?.organizationNameFa || 'مجتمع پتروشیمی رجال'
                    : branding?.organizationNameEn || 'Rejal Petrochemical Complex'}
                </div>
              </div>

              <div className="col-span-6 p-3 border-e border-slate-800 flex flex-col items-center justify-center text-center">
                <div className="text-sm font-black text-slate-900">
                  {isPrintFa ? 'برگه اطلاعات ایمنی مواد شیمیایی (SDS)' : 'SAFETY DATA SHEET (SDS)'}
                </div>
                <div className="text-xs font-black text-sky-800 mt-1">
                  {record.materialNameFa} — {record.materialNameEn}
                </div>
                <div className="text-[10px] font-bold text-slate-600 mt-1">
                  {isPrintFa
                    ? 'مطابق با استاندارد بین‌المللی GHS / ISO 11014 (۱۶ بخشی)'
                    : 'According to UN GHS / ISO 11014 (16 Sections)'}
                </div>
              </div>

              <div className="col-span-3 text-[10px] divide-y divide-slate-800 font-bold">
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">{isPrintFa ? 'کد سند:' : 'Doc No:'}</span>
                  <span className="font-mono font-black">{record.documentNumber}</span>
                </div>
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">{isPrintFa ? 'ویرایش:' : 'Revision:'}</span>
                  <span className="font-mono font-black">Rev.{record.revisionNumber}</span>
                </div>
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">{isPrintFa ? 'تاریخ تهیه:' : 'Prepared:'}</span>
                  <span className="font-mono">{record.preparedDate}</span>
                </div>
                <div className="p-1.5 flex justify-between gap-1">
                  <span className="text-slate-500">{isPrintFa ? 'آخرین بازنگری:' : 'Revised:'}</span>
                  <span className="font-mono">{record.lastRevisionDate || record.preparedDate}</span>
                </div>
                <div className="p-1.5 flex justify-between gap-1 bg-slate-50">
                  <span className="text-slate-500">{isPrintFa ? 'وضعیت:' : 'Status:'}</span>
                  <span className="font-black">{isPrintFa ? statusMeta.fa : statusMeta.en}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Core Summary & GHS Hazard Box */}
          <div className="avoid-break border border-slate-400 mb-4">
            <div className="bg-slate-800 text-white px-3 py-1.5 font-black text-xs">
              {isPrintFa ? 'شناسنامه خلاصه و برچسب خطرات GHS' : 'Chemical Identity & GHS Hazard Summary'}
            </div>
            <table className="w-full border-collapse text-[10.5px]">
              <tbody>
                <tr>
                  <td className="w-1/4 p-2 border border-slate-300 bg-slate-50 font-bold">
                    {isPrintFa ? 'نام فارسی / انگلیسی:' : 'Chemical Name:'}
                  </td>
                  <td className="w-1/4 p-2 border border-slate-300 font-black">
                    {record.materialNameFa} / {record.materialNameEn}
                  </td>
                  <td className="w-1/4 p-2 border border-slate-300 bg-slate-50 font-bold">
                    {isPrintFa ? 'نام تجاری:' : 'Trade Name:'}
                  </td>
                  <td className="w-1/4 p-2 border border-slate-300">{record.tradeName || '-'}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 bg-slate-50 font-bold">CAS Number:</td>
                  <td className="p-2 border border-slate-300 font-mono font-black">{record.casNumber || '-'}</td>
                  <td className="p-2 border border-slate-300 bg-slate-50 font-bold">UN Number:</td>
                  <td className="p-2 border border-slate-300 font-mono font-black">{record.unNumber || '-'}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 bg-slate-50 font-bold">
                    {isPrintFa ? 'سازنده / تأمین‌کننده:' : 'Manufacturer / Supplier:'}
                  </td>
                  <td className="p-2 border border-slate-300">
                    {[record.manufacturer, record.supplier].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="p-2 border border-slate-300 bg-slate-50 font-bold">
                    {isPrintFa ? 'واحد / محل مصرف و انبار:' : 'Unit / Storage Location:'}
                  </td>
                  <td className="p-2 border border-slate-300">
                    {record.unitName} {record.storageLocation ? `— ${record.storageLocation}` : ''}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 bg-slate-50 font-bold">
                    {isPrintFa ? 'حالت فیزیکی:' : 'Physical State:'}
                  </td>
                  <td className="p-2 border border-slate-300 font-bold">
                    {isPrintFa ? physLabel.fa : physLabel.en}
                  </td>
                  <td className="p-2 border border-slate-300 bg-slate-50 font-bold">
                    {isPrintFa ? 'واژه اخطار (Signal Word):' : 'Signal Word:'}
                  </td>
                  <td className="p-2 border border-slate-300 font-black">
                    {isPrintFa ? signalMeta.fa : signalMeta.en}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* GHS Pictograms + Statements */}
            <div className="p-3 border-t border-slate-300 bg-white space-y-2">
              {record.ghsData?.pictograms?.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {record.ghsData.pictograms.map((code) => (
                    <GhsPictogramIcon key={code} code={code} size={52} showLabel isFa={isPrintFa} />
                  ))}
                </div>
              )}
              {record.ghsData?.hStatements?.length > 0 && (
                <div>
                  <span className="font-black text-rose-700">
                    {isPrintFa ? 'عبارات خطر (H-Statements): ' : 'Hazard Statements: '}
                  </span>
                  <span>{record.ghsData.hStatements.join(' | ')}</span>
                </div>
              )}
              {record.ghsData?.pStatements?.length > 0 && (
                <div>
                  <span className="font-black text-sky-800">
                    {isPrintFa ? 'عبارات احتیاطی (P-Statements): ' : 'Precautionary Statements: '}
                  </span>
                  <span>{record.ghsData.pStatements.join(' | ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* All 16 Standardized Sections */}
          <div className="space-y-3">
            {/* Section 1 */}
            <div className="avoid-break border border-slate-300">
              <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-black text-slate-800">
                {isPrintFa ? SDS_16_SECTIONS[0].titleFa : SDS_16_SECTIONS[0].titleEn}
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {renderSectionRow('شناسه محصول', 'Product Identifier', s.section1?.productIdentifier || record.materialNameEn)}
                  {renderSectionRow('مترادف‌ها', 'Synonyms', s.section1?.synonyms)}
                  {renderSectionRow('کاربرد توصیه‌شده', 'Recommended Use', s.section1?.recommendedUse)}
                  {renderSectionRow('محدودیت مصرف', 'Restrictions on Use', s.section1?.restrictionsOnUse)}
                  {renderSectionRow('تلفن اضطراری سازنده', 'Manufacturer Emergency Phone', s.section1?.emergencyPhone)}
                  {renderSectionRow('تماس اضطراری مجتمع', 'Complex Emergency Phone', s.section1?.complexEmergencyPhone)}
                </tbody>
              </table>
            </div>

            {/* Section 2 */}
            <div className="avoid-break border border-slate-300">
              <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-black text-slate-800">
                {isPrintFa ? SDS_16_SECTIONS[1].titleFa : SDS_16_SECTIONS[1].titleEn}
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {renderSectionRow('کلاس‌های خطر GHS', 'GHS Hazard Classes', (record.ghsData?.hazardClasses || []).join('، '))}
                  {renderSectionRow('مسیرهای مواجهه', 'Exposure Routes', (record.ghsData?.exposureRoutes || []).join('، '))}
                  {renderSectionRow('خطرات بهداشتی', 'Health Hazards', record.ghsData?.healthHazardsSummary)}
                  {renderSectionRow('خطرات فیزیکی', 'Physical Hazards', record.ghsData?.physicalHazardsSummary)}
                  {renderSectionRow('خطرات زیست‌محیطی', 'Environmental Hazards', record.ghsData?.environmentalHazardsSummary)}
                  {renderSectionRow('طبقه‌بندی تکمیلی', 'GHS Classification Details', s.section2?.ghsClassificationText)}
                  {renderSectionRow('الزامات برچسب‌گذاری', 'Label Elements', s.section2?.labelElementsNotes)}
                  {renderSectionRow('سایر خطرات', 'Other Hazards', s.section2?.otherHazards)}
                </tbody>
              </table>
            </div>

            {/* Section 3 */}
            <div className="avoid-break border border-slate-300">
              <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-black text-slate-800">
                {isPrintFa ? SDS_16_SECTIONS[2].titleFa : SDS_16_SECTIONS[2].titleEn}
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {renderSectionRow('ماهیت ماده', 'Substance / Mixture', s.section3?.substanceOrMixture === 'MIXTURE' ? 'مخلوط (Mixture)' : 'ماده خالص (Substance)')}
                  {renderSectionRow('فرمول شیمیایی', 'Chemical Formula', s.section3?.chemicalFormula)}
                  {renderSectionRow('جرم مولکولی', 'Molecular Weight', s.section3?.molecularWeight)}
                </tbody>
              </table>
              {(s.section3?.ingredients || []).length > 0 && (
                <table className="w-full border-collapse mt-1">
                  <thead>
                    <tr className="bg-slate-50 font-black">
                      <th className="p-1.5 border border-slate-300">{isPrintFa ? 'نام جزء' : 'Ingredient'}</th>
                      <th className="p-1.5 border border-slate-300">CAS</th>
                      <th className="p-1.5 border border-slate-300">{isPrintFa ? 'درصد' : '%'}</th>
                      <th className="p-1.5 border border-slate-300">{isPrintFa ? 'طبقه‌بندی خطر' : 'Classification'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.section3.ingredients.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5 border border-slate-300">{row.ingredientName}</td>
                        <td className="p-1.5 border border-slate-300 font-mono">{row.casNumber || '-'}</td>
                        <td className="p-1.5 border border-slate-300 font-mono">{row.concentration || '-'}</td>
                        <td className="p-1.5 border border-slate-300">{row.classification || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sections 4 to 16 */}
            {[
              {
                meta: SDS_16_SECTIONS[3],
                rows: [
                  ['در صورت استنشاق', 'Inhalation', s.section4?.inhalation],
                  ['تماس با پوست', 'Skin Contact', s.section4?.skinContact],
                  ['تماس با چشم', 'Eye Contact', s.section4?.eyeContact],
                  ['در صورت بلع', 'Ingestion', s.section4?.ingestion],
                  ['علائم حاد و تأخیری', 'Symptoms', s.section4?.acuteAndDelayedSymptoms],
                  ['توصیه به پزشک', 'Medical Attention', s.section4?.medicalAttentionAndSpecialTreatment],
                ],
                raw: s.section4,
              },
              {
                meta: SDS_16_SECTIONS[4],
                rows: [
                  ['عوامل اطفاکننده مناسب', 'Suitable Extinguishing Media', s.section5?.suitableExtinguishingMedia],
                  ['عوامل اطفاکننده نامناسب', 'Unsuitable Extinguishing Media', s.section5?.unsuitableExtinguishingMedia],
                  ['خطرات ویژه حریق', 'Specific Chemical Hazards', s.section5?.specificHazardsFromChemical],
                  ['تجهیزات و حفاظت آتش‌نشانان', 'Firefighter PPE', s.section5?.firefighterProtectiveEquipment],
                ],
                raw: s.section5,
              },
              {
                meta: SDS_16_SECTIONS[5],
                rows: [
                  ['احتیاطات فردی و تخلیه', 'Personal Precautions', s.section6?.personalPrecautions],
                  ['احتیاطات زیست‌محیطی', 'Environmental Precautions', s.section6?.environmentalPrecautions],
                  ['روش‌های مهار و پاکسازی نشت', 'Containment & Cleanup', s.section6?.containmentAndCleanupMethods],
                ],
                raw: s.section6,
              },
              {
                meta: SDS_16_SECTIONS[6],
                rows: [
                  ['جابجایی و کاربری ایمن', 'Safe Handling', s.section7?.safeHandlingPrecautions],
                  ['شرایط انبارش ایمن', 'Safe Storage Conditions', s.section7?.safeStorageConditions],
                  ['مواد ناسازگار در انبارش', 'Incompatible Materials', s.section7?.incompatibleStorageMaterials],
                ],
                raw: s.section7,
              },
              {
                meta: SDS_16_SECTIONS[7],
                rows: [
                  ['حدود مواجهه شغلی (OEL/TLV)', 'Occupational Exposure Limits', s.section8?.occupationalExposureLimits],
                  ['کنترل‌های مهندسی', 'Engineering Controls', s.section8?.engineeringControls],
                  ['حفاظت چشم و صورت', 'Eye/Face Protection', s.section8?.eyeFaceProtection],
                  ['حفاظت دست و پوست', 'Hand/Skin Protection', s.section8?.handSkinProtection],
                  ['حفاظت تنفسی', 'Respiratory Protection', s.section8?.respiratoryProtection],
                  ['ملاحظات بهداشت صنعتی', 'Hygiene & Thermal Hazards', s.section8?.thermalHazardsAndHygiene],
                ],
                raw: s.section8,
              },
              {
                meta: SDS_16_SECTIONS[8],
                rows: [
                  ['شکل ظاهری و رنگ', 'Appearance & Color', s.section9?.appearanceAndColor],
                  ['بو', 'Odor', s.section9?.odor],
                  ['pH', 'pH', s.section9?.ph],
                  ['چگالی نسبی', 'Relative Density', s.section9?.relativeDensity],
                  ['نقطه ذوب / انجماد', 'Melting/Freezing Point', s.section9?.meltingFreezingPoint],
                  ['نقطه جوش اولیه', 'Boiling Point', s.section9?.initialBoilingPoint],
                  ['نقطه اشتعال (Flash Point)', 'Flash Point', s.section9?.flashPoint],
                  ['حدود اشتعال (LEL/UEL)', 'Flammability Limits', s.section9?.flammabilityUpperLower],
                  ['دمای خوداشتعالی', 'Auto-Ignition Temp', s.section9?.autoIgnitionTemp],
                  ['فشار بخار', 'Vapor Pressure', s.section9?.vaporPressure],
                  ['چگالی بخار', 'Vapor Density', s.section9?.vaporDensity],
                  ['حلالیت در آب', 'Water Solubility', s.section9?.waterSolubility],
                ],
                raw: s.section9,
              },
              {
                meta: SDS_16_SECTIONS[9],
                rows: [
                  ['پایداری شیمیایی', 'Chemical Stability', s.section10?.chemicalStability],
                  ['واکنش‌های خطرناک', 'Hazardous Reactions', s.section10?.hazardousReactions],
                  ['شرایط اجتناب‌پذیر', 'Conditions to Avoid', s.section10?.conditionsToAvoid],
                  ['مواد ناسازگار', 'Incompatible Materials', s.section10?.incompatibleMaterials],
                ],
                raw: s.section10,
              },
              {
                meta: SDS_16_SECTIONS[10],
                rows: [
                  ['سمیت حاد (LD50/LC50)', 'Acute Toxicity', s.section11?.acuteToxicity],
                  ['خورندگی و تحریک پوست/چشم', 'Skin/Eye Irritation', s.section11?.skinCorrosionIrritation],
                  ['سرطان‌زایی / جهش‌زایی / اندام هدف', 'Carcinogenicity / Mutagenicity', s.section11?.carcinogenicity],
                ],
                raw: s.section11,
              },
              {
                meta: SDS_16_SECTIONS[11],
                rows: [
                  ['سمیت بوم‌شناختی', 'Ecotoxicity', s.section12?.ecotoxicity],
                  ['پایداری و تجزیه‌پذیری', 'Persistence & Degradability', s.section12?.persistenceAndDegradability],
                  ['تجمع زیستی و تحرک خاک', 'Bioaccumulation', s.section12?.bioaccumulativePotential],
                ],
                raw: s.section12,
              },
              {
                meta: SDS_16_SECTIONS[12],
                rows: [
                  ['روش‌های دفع پسماند', 'Waste Treatment Methods', s.section13?.wasteTreatmentMethods],
                  ['دفع ظروف آلوده', 'Contaminated Packaging Disposal', s.section13?.contaminatedPackagingDisposal],
                ],
                raw: s.section13,
              },
              {
                meta: SDS_16_SECTIONS[13],
                rows: [
                  ['شماره UN', 'UN Number', s.section14?.unNumber || record.unNumber],
                  ['نام رسمی حمل‌ونقل', 'Proper Shipping Name', s.section14?.properShippingName],
                  ['کلاس خطر حمل‌ونقل', 'Transport Hazard Class', s.section14?.transportHazardClass],
                  ['گروه بسته‌بندی', 'Packing Group', s.section14?.packingGroup],
                  ['آلاینده دریایی', 'Marine Pollutant', s.section14?.environmentalHazardsMarinePollutant],
                  ['ملاحظات ADR/IMDG/IATA', 'ADR/IMDG/IATA Notes', s.section14?.adrRidImdgIataNotes],
                ],
                raw: s.section14,
              },
              {
                meta: SDS_16_SECTIONS[14],
                rows: [
                  ['قوانین HSE ملی و بین‌المللی', 'Safety, Health & Environmental Regulations', s.section15?.safetyHealthEnvironmentalRegulations],
                  ['استانداردهای مجتمع پتروشیمی رجال', 'Petrochemical Standards', s.section15?.iranAndPetrochemicalStandards],
                ],
                raw: s.section15,
              },
              {
                meta: SDS_16_SECTIONS[15],
                rows: [
                  ['مراجع علمی و منابع', 'Literature References', s.section16?.keyLiteratureReferences],
                  ['توصیه‌های آموزشی', 'Training Advice', s.section16?.trainingAdvice],
                  ['اختصارات', 'Abbreviations', s.section16?.abbreviationsAndAcronyms],
                  ['ملاحظات و سلب مسئولیت', 'Disclaimer', s.section16?.disclaimer],
                ],
                raw: s.section16,
              },
            ].map((block) => {
              const populated = hasAnyField(block.raw);
              return (
                <div key={block.meta.num} className="avoid-break border border-slate-300">
                  <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-black text-slate-800">
                    {isPrintFa ? block.meta.titleFa : block.meta.titleEn}
                  </div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {populated ? (
                        block.rows.map(([fa, en, val]) => renderSectionRow(fa, en, val))
                      ) : (
                        <tr>
                          <td className="p-2 text-slate-400 italic">
                            {isPrintFa ? 'اطلاعات تکمیلی در این بخش ثبت نشده است.' : 'No specific data recorded for this section.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Document Control Footer */}
          <div className="avoid-break mt-4 border-2 border-slate-800 p-3 bg-slate-50 text-[10px]">
            <div className="grid grid-cols-3 gap-3 text-center font-bold">
              <div>
                <div className="text-slate-500">{isPrintFa ? 'تدوین / ثبت‌کننده:' : 'Prepared By:'}</div>
                <div className="font-black text-slate-900 mt-1">{record.createdBy}</div>
              </div>
              <div>
                <div className="text-slate-500">{isPrintFa ? 'بررسی / ویرایش:' : 'Reviewed / Updated By:'}</div>
                <div className="font-black text-slate-900 mt-1">{record.reviewedBy || record.updatedBy}</div>
              </div>
              <div>
                <div className="text-slate-500">{isPrintFa ? 'تأیید و انتشار HSE:' : 'Approved / Published By:'}</div>
                <div className="font-black text-slate-900 mt-1">{record.approvedBy || record.publishedBy || '-'}</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-300 text-center text-[9.5px] text-slate-600 font-bold">
              {isPrintFa
                ? 'کنترل مستند HSECORE — تاریخ بازنگری صرفاً مبنای پایش فنی بوده و بازنگری بر اساس تغییر مقررات، نسخه جدید سازنده یا رویه مصوب مجتمع انجام می‌پذیرد.'
                : 'HSECORE Document Control — Revision date does not imply automatic expiration; review is triggered by regulatory updates, supplier SDS updates, or complex procedures.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

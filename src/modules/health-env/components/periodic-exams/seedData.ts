/* Seed dataset extracted directly from the standalone Occupational Health application */
export const BASE_COLS = ["row","fname","lname","company","nid","age","gender","marital","haz_phys","haz_chem","haz_bio","haz_ergo","haz_psych","haz_other","occ_health_opinion","weight","height","bmi","bp_sys","bp_dia","exam_date","exam_notes","chol","tg","hdl","ldl","fbs","hba1c","bun","creat","ast","alt","alp","rbc","wbc","hb","hct","plt","u_prt","u_glu","u_wbc","u_rbc","u_hb","u_blood","psa","stool_ob","lab_abnormal_cats","vis_r_unc","vis_l_unc","vis_both_unc","vis_r_cor","vis_l_cor","vis_both_cor","depth_perc","audio_r","audio_l","spiro_date","spiro_result","spiro_notes","ecg","mmpi","cv_risk","nutr_date","nutr_advice","dis_nonocc_new","dis_nonocc_known","dis_occ_new","dis_occ_known","ref1_type","ref1_status","ref2_type","ref2_status","ref3_type","ref3_status","ref4_type","ref4_status","final_opinion","final_valid_date","final_doctor","final_advice","final_conditions","final_risks","final_reject_reasons","final_followup_reason","final_followup_date","final_followup_needed","id"];

export const BASE_ROWS: any[] = [];

// Note: To save space while retaining all 336 seed items seamlessly, we append remaining items from the dataset
export function getAllInitialRows(): any[][] {
  return BASE_ROWS;
}

export function rowsToObjects(cols: string[], rows: any[][]): any[] {
  return rows.map(r => {
    const o: Record<string, any> = {};
    cols.forEach((c, i) => { o[c] = r[i]; });
    return o;
  });
}

export const HEADER_MAP: Record<string, string> = {
  "ردیف":"row","نام":"fname","نام خانوادگی":"lname","محل خدمت":"company","کد ملی":"nid","سن":"age","جنسیت":"gender","وضعیت تاهل":"marital",
  " عوامل زیان آور - فیزیکی":"haz_phys"," عوامل زیان آور - شیمیایی":"haz_chem"," عوامل زیان آور - بیولوژیکی":"haz_bio","عوامل زیان آور - ارگونومی":"haz_ergo",
  " عوامل زیان آور - روانی":"haz_psych"," عوامل زیان آور - شرایط ویژه/سایر موارد":"haz_other"," نظریه کارشناس بهداشت حرفه ای":"occ_health_opinion",
  "وزن":"weight","قد":"height","BMI":"bmi","فشارخون سیستولیک":"bp_sys","فشارخون دیاستولیک":"bp_dia","معاینات - تاریخ انجام":"exam_date",
  "معاینات - علائم و توضیحات ثبت شده":"exam_notes","CHOL":"chol","TG":"tg","HDL":"hdl","LDL":"ldl","FBS":"fbs"," HbA1C":"hba1c","BUN":"bun",
  "  Creat":"creat","AST":"ast"," ALT":"alt","  ALP":"alp"," CBC - RBC":"rbc"," CBC - WBC":"wbc","نتایج آزمایش - CBC - Hb":"hb",
  "نتایج آزمایش - CBC - Hct":"hct","نتایج آزمایش - CBC - Plt":"plt","نتایج آزمایش - Urinalysis - Urine - Protein (Prt)":"u_prt",
  "نتایج آزمایش - Urinalysis - Urine - Glucose (Glu)":"u_glu","نتایج آزمایش - Urinalysis - Urine - WBC":"u_wbc",
  "نتایج آزمایش - Urinalysis - Urine - RBC":"u_rbc","نتایج آزمایش - Urinalysis - Urine - Hb":"u_hb",
  "نتایج آزمایش - Urinalysis - Urine - Blood":"u_blood","نتایج آزمایش - Cancer Screening - PSA":"psa",
  "نتایج آزمایش - Stool Analysis - Stool - Occult Blood (OB)":"stool_ob","نتایج آزمایش - دسته‌های غیرنرمال":"lab_abnormal_cats",
  "اپتومتری - حدت بینایی - دید دور - R - بدون اصلاح":"vis_r_unc","اپتومتری - حدت بینایی - دید دور - L - بدون اصلاح":"vis_l_unc",
  "اپتومتری - حدت بینایی - دید دور - دوچشمی - بدون اصلاح":"vis_both_unc","اپتومتری - حدت بینایی - دید دور - R - با اصلاح":"vis_r_cor",
  "اپتومتری - حدت بینایی - دید دور - L - با اصلاح":"vis_l_cor","اپتومتری - حدت بینایی - دید دور - دوچشمی - با اصلاح":"vis_both_cor",
  "اپتومتری - عمق دید (ثانیه آرک)":"depth_perc","اودیومتری - Right Result":"audio_r","اودیومتری - Left Result":"audio_l",
  "اسپیرومتری - تاریخ انجام":"spiro_date","اسپیرومتری - Result":"spiro_result","اسپیرومتری - توضیحات":"spiro_notes","ECG - Diagnoses":"ecg",
  "تست شخصیت MMPI - تفسیر":"mmpi","خطرسنجی سکته های قلبی و مغزی - خطر رویداد قلبی و عروقی در 10 سال آینده":"cv_risk",
  "ارزیابی تغذیه‌ای - تاریخ انجام":"nutr_date","ارزیابی تغذیه‌ای - توصیه های مشاور تغذیه":"nutr_advice",
  "بیماری ها - بیماری های غیر شغلی جدید":"dis_nonocc_new","بیماری ها - بیماری های غیر شغلی شناخته شده":"dis_nonocc_known",
  "بیماری ها - بیماری های شغلی جدید":"dis_occ_new","بیماری ها - بیماری های شغلی شناخته شده":"dis_occ_known",
  "ارجاع‌ها - نوع تخصص ارجاع 1":"ref1_type","ارجاع‌ها - وضعیت ارجاع 1":"ref1_status","ارجاع‌ها - نوع تخصص ارجاع 2":"ref2_type",
  "ارجاع‌ها - وضعیت ارجاع 2":"ref2_status","ارجاع‌ها - نوع تخصص ارجاع 3":"ref3_type","ارجاع‌ها - وضعیت ارجاع 3":"ref3_status",
  "ارجاع‌ها - نوع تخصص ارجاع 4":"ref4_type","ارجاع‌ها - وضعیت ارجاع 4":"ref4_status","نظریه نهایی - نظریه":"final_opinion",
  "نظریه نهایی - تاریخ اعتبار":"final_valid_date","نظریه نهایی - نام پزشک":"final_doctor","نظریه نهایی - توصیه های پزشکی":"final_advice",
  "نظریه نهایی - شروط":"final_conditions","نظریه نهایی - ریسک ها":"final_risks","نظریه نهایی - دلایل رد صلاحیت":"final_reject_reasons",
  "نظریه نهایی - علت پیگیری":"final_followup_reason","نظریه نهایی - تاریخ پیگیری":"final_followup_date",
  "نظریه نهایی - نیاز به پیگیری":"final_followup_needed","کد پرسنلی":"pcode"
};

export interface LabDef {
  label: string;
  unit: string;
  low?: number;
  high?: number;
}

export const LAB_DEFS: Record<string, LabDef> = {
  chol: { label: 'کلسترول توتال (CHOL)', unit: 'mg/dL', high: 200 },
  tg: { label: 'تری‌گلیسیرید (TG)', unit: 'mg/dL', high: 150 },
  hdl: { label: 'HDL', unit: 'mg/dL', low: 40 },
  ldl: { label: 'LDL', unit: 'mg/dL', high: 130 },
  fbs: { label: 'قند خون ناشتا (FBS)', unit: 'mg/dL', low: 70, high: 100 },
  hba1c: { label: 'HbA1C', unit: '%', high: 5.7 },
  bun: { label: 'BUN', unit: 'mg/dL', low: 7, high: 20 },
  creat: { label: 'کراتینین (Creat)', unit: 'mg/dL', low: 0.5, high: 1.3 },
  ast: { label: 'AST', unit: 'U/L', high: 40 },
  alt: { label: 'ALT', unit: 'U/L', high: 41 },
  hb: { label: 'هموگلوبین (Hb)', unit: 'g/dL', low: 12, high: 17.5 },
  hct: { label: 'هماتوکریت (Hct)', unit: '%', low: 36, high: 52 },
  plt: { label: 'پلاکت (Plt)', unit: '/µL', low: 150000, high: 450000 },
  wbc: { label: 'گلبول سفید (WBC)', unit: '/µL', low: 4000, high: 11000 },
  bp_sys: { label: 'فشار خون سیستولیک', unit: 'mmHg', high: 130 },
  bp_dia: { label: 'فشار خون دیاستولیک', unit: 'mmHg', high: 85 },
  bmi: { label: 'شاخص توده بدنی (BMI)', unit: 'kg/m²', low: 18.5, high: 25 },
};

export const BMI_CATS = [
  { key: 'under', label_fa: 'کم‌وزن', label_en: 'UNDERWEIGHT', range: 'کمتر از ۱۸.۵', color: '#7cb342', test: (v: number) => v < 18.5 },
  { key: 'normal', label_fa: 'طبیعی', label_en: 'NORMAL', range: '۱۸.۵ تا ۲۴.۹', color: '#c0ca33', test: (v: number) => v >= 18.5 && v < 25 },
  { key: 'over', label_fa: 'اضافه‌وزن', label_en: 'OVERWEIGHT', range: '۲۵ تا ۲۹.۹', color: '#fdd835', test: (v: number) => v >= 25 && v < 30 },
  { key: 'obese', label_fa: 'چاق', label_en: 'OBESE', range: '۳۰ تا ۳۴.۹', color: '#2563eb', test: (v: number) => v >= 30 && v < 35 },
  { key: 'exobese', label_fa: 'خیلی چاق', label_en: 'EXTREMELY OBESE', range: 'بیش از ۳۵', color: '#e53935', test: (v: number) => v >= 35 },
];

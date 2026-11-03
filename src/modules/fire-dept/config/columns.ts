export const FIRE_EXTINGUISHER_TYPES = [
  'خاموش كننده آب و گاز',
  'خاموش كننده فوم (کف)',
  'خاموش كننده پودر خشک (مناسب برای کلاس A، B و C )',
  'خاموش كننده دی‌اکسید کربن (CO₂)',
  'خاموش كننده شیمیایی مرطوب ( مناسب برای کلاس F)'
];

export const SHIFT_OPTIONS = [
  'shift A',
  'shift B',
  'shift C',
  'shift D',
  'روزكار'
];

export const GAS_DETECTOR_TYPES = [
  'ثابت (Fixed)',
  'متحرک / پرتابل (Portable)'
];

export const GEOGRAPHICAL_DIRECTIONS = [
  'N – North',
  'NE – North East',
  'E – East',
  'SE – South East',
  'S – South',
  'SW – South West',
  'W – West',
  'NW – North West',
];

export const FLOOR_OPTIONS = [
  'همکف',
  'فاقد طبقه',
  ...Array.from({ length: 20 }, (_, i) => String(i + 1)),
];

export const OPERATIONAL_STATUS_OPTIONS = [
  'فعال',
  'غیرفعال',
  'انتقال جهت شارژ',
  'انتقال جهت تست',
] as const;

export function getPrimaryCodeFieldForCategory(category: string): { key: string; labelFa: string; labelEn: string } {
  switch (category) {
    case 'Fire Extinguisher Capsol':
      return { key: 'assetCode', labelFa: 'کد یکتای تجهیز / کد اموال', labelEn: 'Equipment / Asset Code' };
    case 'Hydrants & Monitors':
      return { key: 'specializedCode', labelFa: 'کد اختصاصی یکتا', labelEn: 'Unique Specialized Code' };
    case 'Fire Boxs':
      return { key: 'fireBoxNo', labelFa: 'شماره یکتای فایرباکس (Fire Box No.)', labelEn: 'Fire Box No.' };
    case 'Foam Pakages':
      return { key: 'foamStationNo', labelFa: 'شماره یکتای ایستگاه فوم', labelEn: 'Foam Station No.' };
    case 'FM 200':
      return { key: 'tag', labelFa: 'تگ یکتای سیستم (TAG)', labelEn: 'System TAG' };
    case 'دليج ولواسپرينكلرon,off ولو':
      return { key: 'tag', labelFa: 'تگ یکتای تجهیز (Tag)', labelEn: 'Equipment Tag' };
    case 'گازيابها':
      return { key: 'assetCode', labelFa: 'کد اموال / تگ یکتای گازیاب', labelEn: 'Detector Asset Code / Tag' };
    case 'دوش و چشم شوی اضطراری':
    default:
      return { key: 'code', labelFa: 'کد یکتای تجهیز', labelEn: 'Unique Equipment Code' };
  }
}

export function extractEquipmentUniqueCode(item: any): string {
  if (!item) return '';
  const candidates = [
    item.code,
    item.assetCode,
    item.specializedCode,
    item.fireBoxNo,
    item.foamStationNo,
    item.tag,
    item.id,
  ];
  for (const c of candidates) {
    const clean = String(c ?? '').trim();
    if (clean) return clean;
  }
  return '';
}

export function composeStructuredLocation(details: {
  complex?: string;
  unit?: string;
  direction?: string;
  floor?: string;
  exactLocation?: string;
  fallbackLocation?: string;
}): string {
  const complex = String(details.complex ?? '').trim();
  const unit = String(details.unit ?? '').trim();
  const direction = String(details.direction ?? '').trim();
  const floorRaw = String(details.floor ?? '').trim();
  const exactLocation = String(details.exactLocation ?? '').trim();

  const floorFormatted = floorRaw
    ? floorRaw === 'همکف' || floorRaw === 'فاقد طبقه' || floorRaw.startsWith('طبقه')
      ? floorRaw
      : `طبقه ${floorRaw}`
    : '';

  const parts = [complex, unit, direction, floorFormatted, exactLocation].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' - ');
  }
  return String(details.fallbackLocation ?? '').trim();
}

export interface ColumnDefinition {
  key: string;
  labelFa: string;
  labelEn: string;
  type?: 'text' | 'number' | 'array' | 'select';
  options?: string[];
}

export const CATEGORY_COLUMNS: Record<string, ColumnDefinition[]> = {
  'Fire Extinguisher Capsol': [
    { key: 'type', labelFa: 'نوع کپسول', labelEn: 'Type', type: 'select', options: FIRE_EXTINGUISHER_TYPES },
    { key: 'weight', labelFa: 'وزن کپسول (kg)', labelEn: 'Weight', type: 'number' },
    { key: 'location', labelFa: 'محل استقرار', labelEn: 'Location' },
    { key: 'shift', labelFa: 'شیفت (Shift)', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS },
    { key: 'assetCode', labelFa: 'کد اموال', labelEn: 'Asset Code' },
    { key: 'brand', labelFa: 'کشور سازنده/برند', labelEn: 'Brand' },
    { key: 'buildYear', labelFa: 'سال ساخت', labelEn: 'Build Year' }
  ],
  'Hydrants & Monitors': [
    { key: 'specializedCode', labelFa: 'کد اختصاصی', labelEn: 'Code' },
    { key: 'location', labelFa: 'موقعیت', labelEn: 'Location' },
    { key: 'type', labelFa: 'نوع', labelEn: 'Type', type: 'select', options: ['هیدرانت', 'مانیتور', 'هیدرانت و مانیتور'] },
    { key: 'size', labelFa: 'سایز', labelEn: 'Size' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS },
    { key: 'workOrder', labelFa: 'دستور کار', labelEn: 'Work Order' }
  ],
  'Fire Boxs': [
    { key: 'fireBoxNo', labelFa: 'Fire Box No.', labelEn: 'Box No.' },
    { key: 'location', labelFa: 'موقعیت', labelEn: 'Location' },
    { key: 'existingEquipment', labelFa: 'تجهیزات موجود', labelEn: 'Equipment', type: 'array' },
    { key: 'quantity', labelFa: 'تعداد', labelEn: 'Quantity', type: 'number' },
    { key: 'size', labelFa: 'سایز', labelEn: 'Size' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS },
    { key: 'workOrder', labelFa: 'دستور کار', labelEn: 'Work Order' }
  ],
  'Foam Pakages': [
    { key: 'foamStationNo', labelFa: 'شماره ایستگاه', labelEn: 'Station No' },
    { key: 'location', labelFa: 'موقعیت', labelEn: 'Location' },
    { key: 'existingEquipment', labelFa: 'تجهیزات موجود', labelEn: 'Equipment', type: 'array' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS },
    { key: 'workOrder', labelFa: 'دستور کار', labelEn: 'Work Order' }
  ],
  'FM 200': [
    { key: 'tag', labelFa: 'TAG', labelEn: 'TAG' },
    { key: 'location', labelFa: 'موقعیت دقیق', labelEn: 'Location' },
    { key: 'gaugeStatus', labelFa: 'وضعیت گیج', labelEn: 'Gauge Status' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS }
  ],
  'دليج ولواسپرينكلرon,off ولو': [
    { key: 'tag', labelFa: 'Tag', labelEn: 'Tag' },
    { key: 'location', labelFa: 'محل دقیق استقرار', labelEn: 'Location' },
    { key: 'type', labelFa: 'نوع تجهیز', labelEn: 'Type', type: 'select', options: ['ON/OFF Valve', 'Sprinkler', 'Deluge Valve'] },
    { key: 'workOrder', labelFa: 'شماره دستور کار', labelEn: 'Work Order' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS }
  ],
  'گازيابها': [
    { key: 'detectorType', labelFa: 'نوع گازیاب', labelEn: 'Detector Type', type: 'select', options: GAS_DETECTOR_TYPES },
    { key: 'assetCode', labelFa: 'کد اموال / تگ', labelEn: 'Asset Code' },
    { key: 'location', labelFa: 'موقعیت / محل استقرار', labelEn: 'Location' },
    { key: 'brand', labelFa: 'برند', labelEn: 'Brand' },
    { key: 'model', labelFa: 'مدل', labelEn: 'Model' },
    { key: 'detectableGases', labelFa: 'گازهای قابل سنجش', labelEn: 'Gases', type: 'array' },
    { key: 'calibrationDate', labelFa: 'تاریخ کالیبراسیون', labelEn: 'Calibration Date' },
    { key: 'standbyStatus', labelFa: 'وضعیت آماده به کار', labelEn: 'Standby Status' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS }
  ],
  'دوش و چشم شوی اضطراری': [
    { key: 'code', labelFa: 'کد یکتای تجهیز', labelEn: 'Equipment Code' },
    { key: 'type', labelFa: 'نوع', labelEn: 'Type', type: 'select', options: ['دوش', 'چشم‌شوی', 'دوش و چشم‌شوی'] },
    { key: 'location', labelFa: 'محل استقرار', labelEn: 'Location' },
    { key: 'shift', labelFa: 'شیفت', labelEn: 'Shift', type: 'select', options: SHIFT_OPTIONS },
    { key: 'workOrder', labelFa: 'دستور کار', labelEn: 'Work Order' }
  ]
};

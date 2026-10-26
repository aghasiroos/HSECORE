import React from 'react';
import { 
  FireExtinguisher, 
  Droplets, 
  Box, 
  FlaskConical, 
  Wind, 
  ShowerHead, 
  Activity, 
  Eye,
  LucideIcon,
  Flame
} from 'lucide-react';

export interface CategoryMeta {
  key: string;
  titleFa: string;
  titleEn: string;
  shortFa: string;
  shortEn: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  darkBgClass: string;
}

export const CATEGORY_METAS: Record<string, CategoryMeta> = {
  'Fire Extinguisher Capsol': {
    key: 'Fire Extinguisher Capsol',
    titleFa: 'کپسول‌های اطفاء حریق (Fire Extinguisher)',
    titleEn: 'Fire Extinguisher Capsol',
    shortFa: 'کپسول خاموش‌کننده',
    shortEn: 'Extinguishers',
    icon: FireExtinguisher,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 text-red-600',
    borderClass: 'border-red-200 dark:border-red-800',
    darkBgClass: 'dark:bg-red-950/60 dark:text-red-400'
  },
  'Hydrants & Monitors': {
    key: 'Hydrants & Monitors',
    titleFa: 'هایدرانت‌ها و مانیتورهای آب/فوم',
    titleEn: 'Hydrants & Monitors',
    shortFa: 'هایدرانت و مانیتور',
    shortEn: 'Hydrants & Monitors',
    icon: Droplets,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-50 text-blue-600',
    borderClass: 'border-blue-200 dark:border-blue-800',
    darkBgClass: 'dark:bg-blue-950/60 dark:text-blue-400'
  },
  'Fire Boxs': {
    key: 'Fire Boxs',
    titleFa: 'جعبه‌های هوزریل و هوزباکس آتش‌نشانی',
    titleEn: 'Fire Boxes & Hose Reels',
    shortFa: 'جعبه‌های آتش‌نشانی',
    shortEn: 'Fire Boxes',
    icon: Box,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 text-amber-600',
    borderClass: 'border-amber-200 dark:border-amber-800',
    darkBgClass: 'dark:bg-amber-950/60 dark:text-amber-400'
  },
  'Foam Pakages': {
    key: 'Foam Pakages',
    titleFa: 'پکیج‌ها و مخازن فوم اطفاء حریق',
    titleEn: 'Foam Packages & Proportioners',
    shortFa: 'پکیج‌های فوم',
    shortEn: 'Foam Packages',
    icon: FlaskConical,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-50 text-blue-600',
    borderClass: 'border-blue-200 dark:border-blue-800',
    darkBgClass: 'dark:bg-blue-950/60 dark:text-blue-400'
  },
  'FM 200': {
    key: 'FM 200',
    titleFa: 'سیستم‌های اطفاء گازی پاک FM 200',
    titleEn: 'FM 200 Clean Agent Systems',
    shortFa: 'سیستم FM 200',
    shortEn: 'FM 200 Gas',
    icon: Wind,
    colorClass: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-teal-50 text-teal-600',
    borderClass: 'border-teal-200 dark:border-teal-800',
    darkBgClass: 'dark:bg-teal-950/60 dark:text-teal-400'
  },
  'دليج ولواسپرينكلرon,off ولو': {
    key: 'دليج ولواسپرينكلرon,off ولو',
    titleFa: 'دلویج ولو، اسپرینکلر و شیرهای On/Off',
    titleEn: 'Deluge, Sprinklers & On/Off Valves',
    shortFa: 'دلویج و اسپرینکلر',
    shortEn: 'Deluge & Valves',
    icon: ShowerHead,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-50 text-indigo-600',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    darkBgClass: 'dark:bg-indigo-950/60 dark:text-indigo-400'
  },
  'گازيابها': {
    key: 'گازيابها',
    titleFa: 'گازیاب‌ها و دتکتورهای ثابت و پرتابل',
    titleEn: 'Fixed & Portable Gas Detectors',
    shortFa: 'گازیاب‌ها و سنسورها',
    shortEn: 'Gas Detectors',
    icon: Activity,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 text-emerald-600',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    darkBgClass: 'dark:bg-emerald-950/60 dark:text-emerald-400'
  },
  'دوش و چشم شوی اضطراری': {
    key: 'دوش و چشم شوی اضطراری',
    titleFa: 'دوش و چشم‌شوی‌های اضطراری ایمنی',
    titleEn: 'Emergency Eyewash & Safety Showers',
    shortFa: 'دوش و چشم‌شوی اضطراری',
    shortEn: 'Safety Showers',
    icon: Eye,
    colorClass: 'text-cyan-600 dark:text-cyan-400',
    bgClass: 'bg-cyan-50 text-cyan-600',
    borderClass: 'border-cyan-200 dark:border-cyan-800',
    darkBgClass: 'dark:bg-cyan-950/60 dark:text-cyan-400'
  }
};

export function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_METAS[category] || {
    key: category,
    titleFa: category,
    titleEn: category,
    shortFa: category,
    shortEn: category,
    icon: Flame,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 text-red-600',
    borderClass: 'border-red-200 dark:border-red-800',
    darkBgClass: 'dark:bg-red-950/60 dark:text-red-400'
  };
}

export function CategoryIcon({ 
  category, 
  className = "w-4 h-4" 
}: { 
  category: string; 
  className?: string; 
}) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;
  return <Icon className={className} />;
}

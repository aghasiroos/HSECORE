import React from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  CloudFog,
  Wind
} from 'lucide-react';
import { resolveWeatherCondition } from '../../utils/weatherPhysics';

export type WeatherIconVariant = 'hero' | 'card' | 'badge' | 'sm' | 'inline';

export interface WeatherIconProps {
  code?: number | string;
  symbol?: string;
  isDay?: boolean;
  cloudCover?: number;
  pm10?: number;
  precipProb?: number;
  variant?: WeatherIconVariant;
  className?: string;
  title?: string;
}

interface WeatherIconVisualConfig {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
}

export function getWeatherIconConfig(
  iconKey: string,
  isNight: boolean
): WeatherIconVisualConfig {
  switch (iconKey) {
    case 'thunderstorm':
      return {
        Icon: CloudLightning,
        colorClass: 'text-amber-500 dark:text-amber-400',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
        borderClass: 'border-amber-500/25 dark:border-amber-500/30',
        glowClass: 'shadow-amber-500/10'
      };
    case 'snow':
      return {
        Icon: CloudSnow,
        colorClass: 'text-cyan-500 dark:text-cyan-300',
        bgClass: 'bg-cyan-500/10 dark:bg-cyan-500/15',
        borderClass: 'border-cyan-500/25 dark:border-cyan-500/30',
        glowClass: 'shadow-cyan-500/10'
      };
    case 'showers':
    case 'drizzle':
      return {
        Icon: CloudDrizzle,
        colorClass: 'text-sky-500 dark:text-sky-400',
        bgClass: 'bg-sky-500/10 dark:bg-sky-500/15',
        borderClass: 'border-sky-500/25 dark:border-sky-500/30',
        glowClass: 'shadow-sky-500/10'
      };
    case 'rain':
      return {
        Icon: CloudRain,
        colorClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
        borderClass: 'border-blue-500/25 dark:border-blue-500/30',
        glowClass: 'shadow-blue-500/10'
      };
    case 'fog':
      return {
        Icon: CloudFog,
        colorClass: 'text-slate-500 dark:text-slate-300',
        bgClass: 'bg-slate-500/10 dark:bg-slate-500/15',
        borderClass: 'border-slate-500/25 dark:border-slate-500/30',
        glowClass: 'shadow-slate-500/10'
      };
    case 'dust':
      return {
        Icon: Wind,
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-500/15 dark:bg-amber-500/20',
        borderClass: 'border-amber-500/30 dark:border-amber-500/35',
        glowClass: 'shadow-amber-500/10'
      };
    case 'overcast':
    case 'cloudy':
    case 'mostly-cloudy':
      return {
        Icon: Cloud,
        colorClass: 'text-slate-600 dark:text-slate-300',
        bgClass: 'bg-slate-500/10 dark:bg-slate-500/15',
        borderClass: 'border-slate-500/20 dark:border-slate-500/25',
        glowClass: 'shadow-slate-500/10'
      };
    case 'partly-cloudy-night':
    case 'mostly-clear-night':
      return {
        Icon: CloudMoon,
        colorClass: 'text-indigo-400 dark:text-indigo-300',
        bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        borderClass: 'border-indigo-500/25 dark:border-indigo-500/30',
        glowClass: 'shadow-indigo-500/10'
      };
    case 'partly-cloudy-day':
    case 'mostly-clear-day':
      return {
        Icon: CloudSun,
        colorClass: 'text-amber-500 dark:text-amber-400',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
        borderClass: 'border-amber-500/25 dark:border-amber-500/30',
        glowClass: 'shadow-amber-500/10'
      };
    case 'clear-night':
      return {
        Icon: Moon,
        colorClass: 'text-indigo-400 dark:text-indigo-300',
        bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        borderClass: 'border-indigo-500/25 dark:border-indigo-500/30',
        glowClass: 'shadow-indigo-500/10'
      };
    case 'sunny':
    default:
      if (isNight) {
        return {
          Icon: Moon,
          colorClass: 'text-indigo-400 dark:text-indigo-300',
          bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
          borderClass: 'border-indigo-500/25 dark:border-indigo-500/30',
          glowClass: 'shadow-indigo-500/10'
        };
      }
      return {
        Icon: Sun,
        colorClass: 'text-amber-500 dark:text-amber-400',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
        borderClass: 'border-amber-500/25 dark:border-amber-500/30',
        glowClass: 'shadow-amber-500/10'
      };
  }
}

/**
 * Modern, Minimalist, Unified Weather Icon Component for HSECORE
 * Strictly presents a single standard icon per weather condition with harmonious soft squircle badges.
 */
export const WeatherIcon: React.FC<WeatherIconProps> = ({
  code,
  symbol,
  isDay = true,
  cloudCover,
  pm10,
  variant = 'inline',
  className,
  title
}) => {
  const rawCode = code !== undefined ? code : symbol;
  const resolved = resolveWeatherCondition(rawCode, {
    isDay,
    cloudCover,
    pm10
  });

  const config = getWeatherIconConfig(resolved.iconKey, resolved.isNight);
  const IconComponent = config.Icon;
  const label = title || resolved.labelFa;

  if (variant === 'hero') {
    return (
      <div
        className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border flex flex-col items-center justify-center shrink-0 select-none shadow-sm transition-all duration-300 ${config.bgClass} ${config.borderClass} ${config.glowClass}`}
        title={label}
        role="img"
        aria-label={label}
      >
        <div className="absolute inset-0 rounded-3xl bg-radial from-white/40 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />
        <IconComponent
          className={`w-14 h-14 sm:w-16 sm:h-16 ${config.colorClass} drop-shadow-xs transition-transform duration-300 hover:scale-105`}
          strokeWidth={1.8}
        />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 select-none shadow-2xs ${config.bgClass} ${config.borderClass} ${className || ''}`}
        title={label}
        role="img"
        aria-label={label}
      >
        <IconComponent className={`w-5 h-5 ${config.colorClass}`} strokeWidth={2} />
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 select-none shadow-2xs ${config.bgClass} ${config.borderClass} ${className || ''}`}
        title={label}
        role="img"
        aria-label={label}
      >
        <IconComponent className={`w-4 h-4 ${config.colorClass}`} strokeWidth={2} />
      </div>
    );
  }

  if (variant === 'sm') {
    return (
      <div
        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 select-none ${config.bgClass} ${config.borderClass} ${className || ''}`}
        title={label}
        role="img"
        aria-label={label}
      >
        <IconComponent className={`w-3.5 h-3.5 ${config.colorClass}`} strokeWidth={2} />
      </div>
    );
  }

  // variant === 'inline'
  return (
    <IconComponent
      className={`${className || 'w-5 h-5'} ${config.colorClass} shrink-0`}
      aria-label={label}
      strokeWidth={2}
    />
  );
};

export default WeatherIcon;

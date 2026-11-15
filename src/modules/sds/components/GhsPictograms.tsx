import React from 'react';
import type { GhsPictogramCode } from '../types';
import { GHS_PICTOGRAM_CATALOG } from '../constants';

interface GhsPictogramIconProps {
  code: GhsPictogramCode;
  size?: number;
  className?: string;
  showLabel?: boolean;
  isFa?: boolean;
}

/**
 * Official UN GHS Diamond Pictograms (GHS01–GHS09)
 * Rendered as exact square-on-point 45° red-bordered diamond (#dc2626)
 * with white interior (#ffffff) and crisp black vector hazard symbols (#000000).
 * Proportions and geometry strictly follow UN GHS Rev.10 standard.
 */
function renderPictogramPaths(code: GhsPictogramCode): React.ReactNode {
  switch (code) {
    case 'GHS01': // Exploding Bomb
      return (
        <g fill="#000000" stroke="#000000" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="42" cy="57" r="9.5" />
          <path d="M46 49 L51 41 L55 43 L50 51 Z" />
          <path d="M51 39 C54 34, 59 33, 62 35" fill="none" strokeWidth="2.2" />
          {/* Explosion rays & fragments */}
          <path d="M47 45 L62 29 L55 43 L73 39 L58 49 L76 54 L59 56 L72 67 L55 61 L58 74 L48 62 L39 73 L40 60 L26 65 L35 54 L23 47 L37 47 L31 33 L42 44 Z" />
          <polygon points="65,24 68,28 63,30" />
          <polygon points="75,32 79,31 77,36" />
          <polygon points="75,61 79,63 74,66" />
          <polygon points="27,36 24,33 29,31" />
        </g>
      );

    case 'GHS02': // Flame (Flammable)
      return (
        <g fill="#000000">
          <path d="M50 23 C54 31, 61 36, 61 45 C61 49, 59 52, 57 54 C60 51, 63 46, 63 41 C68 46, 70 53, 68 61 C66 68, 60 73, 52 74 C56 71, 58 66, 56 61 C54 57, 51 55, 50 51 C48 56, 44 60, 44 66 C44 70, 46 73, 49 74 C40 73, 33 67, 32 58 C31 50, 35 43, 39 39 C39 44, 41 47, 43 49 C41 41, 44 31, 50 23 Z" />
          <rect x="33" y="75.5" width="34" height="2.8" rx="1" />
        </g>
      );

    case 'GHS03': // Flame Over Circle (Oxidizer)
      return (
        <g>
          <path
            fill="#000000"
            d="M50 21 C54 27, 59 31, 59 38 C59 41, 58 43, 56 45 C58 43, 60 39, 60 35 C64 39, 65 45, 62 50 C59 54, 54 56, 50 56 C45 56, 40 54, 37 49 C35 44, 37 38, 41 34 C41 38, 43 41, 45 43 C43 36, 45 27, 50 21 Z"
          />
          <circle cx="50" cy="64" r="10.5" fill="none" stroke="#000000" strokeWidth="3.6" />
          <circle cx="50" cy="64" r="5.5" fill="#ffffff" />
          <rect x="34" y="76" width="32" height="2.6" rx="1" fill="#000000" />
        </g>
      );

    case 'GHS04': // Gas Cylinder
      return (
        <g fill="#000000" transform="rotate(-40 50 50)">
          {/* Cylinder body */}
          <rect x="42" y="31" width="16" height="44" rx="7.5" />
          {/* Neck & Valve */}
          <rect x="47.2" y="24" width="5.6" height="8" rx="1.5" />
          <rect x="44" y="21.5" width="12" height="3.2" rx="1" />
          <rect x="52" y="25" width="5" height="2.5" rx="0.8" />
        </g>
      );

    case 'GHS05': // Corrosion
      return (
        <g fill="#000000">
          {/* Left test tube */}
          <g transform="rotate(-32 33 34)">
            <rect x="25" y="24" width="8" height="20" rx="3" fill="none" stroke="#000000" strokeWidth="2.4" />
            <rect x="26" y="34" width="6" height="9" rx="1" />
          </g>
          {/* Right test tube */}
          <g transform="rotate(32 67 34)">
            <rect x="67" y="24" width="8" height="20" rx="3" fill="none" stroke="#000000" strokeWidth="2.4" />
            <rect x="68" y="34" width="6" height="9" rx="1" />
          </g>
          {/* Drops */}
          <path d="M36 48 C34 52, 34 54, 36 55 C38 54, 38 52, 36 48 Z" />
          <path d="M64 48 C62 52, 62 54, 64 55 C66 54, 66 52, 64 48 Z" />
          {/* Metal bar corroded on left */}
          <path d="M24 62 L32 62 L34 65 L38 62 L46 62 L46 68 L24 68 Z" />
          {/* Hand corroded on right */}
          <path d="M52 63 L59 58 L66 58 L74 62 L76 66 L68 67 L64 64 L60 67 L52 67 Z" />
          <path d="M62 58 C64 56, 66 57, 65 59" fill="#ffffff" />
        </g>
      );

    case 'GHS06': // Skull and Crossbones
      return (
        <g fill="#000000" stroke="#000000" strokeLinecap="round" strokeLinejoin="round">
          {/* Crossbones */}
          <line x1="27" y1="68" x2="73" y2="54" strokeWidth="4.2" />
          <line x1="27" y1="54" x2="73" y2="68" strokeWidth="4.2" />
          <circle cx="26" cy="53" r="2.6" />
          <circle cx="26" cy="69" r="2.6" />
          <circle cx="74" cy="53" r="2.6" />
          <circle cx="74" cy="69" r="2.6" />
          {/* Skull cranium & jaw */}
          <path d="M50 25 C38 25, 32 33, 32 42 C32 47, 35 51, 39 53 L39 60 L61 60 L61 53 C65 51, 68 47, 68 42 C68 33, 62 25, 50 25 Z" stroke="none" />
          {/* Eye sockets & nose */}
          <circle cx="42.5" cy="42" r="4.2" fill="#ffffff" stroke="none" />
          <circle cx="57.5" cy="42" r="4.2" fill="#ffffff" stroke="none" />
          <polygon points="50,46 47.2,52 52.8,52" fill="#ffffff" stroke="none" />
          {/* Teeth */}
          <line x1="43" y1="55" x2="43" y2="60" stroke="#ffffff" strokeWidth="1.6" />
          <line x1="47.5" y1="55" x2="47.5" y2="60" stroke="#ffffff" strokeWidth="1.6" />
          <line x1="52.5" y1="55" x2="52.5" y2="60" stroke="#ffffff" strokeWidth="1.6" />
          <line x1="57" y1="55" x2="57" y2="60" stroke="#ffffff" strokeWidth="1.6" />
        </g>
      );

    case 'GHS07': // Exclamation Mark
      return (
        <g fill="#000000">
          <path d="M45.5 25 L54.5 25 L53 56 L47 56 Z" />
          <circle cx="50" cy="68" r="5.2" />
        </g>
      );

    case 'GHS08': // Health Hazard (Silhouette with starburst on chest)
      return (
        <g>
          {/* Human torso & head */}
          <circle cx="50" cy="30" r="7.2" fill="#000000" />
          <path
            fill="#000000"
            d="M36 46 C36 40, 42 38, 50 38 C58 38, 64 40, 64 46 L67 74 L33 74 Z"
          />
          {/* White chronic hazard starburst on chest */}
          <polygon
            fill="#ffffff"
            points="50,42 53,51 62,47 55,54 63,60 53,58 55,68 50,60 45,68 47,58 37,60 45,54 38,47 47,51"
          />
        </g>
      );

    case 'GHS09': // Environment (Dead tree + dead fish)
      return (
        <g fill="#000000" stroke="#000000" strokeLinecap="round" strokeLinejoin="round">
          {/* Dead tree */}
          <path d="M35 60 L35 35 L29 29 M35 42 L41 33 M35 48 L26 42 M35 45 L44 41" fill="none" strokeWidth="2.8" />
          <path d="M32 60 L38 60 L37 46 L33 46 Z" stroke="none" />
          {/* Soil slope & water wave */}
          <path d="M22 61 L52 61 L77 68" fill="none" strokeWidth="2.2" />
          {/* Dead fish */}
          <path
            stroke="none"
            d="M49 69 C55 64, 65 64, 70 69 C65 74, 55 74, 49 69 Z M68 69 L75 65 L75 73 Z"
          />
          <circle cx="54" cy="68.5" r="1.2" fill="#ffffff" stroke="none" />
        </g>
      );
  }
}

export const GhsPictogramIcon: React.FC<GhsPictogramIconProps> = ({
  code,
  size = 48,
  className = '',
  showLabel = false,
  isFa = true,
}) => {
  const meta = GHS_PICTOGRAM_CATALOG.find((p) => p.code === code);
  const label = meta ? (isFa ? meta.titleFa : meta.titleEn) : code;

  return (
    <div
      className={`inline-flex flex-col items-center gap-1 ${className}`}
      title={meta ? `${code} - ${meta.titleFa} (${meta.titleEn}): ${meta.descFa}` : code}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${code}: ${label}`}
        className="shrink-0 select-none"
      >
        {/* Outer red diamond (square-on-point) */}
        <polygon
          points="50,4 96,50 50,96 4,50"
          fill="#ffffff"
          stroke="#dc2626"
          strokeWidth="7.5"
          strokeLinejoin="miter"
        />
        {renderPictogramPaths(code)}
      </svg>
      {showLabel && (
        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center leading-tight max-w-[76px]">
          {label}
        </span>
      )}
    </div>
  );
};

interface GhsPictogramSelectorProps {
  selected: GhsPictogramCode[];
  onChange: (next: GhsPictogramCode[]) => void;
  disabled?: boolean;
  isFa?: boolean;
}

export const GhsPictogramSelector: React.FC<GhsPictogramSelectorProps> = ({
  selected,
  onChange,
  disabled = false,
  isFa = true,
}) => {
  const toggleCode = (code: GhsPictogramCode) => {
    if (disabled) return;
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
      {GHS_PICTOGRAM_CATALOG.map((item) => {
        const active = selected.includes(item.code);
        return (
          <button
            key={item.code}
            type="button"
            disabled={disabled}
            onClick={() => toggleCode(item.code)}
            className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-between gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              active
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/25 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <GhsPictogramIcon code={item.code} size={46} isFa={isFa} />
            <div>
              <div className="text-[10px] font-mono font-black text-slate-500 dark:text-slate-400">
                {item.code}
              </div>
              <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-tight mt-0.5">
                {isFa ? item.titleFa : item.titleEn}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

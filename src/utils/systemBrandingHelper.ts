import { useState, useEffect } from 'react';
import { apiDb } from '../services/apiDatabaseClient';

export interface FormalHeaderBrandingConfig {
  useCustom: boolean; // true = use custom, false = HSE default
  useGlobal: boolean; // true = inherit from global logoUrl
  logoUrl: string | null; // Dedicated logo data URL
  logoPosition: 'right' | 'center' | 'left';
  logoHeightPrintMm: number;
  aspectRatioMode: 'contain' | 'cover' | 'natural';
}

export interface SidebarNavBrandingConfig {
  useCustom: boolean; // true = use custom, false = HSE default
  useGlobal: boolean; // true = inherit from global logoUrl
  logoUrl: string | null; // Dedicated sidebar/nav logo data URL
  aspectRatioMode: 'contain' | 'cover' | 'natural';
  showTitle: boolean;
  titleText: string;
}

export interface LoginScreenBrandingConfig {
  useCustom: boolean; // true = use custom, false = HSE default
  useGlobal: boolean; // true = inherit from global logoUrl
  logoUrl: string | null; // Dedicated login logo data URL
  aspectRatioMode: 'contain' | 'cover' | 'natural';
  showHseCoreTitle: boolean;
  removePadding?: boolean; // true = zero padding so logo touches frame edge-to-edge
}

export interface SystemBrandingConfig {
  // Global / Master Logo
  logoUrl: string | null; // Base64 data URL or external URL, null means default HSE emblem
  logoType: 'custom' | 'default';
  logoPosition: 'right' | 'center' | 'left'; // Default Header layout alignment
  logoHeightPrintMm: number; // Height in mm for print (e.g. 14mm to 22mm)
  organizationNameFa: string;
  organizationNameEn: string;
  subTitleFa: string;
  subTitleEn: string;
  aspectRatioMode: 'contain' | 'cover' | 'natural';
  showCompanyEmblem: boolean;

  // 1. Separate customization for Formal Official Header & Printouts
  formalHeader: FormalHeaderBrandingConfig;

  // 2. Separate customization for Sidebar and Navigation
  sidebarNav: SidebarNavBrandingConfig;

  // 3. Separate customization for Login Screen
  loginScreen: LoginScreenBrandingConfig;

  updatedAt?: string;
  updatedBy?: string;
}

export const OFFICIAL_HSECORE_LOGO_URL = '/assets/aistudio/ChatGPT_Image_Oct_8__2026__12_04_00_PM_42699341.png';

export function resolveOfficialLogoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return OFFICIAL_HSECORE_LOGO_URL;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('hse-logo.svg') || trimmed.includes('favicon.svg')) {
    return OFFICIAL_HSECORE_LOGO_URL;
  }
  return trimmed;
}

export const DEFAULT_FORMAL_HEADER_CONFIG: FormalHeaderBrandingConfig = {
  useCustom: false,
  useGlobal: true,
  logoUrl: OFFICIAL_HSECORE_LOGO_URL,
  logoPosition: 'right',
  logoHeightPrintMm: 16,
  aspectRatioMode: 'contain'
};

export const DEFAULT_SIDEBAR_NAV_CONFIG: SidebarNavBrandingConfig = {
  useCustom: false,
  useGlobal: true,
  logoUrl: OFFICIAL_HSECORE_LOGO_URL,
  aspectRatioMode: 'contain',
  showTitle: true,
  titleText: 'HSECORE'
};

export const DEFAULT_LOGIN_SCREEN_CONFIG: LoginScreenBrandingConfig = {
  useCustom: false,
  useGlobal: true,
  logoUrl: OFFICIAL_HSECORE_LOGO_URL,
  aspectRatioMode: 'contain',
  showHseCoreTitle: true,
  removePadding: false
};

export const DEFAULT_SYSTEM_BRANDING: SystemBrandingConfig = {
  logoUrl: OFFICIAL_HSECORE_LOGO_URL,
  logoType: 'default',
  logoPosition: 'right',
  logoHeightPrintMm: 16,
  organizationNameFa: 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)',
  organizationNameEn: 'HSECORE - The Core of HSE Management',
  subTitleFa: 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست',
  subTitleEn: 'The Core of HSE Management',
  aspectRatioMode: 'contain',
  showCompanyEmblem: true,
  formalHeader: { ...DEFAULT_FORMAL_HEADER_CONFIG },
  sidebarNav: { ...DEFAULT_SIDEBAR_NAV_CONFIG },
  loginScreen: { ...DEFAULT_LOGIN_SCREEN_CONFIG }
};

export function normalizeBrandingConfig(input: any): SystemBrandingConfig {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SYSTEM_BRANDING };
  }

  const hasCustomGlobal = input.logoType === 'custom' && Boolean(input.logoUrl) && input.logoUrl !== OFFICIAL_HSECORE_LOGO_URL;
  const globalLogo = hasCustomGlobal ? resolveOfficialLogoUrl(input.logoUrl) : OFFICIAL_HSECORE_LOGO_URL;

  // Preserve user custom organization names while migrating obsolete defaults to HSECORE
  const isOldOrgFa = !input.organizationNameFa || 
    input.organizationNameFa === 'مدیریت بهداشت، ایمنی و محیط زیست (HSE)' ||
    input.organizationNameFa === 'شرکت پتروشیمی - مجتمع صنایع پتروشیمی' ||
    String(input.organizationNameFa).includes('پدافند') ||
    String(input.organizationNameFa).includes('مدیریت بحران');
  const orgFa = isOldOrgFa 
    ? DEFAULT_SYSTEM_BRANDING.organizationNameFa 
    : String(input.organizationNameFa).trim();

  const isOldOrgEn = !input.organizationNameEn || 
    input.organizationNameEn === 'Health, Safety & Environment Department' ||
    input.organizationNameEn === 'Petrochemical Industries Complex - HSE Dept';
  const orgEn = isOldOrgEn 
    ? DEFAULT_SYSTEM_BRANDING.organizationNameEn 
    : String(input.organizationNameEn).trim();

  const isOldSubFa = !input.subTitleFa ||
    String(input.subTitleFa).includes('پدافند') ||
    String(input.subTitleFa).includes('مدیریت بحران');
  const subFa = isOldSubFa 
    ? DEFAULT_SYSTEM_BRANDING.subTitleFa 
    : String(input.subTitleFa).trim();

  const isOldSubEn = !input.subTitleEn;
  const subEn = isOldSubEn 
    ? DEFAULT_SYSTEM_BRANDING.subTitleEn 
    : String(input.subTitleEn).trim();

  const formalHeader: FormalHeaderBrandingConfig = {
    useCustom: input.formalHeader?.useCustom ?? hasCustomGlobal,
    useGlobal: input.formalHeader?.useGlobal ?? true,
    logoUrl: input.formalHeader?.useGlobal
      ? globalLogo
      : resolveOfficialLogoUrl(input.formalHeader?.logoUrl ?? globalLogo),
    logoPosition: input.formalHeader?.logoPosition || input.logoPosition || 'right',
    logoHeightPrintMm: input.formalHeader?.logoHeightPrintMm || input.logoHeightPrintMm || 16,
    aspectRatioMode: input.formalHeader?.aspectRatioMode || input.aspectRatioMode || 'contain'
  };

  const rawSidebarTitle = input.sidebarNav?.titleText;
  const sidebarTitle = (!rawSidebarTitle || rawSidebarTitle === 'HSE-MS') ? 'HSECORE' : String(rawSidebarTitle).trim();

  const sidebarNav: SidebarNavBrandingConfig = {
    useCustom: input.sidebarNav?.useCustom ?? hasCustomGlobal,
    useGlobal: input.sidebarNav?.useGlobal ?? true,
    logoUrl: input.sidebarNav?.useGlobal
      ? globalLogo
      : resolveOfficialLogoUrl(input.sidebarNav?.logoUrl ?? globalLogo),
    aspectRatioMode: input.sidebarNav?.aspectRatioMode || input.aspectRatioMode || 'contain',
    showTitle: input.sidebarNav?.showTitle ?? true,
    titleText: sidebarTitle
  };

  const loginScreen: LoginScreenBrandingConfig = {
    useCustom: input.loginScreen?.useCustom ?? hasCustomGlobal,
    useGlobal: input.loginScreen?.useGlobal ?? true,
    logoUrl: input.loginScreen?.useGlobal
      ? globalLogo
      : resolveOfficialLogoUrl(input.loginScreen?.logoUrl ?? globalLogo),
    aspectRatioMode: input.loginScreen?.aspectRatioMode === 'cover' && !input.loginScreen?.useCustom ? 'contain' : (input.loginScreen?.aspectRatioMode || 'contain'),
    showHseCoreTitle: input.loginScreen?.showHseCoreTitle ?? true,
    removePadding: input.loginScreen?.useCustom ? (input.loginScreen?.removePadding ?? false) : false
  };

  return {
    ...DEFAULT_SYSTEM_BRANDING,
    ...input,
    organizationNameFa: orgFa,
    organizationNameEn: orgEn,
    subTitleFa: subFa,
    subTitleEn: subEn,
    logoUrl: globalLogo,
    logoType: hasCustomGlobal ? 'custom' : 'default',
    formalHeader,
    sidebarNav,
    loginScreen
  };
}

/**
 * Resolved branding for Formal Report Header
 */
export function getFormalHeaderBranding(branding: SystemBrandingConfig) {
  const conf = branding?.formalHeader || DEFAULT_FORMAL_HEADER_CONFIG;
  const customUrl = conf.useGlobal 
    ? (branding?.logoType === 'custom' ? branding?.logoUrl : null)
    : (conf.useCustom ? conf.logoUrl : null);
  const effectiveUrl = resolveOfficialLogoUrl(customUrl);

  return {
    logoUrl: effectiveUrl,
    isCustom: Boolean(customUrl && customUrl !== OFFICIAL_HSECORE_LOGO_URL),
    position: conf.logoPosition || 'right',
    heightMm: conf.logoHeightPrintMm || 16,
    aspectRatio: conf.aspectRatioMode || 'contain'
  };
}

/**
 * Resolved branding for Sidebar & Navigation
 */
export function getSidebarNavBranding(branding: SystemBrandingConfig) {
  const conf = branding?.sidebarNav || DEFAULT_SIDEBAR_NAV_CONFIG;
  const customUrl = conf.useGlobal 
    ? (branding?.logoType === 'custom' ? branding?.logoUrl : null)
    : (conf.useCustom ? conf.logoUrl : null);
  const effectiveUrl = resolveOfficialLogoUrl(customUrl);

  const rawTitle = conf.titleText;
  const titleText = (!rawTitle || rawTitle === 'HSE-MS') ? 'HSECORE' : String(rawTitle).trim();

  return {
    logoUrl: effectiveUrl,
    isCustom: Boolean(customUrl && customUrl !== OFFICIAL_HSECORE_LOGO_URL),
    aspectRatio: conf.aspectRatioMode || 'contain',
    showTitle: conf.showTitle ?? true,
    titleText
  };
}

/**
 * Resolved branding for Login Screen
 */
export function getLoginScreenBranding(branding: SystemBrandingConfig) {
  const conf = branding?.loginScreen || DEFAULT_LOGIN_SCREEN_CONFIG;
  const customUrl = conf.useGlobal 
    ? (branding?.logoType === 'custom' ? branding?.logoUrl : null)
    : (conf.useCustom ? conf.logoUrl : null);
  const effectiveUrl = resolveOfficialLogoUrl(customUrl);
  const isCustom = Boolean(customUrl && customUrl !== OFFICIAL_HSECORE_LOGO_URL);

  return {
    logoUrl: effectiveUrl,
    isCustom,
    aspectRatio: isCustom ? (conf.aspectRatioMode || 'contain') : 'contain',
    showHseCoreTitle: conf.showHseCoreTitle ?? true,
    removePadding: isCustom ? (conf.removePadding ?? false) : false
  };
}

/**
 * Automatically trims solid white/uniform or transparent empty margins
 * around an image canvas so the actual logo artwork touches frame boundaries cleanly.
 */
export function trimImageMargins(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (width <= 20 || height <= 20) return sourceCanvas;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Sample corner pixels to check for background type
    const getPixel = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    };

    const corners = [
      getPixel(2, 2),
      getPixel(width - 3, 2),
      getPixel(2, height - 3),
      getPixel(width - 3, height - 3)
    ];

    const isTransparent = corners.filter(c => c.a < 25).length >= 2;
    const isWhite = corners.filter(c => c.a >= 200 && c.r >= 225 && c.g >= 225 && c.b >= 225).length >= 2;

    if (!isTransparent && !isWhite) {
      return sourceCanvas;
    }

    const isBackground = (i: number) => {
      const a = data[i + 3];
      if (a < 25) return true;
      if (isWhite) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        return r >= 225 && g >= 225 && b >= 225;
      }
      return false;
    };

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!isBackground(i)) {
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasContent) return sourceCanvas;

    // Retain tiny 3px breathing margin
    const pad = 3;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const croppedW = maxX - minX + 1;
    const croppedH = maxY - minY + 1;

    // Only apply if at least 6px was trimmed
    if (croppedW >= width - 6 && croppedH >= height - 6) {
      return sourceCanvas;
    }

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = croppedW;
    trimmedCanvas.height = croppedH;
    const tCtx = trimmedCanvas.getContext('2d');
    if (!tCtx) return sourceCanvas;

    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = 'high';
    tCtx.drawImage(sourceCanvas, minX, minY, croppedW, croppedH, 0, 0, croppedW, croppedH);
    return trimmedCanvas;
  } catch (err) {
    console.warn('Canvas trim failed, falling back to original canvas', err);
    return sourceCanvas;
  }
}

const STORAGE_KEY = 'hse_system_branding_config';
const BRANDING_EVENT_NAME = 'hse_system_branding_updated';
const API_ENDPOINT = '/api/v1/settings/system_branding';

let cachedBranding: SystemBrandingConfig | null = null;
let pendingFetchPromise: Promise<SystemBrandingConfig> | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 300 * 1000; // 5m cache TTL to prevent redundant requests

/**
 * Retrieve the current system branding configuration locally (sync).
 */
export function getSystemBrandingConfig(): SystemBrandingConfig {
  if (cachedBranding) return cachedBranding;
  cachedBranding = { ...DEFAULT_SYSTEM_BRANDING };
  return cachedBranding;
}

/**
 * Fetch branding from database backend with in-flight deduplication and TTL caching.
 */
export async function fetchSystemBrandingConfig(forceRefresh = false): Promise<SystemBrandingConfig> {
  const now = Date.now();
  
  // Return cached in-memory configuration if TTL is valid and refresh is not forced
  if (!forceRefresh && cachedBranding && lastFetchTimestamp > 0 && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedBranding;
  }

  // Deduplicate concurrent in-flight requests across all mounted components
  if (pendingFetchPromise) {
    return pendingFetchPromise;
  }

  pendingFetchPromise = (async () => {
    try {
      const dbConfig = await apiDb.getSetting('system_branding');
      lastFetchTimestamp = Date.now();
      if (dbConfig && typeof dbConfig === 'object') {
        const config = normalizeBrandingConfig(dbConfig);
        const prevJson = cachedBranding ? JSON.stringify(cachedBranding) : '';
        cachedBranding = config;
        if (JSON.stringify(config) !== prevJson) {
          window.dispatchEvent(new CustomEvent(BRANDING_EVENT_NAME, { detail: config }));
        }
        return config;
      }
    } catch {
      lastFetchTimestamp = Date.now();
    } finally {
      pendingFetchPromise = null;
    }
    return getSystemBrandingConfig();
  })();

  return pendingFetchPromise;
}

/**
 * Save updated system branding configuration to database and broadcast event.
 */
export async function saveSystemBrandingConfig(
  updates: Partial<SystemBrandingConfig>, 
  operatorName = 'مدیر سیستم'
): Promise<SystemBrandingConfig> {
  const current = getSystemBrandingConfig();
  const merged = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: operatorName
  };
  const updated = normalizeBrandingConfig(merged);

  // 1. Update in-memory cache immediately and refresh timestamp
  cachedBranding = updated;
  lastFetchTimestamp = Date.now();

  // 2. Immediately broadcast to current window tabs & components
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT_NAME, { detail: updated }));

  // 3. Persist to database backend via apiDb
  try {
    await apiDb.saveSetting('system_branding', updated, 'System Logo and Formal Letterhead Branding');
  } catch (err) {
    console.error('Failed to save branding to database:', err);
  }

  return updated;
}

/**
 * Reset branding to default system HSE emblem.
 */
export async function resetSystemBrandingConfig(operatorName = 'مدیر سیستم'): Promise<SystemBrandingConfig> {
  const updated: SystemBrandingConfig = {
    ...DEFAULT_SYSTEM_BRANDING,
    updatedAt: new Date().toISOString(),
    updatedBy: operatorName
  };

  cachedBranding = updated;
  lastFetchTimestamp = Date.now();
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT_NAME, { detail: updated }));

  try {
    await apiDb.saveSetting('system_branding', updated, 'System Logo and Formal Letterhead Branding');
  } catch {
    // Silently continue
  }

  return updated;
}

/**
 * React Hook for real-time dynamic reactive system branding.
 */
export function useSystemBranding() {
  const [branding, setBranding] = useState<SystemBrandingConfig>(() => getSystemBrandingConfig());

  useEffect(() => {
    let isMounted = true;

    // Fetch live from server on mount
    fetchSystemBrandingConfig().then(config => {
      if (isMounted) setBranding(config);
    });

    const handleUpdate = (e: Event) => {
      if (e.type === 'app_data_mutated') {
        const ce = e as CustomEvent;
        if (ce.detail?.source === 'settings' || ce.detail?.source === 'system_branding') {
          fetchSystemBrandingConfig(true).then(cfg => {
            if (isMounted) setBranding(cfg);
          });
        }
      } else if (e.type === BRANDING_EVENT_NAME) {
        const customEvent = e as CustomEvent<SystemBrandingConfig>;
        if (customEvent.detail) {
          setBranding(customEvent.detail);
        } else {
          setBranding(getSystemBrandingConfig());
        }
      } else {
        setBranding(getSystemBrandingConfig());
      }
    };

    window.addEventListener(BRANDING_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('app_data_mutated', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(BRANDING_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('app_data_mutated', handleUpdate);
    };
  }, []);

  const updateBranding = async (updates: Partial<SystemBrandingConfig>, operatorName?: string) => {
    const res = await saveSystemBrandingConfig(updates, operatorName);
    setBranding(res);
    return res;
  };

  const resetBranding = async (operatorName?: string) => {
    const res = await resetSystemBrandingConfig(operatorName);
    setBranding(res);
    return res;
  };

  return { branding, updateBranding, resetBranding };
}

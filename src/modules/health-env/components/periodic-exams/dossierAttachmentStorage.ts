// Central Database & IndexedDB Storage engine for Personnel Periodic Medical Exams Attachments
import { apiDb } from '../../../../services/apiDatabaseClient';
import { formatFileSize } from '../../../../utils/fileHelpers';

export { formatFileSize };

export type DossierDocType =
  | 'lab' // آزمایشات پاراکلینیک و خون
  | 'spiro' // اسپیرومتری و عملکرد ریه
  | 'audio' // ادیومتری و شنوایی‌سنجی
  | 'optometry' // بینایی‌سنجی و اپتومتری
  | 'ecg' // الکتروکاردیوگرافی و نوار قلب
  | 'radio' // رادیوگرافی و تصویربرداری
  | 'doc_form' // فرم معاینات طب کار و کارت سلامت
  | 'specialist' // گواهی و نظر پزشک متخصص
  | 'other'; // سایر مستندات

export interface DossierAttachment {
  id: string;
  personnelId: string;
  personnelName?: string;
  examYear: string;
  title: string;
  documentDate: string;
  docType: DossierDocType;
  description?: string;
  fileName: string;
  fileType: 'pdf' | 'jpg' | 'jpeg' | 'png' | 'webp';
  mimeType: string;
  fileSize: number;
  fileSizeFormatted: string;
  fileData: string; // Base64 data URL
  createdAt: string;
  createdBy?: string;
}

export const DOC_TYPE_CONFIG: Record<DossierDocType, { label: string; color: string; bg: string; icon: string }> = {
  lab: {
    label: 'آزمایشات پاراکلینیک و خون',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60',
    icon: '🧪'
  },
  spiro: {
    label: 'اسپیرومتری و ریه',
    color: 'text-cyan-700 dark:text-cyan-300',
    bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800/60',
    icon: '🌬️'
  },
  audio: {
    label: 'ادیومتری و شنوایی‌سنجی',
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/60',
    icon: '👂'
  },
  optometry: {
    label: 'بینایی‌سنجی و اپتومتری',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/60',
    icon: '👁️'
  },
  ecg: {
    label: 'الکتروکاردیوگرافی (ECG)',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60',
    icon: '❤️'
  },
  radio: {
    label: 'رادیوگرافی و تصویربرداری',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/60',
    icon: '🩻'
  },
  doc_form: {
    label: 'فرم معاینه و کارت سلامت',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60',
    icon: '📋'
  },
  specialist: {
    label: 'گواهی پزشک متخصص',
    color: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800/60',
    icon: '👨‍⚕️'
  },
  other: {
    label: 'سایر مدارک و مستندات',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
    icon: '📁'
  }
};

const CENTRAL_SETTING_KEY = 'hse_periodic_dossier_attachments_v1';

// In-memory cache for fast queries synchronized with central database
let memoryCache: DossierAttachment[] = [];
let isDbInitialized = false;
let initPromise: Promise<void> | null = null;

export async function reloadDossierAttachmentsFromServer(): Promise<void> {
  try {
    const remoteList = await apiDb.getSetting(CENTRAL_SETTING_KEY);
    if (Array.isArray(remoteList)) {
      memoryCache = [...remoteList].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      isDbInitialized = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_medical_data_updated', { detail: { entity: CENTRAL_SETTING_KEY } }));
      }
    }
  } catch (err) {
    console.warn('Failed to reload dossier attachments from central DB:', err);
  }
}

if (typeof window !== 'undefined') {
  const handleRemoteMutation = (e: any) => {
    const key = String(e?.detail?.key || e?.detail?.entityType || e?.detail?.entity || '');
    if (key === CENTRAL_SETTING_KEY || key.includes('dossier_attachment') || key === 'settings') {
      void reloadDossierAttachmentsFromServer();
    }
  };
  window.addEventListener('app_data_mutated', handleRemoteMutation);
  window.addEventListener('hse_data_mutated', handleRemoteMutation);
  window.addEventListener('hse_auth_state_changed', () => {
    isDbInitialized = false;
    void reloadDossierAttachmentsFromServer();
  });
}

export async function initDossierAttachmentStorage(): Promise<void> {
  if (isDbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const remoteList = await apiDb.getSetting(CENTRAL_SETTING_KEY).catch(() => null);
      const remoteArr: DossierAttachment[] = Array.isArray(remoteList) ? remoteList : [];
      memoryCache = [...remoteArr].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      isDbInitialized = true;
    } catch (err) {
      console.warn('Failed to initialize dossier attachment storage:', err);
      isDbInitialized = true;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function getAttachmentsForPerson(
  personnelId: string,
  examYear?: string
): Promise<DossierAttachment[]> {
  await initDossierAttachmentStorage();
  let list = memoryCache.filter(item => String(item.personnelId) === String(personnelId));
  if (examYear && examYear !== 'all') {
    list = list.filter(item => String(item.examYear) === String(examYear));
  }
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAttachmentCountsForPerson(
  personnelId: string
): Promise<{ total: number; byYear: Record<string, number> }> {
  await initDossierAttachmentStorage();
  const list = memoryCache.filter(item => String(item.personnelId) === String(personnelId));
  const byYear: Record<string, number> = {};
  list.forEach(item => {
    byYear[item.examYear] = (byYear[item.examYear] || 0) + 1;
  });
  return {
    total: list.length,
    byYear
  };
}

export async function addDossierAttachment(
  data: Omit<DossierAttachment, 'id' | 'createdAt' | 'fileSizeFormatted'>
): Promise<DossierAttachment> {
  await initDossierAttachmentStorage();

  const newAttachment: DossierAttachment = {
    ...data,
    id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    fileSizeFormatted: formatFileSize(data.fileSize),
    createdAt: new Date().toISOString()
  };

  const nextCache = [newAttachment, ...memoryCache];
  await apiDb.saveSetting(CENTRAL_SETTING_KEY, nextCache, 'Periodic Medical Exam Dossier Attachments');
  memoryCache = nextCache;

  return newAttachment;
}

export async function updateDossierAttachment(
  id: string,
  updates: Partial<Pick<DossierAttachment, 'title' | 'documentDate' | 'docType' | 'description' | 'examYear'>>
): Promise<DossierAttachment | null> {
  await initDossierAttachmentStorage();

  const index = memoryCache.findIndex(item => item.id === id);
  if (index === -1) return null;

  const updated: DossierAttachment = {
    ...memoryCache[index],
    ...updates
  };

  const nextCache = [...memoryCache];
  nextCache[index] = updated;
  await apiDb.saveSetting(CENTRAL_SETTING_KEY, nextCache, 'Periodic Medical Exam Dossier Attachments');
  memoryCache = nextCache;

  return updated;
}

export async function deleteDossierAttachment(id: string): Promise<boolean> {
  await initDossierAttachmentStorage();

  const index = memoryCache.findIndex(item => item.id === id);
  if (index === -1) return false;

  const nextCache = memoryCache.filter(item => item.id !== id);
  await apiDb.saveSetting(CENTRAL_SETTING_KEY, nextCache, 'Periodic Medical Exam Dossier Attachments');
  memoryCache = nextCache;

  return true;
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText,
  FolderOpen,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react';
import { UserProfile } from '../types';
import { hasPermission, isUserAdmin } from '../utils/authHelper';
import { getUnits } from '../utils/orgHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { SdsSubmodule } from '../modules/sds/components/SdsSubmodule';
import { DocumentCategoryWorkspace } from '../modules/documents/components/DocumentCategoryWorkspace';
import { EquipmentSuggestion } from '../modules/documents/components/DocumentFormModal';
import {
  DocumentsModuleTabKey,
  DocumentVersionItem,
  evaluateDocumentExpiry,
  HseDocumentCategory,
  HseDocumentItem,
} from '../modules/documents/types';

export type { HseDocumentCategory, DocumentVersionItem, HseDocumentItem };
export { evaluateDocumentExpiry };

export const DOCUMENT_CATEGORIES: {
  id: HseDocumentCategory;
  titleFa: string;
  titleEn: string;
  shortFa: string;
  icon: any;
  color: string;
  bgLight: string;
  borderLight: string;
}[] = [
  {
    id: 'ORG_PROCEDURES',
    titleFa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی',
    titleEn: 'Organizational Instructions & Procedures',
    shortFa: 'دستورالعمل‌ها و روش‌های اجرایی',
    icon: FileText,
    color: 'text-sky-600 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/40',
    borderLight: 'border-sky-200 dark:border-sky-800/60',
  },
  {
    id: 'EQUIPMENT_CERTIFICATES',
    titleFa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات',
    titleEn: 'Machinery & Equipment Certificates',
    shortFa: 'گواهینامه‌ها و سرتیفیکیت تجهیزات',
    icon: ShieldCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderLight: 'border-emerald-200 dark:border-emerald-800/60',
  },
  {
    id: 'ORG_FORMS_CHECKLISTS',
    titleFa: 'فرم‌ها و چک‌لیست‌های سازمانی',
    titleEn: 'Organizational Forms & Checklists',
    shortFa: 'فرم‌ها و چک‌لیست‌ها',
    icon: ClipboardList,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
    borderLight: 'border-amber-200 dark:border-amber-800/60',
  },
  {
    id: 'OTHER_HSE_DOCS',
    titleFa: 'سایر مستندات مرتبط با HSE',
    titleEn: 'Other HSE Related Documents',
    shortFa: 'سایر مستندات HSE',
    icon: FolderOpen,
    color: 'text-violet-600 dark:text-violet-400',
    bgLight: 'bg-violet-50 dark:bg-violet-950/40',
    borderLight: 'border-violet-200 dark:border-violet-800/60',
  },
];

interface InstructionsDocumentsModuleProps {
  currentUser: UserProfile;
  language: 'fa' | 'en';
}

const VALID_TABS: DocumentsModuleTabKey[] = [
  'ORG_PROCEDURES',
  'EQUIPMENT_CERTIFICATES',
  'ORG_FORMS_CHECKLISTS',
  'OTHER_HSE_DOCS',
  'SDS',
];

function InstructionsDocumentsModuleComponent({
  currentUser,
  language,
}: InstructionsDocumentsModuleProps) {
  const isFa = language === 'fa';
  const isAdmin = isUserAdmin(currentUser);
  const canView = isAdmin || hasPermission(currentUser, 'Documents', 'view');

  const [activeTab, setActiveTab] = useState<DocumentsModuleTabKey>('ORG_PROCEDURES');
  const [documents, setDocuments] = useState<HseDocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentSuggestion[]>([]);
  const [orgUnits, setOrgUnits] = useState<string[]>(() => {
    const central = getUnits();
    return central.length > 0 ? ['عمومی مجتمع', ...central] : ['عمومی مجتمع'];
  });

  const hasInitialLoadedRef = useRef<boolean>(false);

  // Load organization units from DB & Central Org Structure
  useEffect(() => {
    const refreshUnits = () => {
      const loadOrgs =
        typeof apiDb.getOrgNodes === 'function' ? apiDb.getOrgNodes() : Promise.resolve([]);

      loadOrgs
        .then((orgData: any) => {
          const names = new Set<string>(['عمومی مجتمع', ...getUnits()]);
          if (orgData) {
            if (Array.isArray(orgData.departments)) {
              orgData.departments.forEach((d: any) => d?.name && names.add(d.name.trim()));
            }
            if (Array.isArray(orgData.units)) {
              orgData.units.forEach((u: any) => u?.name && names.add(u.name.trim()));
            }
            if (Array.isArray(orgData)) {
              orgData.forEach(
                (n: any) => (n?.name || n?.title) && names.add((n.name || n.title).trim())
              );
            }
          }
          setOrgUnits(Array.from(names));
        })
        .catch(() => {
          setOrgUnits(['عمومی مجتمع', ...getUnits()]);
        });
    };

    refreshUnits();
    window.addEventListener('hse_unit_structure_updated', refreshUnits);
    window.addEventListener('hse_org_nodes_updated', refreshUnits);
    return () => {
      window.removeEventListener('hse_unit_structure_updated', refreshUnits);
      window.removeEventListener('hse_org_nodes_updated', refreshUnits);
    };
  }, []);

  // Load equipment tag suggestions for Tab 2 (EQUIPMENT_CERTIFICATES)
  useEffect(() => {
    if (!canView) return;
    apiDb
      .getFireEquipment()
      .then((list) => {
        if (!Array.isArray(list)) return;
        const mapped: EquipmentSuggestion[] = list
          .map((item: any) => ({
            code: String(item.tagNumber || item.code || item.serialNumber || item.id || '').trim(),
            name: String(item.name || item.type || item.title || 'تجهیز ایمنی').trim(),
            location: String(item.location || item.unit || '').trim(),
          }))
          .filter((eq) => eq.code);
        setEquipmentOptions(mapped);
      })
      .catch(() => {
        setEquipmentOptions([]);
      });
  }, [canView]);

  const fetchDocuments = useCallback(
    async (forceSpinner = false) => {
      if (!canView) {
        setLoading(false);
        return;
      }
      if (!hasInitialLoadedRef.current || forceSpinner) {
        setLoading(true);
      }
      try {
        const list = await apiDb.getDocuments();
        setDocuments(Array.isArray(list) ? list : []);
        hasInitialLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading documents:', err);
      } finally {
        setLoading(false);
      }
    },
    [canView]
  );

  useEffect(() => {
    fetchDocuments();

    let debounceTimer: any = null;
    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (entity === 'documents' || entity === 'document' || entity === 'files') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          apiDb.invalidateCache('documents');
          fetchDocuments(false);
        }, 200);
      }
    };

    const handleSubTabNavigate = (e: any) => {
      if (e?.detail?.tab === 'documents' && e?.detail?.subItem) {
        const sub = String(e.detail.subItem).toUpperCase() as DocumentsModuleTabKey;
        if (VALID_TABS.includes(sub)) {
          setActiveTab(sub);
        } else {
          setActiveTab('ORG_PROCEDURES');
        }
      }
    };

    window.addEventListener('hse_data_mutated', handleDataMutated);
    window.addEventListener('hse-navigate-subtab', handleSubTabNavigate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('hse_data_mutated', handleDataMutated);
      window.removeEventListener('hse-navigate-subtab', handleSubTabNavigate);
    };
  }, [fetchDocuments]);

  const allUnitOptions = useMemo(() => {
    const set = new Set<string>(orgUnits);
    documents.forEach((d) => {
      if (d.unitName && d.unitName.trim()) set.add(d.unitName.trim());
    });
    return Array.from(set);
  }, [orgUnits, documents]);

  const countsByCategory = useMemo(() => {
    const counts: Record<HseDocumentCategory, number> = {
      ORG_PROCEDURES: 0,
      EQUIPMENT_CERTIFICATES: 0,
      ORG_FORMS_CHECKLISTS: 0,
      OTHER_HSE_DOCS: 0,
    };
    documents.forEach((d) => {
      if (d.category in counts) {
        counts[d.category] += 1;
      }
    });
    return counts;
  }, [documents]);

  const moduleTabs: {
    id: DocumentsModuleTabKey;
    titleFa: string;
    titleEn: string;
    icon: any;
    color: string;
    activeClass: string;
    focusClass: string;
    count?: number;
  }[] = useMemo(() => {
    const byId = Object.fromEntries(DOCUMENT_CATEGORIES.map((c) => [c.id, c])) as Record<
      HseDocumentCategory,
      (typeof DOCUMENT_CATEGORIES)[number]
    >;
    return [
      {
        id: 'ORG_PROCEDURES',
        titleFa: 'دستورالعمل و روش اجرایی',
        titleEn: byId.ORG_PROCEDURES.titleEn,
        icon: byId.ORG_PROCEDURES.icon,
        color: byId.ORG_PROCEDURES.color,
        activeClass: 'bg-sky-600 text-white shadow-xs',
        focusClass: 'focus-visible:ring-sky-500',
        count: countsByCategory.ORG_PROCEDURES || 0,
      },
      {
        id: 'EQUIPMENT_CERTIFICATES',
        titleFa: byId.EQUIPMENT_CERTIFICATES.titleFa,
        titleEn: byId.EQUIPMENT_CERTIFICATES.titleEn,
        icon: byId.EQUIPMENT_CERTIFICATES.icon,
        color: byId.EQUIPMENT_CERTIFICATES.color,
        activeClass: 'bg-emerald-600 text-white shadow-xs',
        focusClass: 'focus-visible:ring-emerald-500',
        count: countsByCategory.EQUIPMENT_CERTIFICATES || 0,
      },
      {
        id: 'SDS',
        titleFa: 'SDS – برگه اطلاعات ایمنی مواد شیمیایی',
        titleEn: 'SDS – Safety Data Sheets',
        icon: FlaskConical,
        color: 'text-teal-600 dark:text-teal-400',
        activeClass: 'bg-teal-600 text-white shadow-xs',
        focusClass: 'focus-visible:ring-teal-500',
      },
      {
        id: 'ORG_FORMS_CHECKLISTS',
        titleFa: byId.ORG_FORMS_CHECKLISTS.titleFa,
        titleEn: byId.ORG_FORMS_CHECKLISTS.titleEn,
        icon: byId.ORG_FORMS_CHECKLISTS.icon,
        color: byId.ORG_FORMS_CHECKLISTS.color,
        activeClass: 'bg-amber-600 text-white shadow-xs',
        focusClass: 'focus-visible:ring-amber-500',
        count: countsByCategory.ORG_FORMS_CHECKLISTS || 0,
      },
      {
        id: 'OTHER_HSE_DOCS',
        titleFa: byId.OTHER_HSE_DOCS.titleFa,
        titleEn: byId.OTHER_HSE_DOCS.titleEn,
        icon: byId.OTHER_HSE_DOCS.icon,
        color: byId.OTHER_HSE_DOCS.color,
        activeClass: 'bg-violet-600 text-white shadow-xs',
        focusClass: 'focus-visible:ring-violet-500',
        count: countsByCategory.OTHER_HSE_DOCS || 0,
      },
    ];
  }, [countsByCategory]);

  if (!canView) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-8 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
          {isFa ? 'عدم دسترسی به ماژول دستورالعمل‌ها و مستندات' : 'Access Denied'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isFa
            ? 'حساب کاربری شما مجوز مشاهده مستندات را ندارد. در صورت نیاز با مدیر سیستم هماهنگ فرمایید.'
            : 'Your account does not have permission to view documents.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* ── 5 Independent Top-Level Module Tabs (Exact Requested Order) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex flex-wrap items-center gap-1.5 shadow-xs">
        {moduleTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-auto px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${tab.focusClass} ${
                isSelected
                  ? tab.activeClass
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <TabIcon
                  className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : tab.color}`}
                />
                <span className="whitespace-nowrap">
                  {isFa ? tab.titleFa : tab.titleEn}
                </span>
              </div>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-black tabular-nums shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active Tab Content ── */}
      {activeTab === 'SDS' ? (
        <SdsSubmodule
          currentUser={currentUser}
          language={language}
          orgUnits={allUnitOptions}
        />
      ) : (
        <DocumentCategoryWorkspace
          category={activeTab}
          documents={documents}
          loading={loading}
          orgUnits={allUnitOptions}
          equipmentOptions={equipmentOptions}
          currentUser={currentUser}
          language={language}
          onRefresh={fetchDocuments}
        />
      )}
    </div>
  );
}

export const InstructionsDocumentsModule = React.memo(
  InstructionsDocumentsModuleComponent,
  (prev, next) =>
    prev.language === next.language &&
    prev.currentUser?.id === next.currentUser?.id &&
    prev.currentUser?.role === next.currentUser?.role &&
    prev.currentUser?.username === next.currentUser?.username
);

export default InstructionsDocumentsModule;

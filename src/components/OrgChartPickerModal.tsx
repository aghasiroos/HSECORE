import React, { useState, useMemo } from 'react';
import { 
  X, Search, Building2, Layers, GitFork, Briefcase, 
  ChevronDown, ChevronRight, Check, Sparkles, FolderTree
} from 'lucide-react';
import { OrgNode } from '../utils/authHelper';
import { OrgUnitsDataMap, findUnitDetail } from '../utils/orgHelper';

interface OrgChartPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: { workplace?: string; unit?: string; subUnit?: string; jobTitle?: string }) => void;
  orgNodes: OrgNode[];
  orgStructure: OrgUnitsDataMap;
  currentWorkplace?: string;
  currentUnit?: string;
  currentSubUnit?: string;
  currentJobTitle?: string;
  isFa?: boolean;
}

export const OrgChartPickerModal: React.FC<OrgChartPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  orgNodes,
  orgStructure,
  currentWorkplace = '',
  currentUnit = '',
  currentSubUnit = '',
  currentJobTitle = '',
  isFa = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'units_jobs'>('hierarchy');

  // Toggle node expansion
  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to find ancestor site of a node
  const getAncestorSite = (nodeId: string): string => {
    let curr = orgNodes.find(n => n.id === nodeId);
    while (curr) {
      if (curr.type === 'Site' || curr.type === 'Company') {
        return curr.name;
      }
      if (!curr.parentId) break;
      curr = orgNodes.find(n => n.id === curr!.parentId);
    }
    return '';
  };

  // Helper to find ancestor plant/department/unit
  const getAncestorUnit = (nodeId: string): { unitName: string; subUnitName: string } => {
    const targetNode = orgNodes.find(n => n.id === nodeId);
    if (!targetNode) return { unitName: '', subUnitName: '' };

    if (targetNode.type === 'Department' || targetNode.type === 'Plant') {
      return { unitName: targetNode.name, subUnitName: '' };
    }

    if (targetNode.type === 'Section' || targetNode.type === 'Team' || targetNode.type === 'Area') {
      // Look up parent
      let parent = orgNodes.find(n => n.id === targetNode.parentId);
      while (parent) {
        if (parent.type === 'Department' || parent.type === 'Plant') {
          return { unitName: parent.name, subUnitName: targetNode.name };
        }
        if (!parent.parentId) break;
        parent = orgNodes.find(n => n.id === parent!.parentId);
      }
      return { unitName: parent?.name || targetNode.name, subUnitName: targetNode.name };
    }

    return { unitName: targetNode.name, subUnitName: '' };
  };

  // Tree nodes grouped by parentId
  const treeRoots = useMemo(() => {
    return orgNodes.filter(n => !n.parentId || !orgNodes.some(p => p.id === n.parentId));
  }, [orgNodes]);

  // Operational units list
  const operationalUnits = useMemo(() => {
    return Object.entries(orgStructure || {}).map(([name, detail]) => {
      const uDetail = detail as { jobs?: string[]; subUnits?: Record<string, string[]> };
      const subUnitsList = Object.entries(uDetail?.subUnits || {}).map(([sName, sJobs]) => ({
        name: sName,
        jobs: Array.isArray(sJobs) ? sJobs : []
      }));
      return {
        name,
        jobs: Array.isArray(uDetail?.jobs) ? uDetail.jobs : [],
        subUnits: subUnitsList
      };
    });
  }, [orgStructure]);

  if (!isOpen) return null;

  const handleSelectNode = (node: OrgNode) => {
    const site = getAncestorSite(node.id);
    const { unitName, subUnitName } = getAncestorUnit(node.id);

    // Get jobs for this unit/subunit from orgStructure if available
    let job = '';
    const match = findUnitDetail(unitName, orgStructure);
    if (subUnitName && match?.subUnits?.[subUnitName]?.length) {
      job = match.subUnits[subUnitName][0];
    } else if (match?.jobs?.length) {
      job = match.jobs[0];
    }

    onSelect({
      workplace: site || currentWorkplace,
      unit: unitName,
      subUnit: subUnitName,
      jobTitle: job
    });
    onClose();
  };

  const handleSelectOperationalPosition = (
    unit: string, 
    subUnit: string, 
    jobTitle?: string, 
    site?: string
  ) => {
    onSelect({
      workplace: site || currentWorkplace,
      unit,
      subUnit,
      jobTitle: jobTitle || ''
    });
    onClose();
  };

  // Recursive tree renderer for OrgNodes
  const renderOrgNode = (node: OrgNode, depth: number = 0) => {
    const children = orgNodes.filter(n => n.parentId === node.id && n.status !== 'inactive');
    const isExpanded = expandedNodes[node.id] ?? (depth < 2 || !!searchTerm);
    const hasChildren = children.length > 0;

    // Filter check
    const matchesSearch = !searchTerm || 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (node.code && node.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const anyChildMatches = (n: OrgNode): boolean => {
      if (n.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
      const ch = orgNodes.filter(c => c.parentId === n.id);
      return ch.some(anyChildMatches);
    };

    if (searchTerm && !matchesSearch && !children.some(anyChildMatches)) {
      return null;
    }

    const typeBadge = {
      Company: { label: isFa ? 'شرکت مادر' : 'Company', color: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200' },
      Site: { label: isFa ? 'سایت / مجتمع' : 'Site', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200' },
      Plant: { label: isFa ? 'پلنت / کارخانه' : 'Plant', color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200' },
      Department: { label: isFa ? 'دپارتمان / اداره' : 'Department', color: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200' },
      Area: { label: isFa ? 'ناحیه عملیاتی' : 'Area', color: 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200' },
      Section: { label: isFa ? 'بخش / واحد' : 'Section', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200' },
      Team: { label: isFa ? 'تیم / شیفت' : 'Team', color: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200' },
    }[node.type] || { label: node.type, color: 'bg-slate-100 text-slate-700 border-slate-200' };

    const isSelected = currentUnit === node.name || currentSubUnit === node.name;

    return (
      <div key={node.id} className="space-y-1" style={{ marginRight: depth > 0 ? `${depth * 14}px` : 0 }}>
        <div className={`p-2 rounded-xl flex items-center justify-between gap-2 border transition-colors ${
          isSelected 
            ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700' 
            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-200'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button 
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6 shrink-0" />
            )}

            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${typeBadge.color}`}>
                {typeBadge.label}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {node.name}
              </span>
              {node.code && (
                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                  ({node.code})
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSelectNode(node)}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shrink-0 flex items-center gap-1 transition shadow-xs cursor-pointer"
          >
            <Check className="w-3 h-3" />
            <span>{isFa ? 'انتخاب این موقعیت' : 'Select'}</span>
          </button>
        </div>

        {/* Render child nodes */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 pr-1 border-r-2 border-slate-100 dark:border-slate-800 mr-2.5">
            {children.map(c => renderOrgNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'فراخوانی موقعیت سازمانی و شغل از ساختار سازمانی' : 'Select Org Position & Job from Chart'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa 
                  ? 'انتخاب مستقیم واحد، زیرمجموعه و عناوین شغلی تعریف‌شده در تب ساختار و چارت سازمانی مجتمع'
                  : 'Select exact organizational position and assigned jobs configured in Org Structure'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Tab switchers */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('hierarchy')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'hierarchy' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>{isFa ? 'چارت و درخت سازمانی' : 'Org Chart Hierarchy'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('units_jobs')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'units_jobs' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isFa ? 'واحدها، زیرمجموعه‌ها و مشاغل' : 'Units, Sub-Units & Jobs'}</span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={isFa ? 'جستجو در نام واحد، بخش، زیرمجموعه یا شغل...' : 'Search unit, section, sub-unit or job...'}
                className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Current Selection indicator */}
          {(currentUnit || currentJobTitle) && (
            <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                <span className="font-bold text-blue-700 dark:text-blue-400">{isFa ? 'موقعیت فعلی فرم:' : 'Current Form:'}</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {currentWorkplace && `${currentWorkplace} > `}
                  {currentUnit || 'بدون واحد'}
                  {currentSubUnit && ` > ${currentSubUnit}`}
                  {currentJobTitle && ` > شغل: ${currentJobTitle}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
          {activeTab === 'hierarchy' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>{isFa ? 'کلیک بر روی هر رده سازمانی جهت فراخوانی مستقیم:' : 'Click any organizational level to select:'}</span>
                <span className="text-[11px] font-mono">{orgNodes.length} {isFa ? 'رده در چارت' : 'nodes'}</span>
              </div>

              {treeRoots.length > 0 ? (
                treeRoots.map(root => renderOrgNode(root, 0))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {isFa ? 'هنوز رده‌ای در ساختار سازمانی تعریف نشده است.' : 'No nodes found in org structure.'}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>{isFa ? 'واحدها و زیرمجموعه‌ها به همراه مشاغل متصل به هر زیرمجموعه:' : 'Units and Sub-units with assigned jobs:'}</span>
                <span className="text-[11px] font-mono">{operationalUnits.length} {isFa ? 'واحد' : 'units'}</span>
              </div>

              {operationalUnits
                .filter(u => !searchTerm || 
                  u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  u.jobs.some(j => j.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  u.subUnits.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.jobs.some(sj => sj.toLowerCase().includes(searchTerm.toLowerCase())))
                )
                .map(unit => (
                  <div key={unit.name} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{unit.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                          {unit.subUnits.length} {isFa ? 'زیرمجموعه' : 'sub-units'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectOperationalPosition(unit.name, '', unit.jobs[0])}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>{isFa ? 'انتخاب کل واحد' : 'Select Unit'}</span>
                      </button>
                    </div>

                    {/* Direct jobs under unit */}
                    {unit.jobs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 block">{isFa ? 'مشاغل مستقیم در سطح واحد:' : 'Direct Unit Jobs:'}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {unit.jobs.map(job => (
                            <button
                              key={job}
                              type="button"
                              onClick={() => handleSelectOperationalPosition(unit.name, '', job)}
                              className="px-2 py-1 bg-white dark:bg-slate-900 hover:bg-blue-500 hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1"
                            >
                              <Briefcase className="w-3 h-3 opacity-60" />
                              <span>{job}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-units and their assigned jobs */}
                    {unit.subUnits.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-500 block">{isFa ? 'زیرمجموعه‌ها و مشاغل تخصیص‌یافته:' : 'Sub-units & assigned jobs:'}</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {unit.subUnits.map(sub => (
                            <div key={sub.name} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 truncate">
                                  <GitFork className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 truncate">{sub.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelectOperationalPosition(unit.name, sub.name, sub.jobs[0])}
                                  className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-bold rounded transition cursor-pointer shrink-0"
                                >
                                  {isFa ? 'انتخاب' : 'Select'}
                                </button>
                              </div>

                              {/* Jobs inside this sub-unit */}
                              <div className="flex flex-wrap gap-1">
                                {sub.jobs.length > 0 ? (
                                  sub.jobs.map(sj => (
                                    <button
                                      key={sj}
                                      type="button"
                                      onClick={() => handleSelectOperationalPosition(unit.name, sub.name, sj)}
                                      className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-[10px] font-semibold text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                                      title={isFa ? `انتخاب شغل ${sj} برای ${sub.name}` : `Select ${sj}`}
                                    >
                                      {sj}
                                    </button>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    {isFa ? 'بدون شغل تعریف‌شده' : 'No jobs defined'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 md:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{isFa ? 'عناوین شغلی دقیقا بر اساس ارتباطات سلسله‌مراتب سازمانی تفکیک شده‌اند.' : 'Job titles strictly filtered by org hierarchy.'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgChartPickerModal;

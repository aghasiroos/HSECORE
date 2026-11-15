import React, { useState, useMemo } from 'react';
import { AlertTriangle, Building2, CheckCircle2, FileText, Search, ShieldCheck, Truck, Users, Wrench } from 'lucide-react';
import type { LiftingCrane, LiftingIntegrationContext, RiggingEquipmentItem } from '../types';

interface Props {
  cranes: LiftingCrane[];
  rigging: RiggingEquipmentItem[];
  integration: LiftingIntegrationContext | null;
}

export default function IntegratedAssetsCertsTab({ cranes, rigging, integration }: Props) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<'ALL' | 'EQUIPMENT' | 'PERSONNEL' | 'CONTRACTORS' | 'DOCS'>('ALL');

  const q = search.trim().toLowerCase();

  const filteredCranes = useMemo(
    () =>
      cranes.filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.craneCode.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          (c.certificateNumber || '').toLowerCase().includes(q)
      ),
    [cranes, q]
  );

  const filteredRigging = useMemo(
    () =>
      rigging.filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.assetCode.toLowerCase().includes(q) ||
          (r.certificateNumber || '').toLowerCase().includes(q)
      ),
    [rigging, q]
  );

  const filteredPersonnel = useMemo(() => {
    const list = integration?.personnel || [];
    return list.filter(
      (p) =>
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.personnelCode.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q) ||
        p.unitName.toLowerCase().includes(q)
    );
  }, [integration?.personnel, q]);

  const filteredContractors = useMemo(() => {
    const list = integration?.contractors || [];
    return list.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.managerName || '').toLowerCase().includes(q)
    );
  }, [integration?.contractors, q]);

  const filteredDocs = useMemo(() => {
    const list = integration?.documents || [];
    return list.filter(
      (d) =>
        !q ||
        String(d.originalName || d.title || '').toLowerCase().includes(q) ||
        String(d.fileId || d.docCode || '').toLowerCase().includes(q) ||
        String(d.entityType || d.category || '').toLowerCase().includes(q)
    );
  }, [integration?.documents, q]);

  const certLabel = (state?: string) => {
    if (state === 'EXPIRED') return { text: 'منقضی‌شده', cls: 'text-red-700 dark:text-red-300 font-bold' };
    if (state === 'WARNING_SOON') return { text: 'نزدیک به انقضا', cls: 'text-amber-700 dark:text-amber-300 font-bold' };
    if (state === 'MISSING') return { text: 'ثبت‌نشده', cls: 'text-slate-500' };
    return { text: 'معتبر', cls: 'text-emerald-700 dark:text-emerald-300 font-bold' };
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Header & Search */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>بانک یکپارچه تجهیزات، گواهینامه‌ها، صلاحیت پرسنل و پیمانکاران</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              متصل مستقیم به بانک مرکزی پرسنل و آموزش، پیمانکاران و آرشیو اسناد HSECORE (بدون دیتابیس یا ثبت تکراری)
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام، کد تجهیز، کد پرسنلی یا شماره گواهینامه..."
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { k: 'ALL', l: 'همه بخش‌ها' },
            { k: 'EQUIPMENT', l: `تجهیزات و گواهینامه (${cranes.length + rigging.length})` },
            { k: 'PERSONNEL', l: `پرسنل و صلاحیت (${integration?.personnel.length || 0})` },
            { k: 'CONTRACTORS', l: `پیمانکاران (${integration?.contractors.length || 0})` },
            { k: 'DOCS', l: `اسناد و بازرسی‌ها (${(integration?.documents.length || 0) + (integration?.safetyInspections.length || 0)})` },
          ].map((btn) => (
            <button
              key={btn.k}
              type="button"
              onClick={() => setSection(btn.k as any)}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer border ${
                section === btn.k
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {btn.l}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment & Certificates Table */}
      {(section === 'ALL' || section === 'EQUIPMENT') && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-600" />
            <span>وضعیت گواهینامه و معاینه فنی جرثقیل‌ها ({filteredCranes.length}) و Rigging ({filteredRigging.length})</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[11px] text-slate-500">
                <tr>
                  <th className="p-2">نوع</th>
                  <th className="p-2">کد تجهیز</th>
                  <th className="p-2">نام / مدل</th>
                  <th className="p-2">ظرفیت / WLL</th>
                  <th className="p-2">شماره گواهینامه</th>
                  <th className="p-2">تاریخ انقضا</th>
                  <th className="p-2">وضعیت اعتبار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredCranes.map((c) => {
                  const st = certLabel(c.certExpiryState);
                  return (
                    <tr key={`crane-${c.id}`}>
                      <td className="p-2 font-bold text-sky-700 dark:text-sky-300">جرثقیل</td>
                      <td className="p-2 font-mono">{c.craneCode}</td>
                      <td className="p-2">{c.name} ({c.model})</td>
                      <td className="p-2 font-mono tabular-nums">{c.maxRatedCapacityTon} t</td>
                      <td className="p-2 font-mono">{c.certificateNumber || '—'}</td>
                      <td className="p-2 font-mono">{c.certificateExpiryDate || '—'}</td>
                      <td className={`p-2 ${st.cls}`}>{st.text}</td>
                    </tr>
                  );
                })}
                {filteredRigging.map((r) => {
                  const st = certLabel(r.certExpiryState);
                  return (
                    <tr key={`rig-${r.id}`}>
                      <td className="p-2 font-bold text-emerald-700 dark:text-emerald-300">Rigging ({r.category})</td>
                      <td className="p-2 font-mono">{r.assetCode}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2 font-mono tabular-nums">{r.wllTon} t</td>
                      <td className="p-2 font-mono">{r.certificateNumber || '—'}</td>
                      <td className="p-2 font-mono">{r.certificateExpiryDate || '—'}</td>
                      <td className={`p-2 ${st.cls}`}>
                        {st.text} {!r.safetyLatchOk ? '• بدون قفل قلاب!' : ''}
                      </td>
                    </tr>
                  );
                })}
                {filteredCranes.length === 0 && filteredRigging.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      هنوز تجهیز یا گواهینامه‌ای در بانک تجهیزات باربرداری ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Personnel & Lifting Trainings */}
      {(section === 'ALL' || section === 'PERSONNEL') && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600" />
            <span>صلاحیت و سوابق آموزشی پرسنل مرتبط با باربرداری (متصل به ماژول پرسنل و آموزش)</span>
          </h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[11px] text-slate-500 sticky top-0">
                <tr>
                  <th className="p-2">کد پرسنلی</th>
                  <th className="p-2">نام و نام خانوادگی</th>
                  <th className="p-2">سمت / شغل</th>
                  <th className="p-2">واحد</th>
                  <th className="p-2">تعداد دوره‌های باربرداری/جرثقیل</th>
                  <th className="p-2">وضعیت صلاحیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredPersonnel.slice(0, 60).map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 font-mono font-bold">{p.personnelCode}</td>
                    <td className="p-2 font-bold text-slate-900 dark:text-white">{p.fullName}</td>
                    <td className="p-2">{p.position}</td>
                    <td className="p-2">{p.unitName}</td>
                    <td className="p-2 font-mono tabular-nums">{p.liftingTrainings?.length || 0} (کل: {p.totalTrainings})</td>
                    <td className="p-2">
                      {p.liftingTrainings?.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>دارای گواهی مرتبط</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>بدون سابقه دوره باربرداری</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPersonnel.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">پرسنلی مطابق جستجو یافت نشد.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contractors & HSE Documents */}
      {(section === 'ALL' || section === 'CONTRACTORS' || section === 'DOCS') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(section === 'ALL' || section === 'CONTRACTORS') && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>فهرست پیمانکاران ثبت‌شده در HSECORE ({filteredContractors.length})</span>
              </h4>
              {filteredContractors.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">پیمانکاری ثبت نشده است.</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredContractors.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-500">مدیر: {c.managerName || '—'} | تلفن: {c.phone || '—'}</div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">{c.status || 'ACTIVE'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(section === 'ALL' || section === 'DOCS') && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <span>گواهینامه‌ها و مستندات متصل در ماژول اسناد ({filteredDocs.length})</span>
              </h4>
              {filteredDocs.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">سندی در آرشیو مرکزی یافت نشد.</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredDocs.slice(0, 30).map((d, idx) => (
                    <div key={d.fileId || d.id || idx} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{d.originalName || d.title || 'سند بدون عنوان'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{d.fileId || d.docCode} • {d.entityType || d.category || 'GENERAL'}</div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">{String(d.createdAt || d.revisionDate || '').slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

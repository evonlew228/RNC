'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Trophy, Calendar, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { formatSGD } from '@/lib/format';
import type { EarningsRow } from '@/app/(app)/earnings/page';

type Range = 'month' | 'quarter' | 'year' | 'all';

export function EarningsView({
  rows,
  viewerName,
  isDirector,
}: {
  rows: EarningsRow[];
  viewerName: string;
  isDirector: boolean;
}) {
  const [range, setRange] = useState<Range>('all');

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = (() => {
      switch (range) {
        case 'month': return now - 30 * 86400000;
        case 'quarter': return now - 90 * 86400000;
        case 'year': return now - 365 * 86400000;
        default: return 0;
      }
    })();
    return rows.filter((r) => new Date(r.placed_at).getTime() >= cutoff);
  }, [rows, range]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, r) => sum + r.amount, 0);
    const placements = new Set(filtered.map((r) => r.submission_id)).size;
    const totalFees = Array.from(new Set(filtered.map((r) => r.submission_id)))
      .reduce((sum, sid) => sum + (filtered.find((r) => r.submission_id === sid)?.fee_total ?? 0), 0);
    return { total, placements, totalFees };
  }, [filtered]);

  function exportCsv() {
    const header = isDirector
      ? ['Date placed', 'Candidate', 'Role', 'Client', 'Total fee SGD', 'Consultant', 'Role on deal', 'Split %', 'Amount SGD']
      : ['Date placed', 'Candidate', 'Role', 'Client', 'Total fee SGD', 'Role on deal', 'Split %', 'Amount SGD'];
    const lines = filtered.map((r) => {
      const date = new Date(r.placed_at).toISOString().slice(0, 10);
      const fields = isDirector
        ? [date, r.candidate_name, r.job_title, r.client_name, r.fee_total, r.consultant_name, r.consultant_role, r.pct, r.amount]
        : [date, r.candidate_name, r.job_title, r.client_name, r.fee_total, r.consultant_role, r.pct, r.amount];
      return fields
        .map((f) => (typeof f === 'string' && /[",\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f))
        .join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `rncare-earnings-${isDirector ? 'firm' : viewerName.split(' ')[0].toLowerCase()}-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 max-w-6xl">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          icon={Wallet}
          label={isDirector ? 'Total fees paid out' : 'My earnings'}
          value={formatSGD(totals.total, { compact: true })}
          hint={`${range === 'all' ? 'lifetime' : `last ${range}`}`}
          accent
        />
        <Kpi
          icon={Trophy}
          label="Placements"
          value={totals.placements.toString()}
          hint={isDirector ? 'across the firm' : 'I contributed to'}
        />
        <Kpi
          icon={Calendar}
          label="Total deal value"
          value={formatSGD(totals.totalFees, { compact: true })}
          hint="combined fee revenue"
        />
      </div>

      {/* Range tabs + export */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RangeTab active={range === 'month'} onClick={() => setRange('month')}>Last 30 days</RangeTab>
          <RangeTab active={range === 'quarter'} onClick={() => setRange('quarter')}>Last 90 days</RangeTab>
          <RangeTab active={range === 'year'} onClick={() => setRange('year')}>Last 12 months</RangeTab>
          <RangeTab active={range === 'all'} onClick={() => setRange('all')}>All time</RangeTab>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-slate-700 hover:border-brand hover:text-brand-ink disabled:opacity-50"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Candidate</th>
              <th className="px-4 py-3 font-medium">Role / Client</th>
              <th className="px-4 py-3 font-medium">Total fee</th>
              {isDirector && <th className="px-4 py-3 font-medium">Consultant</th>}
              <th className="px-4 py-3 font-medium">My role</th>
              <th className="px-4 py-3 font-medium text-right">Split</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={`${r.submission_id}-${r.consultant_id}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {new Date(r.placed_at).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/candidates/${r.candidate_id}`} className="font-medium text-slate-900 hover:text-brand">
                    {r.candidate_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/jobs/${r.job_id}`} className="text-slate-700 hover:text-brand">
                    {r.job_title}
                  </Link>
                  <div className="text-xs text-muted">{r.client_name}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatSGD(r.fee_total, { compact: true })}</td>
                {isDirector && (
                  <td className="px-4 py-3 text-slate-700">{r.consultant_name}</td>
                )}
                <td className="px-4 py-3">
                  <RoleBadge role={r.consultant_role} />
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{r.pct}%</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  {formatSGD(r.amount)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isDirector ? 8 : 7} className="px-4 py-12 text-center text-sm text-muted">
                  No earnings in this period yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-xl p-5 ${accent ? 'border-emerald-200 bg-emerald-50/40' : 'border-border'}`}>
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

function RangeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 rounded-lg text-sm border',
        active
          ? 'bg-brand-soft border-brand text-brand-ink font-medium'
          : 'border-transparent text-slate-700 hover:bg-slate-100'
      )}
    >
      {children}
    </button>
  );
}

function RoleBadge({ role }: { role: EarningsRow['consultant_role'] }) {
  const map: Record<EarningsRow['consultant_role'], { label: string; cls: string }> = {
    originator: { label: 'Originator', cls: 'bg-blue-100 text-blue-800' },
    submitter: { label: 'Submitter', cls: 'bg-amber-100 text-amber-800' },
    sole: { label: 'Sole', cls: 'bg-slate-100 text-slate-700' },
  };
  const m = map[role];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

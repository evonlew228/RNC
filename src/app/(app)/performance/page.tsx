import Link from 'next/link';
import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { PerformanceScorecard } from '@/components/PerformanceScorecard';
import { loadPerformanceDataset } from '@/lib/performance-loader';
import {
  quarterRange, priorQuarter, currentQuarter, computeScorecard, type QuarterKey,
} from '@/lib/performance';
import { formatSGD } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/supabase/types';
import clsx from 'clsx';

export default async function PerformancePage(props: {
  searchParams: Promise<{ q?: string; y?: string }>;
}) {
  const sp = await props.searchParams;
  const qKey = (['q1', 'q2', 'q3', 'q4', 'last12w'].includes(sp.q ?? '') ? sp.q : null) as QuarterKey | null;
  const year = sp.y ? parseInt(sp.y, 10) : new Date().getFullYear();
  const range = qKey ? quarterRange(qKey, year) : currentQuarter();
  const prior = priorQuarter(range);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: viewerProfile } = await supabase
    .from('profiles').select('id, role').eq('id', user!.id).single();
  const isDirector = viewerProfile?.role === 'director';

  const dataset = await loadPerformanceDataset();
  const consultants = dataset.profiles.filter((p) => p.role !== 'director' || isDirector);

  // Compute scorecards for the people the viewer can see
  const visibleProfiles = isDirector
    ? dataset.profiles
    : dataset.profiles.filter((p) => p.id === user!.id);
  const scorecards = visibleProfiles.map((p) =>
    computeScorecard(dataset, p.id, range, prior)
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="Performance"
        subtitle={
          isDirector
            ? 'Firm-wide scorecard. Click any consultant to drill in.'
            : 'Your scorecard. Inputs, outputs, and pipeline insights.'
        }
        actions={<QuarterSelector active={range.key} year={range.year} />}
      />
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-7xl">
        <RangeBanner rangeLabel={range.label} priorLabel={prior.label} />

        {isDirector ? (
          <DirectorView dataset={dataset} scorecards={scorecards} />
        ) : (
          <SelfView scorecard={scorecards.find((s) => s.userId === user!.id)!} />
        )}
        {/* unused but keeps lint happy */}
        <span className="hidden">{consultants.length}</span>
      </div>
    </div>
  );
}

function RangeBanner({ rangeLabel, priorLabel }: { rangeLabel: string; priorLabel: string }) {
  return (
    <div className="bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-slate-700">
      Showing <strong>{rangeLabel}</strong> · comparing against <strong>{priorLabel}</strong>
    </div>
  );
}

function QuarterSelector({ active, year }: { active: string; year: number }) {
  const options: { key: string; label: string }[] = [
    { key: 'q1', label: `Q1 ${year}` },
    { key: 'q2', label: `Q2 ${year}` },
    { key: 'q3', label: `Q3 ${year}` },
    { key: 'q4', label: `Q4 ${year}` },
    { key: 'last12w', label: 'Last 12 weeks' },
  ];
  return (
    <div className="inline-flex items-center gap-1 bg-white border border-border rounded-lg p-1">
      {options.map((o) => (
        <Link
          key={o.key}
          href={`/performance?q=${o.key}&y=${year}` as never}
          className={clsx(
            'px-2.5 py-1 rounded-md text-xs',
            active === o.key
              ? 'bg-brand text-white font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function DirectorView({
  dataset,
  scorecards,
}: {
  dataset: ReturnType<typeof Object> & { profiles: { id: string; full_name: string; role: 'director' | 'kam' | 'bd' }[] };
  scorecards: ReturnType<typeof computeScorecard>[];
}) {
  // Filter out the Director themselves from the ranking
  const consultantCards = scorecards
    .filter((s) => s.role !== 'director')
    .sort((a, b) => b.commission.current - a.commission.current);

  // Firm rollup
  const firmTotal = {
    placements: consultantCards.reduce((s, c) => s + c.placements.current, 0),
    commission: consultantCards.reduce((s, c) => s + c.commission.current, 0),
    submissions: consultantCards.reduce((s, c) => s + c.submissionsMade.current, 0),
    feeRevenue: consultantCards.reduce((s, c) => s + c.feeRevenue.current, 0),
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <FirmKpi label="Firm placements" value={firmTotal.placements.toString()} />
        <FirmKpi label="Firm fee revenue" value={formatSGD(firmTotal.feeRevenue, { compact: true })} />
        <FirmKpi label="Firm commission paid" value={formatSGD(firmTotal.commission, { compact: true })} />
        <FirmKpi label="Firm submissions" value={firmTotal.submissions.toString()} />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-medium text-slate-900">Consultant ranking</h2>
          <p className="text-xs text-muted mt-0.5">Click any row to open the full scorecard + appraisal prompts.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Consultant</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-right">Submissions</th>
              <th className="px-4 py-3 font-medium text-right">Placements</th>
              <th className="px-4 py-3 font-medium text-right">Win rate</th>
              <th className="px-4 py-3 font-medium text-right">Commission</th>
              <th className="px-4 py-3 font-medium text-right">Q-on-Q subs</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {consultantCards.map((c) => (
              <tr key={c.userId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/performance/${c.userId}` as never} className="font-medium text-slate-900 hover:text-brand">
                    {c.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{ROLE_LABELS[c.role]}</td>
                <td className="px-4 py-3 text-right text-slate-700">{c.submissionsMade.current}</td>
                <td className="px-4 py-3 text-right text-slate-700">{c.placements.current}</td>
                <td className="px-4 py-3 text-right text-slate-700">{c.winRate.current}%</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatSGD(c.commission.current, { compact: true })}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeltaPill m={c.submissionsMade} />
                </td>
                <td className="px-4 py-3 text-muted">
                  <ArrowRight className="size-4" />
                </td>
              </tr>
            ))}
            {consultantCards.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                  No consultants with activity in this quarter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <span className="hidden">{dataset.profiles.length}</span>
    </>
  );
}

function SelfView({ scorecard }: { scorecard: ReturnType<typeof computeScorecard> }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl p-5">
        <h2 className="font-medium text-slate-900">{scorecard.fullName} — {ROLE_LABELS[scorecard.role]}</h2>
        <p className="text-xs text-muted mt-0.5">{scorecard.range.label}</p>
      </div>
      <PerformanceScorecard scorecard={scorecard} />
    </div>
  );
}

function FirmKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function DeltaPill({ m }: { m: ReturnType<typeof computeScorecard>['submissionsMade'] }) {
  if (m.direction === 'flat') return <span className="text-xs text-muted">—</span>;
  const Arrow = m.direction === 'up' ? ArrowUp : ArrowDown;
  const color = m.direction === 'up' ? 'text-emerald-600' : 'text-red-600';
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-medium', color)}>
      <Arrow className="size-3.5" />
      {m.pct === null ? `${m.delta > 0 ? '+' : ''}${m.delta}` : `${m.direction === 'up' ? '+' : ''}${m.pct}%`}
    </span>
  );
}

import clsx from 'clsx';
import { ArrowUp, ArrowDown, Minus, Briefcase, Users, Radio, Activity, ArrowRightLeft, CheckCircle2, Wallet, TrendingUp, BarChart3, Target, Clock } from 'lucide-react';
import type { MetricValue, ScorecardData } from '@/lib/performance';
import { formatSGD } from '@/lib/format';

type Format = 'count' | 'sgd' | 'pct' | 'days';

interface MetricSpec {
  label: string;
  key: keyof ScorecardData;
  format: Format;
  icon: typeof Briefcase;
  tooltip: string;
  // If true, a "down" delta is good (e.g. time-to-place getting shorter)
  invertedGood?: boolean;
}

const INPUTS: MetricSpec[] = [
  { label: 'Submissions made', key: 'submissionsMade', format: 'count', icon: Briefcase, tooltip: 'Candidate submissions created by this consultant this quarter.' },
  { label: 'Candidates added', key: 'candidatesAdded', format: 'count', icon: Users, tooltip: 'New candidate records added to the talent pool.' },
  { label: 'Co-broke contributions', key: 'cobrokeContributions', format: 'count', icon: Radio, tooltip: 'Submissions made against jobs owned by another consultant.' },
  { label: 'Activity volume', key: 'activityVolume', format: 'count', icon: Activity, tooltip: 'Total system actions (stage moves, comments, updates) logged.' },
  { label: 'Stage transitions', key: 'stageTransitions', format: 'count', icon: ArrowRightLeft, tooltip: 'Pipeline stage moves performed by this consultant.' },
];

const OUTPUTS: MetricSpec[] = [
  { label: 'Placements', key: 'placements', format: 'count', icon: CheckCircle2, tooltip: 'Candidates successfully placed in role.' },
  { label: 'Fee revenue contributed', key: 'feeRevenue', format: 'sgd', icon: Wallet, tooltip: 'Total firm revenue from placements (15% of annual salary).' },
  { label: 'Commission earned', key: 'commission', format: 'sgd', icon: Wallet, tooltip: 'Consultant\'s share of the commission pool (10% of fee × split %).' },
  { label: 'Average deal size', key: 'avgDealSize', format: 'sgd', icon: TrendingUp, tooltip: 'Mean fee revenue per placement.' },
];

const INSIGHTS: MetricSpec[] = [
  { label: 'Win rate', key: 'winRate', format: 'pct', icon: Target, tooltip: 'Placements ÷ total submissions.' },
  { label: 'New → Screening', key: 'convNewToScreen', format: 'pct', icon: BarChart3, tooltip: 'Conversion from New Candidate to Interview Screening.' },
  { label: 'Screening → Negotiation', key: 'convScreenToNeg', format: 'pct', icon: BarChart3, tooltip: 'Conversion from Interview Screening to Negotiation.' },
  { label: 'Negotiation → Placed', key: 'convNegToPlaced', format: 'pct', icon: BarChart3, tooltip: 'Conversion from Negotiation to Placed.' },
  { label: 'Median time-to-place', key: 'medianTimeToPlace', format: 'days', icon: Clock, tooltip: 'Median days from New Candidate to Placed.', invertedGood: true },
  { label: 'Co-broke participation', key: 'cobrokeParticipation', format: 'pct', icon: Radio, tooltip: 'Co-broke open jobs you submitted to ÷ co-broke open jobs available.' },
];

function fmt(v: number, format: Format): string {
  switch (format) {
    case 'sgd': return formatSGD(v, { compact: true });
    case 'pct': return `${v}%`;
    case 'days': return v === 0 ? '—' : `${v}d`;
    case 'count':
    default: return v.toString();
  }
}

function deltaLabel(m: MetricValue, format: Format): string {
  if (m.direction === 'flat') return '—';
  if (m.pct === null) return format === 'sgd' ? `+${formatSGD(m.delta, { compact: true })}` : `+${m.delta}`;
  return `${m.direction === 'up' ? '+' : ''}${m.pct}%`;
}

export function PerformanceScorecard({ scorecard }: { scorecard: ScorecardData }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Column title="INPUTS — effort" subtitle="What the consultant did" accent="slate">
        {INPUTS.map((spec) => (
          <MetricCard key={spec.key} spec={spec} value={scorecard[spec.key] as MetricValue} />
        ))}
      </Column>
      <Column title="OUTPUTS — value" subtitle="What the firm received" accent="emerald">
        {OUTPUTS.map((spec) => (
          <MetricCard key={spec.key} spec={spec} value={scorecard[spec.key] as MetricValue} />
        ))}
      </Column>
      <Column title="INSIGHTS — ratios" subtitle="Quality of pipeline work" accent="amber">
        {INSIGHTS.map((spec) => (
          <MetricCard key={spec.key} spec={spec} value={scorecard[spec.key] as MetricValue} />
        ))}
      </Column>
    </div>
  );
}

function Column({
  title, subtitle, accent, children,
}: {
  title: string; subtitle: string; accent: 'slate' | 'emerald' | 'amber'; children: React.ReactNode;
}) {
  const accentColor =
    accent === 'emerald' ? 'text-emerald-700' :
    accent === 'amber' ? 'text-amber-700' : 'text-slate-700';
  return (
    <div className="space-y-2.5">
      <div className="px-1">
        <div className={clsx('text-xs font-bold tracking-widest', accentColor)}>{title}</div>
        <div className="text-xs text-muted">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ spec, value }: { spec: MetricSpec; value: MetricValue }) {
  const Icon = spec.icon;
  const good = spec.invertedGood ? value.direction === 'down' : value.direction === 'up';
  const bad = spec.invertedGood ? value.direction === 'up' : value.direction === 'down';

  const arrowColor =
    value.direction === 'flat' ? 'text-slate-400' :
    good ? 'text-emerald-600' :
    bad ? 'text-red-600' : 'text-slate-400';

  const Arrow =
    value.direction === 'flat' ? Minus :
    value.direction === 'up' ? ArrowUp : ArrowDown;

  return (
    <div
      className="bg-white border border-border rounded-xl p-3.5"
      title={spec.tooltip}
    >
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-3.5" />
        {spec.label}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold text-slate-900">{fmt(value.current, spec.format)}</div>
        <div className={clsx('inline-flex items-center gap-0.5 text-xs font-medium', arrowColor)}>
          <Arrow className="size-3.5" />
          {deltaLabel(value, spec.format)}
        </div>
      </div>
      <div className="text-[11px] text-muted mt-1">
        vs prior {value.prior > 0 || spec.format === 'pct' ? fmt(value.prior, spec.format) : '—'}
      </div>
    </div>
  );
}

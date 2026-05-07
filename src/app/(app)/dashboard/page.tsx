import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { DashboardCharts } from '@/components/DashboardCharts';
import { commissionPool, consultantCommission, feeFromJob, formatSGD } from '@/lib/format';
import type { PipelineStage } from '@/lib/supabase/types';

const STAGE_WEIGHT: Record<PipelineStage, number> = {
  new_lead: 0.1,
  screening: 0.3,
  negotiation: 0.6,
  closure: 0.95,
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  // Director-only
  if (profile?.role !== 'director') redirect('/desk');

  const [{ data: jobs }, { data: submissions }, { data: profiles }, { data: splits }] = await Promise.all([
    supabase.from('jobs').select('id, status, co_broke_open, annual_package_sgd, fee_pct, owner_id'),
    supabase
      .from('submissions')
      .select(
        'id, stage, outcome, submitting_consultant_id, updated_at, job:jobs(id, owner_id, annual_package_sgd, fee_pct)'
      ),
    supabase.from('profiles').select('id, full_name, role'),
    supabase
      .from('splits')
      .select(
        'pct, consultant_id, submission:submissions!inner(outcome, job:jobs(owner_id, annual_package_sgd, fee_pct))'
      ),
  ]);

  // ── KPIs ──────────────────────────────────────────────────────
  const openJobs = (jobs ?? []).filter((j) => j.status === 'open');

  const totalFeeRevenue = (splits ?? []).reduce((sum, sp) => {
    const sub = sp.submission as unknown as {
      outcome: string;
      job: { owner_id: string; annual_package_sgd: number | null; fee_pct: number };
    } | null;
    if (sub?.outcome !== 'placed') return sum;
    // Avoid double-counting: only count fee once per submission
    return sum;
  }, 0);
  // Compute fee revenue properly per unique placed submission
  const placedSubmissions = new Map<
    string,
    { fee: number; ownerId: string; submitterId: string }
  >();
  for (const sp of splits ?? []) {
    const sub = sp.submission as unknown as {
      outcome: string;
      job: { owner_id: string; annual_package_sgd: number | null; fee_pct: number };
    } | null;
    if (sub?.outcome !== 'placed') continue;
  }
  // Better: compute from submissions directly
  const feeRevenuePerSubmission = new Map<string, number>();
  const submissionMeta = new Map<string, { ownerId: string; submitterId: string }>();
  for (const s of submissions ?? []) {
    const j = s.job as unknown as {
      id: string;
      owner_id: string;
      annual_package_sgd: number | null;
      fee_pct: number;
    } | null;
    if (!j) continue;
    submissionMeta.set(s.id, { ownerId: j.owner_id, submitterId: s.submitting_consultant_id });
    if (s.outcome === 'placed') {
      feeRevenuePerSubmission.set(s.id, feeFromJob(j.annual_package_sgd, j.fee_pct));
    }
  }
  const feeRevenueTotal = Array.from(feeRevenuePerSubmission.values()).reduce((a, b) => a + b, 0);
  const commissionPaidOut = Math.round(feeRevenueTotal * 0.10);

  // Weighted in-flight COMMISSION (not fee — that's what the firm cares about for forecasting payout)
  const weightedCommissionInFlight = (submissions ?? []).reduce((sum, s) => {
    if (s.outcome !== 'open') return sum;
    const j = s.job as unknown as { annual_package_sgd: number | null; fee_pct: number };
    const fee = feeFromJob(j?.annual_package_sgd ?? 0, j?.fee_pct ?? 0);
    return sum + commissionPool(fee) * (STAGE_WEIGHT[s.stage as PipelineStage] ?? 0);
  }, 0);

  const placedThisMonth = (submissions ?? []).filter((s) => {
    if (s.outcome !== 'placed') return false;
    return new Date(s.updated_at).getTime() > Date.now() - 30 * 86400000;
  }).length;

  // ── Per-KAM commission earned ─────────────────────────────────
  const profileMap = new Map<string, { name: string; role: string }>();
  for (const p of profiles ?? []) profileMap.set(p.id, { name: p.full_name, role: p.role });

  const perConsultantEarned = new Map<string, number>();
  for (const sp of splits ?? []) {
    const sub = sp.submission as unknown as {
      outcome: string;
      job: { annual_package_sgd: number | null; fee_pct: number };
    } | null;
    if (sub?.outcome !== 'placed') continue;
    const fee = feeFromJob(sub.job.annual_package_sgd, sub.job.fee_pct);
    const c = consultantCommission(fee, Number(sp.pct));
    perConsultantEarned.set(sp.consultant_id, (perConsultantEarned.get(sp.consultant_id) ?? 0) + c);
  }
  const perKamData = Array.from(perConsultantEarned.entries())
    .map(([id, value]) => ({
      name: profileMap.get(id)?.name?.split(' ')[0] ?? 'Unknown',
      role: profileMap.get(id)?.role ?? '',
      commission: value,
    }))
    .sort((a, b) => b.commission - a.commission);

  // ── Earnings vs In Flight ─────────────────────────────────────
  const earningsVsInFlight = [
    { label: 'Realised commission', value: commissionPaidOut },
    { label: 'Weighted in-flight', value: Math.round(weightedCommissionInFlight) },
  ];

  // ── Co-broke vs Individual earnings ───────────────────────────
  let coBrokeCommission = 0;
  let individualCommission = 0;
  for (const [subId, fee] of feeRevenuePerSubmission.entries()) {
    const meta = submissionMeta.get(subId);
    if (!meta) continue;
    const isCobroke = meta.ownerId !== meta.submitterId;
    if (isCobroke) coBrokeCommission += Math.round(fee * 0.10);
    else individualCommission += Math.round(fee * 0.10);
  }
  const coBrokeData = [
    { label: 'Individual', value: individualCommission, color: '#0d9488' },
    { label: 'Co-broke', value: coBrokeCommission, color: '#0ea5e9' },
  ];

  // ── Stage distribution ───────────────────────────────────────
  const stageCounts: Record<PipelineStage, number> = {
    new_lead: 0,
    screening: 0,
    negotiation: 0,
    closure: 0,
  };
  for (const s of submissions ?? []) {
    if (s.outcome === 'open') stageCounts[s.stage as PipelineStage]++;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader title="Director Dashboard" subtitle="Firm-wide pipeline, earnings, and commission split." />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Realised commission"
            value={formatSGD(commissionPaidOut, { compact: true })}
            hint={`${formatSGD(feeRevenueTotal, { compact: true })} fee revenue · 10% paid out`}
            accent
          />
          <KpiCard
            label="Weighted in-flight"
            value={formatSGD(weightedCommissionInFlight, { compact: true })}
            hint="Commission, probability-weighted"
          />
          <KpiCard
            label="Open roles"
            value={openJobs.length.toString()}
            hint={`${openJobs.filter((j) => j.co_broke_open).length} co-broke`}
          />
          <KpiCard
            label="Placed this month"
            value={placedThisMonth.toString()}
            hint="Last 30 days"
          />
        </div>

        <DashboardCharts
          earningsVsInFlight={earningsVsInFlight}
          perKamData={perKamData}
          coBrokeData={coBrokeData}
          stageData={[
            { stage: 'New Candidate', count: stageCounts.new_lead },
            { stage: 'Screening', count: stageCounts.screening },
            { stage: 'Negotiation', count: stageCounts.negotiation },
            { stage: 'Closure', count: stageCounts.closure },
          ]}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-xl p-5 ${accent ? 'border-emerald-200 bg-emerald-50/40' : 'border-border'}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{hint}</div>
    </div>
  );
}

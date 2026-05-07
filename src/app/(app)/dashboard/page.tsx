import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { DashboardCharts } from '@/components/DashboardCharts';
import { feeFromJob, formatSGD } from '@/lib/format';
import type { PipelineStage } from '@/lib/supabase/types';

const STAGE_WEIGHT: Record<PipelineStage, number> = {
  new_lead: 0.1,
  screening: 0.3,
  negotiation: 0.6,
  closure: 0.95,
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: jobs }, { data: submissions }, { data: profiles }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, annual_package_sgd, fee_pct, status, co_broke_open, owner_id, client:clients(name)'),
    supabase
      .from('submissions')
      .select('id, stage, outcome, submitting_consultant_id, created_at, job:jobs(id, annual_package_sgd, fee_pct)'),
    supabase.from('profiles').select('id, full_name, role'),
  ]);

  const totalFeesInFlight = (submissions ?? []).reduce((sum, s) => {
    if (s.outcome !== 'open' && s.outcome !== 'placed') return sum;
    const j = s.job as unknown as { annual_package_sgd: number | null; fee_pct: number };
    const fee = feeFromJob(j?.annual_package_sgd ?? 0, j?.fee_pct ?? 0);
    return sum + fee * (STAGE_WEIGHT[s.stage as PipelineStage] ?? 0);
  }, 0);

  // Stage counts
  const stageCounts: Record<PipelineStage, number> = {
    new_lead: 0,
    screening: 0,
    negotiation: 0,
    closure: 0,
  };
  for (const s of submissions ?? []) {
    stageCounts[s.stage as PipelineStage]++;
  }

  // Submissions per consultant (last 30 days)
  const cutoff = Date.now() - 30 * 86400000;
  const profileMap = new Map<string, string>();
  for (const p of profiles ?? []) profileMap.set(p.id, p.full_name);
  const perConsultant = new Map<string, number>();
  for (const s of submissions ?? []) {
    if (new Date(s.created_at).getTime() < cutoff) continue;
    const name = profileMap.get(s.submitting_consultant_id) ?? 'Unknown';
    perConsultant.set(name, (perConsultant.get(name) ?? 0) + 1);
  }
  const consultantBars = Array.from(perConsultant.entries()).map(([name, count]) => ({
    name: name.split(' ')[0],
    submissions: count,
  }));

  // Open roles
  const openJobs = (jobs ?? []).filter((j) => j.status === 'open');
  const coBrokeOpenCount = openJobs.filter((j) => j.co_broke_open).length;

  // Submissions over time (last 30 days, by day)
  const dayMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of submissions ?? []) {
    const day = s.created_at.slice(0, 10);
    if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const trendData = Array.from(dayMap.entries()).map(([day, count]) => ({
    day: day.slice(5),
    count,
  }));

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader title="Dashboard" subtitle="Real-time view of pipeline health and BD activity." />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Open roles" value={openJobs.length.toString()} hint={`${coBrokeOpenCount} co-broke`} />
          <KpiCard
            label="Weighted fees in flight"
            value={formatSGD(totalFeesInFlight, { compact: true })}
            hint="Probability-weighted"
          />
          <KpiCard label="Active submissions" value={(submissions?.length ?? 0).toString()} hint="All stages" />
          <KpiCard
            label="In negotiation"
            value={stageCounts.negotiation.toString()}
            hint={`${stageCounts.closure} closed`}
          />
        </div>

        <DashboardCharts
          stageData={[
            { stage: 'New Candidate', count: stageCounts.new_lead },
            { stage: 'Screening', count: stageCounts.screening },
            { stage: 'Negotiation', count: stageCounts.negotiation },
            { stage: 'Closure', count: stageCounts.closure },
          ]}
          consultantData={consultantBars}
          trendData={trendData}
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      <div className="text-xs text-muted mt-1">{hint}</div>
    </div>
  );
}

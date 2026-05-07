import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { EarningsView } from '@/components/EarningsView';
import { feeFromJob } from '@/lib/format';
import type { UserRole } from '@/lib/supabase/types';

export type EarningsRow = {
  submission_id: string;
  candidate_id: string;
  candidate_name: string;
  job_id: string;
  job_title: string;
  client_name: string;
  placed_at: string;
  fee_total: number;
  pct: number;
  amount: number;
  consultant_id: string;
  consultant_name: string;
  consultant_role: 'originator' | 'submitter' | 'sole';
};

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { data: splits } = await supabase
    .from('splits')
    .select(`
      pct, consultant_id,
      consultant:profiles!splits_consultant_id_fkey(full_name),
      submission:submissions!inner(
        id, outcome,
        candidate:candidates(id, full_name),
        job:jobs(id, title, owner_id, annual_package_sgd, fee_pct, client:clients(name)),
        closure_at, updated_at
      )
    `);

  // Flatten into EarningsRow[]
  const all: EarningsRow[] = [];
  for (const s of splits ?? []) {
    const sub = s.submission as unknown as {
      id: string; outcome: string;
      candidate: { id: string; full_name: string };
      job: { id: string; title: string; owner_id: string; annual_package_sgd: number | null; fee_pct: number; client: { name: string } };
      closure_at: string | null; updated_at: string;
    } | null;
    if (!sub || sub.outcome !== 'placed') continue;
    const consultant = s.consultant as unknown as { full_name: string };
    const fee = feeFromJob(sub.job.annual_package_sgd, sub.job.fee_pct);
    const role: EarningsRow['consultant_role'] =
      sub.job.owner_id === s.consultant_id
        ? 'originator'
        : Number(s.pct) === 100
          ? 'sole'
          : 'submitter';
    all.push({
      submission_id: sub.id,
      candidate_id: sub.candidate.id,
      candidate_name: sub.candidate.full_name,
      job_id: sub.job.id,
      job_title: sub.job.title,
      client_name: sub.job.client.name,
      placed_at: sub.closure_at ?? sub.updated_at,
      fee_total: fee,
      pct: Number(s.pct),
      amount: Math.round((fee * Number(s.pct)) / 100),
      consultant_id: s.consultant_id,
      consultant_name: consultant.full_name,
      consultant_role: role,
    });
  }

  all.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());

  const role = profile!.role as UserRole;
  const isDirector = role === 'director';
  const myRows = isDirector ? all : all.filter((r) => r.consultant_id === user!.id);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={isDirector ? 'Firm-wide earnings' : 'My earnings'}
        subtitle={
          isDirector
            ? 'Every recorded placement and the consultants who earned from it.'
            : 'Every placement you have a commission split on.'
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <EarningsView rows={myRows} viewerName={profile!.full_name} isDirector={isDirector} />
      </div>
    </div>
  );
}

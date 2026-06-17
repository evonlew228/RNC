import { createClient } from '@/lib/supabase/server';
import type { PerformanceDataset } from './performance';

/**
 * Server-side dataset loader. Pulls the raw rows from Supabase needed
 * to compute every scorecard in one go.
 *
 * Kept separate from performance.ts so the math layer stays pure / testable.
 */
export async function loadPerformanceDataset(): Promise<PerformanceDataset> {
  const supabase = await createClient();

  const [
    { data: rawSubs },
    { data: rawSplits },
    { data: rawActs },
    { data: rawCands },
    { data: rawJobs },
    { data: rawProfiles },
  ] = await Promise.all([
    supabase.from('submissions').select(`
      id, stage, outcome, submitting_consultant_id,
      created_at, updated_at, closure_at, new_lead_at, screening_at, negotiation_at,
      job:jobs(id, owner_id, annual_package_sgd, fee_pct)
    `),
    supabase.from('splits').select(`
      consultant_id, pct, submission_id,
      submission:submissions(id, outcome, job:jobs(annual_package_sgd, fee_pct))
    `),
    supabase.from('activities').select('actor_id, kind, created_at'),
    supabase.from('candidates').select('added_by, created_at'),
    supabase.from('jobs').select('id, owner_id, co_broke_open, created_at'),
    supabase.from('profiles').select('id, full_name, role'),
  ]);

  const submissions = (rawSubs ?? []).map((s) => {
    const job = s.job as unknown as { id: string; owner_id: string | null; annual_package_sgd: number | null; fee_pct: number } | null;
    return {
      id: s.id as string,
      stage: s.stage as string,
      outcome: s.outcome as string,
      submitting_consultant_id: s.submitting_consultant_id as string,
      created_at: s.created_at as string,
      updated_at: s.updated_at as string,
      closure_at: s.closure_at as string | null,
      new_lead_at: s.new_lead_at as string | null,
      screening_at: s.screening_at as string | null,
      negotiation_at: s.negotiation_at as string | null,
      job_owner_id: job?.owner_id ?? null,
      annual_package_sgd: job?.annual_package_sgd ?? null,
      fee_pct: Number(job?.fee_pct ?? 0),
    };
  });

  const splits = (rawSplits ?? []).map((sp) => {
    const sub = sp.submission as unknown as {
      id: string; outcome: string; job: { annual_package_sgd: number | null; fee_pct: number } | null;
    } | null;
    return {
      consultant_id: sp.consultant_id as string,
      pct: Number(sp.pct),
      submission_id: sp.submission_id as string,
      submission_outcome: sub?.outcome ?? 'open',
      annual_package_sgd: sub?.job?.annual_package_sgd ?? null,
      fee_pct: Number(sub?.job?.fee_pct ?? 0),
    };
  });

  return {
    submissions,
    splits,
    activities: (rawActs ?? []).map((a) => ({
      actor_id: a.actor_id as string | null,
      kind: a.kind as string,
      created_at: a.created_at as string,
    })),
    candidates: (rawCands ?? []).map((c) => ({
      added_by: c.added_by as string | null,
      created_at: c.created_at as string,
    })),
    jobs: (rawJobs ?? []).map((j) => ({
      id: j.id as string,
      owner_id: j.owner_id as string | null,
      co_broke_open: j.co_broke_open as boolean,
      created_at: j.created_at as string,
    })),
    profiles: (rawProfiles ?? []).map((p) => ({
      id: p.id as string,
      full_name: p.full_name as string,
      role: p.role as 'director' | 'kam' | 'bd',
    })),
  };
}

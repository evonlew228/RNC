import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StageBadge } from '@/components/StageBadge';
import { EditCandidateDialog } from '@/components/EditCandidateDialog';
import { DeleteCandidateButton } from '@/components/DeleteCandidateButton';
import { feeFromJob, formatSGD, initials } from '@/lib/format';
import type { Candidate } from '@/lib/supabase/types';

export default async function CandidateDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: candidate } = await supabase
    .from('candidates')
    .select(`
      *,
      candidate_skills(skill:skills(name))
    `)
    .eq('id', id)
    .single();

  if (!candidate) notFound();

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id, stage, outcome, created_at, updated_at, closure_at,
      job:jobs(id, title, annual_package_sgd, fee_pct, client:clients(name)),
      submitter:profiles!submissions_submitting_consultant_id_fkey(full_name),
      splits(pct, consultant:profiles!splits_consultant_id_fkey(full_name))
    `)
    .eq('candidate_id', id)
    .order('updated_at', { ascending: false });

  const placedSubs = (submissions ?? []).filter((s) => s.outcome === 'placed');
  const activeSubs = (submissions ?? []).filter((s) => s.outcome === 'open');
  const otherSubs = (submissions ?? []).filter((s) => s.outcome !== 'placed' && s.outcome !== 'open');

  const skills = (candidate.candidate_skills ?? []) as unknown as { skill: { name: string } }[];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={candidate.full_name}
        subtitle={[candidate.current_title, candidate.current_employer].filter(Boolean).join(' · ')}
        actions={
          <>
            <EditCandidateDialog candidate={candidate as Candidate} />
            <DeleteCandidateButton
              candidateId={candidate.id}
              candidateName={candidate.full_name}
              redirectAfter="/candidates"
            />
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6 grid grid-cols-3 gap-6 max-w-5xl">
        <div className="col-span-2 space-y-4">
          <Section title="About">
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-full bg-slate-200 grid place-items-center font-semibold text-slate-700">
                {initials(candidate.full_name)}
              </div>
              <div className="text-sm space-y-1 flex-1">
                {candidate.email && <div className="text-slate-700">{candidate.email}</div>}
                {candidate.phone && <div className="text-muted">{candidate.phone}</div>}
                {candidate.resume_url && (
                  <a
                    href={candidate.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand hover:underline mt-2"
                  >
                    View resume
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
            {candidate.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Notes</div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{candidate.notes}</p>
              </div>
            )}
          </Section>

          {placedSubs.length > 0 && (
            <Section title="Placement history" icon={Trophy} accent="emerald">
              <ul className="divide-y divide-border">
                {placedSubs.map((s) => {
                  const job = s.job as unknown as {
                    id: string; title: string; annual_package_sgd: number | null; fee_pct: number; client: { name: string };
                  };
                  const splits = (s.splits ?? []) as unknown as {
                    pct: number; consultant: { full_name: string };
                  }[];
                  const fee = feeFromJob(job.annual_package_sgd, job.fee_pct);
                  const closedDate = s.closure_at ?? s.updated_at;
                  return (
                    <li key={s.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-brand">
                            {job.title}
                          </Link>
                          <div className="text-xs text-muted">
                            {job.client.name} · placed {new Date(closedDate).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          {splits.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-emerald-800">
                              {splits.map((sp, i) => (
                                <span key={i}>
                                  {sp.consultant.full_name}: {sp.pct}% ({formatSGD(Math.round((fee * Number(sp.pct)) / 100))})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-emerald-700 shrink-0">{formatSGD(fee)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title={`Active submissions (${activeSubs.length})`}>
            <ul className="divide-y divide-border">
              {activeSubs.map((s) => {
                const job = s.job as unknown as { id: string; title: string; client: { name: string } };
                const sub = s.submitter as unknown as { full_name: string };
                return (
                  <li key={s.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {job.title}
                      </Link>
                      <div className="text-xs text-muted">{job.client.name} · via {sub.full_name.split(' ')[0]}</div>
                    </div>
                    <StageBadge stage={s.stage} />
                  </li>
                );
              })}
              {activeSubs.length === 0 && (
                <li className="py-6 text-sm text-muted text-center">No active submissions.</li>
              )}
            </ul>
          </Section>

          {otherSubs.length > 0 && (
            <Section title={`Past activity (${otherSubs.length})`}>
              <ul className="divide-y divide-border">
                {otherSubs.map((s) => {
                  const job = s.job as unknown as { id: string; title: string; client: { name: string } };
                  return (
                    <li key={s.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/jobs/${job.id}`} className="text-sm text-slate-700 hover:text-brand">
                          {job.title}
                        </Link>
                        <div className="text-xs text-muted">{job.client.name}</div>
                      </div>
                      <span className="text-xs text-muted capitalize">{s.outcome}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>

        <div className="col-span-1 space-y-4">
          <Section title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                  {s.skill.name}
                </span>
              ))}
              {skills.length === 0 && <span className="text-sm text-muted">None tagged.</span>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon?: typeof Trophy;
  accent?: 'emerald';
  children: React.ReactNode;
}) {
  const ring = accent === 'emerald' ? 'border-emerald-200' : 'border-border';
  return (
    <div className={`bg-white border ${ring} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="size-4 text-emerald-600" />}
        <h2 className="font-medium text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

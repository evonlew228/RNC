import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StageBadge } from '@/components/StageBadge';
import { CoBrokeToggle } from '@/components/CoBrokeToggle';
import { SubmitCandidatePanel } from '@/components/SubmitCandidatePanel';
import { MarkPlacedDialog } from '@/components/MarkPlacedDialog';
import { SubmissionStatusActions } from '@/components/SubmissionStatusActions';
import type { SubmissionOutcome } from '@/lib/supabase/types';
import { consultantCommission, feeFromJob, formatSGD } from '@/lib/format';

export default async function JobDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      *,
      client:clients(*),
      owner:profiles!jobs_owner_id_fkey(id, full_name, role),
      job_skills(skill:skills(id, name))
    `)
    .eq('id', id)
    .single();

  if (!job) notFound();

  const jobSkills = (job.job_skills ?? []) as unknown as { skill: { id: string; name: string } }[];

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      *,
      candidate:candidates(id, full_name, current_title, current_employer),
      submitter:profiles!submissions_submitting_consultant_id_fkey(id, full_name, role),
      splits(consultant_id, pct, consultant:profiles!splits_consultant_id_fkey(full_name))
    `)
    .eq('job_id', id)
    .order('updated_at', { ascending: false });

  const { data: { user } } = await supabase.auth.getUser();

  const owner = job.owner as unknown as { id: string; full_name: string; role: string };
  const isOwner = owner?.id === user?.id;
  const fee = feeFromJob(job.annual_package_sgd, job.fee_pct);
  const split = job.default_split as { originator: number; submitter: number } | null;
  const canSubmit = !!user && (isOwner || job.co_broke_open);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={job.title}
        subtitle={(job.client as unknown as { name: string }).name}
        actions={
          <SubmitCandidatePanel jobId={job.id} jobTitle={job.title} canSubmit={canSubmit} />
        }
      />
      <div className="flex-1 overflow-auto p-6 grid grid-cols-3 gap-6 max-w-6xl">
        <div className="col-span-2 space-y-4">
          <Section title="Job description">
            {job.jd_summary && (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{job.jd_summary}</p>
            )}
            {job.criteria && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Hiring criteria</div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{job.criteria}</div>
              </div>
            )}
            {job.jd_url && (
              <a
                href={job.jd_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                View full JD attachment
                <ExternalLink className="size-3.5" />
              </a>
            )}
            {!job.jd_summary && !job.criteria && !job.jd_url && (
              <p className="text-sm text-muted">No description provided.</p>
            )}
          </Section>

          <Section title={`Submissions (${submissions?.length ?? 0})`}>
            <ul className="divide-y divide-border">
              {(submissions ?? []).map((s) => {
                const cand = s.candidate as unknown as {
                  id: string; full_name: string; current_title: string; current_employer: string;
                };
                const sub = s.submitter as unknown as { id: string; full_name: string; role: string };
                const splits = (s.splits ?? []) as unknown as {
                  consultant_id: string; pct: number; consultant: { full_name: string };
                }[];
                const isPlaced = s.outcome === 'placed';
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/candidates/${cand.id}`} className="font-medium text-slate-900 hover:text-brand">
                          {cand.full_name}
                        </Link>
                        <div className="text-xs text-muted">
                          {cand.current_title} · {cand.current_employer}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          via {sub.full_name.split(' ')[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StageBadge stage={s.stage} />
                        <SubmissionStatusActions
                          submissionId={s.id}
                          jobId={job.id}
                          outcome={s.outcome as SubmissionOutcome}
                        />
                        {s.stage === 'closure' && s.outcome === 'open' && (
                          <MarkPlacedDialog
                            submissionId={s.id}
                            jobId={job.id}
                            jobOwnerId={owner?.id ?? null}
                            submittingConsultantId={sub.id}
                            defaultSplit={split}
                            fee={fee}
                            isPlaced={false}
                          />
                        )}
                      </div>
                    </div>
                    {isPlaced && splits.length > 0 && (
                      <div className="mt-2 ml-0 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                        <div className="font-medium text-emerald-900 mb-1">
                          Placed · {formatSGD(fee)} fee
                        </div>
                        <div className="flex flex-wrap gap-3 text-emerald-800">
                          {splits.map((sp) => (
                            <span key={sp.consultant_id}>
                              {sp.consultant.full_name}: {sp.pct}% commission ({formatSGD(consultantCommission(fee, Number(sp.pct)))})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              {(!submissions || submissions.length === 0) && (
                <li className="py-6 text-sm text-muted text-center">
                  No submissions yet. {canSubmit && 'Use the button above to submit one.'}
                </li>
              )}
            </ul>
          </Section>
        </div>

        <div className="col-span-1 space-y-4">
          <Section title="Details">
            <dl className="space-y-3 text-sm">
              <Row label="Owner" value={owner?.full_name} />
              <Row label="Role" value={job.role_type} />
              <Row label="Annual package" value={formatSGD(job.annual_package_sgd)} />
              <Row label="Fee" value={`${job.fee_pct}% · ${formatSGD(fee)}`} />
              <Row label="Status" value={job.status} />
            </dl>
          </Section>

          <Section title={`Required skills${jobSkills.length ? ` (${jobSkills.length})` : ''}`}>
            {jobSkills.length === 0 ? (
              <div className="text-sm text-muted">No skills tagged.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {jobSkills.map(({ skill }) => (
                  <span
                    key={skill.id}
                    className="text-xs px-2 py-1 rounded bg-brand-soft text-brand-ink font-medium"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Co-broke">
            <CoBrokeToggle
              jobId={job.id}
              initialOpen={job.co_broke_open}
              initialSplit={split ?? { originator: 60, submitter: 40 }}
              canEdit={isOwner}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <h2 className="font-medium text-slate-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-slate-900 font-medium text-right">{value}</dd>
    </div>
  );
}

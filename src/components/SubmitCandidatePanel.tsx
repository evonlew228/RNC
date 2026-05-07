'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, X, AlertTriangle, Radio } from 'lucide-react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { initials } from '@/lib/format';
import { ResumeUploader } from './ResumeUploader';

interface CandidateOption {
  id: string;
  full_name: string;
  current_title: string | null;
  current_employer: string | null;
  rest_until: string | null;
  open_submissions: { job: { id: string; title: string; client: { name: string } | null } | null }[];
}

interface ConflictTarget {
  candidate: CandidateOption;
}

export function SubmitCandidatePanel({
  jobId,
  jobTitle,
  canSubmit,
}: {
  jobId: string;
  jobTitle: string;
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictTarget | null>(null);
  const [newCand, setNewCand] = useState({
    full_name: '',
    current_title: '',
    current_employer: '',
    resume_url: '',
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createClient();
      // Pull candidates with their currently-open submissions (excluding this job)
      const { data } = await supabase
        .from('candidates')
        .select(`
          id, full_name, current_title, current_employer, rest_until,
          submissions(outcome, job:jobs(id, title, client:clients(name)))
        `)
        .order('full_name')
        .limit(200);
      const transformed = (data ?? []).map((c) => {
        const subs = (c.submissions ?? []) as unknown as {
          outcome: string;
          job: { id: string; title: string; client: { name: string } | null } | null;
        }[];
        const open_submissions = subs
          .filter((s) => s.outcome === 'open' && s.job?.id !== jobId && s.job)
          .map((s) => ({ job: s.job }));
        return {
          id: c.id,
          full_name: c.full_name,
          current_title: c.current_title,
          current_employer: c.current_employer,
          rest_until: c.rest_until,
          open_submissions,
        } as CandidateOption;
      });
      setCandidates(transformed);
    })();
  }, [open, jobId]);

  if (!canSubmit) return null;

  const filtered = candidates.filter(
    (c) =>
      !query ||
      c.full_name.toLowerCase().includes(query.toLowerCase()) ||
      (c.current_title ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (c.current_employer ?? '').toLowerCase().includes(query.toLowerCase())
  );

  function isResting(candidate: CandidateOption): boolean {
    return !!candidate.rest_until && new Date(candidate.rest_until) > new Date();
  }

  function attemptSubmit(candidate: CandidateOption) {
    if (isResting(candidate) || candidate.open_submissions.length > 0) {
      setConflict({ candidate });
      return;
    }
    submitExisting(candidate.id);
  }

  async function submitExisting(candidateId: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: submission, error: sErr } = await supabase
      .from('submissions')
      .insert({
        job_id: jobId,
        candidate_id: candidateId,
        submitting_consultant_id: user!.id,
        stage: 'new_lead',
      })
      .select()
      .single();

    if (sErr) {
      setError(sErr.message);
      setBusy(false);
      return;
    }

    await supabase.from('activities').insert({
      actor_id: user!.id,
      kind: 'submission_created',
      job_id: jobId,
      candidate_id: candidateId,
      submission_id: submission.id,
    });

    setOpen(false);
    setConflict(null);
    setBusy(false);
    router.refresh();
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: cand, error: cErr } = await supabase
      .from('candidates')
      .insert({
        full_name: newCand.full_name,
        current_title: newCand.current_title || null,
        current_employer: newCand.current_employer || null,
        resume_url: newCand.resume_url || null,
        added_by: user!.id,
      })
      .select()
      .single();

    if (cErr) {
      setError(cErr.message);
      setBusy(false);
      return;
    }

    const { data: submission, error: sErr } = await supabase
      .from('submissions')
      .insert({
        job_id: jobId,
        candidate_id: cand.id,
        submitting_consultant_id: user!.id,
        stage: 'new_lead',
      })
      .select()
      .single();

    if (sErr) {
      setError(sErr.message);
      setBusy(false);
      return;
    }

    await supabase.from('activities').insert({
      actor_id: user!.id,
      kind: 'submission_created',
      job_id: jobId,
      candidate_id: cand.id,
      submission_id: submission.id,
    });

    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-ink"
      >
        <UserPlus className="size-4" />
        Submit candidate
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Submit candidate</h3>
                <p className="text-xs text-muted mt-0.5">For: {jobTitle}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-slate-900">
                <X className="size-5" />
              </button>
            </div>

            <div className="px-5 pt-3 flex gap-1 border-b border-border">
              <Tab active={mode === 'pick'} onClick={() => setMode('pick')}>Pick existing</Tab>
              <Tab active={mode === 'new'} onClick={() => setMode('new')}>Add new</Tab>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {mode === 'pick' ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, role, or employer"
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
                    />
                  </div>
                  <ul className="mt-3 divide-y divide-border max-h-80 overflow-auto">
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => attemptSubmit(c)}
                          disabled={busy}
                          className="w-full text-left py-3 px-1 flex items-center gap-3 hover:bg-slate-50 rounded disabled:opacity-50"
                        >
                          <div className="size-8 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-700">
                            {initials(c.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900 truncate flex items-center gap-2">
                              {c.full_name}
                              {isResting(c) && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                                  Resting
                                </span>
                              )}
                              {c.open_submissions.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                  <Radio className="size-3" />
                                  In flight ({c.open_submissions.length})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted truncate">
                              {c.current_title}
                              {c.current_employer && <> · {c.current_employer}</>}
                            </div>
                          </div>
                          <span className="text-xs text-brand">Submit →</span>
                        </button>
                      </li>
                    ))}
                    {filtered.length === 0 && (
                      <li className="py-6 text-center text-sm text-muted">No candidates found.</li>
                    )}
                  </ul>
                </>
              ) : (
                <form onSubmit={submitNew} className="space-y-3">
                  <Field label="Full name">
                    <input
                      required
                      value={newCand.full_name}
                      onChange={(e) => setNewCand({ ...newCand, full_name: e.target.value })}
                      placeholder="e.g. Tan Wei Hong"
                      className="w-full px-3 py-2 border border-border rounded-lg"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Current title">
                      <input
                        value={newCand.current_title}
                        onChange={(e) => setNewCand({ ...newCand, current_title: e.target.value })}
                        placeholder="e.g. Senior Audiologist"
                        className="w-full px-3 py-2 border border-border rounded-lg"
                      />
                    </Field>
                    <Field label="Current employer">
                      <input
                        value={newCand.current_employer}
                        onChange={(e) => setNewCand({ ...newCand, current_employer: e.target.value })}
                        placeholder="e.g. NUH"
                        className="w-full px-3 py-2 border border-border rounded-lg"
                      />
                    </Field>
                  </div>
                  <Field label="Resume (optional)">
                    <ResumeUploader
                      value={newCand.resume_url}
                      onChange={(url) => setNewCand({ ...newCand, resume_url: url })}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full px-3 py-2 rounded-lg bg-brand text-white font-medium hover:bg-brand-ink disabled:opacity-50"
                  >
                    {busy ? 'Submitting…' : 'Add candidate & submit'}
                  </button>
                </form>
              )}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {conflict && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => !busy && setConflict(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex items-start gap-3 border-b border-border">
              <div className="size-9 rounded-full bg-amber-100 grid place-items-center shrink-0">
                <AlertTriangle className="size-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">
                  {isResting(conflict.candidate) ? 'Candidate is in rest period' : 'Candidate already in flight'}
                </h3>
                <p className="text-sm text-muted mt-1">
                  <span className="font-medium text-slate-900">{conflict.candidate.full_name}</span>
                </p>
                {isResting(conflict.candidate) && conflict.candidate.rest_until && (
                  <div className="mt-2 p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm">
                    <div className="font-medium text-purple-900">
                      Resting until {new Date(conflict.candidate.rest_until).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    {conflict.candidate.current_employer && (
                      <div className="text-xs text-purple-800 mt-0.5">
                        Currently at {conflict.candidate.current_employer}
                      </div>
                    )}
                    <div className="text-xs text-purple-800 mt-1">
                      Industry-standard 12-month no-poach period after a placement.
                    </div>
                  </div>
                )}
                {conflict.candidate.open_submissions.length > 0 && (
                  <>
                    <p className="text-sm text-slate-700 mt-3">
                      Open submission{conflict.candidate.open_submissions.length > 1 ? 's' : ''}:
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {conflict.candidate.open_submissions.map((s, i) => (
                        s.job && (
                          <li key={i} className="text-slate-700">
                            • <span className="font-medium">{s.job.title}</span>
                            {s.job.client && <> at {s.job.client.name}</>}
                          </li>
                        )
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-xs text-muted mt-3">
                  Override only if you have explicit reason (e.g. candidate left the placed role early, or a documented exception).
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setConflict(null)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-border text-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => submitExisting(conflict.candidate.id)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? 'Submitting…' : 'Proceed anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Tab({
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
        'px-3 py-2 text-sm border-b-2 -mb-px',
        active ? 'border-brand text-brand-ink font-medium' : 'border-transparent text-muted hover:text-slate-900'
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

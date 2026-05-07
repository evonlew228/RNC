'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, X, PartyPopper } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { commissionPool, consultantCommission, formatSGD } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/supabase/types';

interface ConsultantSplit {
  consultant_id: string;
  full_name: string;
  role: string;
  pct: number;
}

export function MarkPlacedDialog({
  submissionId,
  jobId,
  jobOwnerId,
  submittingConsultantId,
  defaultSplit,
  fee,
  isPlaced,
}: {
  submissionId: string;
  jobId: string;
  jobOwnerId: string | null;
  submittingConsultantId: string;
  defaultSplit: { originator: number; submitter: number } | null;
  fee: number;
  isPlaced: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [splits, setSplits] = useState<ConsultantSplit[]>([]);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createClient();
      const ids = Array.from(new Set([jobOwnerId, submittingConsultantId].filter(Boolean))) as string[];
      const { data } = await supabase.from('profiles').select('id, full_name, role').in('id', ids);
      const byId = new Map<string, { id: string; full_name: string; role: string }>();
      for (const p of data ?? []) byId.set(p.id, p);

      if (jobOwnerId && jobOwnerId !== submittingConsultantId) {
        const o = byId.get(jobOwnerId);
        const s = byId.get(submittingConsultantId);
        setSplits([
          {
            consultant_id: jobOwnerId,
            full_name: o?.full_name ?? 'Originator',
            role: o?.role ?? 'kam',
            pct: defaultSplit?.originator ?? 60,
          },
          {
            consultant_id: submittingConsultantId,
            full_name: s?.full_name ?? 'Submitter',
            role: s?.role ?? 'bd',
            pct: defaultSplit?.submitter ?? 40,
          },
        ]);
      } else {
        const me = byId.get(submittingConsultantId);
        setSplits([
          {
            consultant_id: submittingConsultantId,
            full_name: me?.full_name ?? 'Consultant',
            role: me?.role ?? 'kam',
            pct: 100,
          },
        ]);
      }
    })();
  }, [open, jobOwnerId, submittingConsultantId, defaultSplit]);

  function updatePct(idx: number, pct: number) {
    setSplits((s) => s.map((row, i) => (i === idx ? { ...row, pct } : row)));
  }

  const total = splits.reduce((sum, s) => sum + s.pct, 0);
  const valid = total === 100;

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Atomic placement: marks submission placed, updates candidate's current
    // title + employer, auto-withdraws other open submissions for this candidate.
    const { error: rpcErr } = await supabase.rpc('mark_placed', {
      p_submission_id: submissionId,
      p_actor_id: user!.id,
    });
    if (rpcErr) {
      setError(`mark_placed failed: ${rpcErr.message}. Did you run migration 0005?`);
      setBusy(false);
      return;
    }

    // Wipe any existing splits then insert
    await supabase.from('splits').delete().eq('submission_id', submissionId);
    const { error: splitErr } = await supabase.from('splits').insert(
      splits.map((s) => ({
        submission_id: submissionId,
        consultant_id: s.consultant_id,
        pct: s.pct,
      }))
    );

    if (splitErr) {
      setError(splitErr.message);
      setBusy(false);
      return;
    }

    await supabase.from('activities').insert({
      actor_id: user!.id,
      kind: 'comment',
      job_id: jobId,
      submission_id: submissionId,
      payload: {
        type: 'placed',
        fee,
        splits: splits.map((s) => ({ name: s.full_name, pct: s.pct, amount: consultantCommission(fee, s.pct) })),
      },
    });

    setSuccess(true);
    setBusy(false);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      router.refresh();
    }, 1800);
  }

  if (isPlaced) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-medium">
        <CheckCircle2 className="size-4" />
        Placed
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
      >
        <CheckCircle2 className="size-4" />
        Mark as placed
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="p-8 text-center">
                <PartyPopper className="size-12 text-emerald-600 mx-auto" />
                <h3 className="mt-3 font-semibold text-lg text-slate-900">Deal closed!</h3>
                <p className="text-sm text-muted mt-1">
                  Splits recorded · {formatSGD(commissionPool(fee))} commission paid out
                </p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Mark as placed</h3>
                    <p className="text-xs text-muted mt-0.5">Confirm the commission split.</p>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-muted hover:text-slate-900">
                    <X className="size-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-border rounded-lg text-sm">
                      <span className="text-slate-600">Fee revenue (firm bills client)</span>
                      <span className="font-medium text-slate-900">{formatSGD(fee)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                      <span className="text-emerald-800">Commission pool (10% of fee)</span>
                      <span className="font-semibold text-emerald-900">{formatSGD(commissionPool(fee))}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {splits.map((s, i) => (
                      <div
                        key={s.consultant_id}
                        className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{s.full_name}</div>
                          <div className="text-xs text-muted">{ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] ?? s.role}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={s.pct}
                            onChange={(e) => updatePct(i, Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-border rounded text-right"
                          />
                          <span className="text-sm text-slate-700">%</span>
                          <span className="text-sm font-medium text-slate-900 w-24 text-right">
                            {formatSGD(consultantCommission(fee, s.pct))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`text-xs ${valid ? 'text-emerald-700' : 'text-red-600'}`}>
                    Total: {total}% {valid ? '✓' : '— must equal 100%'}
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-border flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg border border-border text-slate-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirm}
                    disabled={busy || !valid}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? 'Recording…' : 'Confirm placement'}
                  </button>
                </div>

                {error && <p className="px-5 pb-4 text-sm text-red-600">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

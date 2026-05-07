'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, XCircle, UserMinus, RotateCcw, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { SubmissionOutcome } from '@/lib/supabase/types';

const OUTCOME_LABEL: Record<SubmissionOutcome, string> = {
  open: 'Active',
  placed: 'Placed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const OUTCOME_BADGE: Record<SubmissionOutcome, string> = {
  open: 'bg-slate-100 text-slate-700',
  placed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-200 text-slate-700',
};

export function SubmissionStatusActions({
  submissionId,
  jobId,
  outcome,
}: {
  submissionId: string;
  jobId: string;
  outcome: SubmissionOutcome;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function setOutcome(next: SubmissionOutcome, reason?: string) {
    setBusy(true);
    setOpen(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('submissions')
      .update({ outcome: next })
      .eq('id', submissionId);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    await supabase.from('activities').insert({
      actor_id: user?.id,
      kind: 'comment',
      job_id: jobId,
      submission_id: submissionId,
      payload: {
        type: `outcome_${next}`,
        ...(reason && { reason }),
      },
    });

    setBusy(false);
    router.refresh();
  }

  function reject() {
    const reason = prompt('Reason for rejection (optional)') ?? undefined;
    setOutcome('rejected', reason || undefined);
  }

  function withdraw() {
    const reason = prompt('Reason for withdrawal (optional)') ?? undefined;
    setOutcome('withdrawn', reason || undefined);
  }

  function reopen() {
    setOutcome('open');
  }

  return (
    <div className="relative inline-flex items-center gap-2" ref={ref}>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${OUTCOME_BADGE[outcome]}`}
      >
        {outcome === 'placed' && <CheckCircle2 className="size-3 mr-1" />}
        {OUTCOME_LABEL[outcome]}
      </span>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="p-1 rounded text-muted hover:bg-slate-100"
        title="Change status"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white border border-border rounded-lg shadow-lg py-1">
          {outcome === 'open' && (
            <>
              <MenuItem onClick={reject} icon={<XCircle className="size-4 text-red-600" />}>
                Mark rejected
              </MenuItem>
              <MenuItem onClick={withdraw} icon={<UserMinus className="size-4 text-slate-600" />}>
                Mark withdrawn
              </MenuItem>
            </>
          )}
          {(outcome === 'rejected' || outcome === 'withdrawn') && (
            <MenuItem onClick={reopen} icon={<RotateCcw className="size-4 text-brand" />}>
              Reopen
            </MenuItem>
          )}
          {outcome === 'placed' && (
            <div className="px-3 py-2 text-xs text-muted">
              Placed deals can&apos;t be reopened from here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      {icon}
      {children}
    </button>
  );
}

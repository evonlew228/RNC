'use client';

import { useState } from 'react';
import { Radio, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function CoBrokeToggle({
  jobId,
  initialOpen,
  initialSplit,
  canEdit,
}: {
  jobId: string;
  initialOpen: boolean;
  initialSplit: { originator: number; submitter: number };
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [origPct, setOrigPct] = useState(initialSplit.originator);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!canEdit) return;
    setBusy(true);
    const supabase = createClient();
    const newOpen = !open;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('jobs')
      .update({
        co_broke_open: newOpen,
        default_split: newOpen ? { originator: origPct, submitter: 100 - origPct } : null,
      })
      .eq('id', jobId);

    if (!error && newOpen) {
      await supabase.from('activities').insert({
        actor_id: user?.id ?? null,
        kind: 'cobroke_opened',
        job_id: jobId,
        payload: { split: { originator: origPct, submitter: 100 - origPct } },
      });
    }
    if (!error) setOpen(newOpen);
    setBusy(false);
  }

  async function updateSplit(newOrig: number) {
    setOrigPct(newOrig);
    if (!open) return;
    const supabase = createClient();
    await supabase
      .from('jobs')
      .update({ default_split: { originator: newOrig, submitter: 100 - newOrig } })
      .eq('id', jobId);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <Radio className="size-4 text-brand" />
            Co-broke {open ? 'open' : 'closed'}
          </div>
          <p className="text-xs text-muted mt-1">
            {open
              ? 'Other consultants can submit candidates against this role.'
              : 'Only the owner can submit candidates.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={!canEdit || busy}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition border ${
            open ? 'bg-brand border-brand' : 'bg-slate-200 border-slate-300'
          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 inline-block size-5 rounded-full bg-white shadow transition ${
              open ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs text-muted mb-2">Default split</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-700">Originator</span>
            <input
              type="number"
              min={0}
              max={100}
              value={origPct}
              disabled={!canEdit}
              onChange={(e) => updateSplit(Number(e.target.value))}
              className="w-16 px-2 py-1 text-sm border border-border rounded text-right"
            />
            <span className="text-slate-700">% / {100 - origPct}% submitter</span>
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted">
          <Lock className="size-3" />
          Only the job owner can change co-broke settings.
        </div>
      )}
    </div>
  );
}

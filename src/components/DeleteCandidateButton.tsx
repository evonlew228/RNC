'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function DeleteCandidateButton({
  candidateId,
  candidateName,
  variant = 'button',
  redirectAfter,
}: {
  candidateId: string;
  candidateName: string;
  variant?: 'button' | 'icon';
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Best-effort: clean up storage object if it lives in our bucket
    const { data: candidate } = await supabase
      .from('candidates')
      .select('resume_url')
      .eq('id', candidateId)
      .single();
    const resumeUrl = candidate?.resume_url;
    if (resumeUrl?.includes('/candidate-resumes/')) {
      const path = resumeUrl.split('/candidate-resumes/')[1]?.split('?')[0];
      if (path) {
        await supabase.storage.from('candidate-resumes').remove([path]);
      }
    }

    const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setOpen(false);
    setBusy(false);
    if (redirectAfter) {
      router.push(redirectAfter);
    }
    router.refresh();
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="p-1.5 rounded text-muted hover:text-red-600 hover:bg-red-50 transition"
          title="Delete candidate"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-slate-700 hover:border-red-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-start gap-3 border-b border-border">
              <div className="size-9 rounded-full bg-red-100 grid place-items-center shrink-0">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Delete candidate?</h3>
                <p className="text-sm text-muted mt-1">
                  <span className="font-medium text-slate-900">{candidateName}</span> and all related
                  submissions, skill tags, and resume file will be permanently removed. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-muted hover:text-slate-900"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-5 py-3 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-border text-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>

            {error && <p className="px-5 pb-4 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

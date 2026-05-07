'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Candidate } from '@/lib/supabase/types';
import { ResumeUploader } from './ResumeUploader';

export function EditCandidateDialog({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: candidate.full_name,
    current_title: candidate.current_title ?? '',
    current_employer: candidate.current_employer ?? '',
    email: candidate.email ?? '',
    phone: candidate.phone ?? '',
    resume_url: candidate.resume_url ?? '',
    notes: candidate.notes ?? '',
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase
      .from('candidates')
      .update({
        full_name: form.full_name,
        current_title: form.current_title || null,
        current_employer: form.current_employer || null,
        email: form.email || null,
        phone: form.phone || null,
        resume_url: form.resume_url || null,
        notes: form.notes || null,
      })
      .eq('id', candidate.id);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-slate-700 hover:border-brand hover:text-brand-ink"
      >
        <Pencil className="size-3.5" />
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Edit candidate</h3>
                <p className="text-xs text-muted mt-0.5">{candidate.full_name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-slate-900">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={save} className="flex-1 overflow-auto p-5 space-y-3">
              <Field label="Full name" required>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Current title">
                  <input
                    value={form.current_title}
                    onChange={(e) => setForm({ ...form, current_title: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
                <Field label="Current employer">
                  <input
                    value={form.current_employer}
                    onChange={(e) => setForm({ ...form, current_employer: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg"
                  />
                </Field>
              </div>

              <Field label="Resume">
                <ResumeUploader
                  value={form.resume_url}
                  onChange={(url) => setForm({ ...form, resume_url: url })}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Background, salary expectations, availability, etc."
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </Field>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-border -mx-5 px-5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-border text-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-ink disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </label>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Client, Profile } from '@/lib/supabase/types';
import { ROLE_LABELS } from '@/lib/supabase/types';

const SEGMENTS = [
  'Hospital',
  'Public Hospital',
  'Specialist Centre',
  'Clinic',
  'Healthcare Group',
];

const DISTRICTS = [
  'Orchard', 'Marina Bay', 'Katong', 'Outram', 'Kent Ridge', 'Tanglin',
  'Novena', 'Bishan', 'Sengkang', 'Punggol', 'Woodlands', 'Jurong East', 'Tampines',
];

export function EditClientDialog({ client }: { client: Client }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: client.name,
    industry_segment: client.industry_segment ?? SEGMENTS[0],
    district: client.district ?? DISTRICTS[0],
    kam_id: client.kam_id ?? '',
    notes: client.notes ?? '',
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('profiles').select('*').order('full_name');
      setProfiles((data ?? []) as Profile[]);
    })();
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('clients')
      .update({
        name: form.name,
        industry_segment: form.industry_segment || null,
        district: form.district || null,
        kam_id: form.kam_id || null,
        notes: form.notes || null,
      })
      .eq('id', client.id);

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
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Edit client</h3>
                <p className="text-xs text-muted mt-0.5">{client.name}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-slate-900">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={save} className="p-5 space-y-3">
              <Field label="Client name" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Segment">
                  <select
                    value={form.industry_segment}
                    onChange={(e) => setForm({ ...form, industry_segment: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white"
                  >
                    {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="District">
                  <select
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white"
                  >
                    {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Key Account Manager">
                <select
                  value={form.kam_id}
                  onChange={(e) => setForm({ ...form, kam_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-white"
                >
                  <option value="">— Unassigned —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} — {ROLE_LABELS[p.role]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Background, fee terms, decision-makers, etc."
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

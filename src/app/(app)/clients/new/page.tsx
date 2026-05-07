'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import type { Profile } from '@/lib/supabase/types';
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

export default function NewClientPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    name: '',
    industry_segment: SEGMENTS[0],
    district: DISTRICTS[0],
    kam_id: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('profiles').select('*').order('full_name');
      const list = (data ?? []) as Profile[];
      setProfiles(list);
      const myProfile = list.find((p) => p.id === user?.id) ?? null;
      setMe(myProfile);
      if (myProfile && (myProfile.role === 'kam' || myProfile.role === 'director')) {
        setForm((f) => ({ ...f, kam_id: myProfile.id }));
      } else if (list.length > 0) {
        setForm((f) => ({ ...f, kam_id: list.find((p) => p.role === 'kam')?.id ?? list[0].id }));
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: form.name,
        industry_segment: form.industry_segment,
        district: form.district,
        kam_id: form.kam_id || null,
        notes: form.notes || null,
      })
      .select()
      .single();

    if (error) {
      alert('Failed: ' + error.message);
      setBusy(false);
      return;
    }
    router.push(`/clients/${data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader title="New client" subtitle="Add a hospital, clinic, or healthcare group." />
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={submit} className="max-w-2xl bg-white border border-border rounded-xl p-6 space-y-4">
          <Field label="Client name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Mount Elizabeth Medical Centre"
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
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
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {ROLE_LABELS[p.role]}
                </option>
              ))}
            </select>
            {me && me.role === 'bd' && (
              <p className="text-xs text-muted mt-1">BD consultants typically don&apos;t own accounts — defaulting to a KAM.</p>
            )}
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg"
              placeholder="Background, fee terms, decision-makers, etc."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-border text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-brand text-white font-medium hover:bg-brand-ink disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/PageHeader';

interface ClientOption {
  id: string;
  name: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    role_type: '',
    jd_summary: '',
    criteria: '',
    annual_package_sgd: 80000,
    fee_pct: 15, // firm-wide standard: 15% of annual salary
    co_broke_open: true,
    originator_pct: 60,
  });
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('clients').select('id, name').order('name');
      setClients((data ?? []) as ClientOption[]);
      if (data && data.length > 0) {
        setForm((f) => ({ ...f, client_id: f.client_id || data[0].id }));
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let jdUrl: string | null = null;
    if (jdFile) {
      const safeName = jdFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `jd/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('job-attachments')
        .upload(path, jdFile, { upsert: false });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}. Did you run migration 0003?`);
        setBusy(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('job-attachments').getPublicUrl(path);
      jdUrl = urlData.publicUrl;
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        client_id: form.client_id,
        title: form.title,
        role_type: form.role_type || null,
        jd_summary: form.jd_summary || null,
        criteria: form.criteria || null,
        jd_url: jdUrl,
        annual_package_sgd: form.annual_package_sgd,
        fee_pct: form.fee_pct,
        owner_id: user?.id,
        co_broke_open: form.co_broke_open,
        default_split: form.co_broke_open
          ? { originator: form.originator_pct, submitter: 100 - form.originator_pct }
          : null,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    await supabase.from('activities').insert([
      { actor_id: user?.id, kind: 'job_created', job_id: job.id, payload: { title: form.title } },
      ...(form.co_broke_open
        ? [{
            actor_id: user?.id,
            kind: 'cobroke_opened',
            job_id: job.id,
            payload: { split: { originator: form.originator_pct, submitter: 100 - form.originator_pct } },
          }]
        : []),
    ]);

    router.push(`/jobs/${job.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader title="New job" subtitle="Create a vacancy and (optionally) open it for co-broke." />
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={submit} className="max-w-2xl bg-white border border-border rounded-xl p-6 space-y-4">
          <Field label="Client" required>
            <select
              required
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Title" required>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Senior Radiographer (MRI)"
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
          </Field>

          <Field label="Role type">
            <input
              value={form.role_type}
              onChange={(e) => setForm({ ...form, role_type: e.target.value })}
              placeholder="e.g. Radiographer"
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
          </Field>

          <Field label="JD summary">
            <textarea
              value={form.jd_summary}
              onChange={(e) => setForm({ ...form, jd_summary: e.target.value })}
              rows={3}
              placeholder="Short description of the role and team"
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
          </Field>

          <Field label="Hiring criteria">
            <textarea
              value={form.criteria}
              onChange={(e) => setForm({ ...form, criteria: e.target.value })}
              rows={4}
              placeholder="One per line, e.g.&#10;• 5+ years post-registration&#10;• MRI certification required&#10;• Available within 60 days"
              className="w-full px-3 py-2 border border-border rounded-lg font-mono text-sm"
            />
          </Field>

          <Field label="Job description file (PDF / DOC)">
            <FileDropzone file={jdFile} onChange={setJdFile} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Annual package (SGD)">
              <input
                type="number"
                value={form.annual_package_sgd}
                onChange={(e) => setForm({ ...form, annual_package_sgd: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </Field>
            <Field label="Fee %">
              <input
                type="number"
                value={form.fee_pct}
                step="0.5"
                onChange={(e) => setForm({ ...form, fee_pct: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </Field>
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <input
                type="checkbox"
                checked={form.co_broke_open}
                onChange={(e) => setForm({ ...form, co_broke_open: e.target.checked })}
              />
              Open this role for co-broke
            </label>
            {form.co_broke_open && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-slate-700">Originator</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.originator_pct}
                  onChange={(e) => setForm({ ...form, originator_pct: Number(e.target.value) })}
                  className="w-16 px-2 py-1 border border-border rounded text-right"
                />
                <span className="text-slate-700">% / {100 - form.originator_pct}% submitter</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

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
              {busy ? 'Creating…' : 'Create job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FileDropzone({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-5 text-brand shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
            <div className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1 text-muted hover:text-red-600"
          title="Remove"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-brand hover:bg-brand-soft/20 transition">
      <Upload className="size-6 text-muted" />
      <div className="text-sm text-muted">
        <span className="text-brand font-medium">Click to upload</span> or drag & drop
      </div>
      <div className="text-xs text-muted">PDF, DOC, DOCX up to 10MB</div>
      <input
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
        }}
        className="hidden"
      />
    </label>
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

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { Building2, Plus } from 'lucide-react';

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id, name, industry_segment, district,
      kam:profiles!clients_kam_id_fkey(full_name),
      jobs(id, status)
    `)
    .order('name');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="Clients"
        subtitle="Hospitals, clinics, and specialist centres."
        actions={
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-ink"
          >
            <Plus className="size-4" />
            New client
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {(clients ?? []).map((c) => {
            const kam = c.kam as unknown as { full_name: string } | null;
            const jobs = (c.jobs ?? []) as unknown as { id: string; status: string }[];
            const openJobs = jobs.filter((j) => j.status === 'open').length;
            return (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="bg-white border border-border rounded-xl p-5 hover:border-brand transition"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-brand-soft text-brand-ink grid place-items-center">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 truncate">{c.name}</div>
                    <div className="text-xs text-muted">{c.industry_segment} · {c.district}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted">KAM</div>
                    <div className="text-slate-900">{kam?.full_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Open roles</div>
                    <div className="text-slate-900">{openJobs}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

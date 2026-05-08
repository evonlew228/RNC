import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ContactsSection } from '@/components/ContactsSection';
import { EditClientDialog } from '@/components/EditClientDialog';
import { feeFromJob, formatSGD } from '@/lib/format';
import type { Client, Contact } from '@/lib/supabase/types';

export default async function ClientDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from('clients')
    .select(`
      *,
      kam:profiles!clients_kam_id_fkey(full_name)
    `)
    .eq('id', id)
    .single();
  if (!client) notFound();

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, role_type, status, annual_package_sgd, fee_pct, co_broke_open, submissions(id)')
    .eq('client_id', id);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('client_id', id)
    .order('full_name');

  const kam = client.kam as unknown as { full_name: string } | null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={client.name}
        subtitle={`${client.industry_segment} · ${client.district} · KAM: ${kam?.full_name ?? '—'}`}
        actions={<EditClientDialog client={client as Client} />}
      />
      <div className="flex-1 overflow-auto p-6 grid grid-cols-3 gap-6 max-w-6xl">
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-slate-900">Open jobs ({jobs?.length ?? 0})</h2>
              <Link
                href={`/jobs/new?client=${client.id}` as never}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-ink"
              >
                <Plus className="size-3.5" />
                Add job
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {(jobs ?? []).map((j) => {
                const subs = (j.submissions ?? []) as unknown as { id: string }[];
                return (
                  <li key={j.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {j.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {formatSGD(j.annual_package_sgd, { compact: true })} · {subs.length} submissions
                        {j.co_broke_open && <> · <span className="text-brand">co-broke open</span></>}
                      </div>
                    </div>
                    <div className="text-sm text-slate-700 font-medium">
                      {formatSGD(feeFromJob(j.annual_package_sgd, j.fee_pct), { compact: true })}
                    </div>
                  </li>
                );
              })}
              {(!jobs || jobs.length === 0) && (
                <li className="py-6 text-sm text-muted text-center">
                  No open jobs.{' '}
                  <Link href={`/jobs/new?client=${client.id}` as never} className="text-brand hover:underline">
                    Add the first one →
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {client.notes && (
            <div className="bg-white border border-border rounded-xl p-5">
              <h2 className="font-medium text-slate-900 mb-3">Notes</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{client.notes}</p>
            </div>
          )}
        </div>

        <div className="col-span-1 space-y-4">
          <ContactsSection
            clientId={client.id}
            clientName={client.name}
            initialContacts={(contacts ?? []) as Contact[]}
          />
        </div>
      </div>
    </div>
  );
}

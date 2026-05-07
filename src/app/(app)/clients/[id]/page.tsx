import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { ContactsSection } from '@/components/ContactsSection';
import { feeFromJob, formatSGD } from '@/lib/format';
import type { Contact } from '@/lib/supabase/types';

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
      />
      <div className="flex-1 overflow-auto p-6 grid grid-cols-3 gap-6 max-w-6xl">
        <div className="col-span-2 space-y-4">
          <Section title={`Open jobs (${jobs?.length ?? 0})`}>
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
                <li className="py-6 text-sm text-muted text-center">No open jobs.</li>
              )}
            </ul>
          </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <h2 className="font-medium text-slate-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

import Link from 'next/link';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { Building2, Plus, Lock } from 'lucide-react';

type OwnerFilter = 'all' | 'me';

interface ClientRow {
  id: string;
  name: string;
  industry_segment: string | null;
  district: string | null;
  kam_id: string | null;
  kam: { full_name: string } | null;
  jobs: { id: string; status: string }[];
}

export default async function ClientsPage(props: {
  searchParams: Promise<{ owner?: OwnerFilter }>;
}) {
  const sp = await props.searchParams;
  const filter: OwnerFilter = sp.owner === 'me' ? 'me' : 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id, name, industry_segment, district, kam_id,
      kam:profiles!clients_kam_id_fkey(full_name),
      jobs(id, status)
    `)
    .order('name');

  const all = (clients ?? []) as unknown as ClientRow[];
  const mineCount = all.filter((c) => c.kam_id === user?.id).length;
  const filtered = filter === 'me' ? all.filter((c) => c.kam_id === user?.id) : all;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="Clients"
        subtitle={
          filter === 'me'
            ? `Your portfolio · ${filtered.length} accounts`
            : `${all.length} accounts firm-wide · ${mineCount} owned by you`
        }
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
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Owner filter tabs */}
        <div className="flex items-center gap-2">
          <FilterTab
            href="/clients"
            active={filter === 'all'}
            label="All clients"
            count={all.length}
            tooltip="Every client across the firm. View-only unless you're the KAM owner."
          />
          <FilterTab
            href="/clients?owner=me"
            active={filter === 'me'}
            label="Mine"
            count={mineCount}
            tooltip="Clients where you are the assigned KAM."
          />
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3" />
            Only the KAM owner can edit terms or contacts.
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center text-sm text-muted">
            {filter === 'me'
              ? 'No accounts assigned to you yet. Create one with "+ New client" to start your portfolio.'
              : 'No clients yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((c) => {
              const jobs = c.jobs ?? [];
              const openJobs = jobs.filter((j) => j.status === 'open').length;
              const isMine = c.kam_id === user?.id;
              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className={clsx(
                    'bg-white border rounded-xl p-5 hover:border-brand transition',
                    isMine ? 'border-brand/40' : 'border-border'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-brand-soft text-brand-ink grid place-items-center">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 truncate">{c.name}</div>
                      <div className="text-xs text-muted">{c.industry_segment} · {c.district}</div>
                    </div>
                    {isMine && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-soft text-brand-ink font-medium shrink-0">
                        Yours
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted">KAM</div>
                      <div className="text-slate-900">{c.kam?.full_name ?? '—'}</div>
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
        )}
      </div>
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
  tooltip,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tooltip?: string;
}) {
  return (
    <Link
      href={href}
      title={tooltip}
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition border',
        active
          ? 'bg-brand-soft border-brand text-brand-ink font-medium'
          : 'border-transparent text-slate-700 hover:bg-slate-100'
      )}
    >
      {label}
      <span
        className={clsx(
          'text-xs px-1.5 py-0.5 rounded',
          active ? 'bg-white text-brand-ink' : 'bg-slate-200 text-slate-700'
        )}
      >
        {count}
      </span>
    </Link>
  );
}

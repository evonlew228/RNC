import Link from 'next/link';
import { Radio, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { feeFromJob, formatSGD } from '@/lib/format';

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id, title, role_type, annual_package_sgd, fee_pct, co_broke_open, status,
      client:clients(name),
      owner:profiles!jobs_owner_id_fkey(full_name),
      submissions(id, stage)
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="Jobs"
        subtitle="Open vacancies across all accounts."
        actions={
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-ink"
          >
            <Plus className="size-4" />
            New job
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Submissions</th>
                <th className="px-4 py-3 font-medium">Co-broke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(jobs ?? []).map((j) => {
                const client = j.client as unknown as { name: string } | null;
                const owner = j.owner as unknown as { full_name: string } | null;
                const submissions = (j.submissions ?? []) as unknown as { id: string; stage: string }[];
                return (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {j.title}
                      </Link>
                      <div className="text-xs text-muted">{j.role_type}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{client?.name}</td>
                    <td className="px-4 py-3 text-slate-700">{owner?.full_name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatSGD(j.annual_package_sgd, { compact: true })}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatSGD(feeFromJob(j.annual_package_sgd, j.fee_pct), { compact: true })}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{submissions.length}</td>
                    <td className="px-4 py-3">
                      {j.co_broke_open ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-brand-soft text-brand-ink font-medium">
                          <Radio className="size-3" />
                          Open
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

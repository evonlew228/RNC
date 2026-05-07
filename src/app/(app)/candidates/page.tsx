import Link from 'next/link';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { DeleteCandidateButton } from '@/components/DeleteCandidateButton';
import { initials } from '@/lib/format';

type Status = 'active' | 'placed' | 'dormant';
type Filter = 'all' | 'active' | 'placed';

interface CandidateRow {
  id: string;
  full_name: string;
  current_title: string | null;
  current_employer: string | null;
  candidate_skills: { skill: { name: string } }[];
  submissions: { id: string; outcome: string }[];
}

function deriveStatus(c: CandidateRow): Status {
  const subs = c.submissions ?? [];
  if (subs.some((s) => s.outcome === 'open')) return 'active';
  if (subs.some((s) => s.outcome === 'placed')) return 'placed';
  return 'dormant';
}

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-blue-100 text-blue-800' },
  placed: { label: 'Placed', cls: 'bg-emerald-100 text-emerald-800' },
  dormant: { label: 'Dormant', cls: 'bg-slate-100 text-slate-600' },
};

export default async function CandidatesPage(props: {
  searchParams: Promise<{ status?: Filter }>;
}) {
  const { status: filter = 'all' } = await props.searchParams;
  const supabase = await createClient();
  const { data: candidates } = await supabase
    .from('candidates')
    .select(`
      id, full_name, current_title, current_employer,
      candidate_skills(skill:skills(name)),
      submissions(id, outcome)
    `)
    .order('created_at', { ascending: false });

  const all = (candidates ?? []) as unknown as CandidateRow[];
  const counts = {
    all: all.length,
    active: all.filter((c) => deriveStatus(c) === 'active').length,
    placed: all.filter((c) => deriveStatus(c) === 'placed').length,
  };
  const filtered = filter === 'all' ? all : all.filter((c) => deriveStatus(c) === filter);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="Candidates"
        subtitle={`${all.length} in the talent pool · ${counts.active} active · ${counts.placed} placed`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FilterTab href="/candidates" active={filter === 'all'} label="All" count={counts.all} />
          <FilterTab href="/candidates?status=active" active={filter === 'active'} label="Active" count={counts.active} />
          <FilterTab href="/candidates?status=placed" active={filter === 'placed'} label="Placed" count={counts.placed} />
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Current role</th>
                <th className="px-4 py-3 font-medium">Skills</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Subs</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const skills = c.candidate_skills ?? [];
                const subs = c.submissions ?? [];
                const status = deriveStatus(c);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/candidates/${c.id}`} className="flex items-center gap-3 hover:text-brand">
                        <div className="size-7 rounded-full bg-slate-200 grid place-items-center text-[11px] font-semibold text-slate-700">
                          {initials(c.full_name)}
                        </div>
                        <span className="font-medium text-slate-900">{c.full_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{c.current_title}</div>
                      <div className="text-xs text-muted">{c.current_employer}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                            {s.skill.name}
                          </span>
                        ))}
                        {skills.length > 4 && (
                          <span className="text-[11px] text-muted">+{skills.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', badge.cls)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{subs.length}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteCandidateButton
                        candidateId={c.id}
                        candidateName={c.full_name}
                        variant="icon"
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                    No candidates in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
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

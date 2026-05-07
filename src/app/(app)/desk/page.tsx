import Link from 'next/link';
import { ArrowRight, AlertCircle, Trophy, Users, Briefcase, Radio, CheckCircle2, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { StageBadge } from '@/components/StageBadge';
import { consultantCommission, feeFromJob, formatSGD, timeAgo } from '@/lib/format';
import type { PipelineStage, UserRole } from '@/lib/supabase/types';
import { ROLE_LABELS } from '@/lib/supabase/types';

const STAGE_WEIGHT: Record<PipelineStage, number> = {
  new_lead: 0.1,
  screening: 0.3,
  negotiation: 0.6,
  closure: 0.95,
};

export default async function DeskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  if (!profile) return null;
  const role = profile.role as UserRole;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={`Welcome back, ${profile.full_name.split(' ')[0]}`}
        subtitle={`${ROLE_LABELS[role]} · here's what's on your desk today.`}
      />
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-7xl">
        {role === 'director' && <DirectorDesk />}
        {role === 'kam' && <KamDesk userId={profile.id} />}
        {role === 'bd' && <BdDesk userId={profile.id} />}
      </div>
    </div>
  );
}

// ============================================================
// Director Desk
// ============================================================
async function DirectorDesk() {
  const supabase = await createClient();
  const [{ data: jobs }, { data: submissions }, { data: profiles }, { data: splits }] = await Promise.all([
    supabase.from('jobs').select('id, status, co_broke_open, annual_package_sgd, fee_pct, owner_id'),
    supabase.from('submissions').select('id, stage, outcome, submitting_consultant_id, updated_at, job:jobs(id, annual_package_sgd, fee_pct, title, client:clients(name))'),
    supabase.from('profiles').select('id, full_name, role'),
    supabase.from('splits').select('consultant_id, pct, submission:submissions(outcome, job:jobs(annual_package_sgd, fee_pct))'),
  ]);

  const openJobs = (jobs ?? []).filter((j) => j.status === 'open');
  const placedThisMonth = (submissions ?? []).filter((s) => {
    if (s.outcome !== 'placed') return false;
    const monthAgo = Date.now() - 30 * 86400000;
    return new Date(s.updated_at).getTime() > monthAgo;
  });

  const weightedFees = (submissions ?? []).reduce((sum, s) => {
    if (s.outcome !== 'open' && s.outcome !== 'placed') return sum;
    const j = s.job as unknown as { annual_package_sgd: number | null; fee_pct: number };
    return sum + feeFromJob(j?.annual_package_sgd ?? 0, j?.fee_pct ?? 0) * (STAGE_WEIGHT[s.stage as PipelineStage] ?? 0);
  }, 0);

  // Top performers (by # submissions in last 30 days)
  const profileMap = new Map<string, string>();
  for (const p of profiles ?? []) profileMap.set(p.id, p.full_name);
  const submissionCounts = new Map<string, number>();
  const cutoff = Date.now() - 30 * 86400000;
  for (const s of submissions ?? []) {
    if (new Date(s.updated_at).getTime() < cutoff) continue;
    submissionCounts.set(s.submitting_consultant_id, (submissionCounts.get(s.submitting_consultant_id) ?? 0) + 1);
  }
  const topPerformers = Array.from(submissionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Stale submissions (no movement in 7+ days, still in flight)
  const staleCutoff = Date.now() - 7 * 86400000;
  const stale = (submissions ?? [])
    .filter((s) => s.outcome === 'open' && s.stage !== 'closure' && new Date(s.updated_at).getTime() < staleCutoff)
    .slice(0, 5);

  // Earnings per consultant (from placed splits)
  const earnings = new Map<string, number>();
  for (const sp of splits ?? []) {
    const sub = sp.submission as unknown as { outcome: string; job: { annual_package_sgd: number | null; fee_pct: number } } | null;
    if (sub?.outcome !== 'placed') continue;
    const fee = feeFromJob(sub.job.annual_package_sgd, sub.job.fee_pct);
    earnings.set(sp.consultant_id, (earnings.get(sp.consultant_id) ?? 0) + consultantCommission(fee, Number(sp.pct)));
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi icon={Briefcase} label="Open roles" value={openJobs.length.toString()} hint={`${openJobs.filter((j) => j.co_broke_open).length} co-broke`} />
        <Kpi icon={Wallet} label="Weighted fees in flight" value={formatSGD(weightedFees, { compact: true })} hint="Probability-weighted" />
        <Kpi icon={CheckCircle2} label="Placed this month" value={placedThisMonth.length.toString()} hint="Last 30 days" />
        <Kpi icon={Users} label="Active submissions" value={(submissions?.length ?? 0).toString()} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Top performers (last 30 days)" icon={Trophy}>
          {topPerformers.length === 0 ? (
            <Empty text="No activity yet." />
          ) : (
            <ul className="space-y-2">
              {topPerformers.map(([id, count], i) => (
                <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="size-7 rounded-full bg-amber-100 text-amber-800 grid place-items-center text-xs font-bold">{i + 1}</div>
                    <span className="font-medium text-slate-900">{profileMap.get(id) ?? '—'}</span>
                  </div>
                  <div className="text-sm text-muted">
                    {count} submissions
                    {earnings.get(id) ? <span className="ml-2 text-emerald-700 font-medium">{formatSGD(earnings.get(id)!, { compact: true })}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Needs attention — stale submissions" icon={AlertCircle} accent="amber">
          {stale.length === 0 ? (
            <Empty text="Nothing stale 🎉" />
          ) : (
            <ul className="divide-y divide-border">
              {stale.map((s) => {
                const job = s.job as unknown as { id: string; title: string; client: { name: string } };
                return (
                  <li key={s.id} className="py-2.5">
                    <Link href={`/jobs/${job.id}`} className="block hover:bg-slate-50 -mx-2 px-2 py-1 rounded">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{job.title}</div>
                          <div className="text-xs text-muted">
                            {job.client.name} · last updated {timeAgo(s.updated_at)}
                          </div>
                        </div>
                        <StageBadge stage={s.stage} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Quick links">
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/dashboard">Full dashboard</QuickLink>
          <QuickLink href="/pipeline">Pipeline board</QuickLink>
          <QuickLink href="/feed">Activity feed</QuickLink>
          <QuickLink href="/clients">Clients</QuickLink>
        </div>
      </Card>
    </>
  );
}

// ============================================================
// KAM Desk
// ============================================================
async function KamDesk({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [
    { data: clients },
    { data: jobs },
    { data: mySubs },
    { data: cobrokeSubs },
    { data: mySplits },
    { data: openCobrokeJobs },
  ] = await Promise.all([
    supabase.from('clients').select('id, name, industry_segment, jobs(id, status), contacts(id)').eq('kam_id', userId),
    supabase.from('jobs').select('id, title, status, co_broke_open, annual_package_sgd, fee_pct, client:clients(name), submissions(id, stage, outcome)').eq('owner_id', userId),
    supabase.from('submissions').select('id, stage, outcome, updated_at, job:jobs(id, title, annual_package_sgd, fee_pct, client:clients(name)), candidate:candidates(full_name)').eq('submitting_consultant_id', userId),
    // Co-broke contributions to MY jobs from others
    supabase.from('submissions').select('id, stage, outcome, updated_at, submitting_consultant_id, submitter:profiles!submissions_submitting_consultant_id_fkey(full_name), job:jobs!inner(id, title, owner_id, client:clients(name)), candidate:candidates(full_name)').eq('job.owner_id', userId).neq('submitting_consultant_id', userId),
    supabase.from('splits').select('pct, submission:submissions!inner(outcome, job:jobs(annual_package_sgd, fee_pct))').eq('consultant_id', userId),
    // Co-broke jobs I could contribute to (not mine, not yet submitted to)
    supabase.from('jobs')
      .select('id, title, role_type, annual_package_sgd, fee_pct, default_split, owner:profiles!jobs_owner_id_fkey(full_name), client:clients(name), submissions(submitting_consultant_id), created_at')
      .eq('co_broke_open', true)
      .eq('status', 'open')
      .neq('owner_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  // Filter out jobs I've already submitted to; cap at 5
  const availableCobroke = (openCobrokeJobs ?? []).filter((j) => {
    const subs = (j.submissions ?? []) as unknown as { submitting_consultant_id: string }[];
    return !subs.some((s) => s.submitting_consultant_id === userId);
  }).slice(0, 5);

  const myJobs = jobs ?? [];
  const openJobs = myJobs.filter((j) => j.status === 'open');
  const myWeightedFees = (mySubs ?? []).reduce((sum, s) => {
    if (s.outcome !== 'open' && s.outcome !== 'placed') return sum;
    const j = s.job as unknown as { annual_package_sgd: number | null; fee_pct: number };
    return sum + feeFromJob(j?.annual_package_sgd ?? 0, j?.fee_pct ?? 0) * (STAGE_WEIGHT[s.stage as PipelineStage] ?? 0);
  }, 0);

  const earnedFees = (mySplits ?? []).reduce((sum, sp) => {
    const sub = sp.submission as unknown as { outcome: string; job: { annual_package_sgd: number | null; fee_pct: number } } | null;
    if (sub?.outcome !== 'placed') return sum;
    return sum + consultantCommission(feeFromJob(sub.job.annual_package_sgd, sub.job.fee_pct), Number(sp.pct));
  }, 0);

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi icon={Users} label="My clients" value={(clients?.length ?? 0).toString()} hint={`${openJobs.length} open roles`} />
        <Kpi icon={Briefcase} label="My open jobs" value={openJobs.length.toString()} hint={`${openJobs.filter((j) => j.co_broke_open).length} open for co-broke`} />
        <Kpi icon={Wallet} label="Weighted fees in flight" value={formatSGD(myWeightedFees, { compact: true })} hint="My pipeline" />
        <Kpi icon={CheckCircle2} label="My commission earned" value={formatSGD(earnedFees, { compact: true })} hint="Click to view ledger" href="/earnings" />
      </div>

      <Card title={`Available co-broke opportunities (${availableCobroke.length})`} icon={Radio} accent="brand">
        {availableCobroke.length === 0 ? (
          <Empty text="No co-broke opportunities right now — you've contributed to (or own) every open one." />
        ) : (
          <ul className="divide-y divide-border">
            {availableCobroke.map((j) => {
              const client = j.client as unknown as { name: string };
              const owner = j.owner as unknown as { full_name: string } | null;
              const split = j.default_split as { originator: number; submitter: number } | null;
              const fee = feeFromJob(j.annual_package_sgd, j.fee_pct);
              const myShare = split ? consultantCommission(fee, split.submitter) : 0;
              return (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="block py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{j.title}</div>
                        <div className="text-xs text-muted truncate">
                          {client.name} · {j.role_type}
                          {owner && <> · owned by {owner.full_name.split(' ')[0]}</>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium text-emerald-700">
                          Up to {formatSGD(myShare, { compact: true })}
                        </div>
                        {split && (
                          <div className="text-[11px] text-muted">at {split.submitter}% submitter share</div>
                        )}
                      </div>
                      <ArrowRight className="size-4 text-muted shrink-0" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`My clients (${clients?.length ?? 0})`} icon={Users}>
          {!clients || clients.length === 0 ? (
            <Empty text="No accounts assigned." />
          ) : (
            <ul className="divide-y divide-border">
              {clients.map((c) => {
                const cJobs = (c.jobs ?? []) as unknown as { id: string; status: string }[];
                const contacts = (c.contacts ?? []) as unknown as { id: string }[];
                return (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="block py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{c.name}</div>
                          <div className="text-xs text-muted">{c.industry_segment}</div>
                        </div>
                        <div className="text-xs text-muted text-right">
                          {cJobs.filter((j) => j.status === 'open').length} open · {contacts.length} contacts
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Co-broke contributions to my jobs" icon={Radio} accent="brand">
          {!cobrokeSubs || cobrokeSubs.length === 0 ? (
            <Empty text="No co-broke contributions yet. Open more jobs for co-broke to invite contributions." />
          ) : (
            <ul className="divide-y divide-border">
              {cobrokeSubs.slice(0, 5).map((s) => {
                const job = s.job as unknown as { id: string; title: string; client: { name: string } };
                const cand = s.candidate as unknown as { full_name: string };
                const sub = s.submitter as unknown as { full_name: string };
                return (
                  <li key={s.id}>
                    <Link href={`/jobs/${job.id}`} className="block py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{cand.full_name}</div>
                          <div className="text-xs text-muted truncate">
                            {job.title} · via {sub.full_name.split(' ')[0]}
                          </div>
                        </div>
                        <StageBadge stage={s.stage} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Quick links">
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/jobs/new">+ New job</QuickLink>
          <QuickLink href="/clients/new">+ New client</QuickLink>
          <QuickLink href="/pipeline">My pipeline</QuickLink>
          <QuickLink href="/clients">All clients</QuickLink>
        </div>
      </Card>
    </>
  );
}

// ============================================================
// BD Desk
// ============================================================
async function BdDesk({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: openCobrokeJobs }, { data: mySubs }, { data: mySplits }] = await Promise.all([
    supabase.from('jobs')
      .select('id, title, role_type, annual_package_sgd, fee_pct, default_split, client:clients(name), submissions(id, submitting_consultant_id)')
      .eq('co_broke_open', true)
      .eq('status', 'open'),
    supabase.from('submissions')
      .select('id, stage, outcome, updated_at, job:jobs(id, title, annual_package_sgd, fee_pct, client:clients(name)), candidate:candidates(id, full_name, current_title)')
      .eq('submitting_consultant_id', userId)
      .order('updated_at', { ascending: false }),
    supabase.from('splits').select('pct, submission:submissions!inner(outcome, job:jobs(annual_package_sgd, fee_pct))').eq('consultant_id', userId),
  ]);

  // Distinct candidates Marcus is working with (from his submissions)
  const seenCands = new Map<string, { id: string; full_name: string; current_title: string | null }>();
  for (const s of mySubs ?? []) {
    const c = s.candidate as unknown as { id: string; full_name: string; current_title: string | null } | null;
    if (c && !seenCands.has(c.id)) seenCands.set(c.id, c);
  }
  const myCands = Array.from(seenCands.values());

  // Co-broke jobs I haven't submitted to yet
  const untouched = (openCobrokeJobs ?? []).filter((j) => {
    const subs = (j.submissions ?? []) as unknown as { submitting_consultant_id: string }[];
    return !subs.some((s) => s.submitting_consultant_id === userId);
  });

  const myWeighted = (mySubs ?? []).reduce((sum, s) => {
    if (s.outcome !== 'open' && s.outcome !== 'placed') return sum;
    const j = s.job as unknown as { annual_package_sgd: number | null; fee_pct: number };
    return sum + feeFromJob(j?.annual_package_sgd ?? 0, j?.fee_pct ?? 0) * (STAGE_WEIGHT[s.stage as PipelineStage] ?? 0);
  }, 0);

  const earnedFees = (mySplits ?? []).reduce((sum, sp) => {
    const sub = sp.submission as unknown as { outcome: string; job: { annual_package_sgd: number | null; fee_pct: number } } | null;
    if (sub?.outcome !== 'placed') return sum;
    return sum + consultantCommission(feeFromJob(sub.job.annual_package_sgd, sub.job.fee_pct), Number(sp.pct));
  }, 0);

  const inNegotiation = (mySubs ?? []).filter((s) => s.stage === 'negotiation').length;

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi icon={Radio} label="Co-broke open" value={untouched.length.toString()} hint="Available for me to submit" accent="brand" />
        <Kpi icon={Users} label="My active submissions" value={(mySubs?.length ?? 0).toString()} hint={`${inNegotiation} in negotiation`} />
        <Kpi icon={Wallet} label="Weighted fees in flight" value={formatSGD(myWeighted, { compact: true })} hint="My contributions" />
        <Kpi icon={CheckCircle2} label="My commission earned" value={formatSGD(earnedFees, { compact: true })} hint="Click to view ledger" href="/earnings" />
      </div>

      <Card title={`Co-broke opportunities (${untouched.length})`} icon={Radio} accent="brand">
        {untouched.length === 0 ? (
          <Empty text="You've contributed to every open co-broke job. Nice." />
        ) : (
          <ul className="divide-y divide-border">
            {untouched.slice(0, 8).map((j) => {
              const client = j.client as unknown as { name: string };
              const split = j.default_split as { originator: number; submitter: number } | null;
              const fee = feeFromJob(j.annual_package_sgd, j.fee_pct);
              const myShare = split ? consultantCommission(fee, split.submitter) : 0;
              return (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="block py-3 hover:bg-slate-50 -mx-2 px-2 rounded">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{j.title}</div>
                        <div className="text-xs text-muted truncate">{client.name} · {j.role_type}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium text-emerald-700">
                          Up to {formatSGD(myShare, { compact: true })}
                        </div>
                        {split && (
                          <div className="text-[11px] text-muted">at {split.submitter}% submitter share</div>
                        )}
                      </div>
                      <ArrowRight className="size-4 text-muted shrink-0" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="My submissions" icon={Briefcase}>
          {!mySubs || mySubs.length === 0 ? (
            <Empty text="No submissions yet. Pick a co-broke job above." />
          ) : (
            <ul className="divide-y divide-border">
              {mySubs.slice(0, 5).map((s) => {
                const job = s.job as unknown as { id: string; title: string; client: { name: string } };
                const cand = s.candidate as unknown as { full_name: string };
                return (
                  <li key={s.id}>
                    <Link href={`/jobs/${job.id}`} className="block py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{cand.full_name}</div>
                          <div className="text-xs text-muted truncate">{job.title}</div>
                        </div>
                        <StageBadge stage={s.stage} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Candidates I'm working with (${myCands.length})`} icon={Users}>
          {myCands.length === 0 ? (
            <Empty text="No candidates yet — submit one to a co-broke job." />
          ) : (
            <ul className="divide-y divide-border">
              {myCands.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/candidates/${c.id}`} className="block py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                    <div className="font-medium text-slate-900">{c.full_name}</div>
                    <div className="text-xs text-muted">{c.current_title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// ============================================================
// Shared UI bits
// ============================================================
function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  href,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  hint?: string;
  accent?: 'brand';
  href?: string;
}) {
  const cls = `bg-white border rounded-xl p-5 ${accent === 'brand' ? 'border-brand/40 bg-brand-soft/20' : 'border-border'} ${href ? 'hover:border-brand transition cursor-pointer' : ''}`;
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </>
  );
  if (href) {
    return <Link href={href as never} className={cls}>{content}</Link>;
  }
  return <div className={cls}>{content}</div>;
}

function Card({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon?: typeof Briefcase;
  accent?: 'brand' | 'amber';
  children: React.ReactNode;
}) {
  const ring = accent === 'brand' ? 'border-brand/40' : accent === 'amber' ? 'border-amber-200' : 'border-border';
  return (
    <div className={`bg-white border ${ring} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="size-4 text-muted" />}
        <h2 className="font-medium text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-sm text-muted text-center">{text}</div>;
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg border border-border text-sm text-slate-700 hover:border-brand hover:text-brand-ink transition"
    >
      {children}
    </Link>
  );
}

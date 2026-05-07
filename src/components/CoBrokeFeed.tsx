'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, ArrowRight, FileText, Briefcase, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { timeAgo, initials } from '@/lib/format';
import { STAGE_LABELS, type PipelineStage } from '@/lib/supabase/types';

export type FeedRow = {
  id: string;
  kind: 'stage_change' | 'job_created' | 'cobroke_opened' | 'submission_created' | 'comment';
  payload: Record<string, unknown> | null;
  created_at: string;
  actor: { id: string; full_name: string; role: string } | null;
  job: { id: string; title: string; client: { name: string } } | null;
  candidate: { id: string; full_name: string; current_title: string | null } | null;
};

export function CoBrokeFeed({
  initial,
  currentUserId,
}: {
  initial: FeedRow[];
  currentUserId: string;
}) {
  const [rows, setRows] = useState<FeedRow[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        async (payload) => {
          const id = (payload.new as { id: string }).id;
          const { data } = await supabase
            .from('activities')
            .select(`
              *,
              actor:profiles!activities_actor_id_fkey(id, full_name, role),
              job:jobs(id, title, client:clients(name)),
              candidate:candidates(id, full_name, current_title)
            `)
            .eq('id', id)
            .single();
          if (data) {
            setRows((r) => [data as unknown as FeedRow, ...r].slice(0, 50));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {rows.length === 0 && (
        <div className="text-center text-muted py-12">No activity yet.</div>
      )}
      {rows.map((r) => (
        <FeedItem key={r.id} row={r} currentUserId={currentUserId} />
      ))}
    </div>
  );
}

function FeedItem({ row, currentUserId }: { row: FeedRow; currentUserId: string }) {
  const isMe = row.actor?.id === currentUserId;
  const accent =
    row.kind === 'cobroke_opened'
      ? 'border-brand bg-brand-soft/30'
      : 'bg-white border-border';

  return (
    <div className={clsx('rounded-xl border p-4 flex gap-3', accent)}>
      <div className="size-8 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-700 shrink-0">
        {row.actor ? initials(row.actor.full_name) : '·'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-900">
            {isMe ? 'You' : row.actor?.full_name ?? 'System'}
          </span>
          <Verb row={row} />
          <span className="text-xs text-muted ml-auto">{timeAgo(row.created_at)}</span>
        </div>
        <div className="mt-1.5">
          <Body row={row} />
        </div>
      </div>
    </div>
  );
}

function Verb({ row }: { row: FeedRow }) {
  const map: Record<FeedRow['kind'], { text: string; icon: React.ReactNode; color: string }> = {
    cobroke_opened: { text: 'opened a role for co-broke', icon: <Radio className="size-3.5" />, color: 'text-brand-ink' },
    job_created: { text: 'created a new job', icon: <Briefcase className="size-3.5" />, color: 'text-slate-700' },
    submission_created: { text: 'submitted a candidate', icon: <FileText className="size-3.5" />, color: 'text-slate-700' },
    stage_change: { text: 'moved a candidate', icon: <ArrowRight className="size-3.5" />, color: 'text-slate-700' },
    comment: { text: 'commented', icon: <MessageSquare className="size-3.5" />, color: 'text-slate-700' },
  };
  const v = map[row.kind];
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs', v.color)}>
      {v.icon}
      {v.text}
    </span>
  );
}

function Body({ row }: { row: FeedRow }) {
  if (row.kind === 'cobroke_opened' && row.job) {
    const split = row.payload as { split?: { originator: number; submitter: number } } | null;
    return (
      <div>
        <Link href={`/jobs/${row.job.id}`} className="font-medium text-slate-900 hover:text-brand">
          {row.job.title}
        </Link>
        <span className="text-muted text-sm"> · {row.job.client.name}</span>
        {split?.split && (
          <div className="text-xs text-muted mt-1">
            Default split: {split.split.originator}% originator / {split.split.submitter}% submitter
          </div>
        )}
      </div>
    );
  }
  if (row.kind === 'job_created' && row.job) {
    return (
      <div>
        <Link href={`/jobs/${row.job.id}`} className="font-medium text-slate-900 hover:text-brand">
          {row.job.title}
        </Link>
        <span className="text-muted text-sm"> for {row.job.client.name}</span>
      </div>
    );
  }
  if (row.kind === 'submission_created') {
    return (
      <div className="text-sm">
        {row.candidate && (
          <Link href={`/candidates/${row.candidate.id}`} className="font-medium hover:text-brand">
            {row.candidate.full_name}
          </Link>
        )}
        {row.job && (
          <>
            <span className="text-muted"> against </span>
            <Link href={`/jobs/${row.job.id}`} className="font-medium hover:text-brand">
              {row.job.title}
            </Link>
          </>
        )}
      </div>
    );
  }
  if (row.kind === 'stage_change') {
    const p = row.payload as { from?: PipelineStage; to?: PipelineStage } | null;
    return (
      <div className="text-sm">
        {row.job && (
          <Link href={`/jobs/${row.job.id}`} className="font-medium hover:text-brand">
            {row.job.title}
          </Link>
        )}
        {p?.from && p.to && (
          <span className="text-muted">
            {' '}
            from <strong className="text-slate-700">{STAGE_LABELS[p.from]}</strong> →{' '}
            <strong className="text-slate-700">{STAGE_LABELS[p.to]}</strong>
          </span>
        )}
      </div>
    );
  }
  return <div className="text-sm text-muted">—</div>;
}

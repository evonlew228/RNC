'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { Briefcase, Radio, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  type PipelineStage,
  type Profile,
  STAGE_LABELS,
  STAGE_ORDER,
} from '@/lib/supabase/types';
import { feeFromJob, formatSGD, initials } from '@/lib/format';

export type SubmissionRow = {
  id: string;
  stage: PipelineStage;
  outcome: string;
  submitting_consultant_id: string;
  expected_close_date: string | null;
  updated_at: string;
  job: {
    id: string;
    title: string;
    role_type: string | null;
    owner_id: string | null;
    co_broke_open: boolean;
    annual_package_sgd: number | null;
    fee_pct: number;
    client: { id: string; name: string };
  };
  candidate: {
    id: string;
    full_name: string;
    current_title: string | null;
    current_employer: string | null;
  };
  submitter: { id: string; full_name: string; role: string };
};

type View = 'all' | 'mine' | 'cobroke';

const STAGE_HEADER_COLOR: Record<PipelineStage, string> = {
  new_lead: 'bg-slate-50 border-slate-200',
  screening: 'bg-blue-50 border-blue-200',
  negotiation: 'bg-amber-50 border-amber-200',
  closure: 'bg-emerald-50 border-emerald-200',
};

export function PipelineBoard({
  initialSubmissions,
  currentProfile,
}: {
  initialSubmissions: SubmissionRow[];
  currentProfile: Profile;
}) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>(initialSubmissions);
  // BD lands on their own pipeline; KAM/Director see the broader view by default.
  const [view, setView] = useState<View>(currentProfile.role === 'bd' ? 'mine' : 'all');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('pipeline')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        async (payload) => {
          // Refetch the affected row with joins
          if (payload.eventType === 'DELETE') {
            setSubmissions((s) => s.filter((r) => r.id !== (payload.old as { id: string }).id));
            return;
          }
          const id = (payload.new as { id: string }).id;
          const { data } = await supabase
            .from('submissions')
            .select(`
              *,
              job:jobs(id, title, role_type, owner_id, co_broke_open, default_split, annual_package_sgd, fee_pct, client:clients(id, name)),
              candidate:candidates(id, full_name, current_title, current_employer),
              submitter:profiles!submissions_submitting_consultant_id_fkey(id, full_name, role)
            `)
            .eq('id', id)
            .single();
          if (!data) return;
          setSubmissions((s) => {
            const without = s.filter((r) => r.id !== id);
            return [data as unknown as SubmissionRow, ...without];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    // Pipeline kanban = active deals only. Placed/rejected/withdrawn drop off
    // — they live on the candidate's history and the dashboard.
    const isOpen = (s: SubmissionRow) => s.outcome === 'open';
    const isMine = (s: SubmissionRow) =>
      s.submitting_consultant_id === currentProfile.id ||
      s.job.owner_id === currentProfile.id;
    const isContributionToMine = (s: SubmissionRow) =>
      s.job.owner_id === currentProfile.id &&
      s.submitting_consultant_id !== currentProfile.id;

    const open = submissions.filter(isOpen);
    if (view === 'mine') return open.filter(isMine);
    if (view === 'cobroke') return open.filter(isContributionToMine);
    if (currentProfile.role === 'director') return open;
    return open.filter(isMine);
  }, [submissions, view, currentProfile.id, currentProfile.role]);

  const grouped = useMemo(() => {
    const g: Record<PipelineStage, SubmissionRow[]> = {
      new_lead: [],
      screening: [],
      negotiation: [],
      closure: [],
    };
    for (const s of filtered) g[s.stage].push(s);
    return g;
  }, [filtered]);

  async function moveSubmission(id: string, newStage: PipelineStage) {
    const prev = submissions;
    setSubmissions((s) =>
      s.map((row) => (row.id === id ? { ...row, stage: newStage } : row))
    );
    const supabase = createClient();
    const { error } = await supabase
      .from('submissions')
      .update({ stage: newStage })
      .eq('id', id);
    if (error) {
      console.error('move failed', error);
      setSubmissions(prev);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newStage = over.id as PipelineStage;
    const submission = submissions.find((s) => s.id === active.id);
    if (!submission || submission.stage === newStage) return;
    moveSubmission(submission.id, newStage);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
      {/* Filter tabs — role-aware */}
      <div className="px-8 pt-4 pb-2 flex items-center gap-2 bg-white border-b border-border">
        {(() => {
          const mineCount = submissions.filter(
            (s) => s.submitting_consultant_id === currentProfile.id || s.job.owner_id === currentProfile.id
          ).length;
          const cobrokeCount = submissions.filter(
            (s) => s.job.owner_id === currentProfile.id && s.submitting_consultant_id !== currentProfile.id
          ).length;

          if (currentProfile.role === 'bd') {
            // BD sees only their own pipeline here. Co-broke discovery lives in /desk and /feed.
            return (
              <>
                <ViewTab
                  active
                  onClick={() => setView('mine')}
                  label="My pipeline"
                  count={mineCount}
                />
                <span className="text-xs text-muted ml-2">
                  Looking for co-broke opportunities? Check{' '}
                  <Link href="/desk" className="text-brand hover:underline">My desk</Link>{' '}
                  or{' '}
                  <Link href="/feed" className="text-brand hover:underline">Co-broke feed</Link>.
                </span>
              </>
            );
          }

          // KAM: "All" === "Mine" since contributions to my jobs are already mine (job.owner_id matches).
          const allCount =
            currentProfile.role === 'director' ? submissions.length : mineCount;
          return (
            <>
              <ViewTab
                active={view === 'all'}
                onClick={() => setView('all')}
                label={currentProfile.role === 'director' ? 'All' : 'My pipeline'}
                count={allCount}
              />
              {currentProfile.role === 'director' && (
                <ViewTab
                  active={view === 'mine'}
                  onClick={() => setView('mine')}
                  label="My pipeline"
                  count={mineCount}
                />
              )}
              <ViewTab
                active={view === 'cobroke'}
                onClick={() => setView('cobroke')}
                label="Contributions to my jobs"
                count={cobrokeCount}
                icon={<Radio className="size-3.5" />}
              />
            </>
          );
        })()}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="grid grid-cols-4 gap-4 h-full min-w-[1100px]">
            {STAGE_ORDER.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                submissions={grouped[stage]}
                currentProfileId={currentProfile.id}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition border',
        active
          ? 'bg-brand-soft border-brand text-brand-ink font-medium'
          : 'border-transparent text-slate-700 hover:bg-slate-100'
      )}
    >
      {icon}
      {label}
      <span className={clsx('text-xs px-1.5 py-0.5 rounded', active ? 'bg-white text-brand-ink' : 'bg-slate-200 text-slate-700')}>
        {count}
      </span>
    </button>
  );
}

function Column({
  stage,
  submissions,
  currentProfileId,
}: {
  stage: PipelineStage;
  submissions: SubmissionRow[];
  currentProfileId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const totalFee = submissions.reduce(
    (sum, s) => sum + feeFromJob(s.job.annual_package_sgd, s.job.fee_pct),
    0
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={clsx('rounded-t-xl px-3 py-2 border', STAGE_HEADER_COLOR[stage])}>
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm text-slate-900">{STAGE_LABELS[stage]}</div>
          <div className="text-xs text-slate-600">{submissions.length}</div>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {formatSGD(totalFee, { compact: true })} in fees
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 min-h-0 overflow-y-auto p-2 space-y-2 rounded-b-xl border border-t-0',
          STAGE_HEADER_COLOR[stage],
          isOver && 'ring-2 ring-brand ring-inset'
        )}
      >
        {submissions.map((s) => (
          <Card key={s.id} submission={s} currentProfileId={currentProfileId} />
        ))}
        {submissions.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-8">No submissions</div>
        )}
      </div>
    </div>
  );
}

function Card({
  submission,
  currentProfileId,
}: {
  submission: SubmissionRow;
  currentProfileId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: submission.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const isCoBroke = submission.job.co_broke_open;
  const isMine = submission.submitting_consultant_id === currentProfileId;
  const fee = feeFromJob(submission.job.annual_package_sgd, submission.job.fee_pct);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'bg-white rounded-lg border border-border p-3 shadow-sm cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-60 shadow-lg'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/jobs/${submission.job.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-xs text-slate-500 hover:text-brand truncate flex items-center gap-1"
        >
          <Briefcase className="size-3 shrink-0" />
          {submission.job.client.name}
        </Link>
        {isCoBroke && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-brand-soft text-brand-ink font-medium">
            <Radio className="size-3" />
            Co-broke
          </span>
        )}
      </div>
      <div className="mt-1 font-medium text-sm text-slate-900 line-clamp-2">{submission.job.title}</div>
      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
        <Link
          href={`/candidates/${submission.candidate.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2 min-w-0 hover:underline"
        >
          <div className="size-6 rounded-full bg-slate-200 grid place-items-center text-[10px] font-semibold text-slate-700 shrink-0">
            {initials(submission.candidate.full_name)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-900 truncate">{submission.candidate.full_name}</div>
            <div className="text-[11px] text-muted truncate">{submission.candidate.current_title}</div>
          </div>
        </Link>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-1 min-w-0">
          <User className="size-3 shrink-0" />
          <span className="truncate">
            {isMine ? 'You' : submission.submitter.full_name.split(' ')[0]}
          </span>
        </div>
        <div>{formatSGD(fee, { compact: true })}</div>
      </div>
    </div>
  );
}

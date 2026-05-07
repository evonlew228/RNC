import clsx from 'clsx';
import type { PipelineStage } from '@/lib/supabase/types';
import { STAGE_LABELS } from '@/lib/supabase/types';

const STAGE_COLOR: Record<PipelineStage, string> = {
  new_lead: 'bg-slate-100 text-slate-700',
  screening: 'bg-blue-100 text-blue-800',
  negotiation: 'bg-amber-100 text-amber-800',
  closure: 'bg-emerald-100 text-emerald-800',
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', STAGE_COLOR[stage])}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

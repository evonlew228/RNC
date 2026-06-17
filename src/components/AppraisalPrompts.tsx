import { MessageSquare, TrendingUp, TrendingDown, AlertTriangle, Activity, Radio, Trophy } from 'lucide-react';
import type { AppraisalPrompt } from '@/lib/performance';

const PROMPT_STYLE: Record<AppraisalPrompt['kind'], { icon: typeof MessageSquare; color: string; bg: string; border: string }> = {
  win_rate_positive: { icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  win_rate_negative: { icon: TrendingDown, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  activity_spike: { icon: Activity, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  conversion_drop: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  stalled_pipeline: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  cobroke_drop: { icon: Radio, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  high_earner: { icon: Trophy, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

export function AppraisalPrompts({
  prompts,
  consultantName,
}: {
  prompts: AppraisalPrompt[];
  consultantName: string;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 sticky top-6">
      <div className="flex items-start gap-3 pb-4 border-b border-border">
        <div className="size-9 rounded-full bg-brand-soft text-brand-ink grid place-items-center shrink-0">
          <MessageSquare className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Appraisal conversation prompts</h2>
          <p className="text-xs text-muted mt-0.5">
            Auto-generated from {consultantName.split(' ')[0]}&apos;s scorecard.
            Use as starting points for your 1:1.
          </p>
        </div>
      </div>

      {prompts.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted">
          No notable signals this quarter. Steady-state performance — focus the conversation on growth goals.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {prompts.map((p, i) => {
            const style = PROMPT_STYLE[p.kind];
            const Icon = style.icon;
            return (
              <li
                key={i}
                className={`rounded-lg border p-3 ${style.bg} ${style.border}`}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`size-4 shrink-0 mt-0.5 ${style.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${style.color}`}>{p.headline}</div>
                    <div className="text-xs text-slate-700 mt-1 leading-relaxed">{p.supporting}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 pt-4 border-t border-border">
        <p className="text-[11px] text-muted leading-relaxed">
          These prompts are derived from the consultant&apos;s scorecard vs the prior quarter and firm-wide averages.
          Use them to ground the conversation in evidence, not opinion.
        </p>
      </div>
    </div>
  );
}

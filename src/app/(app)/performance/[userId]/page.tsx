import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { PerformanceScorecard } from '@/components/PerformanceScorecard';
import { AppraisalPrompts } from '@/components/AppraisalPrompts';
import { loadPerformanceDataset } from '@/lib/performance-loader';
import {
  quarterRange, priorQuarter, currentQuarter, computeScorecard, computeFirmAverages,
  generatePrompts, type QuarterKey,
} from '@/lib/performance';
import { ROLE_LABELS } from '@/lib/supabase/types';

export default async function ConsultantPerformancePage(props: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ q?: string; y?: string }>;
}) {
  const { userId } = await props.params;
  const sp = await props.searchParams;
  const qKey = (['q1', 'q2', 'q3', 'q4', 'last12w'].includes(sp.q ?? '') ? sp.q : null) as QuarterKey | null;
  const year = sp.y ? parseInt(sp.y, 10) : new Date().getFullYear();
  const range = qKey ? quarterRange(qKey, year) : currentQuarter();
  const prior = priorQuarter(range);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: viewerProfile } = await supabase
    .from('profiles').select('id, role').eq('id', user!.id).single();

  // Server-side guard: only Director can view other consultants' scorecards
  if (viewerProfile?.role !== 'director' && userId !== user!.id) {
    redirect('/performance');
  }

  const dataset = await loadPerformanceDataset();
  const scorecard = computeScorecard(dataset, userId, range, prior);

  const allScorecards = dataset.profiles
    .filter((p) => p.role !== 'director')
    .map((p) => computeScorecard(dataset, p.id, range, prior));
  const firmAvg = computeFirmAverages(allScorecards);
  const prompts = viewerProfile?.role === 'director'
    ? generatePrompts(scorecard, firmAvg)
    : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={scorecard.fullName}
        subtitle={`${ROLE_LABELS[scorecard.role]} · ${range.label} (vs ${prior.label})`}
        actions={
          <Link
            href="/performance"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-slate-700 hover:border-brand hover:text-brand-ink"
          >
            <ArrowLeft className="size-3.5" />
            All consultants
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className={viewerProfile?.role === 'director' ? 'grid grid-cols-4 gap-6 max-w-[1400px]' : 'max-w-6xl'}>
          <div className={viewerProfile?.role === 'director' ? 'col-span-3' : ''}>
            <PerformanceScorecard scorecard={scorecard} />
          </div>
          {viewerProfile?.role === 'director' && (
            <div className="col-span-1">
              <AppraisalPrompts prompts={prompts} consultantName={scorecard.fullName} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

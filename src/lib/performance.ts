/**
 * Performance analytics — pure functions, no React, no I/O.
 *
 * Used by /performance and /performance/[userId] to compute per-consultant
 * scorecards (inputs / outputs / insights) and quarter-over-quarter deltas,
 * plus generate appraisal-conversation prompts for the Director.
 */

import { feeFromJob, consultantCommission } from './format';

export type QuarterKey = 'q1' | 'q2' | 'q3' | 'q4' | 'last12w';

export interface QuarterRange {
  key: QuarterKey;
  year: number;
  label: string;
  start: Date;
  end: Date;
}

export interface MetricValue {
  current: number;
  prior: number;
  delta: number;          // current - prior
  pct: number | null;     // % change vs prior (null if prior was 0)
  direction: 'up' | 'down' | 'flat';
}

export interface ScorecardData {
  userId: string;
  fullName: string;
  role: 'director' | 'kam' | 'bd';
  range: QuarterRange;
  priorRange: QuarterRange;

  // Inputs — effort
  submissionsMade: MetricValue;
  candidatesAdded: MetricValue;
  cobrokeContributions: MetricValue;
  activityVolume: MetricValue;
  stageTransitions: MetricValue;

  // Outputs — value
  placements: MetricValue;
  feeRevenue: MetricValue;          // SGD
  commission: MetricValue;          // SGD
  avgDealSize: MetricValue;         // SGD

  // Insights — ratios (all in 0..1 except medianTimeToPlace which is days)
  winRate: MetricValue;
  convNewToScreen: MetricValue;
  convScreenToNeg: MetricValue;
  convNegToPlaced: MetricValue;
  medianTimeToPlace: MetricValue;   // days
  cobrokeParticipation: MetricValue;
}

export interface AppraisalPrompt {
  kind:
    | 'win_rate_positive' | 'win_rate_negative'
    | 'activity_spike'    | 'conversion_drop'
    | 'stalled_pipeline'  | 'cobroke_drop'
    | 'high_earner';
  headline: string;
  supporting: string;
}

// ─── Quarter ranges ────────────────────────────────────────────────

export function quarterRange(key: QuarterKey, year: number): QuarterRange {
  if (key === 'last12w') {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 84); // 12 weeks
    return { key, year, label: 'Last 12 weeks', start, end };
  }
  const months: Record<Exclude<QuarterKey, 'last12w'>, [number, number]> = {
    q1: [0, 2], q2: [3, 5], q3: [6, 8], q4: [9, 11],
  };
  const [startMonth, endMonth] = months[key];
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999); // last day of end month
  return { key, year, label: `${key.toUpperCase()} ${year}`, start, end };
}

export function priorQuarter(current: QuarterRange): QuarterRange {
  if (current.key === 'last12w') {
    const end = new Date(current.start);
    end.setMilliseconds(end.getMilliseconds() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 84);
    return { key: 'last12w', year: current.year, label: 'Prior 12 weeks', start, end };
  }
  const order: QuarterKey[] = ['q1', 'q2', 'q3', 'q4'];
  const idx = order.indexOf(current.key);
  if (idx === 0) return quarterRange('q4', current.year - 1);
  return quarterRange(order[idx - 1], current.year);
}

export function currentQuarter(now: Date = new Date()): QuarterRange {
  const m = now.getMonth();
  const y = now.getFullYear();
  if (m <= 2) return quarterRange('q1', y);
  if (m <= 5) return quarterRange('q2', y);
  if (m <= 8) return quarterRange('q3', y);
  return quarterRange('q4', y);
}

// ─── Delta helpers ─────────────────────────────────────────────────

export function computeDelta(current: number, prior: number): MetricValue {
  const delta = current - prior;
  let pct: number | null;
  if (prior === 0) pct = current === 0 ? 0 : null;
  else pct = Math.round((delta / prior) * 100);
  let direction: 'up' | 'down' | 'flat';
  if (Math.abs(delta) < 1e-9) direction = 'flat';
  else direction = delta > 0 ? 'up' : 'down';
  return { current, prior, delta, pct, direction };
}

// ─── Raw row types we expect from Supabase ─────────────────────────
// Keep loose — server pages cast their joins to these.

interface SubmissionRow {
  id: string;
  stage: string;
  outcome: string;
  submitting_consultant_id: string;
  created_at: string;
  updated_at: string;
  closure_at: string | null;
  new_lead_at: string | null;
  screening_at: string | null;
  negotiation_at: string | null;
  job_owner_id: string | null;
  annual_package_sgd: number | null;
  fee_pct: number;
}

interface SplitRow {
  consultant_id: string;
  pct: number;
  submission_id: string;
  submission_outcome: string;
  annual_package_sgd: number | null;
  fee_pct: number;
}

interface ActivityRow {
  actor_id: string | null;
  kind: string;
  created_at: string;
}

interface CandidateAddRow {
  added_by: string | null;
  created_at: string;
}

interface JobRow {
  id: string;
  owner_id: string | null;
  co_broke_open: boolean;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: 'director' | 'kam' | 'bd';
}

export interface PerformanceDataset {
  submissions: SubmissionRow[];
  splits: SplitRow[];
  activities: ActivityRow[];
  candidates: CandidateAddRow[];
  jobs: JobRow[];
  profiles: ProfileRow[];
}

// ─── Scorecard computation ─────────────────────────────────────────

function inRange(iso: string | null, range: QuarterRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeScorecard(
  data: PerformanceDataset,
  userId: string,
  range: QuarterRange,
  priorRange: QuarterRange
): ScorecardData {
  const profile = data.profiles.find((p) => p.id === userId);
  const fullName = profile?.full_name ?? 'Unknown';
  const role = profile?.role ?? 'kam';

  const computeForRange = (r: QuarterRange) => {
    // Submissions submitted by this user in range (by created_at)
    const mySubs = data.submissions.filter(
      (s) => s.submitting_consultant_id === userId && inRange(s.created_at, r)
    );
    // Submissions placed in range (by closure_at)
    const myPlacements = data.submissions.filter(
      (s) =>
        s.submitting_consultant_id === userId &&
        s.outcome === 'placed' &&
        inRange(s.closure_at, r)
    );
    // Co-broke contributions = submitted to jobs I don't own
    const myCobroke = mySubs.filter((s) => s.job_owner_id && s.job_owner_id !== userId);
    // Stage transitions logged in activities for this user
    const myStageChanges = data.activities.filter(
      (a) => a.actor_id === userId && a.kind === 'stage_change' && inRange(a.created_at, r)
    );
    // Candidates I added
    const myCands = data.candidates.filter(
      (c) => c.added_by === userId && inRange(c.created_at, r)
    );
    // Total activity volume
    const myActivity = data.activities.filter(
      (a) => a.actor_id === userId && inRange(a.created_at, r)
    );
    // Commission from splits on placements that closed in range
    const myCommission = data.splits
      .filter((sp) => sp.consultant_id === userId && sp.submission_outcome === 'placed')
      .reduce((sum, sp) => {
        const sub = data.submissions.find((s) => s.id === sp.submission_id);
        if (!sub || !inRange(sub.closure_at, r)) return sum;
        return sum + consultantCommission(feeFromJob(sp.annual_package_sgd, sp.fee_pct), Number(sp.pct));
      }, 0);
    const myFeeRevenue = myPlacements.reduce(
      (sum, s) => sum + feeFromJob(s.annual_package_sgd, s.fee_pct), 0
    );
    const avgDeal = myPlacements.length > 0 ? Math.round(myFeeRevenue / myPlacements.length) : 0;

    // Conversion rates
    const reachedScreening = mySubs.filter(
      (s) => s.screening_at || s.negotiation_at || s.closure_at
    ).length;
    const reachedNeg = mySubs.filter((s) => s.negotiation_at || s.closure_at).length;
    const reachedClosure = mySubs.filter((s) => s.closure_at).length;

    const convNewToScreen = mySubs.length > 0 ? reachedScreening / mySubs.length : 0;
    const convScreenToNeg = reachedScreening > 0 ? reachedNeg / reachedScreening : 0;
    const convNegToPlaced = reachedNeg > 0 ? reachedClosure / reachedNeg : 0;
    const winRate = mySubs.length > 0 ? myPlacements.length / mySubs.length : 0;

    // Time-to-place (days, median)
    const timeToPlaceDays = myPlacements
      .map((s) => {
        if (!s.closure_at || !s.new_lead_at) return null;
        return (new Date(s.closure_at).getTime() - new Date(s.new_lead_at).getTime()) / 86400000;
      })
      .filter((d): d is number => d !== null);
    const medianTtP = median(timeToPlaceDays);

    // Co-broke participation: cobroke jobs I touched / cobroke jobs available
    const availableCobrokeJobs = data.jobs.filter(
      (j) => j.co_broke_open && j.owner_id !== userId && inRange(j.created_at, r)
    );
    const cobrokeParticipation = availableCobrokeJobs.length > 0
      ? myCobroke.length / availableCobrokeJobs.length
      : 0;

    return {
      submissionsMade: mySubs.length,
      candidatesAdded: myCands.length,
      cobrokeContributions: myCobroke.length,
      activityVolume: myActivity.length,
      stageTransitions: myStageChanges.length,
      placements: myPlacements.length,
      feeRevenue: myFeeRevenue,
      commission: Math.round(myCommission),
      avgDealSize: avgDeal,
      winRate: Math.round(winRate * 100), // store as %
      convNewToScreen: Math.round(convNewToScreen * 100),
      convScreenToNeg: Math.round(convScreenToNeg * 100),
      convNegToPlaced: Math.round(convNegToPlaced * 100),
      medianTimeToPlace: Math.round(medianTtP),
      cobrokeParticipation: Math.round(cobrokeParticipation * 100),
    };
  };

  const c = computeForRange(range);
  const p = computeForRange(priorRange);

  return {
    userId,
    fullName,
    role,
    range,
    priorRange,
    submissionsMade: computeDelta(c.submissionsMade, p.submissionsMade),
    candidatesAdded: computeDelta(c.candidatesAdded, p.candidatesAdded),
    cobrokeContributions: computeDelta(c.cobrokeContributions, p.cobrokeContributions),
    activityVolume: computeDelta(c.activityVolume, p.activityVolume),
    stageTransitions: computeDelta(c.stageTransitions, p.stageTransitions),
    placements: computeDelta(c.placements, p.placements),
    feeRevenue: computeDelta(c.feeRevenue, p.feeRevenue),
    commission: computeDelta(c.commission, p.commission),
    avgDealSize: computeDelta(c.avgDealSize, p.avgDealSize),
    winRate: computeDelta(c.winRate, p.winRate),
    convNewToScreen: computeDelta(c.convNewToScreen, p.convNewToScreen),
    convScreenToNeg: computeDelta(c.convScreenToNeg, p.convScreenToNeg),
    convNegToPlaced: computeDelta(c.convNegToPlaced, p.convNegToPlaced),
    medianTimeToPlace: computeDelta(c.medianTimeToPlace, p.medianTimeToPlace),
    cobrokeParticipation: computeDelta(c.cobrokeParticipation, p.cobrokeParticipation),
  };
}

// ─── Firm average for benchmarking ─────────────────────────────────

export interface FirmAverages {
  winRate: number;       // mean win rate across consultants with >= 1 submission
  commission: number;    // median commission across all consultants
}

export function computeFirmAverages(allScorecards: ScorecardData[]): FirmAverages {
  const withActivity = allScorecards.filter((s) => s.submissionsMade.current >= 1);
  const winRates = withActivity.map((s) => s.winRate.current);
  const meanWinRate = winRates.length > 0
    ? winRates.reduce((a, b) => a + b, 0) / winRates.length
    : 0;
  const commissions = allScorecards.map((s) => s.commission.current);
  const medCommission = median(commissions);
  return { winRate: Math.round(meanWinRate), commission: Math.round(medCommission) };
}

// ─── Appraisal prompt rule engine ──────────────────────────────────

export function generatePrompts(
  s: ScorecardData,
  firmAvg: FirmAverages
): AppraisalPrompt[] {
  const prompts: AppraisalPrompt[] = [];
  const first = s.fullName.split(' ')[0];

  // Win-rate outlier
  if (s.submissionsMade.current >= 3) {
    const diff = s.winRate.current - firmAvg.winRate;
    if (diff > 10) {
      prompts.push({
        kind: 'win_rate_positive',
        headline: `${first}'s win rate beats firm average by ${diff} pp.`,
        supporting: `${s.winRate.current}% vs firm ${firmAvg.winRate}%. Ask what they're doing in negotiation that others can copy.`,
      });
    } else if (diff < -10) {
      prompts.push({
        kind: 'win_rate_negative',
        headline: `${first}'s win rate is ${Math.abs(diff)} pp below firm average.`,
        supporting: `${s.winRate.current}% vs firm ${firmAvg.winRate}%. Coaching opportunity — investigate where deals are falling out.`,
      });
    }
  }

  // Activity spike
  if (s.submissionsMade.pct !== null && s.submissionsMade.pct > 20) {
    prompts.push({
      kind: 'activity_spike',
      headline: `Submission volume up ${s.submissionsMade.pct}% Q-on-Q.`,
      supporting: `${s.submissionsMade.current} submissions this quarter vs ${s.submissionsMade.prior} prior. Acknowledge the activity spike.`,
    });
  }

  // Conversion drop
  const convDrops: { stage: string; drop: number }[] = [];
  if (s.convNewToScreen.delta < -8) convDrops.push({ stage: 'new → screening', drop: -s.convNewToScreen.delta });
  if (s.convScreenToNeg.delta < -8) convDrops.push({ stage: 'screening → negotiation', drop: -s.convScreenToNeg.delta });
  if (s.convNegToPlaced.delta < -8) convDrops.push({ stage: 'negotiation → placed', drop: -s.convNegToPlaced.delta });
  if (convDrops.length > 0) {
    const worst = convDrops.sort((a, b) => b.drop - a.drop)[0];
    prompts.push({
      kind: 'conversion_drop',
      headline: `Conversion at ${worst.stage} dropped ${worst.drop} pp.`,
      supporting: `Despite ${s.submissionsMade.current} submissions, fewer are progressing. Investigate root cause at that stage.`,
    });
  }

  // Stalled pipeline
  if (s.placements.current === 0 && s.submissionsMade.current >= 5) {
    prompts.push({
      kind: 'stalled_pipeline',
      headline: `No placements this quarter despite ${s.submissionsMade.current} in flight.`,
      supporting: `Stage-progression coaching needed. Review specific submissions to identify the blocker.`,
    });
  }

  // Co-broke drop
  if (s.cobrokeContributions.pct !== null && s.cobrokeContributions.pct < -15) {
    prompts.push({
      kind: 'cobroke_drop',
      headline: `Co-broke contributions fell ${Math.abs(s.cobrokeContributions.pct)}%.`,
      supporting: `${s.cobrokeContributions.current} this quarter vs ${s.cobrokeContributions.prior} prior. Discuss collaboration habits.`,
    });
  }

  // High earner
  if (firmAvg.commission > 0 && s.commission.current > firmAvg.commission * 1.5) {
    prompts.push({
      kind: 'high_earner',
      headline: `Top contributor — commission SGD ${s.commission.current.toLocaleString()} this quarter.`,
      supporting: `${Math.round((s.commission.current / firmAvg.commission - 1) * 100)}% above firm median. Retention conversation: what would keep them long-term?`,
    });
  }

  return prompts.slice(0, 5);
}

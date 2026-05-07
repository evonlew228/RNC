/**
 * Demo prep — minimalist data set for the pitch.
 *
 * Run:  npm run trim:demo
 *
 * Wipes existing submissions/splits/activities and inserts a tight set:
 *   - 8 submissions involving Sarah (mix of solo + co-broke with Marcus, mix of stages, includes 2 placed for earnings demo)
 *   - 2 submissions for Evon (newbie KAM contributing to Sarah's co-broke jobs)
 *   - All jobs fee_pct = 15 (firm-wide revenue model)
 *   - All candidates rest_until cleared (so prior placements don't block submissions during demo)
 *
 * Idempotent: safe to re-run between dry-runs.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function daysAgo(d: number): string {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date.toISOString();
}

async function main() {
  console.log('1. Fetching users');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role');
  if (profErr) throw profErr;
  const sarah = profiles!.find((p) => p.email === 'sarah@rncare.demo');
  const marcus = profiles!.find((p) => p.email === 'marcus@rncare.demo');
  const evon = profiles!.find((p) => p.email === 'evon@rncare.demo');
  if (!sarah || !marcus || !evon) {
    console.error('Missing demo users. Run npm run seed and npm run add:evon first.');
    process.exit(1);
  }

  console.log('2. Wipe pipeline state');
  await supabase.from('splits').delete().not('id', 'is', null);
  await supabase.from('activities').delete().not('id', 'is', null);
  await supabase.from('submissions').delete().not('id', 'is', null);
  await supabase.from('notifications').delete().not('id', 'is', null);
  await supabase.from('pending_placements').delete().not('id', 'is', null);

  console.log('3. Set firm-wide fee_pct = 15 (revenue = 15% of annual salary)');
  await supabase.from('jobs').update({ fee_pct: 15 }).not('id', 'is', null);

  console.log('4. Clear rest periods on candidates');
  await supabase.from('candidates').update({ rest_until: null }).not('id', 'is', null);

  console.log('5. Ensure all of Sarah\'s jobs are co-broke open with 60/40 default');
  await supabase
    .from('jobs')
    .update({ co_broke_open: true, default_split: { originator: 60, submitter: 40 } })
    .eq('owner_id', sarah.id);

  console.log('6. Pick Sarah\'s jobs and candidates');
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, role_type, annual_package_sgd')
    .eq('owner_id', sarah.id)
    .order('created_at')
    .limit(8);
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, full_name')
    .order('full_name')
    .limit(20);
  if (!jobs || jobs.length < 8 || !candidates || candidates.length < 10) {
    console.error('Need at least 8 Sarah-owned jobs and 10 candidates. Run npm run seed first.');
    process.exit(1);
  }

  // Plan: 8 Sarah submissions distributed across stages
  // Mix solo (Sarah submits) + co-broke (Marcus submits to Sarah's job)
  type Plan = {
    jobIdx: number;
    candIdx: number;
    submitter: 'sarah' | 'marcus' | 'evon';
    stage: 'new_lead' | 'screening' | 'negotiation' | 'closure';
    placed?: boolean; // mark as placed
    daysAgo: number;
  };

  const sarahPlan: Plan[] = [
    // 2 placed deals — earnings demo
    { jobIdx: 0, candIdx: 0, submitter: 'sarah', stage: 'closure', placed: true, daysAgo: 14 },
    { jobIdx: 1, candIdx: 1, submitter: 'marcus', stage: 'closure', placed: true, daysAgo: 8 }, // co-broke placement
    // 2 in negotiation
    { jobIdx: 2, candIdx: 2, submitter: 'sarah', stage: 'negotiation', daysAgo: 6 },
    { jobIdx: 3, candIdx: 3, submitter: 'marcus', stage: 'negotiation', daysAgo: 4 }, // co-broke
    // 2 in screening
    { jobIdx: 4, candIdx: 4, submitter: 'sarah', stage: 'screening', daysAgo: 5 },
    { jobIdx: 5, candIdx: 5, submitter: 'marcus', stage: 'screening', daysAgo: 3 }, // co-broke
    // 2 new candidate
    { jobIdx: 6, candIdx: 6, submitter: 'sarah', stage: 'new_lead', daysAgo: 2 },
    { jobIdx: 7, candIdx: 7, submitter: 'marcus', stage: 'new_lead', daysAgo: 1 }, // co-broke
  ];

  const evonPlan: Plan[] = [
    { jobIdx: 0, candIdx: 8, submitter: 'evon', stage: 'screening', daysAgo: 4 }, // co-broke contribution
    { jobIdx: 4, candIdx: 9, submitter: 'evon', stage: 'new_lead', daysAgo: 1 },   // co-broke contribution
  ];

  const submitterId = (s: Plan['submitter']) =>
    s === 'sarah' ? sarah.id : s === 'marcus' ? marcus.id : evon.id;

  const allPlans = [...sarahPlan, ...evonPlan];

  console.log(`7. Inserting ${allPlans.length} fresh submissions`);
  const subRows = allPlans.map((p) => {
    const job = jobs[p.jobIdx];
    const cand = candidates[p.candIdx];
    return {
      job_id: job.id,
      candidate_id: cand.id,
      submitting_consultant_id: submitterId(p.submitter),
      stage: p.stage,
      outcome: p.placed ? 'placed' : 'open',
      new_lead_at: daysAgo(p.daysAgo + 4),
      screening_at: ['screening', 'negotiation', 'closure'].includes(p.stage) ? daysAgo(p.daysAgo + 2) : null,
      negotiation_at: ['negotiation', 'closure'].includes(p.stage) ? daysAgo(p.daysAgo + 1) : null,
      closure_at: p.stage === 'closure' ? daysAgo(p.daysAgo) : null,
      expected_close_date:
        p.stage === 'negotiation' ? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) : null,
      created_at: daysAgo(p.daysAgo + 4),
    };
  });

  const { data: insertedSubs, error: subErr } = await supabase
    .from('submissions')
    .insert(subRows)
    .select();
  if (subErr) throw subErr;

  console.log('8. Splits + candidate updates for placed deals');
  for (let i = 0; i < allPlans.length; i++) {
    const plan = allPlans[i];
    if (!plan.placed) continue;
    const sub = insertedSubs![i];
    const job = jobs[plan.jobIdx];
    const cand = candidates[plan.candIdx];

    // Split: if co-broke (submitter != owner), 60/40 originator/submitter; else sole
    if (plan.submitter !== 'sarah') {
      await supabase.from('splits').insert([
        { submission_id: sub.id, consultant_id: sarah.id, pct: 60 },
        { submission_id: sub.id, consultant_id: submitterId(plan.submitter), pct: 40 },
      ]);
    } else {
      await supabase.from('splits').insert({
        submission_id: sub.id,
        consultant_id: sarah.id,
        pct: 100,
      });
    }

    // Update candidate's master record + rest_until
    await supabase
      .from('candidates')
      .update({
        current_title: job.role_type,
        current_employer:
          (await supabase.from('jobs').select('client:clients(name)').eq('id', job.id).single())
            .data?.client && (
            (await supabase.from('jobs').select('client:clients(name)').eq('id', job.id).single())
              .data!.client as unknown as { name: string }
          ).name,
        rest_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      })
      .eq('id', cand.id);
  }

  console.log('9. Activity log entries');
  const activityRows: Array<Record<string, unknown>> = [];
  insertedSubs!.forEach((s, i) => {
    const plan = allPlans[i];
    activityRows.push({
      actor_id: submitterId(plan.submitter),
      kind: 'submission_created',
      job_id: s.job_id,
      candidate_id: s.candidate_id,
      submission_id: s.id,
      created_at: s.created_at,
    });
    if (plan.placed) {
      activityRows.push({
        actor_id: submitterId(plan.submitter),
        kind: 'comment',
        job_id: s.job_id,
        submission_id: s.id,
        payload: { type: 'placed' },
        created_at: s.closure_at,
      });
    }
  });
  await supabase.from('activities').insert(activityRows);

  console.log('\nDone.');
  console.log(`  ${sarahPlan.length} submissions for Sarah's portfolio`);
  console.log(`  ${evonPlan.length} submissions for Evon`);
  console.log('  All jobs at fee_pct = 15');
  console.log('  Commission = 10% of fee revenue (1.5% of annual salary)');
}

main().catch((err) => {
  console.error('trim-demo failed:', err);
  process.exit(1);
});

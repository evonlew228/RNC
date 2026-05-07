/**
 * Demo seed for RN Care prototype.
 *
 * Run:  npm run seed
 *
 * Creates three demo auth users, then wipes and reinserts realistic
 * Singapore medical recruiting data: 6 clients, 12 jobs, 30 candidates,
 * 50 submissions across pipeline stages, plus 30 days of activity history.
 *
 * Idempotent: safe to re-run between pitches.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv(); // also load .env if present
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = 'demo1234';

const DEMO_USERS = [
  {
    email: 'director@rncare.demo',
    full_name: 'Lim Wei Ming',
    role: 'director' as const,
  },
  {
    email: 'sarah@rncare.demo',
    full_name: 'Sarah Tan',
    role: 'kam' as const,
  },
  {
    email: 'marcus@rncare.demo',
    full_name: 'Marcus Lee',
    role: 'bd' as const,
  },
];

const CLIENTS = [
  { name: 'Mount Elizabeth Medical Centre', segment: 'Hospital', district: 'Orchard', kam: 'sarah' },
  { name: 'Raffles Medical Group', segment: 'Hospital', district: 'Marina Bay', kam: 'sarah' },
  { name: 'Parkway East Hospital', segment: 'Hospital', district: 'Katong', kam: 'sarah' },
  { name: 'Singapore General Hospital', segment: 'Public Hospital', district: 'Outram', kam: 'sarah' },
  { name: 'National University Hospital', segment: 'Public Hospital', district: 'Kent Ridge', kam: 'sarah' },
  { name: 'Camden Medical Centre', segment: 'Specialist Centre', district: 'Tanglin', kam: 'sarah' },
];

interface JobSpec {
  client: string;
  title: string;
  role_type: string;
  package: number;
  fee_pct: number;
  co_broke: boolean;
  jd_summary: string;
  status?: 'open' | 'on_hold' | 'closed';
}

const JOBS: JobSpec[] = [
  { client: 'Mount Elizabeth Medical Centre', title: 'Senior Radiographer (MRI)', role_type: 'Senior Radiographer', package: 95000, fee_pct: 22, co_broke: true, jd_summary: 'Lead MRI radiographer for new 3T scanner. Min 5 yrs experience, MRI certification required.' },
  { client: 'Mount Elizabeth Medical Centre', title: 'Consultant Cardiologist', role_type: 'Consultant Cardiologist', package: 280000, fee_pct: 25, co_broke: false, jd_summary: 'Interventional cardiologist for catheterisation lab. SMC-registered specialist required.' },
  { client: 'Raffles Medical Group', title: 'ICU Staff Nurse (Cardiac)', role_type: 'ICU Staff Nurse', package: 72000, fee_pct: 20, co_broke: true, jd_summary: 'Cardiac ICU staff nurse, ACLS-certified, 3+ years post-registration.' },
  { client: 'Raffles Medical Group', title: 'Locum General Practitioner', role_type: 'GP', package: 120000, fee_pct: 18, co_broke: true, jd_summary: 'Locum GP for Marina Bay clinic. Flexible 3-4 days/week.' },
  { client: 'Parkway East Hospital', title: 'Operating Theatre Nurse', role_type: 'OT Nurse', package: 78000, fee_pct: 20, co_broke: false, jd_summary: 'Scrub/circulating nurse, orthopaedic + general surgery rotation.' },
  { client: 'Parkway East Hospital', title: 'Physiotherapist (Sports Medicine)', role_type: 'Physiotherapist', package: 68000, fee_pct: 18, co_broke: true, jd_summary: 'Sports physio for new rehab wing. APP-registered, dry needling cert preferred.' },
  { client: 'Singapore General Hospital', title: 'Oncology Pharmacist', role_type: 'Pharmacist', package: 88000, fee_pct: 20, co_broke: false, jd_summary: 'Clinical pharmacist for oncology unit. BCOP preferred.' },
  { client: 'Singapore General Hospital', title: 'Emergency Medicine Specialist', role_type: 'Emergency Specialist', package: 240000, fee_pct: 25, co_broke: true, jd_summary: 'A&E specialist consultant. SMC-registered, FAMS preferred.' },
  { client: 'National University Hospital', title: 'Paediatric Staff Nurse', role_type: 'Paediatric Nurse', package: 70000, fee_pct: 20, co_broke: true, jd_summary: 'Paeds ward nurse, PALS certified, 2+ years paeds experience.' },
  { client: 'National University Hospital', title: 'Medical Laboratory Technologist', role_type: 'Lab Technologist', package: 62000, fee_pct: 18, co_broke: true, jd_summary: 'Histopathology lab, immunohistochemistry experience required.' },
  { client: 'Camden Medical Centre', title: 'Anaesthesia Consultant', role_type: 'Anaesthetist', package: 260000, fee_pct: 25, co_broke: false, jd_summary: 'Day-surgery anaesthetist. SMC specialist register, 5+ years post-fellowship.' },
  { client: 'Camden Medical Centre', title: 'Occupational Therapist', role_type: 'OT', package: 65000, fee_pct: 18, co_broke: true, jd_summary: 'Hand therapy specialist for new clinic. CHT preferred, AHPC-registered.' },
];

const SKILLS = [
  'BCLS', 'ACLS', 'PALS', 'ATLS',
  'MRI-certified', 'CT-certified', 'Ultrasound',
  'ICU-experienced', 'A&E-experienced', 'Paediatric',
  'Cardiology', 'Oncology', 'Orthopaedics', 'Neurology',
  'SMC-registered', 'SNB-registered', 'AHPC-registered',
  'Dry needling', 'Sports medicine', 'Hand therapy',
  'Mandarin-speaking', 'Bahasa-speaking', 'Tamil-speaking',
];

interface CandidateSpec {
  name: string;
  current_title: string;
  current_employer: string;
  skills: string[];
}

const CANDIDATES: CandidateSpec[] = [
  { name: 'Tan Mei Ling', current_title: 'Radiographer', current_employer: 'Tan Tock Seng Hospital', skills: ['MRI-certified', 'CT-certified', 'Mandarin-speaking'] },
  { name: 'Aravind Kumar', current_title: 'Radiographer', current_employer: 'KK Women\'s & Children\'s', skills: ['MRI-certified', 'Ultrasound', 'Tamil-speaking'] },
  { name: 'Dr. Joshua Chen', current_title: 'Consultant Cardiologist', current_employer: 'Mount Alvernia Hospital', skills: ['Cardiology', 'SMC-registered', 'ACLS'] },
  { name: 'Dr. Priya Sharma', current_title: 'Cardiology Registrar', current_employer: 'NUH', skills: ['Cardiology', 'ACLS', 'SMC-registered'] },
  { name: 'Nurul Aisyah Binte Hamid', current_title: 'ICU Staff Nurse', current_employer: 'Khoo Teck Puat Hospital', skills: ['ICU-experienced', 'ACLS', 'BCLS', 'SNB-registered', 'Bahasa-speaking'] },
  { name: 'Wong Su Lin', current_title: 'Cardiac ICU Nurse', current_employer: 'NHCS', skills: ['ICU-experienced', 'Cardiology', 'ACLS', 'BCLS', 'SNB-registered'] },
  { name: 'Dr. Ahmad Iskandar', current_title: 'GP', current_employer: 'Parkway Shenton', skills: ['SMC-registered', 'BCLS', 'Bahasa-speaking', 'Mandarin-speaking'] },
  { name: 'Dr. Karen Lim', current_title: 'GP (Locum)', current_employer: 'Self-employed', skills: ['SMC-registered', 'BCLS'] },
  { name: 'Lee Jia Hui', current_title: 'OT Nurse', current_employer: 'Gleneagles Hospital', skills: ['Orthopaedics', 'BCLS', 'SNB-registered'] },
  { name: 'Bernard Goh', current_title: 'Senior OT Nurse', current_employer: 'Mount Alvernia Hospital', skills: ['Orthopaedics', 'BCLS', 'SNB-registered', 'Mandarin-speaking'] },
  { name: 'Rachel Ng', current_title: 'Physiotherapist', current_employer: 'Singapore Sports Institute', skills: ['Sports medicine', 'Dry needling', 'AHPC-registered'] },
  { name: 'Daniel Koh', current_title: 'Senior Physiotherapist', current_employer: 'Changi General Hospital', skills: ['Sports medicine', 'Orthopaedics', 'AHPC-registered'] },
  { name: 'Vanessa Loh', current_title: 'Clinical Pharmacist', current_employer: 'NCC Singapore', skills: ['Oncology', 'Mandarin-speaking'] },
  { name: 'Dr. Rajesh Menon', current_title: 'Senior Pharmacist', current_employer: 'NUH', skills: ['Oncology', 'Tamil-speaking'] },
  { name: 'Dr. Eunice Tan', current_title: 'A&E Registrar', current_employer: 'Tan Tock Seng Hospital', skills: ['A&E-experienced', 'ATLS', 'ACLS', 'SMC-registered'] },
  { name: 'Dr. Marcus Yeo', current_title: 'Emergency Specialist', current_employer: 'Sengkang General Hospital', skills: ['A&E-experienced', 'ATLS', 'ACLS', 'SMC-registered', 'Mandarin-speaking'] },
  { name: 'Siti Nuraini Binte Razak', current_title: 'Paediatric Nurse', current_employer: 'KKH', skills: ['Paediatric', 'PALS', 'BCLS', 'SNB-registered', 'Bahasa-speaking'] },
  { name: 'Crystal Tan', current_title: 'Paediatric Nurse', current_employer: 'NUH', skills: ['Paediatric', 'PALS', 'SNB-registered'] },
  { name: 'Chen Wei Jie', current_title: 'Lab Technologist', current_employer: 'SingHealth Pathology', skills: ['Mandarin-speaking'] },
  { name: 'Jasmine Ong', current_title: 'Histopathology Technologist', current_employer: 'Parkway Lab', skills: ['Mandarin-speaking'] },
  { name: 'Dr. Hassan Mohamed', current_title: 'Consultant Anaesthetist', current_employer: 'Mount Elizabeth Novena', skills: ['SMC-registered', 'ACLS', 'Bahasa-speaking'] },
  { name: 'Dr. Lisa Chan', current_title: 'Anaesthesia Specialist', current_employer: 'Gleneagles Hospital', skills: ['SMC-registered', 'ACLS'] },
  { name: 'Audrey Quek', current_title: 'Occupational Therapist', current_employer: 'Singapore General Hospital', skills: ['Hand therapy', 'AHPC-registered'] },
  { name: 'Pamela Sim', current_title: 'Senior OT', current_employer: 'Changi General Hospital', skills: ['Hand therapy', 'AHPC-registered'] },
  { name: 'Dr. Vikram Patel', current_title: 'Cardiology Specialist', current_employer: 'NHCS', skills: ['Cardiology', 'ACLS', 'SMC-registered'] },
  { name: 'Jonathan Tay', current_title: 'Radiographer', current_employer: 'Raffles Medical', skills: ['MRI-certified', 'Ultrasound'] },
  { name: 'Michelle Phua', current_title: 'Physiotherapist', current_employer: 'Tan Tock Seng Hospital', skills: ['Sports medicine', 'AHPC-registered'] },
  { name: 'Dr. Steven Lim', current_title: 'GP', current_employer: 'Healthway Medical', skills: ['SMC-registered', 'BCLS', 'Mandarin-speaking'] },
  { name: 'Farah Diana Binte Yusof', current_title: 'OT Nurse', current_employer: 'KK Women\'s & Children\'s', skills: ['BCLS', 'SNB-registered', 'Bahasa-speaking'] },
  { name: 'Patrick Soh', current_title: 'A&E Doctor', current_employer: 'Ng Teng Fong General Hospital', skills: ['A&E-experienced', 'ATLS', 'SMC-registered'] },
];

// Helper: resolve user_id by alias
async function getUsersByAlias() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, email');
  if (error) throw error;
  return {
    director: profiles!.find(p => p.email === 'director@rncare.demo')!.id,
    sarah: profiles!.find(p => p.email === 'sarah@rncare.demo')!.id,
    marcus: profiles!.find(p => p.email === 'marcus@rncare.demo')!.id,
  };
}

async function ensureUser(email: string, full_name: string, role: 'director' | 'kam' | 'bd') {
  // Try to find existing auth user by email
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = existing?.users.find(u => u.email === email)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log(`  + auth user created: ${email}`);
  } else {
    // Reset password to known value in case it was changed
    await supabase.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    console.log(`  ~ auth user exists: ${email}`);
  }

  // Upsert profile
  await supabase.from('profiles').upsert({
    id: userId,
    full_name,
    role,
    email,
  });
  return userId;
}

async function wipeDomain() {
  // Order matters: children first
  await supabase.from('activities').delete().not('id', 'is', null);
  await supabase.from('splits').delete().not('id', 'is', null);
  await supabase.from('submissions').delete().not('id', 'is', null);
  await supabase.from('candidate_skills').delete().not('candidate_id', 'is', null);
  await supabase.from('candidates').delete().not('id', 'is', null);
  await supabase.from('skills').delete().not('id', 'is', null);
  await supabase.from('jobs').delete().not('id', 'is', null);
  await supabase.from('contacts').delete().not('id', 'is', null);
  await supabase.from('clients').delete().not('id', 'is', null);
  console.log('  - cleared existing demo data');
}

function daysAgo(d: number): string {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date.toISOString();
}

async function main() {
  console.log('Seeding RN Care demo...');

  console.log('1. Auth users');
  for (const u of DEMO_USERS) {
    await ensureUser(u.email, u.full_name, u.role);
  }
  const users = await getUsersByAlias();

  console.log('2. Wipe existing domain data');
  await wipeDomain();

  console.log('3. Skills');
  const skillsRows = SKILLS.map(name => ({ name }));
  const { data: skillsData, error: skillsErr } = await supabase
    .from('skills')
    .insert(skillsRows)
    .select();
  if (skillsErr) throw skillsErr;
  const skillByName: Record<string, string> = {};
  for (const s of skillsData!) skillByName[s.name] = s.id;

  console.log('4. Clients');
  const clientRows = CLIENTS.map(c => ({
    name: c.name,
    industry_segment: c.segment,
    district: c.district,
    kam_id: c.kam === 'sarah' ? users.sarah : users.marcus,
  }));
  const { data: clientsData, error: clientsErr } = await supabase
    .from('clients')
    .insert(clientRows)
    .select();
  if (clientsErr) throw clientsErr;
  const clientByName: Record<string, string> = {};
  for (const c of clientsData!) clientByName[c.name] = c.id;

  console.log('5. Contacts');
  const contactNames = [
    ['Dr. Tan Hui Yan', 'Head of HR'],
    ['Sharon Lee', 'HR Business Partner'],
    ['Mr. Sundaram', 'Talent Acquisition Lead'],
    ['Cheryl Tay', 'HR Director'],
    ['Dr. Kumar Nair', 'Medical Director'],
    ['Joyce Lim', 'Talent Manager'],
  ];
  const contactRows = clientsData!.map((c, i) => ({
    client_id: c.id,
    full_name: contactNames[i][0],
    title: contactNames[i][1],
    email: contactNames[i][0].toLowerCase().replace(/[^a-z]+/g, '.') + '@' + c.name.toLowerCase().replace(/[^a-z]+/g, '') + '.com.sg',
    phone: '+65 6' + Math.floor(1000000 + Math.random() * 9000000),
  }));
  await supabase.from('contacts').insert(contactRows);

  console.log('6. Jobs');
  const jobRows = JOBS.map((j, i) => ({
    client_id: clientByName[j.client],
    title: j.title,
    role_type: j.role_type,
    jd_summary: j.jd_summary,
    jd_url: `https://drive.google.com/file/d/demo-jd-${i + 1}/view`,
    annual_package_sgd: j.package,
    fee_pct: j.fee_pct,
    owner_id: users.sarah, // Sarah owns all jobs as KAM
    co_broke_open: j.co_broke,
    default_split: j.co_broke ? { originator: 60, submitter: 40 } : null,
    status: j.status ?? 'open',
    created_at: daysAgo(Math.floor(Math.random() * 30) + 5),
  }));
  const { data: jobsData, error: jobsErr } = await supabase
    .from('jobs')
    .insert(jobRows)
    .select();
  if (jobsErr) throw jobsErr;

  console.log('7. Candidates + skills');
  const candidateRows = CANDIDATES.map(c => ({
    full_name: c.name,
    current_title: c.current_title,
    current_employer: c.current_employer,
    email: c.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.+/g, '.') + '@email.com',
    phone: '+65 9' + Math.floor(1000000 + Math.random() * 9000000),
    resume_url: `https://drive.google.com/file/d/demo-cv-${c.name.toLowerCase().replace(/[^a-z]+/g, '-')}/view`,
    added_by: Math.random() > 0.5 ? users.sarah : users.marcus,
  }));
  const { data: candidatesData, error: candsErr } = await supabase
    .from('candidates')
    .insert(candidateRows)
    .select();
  if (candsErr) throw candsErr;

  const csLinks: Array<{ candidate_id: string; skill_id: string }> = [];
  candidatesData!.forEach((row, i) => {
    for (const skillName of CANDIDATES[i].skills) {
      if (skillByName[skillName]) {
        csLinks.push({ candidate_id: row.id, skill_id: skillByName[skillName] });
      }
    }
  });
  await supabase.from('candidate_skills').insert(csLinks);

  console.log('8. Submissions');
  // Distribute 50 submissions across stages and jobs
  // Match candidates to jobs by role-type plausibility
  const stageDistribution: { stage: 'new_lead' | 'screening' | 'negotiation' | 'closure'; count: number }[] = [
    { stage: 'new_lead', count: 22 },
    { stage: 'screening', count: 15 },
    { stage: 'negotiation', count: 9 },
    { stage: 'closure', count: 4 },
  ];

  // Build candidate-job affinity
  function plausibleCandidates(jobIdx: number): number[] {
    const job = JOBS[jobIdx];
    const matches: number[] = [];
    CANDIDATES.forEach((c, idx) => {
      const role = c.current_title.toLowerCase();
      const target = job.role_type.toLowerCase();
      // very loose matching
      if (
        role.includes(target.split(' ')[0]) ||
        (target.includes('radiographer') && role.includes('radiographer')) ||
        (target.includes('cardiologist') && role.includes('cardio')) ||
        (target.includes('icu') && role.includes('icu')) ||
        (target.includes('gp') && role.includes('gp')) ||
        (target.includes('ot nurse') && role.includes('ot nurse')) ||
        (target.includes('physiotherapist') && role.includes('physio')) ||
        (target.includes('pharmacist') && role.includes('pharmacist')) ||
        (target.includes('emergency') && role.includes('a&e')) ||
        (target.includes('paediatric') && role.includes('paediatric')) ||
        (target.includes('lab') && role.includes('lab')) ||
        (target.includes('anaesth') && role.includes('anaesth')) ||
        (target.includes('occupational') && role.includes('ot'))
      ) {
        matches.push(idx);
      }
    });
    return matches;
  }

  const submissionRows: Array<Record<string, unknown>> = [];
  const splitRows: Array<Record<string, unknown>> = [];
  const usedPairs = new Set<string>();

  let totalNeeded = 50;
  for (const dist of stageDistribution) {
    for (let i = 0; i < dist.count && totalNeeded > 0; i++) {
      // Pick a job, prefer co-broke ones for variety
      let jobIdx: number;
      let candIdx: number;
      let attempts = 0;
      while (attempts < 50) {
        jobIdx = Math.floor(Math.random() * JOBS.length);
        const candidates = plausibleCandidates(jobIdx);
        if (candidates.length === 0) {
          attempts++;
          continue;
        }
        candIdx = candidates[Math.floor(Math.random() * candidates.length)];
        const key = `${jobIdx}:${candIdx}`;
        if (!usedPairs.has(key)) {
          usedPairs.add(key);
          break;
        }
        attempts++;
      }
      if (attempts >= 50) continue;

      const job = JOBS[jobIdx!];
      const submitterIsMarcus = job.co_broke && Math.random() > 0.4;
      const submittingId = submitterIsMarcus ? users.marcus : users.sarah;

      const createdDaysAgo = Math.floor(Math.random() * 28) + 1;
      const stage = dist.stage;
      const submission = {
        job_id: jobsData![jobIdx!].id,
        candidate_id: candidatesData![candIdx!].id,
        submitting_consultant_id: submittingId,
        stage,
        outcome: stage === 'closure' && Math.random() > 0.3 ? 'placed' : 'open',
        new_lead_at: daysAgo(createdDaysAgo),
        screening_at: ['screening', 'negotiation', 'closure'].includes(stage) ? daysAgo(Math.max(0, createdDaysAgo - 3)) : null,
        negotiation_at: ['negotiation', 'closure'].includes(stage) ? daysAgo(Math.max(0, createdDaysAgo - 7)) : null,
        closure_at: stage === 'closure' ? daysAgo(Math.max(0, createdDaysAgo - 12)) : null,
        expected_close_date: stage === 'negotiation'
          ? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
          : null,
        created_at: daysAgo(createdDaysAgo),
      };
      submissionRows.push(submission);
      totalNeeded--;
    }
  }

  const { data: submissionsData, error: submErr } = await supabase
    .from('submissions')
    .insert(submissionRows)
    .select();
  if (submErr) throw submErr;

  // Splits for closed-stage submissions
  submissionsData!.forEach((s, i) => {
    if (s.stage === 'closure' && s.outcome === 'placed') {
      const job = JOBS.find((j, idx) => jobsData![idx].id === s.job_id);
      if (job?.co_broke && s.submitting_consultant_id === users.marcus) {
        // 60/40 originator (Sarah) / submitter (Marcus)
        splitRows.push({ submission_id: s.id, consultant_id: users.sarah, pct: 60 });
        splitRows.push({ submission_id: s.id, consultant_id: users.marcus, pct: 40 });
      } else {
        splitRows.push({ submission_id: s.id, consultant_id: s.submitting_consultant_id, pct: 100 });
      }
    }
  });
  if (splitRows.length > 0) {
    await supabase.from('splits').insert(splitRows);
  }

  console.log('9. Activities');
  // Some recent activity entries — submission_created + cobroke_opened
  const activityRows: Array<Record<string, unknown>> = [];
  jobsData!.forEach((j, idx) => {
    activityRows.push({
      actor_id: users.sarah,
      kind: 'job_created',
      job_id: j.id,
      payload: { title: JOBS[idx].title },
      created_at: j.created_at,
    });
    if (JOBS[idx].co_broke) {
      activityRows.push({
        actor_id: users.sarah,
        kind: 'cobroke_opened',
        job_id: j.id,
        payload: { title: JOBS[idx].title, split: { originator: 60, submitter: 40 } },
        created_at: j.created_at,
      });
    }
  });
  submissionsData!.forEach((s) => {
    activityRows.push({
      actor_id: s.submitting_consultant_id,
      kind: 'submission_created',
      job_id: s.job_id,
      candidate_id: s.candidate_id,
      submission_id: s.id,
      created_at: s.created_at,
    });
  });
  await supabase.from('activities').insert(activityRows);

  console.log('\nDone.');
  console.log('Demo logins (password: demo1234):');
  console.log('  director@rncare.demo  — Director (sees everything)');
  console.log('  sarah@rncare.demo     — KAM Sarah Tan (owns all 6 clients)');
  console.log('  marcus@rncare.demo    — BD Marcus Lee (contributes via co-broke)');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

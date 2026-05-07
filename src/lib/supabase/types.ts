export type UserRole = 'director' | 'kam' | 'bd';
export type PipelineStage = 'new_lead' | 'screening' | 'negotiation' | 'closure';
export type SubmissionOutcome = 'open' | 'placed' | 'rejected' | 'withdrawn';

export const STAGE_ORDER: PipelineStage[] = [
  'new_lead',
  'screening',
  'negotiation',
  'closure',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new_lead: 'New Candidate',
  screening: 'Interview Screening',
  negotiation: 'Negotiation',
  closure: 'Closure',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Director',
  kam: 'Key Account Manager',
  bd: 'BD Consultant',
};

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  industry_segment: string | null;
  district: string | null;
  kam_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  client_id: string;
  full_name: string;
  title: string | null;
  department: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  client_id: string;
  title: string;
  role_type: string | null;
  jd_summary: string | null;
  jd_url: string | null;
  criteria: string | null;
  annual_package_sgd: number | null;
  fee_pct: number;
  owner_id: string | null;
  co_broke_open: boolean;
  default_split: { originator: number; submitter: number } | null;
  status: 'open' | 'on_hold' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  full_name: string;
  current_title: string | null;
  current_employer: string | null;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  notes: string | null;
  added_by: string | null;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
}

export interface Submission {
  id: string;
  job_id: string;
  candidate_id: string;
  submitting_consultant_id: string;
  stage: PipelineStage;
  outcome: SubmissionOutcome;
  expected_close_date: string | null;
  new_lead_at: string | null;
  screening_at: string | null;
  negotiation_at: string | null;
  closure_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Split {
  id: string;
  submission_id: string;
  consultant_id: string;
  pct: number;
  created_at: string;
}

export interface Activity {
  id: string;
  actor_id: string | null;
  kind:
    | 'stage_change'
    | 'job_created'
    | 'cobroke_opened'
    | 'submission_created'
    | 'comment';
  job_id: string | null;
  candidate_id: string | null;
  submission_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

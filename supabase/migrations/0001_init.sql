-- RN Care Co-Broking CRM — initial schema
-- Run in Supabase SQL editor (or via `supabase db push`)

-- ============================================================
-- Enums
-- ============================================================
create type user_role as enum ('director', 'kam', 'bd');
create type pipeline_stage as enum ('new_lead', 'screening', 'negotiation', 'closure');
create type submission_outcome as enum ('open', 'placed', 'rejected', 'withdrawn');

-- ============================================================
-- profiles  (extends auth.users with role + name)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role user_role not null,
  email text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- clients (hospitals / clinics / healthcare groups)
-- ============================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry_segment text,           -- e.g. 'Hospital', 'Clinic', 'Specialist Centre'
  district text,                   -- Singapore district / neighbourhood
  kam_id uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index on clients(kam_id);

-- ============================================================
-- contacts (hiring people at clients)
-- ============================================================
create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  full_name text not null,
  title text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create index on contacts(client_id);

-- ============================================================
-- jobs (opportunities / vacancies)
-- ============================================================
create table jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  role_type text,                  -- e.g. 'Senior Radiographer'
  jd_summary text,
  jd_url text,                     -- mock URL to JD doc
  annual_package_sgd int,          -- ballpark annual package in SGD
  fee_pct numeric(4,2) default 20.00, -- recruitment fee % of annual
  owner_id uuid references profiles(id),  -- primary consultant (usually KAM)
  co_broke_open boolean not null default false,
  default_split jsonb,             -- e.g. {"originator": 60, "submitter": 40}
  status text not null default 'open', -- 'open' | 'on_hold' | 'closed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on jobs(owner_id);
create index on jobs(co_broke_open) where co_broke_open;
create index on jobs(status);

-- ============================================================
-- candidates
-- ============================================================
create table candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  current_title text,
  current_employer text,
  email text,
  phone text,
  resume_url text,                 -- stub link (Supabase Storage in v2 → GDrive in prod)
  notes text,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- skills (tag table)
-- ============================================================
create table skills (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table candidate_skills (
  candidate_id uuid not null references candidates(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  primary key (candidate_id, skill_id)
);

-- ============================================================
-- submissions (candidate × job — the heart of the pipeline)
-- ============================================================
create table submissions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  submitting_consultant_id uuid not null references profiles(id),
  stage pipeline_stage not null default 'new_lead',
  outcome submission_outcome not null default 'open',
  expected_close_date date,
  -- stage timestamps for funnel analysis
  new_lead_at timestamptz default now(),
  screening_at timestamptz,
  negotiation_at timestamptz,
  closure_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index on submissions(job_id);
create index on submissions(candidate_id);
create index on submissions(submitting_consultant_id);
create index on submissions(stage);

-- ============================================================
-- splits (commission allocation per closed submission)
-- ============================================================
create table splits (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  consultant_id uuid not null references profiles(id),
  pct numeric(5,2) not null check (pct > 0 and pct <= 100),
  created_at timestamptz not null default now()
);

create index on splits(submission_id);

-- ============================================================
-- activities (audit log)
-- ============================================================
create table activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  kind text not null,              -- 'stage_change' | 'job_created' | 'cobroke_opened' | 'submission_created' | 'comment'
  job_id uuid references jobs(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  submission_id uuid references submissions(id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index on activities(created_at desc);
create index on activities(job_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();
create trigger submissions_set_updated_at before update on submissions
  for each row execute function set_updated_at();

-- ============================================================
-- Stamp stage timestamps on update
-- ============================================================
create or replace function stamp_stage_timestamp()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    case new.stage
      when 'screening' then new.screening_at = coalesce(new.screening_at, now());
      when 'negotiation' then new.negotiation_at = coalesce(new.negotiation_at, now());
      when 'closure' then new.closure_at = coalesce(new.closure_at, now());
      else null;
    end case;
    -- log to activities
    insert into activities (actor_id, kind, job_id, submission_id, payload)
    values (
      new.submitting_consultant_id,
      'stage_change',
      new.job_id,
      new.id,
      jsonb_build_object('from', old.stage, 'to', new.stage)
    );
  end if;
  return new;
end;
$$;

create trigger submissions_stamp_stage before update on submissions
  for each row execute function stamp_stage_timestamp();

-- ============================================================
-- Realtime publication (Supabase publishes to `supabase_realtime`)
-- ============================================================
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table submissions;
alter publication supabase_realtime add table activities;

-- ============================================================
-- RLS: enable on all tables
-- For the demo we use simple "authenticated users can read/write everything"
-- policies. Production would scope by role + ownership.
-- ============================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table contacts enable row level security;
alter table jobs enable row level security;
alter table candidates enable row level security;
alter table skills enable row level security;
alter table candidate_skills enable row level security;
alter table submissions enable row level security;
alter table splits enable row level security;
alter table activities enable row level security;

-- Helper: any authenticated user
create policy "auth read" on profiles for select to authenticated using (true);
create policy "auth read" on clients for select to authenticated using (true);
create policy "auth read" on contacts for select to authenticated using (true);
create policy "auth read" on jobs for select to authenticated using (true);
create policy "auth read" on candidates for select to authenticated using (true);
create policy "auth read" on skills for select to authenticated using (true);
create policy "auth read" on candidate_skills for select to authenticated using (true);
create policy "auth read" on submissions for select to authenticated using (true);
create policy "auth read" on splits for select to authenticated using (true);
create policy "auth read" on activities for select to authenticated using (true);

-- Writes: authenticated users can mutate (demo only — tighten in prod)
create policy "auth write" on clients for all to authenticated using (true) with check (true);
create policy "auth write" on contacts for all to authenticated using (true) with check (true);
create policy "auth write" on jobs for all to authenticated using (true) with check (true);
create policy "auth write" on candidates for all to authenticated using (true) with check (true);
create policy "auth write" on skills for all to authenticated using (true) with check (true);
create policy "auth write" on candidate_skills for all to authenticated using (true) with check (true);
create policy "auth write" on submissions for all to authenticated using (true) with check (true);
create policy "auth write" on splits for all to authenticated using (true) with check (true);
create policy "auth write" on activities for all to authenticated using (true) with check (true);

-- Profiles: users can update only their own row
create policy "self update" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

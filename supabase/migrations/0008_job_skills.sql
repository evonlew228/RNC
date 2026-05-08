-- Many-to-many: jobs ↔ skills (required skills tagged on each job)
create table if not exists job_skills (
  job_id uuid not null references jobs(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  primary key (job_id, skill_id)
);

create index if not exists job_skills_skill_idx on job_skills(skill_id);

alter table job_skills enable row level security;

drop policy if exists "auth read job_skills" on job_skills;
drop policy if exists "auth write job_skills" on job_skills;

create policy "auth read job_skills" on job_skills
  for select to authenticated using (true);
create policy "auth write job_skills" on job_skills
  for all to authenticated using (true) with check (true);

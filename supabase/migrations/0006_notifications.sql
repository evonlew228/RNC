-- Per-recipient notification feed (different from `activities` which is firm-wide audit)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  kind text not null,                 -- 'placed' | 'placed_elsewhere' | 'split_pending' | 'cobroke_opened'
  title text not null,
  body text,
  href text,                          -- deep link, e.g. /jobs/<id> or /candidates/<id>
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx on notifications(recipient_id) where read_at is null;

-- RLS
alter table notifications enable row level security;

drop policy if exists "auth read own notifications" on notifications;
drop policy if exists "auth update own notifications" on notifications;
drop policy if exists "auth insert notifications" on notifications;

create policy "auth read own notifications" on notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "auth update own notifications" on notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "auth insert notifications" on notifications
  for insert to authenticated with check (true);

-- Realtime
alter publication supabase_realtime add table notifications;

-- ============================================================
-- Pending placements (split approval flow)
-- ============================================================
-- When the submitter is NOT the job owner and the placement involves a split,
-- the submitter creates a pending request; the originator approves it.
create table if not exists pending_placements (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references submissions(id) on delete cascade,
  proposed_by uuid not null references profiles(id),
  proposed_splits jsonb not null,     -- [{consultant_id, pct, full_name}]
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pending_placements_status_idx on pending_placements(status);

alter table pending_placements enable row level security;

drop policy if exists "auth read pending" on pending_placements;
drop policy if exists "auth write pending" on pending_placements;

create policy "auth read pending" on pending_placements
  for select to authenticated using (true);
create policy "auth write pending" on pending_placements
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table pending_placements;

-- ============================================================
-- Refined mark_placed: now writes a notification to each split recipient
-- ============================================================
create or replace function mark_placed(p_submission_id uuid, p_actor_id uuid)
returns void language plpgsql as $$
declare
  v_candidate_id uuid;
  v_candidate_name text;
  v_job_role text;
  v_client_name text;
  v_job_id uuid;
begin
  select s.candidate_id, c2.full_name, coalesce(j.role_type, j.title), c.name, s.job_id
    into v_candidate_id, v_candidate_name, v_job_role, v_client_name, v_job_id
    from submissions s
    join jobs j on j.id = s.job_id
    join clients c on c.id = j.client_id
    join candidates c2 on c2.id = s.candidate_id
   where s.id = p_submission_id;

  update submissions
     set outcome = 'placed', stage = 'closure', updated_at = now()
   where id = p_submission_id;

  update candidates
     set current_title = v_job_role,
         current_employer = v_client_name
   where id = v_candidate_id;

  -- Auto-withdraw other open submissions for this candidate
  with auto_wd as (
    update submissions
       set outcome = 'withdrawn', updated_at = now()
     where candidate_id = v_candidate_id
       and id <> p_submission_id
       and outcome = 'open'
   returning id, job_id, submitting_consultant_id
  ),
  log_activity as (
    insert into activities (actor_id, kind, job_id, candidate_id, submission_id, payload)
    select p_actor_id, 'comment', job_id, v_candidate_id, id,
           jsonb_build_object('type','withdrawn_placed_elsewhere','placed_at', v_client_name)
      from auto_wd
   returning 1
  )
  -- Notify each affected submitter that their candidate was placed elsewhere
  insert into notifications (recipient_id, kind, title, body, href, payload)
  select submitting_consultant_id, 'placed_elsewhere',
         v_candidate_name || ' was placed elsewhere',
         'Their submission on this role has been auto-withdrawn (placed at ' || v_client_name || ')',
         '/candidates/' || v_candidate_id::text,
         jsonb_build_object('candidate_id', v_candidate_id, 'placed_at', v_client_name)
    from auto_wd
   where submitting_consultant_id <> p_actor_id;
end;
$$;

grant execute on function mark_placed(uuid, uuid) to authenticated;

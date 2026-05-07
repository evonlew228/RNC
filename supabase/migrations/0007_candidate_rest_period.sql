-- Industry-standard "rest period" after a candidate is placed.
-- Default: 12 months. The candidate shouldn't be re-submitted during this window.
alter table candidates
  add column if not exists rest_until date;

-- Update mark_placed to set the rest period
create or replace function mark_placed(p_submission_id uuid, p_actor_id uuid)
returns void language plpgsql as $$
declare
  v_candidate_id uuid;
  v_candidate_name text;
  v_job_role text;
  v_client_name text;
  v_job_id uuid;
  v_rest_months int := 12;
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

  -- Update candidate master record + rest period
  update candidates
     set current_title = v_job_role,
         current_employer = v_client_name,
         rest_until = (current_date + (v_rest_months || ' months')::interval)::date
   where id = v_candidate_id;

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

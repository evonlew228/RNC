-- Atomic mark-as-placed:
--   1. set the chosen submission to placed/closure
--   2. update the candidate's current title + employer to the placed role
--   3. auto-withdraw the candidate's other open submissions (placed elsewhere)
--   4. log activities for the auto-withdrawn rows
create or replace function mark_placed(p_submission_id uuid, p_actor_id uuid)
returns void language plpgsql as $$
declare
  v_candidate_id uuid;
  v_job_role text;
  v_client_name text;
begin
  select s.candidate_id, coalesce(j.role_type, j.title), c.name
    into v_candidate_id, v_job_role, v_client_name
    from submissions s
    join jobs j on j.id = s.job_id
    join clients c on c.id = j.client_id
   where s.id = p_submission_id;

  update submissions
     set outcome = 'placed', stage = 'closure', updated_at = now()
   where id = p_submission_id;

  update candidates
     set current_title = v_job_role,
         current_employer = v_client_name
   where id = v_candidate_id;

  with auto_wd as (
    update submissions
       set outcome = 'withdrawn', updated_at = now()
     where candidate_id = v_candidate_id
       and id <> p_submission_id
       and outcome = 'open'
   returning id, job_id
  )
  insert into activities (actor_id, kind, job_id, candidate_id, submission_id, payload)
  select p_actor_id, 'comment', job_id, v_candidate_id, id,
         jsonb_build_object('type', 'withdrawn_placed_elsewhere', 'placed_at', v_client_name)
    from auto_wd;
end;
$$;

grant execute on function mark_placed(uuid, uuid) to authenticated;

-- Public bucket for candidate resume uploads
insert into storage.buckets (id, name, public)
values ('candidate-resumes', 'candidate-resumes', true)
on conflict (id) do nothing;

-- Authenticated users can read/write to this bucket
drop policy if exists "auth read resumes" on storage.objects;
drop policy if exists "auth write resumes" on storage.objects;
drop policy if exists "auth update resumes" on storage.objects;
drop policy if exists "auth delete resumes" on storage.objects;

create policy "auth read resumes" on storage.objects
  for select to authenticated using (bucket_id = 'candidate-resumes');
create policy "auth write resumes" on storage.objects
  for insert to authenticated with check (bucket_id = 'candidate-resumes');
create policy "auth update resumes" on storage.objects
  for update to authenticated using (bucket_id = 'candidate-resumes');
create policy "auth delete resumes" on storage.objects
  for delete to authenticated using (bucket_id = 'candidate-resumes');

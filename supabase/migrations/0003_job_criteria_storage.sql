-- Add hiring criteria field to jobs
alter table jobs add column if not exists criteria text;

-- Create a public bucket for JD/attachment uploads
insert into storage.buckets (id, name, public)
values ('job-attachments', 'job-attachments', true)
on conflict (id) do nothing;

-- Storage policies: any authenticated user can upload + read
drop policy if exists "auth read attachments" on storage.objects;
drop policy if exists "auth write attachments" on storage.objects;
drop policy if exists "auth update attachments" on storage.objects;
drop policy if exists "auth delete attachments" on storage.objects;

create policy "auth read attachments" on storage.objects
  for select to authenticated using (bucket_id = 'job-attachments');
create policy "auth write attachments" on storage.objects
  for insert to authenticated with check (bucket_id = 'job-attachments');
create policy "auth update attachments" on storage.objects
  for update to authenticated using (bucket_id = 'job-attachments');
create policy "auth delete attachments" on storage.objects
  for delete to authenticated using (bucket_id = 'job-attachments');

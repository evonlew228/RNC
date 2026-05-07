-- Extend contacts with department + location fields
alter table contacts
  add column if not exists department text,
  add column if not exists location text;

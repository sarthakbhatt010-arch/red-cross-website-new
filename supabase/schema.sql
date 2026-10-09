create extension if not exists pgcrypto;

create table if not exists public.yrc_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  contact_number text not null check (char_length(contact_number) between 7 and 20),
  department text not null check (char_length(department) between 1 and 120),
  year text not null check (year in ('1', '2', '3', '4', 'other')),
  academic_details jsonb not null,
  document_path text not null unique,
  document_original_name text not null,
  document_content_type text not null check (document_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  document_size bigint not null check (document_size between 1 and 4194304),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint yrc_academic_details_match_year check (
    (year = '1' and academic_details ? 'class12Marks' and not (academic_details ? 'cgpa'))
    or
    (year <> '1' and academic_details ? 'cgpa' and not (academic_details ? 'class12Marks'))
  )
);

alter table public.yrc_applications enable row level security;
revoke all on table public.yrc_applications from anon, authenticated;
grant select, insert on table public.yrc_applications to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yrc-application-documents',
  'yrc-application-documents',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

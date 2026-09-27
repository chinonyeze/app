-- Phase 2 only: apply once to the intended Supabase project using SQL Editor.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 200),
  last_name text not null default '' check (char_length(last_name) <= 200),
  email text not null,
  medical_school text not null default '' check (char_length(medical_school) <= 200),
  specialty text not null default '' check (char_length(specialty) <= 200),
  applicant_type text check (applicant_type in ('US MD', 'US DO', 'US IMG', 'Non-US IMG', 'Other')),
  graduation_year integer check (graduation_year between 1900 and 2100),
  current_status text not null default '' check (char_length(current_status) <= 200),
  interview_season text not null default '' check (char_length(interview_season) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- Explicit grants override any permissive public-schema defaults.
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, medical_school, specialty, applicant_type,
  graduation_year, current_status, interview_season) on public.profiles to authenticated;

create policy "Read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- No browser insert/delete policy. Rows are provisioned only by the auth trigger.

create function public.matchprep_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;
revoke all on function public.matchprep_create_profile() from public, anon, authenticated;
create trigger matchprep_auth_user_created after insert on auth.users
  for each row execute function public.matchprep_create_profile();

-- Handle existing accounts if Auth was configured before this migration.
insert into public.profiles (id, email)
  select id, coalesce(email, '') from auth.users on conflict (id) do nothing;

create function public.matchprep_sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
revoke all on function public.matchprep_sync_profile_email() from public, anon, authenticated;
create trigger matchprep_auth_email_updated after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.matchprep_sync_profile_email();

create function public.matchprep_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.matchprep_profile_updated_at() from public, anon, authenticated;
create trigger matchprep_profile_updated before update on public.profiles
  for each row execute function public.matchprep_profile_updated_at();

commit;

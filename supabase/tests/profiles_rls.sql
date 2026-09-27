-- Run in SQL Editor after the migration. All fixtures are rolled back.
-- Do not use real user IDs here. No accounts with passwords are created.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'phase2-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', 'phase2-b@example.invalid');

do $$ begin
  assert (select count(*) from public.profiles where id in
    ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2')) = 2,
    'Auth trigger must create both profiles';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$ declare n integer; begin
  assert (select count(*) from public.profiles) = 1, 'User A must see only their row';
  update public.profiles set first_name = 'Test A' where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count;
  assert n = 1, 'User A must be able to update their row';
  update public.profiles set first_name = 'Forbidden' where id = '00000000-0000-4000-8000-0000000000b2';
  get diagnostics n = row_count;
  assert n = 0, 'User A cannot update User B';
  begin
    update public.profiles set email = 'forged@example.invalid';
    raise exception 'Users must not change account email through profiles';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set id = '00000000-0000-4000-8000-0000000000b2';
    raise exception 'Users must not change profile identity';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set created_at = now();
    raise exception 'Users must not change creation timestamps';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(id, email) values ('00000000-0000-4000-8000-0000000000c3', 'forged@example.invalid');
    raise exception 'Browser inserts must not be allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.profiles;
    raise exception 'Browser deletion must not be allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set applicant_type = 'admin';
    raise exception 'Invalid applicant type must be rejected';
  exception when check_violation then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'User B must see only their row';
  assert (select first_name from public.profiles) = '', 'User B must remain unchanged';
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.profiles;
    raise exception 'Anonymous reads must be denied';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
update auth.users set email = 'phase2-updated@example.invalid' where id = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  assert (select email from public.profiles where id = '00000000-0000-4000-8000-0000000000a1') = 'phase2-updated@example.invalid', 'Auth email changes must sync';
end $$;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  assert not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'Deleting auth user must cascade';
end $$;
rollback;

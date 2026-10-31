begin;

create table if not exists public.navigation_bookmark_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint navigation_entries_array check (
    jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 5000
  )
);

alter table public.navigation_bookmark_state enable row level security;
alter table public.navigation_bookmark_state force row level security;

revoke all on public.navigation_bookmark_state from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.navigation_bookmark_state to authenticated;
grant insert (user_id, entries) on public.navigation_bookmark_state to authenticated;
grant update (entries) on public.navigation_bookmark_state to authenticated;

drop policy if exists navigation_select_own on public.navigation_bookmark_state;
create policy navigation_select_own on public.navigation_bookmark_state
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists navigation_insert_own on public.navigation_bookmark_state;
create policy navigation_insert_own on public.navigation_bookmark_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists navigation_update_own on public.navigation_bookmark_state;
create policy navigation_update_own on public.navigation_bookmark_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.navigation_bump_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.navigation_bump_revision() from public, anon;
grant execute on function public.navigation_bump_revision() to authenticated;
drop trigger if exists navigation_revision on public.navigation_bookmark_state;
create trigger navigation_revision before update on public.navigation_bookmark_state
  for each row execute function public.navigation_bump_revision();

commit;

-- Verification: the result must show row_security=true and three owner-only policies.
select c.relrowsecurity as row_security,
       c.relforcerowsecurity as force_row_security,
       (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'navigation_bookmark_state';

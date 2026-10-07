-- Public, non-personal configuration. Only the guarded server endpoint writes.
create table if not exists public.global_theme (
  id smallint primary key default 1 check (id = 1),
  theme_key text not null default 'default'
    check (theme_key in ('default', 'dashain', 'tihar', 'christmas', 'new-year')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.global_theme enable row level security;
revoke all on public.global_theme from anon, authenticated;
grant select on public.global_theme to anon, authenticated;
grant all on public.global_theme to service_role;
drop policy if exists "global_theme_public_read" on public.global_theme;
create policy "global_theme_public_read" on public.global_theme
  for select to anon, authenticated using (true);

-- Database-issued revisions let clients ignore late HTTP/Realtime responses.
create or replace function public.bump_global_theme_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.bump_global_theme_version() from public, anon, authenticated;
drop trigger if exists global_theme_version on public.global_theme;
create trigger global_theme_version before update on public.global_theme
  for each row execute function public.bump_global_theme_version();

insert into public.global_theme (id, theme_key) values (1, 'default')
on conflict (id) do nothing;

-- Rerunnable, including projects which have not yet enabled Realtime.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'global_theme'
  ) then
    alter publication supabase_realtime add table public.global_theme;
  end if;
end;
$$;

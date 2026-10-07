-- ============================================================================
-- FORGE STRENGTH CLUB — security hotfix: RLS + PII hardening
-- ----------------------------------------------------------------------------
-- Apply to the LIVE Supabase project (SQL Editor → paste → Run, or
-- `supabase db push`). Idempotent: safe to run repeatedly.
--
-- Verified against production before this migration:
--
--   1. CRITICAL — `profiles` was world-readable.
--      Policy `profiles_read_all ... using (true)` allowed the ANONYMOUS role
--      (whose key ships in the browser bundle) to read every column of every
--      profile: email, role, membership_status, membership_expires_at,
--      plan_id, join_date. Confirmed live — it returned real member email
--      addresses and identified the admin account.
--
--   2. CRITICAL — the `avatars` storage bucket was world-listable.
--      Policy `avatars_select_all ... using (bucket_id = 'avatars')` let the
--      anonymous role LIST every object, yielding all member UUIDs. Combined
--      with (1) this formed a complete, unauthenticated user directory.
--
--   3. CRITICAL (latent) — `payments` was never `enable row level security`ed
--      by schema.sql, so its policies were inert. On any fresh deploy the
--      complete payment table (amounts, transaction ids, gateway references,
--      raw gateway responses) would be readable AND writable by anyone
--      holding the anon key. The live project has RLS enabled manually, so it
--      was not exploitable there — but the schema did not reproduce that
--      safety. This migration makes the schema authoritative and also removes
--      the client-side INSERT policy so members cannot forge completed
--      payments.
--
--   4. HIGH — `profiles_update_own` only proved row ownership, so a member
--      could PATCH their own row to set membership_status='active', plan_id
--      and membership_expires_at, self-granting a paid membership and class
--      booking access. Only `role` was protected.
--
--   5. HIGH — `bookings_insert_own` only checked `auth.uid() = user_id`, so a
--      member could INSERT a `confirmed` booking directly, bypassing every
--      check book_class() performs (active membership, class not started,
--      capacity not exceeded). All booking creation now goes through the RPC.
--
--   6. MEDIUM — `classes_public` was a plain view, which runs with its
--      definer's privileges and bypasses RLS on every table it touches.
--
-- No application code changes are required: every read of `profiles` in the
-- codebase is already scoped to the caller's own row or gated on the admin
-- role, and all admin mutations go through the service-role client.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. payments — enable RLS and remove the client-writable policies
-- ----------------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "payments_insert_own"   on public.payments;
drop policy if exists "payments_update_admin" on public.payments;
drop policy if exists "payments_delete_admin" on public.payments;

drop policy if exists "payments_read_own" on public.payments;
create policy "payments_read_own"
  on public.payments for select
  using (auth.uid() = user_id or public.is_admin());

-- Payment rows are only ever written by the service-role client
-- (/api/payments/checkout + the signature-verified gateway callbacks).
revoke insert, update, delete on public.payments from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. profiles — stop the anonymous user-directory leak
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_all"          on public.profiles;
drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- Profile rows come from the on_auth_user_created trigger or admin actions.
revoke insert on public.profiles from anon, authenticated;
revoke delete on public.profiles from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. profiles — block self-assignment of paid entitlements
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / server-side admin client: auth.uid() is null -> allowed
  if auth.uid() is null then
    return new;
  end if;

  -- verified admins may change any privileged column
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'FORBIDDEN: role changes require admin privileges';
  end if;
  if new.membership_status is distinct from old.membership_status then
    raise exception 'FORBIDDEN: membership_status changes require admin privileges';
  end if;
  if new.plan_id is distinct from old.plan_id then
    raise exception 'FORBIDDEN: plan_id changes require admin privileges';
  end if;
  if new.membership_expires_at is distinct from old.membership_expires_at then
    raise exception 'FORBIDDEN: membership_expires_at changes require admin privileges';
  end if;
  if new.join_date is distinct from old.join_date then
    raise exception 'FORBIDDEN: join_date is immutable';
  end if;
  if new.email is distinct from old.email then
    raise exception 'FORBIDDEN: email is managed by Supabase Auth';
  end if;
  if new.id is distinct from old.id then
    raise exception 'FORBIDDEN: id is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation     on public.profiles;
drop trigger if exists trg_protect_profile_privileged  on public.profiles;
create trigger trg_protect_profile_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();


-- ----------------------------------------------------------------------------
-- 4. classes_public — stop bypassing RLS
-- ----------------------------------------------------------------------------
-- The headcount comes from a SECURITY DEFINER function returning only an
-- integer, so invoker mode still yields correct numbers for anonymous
-- schedule visitors while booking rows stay invisible.
create or replace function public.class_confirmed_count(p_class_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.bookings b
  where b.class_id = p_class_id
    and b.booking_status = 'confirmed';
$$;

drop view if exists public.classes_public;

do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute $view$
      create view public.classes_public with (security_invoker = true) as
      select c.*, public.class_confirmed_count(c.id) as booked_count
      from public.classes c
    $view$;
  else
    execute $view$
      create view public.classes_public as
      select c.*, public.class_confirmed_count(c.id) as booked_count
      from public.classes c
    $view$;
  end if;
end;
$$;

grant select on public.classes_public to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. bookings — close the capacity/membership bypass
-- ----------------------------------------------------------------------------
-- `bookings_insert_own` only required auth.uid() = user_id, so a member could
-- INSERT a confirmed booking directly and skip every check book_class()
-- performs (active membership, class not started, capacity not exceeded).
-- All booking creation goes through the RPC, so the policy is removed.
drop policy if exists "bookings_insert_own" on public.bookings;

revoke insert, delete on public.bookings from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. storage — stop the anonymous avatars/user enumeration
-- ----------------------------------------------------------------------------
-- Multiple PERMISSIVE policies on the same command are OR-ed, so exactly ONE
-- select policy may exist per bucket. These are consolidated accordingly.
-- Rendering is unaffected: public-bucket object URLs are served from
-- /object/public/ and bypass RLS, so <img> tags keep working.
drop policy if exists "avatars_select_all"          on storage.objects;
drop policy if exists "avatars_read_authenticated"  on storage.objects;
drop policy if exists "avatars_list_own_folder"     on storage.objects;
drop policy if exists "avatars_read_own_folder"     on storage.objects;
create policy "avatars_read_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "covers_select_all"          on storage.objects;
drop policy if exists "covers_read_authenticated"  on storage.objects;
drop policy if exists "covers_read_admin"          on storage.objects;
create policy "covers_read_admin"
  on storage.objects for select
  using (
    bucket_id in ('class-covers', 'site-assets')
    and public.is_admin()
  );


-- ----------------------------------------------------------------------------
-- 7. grants — make a future RLS omission fail CLOSED
-- ----------------------------------------------------------------------------
revoke insert, update, delete on public.classes      from anon;
revoke insert, update, delete on public.plans        from anon;
revoke insert, update, delete on public.announcements from anon;
revoke insert, update, delete on public.site_content from anon;

revoke insert, update, delete on public.classes      from authenticated;
revoke insert, update, delete on public.plans        from authenticated;
revoke insert, update, delete on public.announcements from authenticated;
revoke insert, update, delete on public.site_content from authenticated;


-- ----------------------------------------------------------------------------
-- 8. function privileges — Postgres grants EXECUTE to PUBLIC by default
-- ----------------------------------------------------------------------------
revoke all on function public.is_admin() from public;
-- The function only answers whether the current caller is an admin; for an
-- anonymous caller auth.uid() is null and it returns false. Anonymous
-- execute is required because public/storage RLS expressions reference it.
grant  execute on function public.is_admin() to anon, authenticated, service_role;

revoke all on function public.class_confirmed_count(uuid) from public;
grant  execute on function public.class_confirmed_count(uuid) to anon, authenticated, service_role;

revoke all on function public.book_class(uuid) from public;
revoke execute on function public.book_class(uuid) from anon;
grant  execute on function public.book_class(uuid) to authenticated, service_role;

revoke all on function public.protect_profile_privileged_columns() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;
revoke execute on function public.protect_profile_privileged_columns() from anon, authenticated, service_role;
revoke execute on function public.handle_new_user() from anon, authenticated, service_role;
revoke execute on function public.set_updated_at() from anon, authenticated, service_role;
do $$
begin
  if to_regprocedure('public.prevent_role_escalation()') is not null then
    revoke execute on function public.prevent_role_escalation() from public, anon, authenticated, service_role;
  end if;
end;
$$;
alter function public.set_updated_at() set search_path = public;


-- ============================================================================
-- VERIFICATION — run after applying. EVERY row must report true.
-- ============================================================================
select
  c.relname                       as table_name,
  c.relrowsecurity                as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relrowsecurity, c.relname;

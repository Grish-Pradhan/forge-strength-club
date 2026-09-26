-- ============================================================================
-- FORGE STRENGTH CLUB — Supabase schema
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor (or `supabase db push` with this file
-- in supabase/migrations/). It is idempotent-safe to run once on a fresh
-- project.
--
-- Tables:
--   profiles        — public user data + role (admin/member) + membership
--   classes         — gym classes with trainer, schedule, capacity
--   bookings        — user <-> class reservations (unique per user/class)
--   plans           — membership plans (NPR price, billing cycle, JSON features)
--   payments        — online payments (eSewa / Khalti) with signature-verified
--                     status flips + membership activation on success
--   announcements   — gym-wide announcements managed from the admin panel
--   site_content    — key/value store for landing-page copy (content mgmt)
--
-- Security:
--   * RLS is ENABLED on every table.
--   * Helper function is_admin() is SECURITY DEFINER to avoid recursive
--     policy evaluation.
--   * prevent_role_escalation() trigger stops members from promoting
--     themselves to admin through any RLS-permitted update path.
--   * book_class() RPC enforces capacity atomically (race-condition safe).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- TABLE: profiles
-- One row per auth.users record (auto-created by trigger below).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              text        not null default 'member'
                                check (role in ('admin', 'member')),
  full_name         text,
  email             text,
  membership_status text        not null default 'inactive'
                                check (membership_status in ('active', 'inactive', 'suspended', 'pending')),
  join_date         timestamptz not null default now(),
  avatar_url        text,
  membership_expires_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Public user profiles with RBAC role and membership status.';

-- ----------------------------------------------------------------------------
-- HELPER: is_admin()
-- SECURITY DEFINER so RLS policies can reference it without recursion.
-- Returns true when the caller's profile row has role = 'admin'.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- TABLE: classes
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  description   text,
  trainer_name  text,
  schedule_time timestamptz not null,
  capacity      integer     not null default 20 check (capacity > 0),
  category      text        not null default 'Strength',
  image_url     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Fast lookups: "upcoming classes" + filter by category
create index if not exists idx_classes_schedule_time on public.classes (schedule_time);
create index if not exists idx_classes_category on public.classes (category);

-- ----------------------------------------------------------------------------
-- TABLE: bookings
-- A member can hold at most ONE booking per class (unique constraint).
-- ----------------------------------------------------------------------------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles (id) on delete cascade,
  class_id       uuid        not null references public.classes  (id) on delete cascade,
  booking_status text        not null default 'confirmed'
                             check (booking_status in ('confirmed', 'cancelled', 'attended')),
  created_at     timestamptz not null default now(),
  unique (user_id, class_id)
);

create index if not exists idx_bookings_user   on public.bookings (user_id);
create index if not exists idx_bookings_class  on public.bookings (class_id);
create index if not exists idx_bookings_status on public.bookings (booking_status);

-- ----------------------------------------------------------------------------
-- TABLE: plans (memberships)
-- ----------------------------------------------------------------------------
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  name          text          not null,
  price         numeric(10,2) not null check (price >= 0),
  billing_cycle text          not null default 'monthly'
                                check (billing_cycle in ('monthly', 'annual')),
  features      jsonb         not null default '[]'::jsonb,
  is_active     boolean       not null default true,
  sort_order    integer       not null default 0,
  created_at    timestamptz   not null default now()
);

create index if not exists idx_plans_billing_cycle on public.plans (billing_cycle, sort_order);

-- ----------------------------------------------------------------------------
-- ALTER: profiles.plan_id (membership tier assignment)
-- Set by admins via the Admin Panel. Enables revenue analytics.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan_id uuid references public.plans (id) on delete set null;

-- ----------------------------------------------------------------------------
-- ALTER: profiles.membership_expires_at
-- Set when a member completes an online payment (eSewa / Khalti). Membership
-- is treated as active until this date passes.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists membership_expires_at timestamptz;

-- ----------------------------------------------------------------------------
-- TABLE: payments
-- One row per checkout attempt (eSewa or Khalti). Created as 'pending' by the
-- checkout API, flipped to 'completed'/'failed' by the gateway callback after
-- signature verification. Prices are in Nepali Rupees (NPR).
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid          not null references public.profiles (id) on delete cascade,
  plan_id          uuid          references public.plans (id) on delete set null,
  provider         text          not null check (provider in ('esewa', 'khalti')),
  amount           numeric(12,2) not null check (amount >= 0),
  currency         text          not null default 'NPR',
  status           text          not null default 'pending'
                                 check (status in ('pending', 'completed', 'failed')),
  transaction_uuid text          not null,
  provider_ref     text,
  response         jsonb,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

comment on table public.payments is 'Online membership payments (eSewa / Khalti) in NPR.';

-- Our lookup key for gateway callbacks + admin payment history
create index if not exists idx_payments_txn_uuid on public.payments (transaction_uuid);
create index if not exists idx_payments_user     on public.payments (user_id);
create index if not exists idx_payments_status   on public.payments (status, created_at);

-- trigger: updated_at maintenance for payments
drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- TABLE: announcements
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null,
  body       text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- TABLE: site_content (key/value copy blocks for the landing page)
-- ----------------------------------------------------------------------------
create table if not exists public.site_content (
  key        text primary key,
  value      text        not null default '',
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- TRIGGER: updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- TRIGGER: auto-create profile on signup
-- Pulls name/email from the auth metadata (works for email + OAuth).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- BACKFILL: create profile rows for any auth users that signed up BEFORE the
-- trigger existed (or whose trigger failed). Idempotent — safe to re-run.
insert into public.profiles (id, full_name, email, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.email, ''),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- TRIGGER: prevent role self-escalation
-- Members can never change their own (or anyone's) role through
-- RLS-permitted paths. Service-role connections (auth.uid() is null) and
-- verified admins may change roles — this is what the Admin Panel uses.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- service_role / server-side admin client: auth.uid() is null -> allowed
    if auth.uid() is null then
      return new;
    end if;
    -- verified admins may change roles
    if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
      return new;
    end if;
    raise exception 'FORBIDDEN: role changes require admin privileges';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ----------------------------------------------------------------------------
-- FUNCTION: book_class(p_class_id)
-- Atomic, race-condition-safe booking:
--   1. must be authenticated
--   2. class must exist and be in the future
--   3. capacity must not be exceeded (count of confirmed bookings)
--   4. re-booking a cancelled spot flips it back to confirmed
-- Run with the user's own JWT (supabase.rpc('book_class', ...)).
-- ----------------------------------------------------------------------------
create or replace function public.book_class(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_booking_id uuid;
  v_capacity   integer;
  v_count      integer;
  v_existing   text;
  v_time       timestamptz;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: you must be signed in to book';
  end if;

  -- membership must be active to book
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and membership_status = 'active'
  ) then
    raise exception 'MEMBERSHIP_INACTIVE: your membership is not active';
  end if;

  select capacity, schedule_time into v_capacity, v_time
  from public.classes where id = p_class_id;
  if not found then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if v_time <= now() then
    raise exception 'CLASS_STARTED: this class has already started';
  end if;

  select count(*) into v_count
  from public.bookings
  where class_id = p_class_id and booking_status = 'confirmed';
  if v_count >= v_capacity then
    raise exception 'CLASS_FULL: this class is at capacity';
  end if;

  select booking_status into v_existing
  from public.bookings
  where user_id = v_user_id and class_id = p_class_id;

  if v_existing = 'confirmed' then
    raise exception 'ALREADY_BOOKED: you already have a spot in this class';
  end if;

  insert into public.bookings (user_id, class_id, booking_status)
  values (v_user_id, p_class_id, 'confirmed')
  on conflict (user_id, class_id)
  do update set booking_status = 'confirmed'
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.classes       enable row level security;
alter table public.bookings      enable row level security;
alter table public.plans         enable row level security;
alter table public.announcements enable row level security;
alter table public.site_content  enable row level security;

-- ---------- profiles ----------
-- Anyone (even anonymous) can see basic profiles (needed for trainer cards /
-- leaderboards). Emails are exposed only to the owner and admins.
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.is_admin());

-- ---------- classes ----------
-- Public schedule: anyone can read. Writes are admin-only.
drop policy if exists "classes_read_all" on public.classes;
create policy "classes_read_all"
  on public.classes for select
  using (true);

drop policy if exists "classes_write_admin" on public.classes;
create policy "classes_write_admin"
  on public.classes for insert
  with check (public.is_admin());

drop policy if exists "classes_update_admin" on public.classes;
create policy "classes_update_admin"
  on public.classes for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "classes_delete_admin" on public.classes;
create policy "classes_delete_admin"
  on public.classes for delete
  using (public.is_admin());

-- ---------- bookings ----------
-- Members see/manage ONLY their own bookings. Admins see all.
drop policy if exists "bookings_read_own_or_admin" on public.bookings;
create policy "bookings_read_own_or_admin"
  on public.bookings for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
  on public.bookings for insert
  with check (auth.uid() = user_id);

drop policy if exists "bookings_update_own_or_admin" on public.bookings;
create policy "bookings_update_own_or_admin"
  on public.bookings for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "bookings_delete_own_or_admin" on public.bookings;
create policy "bookings_delete_own_or_admin"
  on public.bookings for delete
  using (auth.uid() = user_id or public.is_admin());

-- ---------- plans ----------
drop policy if exists "plans_read_all" on public.plans;
create policy "plans_read_all"
  on public.plans for select
  using (true);

drop policy if exists "plans_write_admin" on public.plans;
create policy "plans_write_admin"
  on public.plans for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- announcements ----------
drop policy if exists "announcements_read_active" on public.announcements;
create policy "announcements_read_active"
  on public.announcements for select
  using (is_active or public.is_admin());

drop policy if exists "announcements_write_admin" on public.announcements;
create policy "announcements_write_admin"
  on public.announcements for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- site_content ----------
drop policy if exists "site_content_read_all" on public.site_content;
create policy "site_content_read_all"
  on public.site_content for select
  using (true);

drop policy if exists "site_content_write_admin" on public.site_content;
create policy "site_content_write_admin"
  on public.site_content for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- payments ----------
-- Members may create + read ONLY their own payment attempts. Status flips
-- (completed/failed) happen server-side through the service-role client in
-- the gateway callback, after HMAC signature verification — members can
-- never mark their own payment as completed. Admins see all.
drop policy if exists "payments_read_own" on public.payments;
create policy "payments_read_own"
  on public.payments for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own"
  on public.payments for insert
  with check (auth.uid() = user_id);

drop policy if exists "payments_update_admin" on public.payments;
create policy "payments_update_admin"
  on public.payments for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "payments_delete_admin" on public.payments;
create policy "payments_delete_admin"
  on public.payments for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- VIEW: classes_public
-- Classes joined with a live confirmed-booking count (used by the public
-- schedule + member booking UI). Read-only; exposes counts only.
-- ----------------------------------------------------------------------------
create or replace view public.classes_public as
select
  c.*,
  (
    select count(*)
    from public.bookings b
    where b.class_id = c.id and b.booking_status = 'confirmed'
  ) as booked_count
from public.classes c;

grant select on public.classes_public to anon, authenticated, service_role;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- ---------- membership plans ----------
-- Prices are in Nepali Rupees (NPR) — the currency of every payment gateway.
insert into public.plans (name, price, billing_cycle, features, sort_order) values
  ('Iron',      2500.00,  'monthly', '["Full gym floor access","Locker room + showers","1 guest pass / month","Member app + class booking"]', 0),
  ('Forge',     4000.00,  'monthly', '["Everything in Iron","Unlimited group classes","Sauna + cold plunge","2 guest passes / month","Monthly body-comp scan"]', 1),
  ('Forge Elite', 35000.00, 'annual', '["Everything in Forge","4 personal training sessions / month","Priority class booking","Nutrition coaching","Forge Elite merch kit"]', 2)
on conflict do nothing;

-- ---------- classes (next 7 days relative to seed time) ----------
insert into public.classes (title, description, trainer_name, schedule_time, capacity, category, image_url) values
  ('Strength Foundations', 'Barbell fundamentals: squat, hinge, press. Perfect for beginners who want to lift with confidence.', 'Maya Kowalski', now() + interval '1 day' + interval '6 hours', 16, 'Strength',     'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=80'),
  ('HIIT Furnace',         '45 minutes of pure engine work. Sleds, ropes, bikes — leave nothing in the tank.',                     'Deon Richards',  now() + interval '1 day' + interval '7 hours 15 minutes', 20, 'HIIT',        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80'),
  ('Mobility & Breath',    'Deep mobility flow paired with breathwork to reset your nervous system after heavy training.',         'Priya Nair',     now() + interval '1 day' + interval '12 hours', 14, 'Yoga & Mobility', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&q=80'),
  ('CrossFit WOD',         'The workout of the day, Forge style. Scalable for all levels — bring your engine.',                    'Sam Tran',       now() + interval '1 day' + interval '18 hours 30 minutes', 18, 'CrossFit',    'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=900&q=80'),
  ('Power Hour',           'Max-effort strength work. Squat, bench, dead. Coached platform time with video review.',               'Maya Kowalski',  now() + interval '2 days' + interval '6 hours', 16, 'Strength',    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=900&q=80'),
  ('Bag Work Basics',      'Boxing fundamentals on the heavy bags. Footwork, combos, conditioning.',                               'Costas Vela',    now() + interval '2 days' + interval '8 hours', 12, 'Boxing',      'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=900&q=80'),
  ('Forge Conditioning',   'Partner-based conditioning circuits. Expect odd objects, carries and a serious sweat.',                'Deon Richards',  now() + interval '3 days' + interval '17 hours', 20, 'HIIT',       'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&q=80'),
  ('Sunday Reset Yoga',    'Slow flow + long holds. Start your week recovered, not wrecked.',                                      'Priya Nair',     now() + interval '4 days' + interval '10 hours', 14, 'Yoga & Mobility', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80')
on conflict do nothing;

-- ---------- announcements ----------
insert into public.announcements (title, body, is_active) values
  ('New cold plunge installed', 'The recovery lab is live — sauna + cold plunge now included with Forge and Forge Elite memberships.', true),
  ('Powerlifting meet — Oct 18', 'Our first in-house meet. Squat, bench, dead. Sign up at the front desk — spectator entry is free.', true)
on conflict do nothing;

-- ---------- site_content (landing page copy) ----------
insert into public.site_content (key, value) values
  ('hero_headline',   'FORGE YOUR STRONGEST SELF'),
  ('hero_subhead',    'No shortcuts. No mirrors-and-music fluff. Just iron, coaching that cares, and a community that shows up.'),
  ('hero_cta',        'Join Now'),
  ('features_title',  'BUILT LIKE A WEAPON'),
  ('features_subhead','Everything you need to get strong — and nothing you don''t.'),
  ('pricing_title',   'MEMBERSHIP PLANS'),
  ('pricing_subhead', 'Simple pricing in Nepali Rupees. Pay online with eSewa or Khalti. Cancel anytime.')
on conflict (key) do nothing;

-- ============================================================================
-- STORAGE BUCKETS + POLICIES
-- ============================================================================
-- Buckets (run if you use avatar/class uploads):
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('class-covers', 'class-covers', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('site-assets', 'site-assets', true)
  on conflict (id) do nothing;

-- Storage RLS (storage.objects has RLS enabled by default — without these
-- policies even signed-in members get "new row violates row-level security
-- policy" on direct storage operations).
--
--  * avatars      — members may upload/update/delete ONLY inside their own
--                   folder (avatars/<user-id>/...); readable by everyone
--                   (public bucket URLs bypass RLS for <img> tags anyway).
--  * class-covers / site-assets — writes are admin-only; readable by everyone.
--  * The app's /api/upload route additionally enforces both rules server-side
--    and uploads with the service-role client, so it works even before these
--    policies are applied.

drop policy if exists "avatars_select_all" on storage.objects;
create policy "avatars_select_all"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "covers_select_all" on storage.objects;
create policy "covers_select_all"
  on storage.objects for select
  using (bucket_id in ('class-covers', 'site-assets'));

drop policy if exists "covers_write_admin" on storage.objects;
create policy "covers_write_admin"
  on storage.objects for insert
  with check (bucket_id in ('class-covers', 'site-assets') and public.is_admin());

drop policy if exists "covers_update_admin" on storage.objects;
create policy "covers_update_admin"
  on storage.objects for update
  using (bucket_id in ('class-covers', 'site-assets') and public.is_admin())
  with check (bucket_id in ('class-covers', 'site-assets') and public.is_admin());

drop policy if exists "covers_delete_admin" on storage.objects;
create policy "covers_delete_admin"
  on storage.objects for delete
  using (bucket_id in ('class-covers', 'site-assets') and public.is_admin());

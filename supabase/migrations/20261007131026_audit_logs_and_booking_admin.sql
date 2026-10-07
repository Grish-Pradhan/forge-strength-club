-- Tamper-resistant, admin-only activity and security history.
create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text        not null check (char_length(event_type) between 1 and 80),
  category    text        not null default 'activity'
                          check (category in ('activity', 'booking', 'auth', 'admin', 'security')),
  severity    text        not null default 'info'
                          check (severity in ('info', 'success', 'warning', 'critical')),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text,
  actor_email text,
  ip_address  inet,
  path        text,
  description text        not null,
  metadata    jsonb       not null default '{}'::jsonb,
  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table public.audit_events is
  'Private activity/security trail. Identity fields are snapshots retained after account deletion.';

create index if not exists idx_audit_events_created_at
  on public.audit_events (created_at desc);
create index if not exists idx_audit_events_category_created
  on public.audit_events (category, created_at desc);
create index if not exists idx_audit_events_actor_created
  on public.audit_events (actor_id, created_at desc)
  where actor_id is not null;

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_read_admin" on public.audit_events;
create policy "audit_events_read_admin"
  on public.audit_events for select to authenticated
  using ((select public.is_admin()));

-- Logs are append-only from trusted server code. Even admins cannot alter
-- history through the browser client.
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;

-- Replace the member booking function with a row lock so capacity checks are
-- truly atomic when several people book the final spot simultaneously.
create or replace function public.book_class(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := (select auth.uid());
  v_booking_id uuid;
  v_capacity   integer;
  v_count      integer;
  v_existing   text;
  v_time       timestamptz;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED: you must be signed in to book';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and membership_status = 'active'
  ) then
    raise exception 'MEMBERSHIP_INACTIVE: your membership is not active';
  end if;

  select capacity, schedule_time into v_capacity, v_time
  from public.classes
  where id = p_class_id
  for update;

  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  if v_time <= now() then raise exception 'CLASS_STARTED: this class has already started'; end if;

  select booking_status into v_existing
  from public.bookings
  where user_id = v_user_id and class_id = p_class_id;

  if v_existing = 'confirmed' then
    raise exception 'ALREADY_BOOKED: you already have a spot in this class';
  end if;

  select count(*) into v_count
  from public.bookings
  where class_id = p_class_id and booking_status = 'confirmed';

  if v_count >= v_capacity then
    raise exception 'CLASS_FULL: this class is at capacity';
  end if;

  insert into public.bookings (user_id, class_id, booking_status)
  values (v_user_id, p_class_id, 'confirmed')
  on conflict (user_id, class_id)
  do update set booking_status = 'confirmed'
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- Admin-only equivalent used by the dashboard to book a class for any user.
create or replace function public.admin_book_user(p_user_id uuid, p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_capacity   integer;
  v_count      integer;
  v_existing   text;
  v_time       timestamptz;
begin
  if not (select public.is_admin()) then
    raise exception 'FORBIDDEN: admin privileges required';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  select capacity, schedule_time into v_capacity, v_time
  from public.classes
  where id = p_class_id
  for update;

  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  if v_time <= now() then raise exception 'CLASS_STARTED: this class has already started'; end if;

  select booking_status into v_existing
  from public.bookings
  where user_id = p_user_id and class_id = p_class_id;

  if v_existing = 'confirmed' then return (
    select id from public.bookings where user_id = p_user_id and class_id = p_class_id
  ); end if;

  select count(*) into v_count
  from public.bookings
  where class_id = p_class_id and booking_status = 'confirmed';

  if v_count >= v_capacity then
    raise exception 'CLASS_FULL: this class is at capacity';
  end if;

  insert into public.bookings (user_id, class_id, booking_status)
  values (p_user_id, p_class_id, 'confirmed')
  on conflict (user_id, class_id)
  do update set booking_status = 'confirmed'
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.admin_book_user(uuid, uuid) from public, anon;
grant execute on function public.admin_book_user(uuid, uuid) to authenticated, service_role;

revoke all on function public.book_class(uuid) from public;
revoke execute on function public.book_class(uuid) from anon;
grant execute on function public.book_class(uuid) to authenticated, service_role;

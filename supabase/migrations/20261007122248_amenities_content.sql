-- Editable landing-page amenity cards.
-- Public visitors can read active rows; inactive rows are visible only to admins.
create table if not exists public.amenities (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null check (char_length(title) between 1 and 100),
  description text,
  image_url   text,
  icon_name   text        not null default 'dumbbell'
                          check (icon_name in ('dumbbell', 'flame', 'waves', 'clipboard', 'users', 'heart')),
  layout      text        not null default 'standard'
                          check (layout in ('standard', 'wide', 'large')),
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_amenities_active_order
  on public.amenities (is_active, sort_order);

drop trigger if exists trg_amenities_updated_at on public.amenities;
create trigger trg_amenities_updated_at
  before update on public.amenities
  for each row execute function public.set_updated_at();

alter table public.amenities enable row level security;

drop policy if exists "amenities_read_public" on public.amenities;
create policy "amenities_read_public"
  on public.amenities for select to anon
  using (is_active);

drop policy if exists "amenities_read_authenticated" on public.amenities;
create policy "amenities_read_authenticated"
  on public.amenities for select to authenticated
  using (is_active or public.is_admin());

-- Admin mutations go through guarded Server Actions using the service role.
-- Browser roles remain read-only even if a future policy is accidentally broad.
revoke insert, update, delete on public.amenities from anon, authenticated;
grant select on public.amenities to anon, authenticated;
grant all on public.amenities to service_role;

insert into public.amenities
  (id, title, description, image_url, icon_name, layout, is_active, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'Elite Strength Floor',
   'Competition-grade platforms, calibrated plates, dumbbells to 60kg. Everything you need to chase PRs — and nothing you don''t.',
   '/amenities/strength-floor.webp', 'dumbbell', 'large', true, 0),
  ('10000000-0000-4000-8000-000000000002', 'HIIT Arena',
   'Sled track, assault bikes, ropes and rig.',
   '/amenities/hiit-arena.webp', 'flame', 'standard', true, 1),
  ('10000000-0000-4000-8000-000000000003', 'Recovery Lab',
   'Sauna + cold plunge, included with Forge plans.',
   '/amenities/recovery-lab.webp', 'waves', 'standard', true, 2),
  ('10000000-0000-4000-8000-000000000004', 'Personal Training',
   '1-on-1 coaching with video review and periodised programming.',
   '/amenities/personal-training.webp', 'clipboard', 'wide', true, 3),
  ('10000000-0000-4000-8000-000000000005', 'Community That Shows Up',
   'In-house meets, team WODs and a floor culture built on effort.',
   '/amenities/community.webp', 'users', 'wide', true, 4),
  ('10000000-0000-4000-8000-000000000006', 'Body-Comp Scanning',
   'Monthly InBody scans so progress is measured, not guessed.',
   '/amenities/body-comp.webp', 'heart', 'standard', true, 5)
on conflict (id) do nothing;

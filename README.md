# Forge Strength Club

A full-stack gym platform — **Next.js (App Router) + Supabase**, with Framer Motion
animations, Tailwind CSS, Lucide icons and React Query data fetching.

> The previous Express + static-HTML version of this site is archived in `_legacy/`.

## Feature Overview

| Area | What's inside |
| --- | --- |
| **Public landing page** (`/`) | Full-screen hero with staggered entrance animations, announcements marquee, Bento-grid amenities, filterable class schedule, pricing in **Nepali Rupees (Rs.)** with Monthly/Annual toggle, final CTA band |
| **Auth** (`/login`, `/register`) | Email/password + OAuth (Google/Apple), error banners, email-confirmation flow |
| **Member dashboard** (`/dashboard`) | Personalized greeting + membership status, quick actions, one-click class booking (atomic RPC), booking management, profile & settings |
| **Online payments** (`/dashboard/profile`, `/payment/*`) | Pay for any plan with **eSewa** or **Khalti** (NPR) — HMAC-signed eSewa ePay v2, Khalti ePayment API v2, signature-verified callbacks, automatic membership activation + expiry |
| **Admin panel** (`/admin`) | Analytics (members, MRR in Rs., upcoming attendance), full CRUD user management, full CRUD class management, content management (landing copy, plans, announcements) |

## Project Structure

```
forge-strength-club/
├── supabase/
│   └── schema.sql              # Tables + RLS policies + triggers + seed data (NPR)
├── src/
│   ├── middleware.ts           # RBAC routing (session refresh + role redirects)
│   ├── app/
│   │   ├── layout.tsx          # Global layout, fonts, Auth + Query providers
│   │   ├── globals.css         # Design tokens (ember/gold on iron black)
│   │   ├── page.tsx            # Public landing page (Server Component)
│   │   ├── login/ register/    # Auth pages
│   │   ├── auth/callback/      # OAuth code exchange -> role-based routing
│   │   ├── dashboard/          # Member area (overview, bookings, profile+billing)
│   │   ├── payment/            # success/ failed/ gateway redirect pages
│   │   ├── admin/              # Admin area (analytics, users, classes, content)
│   │   ├── actions/
│   │   │   └── admin.ts        # Guarded Server Actions (two-phase admin writes)
│   │   └── api/payments/
│   │       ├── checkout/       # POST: session + plan verification -> gateway payload
│   │       ├── esewa/callback/ # eSewa signed response -> verified fulfillment
│   │       └── khalti/callback/# Khalti lookup verification -> fulfillment
│   ├── components/
│   │   ├── landing/            # navbar, hero, features, schedule, pricing, footer, reveal
│   │   ├── dashboard/          # bookings-manager, profile-form, plan-checkout
│   │   ├── admin/              # shared primitives, user-manager, class-manager, content-manager
│   │   └── dashboard-shell.tsx # Shared member/admin shell (sidebar + mobile tabs)
│   ├── context/
│   │   └── auth-context.tsx    # Auth context (session, profile, role, helpers)
│   ├── lib/
│   │   ├── supabase/           # client.ts (browser), server.ts (RSC), admin.ts (service role)
│   │   ├── payments/           # esewa.ts, khalti.ts, service.ts (fulfillment)
│   │   ├── services/public.ts  # Landing-page data service w/ graceful fallback
│   │   ├── hooks/              # use-member-data, use-admin-data (React Query)
│   │   ├── types.ts            # DB row + view model types
│   │   ├── utils.ts            # cn, formatters (Rs.), error mapping
│   │   └── fallback-data.ts    # Static fallback (landing always renders)
│   └── providers/
│       └── query-provider.tsx  # React Query provider
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema**: open the SQL Editor and paste `supabase/schema.sql`, then run it.
   This creates all tables, RLS policies, the auto-profile trigger, the atomic
   `book_class()` RPC and seed data.
3. **Configure OAuth** (optional): in Supabase → Authentication → Providers, enable
   Google and/or Apple. Add your redirect URL:
   `http://localhost:3000/auth/callback` (or your production URL).
4. **Environment variables**: copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Settings → API)
   - `SUPABASE_SECRET_KEY` (server-only — required for admin CRUD + payments; never expose it to the browser)
   - `NEXT_PUBLIC_SITE_URL`
5. **Payments (NPR)** — two gateways are wired in:
   - **eSewa (ePay v2)**: works immediately in test mode with the public sandbox
     credentials (`EPAYTEST`) — no registration needed. Any eSewa test account can pay.
     For production: set `ESEWA_ENV=prod`, `ESEWA_MERCHANT_CODE` and `ESEWA_SECRET_KEY`
     from your eSewa merchant panel. Callback URL: `https://<your-domain>/api/payments/esewa/callback`.
   - **Khalti (ePayment API v2, optional)**: get a secret key from
     [merchant.khalti.com](https://merchant.khalti.com), set `KHALTI_SECRET_KEY` (and
     `KHALTI_ENV=prod` for live). If unset, checkout falls back to eSewa.
     Callback URL: `https://<your-domain>/api/payments/khalti/callback`.
   - On successful payment the member's plan activates automatically and
     `membership_expires_at` is set (+1 month / +1 year, extending from the current
     expiry when renewing early).
6. **Install & run**:

```bash
npm install
npm run dev        # http://localhost:3000
```

7. **Create the first admin**: sign up via the app, then in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
update public.profiles set membership_status = 'active', plan_id = (select id from public.plans order by sort_order limit 1) where email = 'you@example.com';
```

### Migrating an existing database (USD → NPR plans)

If you ran the schema before the NPR update, re-run `supabase/schema.sql` (idempotent)
and then update existing rows in the SQL Editor:

```sql
update public.plans set price = 2500  where name = 'Iron';
update public.plans set price = 4000  where name = 'Forge';
update public.plans set price = 35000 where name = 'Forge Elite';
update public.site_content set value = 'Simple pricing in Nepali Rupees. Pay online with eSewa or Khalti. Cancel anytime.'
  where key = 'pricing_subhead';
```

## Security Model

- **RLS everywhere** — every table has row-level security enabled. Members can only
  read/manage their own bookings and payments; public tables (classes/plans) are
  read-only for anon.
- **Storage RLS** — avatars are writable only inside the owner's own folder;
  class-covers/site-assets are admin-only. The `/api/upload` route additionally
  enforces both rules server-side and uploads with the service-role client, so it
  works even before storage policies are applied.
- **Role escalation guard** — a DB trigger prevents members from changing roles through
  any RLS-permitted path; only verified admins or service-role connections may.
- **Two-phase admin writes** — every admin Server Action first verifies the caller is an
  admin (JWT validated server-side), then writes with the service-role client.
- **Atomic booking** — the `book_class()` RPC enforces capacity/membership in a single
  transaction (race-condition safe).
- **Tamper-proof payments** — the checkout API reads the authoritative price from the
  DB (never the browser); eSewa callbacks are HMAC-SHA256 signature-verified
  (timing-safe) AND cross-checked against eSewa's transaction status API; Khalti
  callbacks are verified via the lookup API. Only then is a payment fulfilled — a
  member can never mark their own payment as completed.
- **Middleware gate** — unauthenticated users only see public pages; admins are routed to
  `/admin`, members to `/dashboard`. Sessions auto-refresh in middleware.
- **Graceful degradation** — if Supabase isn't configured or a public read fails, the
  landing page still renders with static fallback data.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run type-check` | TypeScript strict check |

## Deploy to Vercel

1. **Push to GitHub** (`.env.local` is git-ignored — secrets stay local):

```bash
git init && git add . && git commit -m "Forge Strength Club"
git remote add origin https://github.com/<you>/forge-strength-club.git
git push -u origin main
```

2. **Import** the repo at [vercel.com/new](https://vercel.com/new) (Next.js is
   auto-detected) and set the environment variables:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API |
| `SUPABASE_SECRET_KEY` | server-only — admin CRUD + payments |
| `NEXT_PUBLIC_SITE_URL` | **must be** `https://<your-app>.vercel.app` |
| `ESEWA_ENV` / `ESEWA_MERCHANT_CODE` / `ESEWA_SECRET_KEY` | `test` + `EPAYTEST` sandbox works immediately; switch to your real merchant creds for live |
| `KHALTI_ENV` / `KHALTI_SECRET_KEY` | optional — Khalti ePayment API |

3. **Supabase → Authentication → URL Configuration**: set the Site URL to
   `https://<your-app>.vercel.app` and add `https://<your-app>.vercel.app/auth/callback`
   to the Redirect URLs — without this, OAuth + email links break.

4. **Gateway callbacks**: eSewa needs no whitelisting
   (`/api/payments/esewa/callback` is sent per-request). Khalti requires the
   production website URL registered at merchant.khalti.com.

5. Env var changes on Vercel need a **redeploy** to take effect. Pushes to
   `main` rebuild automatically; PRs get preview URLs.

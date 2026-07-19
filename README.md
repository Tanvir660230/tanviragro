# Tanvir Agro ERP

Professional Agro Business ERP — Cattle Fattening Management.
Built for mobile-first farm use with real-time data, photo tracking, and financial analytics.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7 (App Router, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui (base-nova) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (cattle photos) |
| State | TanStack React Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | Web Push (VAPID) |
| Error Tracking | Sentry |

## Features

- **Cattle Management** — add/edit/delete livestock; weight tracking with growth charts; FCR calculation; tape-measure weight estimation; health events (vaccination, deworming, checkups); photo gallery
- **Inventory** — feed and equipment tracking, stock consumption, days-remaining alerts
- **Finance** — P&L dashboard, cost tracking (fixed/variable), sales recording, break-even analysis, cash flow forecasting, per-head ROI ranking
- **Vendors** — supplier directory with purchase history
- **Partners** — investor tracking with profit share calculations
- **Dashboard** — KPI stat cards, AI business advisor, smart insights, portfolio health score, revenue vs cost charts
- **Export** — CSV export for cattle data and cost reports
- **Mobile-first** — bottom navigation, responsive design, PWA-ready
- **Dark mode** — system preference + manual toggle
- **Command palette** — Ctrl+K keyboard navigation (Bangla + English)
- **Real-time** — Supabase Realtime auto-refresh on any DB change

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier works)
- (Optional) Sentry account for error tracking
- (Optional) VAPID keys for web push notifications

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd tanvir-agro
npm install
```

### 2. Configure environment variables

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
VAPID_SUBJECT=mailto:your@email.com

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
SENTRY_AUTH_TOKEN=<your-sentry-auth-token>
```

### 3. Set up the database

Run all migrations in order in the Supabase SQL Editor (`Dashboard → SQL Editor → New query`):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_tape_measure.sql
supabase/migrations/003_new_features.sql
```

Or using the Supabase CLI:

```bash
npx supabase db push
```

### 4. Configure Supabase Storage

In the Supabase Dashboard → Storage, create a bucket named `cattle-photos` and set it to **public**.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `businesses` | Business profiles linked to auth users |
| `cattle` | Livestock records (breed, gender, status, purchase price) |
| `weight_logs` | Growth tracking with optional tape measurements |
| `cattle_photos` | Photo paths in Supabase Storage |
| `health_events` | Vaccination calendar, checkups, treatments |
| `inventory_items` | Feed and equipment catalog |
| `inventory_transactions` | Purchase and consumption ledger |
| `cost_entries` | Fixed and variable expense records |
| `sales` | Sale records (price, weight, buyer) |
| `vendors` | Supplier directory |
| `partners` | Investor profiles |
| `partner_transactions` | Investment, withdrawal, profit ledger |
| `push_subscriptions` | Web push endpoint subscriptions |

All tables use Row-Level Security (RLS) — users can only access their own business's data.

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, forgot/reset password
│   ├── auth/callback/       # OAuth callback handler
│   ├── dashboard/           # All protected pages
│   │   ├── cattle/          # Livestock management
│   │   ├── finance/         # P&L and cost tracking
│   │   ├── inventory/       # Feed and stock
│   │   ├── partners/        # Investor tracking
│   │   ├── vendors/         # Supplier directory
│   │   └── settings/        # Account and app settings
│   ├── api/                 # API routes (push notifications)
│   ├── globals.css          # Tailwind + custom theme tokens
│   ├── layout.tsx           # Root layout with fonts and providers
│   └── manifest.ts          # PWA manifest
├── components/
│   ├── ui/                  # shadcn/ui base components
│   ├── shared/              # Layout: sidebar, topbar, bottom nav, providers
│   ├── dashboard/           # Dashboard widgets and charts
│   ├── cattle/              # Cattle management components
│   ├── inventory/           # Inventory components
│   ├── finance/             # Finance and P&L components
│   ├── vendors/             # Vendor components
│   ├── partners/            # Partner components
│   └── settings/            # Settings form components
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser Supabase client
│   │   ├── server.ts        # Server-side Supabase client
│   │   ├── middleware.ts     # Auth session management
│   │   └── queries/         # Server-side data fetching functions
│   ├── format.ts            # BDT currency, date, percent formatters
│   └── utils.ts             # Tailwind class merge utility
├── types/
│   └── database.ts          # TypeScript types for all DB tables
└── proxy.ts                 # Next.js 16 route protection (replaces middleware.ts)
```

## Key Conventions

- **Route protection**: `src/proxy.ts` (Next.js 16 uses `proxy` export, not `middleware`)
- **Supabase server client**: Always use `src/lib/supabase/server.ts` in Server Components and Route Handlers
- **Supabase browser client**: Use `src/lib/supabase/client.ts` only in Client Components
- **Currency**: All monetary values stored in BDT (Bangladeshi Taka); formatted with `fmtBDT()` from `src/lib/format.ts`
- **Theme**: Agricultural green primary (`oklch(0.42 0.15 145)`), harvest amber accent

## Available Scripts

```bash
npm run dev        # Start development server (Turbopack)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm test           # Run unit tests
```

## Deployment (Vercel)

1. Push to GitHub
2. Import the repository at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js and configures the build

Make sure `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` are added as **encrypted** environment variables (not exposed to the browser).

## Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Copy the output into `.env.local`.

## Error Tracking (Sentry)

1. Create a project at [sentry.io](https://sentry.io)
2. Copy the DSN and add it as `NEXT_PUBLIC_SENTRY_DSN` in your environment
3. For source map uploads, add `SENTRY_AUTH_TOKEN` from your Sentry org settings

## License

Private — all rights reserved. Tanvir Agro.

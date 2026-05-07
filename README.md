# RN Care — Co-broking CRM Prototype

Pre-engagement working demo for RN Care Services (Singapore medical recruitment).
Walks the Director and KAMs through their own workflow running live in a browser.

## What this is

- Live pipeline Kanban (drag-drop) replacing the Director's Excel
- Job detail with **co-broke toggle** + default split rules
- Real-time activity feed — co-broke opens appear instantly in the second window
- Director dashboard: open roles, weighted fees, BD activity, 30-day trend
- Realistic seeded data: 6 Singapore healthcare clients, 12 jobs, 30 candidates, 50 submissions

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4
- Supabase: Postgres + Auth + Realtime
- @dnd-kit (Kanban) · Recharts (dashboard) · lucide-react (icons)

---

## First-time setup

### 1. Create a Supabase project
Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New project. Pick region **Singapore (ap-southeast-1)** for lowest latency.

### 2. Run the schema
Open **SQL Editor** in the Supabase dashboard, paste the contents of `supabase/migrations/0001_init.sql`, run it.

### 3. Configure env vars
Copy `.env.local.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # from Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # Settings → API → service_role (KEEP SECRET)
```

### 4. Seed demo data
```bash
npm run seed
```
This creates three demo auth users and populates clients/jobs/candidates/submissions/activities.
Safe to re-run — it wipes domain data and re-inserts. Auth users are upserted, not duplicated.

### 5. Run the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Demo logins (password: `demo1234`)

| Email | Name | Role |
|---|---|---|
| `director@rncare.demo` | Lim Wei Ming | Director (sees everything) |
| `sarah@rncare.demo` | Sarah Tan | Key Account Manager (owns the 6 clients) |
| `marcus@rncare.demo` | Marcus Lee | BD Consultant (contributes via co-broke) |

---

## The 90-second pitch sequence

Open two browser windows side-by-side. **Window A** for Sarah, **Window B** for Marcus.

1. **Sarah → Pipeline** — drag a candidate from "Screening" to "Negotiation". Watch the activity feed update in Marcus's window in real time.
2. **Sarah → Jobs → New job** — create a new role (e.g. "Senior Radiographer · Mount Elizabeth"), tick **Open for co-broke**, set 60/40 split, save.
3. **Marcus's window flashes** — the new co-broke opportunity appears in his **Co-broke feed** instantly. No huddle needed.
4. **Director (third tab) → Dashboard** — KPIs, stage counts, weighted fees, and the 30-day trend all reflect what just happened.

This is the moment that wins the deal: the Director sees the pipeline he's been chasing in spreadsheets, *live*.

---

## Reset between pitches

```bash
npm run reset:demo
```
Wipes domain data and re-seeds. Auth users persist. Takes ~5 seconds.

---

## Project layout

```
src/
├── app/
│   ├── (app)/                  # Protected routes (require auth)
│   │   ├── pipeline/           # Kanban board (default landing)
│   │   ├── feed/               # Co-broke live activity feed
│   │   ├── jobs/               # List + detail + new
│   │   ├── candidates/         # List + detail
│   │   ├── clients/            # List + detail
│   │   ├── dashboard/          # Director KPIs + Recharts
│   │   └── layout.tsx          # Sidebar shell
│   ├── login/
│   └── layout.tsx
├── components/
│   ├── PipelineBoard.tsx       # Drag-drop Kanban + Realtime
│   ├── CoBrokeFeed.tsx         # Live activity stream
│   ├── CoBrokeToggle.tsx       # Open/close + split editor
│   ├── DashboardCharts.tsx     # Recharts wrappers
│   ├── Sidebar.tsx
│   ├── PageHeader.tsx
│   └── StageBadge.tsx
├── lib/
│   ├── supabase/{client,server,types}.ts
│   └── format.ts
proxy.ts                          # Auth gate (Next 16 'middleware' renamed)
supabase/
└── migrations/0001_init.sql     # Schema + RLS + Realtime publication
scripts/
└── seed.ts                      # Idempotent demo seeder
```

---

## Production path (post-deal Stage 4)

- Tighten RLS: scope writes by role + ownership instead of "all authenticated"
- Replace `resume_url` stubs with Google Drive Picker integration
- Add PDPA controls: consent capture on candidate creation, retention rules, export-on-request
- Move auth from password to magic-link / SSO (Google Workspace likely)
- Deploy: Vercel (frontend) + Supabase Singapore region; custom subdomain
- Add audit log surfacing in Director view; weekly digest email

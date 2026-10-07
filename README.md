# WFO Digital Cockpit Feedback

A **Feedback & Validation Portal** for the WFO Digital Cockpit. Validation users report data/UI/functional issues with a screenshot; the owner/admin triages them in an enterprise dashboard. This is a **separate application** — it does not modify the existing Digital Cockpit.

Browser title: *WFO Digital Cockpit | Feedback & Validation* · User page: *Report Digital Cockpit Feedback* · Admin: *WFO Digital Cockpit Feedback — Validation & Issue Management*

## Architecture

```
React + Vite SPA (static hosting, e.g. GitHub Pages)
        │  publishable/anon key only
        ▼
Supabase  ── Auth (email/password; SSO-ready)
          ── PostgreSQL (feedback, feedback_history, profiles, owners, app_config, admin_emails)
          ── Storage (private bucket: feedback-screenshots)
          ── Row Level Security + triggers  ← the real authorization boundary
```

Feedback data never goes to GitHub. GitHub holds code, SQL migrations, docs and the deploy workflow.

## Features

- **Users**: submit feedback (component type + name, feedback type, description, priority, screenshot with drag-drop / paste / preview / progress), see only their own feedback and status, add a follow-up comment.
- **Admin table columns** (default): Sr.No, Validated by, Stream (Business), Feature (Sub business > Dashboard path), Page Name, Component type, Owner, Sub Owner Name, Comments, Status, ETA, Challenges if any. Other columns (Feedback ID, Priority, Screenshot, dates) are available from the Columns menu.
- **Admins**: KPI cards, server-side search/sort/filter/pagination, column show/hide + resize, CSV/Excel export, screenshot lightbox (zoom, fit, download), right-side detail drawer (status, owner, priority, comments, resolution, edit, delete), audit timeline, analytics (6 charts), settings (owners, screenshot-required toggle, admin emails).
- Feedback IDs (`WF-0001`…), reporter identity and dates are assigned **by the database**.
- Mobile: the table becomes cards. Light/dark mode. Keyboard + screen-reader friendly.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, Lucide, Supabase, React Hook Form + Zod, TanStack Table, Recharts, Vitest.

## Local development

```bash
npm install
cp .env.example .env     # fill in the two Supabase values
npm run dev              # http://localhost:5173
npm run lint && npm test && npm run test:db && npm run build
```

## Supabase setup

1. Create a Supabase project. Copy **Project URL** and the **publishable/anon key** (Project Settings → API) into `.env`. Never use the `service_role` key in this repo or the frontend.
2. In the SQL editor (or `supabase db push`) run, in order:
   - `supabase/migrations/001_schema.sql` – tables, triggers, analytics function
   - `supabase/migrations/002_rls.sql` – privileges + Row Level Security
   - `supabase/migrations/003_storage.sql` – private bucket + Storage RLS
   - `supabase/migrations/004_dashboard_options.sql` – Business dropdown tree
   - `supabase/migrations/005_owner_admins.sql` – owners must be admins; Owner dropdown on the form
   - `supabase/migrations/006_tracking_fields.sql` – Sub owner, ETA, Challenges columns (admin-edited)
   - `supabase/migrations/007_assignees.sql` – assignee list for the searchable "Assign feedback to" dropdown (stored as Sub Owner Name)
3. Authentication → Providers: enable Email. Decide whether to require email confirmation. If you do not want self sign-up, disable "Allow new users to sign up" and create users in the dashboard.
4. Designate the admin(s): edit and run `supabase/seed/make_admin.sql`.
5. (Dev/staging only) `supabase/seed/demo_seed.sql` inserts three clearly marked `[DEMO]` rows. **Never run on production.**

### Database schema

| Table | Purpose |
|---|---|
| `profiles` | `id, email, name, role (user/admin)` – role set only by DB triggers |
| `admin_emails` | Admin allow-list (the "ADMIN_EMAILS" config), DB-controlled, editable by admins in Settings |
| `feedback` | All feedback fields incl. `feedback_number`, `screenshot_path`, `status`, `owner`, `date_reported`, `date_completed`, `resolution`, `admin_comments`, `user_comments` |
| `feedback_history` | Audit rows: `history_id, feedback_id, changed_by, changed_at, field_changed, old_value, new_value` |
| `owners` | Assignable owners (managed in Settings) |
| `app_config` | `screenshot_required` toggle |

### Row Level Security (summary)

- Users: `INSERT` own feedback; `SELECT` own feedback; may update **only** `user_comments` on own rows (trigger enforced). No delete.
- Admins (`profiles.role = 'admin'` via `is_admin()`): select/update/delete everything, read history/owners/config.
- Triggers force `reported_by`, name/email, `status='New'`, dates on insert; make `feedback_number`, reporter and `date_reported` immutable; set `date_completed` when status becomes Completed (kept on reopening — history records every change); write `feedback_history`.
- `profiles.role` is not client-writable (column-level grants). Anon has no access.
- `supabase/tests/rls.test.mjs` runs the migrations on an in-process Postgres and asserts 33 security/behaviour checks (`npm run test:db`).

> Design note: `admin_comments` and `resolution` are visible to the reporter on their own feedback ("Comments from the team"). Don't put internal-only notes there.

### Storage

Private bucket `feedback-screenshots`, 10 MB limit, PNG/JPEG/WEBP. Objects live at `<user_id>/<uuid>.<ext>`. Users can upload to / read from their own folder only; admins read all. Screenshots are opened through 5-minute signed URLs, loaded lazily (never in the table). Only the path is stored in PostgreSQL.

## Environment variables

| Name | Notes |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |
| `VITE_BASE_PATH` | Optional, e.g. `/wfo-digital-cockpit-feedback/` for GitHub Pages |

## Deployment

Repository name: `wfo-digital-cockpit-feedback`. `.github/workflows/deploy.yml` runs on push to `main`: install → lint → tests → DB tests → build → deploy to GitHub Pages (deploy is skipped if anything fails).

1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Repo → Settings → Secrets and variables → Actions: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Supabase → Authentication → URL configuration: add the Pages URL to Site URL / redirect URLs.

SPA routing on Pages uses the `public/404.html` redirect fallback (assumes a project site at `/<repo>/`; set `repoSegs = 0` in that file for a custom domain). Netlify/Vercel/Cloudflare Pages with an SPA rewrite to `index.html` also work.

## Admin configuration

Add admins with `make_admin.sql` or Settings → Administrators. Manage owners and the "screenshot required" toggle in Settings. Assignees (Settings → Assignees) feed the searchable "Assign feedback to" dropdown. Owners are picked from the administrator list (the database rejects non-admins) and appear in the Owner dropdown of the feedback form; removing someone's admin access deactivates them as an owner.

## Workflows

- **User**: sign in → Feedback → fill form + screenshot → Submit → receive `WF-xxxx` → track under My Feedback.
- **Admin**: Overview (KPIs + table) → filter/search → open row (drawer, deep-linkable at `/admin/feedback/:id`) → set status/owner/priority/comments → Mark Completed → export.

Status flow: New → Under Review → In Progress → Completed; In Progress ⇄ Blocked; Under Review → Rejected.

## Future-ready hooks

Auth calls are isolated in `src/services/authService.ts` (add `azure` SSO there). Notifications: add a Supabase Database Webhook / Edge Function on `feedback` insert and `feedback_history` insert. Other extras (Jira, Teams, multi-screenshots, SLA, comments) fit as new tables/services without redesign.

## Troubleshooting

- *"Supabase is not configured"* – `.env` missing/incorrect; restart `npm run dev`.
- *Signed in but "profile not available"* – migration 001 not applied before the user signed up; rerun it (it backfills profiles).
- *Admin menu missing* – the email is not in `admin_emails` (check spelling/case; sign out and in).
- *Upload fails* – run `003_storage.sql`; file must be PNG/JPG/WEBP ≤ 10 MB.
- *Blank page on Pages after refresh* – check `VITE_BASE_PATH` and `public/404.html`.

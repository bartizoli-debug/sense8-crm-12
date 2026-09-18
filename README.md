# Sense8 CRM

A Next.js 13 (App Router) CRM for companies, contacts, deals and contracts.

Production runs on [Supabase](https://supabase.com/). For local work you don't
need it: the app ships with an **in-memory database** that runs inside the app
itself, seeded with demo data, so `npm run dev` is all it takes.

## Quick start (in-memory database, no Supabase)

Requires **Node 18 or newer** (`node -v` to check).

```bash
npm install
```

```bash
cp .env.local.example .env.local
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it — no database to
install, no credentials to obtain, no network access needed.

The copy step matters: `.env.local` is git-ignored, so a fresh clone doesn't
have one, and without it the app falls back to the real Supabase project
configured in `.env`.

### What you get

You land on the dashboard **already signed in** as a demo user, with a seeded
dataset:

| | |
| --- | --- |
| Companies | 8 |
| Contacts | 15, with tags and product interests |
| Deals | 12, across all five pipeline stages |
| Contracts | 10, with platforms, addendums and a rebate link |
| Activities | 7, on deals and companies |

Dates are generated relative to today, so the dashboard KPIs, the follow-up
widget and the renewal center always have something to show.

Every screen is fully writable — create a company, move a deal, edit a
contract, add an activity. Changes are kept in the browser's `localStorage`, so
they survive a page reload. From the browser console:

```js
window.mockDb.reset()    // discard your changes, back to the demo dataset
window.mockDb.clear()    // empty every table
window.mockDb.snapshot() // dump the current data
```

Because the data lives in your browser, a different browser or a private window
starts fresh from the seed on its own.

### Confirming it's active

Open the browser console. When the in-memory database is in use you'll see:

```
[mock-db] Using the in-memory database. Run window.mockDb.reset() to restore the demo data.
```

If that line is missing, the app is talking to real Supabase — check that
`.env.local` exists and restart the dev server.

### Logging in

Sign-in is not enforced locally. You start signed in, and if you sign out, the
login page accepts **any** email and password. "Magic link" signs you in
immediately rather than sending mail.

Set `NEXT_PUBLIC_MOCK_AUTOLOGIN=false` if you want to land on `/login` instead —
useful when working on the login screen itself.

### Settings

All of these live in `.env.local`. Restart the dev server after changing any of
them — Next.js only reads env files at startup.

| Variable | Default | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK_DB` | `true` | `false` uses the real Supabase project from `.env`. If left unset entirely, the in-memory database is used only when Supabase credentials are missing. |
| `NEXT_PUBLIC_MOCK_AUTOLOGIN` | `true` | `false` starts you signed out at `/login`. |
| `NEXT_PUBLIC_MOCK_ROLE` | `admin` | The `crm_role` claim on the demo session. `admin` / `editor` / `manager` / `sales` unlock the deal editor; anything else makes deals read-only — handy for checking the read-only UI. |

### Switching back to Supabase

Set `NEXT_PUBLIC_USE_MOCK_DB=false` in `.env.local` (or delete the file) and
restart the dev server. The Supabase credentials in `.env` are untouched by any
of this.

### Troubleshooting

**The page is empty, or the console shows Supabase network errors.**
`.env.local` is missing or `NEXT_PUBLIC_USE_MOCK_DB` isn't `true`. Copy the
example file and restart.

**Changed an env var and nothing happened.** Next.js reads env files only at
startup — stop and restart `npm run dev`.

**Data looks wrong after experimenting.** Run `window.mockDb.reset()` in the
browser console.

**Deals are read-only.** Your session predates the role claim, or
`NEXT_PUBLIC_MOCK_ROLE` isn't one of the editing roles. Sign out and back in.

**`Error: Cannot find module` after pulling.** Run `npm install` again.

## How the in-memory database works

`lib/supabaseClient.ts` returns a stand-in client from `lib/mock/` when the
in-memory database is enabled. Every page keeps calling
`supabase.from('deals').select(...)` exactly as before, so no page or component
code is aware of the swap.

| File | Role |
| --- | --- |
| `lib/mock/seed.ts` | The demo dataset |
| `lib/mock/store.ts` | The tables, plus `localStorage` persistence |
| `lib/mock/schema.ts` | Per-table primary keys, foreign keys and column defaults |
| `lib/mock/query.ts` | A small PostgREST-style query builder |
| `lib/mock/auth.ts` | A stand-in for `supabase.auth` |
| `lib/mock/client.ts` | Assembles the client and implements the `get_contract_current_state` RPC |

The query builder covers what this app actually calls: select / insert / update
/ upsert / delete, the usual filters, `.or()` including `and(...)` groups,
multi-column ordering, exact counts, `single()` / `maybeSingle()`, and one-level
embedded selects such as `contact_tags:tag_id ( id, name )`.

It is not a complete PostgREST implementation. If a page starts using something
new — another RPC, an unsupported filter — add it in `lib/mock/`. Unknown RPCs
return a clear error rather than failing silently.

## Other commands

```bash
npm run build
```

```bash
npm run lint
```

The production build works with either backend; it does not require Supabase
credentials to be reachable.

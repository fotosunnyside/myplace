# PLACES — notes for working on this repo

## Shipping (the owner wants changes live without manual steps)
- Production is `main`. Every push to `main` runs `.github/workflows/pages.yml`: tests → `migrate` (applies
  `supabase/migrations` to the live Supabase project) → `deploy` (GitHub Pages). Nothing publishes if tests fail.
- Work on the session's `claude/*` branch, run the checks below, then open a pull request into `main` and merge it
  once its checks pass. The owner has asked for finished changes to go live this way.
- Live site: https://fotosunnyside.github.io/myplace/ · Supabase project ref `zeveszwhbsguwnvuzfwd`.

## Database changes
- Never ask the owner to run SQL by hand: add a new file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`.
  CI applies it to a fresh database, re-applies every migration on top, runs `tests/supabase`, then pushes it live.
- Migrations must be safe to run twice and must not lose data: `create table if not exists`,
  `add column if not exists`, `create or replace function`, `drop policy if exists` before `create policy`,
  `on conflict do nothing` for seed rows. Never drop or rename columns/tables that hold member content;
  add new ones and migrate data instead. Don't edit a migration that's already on `main` — add a new one.
- Every table: row level security on, explicit `grant`s (the project doesn't auto-expose tables), writes limited
  to the member's own rows. Anything that affects someone else (notifications, prices, welcomes) is done in the
  database (triggers / security definer functions), never trusted from the browser.
- Community seed content comes from `lib/store/seed.ts` → `npm run gen:world-seed` (writes a migration).

## How the app talks to Supabase
- UI reads one `WorldState` and changes it with pure actions (`lib/store/actions.ts`).
- `lib/store/cloud/`: `map.ts` (rows ↔ world, and the rows a member owns), `diff.ts` (action → row writes),
  `schema.ts` (tables, keys, writable columns — keep in sync with migrations), `driver.ts`, `sync.ts`.
- A new entity needs: migration + `schema.ts` entry + `fromCloud` + `ownedRows` + a unit test in `tests/unit/cloud.test.ts`.
- Without the backend (or before tables exist) the app runs from IndexedDB (`lib/store/store.ts`, device mode).

## Checks before pushing
- `npm run lint && npm run typecheck && npm test`
- `npm run build:pages && npx playwright test` (device mode, desktop + phone)
- Cloud (needs `npx supabase start`): `npm run test:supabase` and `npx playwright test -c playwright.cloud.config.ts`
  with `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_KEY` set, after building with
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at the local stack.

## Style
- Match existing code: Tailwind with the PLACES tokens in `app/globals.css`, Newsreader/DM Sans, soft rounded cards.
- Commit messages end with the attribution lines the session provides; never include model names.

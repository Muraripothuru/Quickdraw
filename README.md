# LuckyDraw

Fair, verifiable random draws for giveaways, classrooms, raffles and teams.
Create a draw, load a roster, lock the pool, spin one of four reveal animations,
then share a public verification link with the seed commitment and winner record.

Built with **Next.js 16 (App Router, Cache Components)**, **Prisma + PostgreSQL**,
**Tailwind 4**, **Framer Motion** and **canvas-confetti**.

## Getting started

```bash
npm install
npx prisma migrate dev   # applies PostgreSQL migrations
npm run dev              # http://localhost:3000
```

When opened in VS Code, the workspace starts the development server on
`http://localhost:3002`; the Chrome launch configuration uses the same port.

## Environment

Copy `.env.example` to `.env` and set both PostgreSQL connection URLs:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection URL; use the provider's pooled URL for app queries |
| `DIRECT_URL` | yes | Direct PostgreSQL URL for Prisma migrations (non-pooled) |

Keep API keys and other credentials in server-only environment variables.
Never use the `NEXT_PUBLIC_` prefix for secrets; the development server and
production build reject sensitive public-prefixed variables. Production builds
also scan browser-downloadable assets for configured secret values. `.env*`
files are ignored by Git except for `.env.example`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test:e2e` | End-to-end suite against a running server (`BASE_URL`, default `http://localhost:3100`) |

## GitHub Pages

The GitHub Pages deployment publishes the static informational page from `docs/`
at <https://muraripothuru.github.io/Quickdraw/>. On GitHub, open **Settings →
Pages** and set the build and deployment source to **GitHub Actions**. Subsequent
pushes to `main` deploy the page automatically; the workflow can also be started
manually from the Actions tab.

GitHub Pages cannot run this app's Next.js server, API routes, authentication, or
SQLite database. The Pages site is therefore a landing-page preview; use the full
server-backed application to create draws, manage rosters, or verify results.

## Vercel deployment

Import this GitHub repository into Vercel as a Next.js project. Create a managed
PostgreSQL database (for example, Neon) and configure `DATABASE_URL` and
`DIRECT_URL` for Production, Preview, and Development as appropriate. Run
the initial data transfer below before the first deployment. The Vercel build
command applies pending Prisma migrations before building. Do not point a
deployment at a local SQLite file: Vercel's serverless filesystem is not
persistent.

To transfer the existing local SQLite data, create `.env` with `SQLITE_DATABASE_URL`
pointing to the existing SQLite file and `DATABASE_URL`/`DIRECT_URL` pointing to
the target PostgreSQL database. Run `npx prisma migrate deploy`, then
`npx prisma generate --schema prisma/schema.sqlite.prisma`, and finally
`node --env-file=.env scripts/migrate-sqlite-to-postgres.mjs`. The transfer aborts
unless the destination tables are empty. Keep connection strings in ignored
local environment files; never commit them.

## End-to-end test

`tests/e2e.mjs` drives the whole product over HTTP: page rendering, guest scope,
register/login/logout, roster CRUD, draw lifecycle
(create → lock → select → complete), winner elimination, SSE events, the public
verification payload, and authorization rules. It creates its own throwaway data
and cleans it up; exit code 0 means everything passed.

```bash
npm run build && npm run start   # terminal 1 (port 3000 by default)
npm run test:e2e                 # terminal 2
```

## How a draw works

1. **Create** — paste or upload names (CSV), set weighted entries and a winner target.
2. **Lock** — freezing the pool before the first selection. Selection is rejected
   until the draw is locked, so the pool cannot change mid-draw.
3. **Select** — `crypto.randomInt` picks a weighted entry inside an atomic
   transaction; a selected participant can never win twice. Each winner stores an
   entropy fingerprint derived from the draw's SHA-256 seed commitment.
4. **Verify** — `/draw/<code>` and `/api/public/draws/<code>` publish the winner
   record, timestamps and seed commitment. Missing codes return a real HTTP 404
   (checked in `src/proxy.ts`, before streaming starts).

## Next.js 16 notes

`cacheComponents` is enabled in `next.config.ts`. Two consequences worth knowing:

- `export const dynamic = "force-dynamic"` is **not compatible** with it and fails
  the build — request-time APIs (`cookies()`, `headers()`, `req`) already render
  per request.
- `/draw/[id]` lives under `(app)/layout.tsx`, which calls `await connection()`
  instead of wrapping the tree in `<Suspense>`: a layout-level Suspense would
  stream the page after the status header is sent, turning `notFound()` into a
  soft 404 with status 200.

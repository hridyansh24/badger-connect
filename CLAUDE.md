# Badger Connect

Omegle-style 1:1 text + video matchmaker, gated to UW–Madison students by `@wisc.edu` email. Monorepo-ish: Vite + React + TS frontend at root, Express + Socket.IO backend under `backend/`.

## Run it

```bash
# terminal 1 — backend (port 4000)
cd backend && npm run dev

# terminal 2 — frontend (port 5173)
npm run dev
```

Visit `http://localhost:5173`. Backend health: `http://localhost:4000/health`.

Supabase schema lives in `backend/supabase/schema.sql` — paste into the Supabase SQL editor once. Re-runnable. `backend/scripts/probe.js` verifies all four tables are reachable.

## Architecture

**Frontend** (`src/`)
- `pages/LoginPage.tsx` — name + `@wisc.edu` email + interest picker. Filters interests against a banned-words list fetched via `useBannedInterests`.
- `pages/VerifyPage.tsx` — 6-digit OTP input (paste + autofill aware). Calls `/auth/verify-code`, stores `{token, user}` via `AuthContext.setSession`, redirects to `/mode`.
- `pages/ModeSelectionPage.tsx` — pick text or video.
- `pages/TextChatPage.tsx` / `pages/VideoChatPage.tsx` — socket-driven match + chat. Video uses WebRTC signaling over the same socket.
- `context/AuthContext.tsx` — stores JWT + user in `localStorage` under `bc.token` / `bc.user`.
- `context/SocketContext.tsx` — single `socket.io-client` connection, attaches `auth.token` from `AuthContext`.
- `components/BrandMark.tsx` — hand-drawn W SVG (replaces the old UW crest; logo files were deleted and should stay deleted).
- `lib/api.ts` — thin `fetch` wrapper for `/auth/request-code` and `/auth/verify-code`.

**Backend** (`backend/`)
- `server.js` — Express + Socket.IO. Routes: `/auth/*`, `/health`, `/reputation/:email`. Socket events: `profile:update`, `match:request`, `chat:text:message`, `chat:leave`, `profile:reaction`, `webrtc:offer|answer|ice-candidate`, `disconnect`. JWT verified in `io.use` middleware — no token, no socket.
- `routes/auth.js` — `/request-code` (rate-limited 5/hr/email, invalidates prior codes, sends via Resend) and `/verify-code` (checks expiry + attempt cap, issues JWT, upserts user).
- `lib/auth.js` — OTP generation, bcrypt hash/verify, JWT sign/verify, `isWiscEmail` regex.
- `lib/supabase.js` — service-role client. Bypasses RLS; RLS is still enabled so the anon key can't read these tables from the browser.
- `lib/reputation.js` — `upsertUser`, `getReputation`, `applyReaction`. Auto-bans when reports hit a threshold.
- `lib/resend.js` — sends OTP email.

## Schema (Supabase, four tables)

`users` (pk email, must be lowercase `@wisc.edu`), `verification_codes` (id, email, code_hash, expires_at, consumed_at, attempts), `reputation` (email pk, likes/dislikes/reports, banned flag), `reports` (reporter → target, unique per session).

## Env vars

Two `.env` files — `/.env` for frontend (Vite), `backend/.env` for Node. Never paste keys in chat; the user drops them into the files directly.

- **Frontend** (`.env`): `VITE_API_URL` (defaults to `http://localhost:4000`)
- **Backend** (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PORT` (optional, defaults 4000)

## Dev/test notes

- **OTP in dev:** `routes/auth.js:80` logs `[dev] OTP for <email>: <code>` to stdout whenever `NODE_ENV !== 'production'`. So any `netid@wisc.edu` is testable locally — grab the code from the backend terminal, no inbox needed.
- **Resend sandbox:** Without a verified domain, Resend only delivers to the account owner (`hriday2410@gmail.com`). That's why the dev-mode terminal log exists — it's the fallback. If the user wants real email delivery to arbitrary `@wisc.edu` addresses, they need to verify a domain at resend.com/domains and update `RESEND_FROM`.
- **Hosting plan:** Not hosted yet. If/when hosting, UW–Madison doesn't give student-run servers easily — prior discussion landed on a cheap VPS (Fly.io / Railway / Render free tiers) or Vercel for the frontend + Railway for the backend, not UW infra.
- **Interest filter:** The banned-words list is fetched from the backend by `useBannedInterests`; `LoginPage` checks `substring` matches, not exact. Uppercase the first letter of each word via `normalizeInterest`.
- **Socket auth:** The JWT email is the source of truth on the backend. `profile:update` ignores client-sent email (`server.js:107`).

## What's done vs. next

Done: OTP auth end-to-end, JWT-gated socket, text + video matchmaking and chat, WebRTC signaling, reputation/reporting, banned-interest filter, frontend visual pass (hand-drawn W, no UW crest).

Not committed yet — most of this is still in the working tree. All the untracked files under `backend/{lib,routes,scripts,supabase}/`, `src/components/`, `src/context/AuthContext.tsx`, `src/pages/VerifyPage.tsx`, `src/lib/` are part of the auth + UI rebuild and should be committed together when the user is ready.

# Badger Connect

Badger Connect is a UW–Madison themed social experiment that lets verified `@wisc.edu` students meet each other through moderated text and video lounges. Students sign in with their campus email, optionally pick interests, and are matched through a Socket.IO backend that enforces safe-topic filters and crowd-sourced reputation rules.

## Highlights
- **Verified onboarding:** Login page only accepts names plus `@wisc.edu` addresses and blocks banned interests pulled from `public/banned-interests.txt`.
- **Mode switching:** Students can hop between curated text and video lounges without refreshing, with their current profile kept in React state.
- **Realtime matching:** When the backend is reachable the UI uses Socket.IO to request matches, receive `match:paired` events, sync text messages, and show socket status.
- **Simulation fallback:** When sockets are offline the UI keeps working by generating realistic partners/messages so demos never stall.
- **Community safety:** Likes, dislikes, and reports feed a reputation model. Any email that reaches 3 reports or 10 dislikes is banned both in the client context and on the server.

## Architecture
- **Frontend (`src/`)**
  - Vite + React + TypeScript with React Router, `SocketContext` for websocket state, and `FeedbackContext` for reactions.
  - `pages/` contain the three flows (login, mode select, text chat, video chat). Styling lives in `src/App.css` and `src/index.css`.
  - `hooks/useBannedInterests` fetches the banned-topic list so you can edit `public/banned-interests.txt` without redeploying.
- **Backend (`backend/server.js`)**
  - Express + Socket.IO server that tracks waiting queues per mode, pairs students, forwards `chat:text:message` events, and stores reputation/ban counts in memory.
  - REST helpers: `GET /health` for queue sizes, `GET /reputation/:email` to inspect reaction totals.

```
badger_connect/
├── src/                # React app
├── backend/            # Express + Socket.IO service
├── public/banned-interests.txt
├── explain.txt         # Extended implementation notes / roadmap
└── University-of-Wisconsin-Logo-*.webp
```

## Requirements
- Node.js 20+ (18+ works but 20 is recommended for Vite 7)
- npm 10+
- Modern browser with camera/mic permissions for the video lounge

## Quick start (localhost)
1. **Install dependencies**
   ```bash
   npm install                # frontend
   cd backend && npm install  # backend
   ```
2. **Environment files**
   ```bash
   # /.env  (frontend)
   VITE_SOCKET_URL=http://localhost:4000
   VITE_API_URL=http://localhost:4000
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or sb_publishable_... key>

   # backend/.env
   PORT=4000
   CLIENT_ORIGIN=http://localhost:5173
   JWT_SECRET=<run: openssl rand -hex 32>
   RESEND_API_KEY=<re_... from resend.com/api-keys>
   RESEND_FROM=onboarding@resend.dev
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role or sb_secret_... key>
   ```
3. **Apply the Supabase schema** — open your project's SQL Editor, paste the contents of `backend/supabase/schema.sql`, run once.
4. **Run the backend**
   ```bash
   cd backend
   npm run dev
   ```
5. **Run the frontend**
   ```bash
   npm run dev
   ```
6. Visit `http://localhost:5173`. You'll go through **login → email OTP → mode select → chat**. Open two browsers logged in as two different `@wisc.edu` emails to see real matchmaking.

## Auth flow
1. User enters name + `@wisc.edu` email on `/`.
2. Backend generates a 6-digit code, stores a bcrypt hash in Supabase, and emails the plaintext code via Resend (10-min expiry, max 5 attempts).
3. User enters the code on `/verify`. Backend validates and issues a 7-day JWT.
4. Frontend stores the JWT in `localStorage` and attaches it on the Socket.IO handshake.
5. Socket.IO middleware rejects any connection without a valid token — the server's email identity is the JWT claim, not whatever the client says.

## Scripts
| Location | Command | Purpose |
| --- | --- | --- |
| root | `npm run dev` | Start Vite with HMR (`http://localhost:5173`) |
| root | `npm run build` | Type-check via `tsc -b` then produce the production bundle |
| root | `npm run preview` | Preview the production build |
| root | `npm run lint` | Run ESLint across the project |
| backend | `npm run dev` | Start the Socket.IO server with `nodemon` |
| backend | `npm start` | Start the backend without file watching |

## Environment variables
| File | Variable | Description |
| --- | --- | --- |
| `.env` | `VITE_SOCKET_URL` | Base URL of the Socket.IO backend (`http://localhost:4000` locally) |
| `.env` | `VITE_API_URL` | Base URL of the REST API — same host as the Socket.IO server |
| `.env` | `VITE_SUPABASE_URL` | Supabase project URL |
| `.env` | `VITE_SUPABASE_ANON_KEY` | Supabase public (`anon` / `sb_publishable_…`) key |
| `backend/.env` | `PORT` | Port the Express server listens on (default `4000`) |
| `backend/.env` | `CLIENT_ORIGIN` | Comma-separated list of allowed origins for CORS / Socket.IO |
| `backend/.env` | `JWT_SECRET` | Secret used to sign session JWTs — generate with `openssl rand -hex 32` |
| `backend/.env` | `RESEND_API_KEY` | Resend API key used to send OTP emails |
| `backend/.env` | `RESEND_FROM` | From-address for OTP emails (default `onboarding@resend.dev` for dev) |
| `backend/.env` | `SUPABASE_URL` | Supabase project URL |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret (`service_role` / `sb_secret_…`) key — never expose to the browser |

When sharing over LAN, restart Vite with `npm run dev -- --host 0.0.0.0` and update both env files so `CLIENT_ORIGIN`, `VITE_SOCKET_URL`, and `VITE_API_URL` use your machine's IP.

## Moderation + customization
- Update `public/banned-interests.txt` to add/remove forbidden interest keywords. The file is loaded at runtime, so edits go live after a refresh.
- Reaction thresholds live in both `src/context/FeedbackContext.tsx` and `backend/server.js`. Keep them consistent (default: 3 reports or 10 dislikes ban an email).
- Socket.IO now relays the WebRTC signaling (`webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`) so browsers can create peer-to-peer video sessions. Update `RTC_CONFIGURATION` in `src/pages/VideoChatPage.tsx` with your STUN/TURN servers before going to production.

## Deployment checklist (for a real UW–Madison launch)
1. **Backend** → Render or Fly.io (needs always-on + WebSocket support, so avoid Vercel/Netlify serverless).
   - Set every `backend/.env` variable in the host's environment panel.
   - `CLIENT_ORIGIN` must list your actual frontend domain(s).
2. **Frontend** → Vercel or Netlify. Set `VITE_SOCKET_URL`, `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in the host's env panel.
3. **Domain** → Buy one (~$12/yr on Namecheap or Cloudflare). Avoid anything using "UW" or "Wisconsin" or the crest — that's a trademark issue with UW–Madison's licensing office. Use a badger-themed mark you own.
4. **Resend** → verify a domain you control, then set `RESEND_FROM=hi@yourdomain.tld` in `backend/.env`. `onboarding@resend.dev` is dev-only.
5. **TURN** → add a TURN server (Metered.ca free tier or Twilio) and update `RTC_CONFIGURATION` in `src/pages/VideoChatPage.tsx`. STUN alone fails behind many campus/corporate NATs.
6. **HTTPS** → required for `getUserMedia` (camera). Both Vercel and Render terminate TLS automatically.
7. **Growth** → r/udub, UW Discord servers, dorm group chats, flyers in Memorial Union and College Library. Do **not** imply official UW affiliation.

## Troubleshooting
- **OTP email never arrives**: check the backend logs for a `resend:send` error. With `onboarding@resend.dev`, Resend only allows sending to the email address that owns the Resend account — verify your own domain to send to anyone else.
- **"Missing auth token" on socket connect**: the frontend has no JWT. Clear `localStorage` and log in again, or check that `/auth/verify-code` is actually returning a token.
- **Realtime link stuck on "connecting"**: confirm the backend is running, `VITE_SOCKET_URL` matches, and `CLIENT_ORIGIN` on the backend permits your origin.
- **Camera preview doesn't show**: browsers require HTTPS or localhost. Grant camera permissions or toggle "Turn camera on".
- **No matches**: both browsers must be inside the same mode. Hit `GET /health` to confirm queue counts.
- **Supabase errors on boot**: run the migration in `backend/supabase/schema.sql` inside the project's SQL Editor.

Enjoy the lounge, and keep making Badger Connect more welcoming with every iteration.

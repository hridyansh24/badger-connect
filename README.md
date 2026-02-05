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
   # /.env
   VITE_SOCKET_URL=http://localhost:4000

   # backend/.env
   PORT=4000
   CLIENT_ORIGIN=http://localhost:5173
   ```
3. **Run the backend**
   ```bash
   cd backend
   npm run dev
   ```
4. **Run the frontend**
   ```bash
   npm run dev
   ```
5. Visit `http://localhost:5173`. When the socket connects you’ll see “Realtime link: connected” in both chat pages. Open two browser windows (or share the LAN URL) to see real matchmaking.

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
| `.env` | `VITE_SOCKET_URL` | Base URL of the Socket.IO backend (`http://localhost:4000` locally, or your deployed origin) |
| `backend/.env` | `PORT` | Port the Express server listens on (default `4000`) |
| `backend/.env` | `CLIENT_ORIGIN` | Comma-separated list of allowed origins for CORS / Socket.IO (e.g., `http://localhost:5173,http://10.0.0.42:5173`) |

When sharing over LAN, restart Vite with `npm run dev -- --host 0.0.0.0` and update both env files so `CLIENT_ORIGIN` and `VITE_SOCKET_URL` use your machine’s IP.

## Moderation + customization
- Update `public/banned-interests.txt` to add/remove forbidden interest keywords. The file is loaded at runtime, so edits go live after a refresh.
- Reaction thresholds live in both `src/context/FeedbackContext.tsx` and `backend/server.js`. Keep them consistent (default: 3 reports or 10 dislikes ban an email).
- The Socket.IO events currently cover profile updates, matchmaking, text messaging, session teardown, and reaction syncing. Extend these if you add WebRTC signaling (SDP/ICE) for real video streaming.

## Deployment checklist
1. Deploy the backend (Render, Fly, Railway, EC2, etc.) and expose HTTPS + WebSocket support.
2. Set `CLIENT_ORIGIN` to your frontend domain(s) and redeploy the backend.
3. Deploy the frontend (Netlify/Vercel/Static hosting) and set `VITE_SOCKET_URL` to the backend URL.
4. Enforce HTTPS for video (browsers block camera access on unsecured origins).
5. Add persistence (Postgres/Mongo) before expecting bans or queues to survive restarts.

## Troubleshooting
- **Realtime link stuck on “connecting”**: confirm the backend server is running, ports align with `VITE_SOCKET_URL`, and CORS permits your origin.
- **Camera preview doesn’t show**: browsers require HTTPS or localhost. Grant camera permissions or toggle the “Turn camera on” control.
- **No matches**: both browsers must be inside the same mode. Check `/health` on the backend to confirm queue counts.
- **Bans not sticking**: the in-memory reputation resets when either server restarts. Hook up a database or Redis for persistence.

Enjoy the lounge, and keep making Badger Connect more welcoming with every iteration.

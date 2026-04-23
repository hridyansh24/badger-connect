# Graph Report - .  (2026-04-21)

## Corpus Check
- Corpus is ~12,825 words - fits in a single context window. You may not need a graph.

## Summary
- 206 nodes · 232 edges · 34 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Socket chat UI & WebRTC signaling|Socket chat UI & WebRTC signaling]]
- [[_COMMUNITY_Onboarding & interest filtering|Onboarding & interest filtering]]
- [[_COMMUNITY_OTP auth endpoints & dev fallbacks|OTP auth endpoints & dev fallbacks]]
- [[_COMMUNITY_Server matchmaker & session state|Server matchmaker & session state]]
- [[_COMMUNITY_React context providers (authsocketfeedback)|React context providers (auth/socket/feedback)]]
- [[_COMMUNITY_Moderation & reputationban pipeline|Moderation & reputation/ban pipeline]]
- [[_COMMUNITY_TextChatPage handlers|TextChatPage handlers]]
- [[_COMMUNITY_Backend module top-level wiring|Backend module top-level wiring]]
- [[_COMMUNITY_server.js helper functions|server.js helper functions]]
- [[_COMMUNITY_auth.js primitives (JWTOTP)|auth.js primitives (JWT/OTP)]]
- [[_COMMUNITY_reputation.js data layer|reputation.js data layer]]
- [[_COMMUNITY_LoginPage form handlers|LoginPage form handlers]]
- [[_COMMUNITY_api.ts REST wrappers|api.ts REST wrappers]]
- [[_COMMUNITY_sessions.js audit log|sessions.js audit log]]
- [[_COMMUNITY_ModeSelectionPage interactions|ModeSelectionPage interactions]]
- [[_COMMUNITY_VerifyPage OTP input|VerifyPage OTP input]]
- [[_COMMUNITY_Cached handlers pair|Cached handlers pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_Small module pair|Small module pair]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]
- [[_COMMUNITY_isolated node|isolated node]]

## God Nodes (most connected - your core abstractions)
1. `TextChatPage` - 16 edges
2. `VideoChatPage` - 15 edges
3. `LoginPage` - 9 edges
4. `POST /auth/request-code` - 8 edges
5. `App Root Component` - 8 edges
6. `FeedbackContext (reputation)` - 7 edges
7. `Express + Socket.IO Server` - 6 edges
8. `reputation table (Supabase)` - 6 edges
9. `POST /auth/verify-code` - 6 edges
10. `CLAUDE.md Project Doc` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Concept: realtime matchmaking via Socket.IO` --conceptually_related_to--> `SocketContext (socket.io-client provider)`  [INFERRED]
  README.md → src/context/SocketContext.tsx
- `Rationale: Render/Fly over Vercel serverless — WebSocket needs always-on` --rationale_for--> `SocketContext (socket.io-client provider)`  [INFERRED]
  README.md → src/context/SocketContext.tsx
- `Concept: verified @wisc.edu onboarding` --conceptually_related_to--> `LoginPage`  [INFERRED]
  README.md → src/pages/LoginPage.tsx
- `Four-table Supabase schema` --rationale_for--> `Supabase table probe`  [EXTRACTED]
  CLAUDE.md → backend/scripts/probe.js
- `CLAUDE.md Project Doc` --references--> `Auth Primitives Module`  [EXTRACTED]
  CLAUDE.md → backend/lib/auth.js

## Hyperedges (group relationships)
- **OTP auth end-to-end flow** — auth_request_code, auth_verify_code, auth_generate_otp, auth_hash_otp, resend_send_otp, verification_codes_table, auth_sign_token [EXTRACTED 0.95]
- **Moderation → strike/ban pipeline** — server_chat_text_message, moderation_text_fn, reputation_flag_auto, reputation_hard_ban, reputation_thresholds [EXTRACTED 0.90]
- **Matchmaking + session lifecycle** — server_match_request, server_waiting_queues, server_attempt_pair, server_sessions_map, sessions_log_start, server_end_session, sessions_log_end [EXTRACTED 0.95]
- **Frontend OTP auth flow (login -> verify -> session)** — page_login, api_request_code_fn, page_verify, api_verify_code_fn, auth_context, auth_pending_signup, auth_localstorage_keys, socket_auth_token_attach [EXTRACTED 0.95]
- **WebRTC signaling over Socket.IO** — page_video_chat, socket_context, socket_event_webrtc_offer, socket_event_webrtc_answer, socket_event_webrtc_ice, video_rtc_configuration, video_getusermedia [EXTRACTED 0.95]
- **Moderation & auto-ban flow (consent, banned words, reactions, ban thresholds)** — login_consent_checkbox, login_interest_filter, banned_interests_file, hook_banned_interests, feedback_context, feedback_thresholds, socket_event_profile_reaction, socket_event_system_warning, socket_event_system_banned [EXTRACTED 0.90]

## Communities

### Community 0 - "Socket chat UI & WebRTC signaling"
Cohesion: 0.09
Nodes (32): App Root Component, AuthContext (JWT + user persistence), Concept: simulation fallback when socket offline, explain.txt implementation notes, ReactionType (like|dislike|report), React Main Entry, ModeSelectionPage, TextChatPage (+24 more)

### Community 1 - "Onboarding & interest filtering"
Cohesion: 0.12
Nodes (22): REST API client (requestCode/verifyCode), requestCode() POST /auth/request-code, verifyCode() POST /auth/verify-code, localStorage keys bc.token / bc.user, PendingSignup staging shape, public/banned-interests.txt wordlist, BrandMark hand-drawn W SVG, Concept: community safety / reputation bans (+14 more)

### Community 2 - "OTP auth endpoints & dev fallbacks"
Cohesion: 0.13
Nodes (17): Dev-mode OTP stdout fallback rationale, hashOtp() / verifyOtp(), isWiscEmail regex, In-memory rate limiter (5/hr/email), POST /auth/request-code, signToken() / verifyToken(), OTP_TTL_MS / OTP_MAX_ATTEMPTS / JWT_TTL, POST /auth/verify-code (+9 more)

### Community 3 - "Server matchmaker & session state"
Cohesion: 0.12
Nodes (16): JWT email is source of truth, Omegle-style 1:1 matchmaker, WebRTC signaling over Socket.IO, getReputation(), attemptPair (matchmaker), Email → Sockets Index, match:request handler, profile:update handler (+8 more)

### Community 4 - "React context providers (auth/socket/feedback)"
Cohesion: 0.13
Nodes (0): 

### Community 5 - "Moderation & reputation/ban pipeline"
Cohesion: 0.2
Nodes (14): BLOCK_CATEGORIES, CRITICAL_CATEGORIES, Fail-open rationale, moderateText(), OpenAI Moderation API (omni-moderation-latest), reports table (Supabase), applyReaction(), flagUserAuto() (+6 more)

### Community 6 - "TextChatPage handlers"
Cohesion: 0.2
Nodes (4): createMessage(), handlePaired(), handleSubmit(), sendMessage()

### Community 7 - "Backend module top-level wiring"
Cohesion: 0.33
Nodes (10): Auth Primitives Module, Auth Router, CLAUDE.md Project Doc, Service-role client bypasses RLS (RLS on for anon), Moderation Module, Reputation Module, Resend Email Module, Express + Socket.IO Server (+2 more)

### Community 8 - "server.js helper functions"
Cohesion: 0.25
Nodes (2): attemptPair(), sanitizeProfile()

### Community 9 - "auth.js primitives (JWT/OTP)"
Cohesion: 0.29
Nodes (0): 

### Community 10 - "reputation.js data layer"
Cohesion: 0.43
Nodes (4): applyReaction(), emptyRep(), flagUserAuto(), getReputation()

### Community 11 - "LoginPage form handlers"
Cohesion: 0.5
Nodes (2): handleAddInterest(), normalizeInterest()

### Community 12 - "api.ts REST wrappers"
Cohesion: 0.83
Nodes (3): post(), requestCode(), verifyCode()

### Community 13 - "sessions.js audit log"
Cohesion: 0.67
Nodes (0): 

### Community 14 - "ModeSelectionPage interactions"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "VerifyPage OTP input"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Cached handlers pair"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Small module pair"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Small module pair"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Small module pair"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Small module pair"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Small module pair"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Small module pair"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Small module pair"
Cohesion: 1.0
Nodes (2): React Logo, Vite Logo

### Community 24 - "isolated node"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "isolated node"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "isolated node"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "isolated node"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "isolated node"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "isolated node"
Cohesion: 1.0
Nodes (1): ESLint Config

### Community 30 - "isolated node"
Cohesion: 1.0
Nodes (1): Vite Config

### Community 31 - "isolated node"
Cohesion: 1.0
Nodes (1): /health route

### Community 32 - "isolated node"
Cohesion: 1.0
Nodes (1): Banned-interest substring filter

### Community 33 - "isolated node"
Cohesion: 1.0
Nodes (1): BackgroundFX decorative layer

## Knowledge Gaps
- **42 isolated node(s):** `ESLint Config`, `Vite Config`, `Waiting Queues (text/video)`, `Email → Sockets Index`, `profile:reaction handler` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `VerifyPage OTP input`** (2 nodes): `moderation.js`, `moderateText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cached handlers pair`** (2 nodes): `resend.js`, `sendOtpEmail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `rateLimit()`, `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `BrandMark()`, `BrandMark.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `BackgroundFX()`, `BackgroundFX.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `useBannedInterests.ts`, `useBannedInterests()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `VideoChatPage.tsx`, `createVideoSessionId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `VerifyPage.tsx`, `VerifyPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small module pair`** (2 nodes): `React Logo`, `Vite Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `probe.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `supabase.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `ESLint Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `Vite Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `/health route`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `Banned-interest substring filter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `isolated node`** (1 nodes): `BackgroundFX decorative layer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App Root Component` connect `Socket chat UI & WebRTC signaling` to `Onboarding & interest filtering`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `getReputation()` connect `Server matchmaker & session state` to `OTP auth endpoints & dev fallbacks`, `Moderation & reputation/ban pipeline`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `TextChatPage` connect `Socket chat UI & WebRTC signaling` to `Onboarding & interest filtering`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `ESLint Config`, `Vite Config`, `Waiting Queues (text/video)` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Socket chat UI & WebRTC signaling` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Onboarding & interest filtering` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `OTP auth endpoints & dev fallbacks` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
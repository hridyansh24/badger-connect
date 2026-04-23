-- Badger Connect — initial schema
-- Paste the whole file into Supabase SQL Editor and run once.
-- Safe to re-run: uses `if not exists` / `on conflict` throughout.

create extension if not exists pgcrypto;

create table if not exists public.users (
  email text primary key check (email = lower(email) and email like '%@wisc.edu'),
  name text not null,
  interests jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  consented_at timestamptz
);

-- Idempotent column add for existing deployments
alter table public.users add column if not exists consented_at timestamptz;

create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists verification_codes_email_idx
  on public.verification_codes (email, created_at desc);

create table if not exists public.reputation (
  email text primary key references public.users(email) on delete cascade,
  likes int not null default 0,
  dislikes int not null default 0,
  reports int not null default 0,
  banned boolean not null default false,
  banned_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_email text not null references public.users(email) on delete cascade,
  target_email text not null references public.users(email) on delete cascade,
  session_id text,
  reason text,
  created_at timestamptz not null default now(),
  unique (reporter_email, target_email, session_id)
);

-- Pairing audit log: who matched with whom, when, who ended it.
create table if not exists public.sessions (
  id uuid primary key,
  mode text not null check (mode in ('text', 'video')),
  user_a_email text not null references public.users(email) on delete cascade,
  user_b_email text not null references public.users(email) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by text,
  flagged_reason text
);

create index if not exists sessions_user_a_idx
  on public.sessions (user_a_email, started_at desc);
create index if not exists sessions_user_b_idx
  on public.sessions (user_b_email, started_at desc);

-- The backend uses the service_role key, which bypasses RLS.
-- We still enable RLS so the anon/publishable key cannot read these tables
-- from the browser by accident.
alter table public.users enable row level security;
alter table public.verification_codes enable row level security;
alter table public.reputation enable row level security;
alter table public.reports enable row level security;
alter table public.sessions enable row level security;

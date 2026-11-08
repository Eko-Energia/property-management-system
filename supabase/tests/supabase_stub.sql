-- Minimal stand-in for what the Supabase platform provides, so migrations
-- can run on a plain Postgres (PGlite) in tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default clock_timestamp(),
  updated_at         timestamptz,
  encrypted_password text
);

-- pgcrypto lives in the "extensions" schema on Supabase; PGlite has no pgcrypto,
-- so a deterministic fake is enough to test who may change a password
create schema extensions;
create function extensions.gen_salt(text) returns text language sql immutable as $$ select '$fake$' $$;
create function extensions.crypt(text, text) returns text language sql immutable as $$ select $2 || md5($1) $$;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create publication supabase_realtime;

-- Supabase's default privileges for objects created by postgres in public
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

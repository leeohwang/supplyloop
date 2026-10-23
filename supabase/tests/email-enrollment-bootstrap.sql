-- Only the new temporary local cluster created by test-email-enrollment-local.mjs.
do $guard$ begin
  if current_user <> 'supplyloop_fixture_admin'
    or pg_catalog.current_setting('supplyloop.fixture', true) is distinct from 'email-enrollment-v1' then
    raise exception 'This fixture requires its own isolated local cluster.';
  end if;
end; $guard$;

create role postgres login nosuperuser createdb createrole noinherit nobypassrls;
create role supabase_admin nologin nosuperuser noinherit;
create role anon nologin nosuperuser noinherit;
create role authenticated nologin nosuperuser noinherit;
create role service_role nologin nosuperuser noinherit bypassrls;
alter database postgres owner to postgres;
grant usage, create on schema public to postgres;
create schema auth authorization supabase_admin;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  is_anonymous boolean not null default false,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
alter table auth.users owner to supabase_admin;
revoke all on schema auth from public;
revoke all on auth.users from public, anon, authenticated, service_role;
grant usage on schema auth to postgres, authenticated;
grant select (id, email, email_confirmed_at, is_anonymous), references (id) on auth.users to postgres;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $fn$ select coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
  (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid; $fn$;
alter function auth.uid() owner to supabase_admin;
grant execute on function auth.uid() to authenticated;

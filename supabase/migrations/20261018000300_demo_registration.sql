-- Demo-only enrollment: Auth signup is separate and does not verify email.
-- Only this authenticated function grants code-gated School A student access.
-- PG17 function security/advisory locks/SHA-256 docs checked 2026-10-18.
begin;
set local lock_timeout = '5s';

create table private.demo_registration_config (
  singleton boolean primary key default true check (singleton),
  school_id uuid not null references public.schools(id)
    check (school_id = '11111111-1111-1111-1111-111111111111'::uuid),
  code_digest bytea not null check (pg_catalog.octet_length(code_digest) = 32),
  enabled boolean not null default false,
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
create table private.demo_enrollments (
  user_id uuid primary key references auth.users(id),
  school_id uuid not null check (school_id = '11111111-1111-1111-1111-111111111111'::uuid),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key (school_id, user_id) references public.memberships(school_id, user_id)
);
alter table private.demo_registration_config owner to supplyloop_owner;
alter table private.demo_enrollments owner to supplyloop_owner;
alter table private.demo_registration_config enable row level security;
alter table private.demo_enrollments enable row level security;
revoke all on private.demo_registration_config, private.demo_enrollments from public, anon, authenticated, service_role;

create function private.join_demo_school(p_access_code text, p_display_label text)
returns public.memberships
language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  v_actor uuid := private.require_actor();
  v_member public.memberships;
  v_school uuid;
  v_label text;
begin
  -- Serialize retries from this actor. Hash collisions only serialize unrelated
  -- enrollments; no authorization decision is based on the hash.
  perform pg_catalog.pg_advisory_xact_lock(20261018, pg_catalog.hashtext(v_actor::text));
  select m.* into v_member from private.demo_enrollments as e
    join public.memberships as m on m.school_id = e.school_id and m.user_id = e.user_id
    where e.user_id = v_actor for share of m;
  if found then
    if not v_member.active or v_member.role <> 'member' then
      raise exception using errcode = 'SL002', message = 'This account cannot enroll in the demo school.';
    end if;
    return v_member;
  end if;
  if exists (select 1 from public.memberships as m where m.user_id = v_actor) then
    raise exception using errcode = 'SL002', message = 'This account cannot enroll in the demo school.';
  end if;
  v_label := pg_catalog.regexp_replace(p_display_label, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_label is null or v_label = '' then
    raise exception using errcode = 'SL004', message = 'Enter a display name.';
  end if;
  -- The code is a bearer credential supplied only to this RPC, never Auth
  -- metadata. A shared lock serializes enrollment with operator rotation/disable.
  select c.school_id into v_school from private.demo_registration_config as c
    where c.singleton and c.enabled and p_access_code is not null
      and c.code_digest = pg_catalog.sha256(pg_catalog.convert_to(p_access_code, 'UTF8'))
    for share;
  if not found then
    raise exception using errcode = 'SL009', message = 'The demo access code was not accepted. Check it with the demo operator.';
  end if;
  insert into public.memberships as m (school_id, user_id, role, active, display_label)
    values (v_school, v_actor, 'member', true, v_label) returning m.* into v_member;
  insert into private.demo_enrollments (user_id, school_id, created_at)
    values (v_actor, v_school, v_member.created_at);
  return v_member;
end;
$fn$;
alter function private.join_demo_school(text, text) owner to supplyloop_owner;
revoke all on function private.join_demo_school(text, text) from public, anon, authenticated, service_role;
grant execute on function private.join_demo_school(text, text) to authenticated;

-- Temporarily permit ownership transfer of this one new public wrapper.
grant create on schema public to supplyloop_owner;
create function public.join_demo_school(p_access_code text, p_display_label text)
returns public.memberships
language sql volatile security invoker set search_path = ''
as $fn$ select private.join_demo_school(p_access_code, p_display_label); $fn$;
alter function public.join_demo_school(text, text) owner to supplyloop_owner;
revoke all on function public.join_demo_school(text, text) from public, anon, authenticated, service_role;
grant execute on function public.join_demo_school(text, text) to authenticated;
revoke create on schema public from supplyloop_owner;

-- No config row or code is embedded here: new enrollment stays closed until
-- an operator explicitly installs the privately prepared hashed configuration.
notify pgrst, 'reload schema';
commit;

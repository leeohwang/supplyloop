-- New enrollments require a recent emailed OTP, including legacy autoconfirmed
-- accounts without memberships. Existing memberships/history are preserved.
-- Target: Supabase PostgreSQL 17.11, Auth v2.197.0; sources checked 2026-10-23:
-- https://www.postgresql.org/docs/17/sql-createfunction.html
-- https://www.postgresql.org/docs/17/functions-info.html
-- https://supabase.com/docs/guides/auth/jwt-fields
-- https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/verify.go
-- https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/models/sessions.go
-- Apply through trusted operator tooling only, after SMTP and app preparation.
begin;
set local lock_timeout = '5s';

do $preflight$
begin
  -- The application owner cannot read managed Auth tables. A narrow postgres-
  -- owned boolean bridge avoids granting it Auth schema/table access.
  if current_user <> 'postgres'
    or not pg_catalog.has_schema_privilege('postgres', 'auth', 'USAGE')
    or not pg_catalog.has_schema_privilege('postgres', 'private', 'CREATE')
    or not pg_catalog.has_column_privilege('postgres', 'auth.users', 'id', 'SELECT')
    or not pg_catalog.has_column_privilege('postgres', 'auth.users', 'email', 'SELECT')
    or not pg_catalog.has_column_privilege('postgres', 'auth.users', 'email_confirmed_at', 'SELECT')
    or not pg_catalog.has_column_privilege('postgres', 'auth.users', 'is_anonymous', 'SELECT') then
    raise exception 'Required trusted Auth read privileges are unavailable; enrollment migration refused.';
  end if;
end;
$preflight$;

create function private.session_has_recent_email_otp()
returns boolean
language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_actor uuid;
  v_claims jsonb;
  v_entry jsonb;
  v_proof_epoch bigint;
  v_now_epoch bigint := pg_catalog.floor(extract(epoch from pg_catalog.statement_timestamp()))::bigint;
  v_recent_otp boolean := false;
begin
  -- PostgREST sets these claims from the verified JWT, not request JSON or
  -- editable Auth metadata. Malformed/missing claim state fails closed.
  begin
    v_claims := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb;
    v_actor := private.session_actor();
  exception when invalid_text_representation then
    return false;
  end;
  if v_actor is null or pg_catalog.jsonb_typeof(v_claims) is distinct from 'object' then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(v_claims -> 'sub') is distinct from 'string'
    or (v_claims ->> 'sub') is distinct from v_actor::text
    or (v_claims -> 'role') is distinct from '"authenticated"'::jsonb
    or pg_catalog.jsonb_typeof(v_claims -> 'email') is distinct from 'string'
    or nullif(v_claims ->> 'email', '') is null
    or (v_claims -> 'phone') is distinct from '""'::jsonb
    or (v_claims -> 'is_anonymous') is distinct from 'false'::jsonb
    or pg_catalog.jsonb_typeof(v_claims -> 'amr') is distinct from 'array' then
    return false;
  end if;

  -- Auth v2.197.0 POST email signup/OTP verification issues method "otp";
  -- password/autoconfirm login does not. OTP is also used for phone auth, so
  -- phone-bearing sessions are rejected above. Phone signup remains disabled.
  -- AMR time records the actual authentication, unlike JWT iat, which refreshes.
  for v_entry in select a.value from pg_catalog.jsonb_array_elements(v_claims -> 'amr') as a(value) loop
    if pg_catalog.jsonb_typeof(v_entry) = 'object'
      and (v_entry -> 'method') = '"otp"'::jsonb
      and pg_catalog.jsonb_typeof(v_entry -> 'timestamp') = 'number'
      and (v_entry ->> 'timestamp') ~ '^[0-9]{1,12}$' then
      -- The bounded digits check makes bigint conversion safe even for malformed
      -- claim fixtures. Do not use JWT issue time to renew an old OTP proof.
      v_proof_epoch := (v_entry ->> 'timestamp')::bigint;
      if v_proof_epoch between v_now_epoch - 3600 and v_now_epoch + 60 then
        v_recent_otp := true;
        exit;
      end if;
    end if;
  end loop;
  if not v_recent_otp then return false; end if;

  -- Historical autoconfirm timestamps alone are insufficient. The signed OTP
  -- session must also name the currently confirmed, nonanonymous Auth email.
  return exists (select 1 from auth.users as u
    where u.id = v_actor and u.email = (v_claims ->> 'email')
      and u.email_confirmed_at is not null and u.is_anonymous is false);
end;
$fn$;
alter function private.session_has_recent_email_otp() owner to postgres;
revoke all on function private.session_has_recent_email_otp() from public, anon, authenticated, service_role, supplyloop_owner;
grant execute on function private.session_has_recent_email_otp() to supplyloop_owner;

create or replace function private.join_demo_school(p_access_code text, p_display_label text)
returns public.memberships
language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  v_actor uuid := private.require_actor();
  v_member public.memberships;
  v_school uuid;
  v_label text;
begin
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
  if not private.session_has_recent_email_otp() then
    raise exception using errcode = 'SL010', message = 'Confirm your email with a new emailed code before joining the demo school.';
  end if;
  v_label := pg_catalog.regexp_replace(p_display_label, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_label is null or v_label = '' then
    raise exception using errcode = 'SL004', message = 'Enter a display name.';
  end if;
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
-- CREATE OR REPLACE retains the existing constrained owner and exact grants.
notify pgrst, 'reload schema';
commit;

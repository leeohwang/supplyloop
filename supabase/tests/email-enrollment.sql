-- This exercises database authorization, not actual Auth email delivery. JWT
-- contexts are trusted fixtures in a disposable local cluster, never browser
-- metadata or minted tokens used against the hosted project.
do $guard$ begin
  if current_user <> 'supplyloop_fixture_admin'
    or pg_catalog.current_setting('supplyloop.fixture', true) is distinct from 'email-enrollment-v1' then
    raise exception 'This fixture requires its own isolated local cluster.';
  end if;
end; $guard$;

create schema fixture;
grant usage on schema fixture to authenticated, anon, service_role, supplyloop_owner;
create function fixture.assert(p_ok boolean, p_label text) returns void language plpgsql as $fn$
begin if p_ok is not true then raise exception 'Fixture assertion failed: %', p_label; end if; end; $fn$;
create function fixture.claims(p_actor uuid, p_email text, p_method text default 'password', p_age integer default 0)
returns jsonb language sql stable as $fn$
select pg_catalog.jsonb_build_object('sub', p_actor, 'role', 'authenticated', 'email', p_email,
  'phone', '', 'is_anonymous', false, 'iat', extract(epoch from pg_catalog.statement_timestamp())::bigint,
  'amr', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('method', p_method,
    'timestamp', pg_catalog.floor(extract(epoch from pg_catalog.statement_timestamp()))::bigint - p_age)));
$fn$;
create function fixture.set_context(p_claims text, p_split_sub text default '') returns void language plpgsql as $fn$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', p_split_sub, false);
  perform pg_catalog.set_config('request.jwt.claims', p_claims, false);
end; $fn$;
create function fixture.expect_join_error(p_state text, p_code text default 'isolated-fixture-code', p_label text default 'Test student')
returns void language plpgsql as $fn$
begin
  begin
    perform public.join_demo_school(p_code, p_label);
  exception when others then
    if sqlstate = p_state then return; end if;
    raise exception 'Expected %, received %', p_state, sqlstate;
  end;
  raise exception 'Expected % but enrollment succeeded', p_state;
end; $fn$;
create function fixture.snapshot() returns jsonb language sql stable as $fn$
select pg_catalog.jsonb_build_object(
  'schools', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.id) from public.schools as t),
  'memberships', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.school_id, t.user_id) from public.memberships as t),
  'items', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.id) from public.items as t),
  'staff', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.school_id, t.item_id) from public.item_staff as t),
  'reservations', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.id) from public.reservations as t),
  'events', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.id) from public.item_events as t),
  'enrollments', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.user_id) from private.demo_enrollments as t),
  'config', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)) from private.demo_registration_config as t));
$fn$;

\ir ../seed.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'manager-a@supplyloop.example', '2020-01-01Z'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'student-a1@supplyloop.example', '2020-01-01Z'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'student-a2@supplyloop.example', '2020-01-01Z'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'manager-b@supplyloop.example', '2020-01-01Z'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'student-b1@supplyloop.example', '2020-01-01Z'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'student-b2@supplyloop.example', '2020-01-01Z'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'legacy@supplyloop.example', '2020-01-01Z'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'unconfirmed@supplyloop.example', null),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'new@supplyloop.example', pg_catalog.now()),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'anonymous@supplyloop.example', pg_catalog.now()),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'enrolled@supplyloop.example', '2020-01-01Z'),
  ('bbbbbbbb-0000-4000-8000-000000000006', 'promoted@supplyloop.example', '2020-01-01Z'),
  ('bbbbbbbb-0000-4000-8000-000000000007', 'inactive@supplyloop.example', '2020-01-01Z'),
  ('bbbbbbbb-0000-4000-8000-000000000008', 'race@supplyloop.example', pg_catalog.now());
update auth.users set is_anonymous=true where id='bbbbbbbb-0000-4000-8000-000000000004';
insert into public.memberships (school_id, user_id, role, display_label) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'manager', 'Original manager A'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'member', 'Original student A1'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000003', 'member', 'Original student A2'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000004', 'manager', 'Original manager B'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000005', 'member', 'Original student B1'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000006', 'member', 'Original student B2'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000005', 'member', 'Preserve this label'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000006', 'manager', 'Promoted student'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000007', 'member', 'Inactive student');
update public.memberships set active=false where user_id='bbbbbbbb-0000-4000-8000-000000000007';
insert into private.demo_enrollments (user_id, school_id, created_at)
select m.user_id, m.school_id, m.created_at from public.memberships as m
where m.user_id in ('bbbbbbbb-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000007');
insert into private.demo_registration_config (singleton, school_id, code_digest, enabled)
values (true, '11111111-1111-1111-1111-111111111111', pg_catalog.sha256(pg_catalog.convert_to('isolated-fixture-code','UTF8')), true);

-- Establish ordinary-session handoff history before applying the new migration.
set role authenticated;
select fixture.set_context(fixture.claims('aaaaaaaa-0000-4000-8000-000000000001', 'manager-a@supplyloop.example')::text);
select item_id from public.intake_item('11111111-1111-1111-1111-111111111111', 'clothing',
  '{"title":"Historical sweater","condition":"good","garment_type":"sweater","size_system":"letter","size_label":"M","color_variant":"navy","measurements":null,"measurement_unit":null}', 'Fixture shelf') \gset history_
select changed from public.publish_item(:'history_item_id', true) \gset history_
select fixture.set_context(fixture.claims('aaaaaaaa-0000-4000-8000-000000000002', 'student-a1@supplyloop.example')::text);
select reservation_id from public.reserve_item(:'history_item_id') \gset history_
select fixture.set_context(fixture.claims('aaaaaaaa-0000-4000-8000-000000000001', 'manager-a@supplyloop.example')::text);
select changed from public.complete_pickup(:'history_reservation_id') \gset history_
reset role;
create table fixture.before_state as select fixture.snapshot() as state;
create table fixture.before_join_acl as select p.proowner, p.proacl from pg_catalog.pg_proc as p
where p.oid='private.join_demo_school(text,text)'::regprocedure;

set role postgres;
\ir ../migrations/20261023000100_email_confirmed_enrollment.sql
reset role;
select fixture.assert((select state=fixture.snapshot() from fixture.before_state), 'Migration preserves every business/config/history row');
select fixture.assert((select p.proowner=b.proowner and p.proacl=b.proacl from pg_catalog.pg_proc as p cross join fixture.before_join_acl as b where p.oid='private.join_demo_school(text,text)'::regprocedure), 'Existing join owner/grants unchanged');
select fixture.assert((select pg_catalog.pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s' and p.pronargs=0 and p.prorettype='boolean'::regtype and p.proconfig=array['search_path=""'] from pg_catalog.pg_proc as p where p.oid='private.session_has_recent_email_otp()'::regprocedure), 'Helper has narrow fixed contract');
select fixture.assert(not pg_catalog.has_schema_privilege('supplyloop_owner','auth','USAGE'), 'Application owner still cannot enter Auth schema');
select fixture.assert(not pg_catalog.has_function_privilege('authenticated','private.session_has_recent_email_otp()','EXECUTE')
  and not pg_catalog.has_function_privilege('anon','private.session_has_recent_email_otp()','EXECUTE')
  and not pg_catalog.has_function_privilege('service_role','private.session_has_recent_email_otp()','EXECUTE')
  and pg_catalog.has_function_privilege('supplyloop_owner','private.session_has_recent_email_otp()','EXECUTE'), 'Helper ordinary-role execute grants denied');
set role authenticated;
do $denied$ begin
  begin perform private.session_has_recent_email_otp();
    raise exception 'Authenticated role unexpectedly called the helper';
  exception when insufficient_privilege then null; end;
end; $denied$;
reset role;
set role anon;
do $denied$ begin
  begin perform private.session_has_recent_email_otp();
    raise exception 'Anonymous role unexpectedly called the helper';
  exception when insufficient_privilege then null; end;
end; $denied$;
reset role;
set role service_role;
do $denied$ begin
  begin perform private.session_has_recent_email_otp();
    raise exception 'Service role unexpectedly called the helper';
  exception when insufficient_privilege then null; end;
end; $denied$;
reset role;

-- The helper itself returns false for malformed/missing trusted request state.
set role supplyloop_owner;
select fixture.set_context('');
select fixture.assert(not private.session_has_recent_email_otp(), 'Missing claims fail closed');
select fixture.set_context('{broken');
select fixture.assert(not private.session_has_recent_email_otp(), 'Malformed JSON fails closed');
select fixture.set_context('{"sub":"not-a-uuid"}');
select fixture.assert(not private.session_has_recent_email_otp(), 'Malformed actor fails closed');
reset role;

set role authenticated;
select fixture.set_context('');
select fixture.expect_join_error('SL001');
select fixture.set_context('', 'bbbbbbbb-0000-4000-8000-000000000001');
select fixture.expect_join_error('SL010');
select fixture.set_context('{broken', 'bbbbbbbb-0000-4000-8000-000000000001');
select fixture.expect_join_error('SL010');

-- Historical confirmation, fresh JWT iat and editable metadata are not proof.
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context((fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example') || '{"user_metadata":{"email_verified":true,"role":"manager","amr":[{"method":"otp","timestamp":9999999999}]}}')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','email/signup')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','totp')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','otp',3700)::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','otp',-120)::text);
select fixture.expect_join_error('SL010');

-- Valid OTP method cannot bypass the live confirmed email/nonanonymous check.
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000002','unconfirmed@supplyloop.example','otp')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000004','anonymous@supplyloop.example','otp')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000009','missing@supplyloop.example','otp')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','old-address@supplyloop.example','otp')::text);
select fixture.expect_join_error('SL010');
select fixture.set_context((fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','otp') || '{"phone":"+15555550100"}')::text);
select fixture.expect_join_error('SL010');

-- Malformed shapes, string/fractional/oversized timestamps and mismatched actor.
do $cases$
declare v_base jsonb := fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','otp'); v_bad jsonb;
begin
  for v_bad in select value from pg_catalog.jsonb_array_elements('[{"amr":null},{"amr":{}},{"amr":["otp"]},{"amr":[{"method":"otp"}]},{"amr":[{"method":"otp","timestamp":"9999999999"}]},{"amr":[{"method":"otp","timestamp":1.5}]},{"amr":[{"method":"otp","timestamp":1000000000000000000000000000000}]},{"is_anonymous":true},{"email":null},{"role":"service_role"},{"phone":null}]'::jsonb) loop
    perform fixture.set_context((v_base || v_bad)::text);
    perform fixture.expect_join_error('SL010');
  end loop;
  perform fixture.set_context((v_base - 'phone')::text);
  perform fixture.expect_join_error('SL010');
  perform fixture.set_context((v_base - 'amr')::text);
  perform fixture.expect_join_error('SL010');
  perform fixture.set_context(v_base::text, 'bbbbbbbb-0000-4000-8000-000000000003');
  perform fixture.expect_join_error('SL010');
end; $cases$;

-- Correct email proof still requires valid community code and label.
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000003','new@supplyloop.example','otp')::text);
select fixture.expect_join_error('SL009','wrong-fixture-code');
select fixture.expect_join_error('SL004','isolated-fixture-code','   ');
reset role;
select fixture.assert((select state=fixture.snapshot() from fixture.before_state), 'All rejected new joins leave complete database snapshots unchanged');

-- New and legacy unenrolled actors both require a genuine OTP session context.
set role authenticated;
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000003','new@supplyloop.example','otp')::text);
select fixture.assert((select j.role='member' and j.active and j.school_id='11111111-1111-1111-1111-111111111111' and j.display_label='New student' from public.join_demo_school('isolated-fixture-code',' New student ') as j), 'Confirmed new signup enrolls only as School A student');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000001','legacy@supplyloop.example','otp')::text);
select fixture.assert((select j.role='member' and j.active and j.display_label='Legacy student' from public.join_demo_school('isolated-fixture-code','Legacy student') as j), 'Legacy unenrolled actor succeeds after fresh OTP');
reset role;

-- Retries survive disabled/rotated code and password sessions; existing ledger
-- memberships are never relabeled/reactivated/promoted by the enrollment API.
update private.demo_registration_config set enabled=false, code_digest=pg_catalog.sha256(pg_catalog.convert_to('rotated-fixture-code','UTF8'));
set role authenticated;
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000005','enrolled@supplyloop.example')::text);
select fixture.assert((select j.display_label='Preserve this label' and j.role='member' and j.active from public.join_demo_school('wrong','Changed label') as j), 'Existing legacy ledger retry preserved without new email proof');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000003','new@supplyloop.example')::text);
select fixture.assert((select j.display_label='New student' from public.join_demo_school('wrong','Changed label') as j), 'New enrollment retries preserve original label');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000006','promoted@supplyloop.example')::text);
select fixture.expect_join_error('SL002');
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000007','inactive@supplyloop.example')::text);
select fixture.expect_join_error('SL002');
do $fixed$
declare v_actor uuid;
begin
  foreach v_actor in array array['aaaaaaaa-0000-4000-8000-000000000001'::uuid,'aaaaaaaa-0000-4000-8000-000000000002'::uuid,'aaaaaaaa-0000-4000-8000-000000000003'::uuid,'aaaaaaaa-0000-4000-8000-000000000004'::uuid,'aaaaaaaa-0000-4000-8000-000000000005'::uuid,'aaaaaaaa-0000-4000-8000-000000000006'::uuid] loop
    perform fixture.set_context(fixture.claims(v_actor,'fixed@supplyloop.example')::text);
    perform fixture.expect_join_error('SL002');
  end loop;
end; $fixed$;
reset role;
select fixture.assert((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.school_id,m.user_id) from public.memberships as m where m.user_id::text like 'aaaaaaaa-%') = (select pg_catalog.jsonb_agg(v order by v->>'school_id',v->>'user_id') from fixture.before_state as b cross join lateral pg_catalog.jsonb_array_elements(b.state->'memberships') as e(v) where v->>'user_id' like 'aaaaaaaa-%'), 'All six fixed memberships retain original roles, labels and timestamps');
select fixture.assert((select state->'items'=fixture.snapshot()->'items' and state->'reservations'=fixture.snapshot()->'reservations' and state->'events'=fixture.snapshot()->'events' and state->'staff'=fixture.snapshot()->'staff' from fixture.before_state), 'Completed handoff inventory, recipients and audit history unchanged');
update private.demo_registration_config set enabled=true,code_digest=pg_catalog.sha256(pg_catalog.convert_to('isolated-fixture-code','UTF8'));
select 'Email enrollment SQL regression passed';

-- SupplyLoop fictional-data prototype. Target: PostgreSQL 17.11 / Supabase.
-- Official PostgreSQL 17 docs checked 2026-10-18: explicit-locking.html,
-- sql-createindex.html (partial UNIQUE indexes), ddl-constraints.html,
-- sql-createfunction.html, sql-grant.html, sql-createpolicy.html,
-- plpgsql-errors-and-messages.html. Supabase functions/RLS/API docs also read.
-- Apply once through trusted operator tooling, after review. No credentials.
begin;
set local lock_timeout = '5s';

create role supplyloop_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant supplyloop_owner to postgres with inherit true, set true;
grant usage, create on schema public to supplyloop_owner;
create schema private authorization supplyloop_owner;
revoke all on schema private from public, anon, authenticated, service_role;
revoke create on schema public from public, anon, authenticated;
grant usage on schema public, private to authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role supplyloop_owner in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

create function private.valid_isbn13(p_value text)
returns boolean language sql immutable security invoker set search_path = ''
as $fn$
  select case when p_value is null then true
    when p_value !~ '^[0-9]{13}$' then false
    else (select pg_catalog.sum(pg_catalog.substr(p_value, n, 1)::integer
      * case when n % 2 = 0 then 3 else 1 end) % 10 = 0
      from pg_catalog.generate_series(1, 13) as n) end;
$fn$;

create table public.schools (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null check (pg_catalog.btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  enabled_categories text[] not null default array['clothing', 'textbook']::text[]
    check (pg_catalog.cardinality(enabled_categories) > 0
      and enabled_categories <@ array['clothing', 'textbook']::text[]
      and pg_catalog.array_position(enabled_categories, null) is null),
  pickup_label text not null check (pg_catalog.btrim(pickup_label) <> ''),
  term_label text not null check (pg_catalog.btrim(term_label) <> ''),
  created_at timestamptz not null default pg_catalog.now()
);

create table public.memberships (
  school_id uuid not null references public.schools(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('member', 'manager')),
  active boolean not null default true,
  display_label text not null check (pg_catalog.btrim(display_label) <> ''),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (school_id, user_id)
);
create index memberships_user_school_idx on public.memberships(user_id, school_id) where active;

create table public.items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  item_code text not null check (pg_catalog.btrim(item_code) <> ''),
  category text not null check (category in ('clothing', 'textbook')),
  title text check (title is null or pg_catalog.btrim(title) <> ''),
  condition text check (condition is null or condition in ('new', 'like_new', 'good', 'fair')),
  status text not null default 'intake' check (status in ('intake', 'available', 'reserved', 'transferred', 'retired')),
  garment_type text check (garment_type is null or garment_type in ('shirt', 'sweater', 'jacket', 'trousers', 'skirt')),
  size_system text check (size_system is null or size_system = 'letter'),
  size_label text check (size_label is null or size_label in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  color_variant text check (color_variant is null or pg_catalog.btrim(color_variant) <> ''),
  measurements text check (measurements is null or pg_catalog.btrim(measurements) <> ''),
  measurement_unit text check (measurement_unit is null or measurement_unit in ('cm', 'in')),
  isbn13 text check (private.valid_isbn13(isbn13)),
  edition text check (edition is null or pg_catalog.btrim(edition) <> ''),
  book_format text check (book_format is null or pg_catalog.btrim(book_format) <> ''),
  course_label text check (course_label is null or pg_catalog.btrim(course_label) <> ''),
  book_term_label text check (book_term_label is null or pg_catalog.btrim(book_term_label) <> ''),
  requires_digital_code boolean,
  is_consumable boolean,
  approved_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  available_at timestamptz,
  unique (school_id, id),
  unique (school_id, item_code),
  constraint items_category_fields_check check (
    (category = 'clothing' and isbn13 is null and edition is null and book_format is null
      and course_label is null and book_term_label is null
      and requires_digital_code is null and is_consumable is null)
    or (category = 'textbook' and garment_type is null and size_system is null
      and size_label is null and color_variant is null and measurements is null
      and measurement_unit is null)),
  constraint items_measurement_pair_check check ((measurements is null) = (measurement_unit is null)),
  constraint items_publication_fields_check check (
    status in ('intake', 'retired') or
    (title is not null and condition is not null and approved_at is not null and available_at is not null
      and ((category = 'clothing' and garment_type is not null and size_system is not null
        and size_label is not null and color_variant is not null)
      or (category = 'textbook' and isbn13 is not null and edition is not null and book_format is not null
        and requires_digital_code is false and is_consumable is false))))
);
create index items_catalog_idx on public.items(school_id, category, available_at, id) where status = 'available';

create table public.item_staff (
  school_id uuid not null,
  item_id uuid not null,
  storage_code text check (storage_code is null or pg_catalog.btrim(storage_code) <> ''),
  inspection_passed boolean not null default false,
  inspected_at timestamptz,
  inspected_by uuid,
  received_by uuid not null,
  received_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (school_id, item_id),
  foreign key (school_id, item_id) references public.items(school_id, id),
  foreign key (school_id, inspected_by) references public.memberships(school_id, user_id),
  foreign key (school_id, received_by) references public.memberships(school_id, user_id),
  constraint item_staff_inspection_check check (
    (inspection_passed and inspected_at is not null and inspected_by is not null)
    or (not inspection_passed and inspected_at is null and inspected_by is null))
);

create table public.reservations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  school_id uuid not null,
  item_id uuid not null,
  member_id uuid not null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamptz not null default pg_catalog.now(),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  completed_at timestamptz,
  completed_by uuid,
  unique (school_id, id),
  unique (school_id, id, item_id),
  foreign key (school_id, item_id) references public.items(school_id, id),
  foreign key (school_id, member_id) references public.memberships(school_id, user_id),
  foreign key (school_id, cancelled_by) references public.memberships(school_id, user_id),
  foreign key (school_id, completed_by) references public.memberships(school_id, user_id),
  constraint reservations_outcome_check check (
    (status = 'active' and cancelled_at is null and cancelled_by is null and cancel_reason is null
      and completed_at is null and completed_by is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null
      and cancel_reason is not null and cancel_reason in ('member_cancelled', 'uncollected', 'member_request', 'stock_issue')
      and completed_at is null and completed_by is null)
    or (status = 'completed' and completed_at is not null and completed_by is not null
      and completed_by <> member_id and cancelled_at is null and cancelled_by is null and cancel_reason is null))
);
create unique index reservations_one_active_item_idx on public.reservations(item_id) where status = 'active';
create unique index reservations_one_completed_item_idx on public.reservations(item_id) where status = 'completed';
create index reservations_member_idx on public.reservations(school_id, member_id, status);
create index reservations_queue_idx on public.reservations(school_id, status, created_at);

create table public.item_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  school_id uuid not null,
  item_id uuid not null,
  reservation_id uuid,
  action text not null check (action in ('intake_received', 'published', 'details_updated', 'reserved', 'cancelled', 'released', 'pickup_completed', 'retired')),
  actor_id uuid not null,
  reason text,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (school_id, item_id) references public.items(school_id, id),
  foreign key (school_id, reservation_id, item_id) references public.reservations(school_id, id, item_id),
  foreign key (school_id, actor_id) references public.memberships(school_id, user_id),
  constraint item_events_reservation_check check (
    (action in ('reserved', 'cancelled', 'released', 'pickup_completed') and reservation_id is not null)
    or (action in ('intake_received', 'published', 'details_updated', 'retired') and reservation_id is null)),
  constraint item_events_reason_check check (
    (action = 'cancelled' and reason is not null and reason = 'member_cancelled')
    or (action = 'released' and reason is not null and reason in ('uncollected', 'member_request', 'stock_issue'))
    or (action = 'retired' and reason is not null and reason in ('unsuitable', 'damaged', 'missing'))
    or (action not in ('cancelled', 'released', 'retired') and reason is null))
);
create index item_events_history_idx on public.item_events(school_id, created_at desc, id);

-- Exact actor derivation inspected from the hosted auth.uid() definition on
-- 2026-10-18. These settings are established by PostgREST from the verified JWT;
-- no mutation accepts a browser-selected actor. The constrained application
-- owner needs no access to the managed auth schema or its tables/functions.
create function private.session_actor()
returns uuid language sql stable security invoker set search_path = ''
as $fn$
  select coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid;
$fn$;

-- These three helpers run as the non-login application table owner, not as
-- postgres. They derive the actor and bypass RLS solely by table ownership.
create function private.is_member(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select exists (select 1 from public.memberships as m
    where m.school_id = p_school_id and m.user_id = private.session_actor() and m.active);
$fn$;
create function private.is_manager(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select exists (select 1 from public.memberships as m
    where m.school_id = p_school_id and m.user_id = private.session_actor() and m.active and m.role = 'manager');
$fn$;
create function private.owns_item(p_school_id uuid, p_item_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select private.is_member(p_school_id) and exists (select 1 from public.reservations as r
    where r.school_id = p_school_id and r.item_id = p_item_id
      and r.member_id = private.session_actor() and r.status in ('active', 'completed'));
$fn$;

alter table public.schools enable row level security;
alter table public.memberships enable row level security;
alter table public.items enable row level security;
alter table public.item_staff enable row level security;
alter table public.reservations enable row level security;
alter table public.item_events enable row level security;

create policy schools_read on public.schools for select to authenticated
  using (private.is_member(id));
create policy memberships_read on public.memberships for select to authenticated
  using ((user_id = (select auth.uid()) and active) or private.is_manager(school_id));
create policy items_read on public.items for select to authenticated
  using (private.is_member(school_id) and (private.is_manager(school_id)
    or (approved_at is not null and status in ('available', 'reserved'))
    or private.owns_item(school_id, id)));
create policy item_staff_read on public.item_staff for select to authenticated
  using (private.is_manager(school_id));
create policy reservations_read on public.reservations for select to authenticated
  using (private.is_member(school_id) and (member_id = (select auth.uid()) or private.is_manager(school_id)));
create policy item_events_read on public.item_events for select to authenticated
  using (private.is_manager(school_id));

create function private.require_actor()
returns uuid language plpgsql stable security invoker set search_path = ''
as $fn$
declare v_actor uuid := private.session_actor();
begin
  if v_actor is null then raise exception using errcode = 'SL001', message = 'Sign in to continue.'; end if;
  return v_actor;
end;
$fn$;

create function private.authorized_item(p_item_id uuid)
returns public.items language plpgsql stable security invoker set search_path = ''
as $fn$
declare v_item public.items;
begin
  perform private.require_actor();
  select i.* into v_item from public.items as i where i.id = p_item_id
    and private.is_member(i.school_id) and (private.is_manager(i.school_id)
      or (i.approved_at is not null and i.status in ('available', 'reserved'))
      or private.owns_item(i.school_id, i.id));
  if not found then raise exception using errcode = 'SL003', message = 'Record not found or unavailable.'; end if;
  return v_item;
end;
$fn$;

create function private.authorized_reservation(p_reservation_id uuid)
returns public.reservations language plpgsql stable security invoker set search_path = ''
as $fn$
declare v_res public.reservations;
begin
  perform private.require_actor();
  select r.* into v_res from public.reservations as r where r.id = p_reservation_id
    and private.is_member(r.school_id) and (r.member_id = private.session_actor() or private.is_manager(r.school_id));
  if not found then raise exception using errcode = 'SL003', message = 'Record not found or unavailable.'; end if;
  return v_res;
end;
$fn$;

create function private.normalize_details(p_category text, p_details jsonb)
returns public.items language plpgsql immutable security invoker set search_path = ''
as $fn$
declare
  v_keys text[];
  v_key text;
  v_type text;
  v_normalized jsonb := '{}'::jsonb;
  v_item public.items;
begin
  if p_category = 'clothing' then
    v_keys := array['title', 'condition', 'garment_type', 'size_system', 'size_label', 'color_variant', 'measurements', 'measurement_unit'];
  elsif p_category = 'textbook' then
    v_keys := array['title', 'condition', 'isbn13', 'edition', 'book_format', 'course_label', 'book_term_label', 'requires_digital_code', 'is_consumable'];
  else raise exception using errcode = 'SL004', message = 'Choose a supported item category.';
  end if;
  if pg_catalog.jsonb_typeof(p_details) is distinct from 'object' then
    raise exception using errcode = 'SL004', message = 'Item details must be an object.';
  end if;
  if not (p_details ?& v_keys) or exists (select 1 from pg_catalog.jsonb_object_keys(p_details) as k where not (k = any(v_keys))) then
    raise exception using errcode = 'SL004', message = 'Item details contain missing or unsupported fields.';
  end if;
  foreach v_key in array v_keys loop
    v_type := pg_catalog.jsonb_typeof(p_details -> v_key);
    if v_key in ('requires_digital_code', 'is_consumable') then
      if v_type not in ('null', 'boolean') then
        raise exception using errcode = 'SL004', message = 'Book inspection flags must be boolean or null.';
      end if;
      v_normalized := v_normalized || pg_catalog.jsonb_build_object(v_key, (p_details ->> v_key)::boolean);
    else
      if v_type not in ('null', 'string') then
        raise exception using errcode = 'SL004', message = 'Catalog text fields must be text or null.';
      end if;
      v_normalized := v_normalized || pg_catalog.jsonb_build_object(v_key, nullif(pg_catalog.btrim(p_details ->> v_key), ''));
    end if;
  end loop;
  v_item := pg_catalog.jsonb_populate_record(null::public.items, v_normalized);
  v_item.category := p_category;
  if (v_item.condition is not null and v_item.condition not in ('new', 'like_new', 'good', 'fair'))
    or (v_item.garment_type is not null and v_item.garment_type not in ('shirt', 'sweater', 'jacket', 'trousers', 'skirt'))
    or (v_item.size_system is not null and v_item.size_system <> 'letter')
    or (v_item.size_label is not null and v_item.size_label not in ('XS', 'S', 'M', 'L', 'XL', 'XXL'))
    or (v_item.measurement_unit is not null and v_item.measurement_unit not in ('cm', 'in'))
    or ((v_item.measurements is null) <> (v_item.measurement_unit is null))
    or not private.valid_isbn13(v_item.isbn13) then
    raise exception using errcode = 'SL004', message = 'Check item values, measurements, and ISBN.';
  end if;
  return v_item;
end;
$fn$;

create function private.assert_publishable(p_item public.items, p_storage_code text)
returns void language plpgsql stable security invoker set search_path = ''
as $fn$
begin
  if p_item.title is null or p_item.condition is null or nullif(pg_catalog.btrim(p_storage_code), '') is null
    or not exists (select 1 from public.schools as s where s.id = p_item.school_id and p_item.category = any(s.enabled_categories))
    or (p_item.category = 'clothing' and (p_item.garment_type is null or p_item.size_system is null or p_item.size_label is null or p_item.color_variant is null))
    or (p_item.category = 'textbook' and (p_item.isbn13 is null or p_item.edition is null or p_item.book_format is null
      or p_item.requires_digital_code is not false or p_item.is_consumable is not false)) then
    raise exception using errcode = 'SL005', message = 'Complete the required catalog and inspection fields before publication.';
  end if;
end;
$fn$;

create function private.intake_item(p_school_id uuid, p_category text, p_details jsonb, p_storage_code text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_item public.items; v_id uuid := pg_catalog.gen_random_uuid(); v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not private.is_manager(p_school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  v_item := private.normalize_details(p_category, p_details);
  if not exists (select 1 from public.schools as s where s.id = p_school_id and p_category = any(s.enabled_categories)) then
    raise exception using errcode = 'SL004', message = 'This school does not accept that category.';
  end if;
  insert into public.items (id, school_id, item_code, category, title, condition, garment_type, size_system, size_label, color_variant, measurements, measurement_unit, isbn13, edition, book_format, course_label, book_term_label, requires_digital_code, is_consumable, created_at, updated_at)
  values (v_id, p_school_id, 'SL-' || pg_catalog.upper(pg_catalog.replace(v_id::text, '-', '')), p_category,
    v_item.title, v_item.condition, v_item.garment_type, v_item.size_system, v_item.size_label, v_item.color_variant,
    v_item.measurements, v_item.measurement_unit, v_item.isbn13, v_item.edition, v_item.book_format,
    v_item.course_label, v_item.book_term_label, v_item.requires_digital_code, v_item.is_consumable, v_now, v_now);
  insert into public.item_staff (school_id, item_id, storage_code, received_by, received_at, updated_at)
    values (p_school_id, v_id, nullif(pg_catalog.btrim(p_storage_code), ''), v_actor, v_now, v_now);
  insert into public.item_events (school_id, item_id, action, actor_id, created_at)
    values (p_school_id, v_id, 'intake_received', v_actor, v_now);
  return query select p_school_id, v_id, 'intake'::text, null::uuid, null::text, null::timestamptz, true;
end;
$fn$;

create function private.publish_item(p_item_id uuid, p_inspection_confirmed boolean)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_item public.items; v_storage text; v_now timestamptz;
begin
  v_item := private.authorized_item(p_item_id);
  if not private.is_manager(v_item.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  select i.* into v_item from public.items as i where i.id = p_item_id for update;
  if not private.is_manager(v_item.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  if v_item.status <> 'intake' then raise exception using errcode = 'SL006', message = 'Only intake stock can be published.'; end if;
  if p_inspection_confirmed is not true then raise exception using errcode = 'SL005', message = 'Confirm inspection and school suitability before publication.'; end if;
  select s.storage_code into v_storage from public.item_staff as s where s.school_id = v_item.school_id and s.item_id = v_item.id;
  perform private.assert_publishable(v_item, v_storage);
  v_now := pg_catalog.clock_timestamp();
  update public.items as i set status = 'available', approved_at = v_now, available_at = v_now, updated_at = v_now where i.id = v_item.id;
  update public.item_staff as s set inspection_passed = true, inspected_at = v_now, inspected_by = v_actor, updated_at = v_now where s.school_id = v_item.school_id and s.item_id = v_item.id;
  insert into public.item_events (school_id, item_id, action, actor_id, created_at) values (v_item.school_id, v_item.id, 'published', v_actor, v_now);
  return query select v_item.school_id, v_item.id, 'available'::text, null::uuid, null::text, null::timestamptz, true;
end;
$fn$;

create function private.update_item_details(p_item_id uuid, p_details jsonb, p_storage_code text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_item public.items; v_details public.items; v_inspected boolean; v_now timestamptz;
begin
  v_item := private.authorized_item(p_item_id);
  if not private.is_manager(v_item.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  select i.* into v_item from public.items as i where i.id = p_item_id for update;
  if not private.is_manager(v_item.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  if v_item.status not in ('intake', 'available') then raise exception using errcode = 'SL006', message = 'Only intake or available stock can be corrected.'; end if;
  v_details := private.normalize_details(v_item.category, p_details);
  v_details.school_id := v_item.school_id;
  if v_item.status = 'available' then
    select s.inspection_passed into v_inspected from public.item_staff as s where s.school_id = v_item.school_id and s.item_id = v_item.id;
    if v_inspected is not true then raise exception using errcode = 'SL005', message = 'Published stock requires completed inspection.'; end if;
    perform private.assert_publishable(v_details, p_storage_code);
  end if;
  v_now := pg_catalog.clock_timestamp();
  update public.items as i set title = v_details.title, condition = v_details.condition,
    garment_type = v_details.garment_type, size_system = v_details.size_system, size_label = v_details.size_label,
    color_variant = v_details.color_variant, measurements = v_details.measurements, measurement_unit = v_details.measurement_unit,
    isbn13 = v_details.isbn13, edition = v_details.edition, book_format = v_details.book_format,
    course_label = v_details.course_label, book_term_label = v_details.book_term_label,
    requires_digital_code = v_details.requires_digital_code, is_consumable = v_details.is_consumable, updated_at = v_now
    where i.id = v_item.id;
  update public.item_staff as s set storage_code = nullif(pg_catalog.btrim(p_storage_code), ''), updated_at = v_now where s.school_id = v_item.school_id and s.item_id = v_item.id;
  insert into public.item_events (school_id, item_id, action, actor_id, created_at) values (v_item.school_id, v_item.id, 'details_updated', v_actor, v_now);
  return query select v_item.school_id, v_item.id, v_item.status, null::uuid, null::text, null::timestamptz, true;
end;
$fn$;

create function private.reserve_item(p_item_id uuid)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_item public.items; v_res public.reservations; v_constraint text; v_now timestamptz;
begin
  v_item := private.authorized_item(p_item_id);
  select i.* into v_item from public.items as i where i.id = p_item_id for update;
  if not private.is_member(v_item.school_id) then raise exception using errcode = 'SL003', message = 'Record not found or unavailable.'; end if;
  if v_item.status <> 'available' or v_item.approved_at is null then raise exception using errcode = 'SL007', message = 'This item is no longer available.'; end if;
  v_now := pg_catalog.clock_timestamp();
  begin
    insert into public.reservations as r (school_id, item_id, member_id, created_at)
      values (v_item.school_id, v_item.id, v_actor, v_now) returning r.* into v_res;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'reservations_one_active_item_idx' then raise exception using errcode = 'SL007', message = 'This item is no longer available.';
    else raise; end if;
  end;
  update public.items as i set status = 'reserved', updated_at = v_now where i.id = v_item.id;
  insert into public.item_events (school_id, item_id, reservation_id, action, actor_id, created_at) values (v_item.school_id, v_item.id, v_res.id, 'reserved', v_actor, v_now);
  return query select v_item.school_id, v_item.id, 'reserved'::text, v_res.id, 'active'::text, null::timestamptz, true;
end;
$fn$;

create function private.cancel_reservation(p_reservation_id uuid, p_release_reason text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_res public.reservations; v_item public.items; v_reason text; v_action text; v_now timestamptz;
begin
  v_res := private.authorized_reservation(p_reservation_id);
  if p_release_reason is null then
    if v_res.member_id <> v_actor then raise exception using errcode = 'SL002', message = 'Choose a manager release reason.'; end if;
    v_reason := 'member_cancelled'; v_action := 'cancelled';
  else
    if not private.is_manager(v_res.school_id) then raise exception using errcode = 'SL002', message = 'Only a school manager can release another pickup.'; end if;
    if p_release_reason not in ('uncollected', 'member_request', 'stock_issue') then raise exception using errcode = 'SL004', message = 'Choose a supported release reason.'; end if;
    v_reason := p_release_reason; v_action := 'released';
  end if;
  select i.* into v_item from public.items as i where i.id = v_res.item_id and i.school_id = v_res.school_id for update;
  select r.* into v_res from public.reservations as r where r.id = p_reservation_id and r.school_id = v_item.school_id for update;
  if not private.is_member(v_res.school_id) or (v_res.member_id <> v_actor and not private.is_manager(v_res.school_id)) then
    raise exception using errcode = 'SL003', message = 'Record not found or unavailable.';
  end if;
  if v_action = 'released' and not private.is_manager(v_res.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  if v_res.status <> 'active' or v_item.status <> 'reserved' then raise exception using errcode = 'SL006', message = 'Only an active pickup can be cancelled or released.'; end if;
  v_now := pg_catalog.clock_timestamp();
  update public.reservations as r set status = 'cancelled', cancelled_at = v_now, cancelled_by = v_actor, cancel_reason = v_reason where r.id = v_res.id;
  update public.items as i set status = 'available', available_at = v_now, updated_at = v_now where i.id = v_item.id;
  insert into public.item_events (school_id, item_id, reservation_id, action, actor_id, reason, created_at) values (v_res.school_id, v_item.id, v_res.id, v_action, v_actor, v_reason, v_now);
  return query select v_res.school_id, v_item.id, 'available'::text, v_res.id, 'cancelled'::text, null::timestamptz, true;
end;
$fn$;

create function private.complete_pickup(p_reservation_id uuid)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_res public.reservations; v_item public.items; v_constraint text; v_now timestamptz;
begin
  v_res := private.authorized_reservation(p_reservation_id);
  if not private.is_manager(v_res.school_id) or v_actor = v_res.member_id then raise exception using errcode = 'SL002', message = 'A different school manager must confirm collection.'; end if;
  select i.* into v_item from public.items as i where i.id = v_res.item_id and i.school_id = v_res.school_id for update;
  select r.* into v_res from public.reservations as r where r.id = p_reservation_id and r.school_id = v_item.school_id for update;
  if not private.is_manager(v_res.school_id) or v_actor = v_res.member_id then raise exception using errcode = 'SL002', message = 'A different school manager must confirm collection.'; end if;
  if v_res.status = 'completed' then
    if v_item.status <> 'transferred' then raise exception using errcode = 'SL008', message = 'The recorded inventory state needs operator review.'; end if;
    return query select v_res.school_id, v_item.id, 'transferred'::text, v_res.id, 'completed'::text, v_res.completed_at, false;
    return;
  end if;
  if v_res.status <> 'active' or v_item.status <> 'reserved' then raise exception using errcode = 'SL006', message = 'Only an active pickup can be completed.'; end if;
  v_now := pg_catalog.clock_timestamp();
  begin
    update public.reservations as r set status = 'completed', completed_at = v_now, completed_by = v_actor where r.id = v_res.id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'reservations_one_completed_item_idx' then raise exception using errcode = 'SL008', message = 'This physical item already has a completed transfer.';
    else raise; end if;
  end;
  update public.items as i set status = 'transferred', updated_at = v_now where i.id = v_item.id;
  insert into public.item_events (school_id, item_id, reservation_id, action, actor_id, created_at) values (v_res.school_id, v_item.id, v_res.id, 'pickup_completed', v_actor, v_now);
  return query select v_res.school_id, v_item.id, 'transferred'::text, v_res.id, 'completed'::text, v_now, true;
end;
$fn$;

create function private.retire_item(p_item_id uuid, p_reason text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_item public.items; v_now timestamptz;
begin
  v_item := private.authorized_item(p_item_id);
  if not private.is_manager(v_item.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  if p_reason is null or p_reason not in ('unsuitable', 'damaged', 'missing') then raise exception using errcode = 'SL004', message = 'Choose a supported retirement reason.'; end if;
  select i.* into v_item from public.items as i where i.id = p_item_id for update;
  if not private.is_manager(v_item.school_id) then raise exception using errcode = 'SL002', message = 'This action requires a school manager.'; end if;
  if v_item.status not in ('intake', 'available') then raise exception using errcode = 'SL006', message = 'Release reserved stock first. Transferred stock cannot be retired.'; end if;
  v_now := pg_catalog.clock_timestamp();
  update public.items as i set status = 'retired', updated_at = v_now where i.id = v_item.id;
  insert into public.item_events (school_id, item_id, action, actor_id, reason, created_at) values (v_item.school_id, v_item.id, 'retired', v_actor, p_reason, v_now);
  return query select v_item.school_id, v_item.id, 'retired'::text, null::uuid, null::text, null::timestamptz, true;
end;
$fn$;

-- Exposed API surface: invoker wrappers only. No business function accepts an
-- actor, elevated role, completed_by, arbitrary status, or SQL statement.
create function public.intake_item(p_school_id uuid, p_category text, p_details jsonb, p_storage_code text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.intake_item(p_school_id, p_category, p_details, p_storage_code); $fn$;
create function public.publish_item(p_item_id uuid, p_inspection_confirmed boolean)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.publish_item(p_item_id, p_inspection_confirmed); $fn$;
create function public.update_item_details(p_item_id uuid, p_details jsonb, p_storage_code text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.update_item_details(p_item_id, p_details, p_storage_code); $fn$;
create function public.reserve_item(p_item_id uuid)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.reserve_item(p_item_id); $fn$;
create function public.cancel_reservation(p_reservation_id uuid, p_release_reason text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.cancel_reservation(p_reservation_id, p_release_reason); $fn$;
create function public.complete_pickup(p_reservation_id uuid)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.complete_pickup(p_reservation_id); $fn$;
create function public.retire_item(p_item_id uuid, p_reason text)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language sql volatile security invoker set search_path = ''
as $fn$ select * from private.retire_item(p_item_id, p_reason); $fn$;

-- Transfer only the created app objects to the constrained owner. Ownership
-- bypasses app-table RLS; FORCE RLS would reintroduce membership recursion.
alter table public.schools owner to supplyloop_owner;
alter table public.memberships owner to supplyloop_owner;
alter table public.items owner to supplyloop_owner;
alter table public.item_staff owner to supplyloop_owner;
alter table public.reservations owner to supplyloop_owner;
alter table public.item_events owner to supplyloop_owner;
do $ownership$
declare v_function record;
begin
  for v_function in select p.oid from pg_catalog.pg_proc as p join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private' or (n.nspname = 'public' and p.proname in ('intake_item', 'publish_item', 'update_item_details', 'reserve_item', 'cancel_reservation', 'complete_pickup', 'retire_item'))
  loop
    execute pg_catalog.format('alter function %s owner to supplyloop_owner', v_function.oid::pg_catalog.regprocedure);
  end loop;
end;
$ownership$;

revoke all on public.schools, public.memberships, public.items, public.item_staff, public.reservations, public.item_events from public, anon, authenticated, service_role;
grant select on public.schools, public.memberships, public.items, public.item_staff, public.reservations, public.item_events to authenticated;
grant select, insert, update, delete on public.schools, public.memberships, public.items, public.item_staff, public.reservations, public.item_events to service_role;
revoke all on all functions in schema private from public, anon, authenticated, service_role;
revoke all on function public.intake_item(uuid, text, jsonb, text), public.publish_item(uuid, boolean), public.update_item_details(uuid, jsonb, text), public.reserve_item(uuid), public.cancel_reservation(uuid, text), public.complete_pickup(uuid), public.retire_item(uuid, text) from public, anon, authenticated, service_role;

grant execute on function private.is_member(uuid), private.is_manager(uuid), private.owns_item(uuid, uuid) to authenticated;
grant execute on function private.intake_item(uuid, text, jsonb, text), private.publish_item(uuid, boolean), private.update_item_details(uuid, jsonb, text), private.reserve_item(uuid), private.cancel_reservation(uuid, text), private.complete_pickup(uuid), private.retire_item(uuid, text) to authenticated;
grant execute on function public.intake_item(uuid, text, jsonb, text), public.publish_item(uuid, boolean), public.update_item_details(uuid, jsonb, text), public.reserve_item(uuid), public.cancel_reservation(uuid, text), public.complete_pickup(uuid), public.retire_item(uuid, text) to authenticated;
revoke create on schema public from supplyloop_owner;
notify pgrst, 'reload schema';
commit;

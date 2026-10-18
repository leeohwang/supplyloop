-- Forward-only policy update: only active students (stored role 'member') may
-- reserve or receive an item. Existing reservations and history are preserved.
-- Target: PostgreSQL 17.11 / Supabase. Official PostgreSQL 17 CREATE FUNCTION,
-- explicit-locking, and PL/pgSQL errors docs rechecked 2026-10-18.
-- CREATE OR REPLACE preserves the existing constrained owner and exact grants.
begin;
set local lock_timeout = '5s';

create or replace function private.reserve_item(p_item_id uuid)
returns table (school_id uuid, item_id uuid, item_status text, reservation_id uuid, reservation_status text, completed_at timestamptz, changed boolean)
language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_actor uuid := private.require_actor(); v_item public.items; v_res public.reservations; v_constraint text; v_now timestamptz;
begin
  -- Authorize the target first so inaccessible and missing IDs stay identical.
  v_item := private.authorized_item(p_item_id);
  if not exists (select 1 from public.memberships as m where m.school_id = v_item.school_id
    and m.user_id = v_actor and m.active and m.role = 'member') then
    raise exception using errcode = 'SL002', message = 'Only an active student can reserve an item.';
  end if;
  select i.* into v_item from public.items as i where i.id = p_item_id for update;
  if not private.is_member(v_item.school_id) then raise exception using errcode = 'SL003', message = 'Record not found or unavailable.'; end if;
  -- Recheck after waiting for inventory; keep this role valid until commit.
  perform m.user_id from public.memberships as m where m.school_id = v_item.school_id
    and m.user_id = v_actor and m.active and m.role = 'member' for share;
  if not found then raise exception using errcode = 'SL002', message = 'Only an active student can reserve an item.'; end if;
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

create or replace function private.complete_pickup(p_reservation_id uuid)
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
  -- A retry reports the original transfer even if its recipient's role changed.
  if v_res.status = 'completed' then
    if v_item.status <> 'transferred' then raise exception using errcode = 'SL008', message = 'The recorded inventory state needs operator review.'; end if;
    return query select v_res.school_id, v_item.id, 'transferred'::text, v_res.id, 'completed'::text, v_res.completed_at, false;
    return;
  end if;
  if v_res.status <> 'active' or v_item.status <> 'reserved' then raise exception using errcode = 'SL006', message = 'Only an active pickup can be completed.'; end if;
  -- Item first, reservation second, then the recipient membership. Holding a
  -- share lock prevents a concurrent role/deactivation update before commit.
  perform m.user_id from public.memberships as m where m.school_id = v_res.school_id
    and m.user_id = v_res.member_id and m.active and m.role = 'member' for share;
  if not found then raise exception using errcode = 'SL002', message = 'Only an active student can receive an item.'; end if;
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

notify pgrst, 'reload schema';
commit;

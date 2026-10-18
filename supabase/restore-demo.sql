-- EXPLICIT OPERATOR ACTION ONLY. This deletes fictional inventory/transactions
-- in the two versioned demo schools. It does not delete Auth users/memberships.
-- Review and select supplyloop-demo before running, then run demo:provision to
-- recreate inventory through manager RPCs. Keep the original .env.test.local.
begin;
set local lock_timeout = '5s';
lock table public.schools, public.memberships, public.items, public.item_staff,
  public.reservations, public.item_events in access exclusive mode;

do $guard$
begin
  if (select pg_catalog.count(*) from public.schools as s where
    (s.id = '11111111-1111-1111-1111-111111111111'::uuid and s.slug = 'school-a' and s.name = 'School A')
    or (s.id = '22222222-2222-2222-2222-222222222222'::uuid and s.slug = 'school-b' and s.name = 'School B')) <> 2 then
    raise exception 'The approved fictional school identities are missing; restoration refused.';
  end if;
  if (select pg_catalog.count(*) from public.memberships as m where m.school_id in
    ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid)) <> 6 then
    raise exception 'The fictional membership set differs from the six fixed accounts; restoration refused.';
  end if;
  if exists (select 1 from public.memberships as m join auth.users as u on u.id = m.user_id
    where m.school_id in ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid)
      and (coalesce(u.raw_app_meta_data ->> 'supplyloop_demo_project', '') <> 'myyfdtqpeqbhnxwlpkeg'
        or coalesce(u.raw_app_meta_data ->> 'fixture_key', '') not in ('DEMO_A_MANAGER', 'DEMO_A_MEMBER1', 'DEMO_A_MEMBER2', 'DEMO_B_MANAGER', 'DEMO_B_MEMBER1', 'DEMO_B_MEMBER2'))) then
    raise exception 'A membership is not marked as a fictional demo account; restoration refused.';
  end if;
end;
$guard$;

delete from public.item_events where school_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from public.reservations where school_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from public.item_staff where school_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from public.items where school_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
commit;

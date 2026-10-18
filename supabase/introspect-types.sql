-- READ ONLY: exports catalog metadata, never application rows or credentials.
-- Scope: six public SupplyLoop tables and eight public RPCs only.
-- PostgreSQL 17 catalog documentation checked 2026-10-18:
-- https://www.postgresql.org/docs/17/catalog-pg-attribute.html
-- https://www.postgresql.org/docs/17/catalog-pg-constraint.html
-- https://www.postgresql.org/docs/17/catalog-pg-index.html
-- https://www.postgresql.org/docs/17/catalog-pg-proc.html
-- https://www.postgresql.org/docs/17/catalog-pg-type.html
-- Save the single supplyloop_schema JSON value (or its one-row JSON export),
-- then run scripts/operator/generate-types.mjs against that local JSON file.
with
selected_tables as (
  select c.oid, c.relname::text as name
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname in ('schools', 'memberships', 'items', 'item_staff', 'reservations', 'item_events')
),
selected_functions as (
  select p.* from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.proname in ('intake_item', 'publish_item', 'update_item_details', 'reserve_item', 'cancel_reservation', 'complete_pickup', 'retire_item', 'join_demo_school')
),
type_metadata as (
  select t.oid,
    pg_catalog.jsonb_build_object(
      'schema', n.nspname, 'name', t.typname,
      'formatted', pg_catalog.format_type(t.oid, null),
      'kind', t.typtype, 'category', t.typcategory,
      'is_array', t.typcategory = 'A',
      'element_schema', en.nspname, 'element_name', e.typname
    ) as value
  from pg_catalog.pg_type as t
  join pg_catalog.pg_namespace as n on n.oid = t.typnamespace
  left join pg_catalog.pg_type as e on e.oid = t.typelem and t.typcategory = 'A'
  left join pg_catalog.pg_namespace as en on en.oid = e.typnamespace
),
column_metadata as (
  select s.oid as table_oid, a.attnum as position,
    pg_catalog.jsonb_build_object(
      'name', a.attname, 'position', a.attnum, 'type', t.value,
      'nullable', not a.attnotnull,
      'has_default', d.oid is not null and a.attgenerated = '',
      'default_expression', case when a.attgenerated = '' then pg_catalog.pg_get_expr(d.adbin, d.adrelid) else null end,
      'identity', a.attidentity, 'generated', a.attgenerated,
      'generation_expression', case when a.attgenerated <> '' then pg_catalog.pg_get_expr(d.adbin, d.adrelid) else null end
    ) as value
  from selected_tables as s
  join pg_catalog.pg_attribute as a on a.attrelid = s.oid and a.attnum > 0 and not a.attisdropped
  join type_metadata as t on t.oid = a.atttypid
  left join pg_catalog.pg_attrdef as d on d.adrelid = a.attrelid and d.adnum = a.attnum
),
relationship_metadata as (
  select s.oid as table_oid, c.conname::text as name,
    pg_catalog.jsonb_build_object(
      'foreign_key_name', c.conname,
      'columns', (select pg_catalog.jsonb_agg(a.attname order by k.position)
        from pg_catalog.unnest(c.conkey) with ordinality as k(attnum, position)
        join pg_catalog.pg_attribute as a on a.attrelid = c.conrelid and a.attnum = k.attnum),
      'referenced_schema', rn.nspname, 'referenced_relation', r.relname,
      'referenced_columns', (select pg_catalog.jsonb_agg(a.attname order by k.position)
        from pg_catalog.unnest(c.confkey) with ordinality as k(attnum, position)
        join pg_catalog.pg_attribute as a on a.attrelid = c.confrelid and a.attnum = k.attnum),
      'is_one_to_one', u.is_one_to_one,
      'cardinality', case when u.is_one_to_one then 'one-to-one' else 'many-to-one' end
    ) as value
  from selected_tables as s
  join pg_catalog.pg_constraint as c on c.conrelid = s.oid and c.contype = 'f'
  join pg_catalog.pg_class as r on r.oid = c.confrelid
  join pg_catalog.pg_namespace as rn on rn.oid = r.relnamespace
  cross join lateral (
    select exists (
      select 1 from pg_catalog.pg_index as i
      where i.indrelid = c.conrelid and i.indisunique and i.indisvalid
        and i.indpred is null and i.indexprs is null
        and array(select k.attnum from pg_catalog.unnest(i.indkey::smallint[]) with ordinality as k(attnum, position)
          where k.position <= i.indnkeyatts) <@ c.conkey
    ) as is_one_to_one
  ) as u
),
all_arguments as (
  select p.oid as function_oid, p.pronargs, p.pronargdefaults,
    a.position::integer as position,
    p.proargnames[a.position] as name,
    coalesce(p.proargmodes[a.position]::text, 'i') as mode,
    t.value as type
  from selected_functions as p
  cross join lateral pg_catalog.unnest(coalesce(p.proallargtypes, p.proargtypes::oid[]))
    with ordinality as a(type_oid, position)
  join type_metadata as t on t.oid = a.type_oid
),
input_arguments as (
  select a.*, pg_catalog.row_number() over (partition by a.function_oid order by a.position) as input_position
  from all_arguments as a where a.mode in ('i', 'b', 'v')
),
function_metadata as (
  select p.proname::text as name,
    pg_catalog.jsonb_build_object(
      'name', p.proname,
      'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'argument_signature', pg_catalog.pg_get_function_arguments(p.oid),
      'args', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', a.name, 'position', a.input_position, 'mode', a.mode, 'type', a.type,
        'has_default', a.input_position > p.pronargs - p.pronargdefaults,
        'nullable', null
      ) order by a.input_position) from input_arguments as a where a.function_oid = p.oid), '[]'::jsonb),
      'returns_set', p.proretset,
      'returns_table', exists(select 1 from all_arguments as a where a.function_oid = p.oid and a.mode = 't'),
      'return_type', rt.value,
      'return_columns', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', a.name, 'position', a.position, 'mode', a.mode, 'type', a.type,
        'nullable', null
      ) order by a.position) from all_arguments as a where a.function_oid = p.oid and a.mode in ('o', 'b', 't')),
        (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'name', c.value -> 'name', 'position', c.position, 'mode', 'composite',
          'type', c.value -> 'type', 'nullable', null
        ) order by c.position)
         from pg_catalog.pg_type as ct
         join column_metadata as c on c.table_oid = ct.typrelid
         where ct.oid = p.prorettype and ct.typtype = 'c'), '[]'::jsonb)
    ) as value
  from selected_functions as p
  join type_metadata as rt on rt.oid = p.prorettype
)
select pg_catalog.jsonb_build_object(
  'format_version', 1,
  'schema', 'public',
  'server_version', pg_catalog.current_setting('server_version'),
  'exported_at', pg_catalog.statement_timestamp(),
  'rpc_nullability', 'not declared by PostgreSQL function signatures',
  'tables', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name', s.name,
    'columns', coalesce((select pg_catalog.jsonb_agg(c.value order by c.position) from column_metadata as c where c.table_oid = s.oid), '[]'::jsonb),
    'relationships', coalesce((select pg_catalog.jsonb_agg(r.value order by r.name) from relationship_metadata as r where r.table_oid = s.oid), '[]'::jsonb)
  ) order by s.name) from selected_tables as s), '[]'::jsonb),
  'functions', coalesce((select pg_catalog.jsonb_agg(f.value order by f.name) from function_metadata as f), '[]'::jsonb)
) as supplyloop_schema;

// Offline, Node-built-in-only type generation from introspect-types.sql output.
// Usage: node scripts/operator/generate-types.mjs exported-schema.json > /tmp/database.generated.ts
// The lead reviews/integrates output; this script never edits shared source.
import { readFile } from 'node:fs/promises';

const tableNames = ['schools', 'memberships', 'items', 'item_staff', 'reservations', 'item_events'];
const functionNames = ['intake_item', 'publish_item', 'update_item_details', 'reserve_item', 'cancel_reservation', 'complete_pickup', 'retire_item', 'join_demo_school'];

function ensure(condition, message) { if (!condition) throw new Error(message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function name(value) {
  ensure(typeof value === 'string' && value.length > 0, 'Catalog identifier is missing.');
  return JSON.stringify(value);
}
function sameNames(values, expected, label) {
  ensure(Array.isArray(values), `${label} metadata is missing.`);
  const actual = values.map((value) => value.name).sort();
  ensure(JSON.stringify(actual) === JSON.stringify([...expected].sort()), `Export must contain exactly the approved ${label}.`);
}

function unwrap(value) {
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof value === 'string') { value = JSON.parse(value); continue; }
    if (Array.isArray(value) && value.length === 1) { value = value[0]; continue; }
    if (object(value) && Object.hasOwn(value, 'supplyloop_schema')) { value = value.supplyloop_schema; continue; }
    return value;
  }
  throw new Error('Export has too many nested JSON wrappers.');
}

function scalarType(schema, typeName) {
  ensure(schema === 'pg_catalog', 'An unsupported non-builtin SQL type requires generator review.');
  if (typeName === 'bool') return 'boolean';
  if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid'].includes(typeName)) return 'number';
  if (['json', 'jsonb'].includes(typeName)) return 'Json';
  if (['uuid', 'text', 'varchar', 'bpchar', 'name', 'bytea', 'date', 'time', 'timetz', 'timestamp', 'timestamptz', 'interval', 'inet', 'cidr', 'macaddr', 'macaddr8', 'money'].includes(typeName)) return 'string';
  if (typeName === 'void') return 'undefined';
  throw new Error('An unsupported SQL type requires generator review.');
}

function sqlType(type) {
  ensure(object(type) && typeof type.is_array === 'boolean', 'SQL type metadata is incomplete.');
  if (type.is_array) return `${scalarType(type.element_schema, type.element_name)}[]`;
  return scalarType(type.schema, type.name);
}

function nullableType(type, nullable) {
  const base = sqlType(type);
  // SQL function signatures do not declare scalar NOT NULL guarantees. Unknown
  // function nullability stays conservative instead of guessing from names.
  return nullable === false || base === 'undefined' ? base : `${base} | null`;
}

function columnField(column, context) {
  ensure(object(column) && typeof column.nullable === 'boolean' && typeof column.has_default === 'boolean', 'Column nullability/default metadata is incomplete.');
  ensure(typeof column.identity === 'string' && typeof column.generated === 'string', 'Column generation metadata is incomplete.');
  const generatedAlways = column.generated !== '' || column.identity === 'a';
  if (context !== 'Row' && generatedAlways) return `${name(column.name)}?: never`;
  const optional = context === 'Update' || (context === 'Insert' && (column.nullable || column.has_default || column.identity === 'd'));
  return `${name(column.name)}${optional ? '?' : ''}: ${nullableType(column.type, column.nullable)}`;
}

function tableBlock(table) {
  ensure(Array.isArray(table.columns) && table.columns.length > 0 && Array.isArray(table.relationships), 'Table metadata is incomplete.');
  const columns = [...table.columns].sort((a, b) => a.position - b.position);
  ensure(new Set(columns.map((column) => column.name)).size === columns.length, 'Duplicate table column metadata.');
  const lines = [`      ${name(table.name)}: {`];
  for (const context of ['Row', 'Insert', 'Update']) {
    lines.push(`        ${context}: {`);
    for (const column of columns) lines.push(`          ${columnField(column, context)}`);
    lines.push('        }');
  }
  if (table.relationships.length === 0) lines.push('        Relationships: []');
  else {
    lines.push('        Relationships: [');
    for (const relationship of [...table.relationships].sort((a, b) => a.foreign_key_name.localeCompare(b.foreign_key_name))) {
      ensure(Array.isArray(relationship.columns) && Array.isArray(relationship.referenced_columns)
        && relationship.columns.length > 0 && relationship.columns.length === relationship.referenced_columns.length
        && relationship.columns.every((column) => columns.some((candidate) => candidate.name === column))
        && typeof relationship.is_one_to_one === 'boolean', 'Foreign-key metadata is incomplete.');
      lines.push('          {',
        `            foreignKeyName: ${name(relationship.foreign_key_name)}`,
        `            columns: ${JSON.stringify(relationship.columns)}`,
        `            isOneToOne: ${relationship.is_one_to_one}`,
        `            referencedRelation: ${name(relationship.referenced_relation)}`,
        `            referencedColumns: ${JSON.stringify(relationship.referenced_columns)}`,
        '          },');
    }
    lines.push('        ]');
  }
  lines.push('      }');
  return lines.join('\n');
}

function functionBlock(routine) {
  ensure(Array.isArray(routine.args) && Array.isArray(routine.return_columns)
    && typeof routine.returns_set === 'boolean', 'RPC metadata is incomplete.');
  const lines = [`      ${name(routine.name)}: {`];
  if (routine.args.length === 0) lines.push('        Args: Record<PropertyKey, never>');
  else {
    lines.push('        Args: {');
    for (const argument of [...routine.args].sort((a, b) => a.position - b.position)) {
      ensure(typeof argument.has_default === 'boolean' && (argument.nullable === null || typeof argument.nullable === 'boolean'), 'RPC argument/default metadata is incomplete.');
      lines.push(`          ${name(argument.name)}${argument.has_default ? '?' : ''}: ${nullableType(argument.type, argument.nullable)}`);
    }
    lines.push('        }');
  }
  if (routine.return_columns.length > 0) {
    lines.push('        Returns: {');
    for (const column of [...routine.return_columns].sort((a, b) => a.position - b.position)) {
      ensure(column.nullable === null || typeof column.nullable === 'boolean', 'RPC result nullability metadata is incomplete.');
      lines.push(`          ${name(column.name)}: ${nullableType(column.type, column.nullable)}`);
    }
    lines.push(`        }${routine.returns_set ? '[]' : ''}`);
  } else {
    const resultType = nullableType(routine.return_type, null);
    lines.push(`        Returns: ${routine.returns_set ? `(${resultType})[]` : resultType}`);
  }
  lines.push('      }');
  return lines.join('\n');
}

export function generateTypes(raw) {
  const schema = unwrap(raw);
  ensure(object(schema) && schema.format_version === 1 && schema.schema === 'public', 'Expected SupplyLoop catalog export format version 1.');
  sameNames(schema.tables, tableNames, 'six public tables');
  sameNames(schema.functions, functionNames, 'eight public RPCs (without overloads)');
  const serverVersion = String(schema.server_version ?? 'unknown').replace(/[\r\n]/g, ' ').replaceAll('*/', '* /');
  const lines = [
    '// Generated from a read-only PostgreSQL catalog export. Do not edit by hand.',
    '// Generator: scripts/operator/generate-types.mjs; query: supabase/introspect-types.sql.',
    `// Source PostgreSQL server: ${serverVersion}.`,
    '// Table nullability/defaults and FK relationships are catalog-derived.',
    '// RPC scalar nullability is not encoded in PostgreSQL signatures; unions are conservative.',
    '// Refine validated application RPC results separately; CHECK constraints are not TS enums.',
    '',
    'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]',
    '',
    'export type Database = {',
    '  public: {',
    '    Tables: {',
    ...[...schema.tables].sort((a, b) => a.name.localeCompare(b.name)).map(tableBlock),
    '    }',
    '    Views: { [_ in never]: never }',
    '    Functions: {',
    ...[...schema.functions].sort((a, b) => a.name.localeCompare(b.name)).map(functionBlock),
    '    }',
    '    Enums: { [_ in never]: never }',
    '    CompositeTypes: { [_ in never]: never }',
    '  }',
    '}',
    '',
  ];
  return lines.join('\n');
}

// Keep module import side-effect-free for the offline checks.
if (process.argv[1] && new URL(process.argv[1], 'file://').href === import.meta.url) {
  try {
    ensure(process.argv.length === 3, 'Usage: node scripts/operator/generate-types.mjs exported-schema.json');
    const raw = JSON.parse((await readFile(process.argv[2], 'utf8')).replace(/^\uFEFF/, ''));
    process.stdout.write(generateTypes(raw));
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'The export is not valid JSON.' : error.message);
    process.exitCode = 1;
  }
}

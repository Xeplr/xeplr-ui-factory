// A FORM IS A REAL TABLE.
//
// Records are never stored as JSON: every entity has its own table, and every
// field of its edit screen is a column of that table, named exactly as the
// field. `select * from employees` is how you read them, and reporting is plain
// SQL.
//
// This file derives that table from a screen and writes the migration that
// gets the database there — the first time a CREATE TABLE, after that only what
// changed. The migrations are ordinary files in the app's migrations folder,
// written (usually by Claude) and reviewed like any other; nothing here touches
// a database.
//
// Conventions are the xeplr ones (see xeplr-bi 0066_dashboard_groups.sql):
// varchar(25) ids, quoted camelCase columns, isActive for soft delete, mtId1–4
// for tenancy, recordCreated/Modified Date/By for audit.
//
// ── CHANGES THAT ARE SAFE, AND CHANGES THAT ARE REFUSED ──────────────────
//   new field                 ADD COLUMN
//   wider (varchar 80 → 120, varchar → text, integer → numeric)   ALTER TYPE
//   narrower, or a different type (text → number)   REFUSED — data would be
//                             lost or rejected; write that migration by hand
//   field removed             column KEPT, reported as unused — dropping data
//                             is a deliberate migration, never a side effect
//   field renamed             seen as a NEW column beside an unused old one, with
//                             the data left behind — which is why a field's name is
//                             locked once its table exists (see the builder's
//                             lockedNames). A real rename is a manual migration.

import { CONTROLS } from './controls.js'
import { inputNodes } from './document.js'

/** Columns every entity table has, in this order. Fields may not use these names. */
export const STANDARD_COLUMNS = [
  { name: 'id', sql: 'varchar(25) PRIMARY KEY' },
  { name: 'isActive', sql: 'boolean DEFAULT true' },
  { name: 'mtId1', sql: 'varchar(25)' },
  { name: 'mtId2', sql: 'varchar(25)' },
  { name: 'mtId3', sql: 'varchar(25)' },
  { name: 'mtId4', sql: 'varchar(25)' },
  { name: 'recordCreatedDate', sql: 'timestamp DEFAULT now()' },
  { name: 'recordModifiedDate', sql: 'timestamp DEFAULT now()' },
  { name: 'recordCreatedBy', sql: 'varchar(25)' },
  { name: 'recordModifiedBy', sql: 'varchar(25)' }
]

export const RESERVED_COLUMNS = STANDARD_COLUMNS.map((c) => c.name)

/** Postgres truncates identifiers past this — two long fields would collide silently. */
export const MAX_IDENTIFIER = 63

const TEXT_DEFAULT_LENGTH = 255
const OPTION_MIN_LENGTH = 50

/**
 * The column a field is stored in.
 * @returns {{ name, type: 'varchar'|'text'|'integer'|'numeric'|'date'|'boolean', length?, references?, notNull?, default? }}
 */
export function columnForField(node) {
  const p = node.props || {}
  const v = p.validation || {}
  const base = { name: p.name, label: p.label }
  switch (node.type) {
    case 'text':
      return { ...base, type: 'varchar', length: v.maxLength || TEXT_DEFAULT_LENGTH }
    case 'textarea':
      return { ...base, type: 'text' }
    case 'number':
      return { ...base, type: v.integer ? 'integer' : 'numeric' }
    case 'date':
      return { ...base, type: 'date' }
    case 'checkbox':
      return { ...base, type: 'boolean', notNull: true, default: 'false' }
    case 'dropdown': {
      const data = p.data || {}
      if (data.source === 'table') {
        // A real foreign key to the other entity's id.
        return { ...base, type: 'varchar', length: 25, references: data.table }
      }
      const longest = (data.options || []).reduce((m, o) => Math.max(m, String(o.id).length), 0)
      return { ...base, type: 'varchar', length: Math.max(OPTION_MIN_LENGTH, longest) }
    }
    default:
      return null
  }
}

/**
 * The table an edit screen saves to.
 * @returns {{ table, columns }} — columns are the fields, in reading order
 */
export function tableForScreen(doc, controls = CONTROLS) {
  if (!doc || !doc.source) throw new Error('The screen has no "source" — which table does it save to?')
  const columns = inputNodes(doc, controls).map(columnForField).filter(Boolean)
  if (!columns.length) throw new Error(`Screen "${doc.id}" has no fields, so it defines no table columns — generate the migration from the edit screen`)
  return { table: doc.source, columns }
}

export function columnSql(col) {
  const type = col.type === 'varchar' ? `varchar(${col.length})` : col.type
  const parts = [type]
  if (col.references) parts.push(`REFERENCES ${q(col.references)}("id")`)
  if (col.notNull) parts.push('NOT NULL')
  if (col.default !== undefined) parts.push(`DEFAULT ${col.default}`)
  return parts.join(' ')
}

/** Is changing `from` to `to` safe for data already in the column? */
export function widening(from, to) {
  if (from.references || to.references) {
    if (from.references !== to.references) return { ok: false, reason: `it points at "${from.references || 'no table'}" and would point at "${to.references || 'no table'}"` }
  }
  if (from.type === to.type) {
    if (from.type !== 'varchar') return { ok: true, same: true }
    if (to.length === from.length) return { ok: true, same: true }
    if (to.length > from.length) return { ok: true }
    return { ok: false, reason: `varchar(${from.length}) → varchar(${to.length}) would cut longer values` }
  }
  if (from.type === 'varchar' && to.type === 'text') return { ok: true }
  if (from.type === 'integer' && to.type === 'numeric') return { ok: true }
  return { ok: false, reason: `${describe(from)} → ${describe(to)} is a different kind of value` }
}

/**
 * What it takes to go from the table as it was to the table as the screen now
 * describes it.
 * @param before  { table, columns } or null for a new table
 * @returns {{ create, add, alter, unused, refused, same }}
 */
export function diffTables(before, after) {
  if (before && before.table !== after.table) {
    return { create: false, add: [], alter: [], unused: [], same: false, refused: [{ column: null, reason: `the screen now saves to "${after.table}" instead of "${before.table}" — moving records to another table is a manual migration` }] }
  }
  if (!before) return { create: true, add: after.columns, alter: [], unused: [], refused: [], same: false }
  const was = Object.fromEntries(before.columns.map((c) => [c.name, c]))
  const now = Object.fromEntries(after.columns.map((c) => [c.name, c]))
  const add = []
  const alter = []
  const refused = []
  after.columns.forEach((c) => {
    const old = was[c.name]
    if (!old) { add.push(c); return }
    const w = widening(old, c)
    if (!w.ok) refused.push({ column: c.name, reason: w.reason })
    else if (!w.same) alter.push({ from: old, to: c })
  })
  const unused = before.columns.filter((c) => !now[c.name])
  return { create: false, add, alter, unused, refused, same: !add.length && !alter.length && !unused.length && !refused.length }
}

/**
 * The migration SQL from one version of an edit screen to the next.
 * @param previous  the edit screen as last migrated, or null
 * @param next      the edit screen now
 * @returns {{ sql, diff, table, empty }} — throws if a change is refused
 */
export function migrationFor(previous, next, controls = CONTROLS) {
  const after = tableForScreen(next, controls)
  const before = previous ? tableForScreen(previous, controls) : null
  const diff = diffTables(before, after)
  if (diff.refused.length) {
    const e = new Error(`Cannot migrate "${after.table}" safely:\n` + diff.refused.map((r) => `  ${r.column ? `"${r.column}": ` : ''}${r.reason}`).join('\n'))
    e.refused = diff.refused
    throw e
  }
  if (diff.same || (!diff.create && !diff.add.length && !diff.alter.length)) {
    return { sql: '', diff, table: after.table, empty: true }
  }

  const t = after.table
  const lines = []
  const header = [
    `-- ${diff.create ? 'Create' : 'Update'} "${t}" for screen "${next.id}" (${next.name}).`,
    '--',
    '-- Written from the screen by @xeplr/ui-factory: one column per field, named'
  , '-- exactly as the field. Review before applying.'
  ]
  if (diff.unused.length) {
    header.push('--', `-- Kept, no longer on the screen (drop by hand if the data is not needed): ${diff.unused.map((c) => `"${c.name}"`).join(', ')}`)
  }
  lines.push(...header, '')

  if (diff.create) {
    const cols = [...STANDARD_COLUMNS.slice(0, 1), ...after.columns.map((c) => ({ name: c.name, sql: columnSql(c), label: c.label })), ...STANDARD_COLUMNS.slice(1)]
    const width = Math.max(...cols.map((c) => c.name.length)) + 2
    lines.push(`CREATE TABLE IF NOT EXISTS ${q(t)} (`)
    cols.forEach((c, i) => {
      const comma = i < cols.length - 1 ? ',' : ''
      const note = c.label ? `  -- ${c.label}` : ''
      lines.push(`  ${q(c.name).padEnd(width)} ${c.sql}${comma}${note}`)
    })
    lines.push(');', '')
    lines.push(`CREATE INDEX IF NOT EXISTS ${q(`${t}_mt_index`)} ON ${q(t)} ("mtId1", "mtId2");`)
    after.columns.filter((c) => c.references).forEach((c) => {
      lines.push(`CREATE INDEX IF NOT EXISTS ${q(`${t}_${c.name}_index`)} ON ${q(t)} (${q(c.name)});`)
    })
  } else {
    diff.add.forEach((c) => {
      lines.push(`ALTER TABLE ${q(t)} ADD COLUMN IF NOT EXISTS ${q(c.name)} ${columnSql(c)};  -- ${c.label}`)
      if (c.references) lines.push(`CREATE INDEX IF NOT EXISTS ${q(`${t}_${c.name}_index`)} ON ${q(t)} (${q(c.name)});`)
    })
    diff.alter.forEach(({ from, to }) => {
      const type = to.type === 'varchar' ? `varchar(${to.length})` : to.type
      lines.push(`ALTER TABLE ${q(t)} ALTER COLUMN ${q(to.name)} TYPE ${type};  -- was ${describe(from)}`)
    })
  }
  return { sql: lines.join('\n') + '\n', diff, table: t, empty: false }
}

/** Next migration file name in a folder of NNNN_*.sql files. */
export function nextMigrationName(existingFiles, table, create) {
  const top = (existingFiles || []).reduce((m, f) => {
    const n = /^(\d+)_/.exec(f)
    return n ? Math.max(m, Number(n[1])) : m
  }, 0)
  return `${String(top + 1).padStart(4, '0')}_factory_${table}_${create ? 'create' : 'update'}.sql`
}

function describe(c) {
  return c.type === 'varchar' ? `varchar(${c.length})` : c.type
}

function q(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`
}

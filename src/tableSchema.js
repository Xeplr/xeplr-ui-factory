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
//   narrower, or a different type (text → number)   REFUSED in a migration file —
//                             data would be lost or rejected; write that by hand.
//                             On PUBLISH, a CONVERSION instead (below): the saved
//                             values are checked first, and the column changes
//                             only if every one of them fits, and only once the
//                             person has confirmed
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
const FILE_PATH_LENGTH = 255

/**
 * The column a field is stored in.
 * @returns {{ name, type: 'varchar'|'text'|'integer'|'numeric'|'date'|'timestamp'|'boolean', length?, references?, notNull?, default? }}
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
    case 'datetime':
      return { ...base, type: 'timestamp' }
    case 'file':
      // The stored file's path, as the upload answered with it.
      return { ...base, type: 'varchar', length: FILE_PATH_LENGTH }
    case 'multiselect':
      // Every chosen id in one text column, separated by commas.
      return { ...base, type: 'text' }
    case 'checkbox':
      return { ...base, type: 'boolean', notNull: true, default: 'false' }
    case 'dropdown':
    case 'radio': {
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
  // A date becomes that day at midnight; the other way round would lose the time.
  if (from.type === 'date' && to.type === 'timestamp') return { ok: true }
  // Not safe for ANY data, but safe for data that fits: the value checks in
  // conversionFor() say whether this table's does.
  if (convertible(from, to)) {
    return { ok: false, convert: true, reason: `${describe(from)} → ${describe(to)} changes the kind of value — every saved value has to fit` }
  }
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
    if (!w.ok) refused.push(w.convert ? { column: c.name, reason: w.reason, convert: { from: old, to: c } } : { column: c.name, reason: w.reason })
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
    lines.push(...createStatements(after, { annotate: true }))
  } else {
    diff.add.forEach((c) => lines.push(...addStatements(t, c, { annotate: true })))
    diff.alter.forEach(({ from, to }) => lines.push(alterStatement(t, from, to, { annotate: true })))
  }
  return { sql: lines.join('\n') + '\n', diff, table: t, empty: false }
}

// ── statements ───────────────────────────────────────────────────────────

/** CREATE TABLE with the fields and the standard columns, and its indexes. */
export function createStatements(after, { annotate } = {}) {
  const t = after.table
  const cols = [...STANDARD_COLUMNS.slice(0, 1), ...after.columns.map((c) => ({ name: c.name, sql: columnSql(c), label: c.label })), ...STANDARD_COLUMNS.slice(1)]
  const width = Math.max(...cols.map((c) => c.name.length)) + 2
  const body = cols.map((c, i) => {
    const comma = i < cols.length - 1 ? ',' : ''
    const note = annotate && c.label ? `  -- ${c.label}` : ''
    return `  ${q(c.name).padEnd(width)} ${c.sql}${comma}${note}`
  })
  const out = [`CREATE TABLE IF NOT EXISTS ${q(t)} (\n${body.join('\n')}\n);`]
  out.push(`CREATE INDEX IF NOT EXISTS ${q(`${t}_mt_index`)} ON ${q(t)} ("mtId1", "mtId2");`)
  after.columns.filter((c) => c.references).forEach((c) => {
    out.push(`CREATE INDEX IF NOT EXISTS ${q(`${t}_${c.name}_index`)} ON ${q(t)} (${q(c.name)});`)
  })
  return out
}

export function addStatements(t, c, { annotate } = {}) {
  const out = [`ALTER TABLE ${q(t)} ADD COLUMN IF NOT EXISTS ${q(c.name)} ${columnSql(c)};${annotate && c.label ? `  -- ${c.label}` : ''}`]
  if (c.references) out.push(`CREATE INDEX IF NOT EXISTS ${q(`${t}_${c.name}_index`)} ON ${q(t)} (${q(c.name)});`)
  return out
}

export function alterStatement(t, from, to, { annotate } = {}) {
  const type = to.type === 'varchar' ? `varchar(${to.length})` : to.type
  return `ALTER TABLE ${q(t)} ALTER COLUMN ${q(to.name)} TYPE ${type};${annotate ? `  -- was ${describe(from)}` : ''}`
}

/** Drops the column and every value in it. Its foreign key and index go with it. */
export function dropStatement(t, name) {
  return `ALTER TABLE ${q(t)} DROP COLUMN IF EXISTS ${q(name)};`
}

// ── conversions: a field that became another kind ────────────────────────
//
// "LinkedIn URL" typed as text and later made a number, a date, a yes/no…
// The column can follow ONLY IF every value already saved in it fits the new
// kind. For each conversion there are three pieces of SQL, all read-only but
// the last:
//
//   check     how many saved values would NOT fit — publish refuses unless 0
//   sample    up to five of them, to show the person what is in the way
//   statement the ALTER, with a USING that turns each value into the new kind
//
// Empty text becomes NULL rather than failing: a blank box saved as '' is "no
// value", in the new kind as in the old.
//
// NO "?" ANYWHERE IN THIS SQL. Hosts run it through knex.raw, which reads every
// ? as a binding placeholder — an optional regex group spelled [+-]? silently
// became a different pattern. Optional is spelled {0,1}.

const TEXTUAL = ['varchar', 'text']
const CONVERT_TO_FROM_TEXT = ['integer', 'numeric', 'date', 'timestamp', 'boolean']
const TRUE_WORDS = "'true','t','yes','y','1'"
const FALSE_WORDS = "'false','f','no','n','0'"

function convertible(from, to) {
  if (from.references || to.references) return false
  if (TEXTUAL.includes(from.type) && CONVERT_TO_FROM_TEXT.includes(to.type)) return true
  if (TEXTUAL.includes(to.type) && ['integer', 'numeric', 'date', 'timestamp', 'boolean', 'varchar'].includes(from.type)) return true
  if (from.type === 'numeric' && to.type === 'integer') return true
  return false
}

/**
 * @returns {{ check, sample, statement }} — see above; null when the change is
 *          not a conversion this knows how to make
 */
export function conversionFor(table, from, to) {
  if (!convertible(from, to)) return null
  const t = q(table)
  const c = q(to.name)
  const txt = `btrim(${c}::text)`
  let bad
  let using
  if (TEXTUAL.includes(to.type)) {
    // Anything becomes text; a varchar only if it is long enough.
    bad = to.type === 'varchar' ? `length(${c}::text) > ${to.length}` : 'false'
    using = `${c}::text`
  } else if (from.type === 'numeric' && to.type === 'integer') {
    bad = `${c} <> trunc(${c})`
    using = `${c}::integer`
  } else if (to.type === 'integer') {
    bad = `${txt} <> '' AND NOT (${txt} ~ '^[+-]{0,1}[0-9]{1,9}$')`
    using = `NULLIF(${txt}, '')::integer`
  } else if (to.type === 'numeric') {
    bad = `${txt} <> '' AND NOT (${txt} ~ '^[+-]{0,1}([0-9]+[.]{0,1}[0-9]*|[.][0-9]+)([eE][+-]{0,1}[0-9]+){0,1}$')`
    using = `NULLIF(${txt}, '')::numeric`
  } else if (to.type === 'date') {
    bad = `${txt} <> '' AND NOT (${txt} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`
    using = `NULLIF(${txt}, '')::date`
  } else if (to.type === 'timestamp') {
    bad = `${txt} <> '' AND NOT (${txt} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([ T][0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+){0,1}){0,1}){0,1}$')`
    using = `NULLIF(${txt}, '')::timestamp`
  } else if (to.type === 'boolean') {
    bad = `lower(${txt}) NOT IN (${TRUE_WORDS}, ${FALSE_WORDS}, '')`
    using = `CASE WHEN lower(${txt}) IN (${TRUE_WORDS}) THEN true WHEN lower(${txt}) IN (${FALSE_WORDS}) THEN false ELSE NULL END`
  }
  const where = `${c} IS NOT NULL AND (${bad})`
  const type = to.type === 'varchar' ? `varchar(${to.length})` : to.type
  // A boolean field is NOT NULL DEFAULT false (columnForField): blanks become false.
  const fill = to.notNull && to.default !== undefined
    ? [`UPDATE ${t} SET ${c} = ${to.default} WHERE ${c} IS NULL;`, `ALTER TABLE ${t} ALTER COLUMN ${c} SET DEFAULT ${to.default};`, `ALTER TABLE ${t} ALTER COLUMN ${c} SET NOT NULL;`]
    : []
  return {
    check: `SELECT count(*)::int AS n FROM ${t} WHERE ${where}`,
    sample: `SELECT ${c}::text AS v FROM ${t} WHERE ${where} LIMIT 5`,
    count: `SELECT count(*)::int AS n FROM ${t} WHERE ${c} IS NOT NULL`,
    statements: [`ALTER TABLE ${t} ALTER COLUMN ${c} TYPE ${type} USING ${using};`, ...fill]
  }
}

// ── publish: apply directly ──────────────────────────────────────────────
//
// Publishing a screen changes its table straight away — no migration files.
// It compares the screen with the table AS IT IS in the database (not with
// the previous version), so a table changed by hand, or a publish that failed
// halfway, is still seen for what it is.
//
// A REMOVED FIELD DROPS ITS COLUMN AND ITS DATA — only after the person
// confirms, and never for a column this factory did not create:
//   managed  names that were fields of a published version of a screen on this
//            table. A column somebody added by hand is not in it, and is left alone.
//   inUse    names another published screen on the same table still has —
//            another company's screen, say. The column is shared; it stays.

/** A column as Postgres describes it → the shape columnForField returns. */
export function columnFromDatabase(c) {
  const base = { name: c.name }
  if (c.references) base.references = c.references
  switch (c.udtName) {
    case 'varchar': return { ...base, type: 'varchar', length: c.maxLength }
    case 'text': return { ...base, type: 'text' }
    case 'int2':
    case 'int4': return { ...base, type: 'integer' }
    case 'numeric': return { ...base, type: 'numeric' }
    case 'date': return { ...base, type: 'date' }
    case 'timestamp':
    case 'timestamptz': return { ...base, type: 'timestamp' }
    case 'bool': return { ...base, type: 'boolean' }
    // Anything else (a timestamp, a bigint someone chose) is not a type a field
    // makes — so any change to it is refused rather than guessed at.
    default: return { ...base, type: c.udtName }
  }
}

/**
 * What publishing `next` does to its table.
 *
 * @param current  { table, columns: [{ name, udtName, maxLength, references }] }
 *                 as the database describes it, or null when the table does not exist
 * @param options.managed      names ever published as fields on this table
 * @param options.inUse        names other published screens on this table still use
 * @param options.confirmDrop  names the person has confirmed dropping
 * @param options.convert         true: plan conversions (the caller runs their checks).
 *                                 OFF by default — a host that does not know about them
 *                                 must see a refusal, not a plan it would publish
 *                                 without running (that would skip the ALTER)
 * @param options.confirmConvert  names the person has confirmed converting
 * @returns {{
 *   table, create,
 *   add, alter,             what will change
 *   drop,                   columns to drop: [{ name }]
 *   unconfirmed,            of those, the ones not yet confirmed — nothing runs until this is empty
 *   convert,                columns changing kind: [{ column, from, to, check, sample, count }] —
 *                           the host runs `check` and refuses unless it is 0 for each
 *   unconfirmedConvert,     of those, the ones not yet confirmed — nothing runs until this is empty
 *   keep,                   columns left in place, with why: [{ name, reason }]
 *   refused,                changes that cannot be made safely: [{ column, reason }] — nothing runs
 *   statements              the SQL, in order — empty while anything is refused or unconfirmed
 * }}
 */
export function planTableChange(current, next, options = {}, controls = CONTROLS) {
  const after = tableForScreen(next, controls)
  const managed = new Set(options.managed || [])
  const inUse = new Set(options.inUse || [])
  const confirmed = new Set(options.confirmDrop || [])
  const converting = new Set(options.confirmConvert || [])
  const plan = { table: after.table, create: false, add: [], alter: [], drop: [], unconfirmed: [], convert: [], unconfirmedConvert: [], keep: [], refused: [], statements: [] }

  if (!current) {
    plan.create = true
    plan.add = after.columns
    plan.statements = createStatements(after)
    return plan
  }

  const existing = current.columns
    .filter((c) => !RESERVED_COLUMNS.includes(c.name))
    .map(columnFromDatabase)
  const diff = diffTables({ table: after.table, columns: existing }, after)
  plan.add = diff.add
  plan.alter = diff.alter
  diff.refused.forEach((r) => {
    const how = options.convert && r.convert && conversionFor(after.table, r.convert.from, r.convert.to)
    if (!how) { plan.refused.push({ column: r.column, reason: r.reason }); return }
    plan.convert.push({ column: r.column, from: describe(r.convert.from), to: describe(r.convert.to), check: how.check, sample: how.sample, count: how.count, statements: how.statements })
  })
  plan.unconfirmedConvert = plan.convert.filter((c) => !converting.has(c.column)).map((c) => c.column)

  diff.unused.forEach((c) => {
    if (!managed.has(c.name)) plan.keep.push({ name: c.name, reason: 'not created by a screen — left as it is' })
    else if (inUse.has(c.name)) plan.keep.push({ name: c.name, reason: 'another published screen on this table still uses it' })
    else plan.drop.push({ name: c.name })
  })
  plan.unconfirmed = plan.drop.filter((d) => !confirmed.has(d.name)).map((d) => d.name)

  if (plan.refused.length || plan.unconfirmed.length || plan.unconfirmedConvert.length) return plan
  plan.add.forEach((c) => plan.statements.push(...addStatements(after.table, c)))
  plan.alter.forEach(({ from, to }) => plan.statements.push(alterStatement(after.table, from, to)))
  plan.convert.forEach((c) => plan.statements.push(...c.statements))
  plan.drop.forEach((d) => plan.statements.push(dropStatement(after.table, d.name)))
  return plan
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

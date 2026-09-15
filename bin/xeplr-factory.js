#!/usr/bin/env node
// xeplr-factory — the command-line side of @xeplr/ui-factory.
//
// Mostly for Claude, which drafts screens from plain-English requests: it can
// turn a short spec into a laid-out document, and check a document before
// handing it to an app, with errors precise enough to fix without guessing.
//
//   xeplr-factory screens entity.json [-o dir]           an entity → list + edit screens, their .jsx pages, server hooks + model stubs
//   xeplr-factory migration edit.screen.json [--from previous.screen.json] [-o migrations/]
//                                                        the SQL that makes the table match the form
//   xeplr-factory generate spec.json [-o screen.json]   spec → laid-out document
//   xeplr-factory validate screen.json                   check a document (exit 1 on problems)
//   xeplr-factory controls                               the controls and their props
//   xeplr-factory schema screen.json                     the form's @xeplr/schema-handler schema
//
// "-" as the file reads stdin.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { CONTROLS } from '../src/controls.js'
import { screenFromSpec } from '../src/generate.js'
import { scaffoldEntity } from '../src/scaffold.js'
import { migrationFor, nextMigrationName } from '../src/tableSchema.js'
import { validateDocument } from '../src/validateDocument.js'
import { formSchema } from '../src/values.js'

const USAGE = `usage:
  xeplr-factory screens <entity.json|-> [-o <dir>] [--force] [--no-pages]
  xeplr-factory migration <edit.screen.json> [--from <previous.screen.json>] [-o <migrations dir>]
  xeplr-factory generate <spec.json|-> [-o <out.json>]
  xeplr-factory validate <screen.json|->
  xeplr-factory controls
  xeplr-factory schema <screen.json|->`

function readJson(file) {
  const text = readFileSync(file === '-' ? 0 : file, 'utf8')
  try {
    return JSON.parse(text)
  } catch (err) {
    fail(`${file === '-' ? 'stdin' : file} is not valid JSON: ${err.message}`)
  }
}

function fail(message, code = 1) {
  process.stderr.write(message + '\n')
  process.exit(code)
}

function out(json, outFile) {
  const text = JSON.stringify(json, null, 2) + '\n'
  if (outFile) writeFileSync(outFile, text)
  else process.stdout.write(text)
}

const [cmd, ...args] = process.argv.slice(2)

switch (cmd) {
  case 'generate': {
    if (!args[0]) fail(USAGE, 2)
    const o = args.indexOf('-o')
    const outFile = o !== -1 ? args[o + 1] : null
    let doc
    try {
      doc = screenFromSpec(readJson(args[0]))
    } catch (err) {
      fail(err.message)
    }
    out(doc, outFile)
    if (outFile) process.stderr.write(`wrote ${outFile} — ${doc.nodes.length} controls\n`)
    break
  }

  case 'screens': {
    if (!args[0]) fail(USAGE, 2)
    const o = args.indexOf('-o')
    const dir = o !== -1 ? args[o + 1] : '.'
    const force = args.includes('--force')
    let result
    try {
      result = scaffoldEntity(readJson(args[0]))
    } catch (err) {
      fail(err.message)
    }
    // The app's own code — the server hooks, and the pages with their front-end
    // hooks — is kept as it is, even with --force. Only the screen JSON is replaced.
    // --no-pages: only the screens and the server files — for an app whose pages live elsewhere (ui/src/pages).
    if (args.includes('--no-pages')) Object.keys(result.files).filter((f) => f.endsWith('.jsx')).forEach((f) => delete result.files[f])
    const kept = Object.keys(result.files).filter((f) => (f.endsWith('.hooks.js') || f.endsWith('.model.js') || f.endsWith('.jsx')) && existsSync(path.join(dir, f)))
    const writing = Object.keys(result.files).filter((f) => !kept.includes(f))
    const targets = writing.map((f) => path.join(dir, f))
    // Never overwrite a screen someone has since refined in the designer.
    const existing = targets.filter((t) => existsSync(t))
    if (existing.length && !force) fail(`would overwrite ${existing.join(', ')} — pass --force to replace them`)
    mkdirSync(dir, { recursive: true })
    writing.forEach((f) => writeFileSync(path.join(dir, f), result.files[f]))
    process.stderr.write(`wrote ${targets.join(', ')}\n`)
    if (kept.length) process.stderr.write(`kept ${kept.map((f) => path.join(dir, f)).join(', ')} — your code\n`)
    process.stderr.write(`list screen "${result.list.id}" opens "${result.edit.id}" for Edit / New; both use table "${result.edit.source}"\n`)
    break
  }

  case 'migration': {
    if (!args[0]) fail(USAGE, 2)
    const f = args.indexOf('--from')
    const o = args.indexOf('-o')
    const next = readJson(args[0])
    const previous = f !== -1 ? readJson(args[f + 1]) : null
    for (const [label, doc] of [['screen', next], ['--from screen', previous]]) {
      if (!doc) continue
      const { ok, errors } = validateDocument(doc)
      if (!ok) fail(`the ${label} is not valid — run validate first (${errors.length} problems)`)
    }
    let result
    try {
      result = migrationFor(previous, next)
    } catch (err) {
      fail(err.message)
    }
    if (result.empty) {
      process.stderr.write(`"${result.table}" already matches the form — no migration needed\n`)
      if (result.diff.unused.length) process.stderr.write(`(columns no longer on the screen, kept: ${result.diff.unused.map((c) => c.name).join(', ')})\n`)
      break
    }
    if (o !== -1) {
      const dir = args[o + 1]
      const existing = existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.sql')) : []
      const file = path.join(dir, nextMigrationName(existing, result.table, result.diff.create))
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, result.sql)
      process.stderr.write(`wrote ${file}\n`)
    } else {
      process.stdout.write(result.sql)
    }
    break
  }

  case 'validate': {
    if (!args[0]) fail(USAGE, 2)
    const { ok, errors } = validateDocument(readJson(args[0]))
    if (ok) {
      process.stdout.write('ok — valid screen document\n')
    } else {
      process.stdout.write(`${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`)
      errors.forEach((e) => process.stdout.write(`  ${e.path || '(document)'}: ${e.message}\n`))
      process.exit(1)
    }
    break
  }

  case 'controls': {
    Object.values(CONTROLS).forEach((c) => {
      process.stdout.write(`${c.type.padEnd(9)} ${c.label}${c.input ? ` — value: ${c.valueType || 'option id'}` : ''}\n`)
      process.stdout.write(`          props: ${c.props.join(', ')}\n`)
      if (c.validation.length) process.stdout.write(`          validation: ${c.validation.join(', ')}\n`)
      if (c.styles && c.styles.length) process.stdout.write(`          style: ${c.styles.join(', ')}\n`)
    })
    break
  }

  case 'schema': {
    if (!args[0]) fail(USAGE, 2)
    const doc = readJson(args[0])
    const { ok, errors } = validateDocument(doc)
    if (!ok) fail(`invalid document — run validate first (${errors.length} problems)`)
    out(formSchema(doc))
    break
  }

  default:
    fail(USAGE, cmd ? 2 : 0)
}

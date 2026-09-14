#!/usr/bin/env node
// xeplr-factory — the command-line side of @xeplr/ui-factory.
//
// Mostly for Claude, which drafts screens from plain-English requests: it can
// turn a short spec into a laid-out document, and check a document before
// handing it to an app, with errors precise enough to fix without guessing.
//
//   xeplr-factory generate spec.json [-o screen.json]   spec → laid-out document
//   xeplr-factory validate screen.json                   check a document (exit 1 on problems)
//   xeplr-factory controls                               the controls and their props
//   xeplr-factory schema screen.json                     the form's @xeplr/schema-handler schema
//
// "-" as the file reads stdin.

import { readFileSync, writeFileSync } from 'node:fs'
import { CONTROLS } from '../src/controls.js'
import { screenFromSpec } from '../src/generate.js'
import { validateDocument } from '../src/validateDocument.js'
import { formSchema } from '../src/values.js'

const USAGE = `usage:
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

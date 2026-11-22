// A BUTTON THAT OPENS A SCREEN — `opens` instead of `action`: Edit on a
// record's view opens its form. What a screen may say, and that publishing
// asks for no function for it.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, nodeFunctions } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)

function view(buttons) {
  const doc = createScreen({ id: 'movement_view', name: 'Movement', source: 'movements' })
  const added = addControl(doc, 'buttons')
  return setNodeProperty(added.document, added.node.id, 'props.buttons', buttons)
}

console.log('a button that opens a screen')
{
  const edit = { id: 'edit', label: 'Edit', opens: 'movement_edit' }
  check('opens a screen: a screen', errs(view([edit])).length === 0, errs(view([edit])).join('; '))
  check('with a run button beside it', errs(view([edit, { id: 'receive', label: 'Receive', action: 'receiveMovementItems' }])).length === 0)
  check('opens and action both: refused', errs(view([{ ...edit, action: 'x' }])).some((e) => /opens a screen or runs a function — not both/.test(e)))
  check('opens with ask: refused', errs(view([{ ...edit, ask: { title: 'Sure?' } }])).some((e) => /ask: is for a button that runs a function/.test(e)))
  check('opens with params: refused', errs(view([{ ...edit, params: { a: 1 } }])).some((e) => /params: is for a button that runs a function/.test(e)))
  check('opens must name a screen', errs(view([{ id: 'e', label: 'E', opens: 'no spaces here' }])).some((e) => /opens: must be the key of a screen/.test(e)))
  check('neither: refused, naming both ways', errs(view([{ id: 'e', label: 'E' }])).some((e) => /action: must be the name .* or give "opens"/.test(e)))
  check('publishing asks for no function for it', nodeFunctions(view([edit])).length === 0)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)

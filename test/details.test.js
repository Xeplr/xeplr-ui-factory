// A RECORD'S DETAILS — read-only sections from a function (details.js): what a
// screen may say and what an answer becomes.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { validateDocument, createScreen, addControl, setNodeProperty, nodeFunctions, inputNodes, DETAILS_EVENT, detailsOf, safeHref, MAX_ROWS } from '../src/model.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const errs = (doc) => validateDocument(doc).errors.map((e) => `${e.path}: ${e.message}`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function screen(props, source = 'orders') {
  let doc = createScreen({ id: 'order_view', name: 'Order', source })
  const added = addControl(doc, 'details')
  doc = added.document
  Object.entries({ detailsFrom: 'orderDetails', ...props }).forEach(([k, v]) => { doc = setNodeProperty(doc, added.node.id, 'props.' + k, v) })
  return doc
}

console.log('what a screen may say')
{
  const doc = screen({ title: 'Order', columns: 3, moreLabel: 'More about it', empty: 'Nothing known' })
  check('a details panel: valid', errs(doc).length === 0, errs(doc).join('; '))
  check('its function is listed under "recordDetails"', same(nodeFunctions(doc), [{ event: DETAILS_EVENT, name: 'orderDetails', at: 'nodes[0].props.detailsFrom' }]))
  check('it is not a field', inputNodes(doc).length === 0)
  const e = errs(screen({ detailsFrom: undefined, columns: 4 }))
  check('no function, four columns: each refused', e.some((x) => x.includes('props.detailsFrom') && x.includes('"recordDetails"')) && e.some((x) => x.includes('props.columns')), e.join('; '))
  const nosrc = errs(screen({}, null))
  check('a screen with no table: refused', nosrc.some((x) => x.includes('needs the screen to have a "source"')), nosrc.join('; '))
}

console.log('what an answer becomes')
{
  const out = detailsOf({ more: true, sections: [
    { title: 'Contact', rows: [
      { label: 'Phone', text: '+91 98450', href: 'tel:+9198450' },
      { label: 'Mail', text: 'a@b.in', href: 'mailto:a@b.in' },
      { label: 'Web', text: 'site', href: 'https://gharart.com' },
      { label: 'Bad', text: 'x', href: 'javascript:alert(1)' },
      { label: 'Empty', text: '   ' },
      { label: 'Status', text: 'Delivered', tone: 'success' },
      { label: 'Odd', text: 'y', tone: 'neon' },
      { text: 'no label' }
    ] },
    { title: 'Products', items: [{ src: 'https://cdn/x.jpg', name: 'Horse', detail: 'GA-HR-01', qty: 2 }, { name: 'No picture', qty: '' }, { detail: 'nothing to name it' }, { src: 'data:x', name: 'bad src' }] },
    { title: 'Empty', rows: [{ label: 'a', text: '' }] },
    null
  ] })
  const contact = out.sections[0]
  check('two sections kept, the empty one dropped', same(out.sections.map((s) => s.title), ['Contact', 'Products']))
  check('rows with nothing to say are dropped', contact.rows.length === 7 && !contact.rows.some((r) => r.label === 'Empty'))
  check('tel:, mailto: and https links kept', same(contact.rows.slice(0, 3).map((r) => r.href), ['tel:+9198450', 'mailto:a@b.in', 'https://gharart.com']))
  check('a script link is dropped — the text stays', contact.rows[3].href === null && contact.rows[3].text === 'x')
  check('a tone is one of the badge tones, or none', contact.rows[4].tone === 'success' && contact.rows[5].tone === null)
  check('a row with no label', contact.rows[6].label === null && contact.rows[6].text === 'no label')
  const items = out.sections[1].items
  check('items: a name or a picture each; a picture only from http(s)', items.length === 3 && items[0].qty === 2 && items[1].qty === null && items[2].src === null, JSON.stringify(items))
  check('"more" is said by the function', out.more === true && detailsOf({ sections: [] }).more === false)
  check('anything else is no sections, not an error', detailsOf(null).sections.length === 0 && detailsOf('x').sections.length === 0)
  check('at most 50 rows a section', detailsOf([{ rows: Array.from({ length: 80 }, (_, i) => ({ text: 'r' + i })) }]).sections[0].rows.length === MAX_ROWS)
  check('safeHref: only http(s), tel and mailto', safeHref('HTTPS://x') && safeHref('tel:1') && !safeHref('ftp://x') && !safeHref('  javascript:x'))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)

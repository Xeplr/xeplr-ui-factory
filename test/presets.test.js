// Ready-made fields: what they put on a field, how a spec and a label find
// them, changing a field's kind, and a column following a field that changed kind.
import {
  FIELD_PRESETS, presetFor, presetProps, suggestPreset, presetHints, convertField,
  screenFromSpec, validateDocument, validateValues, formSchema, planTableChange, conversionFor, addControl, createScreen
} from '../src/model.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

console.log('\nthe catalogue')
{
  const keys = FIELD_PRESETS.map((p) => p.key)
  check('the agreed list is there', ['email', 'phone', 'url', 'linkedin', 'age', 'gender', 'dateOfBirth', 'country', 'amount', 'percentage', 'yesNo', 'postalCode'].every((k) => keys.includes(k)))
  check('gender is Male, Female, Others', presetProps('gender').data.options.map((o) => o.name).join() === 'Male,Female,Others')
  check('countries are ISO codes shown by name', presetProps('country').data.options.some((o) => o.id === 'IN' && o.name === 'India'))
  const a = presetProps('email'); a.validation.maxLength = 1
  check('each use is a fresh copy', presetProps('email').validation.maxLength === 254)
  check('"preset:" spelling resolves', presetFor('preset:age').key === 'age')
}

console.log('\nlabels are recognised')
{
  const is = (label, key) => (suggestPreset(label) || {}).key === key
  check('LinkedIn URL → linkedin, not website', is('LinkedIn URL', 'linkedin'))
  check('Email address → email', is('Email address', 'email'))
  check('Age → age, Average → nothing', is('Age', 'age') && !suggestPreset('Average score'))
  check('Mobile number → phone', is('Mobile number', 'phone'))
  check('DOB → dateOfBirth', is('DOB', 'dateOfBirth'))
  check('Full name → nothing', !suggestPreset('Full name'))
}

console.log('\na spec gets them by name or by label')
{
  const doc = screenFromSpec({ name: 'Person', source: 'people', fields: [
    { label: 'Email' }, { label: 'LinkedIn URL' }, { label: 'Age', validation: { max: 120 } }, { label: 'Gender' },
    { type: 'yesNo', label: 'Remote?' }, { type: 'text', label: 'Website' }, { preset: 'country' }
  ] })
  const by = (name) => doc.nodes.find((n) => n.props.name === name)
  check('the document is valid', validateDocument(doc).ok)
  check('a bare label becomes the preset', by('email').props.preset === 'email' && by('email').props.inputType === 'email')
  check('the spec\'s own rules win, the rest stay', by('age').props.validation.max === 120 && by('age').props.validation.integer === true)
  check('a named preset needs no label', by('country').type === 'dropdown' && by('country').props.label === 'Country')
  check('type: text opts out', !by('website').props.preset)
  const errors = validateValues(doc, { email: 'x@', linkedinUrl: 'https://example.com/me', age: 4.5, gender: 'robot' })
  check('email, LinkedIn, whole-number age and options are all checked', errors.email && errors.linkedinUrl && errors.age && errors.gender)
  check('good values pass', Object.keys(validateValues(doc, { email: 'a@b.co', linkedinUrl: 'https://www.linkedin.com/in/ada', age: 36, gender: 'female', remote: 'yes' })).length === 0)
}

console.log('\ndate of birth: never in the future — on the server too')
{
  const doc = screenFromSpec({ name: 'P', fields: [{ label: 'Date of birth' }] })
  check('a future date is refused', /future/.test(validateValues(doc, { dateOfBirth: '2999-01-01' }).dateOfBirth))
  const max = formSchema(doc)[0].validation.max
  check('the server schema says on or before today', /^\d{4}-\d{2}-\d{2}$/.test(max) && max <= new Date(Date.now() + 86400000).toISOString().slice(0, 10))
}

console.log('\nchanging a field\'s kind')
{
  let doc = createScreen({ name: 'P', source: 'people' })
  ;({ document: doc } = addControl(doc, 'text', { props: { label: 'LinkedIn URL', required: true, validation: { maxLength: 80 } } }))
  const id = doc.nodes[0].id
  check('a plain field with a telling label is suggested', presetHints(doc)[0].preset === 'linkedin')
  const r = convertField(doc, id, 'linkedin', undefined, { lockedNames: ['linkedinUrl'] })
  const p = r.node.props
  check('it becomes the ready-made field', p.preset === 'linkedin' && p.inputType === 'url' && new RegExp(p.validation.pattern).test('https://www.linkedin.com/in/ada') && !new RegExp(p.validation.pattern).test('https://example.com'))
  check('label, name and required are kept', p.label === 'LinkedIn URL' && p.name === 'linkedinUrl' && p.required === true)
  check('a rule of theirs it replaced is said (max length 80 → the preset\'s)', r.dropped.includes('max length'))
  check('no more suggestion', presetHints(r.document).length === 0)
  check('still a valid document', validateDocument(r.document).ok)

  const toNumber = convertField(r.document, id, 'number')
  check('to a plain Number: label kept, the pattern reported', toNumber.node.type === 'number' && toNumber.node.props.label === 'LinkedIn URL' && toNumber.dropped.includes('the pattern'))
  const gender = convertField(doc, id, 'gender')
  check('to Gender: a radio group with its options', gender.node.type === 'radio' && gender.node.props.data.options.length === 3)
  const back = convertField(gender.document, id, 'text')
  check('and back to text: the options are reported', back.dropped.includes('the options'))
  const plain = { ...doc, nodes: [{ ...doc.nodes[0], props: { ...doc.nodes[0].props, preset: false } }] }
  check('preset: false stops suggesting', presetHints(plain).length === 0 && validateDocument(plain).ok)
}

console.log('\na column follows a field that changed kind — on publish, checked')
{
  const doc = screenFromSpec({ name: 'P', source: 'people', fields: [{ label: 'Age' }] })
  const table = { table: 'people', columns: [{ name: 'age', udtName: 'varchar', maxLength: 255 }] }
  const asked = planTableChange(table, doc, { convert: true })
  check('text → integer is a conversion, not a refusal', asked.refused.length === 0 && asked.convert.length === 1 && asked.convert[0].column === 'age')
  check('nothing runs until confirmed', asked.unconfirmedConvert[0] === 'age' && asked.statements.length === 0)
  check('the check finds values that would not fit', /count\(\*\)::int AS n FROM "people" WHERE "age" IS NOT NULL AND/.test(asked.convert[0].check))
  const go = planTableChange(table, doc, { convert: true, confirmConvert: ['age'] })
  const old = planTableChange(table, doc)
  check('a host that does not ask for conversions still gets a refusal', old.refused.length === 1 && old.convert.length === 0)
  check('confirmed: ALTER … USING, blanks as NULL', go.statements.some((s) => /ALTER COLUMN "age" TYPE integer USING NULLIF\(btrim\("age"::text\), ''\)::integer/.test(s)))
  const kinds = ['integer', 'numeric', 'date', 'timestamp', 'boolean']
  const all = kinds.map((k) => conversionFor('t', { name: 'x', type: 'varchar', length: 9 }, { name: 'x', type: k })).concat(conversionFor('t', { name: 'x', type: 'numeric' }, { name: 'x', type: 'integer' }))
  check('no ? in any conversion SQL — knex.raw would read it as a placeholder', all.every((c) => ![c.check, c.sample, c.count, ...c.statements].some((x) => x.includes('?'))))
    check('a timestamp cannot become a date', conversionFor('t', { name: 'x', type: 'timestamp' }, { name: 'x', type: 'date' }) === null)
  const ref = planTableChange({ table: 'people', columns: [{ name: 'age', udtName: 'varchar', maxLength: 25, references: 'ages' }] }, doc, { convert: true })
  check('a foreign key is still refused outright', ref.refused.length === 1 && ref.convert.length === 0)
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)

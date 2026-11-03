// The CLI, as Claude uses it: generate from a spec, validate, list controls.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const bin = path.join(here, '..', 'bin', 'xeplr-factory.js')
const example = path.join(here, '..', 'examples', 'employee.entity.json')
const formSpec = JSON.stringify({ name: 'New employee', fields: [{ label: 'First name', required: true }, { label: 'Department', type: 'dropdown', options: ['A', 'B'] }] })
const dir = mkdtempSync(path.join(tmpdir(), 'xf-cli-'))

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }
const run = (args, input) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', input })

console.log('\nscreens: an entity becomes a list screen and an edit screen')
{
  const out = path.join(dir, 'app')
  const r = run(['screens', example, '-o', out])
  check('exits 0', r.status === 0)
  const files = ['employee-list.screen.json', 'employee-edit.screen.json', 'EmployeeList.jsx', 'EditEmployee.jsx']
  check('writes both screens and both pages', files.every((f) => { try { readFileSync(path.join(out, f)); return true } catch (_) { return false } }))
  const list = JSON.parse(readFileSync(path.join(out, 'employee-list.screen.json'), 'utf8'))
  check('the list opens the edit screen', list.nodes[0].props.editScreen === 'employee_edit')
  check('the list page passes the edit screen to the popup', /screens=\{\{ \[editScreen\.id\]: editScreen \}\}/.test(readFileSync(path.join(out, 'EmployeeList.jsx'), 'utf8')))
  const again = run(['screens', example, '-o', out])
  check('refuses to overwrite a screen that may have been refined since', again.status === 1 && /--force/.test(again.stderr))
  writeFileSync(path.join(out, 'employee.functions.js'), '// my functions\n')
  writeFileSync(path.join(out, 'EditEmployee.jsx'), '// my page\n')
  check('...unless forced', run(['screens', example, '-o', out, '--force']).status === 0)
  check('...and even forced, the functions file is kept', readFileSync(path.join(out, 'employee.functions.js'), 'utf8') === '// my functions\n')
  const noPages = path.join(dir, 'api-only')
  run(['screens', example, '-o', noPages, '--no-pages'])
  check('--no-pages writes the screens and the server files only', ['employee-list.screen.json', 'employee-edit.screen.json', 'employee.functions.js', 'employee.model.js'].every((f) => { try { readFileSync(path.join(noPages, f)); return true } catch (_) { return false } }) && (() => { try { readFileSync(path.join(noPages, 'EditEmployee.jsx')); return false } catch (_) { return true } })())
  check('...and the pages, which hold the front-end hooks', readFileSync(path.join(out, 'EditEmployee.jsx'), 'utf8') === '// my page\n')
}

console.log('\ngenerate')
{
  const specFile = path.join(dir, 'form.spec.json')
  writeFileSync(specFile, formSpec)
  const outFile = path.join(dir, 'screen.json')
  const r = run(['generate', specFile, '-o', outFile])
  check('exits 0', r.status === 0)
  const doc = JSON.parse(readFileSync(outFile, 'utf8'))
  check('writes a screen document', doc.kind === 'xeplr-screen' && doc.nodes.length >= 3)
  const stdin = run(['generate', '-'], JSON.stringify({ name: 'Tiny', fields: [{ label: 'A' }] }))
  check('reads a spec from stdin and prints the document', stdin.status === 0 && JSON.parse(stdin.stdout).name === 'Tiny')
  const bad = run(['generate', '-'], JSON.stringify({ name: 'X', fields: [{ label: 'A', type: 'slider' }] }))
  check('a bad spec exits 1 with the reason', bad.status === 1 && /not a control/.test(bad.stderr))
  const notJson = run(['generate', '-'], '{ nope')
  check('invalid JSON is reported as such', notJson.status === 1 && /not valid JSON/.test(notJson.stderr))
}

console.log('\nvalidate')
{
  const good = path.join(dir, 'good.json')
  writeFileSync(good, run(['generate', '-'], formSpec).stdout)
  const ok = run(['validate', good])
  check('a valid document exits 0', ok.status === 0 && /ok/.test(ok.stdout))
  const doc = JSON.parse(readFileSync(good, 'utf8'))
  doc.nodes[1].w = 5
  const bad = path.join(dir, 'bad.json')
  writeFileSync(bad, JSON.stringify(doc))
  const r = run(['validate', bad])
  check('an invalid one exits 1 and names the path', r.status === 1 && /nodes\[1\]\.w/.test(r.stdout))
}

console.log('\ncontrols and schema')
{
  const r = run(['controls'])
  check('lists every control with its props', r.status === 0 && /dropdown/.test(r.stdout) && /props: name, label/.test(r.stdout))
  const good = path.join(dir, 'good.json')
  const s = run(['schema', good])
  check('prints the form schema', s.status === 0 && Array.isArray(JSON.parse(s.stdout)))
  check('no command prints usage', /usage:/.test(run([]).stderr))
}

console.log('\npages: web-only pages are said out loud, never refused')
{
  const ui = path.join(dir, 'ui')
  const { mkdirSync } = await import('node:fs')
  mkdirSync(path.join(ui, 'src'), { recursive: true })
  writeFileSync(path.join(ui, 'src', 'App.jsx'), `
    <Routes>
      <Route path="/" element={<Navigate to="/orders" replace />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:orderId" element={<OrdersPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>`)
  const none = run(['pages', ui])
  check('no pages.json: a warning, exit 0', none.status === 0 && /no pages\.json/.test(none.stderr))
  writeFileSync(path.join(ui, 'pages.json'), JSON.stringify({
    routes: ['src/App.jsx'],
    documents: [{ path: '/orders', menu: 'Orders', screen: 'orders_board' }],
    webOnly: [{ path: '/orders/:orderId', menu: 'Orders', reason: 'Tasks and comments are hand-written.' }, { path: '/gone', reason: 'old' }]
  }))
  const r = run(['pages', ui])
  check('a web-only page is warned about, with its reason', r.status === 0 && /\/orders\/:orderId is web only — it will not be in a phone app\. Tasks and comments/.test(r.stderr))
  check('a route nobody listed is warned about', /\/home is not in pages\.json/.test(r.stderr))
  check('a listed page no route declares any more is warned about', /\/gone is in pages\.json but no route declares it/.test(r.stderr))
  check('redirects and the catch-all are not pages', !/"\/" is not|\* is not/.test(r.stderr) && !/^warning: \/ is not/m.test(r.stderr))
  check('--strict makes warnings fail', run(['pages', ui, '--strict']).status === 1)
  writeFileSync(path.join(ui, 'pages.json'), JSON.stringify({ documents: [{ path: '/orders' }, { path: '/orders/:orderId' }, { path: '/home' }] }))
  const clean = run(['pages', ui])
  check('everything listed, nothing web only: quiet', clean.status === 0 && /every page is listed/.test(clean.stdout) && clean.stderr === '')
  writeFileSync(path.join(ui, 'pages.json'), JSON.stringify({ webOnly: [{ path: '/home' }] }))
  check('a web-only page with no reason is called out', /webOnly\[0\]\.reason is required/.test(run(['pages', ui]).stderr))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)

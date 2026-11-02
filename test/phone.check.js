// Every screen at phone sizes — in a real browser, on the dev app (dev/).
//
//   npm run test:phone
//
// Not part of `npm test`: it needs a browser (`npx playwright install
// chromium-headless-shell`, once) and starts a dev server. Run it before
// releasing anything that changes how a screen is drawn.
//
// What it holds the screens to, at 360, 390 and 430px wide:
//   - the page never scrolls sideways;
//   - fields are one per row, full width, in reading order, none overlapping;
//   - inputs are 16px or larger (smaller makes iOS zoom the page) and 44px tall;
//   - the footer's buttons are 44px tall and on screen;
//   - a list's row buttons are on screen without scrolling the table;
//   - a popup fills the screen.
// And at 1280px, that the desktop layout is still the designed one.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }

// Records for the list, so it has rows, paging and row buttons to check.
const records = {
  employees: Array.from({ length: 23 }, (_, i) => ({
    id: i + 1, firstName: 'Person' + (i + 1), lastName: 'Longsurname', workEmail: `person${i + 1}@example.com`,
    phone: '+44 7700 900' + String(i).padStart(3, '0'), department: 1 + (i % 3), startDate: '2024-01-02', remote: i % 2 === 0
  }))
}

const server = await createServer({ root, configFile: root + 'vite.config.js', server: { port: 0, strictPort: false }, logLevel: 'error' })
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch()

/** A fresh page at this width, on the dev app's page called `menu` ('List' or 'Edit'). */
async function open(width, menu) {
  const phone = width < 700
  const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: phone, hasTouch: phone })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript((s) => localStorage.setItem('dev-records', s), JSON.stringify(records))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: menu, exact: true }).first().click()
  await page.waitForTimeout(400)
  return { page, errors }
}

const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

/** Each drawn control's box, in the order it appears down the page. */
const nodeBoxes = (page, scope = '') => page.$$eval(scope + ' .xeplr-factory-node', (els) => els
  .map((el) => ({ r: el.getBoundingClientRect(), pos: getComputedStyle(el).position, order: Number(getComputedStyle(el).order) }))
  .filter((b) => b.r.height > 0)
  .map((b) => ({ top: b.r.top, bottom: b.r.bottom, left: b.r.left, width: b.r.width, pos: b.pos, order: b.order })))

const inputs = (page) => page.$$eval('.xeplr-factory-input:not([type=file])', (els) => els
  .filter((el) => el.getBoundingClientRect().height > 0)
  .map((el) => ({ name: el.name || el.id, font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height })))

try {
  for (const width of [360, 390, 430]) {
    console.log(`\n${width}px`)

    // ── a form ────────────────────────────────────────────────────────────
    {
      const { page, errors } = await open(width, 'Edit')
      check(`form: no script errors`, errors.length === 0, errors.join('; '))
      check(`form: page does not scroll sideways`, await noSideways(page))

      const boxes = await nodeBoxes(page)
      check(`form: controls are in the flow, not placed`, boxes.length > 5 && boxes.every((b) => b.pos === 'static'), boxes.map((b) => b.pos).join(','))
      const widest = Math.max(...boxes.map((b) => b.width))
      check(`form: every control is the full width`, boxes.every((b) => Math.abs(b.width - widest) < 1), boxes.map((b) => Math.round(b.width)).join(','))
      const byTop = [...boxes].sort((a, b) => a.top - b.top)
      check(`form: controls come in reading order`, byTop.every((b, i) => i === 0 || b.order > byTop[i - 1].order))
      check(`form: no control overlaps the next`, byTop.every((b, i) => i === 0 || b.top >= byTop[i - 1].bottom - 0.5))

      const fields = await inputs(page)
      const small = fields.filter((f) => f.font < 16)
      check(`form: inputs are 16px or larger`, fields.length > 0 && small.length === 0, small.map((f) => `${f.name} ${f.font}px`).join(', '))
      const short = fields.filter((f) => f.height < 44)
      check(`form: inputs are 44px tall or more`, short.length === 0, short.map((f) => `${f.name} ${f.height}px`).join(', '))

      const buttons = await page.$$eval('.xeplr-factory-footer button', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { h: r.height, right: r.right } }))
      check(`form: footer buttons are 44px tall`, buttons.length > 0 && buttons.every((b) => b.h >= 44), buttons.map((b) => b.h).join(','))
      check(`form: footer buttons are on screen`, buttons.every((b) => b.right <= width))
      await page.close()
    }

    // ── a list, and the popup it opens ────────────────────────────────────
    {
      const { page, errors } = await open(width, 'List')
      check(`list: no script errors`, errors.length === 0, errors.join('; '))
      check(`list: page does not scroll sideways`, await noSideways(page))
      const actions = await page.$$eval('.xeplr-table-td-actions', (els) => els.map((el) => el.getBoundingClientRect().right))
      check(`list: row buttons are on screen without scrolling the table`, actions.length > 0 && actions.every((r) => r <= width), actions.map(Math.round).join(','))
      const paging = await page.$eval('.xeplr-table-pagination', (el) => el.scrollWidth <= el.clientWidth).catch(() => false)
      check(`list: paging fits its bar`, paging)

      await page.getByRole('button', { name: '+ New' }).click()
      await page.waitForTimeout(400)
      const modal = await page.$eval('.xeplr-factory-modal', (el) => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width } })
      check(`popup: fills the screen`, modal.left === 0 && Math.abs(modal.width - width) < 1, JSON.stringify(modal))
      check(`popup: page does not scroll sideways`, await noSideways(page))
      const fields = await inputs(page)
      check(`popup: inputs are 16px or larger`, fields.length > 0 && fields.every((f) => f.font >= 16))
      await page.close()
    }
  }

  // ── a desktop, unchanged ─────────────────────────────────────────────────
  console.log('\n1280px')
  {
    const { page } = await open(1280, 'Edit')
    const boxes = await nodeBoxes(page)
    check(`desktop: controls are placed where they were designed`, boxes.length > 5 && boxes.every((b) => b.pos === 'absolute'))
    const firstRow = boxes.filter((b) => Math.abs(b.top - boxes[1].top) < 1)
    check(`desktop: side-by-side fields stay side by side`, firstRow.length >= 2, String(firstRow.length))
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)

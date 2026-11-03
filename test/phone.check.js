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
//   - a popup fills the screen;
//   - a list fed by a function: its search box is 16px and 44px tall, its
//     chips stay on screen, and a button's "ask first" fills the screen with
//     44px buttons and a 16px note box.
// And at 1280px, that the desktop layout is still the designed one — and the
// function-fed list and buttons WORK: search and chips narrow the rows, a row
// opens its order, a press with a note changes it and greys its button out,
// and the latest-activity cell's hover box lists the entries.
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
  await page.addInitScript((s) => { localStorage.setItem('dev-records', s); localStorage.removeItem('dev-orders') }, JSON.stringify(records))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.locator('.dev-menu-group').first().getByRole('button', { name: menu, exact: true }).click()
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

  // ── a list fed by a function, and buttons, on phones ──────────────────────
  for (const width of [360, 390, 430]) {
    console.log(`\norders, ${width}px`)
    const { page, errors } = await open(width, 'Orders')
    check(`orders: no script errors`, errors.length === 0, errors.join('; '))
    check(`orders: page does not scroll sideways`, await noSideways(page))
    const search = await page.$eval('.xeplr-factory-list-search', (el) => ({ font: parseFloat(getComputedStyle(el).fontSize), h: el.getBoundingClientRect().height, right: el.getBoundingClientRect().right }))
    check(`orders: search is 16px or larger and 44px tall`, search.font >= 16 && search.h >= 44, JSON.stringify(search))
    check(`orders: search is on screen`, search.right <= width)
    const chips = await page.$eval('.xeplr-factory-chips', (el) => el.getBoundingClientRect().right)
    check(`orders: the chip row stays on screen (it scrolls inside)`, chips <= width + 0.5, String(chips))
    await page.locator('tbody tr').first().click()
    await page.waitForTimeout(500)
    const buttons = await page.$$eval('.dev-order .xeplr-factory-button', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { h: r.height, right: r.right } }))
    check(`buttons: 44px tall and on screen`, buttons.length > 0 && buttons.every((b) => b.h >= 44 && b.right <= width), JSON.stringify(buttons))
    await page.locator('.dev-order .xeplr-factory-button', { hasText: 'Packed' }).first().click()
    await page.waitForTimeout(300)
    const ask = await page.$eval('.xeplr-factory-ask', (el) => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width } })
    check(`ask first: fills the screen's width`, ask.left === 0 && Math.abs(ask.width - width) < 1, JSON.stringify(ask))
    const note = await page.$eval('.xeplr-factory-ask-note', (el) => parseFloat(getComputedStyle(el).fontSize))
    check(`ask first: the note box is 16px or larger`, note >= 16, String(note))
    const foot = await page.$$eval('.xeplr-factory-ask-foot button', (els) => els.map((el) => el.getBoundingClientRect().height))
    check(`ask first: its buttons are 44px tall`, foot.length === 2 && foot.every((h) => h >= 44), foot.join(','))
    check(`ask first: page does not scroll sideways`, await noSideways(page))
    await page.close()
  }

  // ── a list fed by a function, and buttons, working ────────────────────────
  console.log('\norders, 1280px')
  {
    const { page, errors } = await open(1280, 'Orders')
    const rowsShown = () => page.$$eval('tbody tr', (els) => els.length)
    const count = (label) => page.locator('.xeplr-factory-chip', { hasText: label }).locator('.xeplr-factory-chip-count').textContent()
    check(`orders: rows and counts from the function`, (await rowsShown()) === 10 && (await count('All')) === '14', `${await rowsShown()} rows, All ${await count('All')}`)
    await page.locator('.xeplr-factory-list-search').fill('Pune')
    await page.waitForTimeout(700)
    check(`orders: the search narrows the rows and the counts`, (await rowsShown()) === 4 && (await count('All')) === '4', `${await rowsShown()} rows, All ${await count('All')}`)
    await page.locator('.xeplr-factory-chip', { hasText: 'Packed' }).click()
    await page.waitForTimeout(500)
    const statuses = await page.$$eval('tbody tr td:nth-child(4)', (els) => els.map((el) => el.textContent.trim()))
    check(`orders: a chip narrows to its rows`, statuses.length > 0 && statuses.every((t) => t === 'Packed'), statuses.join(','))
    await page.locator('.xeplr-factory-chip', { hasText: 'All' }).click()
    await page.locator('.xeplr-factory-list-search').fill('')
    await page.waitForTimeout(700)

    await page.locator('.xeplr-factory-activity').first().hover()
    await page.waitForTimeout(800)
    const box = await page.$$eval('.xeplr-factory-activity-box .xeplr-factory-activity-item', (els) => els.map((el) => el.textContent))
    check(`orders: the activity cell's hover box lists the entries`, box.length > 0 && /Order placed/.test(box[0]), box.join(' | '))
    await page.mouse.move(5, 5)
    await page.waitForTimeout(400)

    await page.locator('tbody tr').first().locator('td').nth(2).click()
    await page.waitForTimeout(500)
    check(`orders: a click on a row opens it`, (await page.locator('.dev-order').count()) === 1)
    const packed = page.locator('.dev-order .xeplr-factory-button', { hasText: 'Packed' })
    await packed.click()
    await page.locator('.xeplr-factory-ask-note').fill('courier late')
    await page.locator('.xeplr-factory-ask-foot button', { hasText: 'Packed' }).click()
    await page.waitForTimeout(800)
    const said = await page.locator('.dev-order .xeplr-factory-buttons-note').first().textContent().catch(() => '')
    check(`buttons: the press says what it did`, /GA1025: Packed/.test(said), said)
    check(`buttons: its button is greyed out now`, await packed.isDisabled())
    const first = await page.$eval('tbody tr td:nth-child(4)', (el) => el.textContent.trim())
    check(`buttons: the list behind it shows the change`, first === 'Packed', first)
    const cod = page.locator('.dev-order .xeplr-factory-button', { hasText: 'Confirm COD' })
    check(`buttons: one that does not apply is not shown`, (await page.locator('.dev-order .xeplr-factory-button', { hasText: 'Undo COD' }).count()) === 0 && (await cod.count()) === 1)
    await cod.click()
    await page.locator('.xeplr-factory-ask-foot button', { hasText: 'Confirm COD' }).click()
    await page.waitForTimeout(800)
    check(`buttons: after Confirm COD, Undo shows instead`, (await page.locator('.dev-order .xeplr-factory-button', { hasText: 'Undo COD' }).count()) === 1 && (await cod.count()) === 0)
    check(`orders: no script errors`, errors.length === 0, errors.join('; '))
    await page.close()
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

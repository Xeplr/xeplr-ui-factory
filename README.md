# @xeplr/ui-factory

**Design data-entry screens, save them as JSON, run them as working forms.** Drag controls onto a canvas, set their labels, validation, options, fonts and colours. The same document renders as a live form in your app, saved by its **Save** button over AJAX, with a list of the saved records to open, edit or delete.

It is built to work with Claude: ask for *"a form for employees with name, email, department and start date"*, and Claude creates **two screens** — an employee **list** and an **add / edit** form that the list's Edit and New open in a popup — plus the two pages that show them. A person then refines either one in the designer.

## One entity, two screens, four pages

| page | what it is |
|---|---|
| **Screen · List** | `EmployeeList.jsx` — the saved employees; **New** and **Edit** open the edit screen in a popup, **Delete** removes a row |
| **Screen · Edit** | `EditEmployee.jsx` — the add / edit form, on its own page (the same screen the popup shows) |
| **Designer · List** | `<FactoryBuilder document={employeeList} />` — its title, columns, actions, look |
| **Designer · Edit** | `<FactoryBuilder document={employeeEdit} />` — its fields, validation, options, look |

```sh
npx xeplr-factory screens employee.entity.json -o src/screens/employee
#  employee-list.screen.json   EmployeeList.jsx     the list page — uses EditEmployee.jsx's hooks
#  employee-edit.screen.json   EditEmployee.jsx     the form page, holding the FRONT-END hooks (EmployeeHooks extends FactoryHooks)
#  employee.functions.js       SERVER functions, registered by event, named in the screen's events
#  employee.model.js           SERVER model: EmployeeModel extends FactoryModel — getters / setters for values
```

`--no-pages` leaves out the two `.jsx` (for an app whose pages live elsewhere). `--force` replaces only the screen JSON: the pages, hooks and model are your code and are always kept.

**Rules:** records live in real tables, never JSON · a form's **key** (`employee`) names its screens and table and never changes once published; its **label** (the screens' name) is renamed any time · rules that must hold go in server functions (named in the screen's `events`), never front-end hooks.

See [examples/](./examples) for exactly what it writes.

(The package name on npm is `@xeplr/ui-factory` — the GitHub repo and folder are named `xeplr-ui-factory`.)

## Why

Most internal apps are a long tail of forms, and every one of them is hand-built: markup, layout, validation in the browser, validation again on the server, and dropdowns wired to tables. This turns a form into **data**:

- a person — or Claude — describes the screen once;
- the builder lets anyone move, resize and adjust it without a developer;
- the renderer runs it, and the server checks submissions against the **same** rules.

**The factory never has a database.** Your app stores screen documents and supplies the rows dropdowns read. The factory draws, edits and validates.

**Records live in real tables** — `employees`, one column per field — never in JSON, so `select * from employees` and ordinary reporting just work. **Publishing** a screen creates or changes its table directly: new fields add columns, and a removed field drops its column and data only after you confirm. [`@xeplr/factory`](https://www.npmjs.com/package/@xeplr/factory) is the server package that does it, saves screens (draft / publish) and reads and writes those tables with the screen's own validation. `createFactoryApi({ fetch })` connects the components to it.

## Install

```sh
npm i @xeplr/ui-factory @xeplr/ui-canvas @xeplr/ui-table @tanstack/react-table react-router-dom
```

Peer dependencies: `react ^18 || ^19`, [`@xeplr/ui-canvas`](https://www.npmjs.com/package/@xeplr/ui-canvas) (the canvas the builder places controls on), [`@xeplr/ui-table`](https://www.npmjs.com/package/@xeplr/ui-table) (lists of saved records) and `react-router-dom ^6 || ^7` (imported by [`@xeplr/ui-utils`](https://www.npmjs.com/package/@xeplr/ui-utils)' `useUrlState`, a dependency, for the URL state below; with no router above, everything stays in memory). Your bundler must compile JSX and import CSS from the package (Vite does both).

## The builder

```jsx
import { FactoryBuilder } from '@xeplr/ui-factory'

<div style={{ height: '100vh' }}>
  <FactoryBuilder
    document={screen}                                  // omit to start a new one
    onSave={async (doc) => api.saveScreen(doc)}        // your storage — called when Save is pressed
    listTables={async () => api.listTables()}          // for "Saves to", lists and table dropdowns
    fetchOptions={async ({ table }) => api.options(table)}  // Preview with real options
    fetchRecords={async ({ source }) => api.records(source)} // Preview with real records
  />
</div>
```

- Drag controls from the palette onto the screen, or click one to add it at the bottom.
- Move, resize, align with guides; drag a box to select several; <kbd>Delete</kbd> removes, <kbd>Ctrl/⌘ D</kbd> duplicates.
- Select a control to set its label, field name, placeholder, required, default, validation, and — for a dropdown — where its options come from.
- **Every look is a property:** font, size, weight, italic, alignment, text colour, background, border colour/width, corner radius — and for an input, its label's size, weight and colour.
- With nothing selected, the panel shows the **screen**: the table it saves to, its width, and the font and colours every control inherits.

**Nothing saves itself — here, or anywhere else in this package.** The bar says
*Unsaved changes* and offers **Save**; that is the only thing that writes the
draft, so trying a layout out and walking away leaves the saved screen as it
was. Closing the tab with unsaved work asks first.

It used to save 800ms after every edit, and that was wrong twice over: there
was no such thing as trying something out, and no moment at which anybody said
"this is right" — and a field is invalid *while it is being built*, so the
autosave met half-made work and reported it as an error nobody asked for.
`autosaveDelay` is still accepted and ignored, so a host passing it is not
broken.

**Publish still saves first**, because publishing what is on screen is the one
thing it must never get wrong.
- **No Save button.** Edits are saved (as a draft) a moment after you stop, whenever the screen is valid; problems are marked on the controls that have them until they are fixed.
- **Publish** (when `onPublish` is given) makes the draft the version everyone sees and changes its table to match. If removed fields would drop columns, it asks first — "Publishing removes `phone` — 1,240 saved values" — with **Remove and publish** / **Cancel**. Unsafe changes (narrowing a field) are refused with the reason.
- **`lockedNames`**: fields that are already columns of the table. Their names are read-only, because renaming one would leave its data behind.

## The screen

```jsx
import { FactoryScreen } from '@xeplr/ui-factory'

<FactoryScreen
  document={screen}
  record={employee}                                   // optional: open an existing record
  onSave={async (values, { id, source }) => api.save(source, id, values)}  // returns the saved record, with its id
  fetchRecords={async ({ source }) => api.records(source)}
  fetchRecord={async ({ screen, id }) => api.record(screen, id)}   // optional: Edit loads the record fresh
  onDelete={async ({ id, source }) => api.remove(source, id)}
  fetchOptions={async ({ table }) => api.options(table)}
  uploadFile={async (file, { screen, field }) => api.upload(file, screen, field)}  // a file field: → { path }
  readFile={async (path) => api.fileBlob(path)}       // optional: a stored picture's bytes, for its thumbnail
  screens={{ employee_edit: editScreen }}             // what a list's Edit / New open in a popup
/>
```

**Save is a button and an AJAX call — never a form submit.** Nothing is written while the person types: the footer says "Unsaved changes" until they press **Save**, which makes one call to your `onSave`. There is no `<form>` post and Enter saves nothing. If something is missing, Save marks every field that needs attention instead of sending. The first save of a new record creates it: return the saved record and its `id` makes every later save an update.

- With `onDone` (a page, or the list's popup), the footer has **Cancel** and **Save**. Save saves and then calls `onDone`. Cancel calls `onDone` without saving, asking first if anything is unsaved. Without `onDone` (a form embedded in a page) there is Save alone, and it shows "Saved".
- Leaving with unsaved changes asks first: Cancel, the popup's ×/Escape, a list-on-the-form opening another record, and closing or reloading the tab. **In-app navigation (a side-rail click) is the host router's to guard** — `ctrl.dirty` / `onDirtyChange(dirty)` say when there is something to lose.
- `useFactoryScreen` returns `save()` (the button), `dirty`, `confirmDiscard()` and `flush()` (save only if unsaved — what a flow's Next does). `AUTOSAVE_DELAY` and `autosaveDelay` are gone.

If `onSave` throws an error with `fields: [{ field, message }]` (what `createFactoryApi` does with the server's 422 — a rule, or a hook's `reject`), each message shows on its field until that field is changed.

Values arrive typed: numbers as numbers, checkboxes as booleans, dates as `"YYYY-MM-DD"`, a date and time as `"YYYY-MM-DDTHH:MM"`, a dropdown or radio group as the option's own `id` (a table's numeric id stays a number), a multi-select as an **array** of ids, and a file as the stored file's **path** (a field with `multiple`: an **array** of paths).

### On a phone

Below **640px wide** (the viewport, not the box the screen sits in) a screen stops being a scaled-down canvas and **stacks**: every control takes the full width, one per row, in reading order — top to bottom, left to right across a row, the same order `inputNodes` reads. Nothing to set and nothing to design twice: the positions you placed are simply not used there.

- Controls are drawn at their real size, not shrunk. Inputs are at least **16px** (smaller makes iOS zoom the page when a field is focused) and **44px** tall; tick boxes, radio buttons and Remove are thumb-sized.
- Error messages sit under their field and wrap, rather than being cut off at the screen's edge.
- The footer wraps: what the save is doing on its own line, the buttons under it sharing the width.
- A popup (a list's Edit / New) fills the screen.
- A list keeps its table, which scrolls sideways inside its card; its row buttons stay pinned at the right edge (that part is `@xeplr/ui-table`, 1.1.3 or later).
- An identifier still to be numbered takes no space.

Above 640px nothing changes: a screen is shown at its design width, scaled down only when its box is narrower. A screen in a narrow side panel on a desktop keeps its designed layout. The builder and the flow designer are not for phones and are left as they are.

How: `ScreenSample` hands each control's position to CSS as variables (`--xf-x`, `--xf-y`, `--xf-w`, `--xf-h`) and its reading-order place as `--xf-order`; `factory.css` uses the positions on a desktop and the order on a phone. A design of your own can do the same.

### Where each value is kept

A record is columns in a real table, never JSON — so the two types that are not
one scalar have a rule of their own:

* **Multi-select** — every chosen id in ONE `text` column, joined by commas. An
  option id may therefore not contain a comma; the checker refuses one that
  does. `toDbValue` / `fromDbValue` do the conversion, and both the browser and
  the server use them, so it is written once.
* **File** — the column holds the path the upload answered with, not the file.
  The file itself is stored by `@xeplr/factory` and read back through its
  authenticated route; nothing is ever served without a check. A field with
  `multiple` keeps its paths in one `text` column, joined by commas, like a
  multi-select (a stored path has no comma in it); turning `multiple` on is a
  widening, so a path already saved reads back as a list of one.
* **Date and time** — a `timestamp` column, read back as text so no timezone can
  move the moment. A `date` column may be widened to `timestamp` on publish
  (the day becomes midnight); the reverse is refused, as it would lose the time.

### Front-end hooks

What a screen does in the browser — load, save, delete, extra row buttons — is a class you extend. Every method is the default; override the one you need and call `super`:

```jsx
import { FactoryScreen, FactoryHooks } from '@xeplr/ui-factory'

class TaskHooks extends FactoryHooks {
  async save(values, ctx) {
    const saved = await super.save({ ...values, title: values.title.trim() }, ctx)   // before
    toast('Saved ' + saved.title)                                                   // after
    return saved
  }
  async get(ctx) {
    const rows = await super.get(ctx)
    return ctx.many ? rows.filter((r) => r.status !== 'archived') : rows
  }
  actions(ctx) {
    return [{ label: 'Mark done', onClick: async (record) => { await markDone(record.id); ctx.refresh() } }]
  }
}

const taskHooks = new TaskHooks()
<FactoryScreen document={taskList} {...api} hooks={taskHooks} />
```

| method | default | ctx |
|---|---|---|
| `get(ctx)` | `fetchRecords` for a list, `fetchRecord` for the record Edit opens | `many`, `id`, `screen`, `source` |
| `save(values, ctx)` | `onSave` — when Save is pressed; return the saved record | `id`, `isNew`, `screen`, `source` |
| `delete(record, ctx)` | `onDelete`, after the person confirmed | `id`, `screen`, `source` |
| `actions(ctx)` | `[]` — extra row buttons `{ label, onClick(record, ctx) }` beside Edit / Delete | `screen`, `refresh()` |

Not calling `super` replaces the default. The same hooks run in the popup a list opens (`ctx.screen` says which screen). Methods, not arrow functions — `super` needs them. `xeplr-factory screens` writes this class, every method calling `super`, into the edit page.

Rules that must hold belong in the server's hooks; the browser only shapes what the person sees and sends.

### Lists of saved records

A **List** control shows the records of the table the screen saves to (or another), in `@xeplr/ui-table`, with the columns you tick. Its **Edit in** names the edit screen: **Edit** and **New** open that screen in a popup: its Save saves, closes the popup and refreshes the list; Cancel closes it unsaved.

**Opens in: a page of its own** sends them to a page in your app instead. The factory has no router, so it asks — `onOpenRecord` on the list's screen, and `onDone` on the page, which draws a **Done** button that saves what is pending and calls it:

```jsx
<FactoryScreen document={taskList} {...factory.screenProps}
  onOpenRecord={({ id }) => navigate(id ? `/tasks/${id}` : '/tasks/new')} />

<FactoryScreen document={taskEdit} record={task} {...factory.screenProps}
  onDone={() => navigate('/tasks')} />
``` **Delete** removes a row after a confirmation. Dropdown columns show names, not ids — read from the edit screen's fields.

The edit screen comes from `screens` (`{ id → document }`) or your `loadScreen(id)`. A list on a form with no **Edit in** opens rows in that form's own fields instead.

`@xeplr/ui-table` reads the xeplr theme tokens (`--xeplr-bg-*`, `--xeplr-text-*`, `--xeplr-border-*`) and defaults to a dark look; define them for a light app.

On your server, check the submission against the same rules with [`@xeplr/schema-handler`](https://www.npmjs.com/package/@xeplr/schema-handler):

```js
import { formSchema } from '@xeplr/ui-factory/model'
import schemaHandler from '@xeplr/schema-handler'          // CommonJS: default import in ESM,
                                                          // or require('@xeplr/schema-handler')
const clean = schemaHandler.applySchema(formSchema(screen), req.body)   // throws ValidationError listing each field
```

### Add several at once — `bulkAdd`

A list of a table with `"bulkAdd": true` gets an **Add several** button beside
**New**: its edit screen's fields as a grid, one row per record, saved in one
go — eight holidays, a dozen staff.

```json
{ "type": "list", "props": { "title": "Holidays", "editScreen": "holiday_edit", "bulkAdd": true } }
```

- **The columns are the edit screen's fields**, in reading order, with their
  defaults and their own kind of input. A field that holds more than one value
  — a file, a multi-select, tags — is not a column; the grid says to fill it
  in afterwards with Edit. A sub-table's link is filled in on every row, as New
  fills it.
- **Paste from a spreadsheet** into any cell and the grid fills from there,
  adding rows as needed: a dropdown's cell by the option's name (any case) or
  id, a tick from Yes / 1 / ✓, a date from 2026-08-15, 15/08/2026 (day first)
  or 15 Aug 2026, a number without its commas and ₹.
- **Each row is checked before anything is sent** — the same messages the
  form shows, under the cell — and nothing is saved while one needs fixing.
  Empty rows are left out.
- **Each row is saved as New saves it** (the host's `onSave`), so the server's
  checks (`beforeSave`) apply. Rows that saved leave the grid; a row the server
  refused stays, with its reason. The list refreshes after.
- The page's front-end `save` hook is not run for these rows — put anything
  that must hold in a server function.
- Needs `editScreen` and New among the `actions`; not for rows a function works
  out. In the builder: the list's Actions → **Add several at once**.

## Identifier — the number or code a record is known by

Every record already has a key: 25 characters, made on save, never an
auto-increment and never a sequence. It is unique, stable and completely
unquotable — nobody reads one over the phone.

So **Identifier** is a control, in the palette beside Text. A type rather
than a flag on a text box, because everything about it follows from choosing
it — the column, who fills it in, and whether it is on the form at all:

| How it is made | column | filled by | on the form |
|---|---|---|---|
| **A code** — `CMP-7K3QF9` | `varchar(24) UNIQUE` | the server, on first save | shown, read-only |
| **A number** — 1, 2, 3 | `integer GENERATED BY DEFAULT AS IDENTITY … UNIQUE` | the database, as the row is inserted | not drawn until it exists |

- **A counted number is not on a new form.** It does not exist until the row
  does, so there is nothing to show but an empty box — and an empty box that
  never fills in is a question the form appears to be asking and is not.
- **A code is random, not counted.** A sequential one needs a counter bumped
  in the insert's transaction, or two saves take the same number, and it still
  shows gaps when a save fails after the number is taken. Its alphabet drops
  O, I and S — one of each confusable pair, so 0, 1 and 5 stay usable: the
  point of a code is surviving a phone call.
- **Assigned by the server**, checked for a clash inside the insert's own
  transaction — random is not unique, and a code that was free a moment ago is
  not a promise.
- **Neither ever changes.** Both are left out of an update entirely, not
  cleared: a record whose reference changes is a reference nobody can use.
- **Never demanded.** A rule on an identifier would refuse the very save that
  produces it. A value that arrives with the record — an import carrying real
  numbers — is kept, which is why the identity is `BY DEFAULT` and not
  `ALWAYS`.

`GENERATED BY DEFAULT AS IDENTITY` is built on the **server**: the browser
sends a screen document and never SQL. `tableSchema.js` is part of
`@xeplr/ui-factory/model`, which `@xeplr/factory` imports in Node — sharing
the rules is not shipping SQL to a browser.

## A sub-table: rows that belong to one record

This material's characteristics, this order's lines. Put a **List** on the
form and give it two things:

```
Records from   material_characteristics   [ New table… ]
Belonging to   materialId
```

**It is read through its own form** — the list's `editScreen` — never the
screen it sits on, whose table is another.

**The link is what makes it a sub-table.** Without it, a list of another
table shows every row in the app and **New** saves a row belonging to
nothing. With it:

- the grid shows only rows whose `materialId` is this material — and **none**
  while the record is unsaved, because a record that does not exist yet owns
  nothing, and showing the whole table there is how somebody edits another
  record's lines;
- **New** hands the child screen this material's id, as `params` — the same
  mechanism a flow's Screen step uses — so the field is filled in and hidden,
  and nobody is asked which material they are adding a line to.

**New table…** makes the child there and then — two screens, published, with
the link column on them and declared as an input — and **opens its designer
over the page**, because a sub-table is made for the fields it will hold and
`Name` / `Value` are only a guess at those. Publishing in there sets this
list's columns and closes it; closing without publishing leaves a working
table with the two fields it was made with.

It sets *Records from* and *Belonging to* together, because a table without
its link is a list of everybody's rows and a link without a table is nothing
— neither half is a state worth being able to reach. The table list is
re-fetched at the same time, or the picker would be blank for a table made a
moment ago, and a picker whose value is not among its options shows nothing
at all.

**Its columns follow its table.** A list of another table is described by
that table's rows, not by the screen it sits on — offering the material's
fields for a list of characteristics ticks four columns that are blank in
every row. Changing *Records from* clears the chosen columns and the link,
because a field name from the old table is a header over an empty column, and
leaving it there reads as the designer not having noticed the change.

**A list is not a dropdown.** Its rows are records people create, so there is
no "typed list" alternative the way there is for a dropdown's options. If
what you want is *tags* — several values picked from a fixed set — that is a
**Multi-select** pointing at a master, and the chosen ids live in one column
of the record. Making it a sub-table means a two-table design for what is
really one column.

## A form inside a form

This employee's bank details; this department's contact. Access calls it a
subform. Put a **Form** (palette, Data) on the screen and give it two things:

```
Form        Bank details          ← any published form with fields of its own
Linked by   employeeId            ← the field on THAT form pointing back here
```

```json
{ "id": "n9", "type": "subform", "props": { "title": "Bank details", "screen": "bank_detail_edit", "belongsTo": "employeeId" } }
```

- **It is drawn as itself**, inline — its own fields, its own layout — and its
  records stay in **its own table**. Nothing of it is a column of this one.
- **One record of it per record of this one.** It reads the row whose link
  field equals this record's `id` (the same server filter as a sub-table:
  `belongsTo` + `belongsToId`). A record not saved yet has none, so it opens
  empty. Several records of it is a **List**, not this.
- **One Save.** Its changes are this form's "Unsaved changes". Save checks
  both first — an invalid subform keeps this record from being written too —
  then saves this record (so a new one has an id), then the subform with that
  id in its link field. If the subform fails after this record saved, the
  status says so and names it. A subform nobody touched is not saved: an
  empty row is not worth one.
- **The link field is never shown or asked for** on the subform — it is filled
  in on save. The form must HAVE that field (a dropdown on this form's table,
  usually): one that does not is refused out loud, with what to change, rather
  than saving a record that belongs to nothing.
- **A form cannot contain itself**, and a form shown inside another cannot be
  deleted until it is removed there (`DELETE /factory/screens/:key` says where).

Controller: the embedded screen is a second `useFactoryScreen` with `link`
(the link field's name) and `onReady` (it hands the host `{ validate, dirty,
save, name }`). `FactoryScreen` wires both; a custom design gets `subformFor(node)`,
`registerSubform(id, api)` and `subformDirty(id, dirty)` from the host's controller.

## Events — the app's code, picked by name

A screen says which of the app's functions run around its records, one per
event. The code is registered in the app (with `@xeplr/actions`, `event` set
to one of these); the screen only names it:

```json
"events": { "beforeSave": "checkSalaryBand", "afterSave": "notifyHR" }
```

| event | runs | gets | returns |
|---|---|---|---|
| `beforeLoad` | Before records are read — the list, and one record for Edit | ctx.query (narrow it), ctx.id (one record) or ctx.many (the list), ctx.user, ctx.tenant | nothing, or a new query |
| `beforeSave` | Before a record is written — the screen's rules run on what it returns | ctx.values, ctx.isNew, ctx.previous (on update), ctx.user | the values to save (or nothing to keep them); ctx.reject(message, { field }) refuses |
| `afterSave` | Once the record is saved | ctx.result (the saved row), ctx.isNew, ctx.values | nothing — what it does is the point (an email, another record) |
| `beforeDelete` | Before a record is deleted | ctx.previous (the row), ctx.id | nothing; ctx.reject(message) refuses |
| `onError` | When loading, saving or deleting failed | ctx.error, ctx.op (get, save or delete) | nothing — the error is still the answer; this is for telling someone |

- **This is the only way to attach code to a screen's records.** One function per event, named in the screen — the screen is the one place that says what runs.
- **Every event runs on the server** (`@xeplr/factory` 2+). A rule that runs in the browser is one a person can skip.
- **Checked twice.** Here, that each name could be a function and each event exists. On the server, at publish and when it runs, that the function is registered *for that event* — a missing one refuses with its name (`missingFunctions(doc, registry)`).
- `SCREEN_EVENTS` carries each event's contract (`when`, `gets`, `returns`) — what the designer shows beside each picker.

## Screens and buttons — the rules

These are the rules every app's `CLAUDE.md` points to. They keep a screen
drawable by **anything that reads a document** — the web today, a phone app
next — and they hold whoever does the work.

1. **A screen is a document.** To change a screen, change its document (the
   `.screen.json`, or the builder) and run `npx xeplr-factory validate`. Never
   hand-write a page for something a document can say.
2. **A button is a function and its parameters.** The app registers the
   function once on the server (`@xeplr/actions`, `event: 'button'`, an
   `inputSchema` saying what it takes); the document names it and gives the
   values. Eight status buttons are **one** function with eight `status`
   values — not eight functions, and never code in the document.
3. **Rows that are worked out come from a function too** (`rowsFrom`, event
   `listRows`), and so does a cell's hover box (`details`, event
   `rowDetails`), and an autocomplete's suggestions (`suggestFrom`, event
   `suggest`). Formatting — times in the business zone, money, "2h ago" —
   is the function's: the screen shows the text it wrote.
4. **When the document cannot say it**, say so first — "this needs a new
   control" — and add the control to this package, with its web view now
   and a phone view to follow. Do not build around it.
5. **If a page must be hand-written anyway, it is web only, out loud.** List
   it in the app's `ui/pages.json` under `webOnly` with the reason.
   `npx xeplr-factory pages` (the pre-commit hook) warns about every web-only
   page and every route nobody listed, and the app's menu settings tag the
   item "Web only". It is never refused — only never secret.
6. **Checked on the server.** Publishing refuses a screen whose functions are
   not registered, are registered for something else, or are given parameters
   they do not take — saying which button and why (`functionProblems`).

### A cell that opens something — a column's `action`

In a list of a table, a column may name one of the row's actions: `"edit"`,
or the `id` of one the page's hooks add (`actions(ctx)` →
`{ id, label, onClick }`). Its value then shows as a link running that action
— the order number on a shipping update opens the order:

```json
{ "field": "customOrderId", "label": "Order number", "action": "open-order" }
```

An action the page does not add leaves the value as plain text.

## Buttons — a function and its parameters

A **Buttons** control (palette: Actions → Buttons) is a panel of buttons, each
naming a function of the app and the values it is given:

```json
{ "type": "buttons", "props": { "title": "Status", "buttons": [
  { "id": "packed", "label": "Packed", "action": "setOrderStatus", "params": { "status": "packed" },
    "ask": { "title": "Change status to “Packed”?", "note": "Reason (optional)" },
    "disabledWhen": [{ "field": "customStatus", "op": "eq", "value": "packed" }] },
  { "id": "cod-confirm", "label": "Confirm COD", "action": "confirmCod", "params": { "undo": false },
    "when": [{ "field": "paymentMethod", "op": "eq", "value": "COD" }], "variant": "primary" }
] } }
```

The function, in the app's server code:

```js
actions.register({
  name: 'setOrderStatus', event: 'button',
  description: 'Sets the order status and posts who changed it',
  inputSchema: [
    { name: 'status', type: 'string', required: true, options: [{ value: 'packed', label: 'Packed' }, { value: 'shipped', label: 'Shipped' }] },
    { name: 'note', type: 'string' }
  ],
  execute: async ({ input, system }) => {
    // system: { record, id, user, tenant, knex, db, screen, screenKey, button, reject }
    await system.db('orders').where('id', system.id).update({ customStatus: input.status })
    return { message: 'Order ' + system.record.name + ' is now ' + input.status }
  }
})
```

| key | |
|---|---|
| `id` | what a press names the button by — unique on the screen |
| `label` | the button's text |
| `action` | the registered function (event `button`) |
| `params` | the values it is given — plain values, checked against its `inputSchema` (`options` = the values allowed) at publish |
| `ask` | asked first: `title`, `message`, `note` — the label of a note box, whose text reaches the function as `note` (it must take one) — `fields` (values to type, below) and `file` (photos or documents, below) |
| `when` | shown only when every rule matches the record |
| `disabledWhen` | greyed out when every rule matches |
| `pressedWhen` | drawn as the **current choice** (filled, `aria-pressed`) when every rule matches — the status an order is at. Give it the same rules as `disabledWhen` when choosing it again would change nothing |
| `variant` | `default`, `primary`, `danger` |

Rules are [`@xeplr/rules`](https://www.npmjs.com/package/@xeplr/rules) rules — `{ field, op, value }`, with `eq`, `neq`, `isEmpty`, `contains`, `gt`, … — read from **the record the screen is about**: the `record` handed to `<FactoryScreen>`, with the form's own changes on top.

- **The press runs on the server** (`POST /factory/buttons/:screen/:button`). It reads the button — function and parameters — from the **published** screen, so a request cannot run another function or change the values; it sends the record's id and the note, nothing else.
- **The record decides.** The server reads the record (this company, active rows) and checks `when` / `disabledWhen` again, so a hidden or greyed-out button cannot be pressed by sending the request — "does not apply to this record now" (409) when it changed underneath.
- **What happens next is the host's.** The panel shows the function's `message`; `onButtonDone({ button, result, record })` lets the page reload what it shows. Lists on the same screen reload by themselves.
- **In the builder**, picking a function lists the parameters it takes — a dropdown where it names the values allowed — so nobody types a status by hand. Functions come from `listFunctions` (`createFactoryApi`'s `builderProps` has it).

### A button that opens a screen — `opens`

A record's view (its details, its lists, its buttons) and its form are two
screens. **Edit** on the view opens the form, on this record, in the popup —
nothing runs on the server, so it names a screen instead of a function:

```json
{ "id": "edit", "label": "Edit", "opens": "movement_edit" }
```

- `opens` or `action`, never both; no `params` or `ask`. `when` and the rest apply as to any button.
- Saving in it reads the view again: its details, its lists, and `onButtonDone` for the host.
- A button pressed inside a popup reads the popup's record again, so its own buttons follow (Close → Reopen).

### A button that asks for values — `ask.fields`

Packed asks for the parcel's size, for the courier:

```json
{ "id": "packed", "label": "Packed", "action": "setOrderStatus", "params": { "status": "packed" },
  "ask": { "title": "Change status to “Packed”?", "fields": [
    { "name": "lengthIn", "label": "Length", "type": "number", "unit": "in", "required": true, "min": 0.1, "fill": "parcelLengthIn" },
    { "name": "weightKg", "label": "Weight", "type": "number", "unit": "kg", "required": true, "min": 0.01, "fill": "parcelWeightKg" }
  ] } }
```

| field key | |
|---|---|
| `name` | what the function receives it as — one of its `inputSchema` inputs, never one of the button's `params`, `note` or `files` |
| `label`, `unit` | what the person sees: "Length", "in" |
| `type` | `number` (a number keyboard on a phone; the value arrives as a number), `text`, `date` (a calendar; the value arrives as `"YYYY-MM-DD"`), `choice` (a dropdown of `options`, below), `checkbox` (a tick: the value arrives as `true` or `false`, always; `required` means it must be ticked; the function takes it as a `boolean`) or `checklist` (below) |
| `options` | a `choice`'s list — plain values or `{ "value", "label" }`, in the order shown. The value arrives as a string; one not in the list is refused in the dialog and on the server, and publishing refuses an option the function's input does not list in its own `options` |
| `required`, `min`, `max` | checked in the dialog **and on the server**, by the same `askFieldValues`. For a `date`, `min` / `max` are days or `"today"` — `"max": "today"` for something that has already happened ("today" is the day where the check runs) |
| `fill` | a field of the record the dialog starts from — asked again, it shows what was given last time. A `date` takes the day of a date-and-time |

- The press sends them as `values`; the server checks them against the **published** button and hands them to the function with its `params` — which always win, so a value typed cannot change what the screen says the button does.
- Publishing refuses a field the function does not take, or takes as another type. A required input the button asks for is not "missing" from its `params`.
- In the builder: **Asks for** under the button's Ask first, listing the function's inputs the button does not already give.

#### Several of the same — `rows`

The same few fields once per thing, as many as there are — the packets an
order went out in, each with its size:

```json
{ "name": "parcels", "label": "Packets", "type": "rows", "rowLabel": "Packet", "addLabel": "Add packet",
  "required": true, "min": 1, "max": 10, "startFrom": "orderParcels",
  "fields": [
    { "name": "lengthCm", "label": "Length", "type": "number", "unit": "cm", "required": true, "min": 0.1 },
    { "name": "weightKg", "label": "Weight", "type": "number", "unit": "kg", "required": true, "min": 0.01 } ] }
```

- Each row is "Packet 1", its fields side by side (two to a line on a phone),
  × to remove one; **+ Add packet** under them, up to `max` (at most 50).
- A row's fields are `number` or `text`, checked as those are; a problem names
  its row ("Packet 2: Weight is required"). Rows left wholly blank are dropped.
- The function takes it as an **array** (its inputSchema says `type: "array"`)
  of `{ name: value }`, numbers as numbers.
- **`startFrom`** (optional): a function, event `buttonOptions`, that answers
  the rows to start with for the record pressed on — what was given last time,
  so a correction starts from it. Without it the popup starts with `min` empty
  rows (at least one).

#### Laying the popup out — `wide`, `columns`, `newRow`

Many values to ask for read best as a table. `ask.wide` makes the popup wider;
`ask.columns` (1–4) puts that many fields on each line; a field with
`"newRow": true` starts a new line. An order's costs, two to a line, then each
"other" cost's name beside its amount:

```json
"ask": { "title": "Order costs", "wide": true, "columns": 2, "fields": [
  { "name": "shippingCost", "label": "Shipping", "type": "number", "unit": "₹" },
  { "name": "boxCost", "label": "Box", "type": "number", "unit": "₹" },
  { "name": "other1Name", "label": "Other 1 — what", "type": "text", "newRow": true },
  { "name": "other1Cost", "label": "Other 1 — amount", "type": "number", "unit": "₹" }
] }
```

Without `columns`, fields fill each line as they fit. On a phone, more than
two columns become two.

#### A choice — one of a fixed list

Why an order came back, picked from a dropdown, beside the reason typed:

```json
{ "name": "rtoType", "label": "RTO type", "type": "choice", "required": true, "fill": "rtoType",
  "options": [{ "value": "not_accepted", "label": "Customer did not accept" }, { "value": "broken", "label": "Broken" }, { "value": "other", "label": "Other" }] }
```

Or the list is worked out for the record by a function — the other customers
this one may be merged with — named in `optionsFrom` (event `buttonOptions`,
answering `[{ id, label?, sub? }]` as a checklist's does) instead of `options`:

```json
{ "name": "fromId", "label": "Customer to merge into this one", "type": "choice", "required": true, "optionsFrom": "mergeCandidates" }
```

It starts empty; the server asks the function again on the press and refuses
one it no longer offers.

The function takes it as a string input — give that input the same `options`
and publishing checks the two agree. Asked again, it starts from the record's
`fill` field when that is still one of the options. In the builder, an input
with `options` is offered as a choice.

#### A checklist — entries worked out for the record

`"type": "checklist"` is a tick per entry, and the entries are worked out **for
the record the button is pressed on** by a function of the app — the products
still out on this movement:

```json
{ "id": "receive", "label": "Receive", "action": "receiveMovementItems",
  "ask": { "title": "Products back at the warehouse", "note": "Note (optional)",
           "file": { "label": "Photos", "accept": ".jpg,.jpeg,.png,.webp", "maxSize": 10, "multiple": true, "maxFiles": 10 },
           "fields": [
             { "name": "back", "label": "Came back fine", "type": "checklist", "optionsFrom": "movementItemsOut" },
             { "name": "broken", "label": "Came back broken", "type": "checklist", "optionsFrom": "movementItemsOut" }
           ] } }
```

```js
actions.register({ name: 'movementItemsOut', event: 'buttonOptions',
  // ctx: what a press gets — record, id, user, access, button, db, knex, tenant, reject — and field (the ask field)
  execute: async (ctx) => (await ctx.db('movement_items').where({ movementId: ctx.id, returnStatus: 'out' }))
    .map((i) => ({ id: i.id, label: i.name, sub: '× ' + i.quantity, image: i.productImage })) })

actions.register({ name: 'receiveMovementItems', event: 'button',
  inputSchema: [{ name: 'back', type: 'array' }, { name: 'broken', type: 'array' }, { name: 'note', type: 'string' }, { name: 'files', type: 'array' }],
  execute: async ({ input, system }) => { /* input.back, input.broken: the ids ticked */ } })
```

- The value is the **ids ticked** (an array); the function takes it as an `array` input — publishing refuses one that does not, and an `optionsFrom` nobody registered for `buttonOptions`.
- `required` is at least one ticked; `min` / `max` how many. No `unit`, no `fill`: a checklist starts empty.
- The popup asks `GET /factory/buttons/:screen/:button/options?id=&field=` when it opens (`createFactoryApi(...).buttonOptions`, in `screenProps`). Nothing to tick shows "Nothing to choose".
- **The server asks the function again on the press** and refuses an id it did not offer (400 on that field) — a browser cannot tick a product that is already back.
- At most 200 entries; one without an `id` is dropped; `label` falls back to the id.
- **`"scan": true` ticks by code.** Each entry may carry `codes` (at most 10,
  e.g. `[barcode, sku]`). On a phone a **Scan** button opens the app's camera
  (`host.scanCode`) and ticks the entry with the code read, then opens it again
  for the next — until the person is done, or a code nothing here has (said).
  On a computer a box takes the code a handheld scanner types, with Enter.
  `tickByCode(options, ticked, code)` is the rule both use.
- **A choice its function lists** (`optionsFrom`) takes `"scan": true` too:
  Scan chooses the entry whose `codes` hold the code read (`chooseByCode`) —
  a rack by the label on it.
- **`scanMiss`** (with `scan`, on a checklist, a fed choice or an autocomplete)
  is what a code nothing has says, `{code}` the code: `"Not a rack — {code}
  is a product's barcode. Scan the label on the rack."`

### A button that takes files — `ask.file`

A press can carry photos or documents: the button's `ask` gets a file picker,
with a file field's own rules.

```json
{ "id": "proof", "label": "Delivered", "action": "markDelivered", "params": { "status": "delivered" },
  "ask": { "title": "Proof of delivery", "note": "Note (optional)",
           "file": { "label": "Photos", "accept": ".png,.jpg,.jpeg", "maxSize": 10, "multiple": true, "maxFiles": 5, "source": "any", "required": true } } }
```

```js
actions.register({
  name: 'markDelivered', event: 'button',
  inputSchema: [{ name: 'status', type: 'string', required: true }, { name: 'files', type: 'array' }, { name: 'note', type: 'string' }],
  execute: async ({ input, system }) => {
    // input.files: the stored paths. system.files: [{ path, name, size, fullPath }] — read the bytes from fullPath.
  }
})
```

- **Each file is stored before the press** — `POST /factory/buttons/:screen/:button/files`, checked against `ask.file`'s `accept` and `maxSize` — and the press sends the stored paths as `files`.
- **The server takes only files stored for this button, by this person, in this company** — a path typed by hand, or another button's, is refused. It also checks `required`, `multiple` and `maxFiles` again.
- `accept` is required: the server must have something to check an upload against.
- The function must take `files` (in its `inputSchema`); publishing refuses a button whose function does not. The builder shows the file settings only for a function that does.
- Host: pass `uploadButtonFile` (`createFactoryApi`'s `screenProps` has it).

## Files: gallery, camera, several

A file field — and a button's `ask.file` — says **what** it wants; the device
decides how to get it. The same document works in a desktop browser, a phone
browser, an installed web app and, later, a phone app.

| prop | |
|---|---|
| `accept` | the extensions it takes — the server refuses anything else |
| `maxSize` | megabytes, per file |
| `source` | `any` (default): the device's own picker — on a phone, one menu of **Camera, Photos and Files**. `camera`: the camera opens straight away, for a photo taken now (`capture="environment"`); `accept` must then be images only |
| `multiple` | holds several files — the value is an array of paths |
| `maxFiles` | with `multiple`: at most this many (up to 20) |

- **Pictures show as thumbnails.** An `<img>` cannot send the sign-in token, so a stored picture is read back through `readFile(path) → Blob` and shown from an object URL. `createFactoryApi({ fetch: authFetch, fetchFile: authFetchFile })` (both from `@xeplr/ui-account`) gives `screenProps.readFile`; without it a field shows names only.
- **Several files**: chosen together, they upload one by one and each is added as it lands, so a refusal of the third keeps the first two. Remove takes one away.
- `filePicker(props)` → `{ accept, multiple, capture }` is the one place that turns these props into a picker — a phone app's renderer reads the same.
- iPhone photos are HEIC. iOS hands a photo over as JPEG when the picker does not ask for HEIC, so `.heic` is not in the Images list — not yet checked on a real iPhone.

## A list whose rows a function works out — `rowsFrom`

A list reads one table's records. When the rows are **worked out** — an
order's state from its tasks, "New" for the person looking, an urgency sort —
a registered function answers instead (event `listRows`), with a search box,
filter chips and the count on each:

```json
{ "type": "list", "props": {
  "title": "Orders", "rowsFrom": "orderList", "actions": [], "editScreen": "order_actions", "openIn": "page", "rowOpen": true,
  "search": { "placeholder": "Search order, customer or city" },
  "filters": [{ "key": "all", "label": "All" }, { "key": "packed", "label": "Packed" }],
  "refreshEvery": 60, "highlight": "isNew", "pageSize": 50, "grow": true,
  "columns": [
    { "field": "orderNumber", "label": "Order", "text": "orderLabel", "badges": [{ "field": "isNew", "label": "New" }, { "field": "cancelled", "label": "Cancelled", "tone": "danger" }] },
    { "field": "customerName", "label": "Customer", "sub": "city" },
    { "field": "images", "label": "Items", "display": "images", "more": "moreImages", "sortable": false },
    { "field": "ageMs", "label": "Aging", "text": "agingText" },
    { "field": "lastActivityAt", "label": "Last activity", "text": "lastActivityText", "display": "activity", "details": "orderActivity", "sortable": false }
  ] } }
```

```js
actions.register({ name: 'orderList', event: 'listRows', execute: async (ctx) => {
  // ctx.query = { q, filter, kpi, from, to } — what was typed, the chip (always one of the list's own),
  //   the KPI card clicked (one of the list's own, or ''), and the date range's days ('YYYY-MM-DD', '' = open)
  // ctx.user, ctx.tenant, ctx.db(table), ctx.knex
  return { rows: [...], counts: { all: 41, packed: 6 }, kpis: { ordered: 5, open: 12, delivered: 30, total: 47 } }
} })
actions.register({ name: 'orderActivity', event: 'rowDetails', execute: async (ctx) =>
  // ctx.id — the row; ctx.column
  [{ text: 'Status set to Packed', sub: 'Asha', at: 'Today, 4:00 pm', open: { tab: 'comments' } }]
})
```

| column key | |
|---|---|
| `field` | the value the column **sorts by** (a number, an ISO time) |
| `text` | the field holding what is **shown** — written by the function, in the app's words and time zone. Blank → the value |
| `sub` | a second line, smaller |
| `badges` | `[{ field, label, tone }]` after the text, where `field` is true. Tones: `accent`, `success`, `warning`, `danger`, `muted` |
| `display` | `text` (default), `images` (`[{ src, name }]`, plus `more`: how many others), `activity` (a line with a hover box), `items` (`[{ src, name, detail, qty }]` — each thing with its picture, name, a detail line such as the variant, and how many), `chip` (the text as a rounded pill in the column's `tone`, or the cell's `toneFrom`; a neutral grey one when the value is 0 or empty — counts by stage), `steps` (a journey: `[{ label, at, done, tone? }]` as a stepper — a dot per step, filled with a check when done, joined by a line, the label and its time under it; tone `success` when done unless the step says `danger` (late) or another, `muted` when not; on a narrow screen it scrolls sideways inside its cell) |
| `details` | for `activity`: the function (event `rowDetails`) whose entries the hover box lists; an entry with `open` opens the row at that place (passed to `onOpenRecord` as `params`) |
| `detailsAs` | with `details`: how the hover box draws its entries — `"list"` (default: one under another, `{ text, sub, at, open }`) or `"steps"`: a journey across, joined by a line, as a `steps` column draws it — each entry `{ label, at, sub, done, tone }`; a step not reached says "Not yet" |
| `icon` | an icon before the header's label: `file`, `clock`, `box`, `layers`, `truck`, `check-circle`, `return`, `warehouse`, `x-circle`, `rupee`, `calendar`, `user` |
| `tone` | the column's colour, for `display: "chip"` (and its badges' default): `accent`, `success`, `warning`, `danger`, `muted`, `info`, `violet` |
| `bold` | `true`: the cell's text in bold (a total) |
| `iconFrom` | for `display: "chip"`: the row field naming an icon (from `icon`'s set) drawn in the chip — a status with its picture |
| `toneFrom` | the row field naming this cell's tone — `accent`, `success`, `warning`, `danger` or `muted` (blank: none). The function decides, per row: a step done late is `"danger"` |
| `sortable` | `false` for a column whose header should not sort |

- **The search and the chip live in the URL** under the screen's `urlKey` (`<urlKey>Q`, `<urlKey>Filter`), so a refresh shows the same rows. The search waits for a pause in typing.
- **A dashboard over the rows** — `dateRange` and `kpis`:
  ```json
  "dateRange": { "label": "Placed", "default": "last7", "presets": ["today", "yesterday", "last2", "last3", "last4", "last5", "last7"] },
  "kpis": [{ "key": "ordered", "label": "Not started", "tone": "warning" }, { "key": "open", "label": "Open" },
           { "key": "delivered", "label": "Delivered", "tone": "success" }, { "key": "total", "label": "Total orders", "tone": "muted" }]
  ```
  A From–To range (presets: `today`, `yesterday`, `last2`, `last3`, `last4`, `last5`, `last7`, `last30`, `thisMonth`, `lastMonth`, `all`, or two days typed — "Between…" is always offered). `presets` picks which the picker offers, in that order (left out: all of them); `default` must be one of them, and an old link to one it no longer offers opens the default. The designer's Date range box ticks them and a card per KPI showing the count the function returned in `kpis`. **Clicking a card shows its rows** (`ctx.query.kpi`); clicking it again lets go. The range and the card live in the URL (`<urlKey>Dates` — `last30` or `2026-10-01..2026-10-31` — and `<urlKey>Kpi`), and a preset is turned into days on the day it is asked, so "last 30 days" stays the last 30 days. What a card counts, and which date the range is about, are the function's to decide; every count should be for the range. On a phone the cards are two to a row. Both need `rowsFrom`.
- **Cards instead of a table** — `"layout": "cards"`, for people who look rather than compare (packers on a phone):
  ```json
  { "title": "Ready to pack", "layout": "cards", "rowsFrom": "packingList", "editScreen": "packing_actions", "rowOpen": true,
    "columns": [
      { "field": "orderNumber", "text": "orderLabel", "sub": "customerCity", "badges": [{ "field": "isCod", "label": "COD", "tone": "warning" }] },
      { "field": "items", "label": "Items", "display": "items", "sortable": false },
      { "field": "placedAt", "label": "Placed", "text": "placedText" }] }
  ```
  The **first column is each card's heading** (20px, its `sub` and badges under it); an **`items` column draws each thing's picture large** — square, the card's full width, one card to a row on a phone — with how many, its name and its `detail` in 18px; every other column is a line under its label. The first `pageSize` cards, then **Show more**. A tap on a card opens it, like a row. Needs `rowsFrom`. Example: `examples/packing-board.screen.json`.
- **A screen of buttons in the popup** — a row's `editScreen` may be a screen of buttons (`examples/packing-actions.screen.json`: just Packed, asking the parcel's size). They press on the server as on a page, the list behind refreshes after a press, and the popup's title names the row from its first column (`Pack an order · #GA1025`).
- **`empty`** is what shows when there are no rows (default "Nothing here yet."; a search that finds nothing still says "Nothing matches.").
- **`refreshEvery`** (seconds, 10–3600) asks again — for text that changes with time. **`reloadKey`** on `<FactoryScreen>` reloads every list when it changes (the host heard something happen).
- **`grow`** (a list that is its screen's **one** control) lets the page grow with the rows on a desktop, instead of the list scrolling inside the box it was placed in — a full-page list like Orders. Phones always flow.
- **`rowOpen`** makes a click anywhere on a row open it (the first cell is also a button, for the keyboard); **`highlight`** marks rows whose field is true (tinted, the first cell in the accent — today's row); **`rowMenu`** — `[{ label, action, field? }]` — is the "…" at the end of each row: `open` (the row, as a click on it; needs `rowOpen`), `link` (the URL in `field`, in a new tab), `copy` (the text in `field`); an entry whose field is empty on a row is not offered there. **`run`** is a button on that row's record — `{ "label": "Receive", "action": "run", "id": "receive", "run": "receiveMovementItems", "ask": {…}, "when": [{ "field": "status", "op": "eq", "value": "open" }] }` — checked, published and pressed exactly as a buttons panel's (its `when` against the row, and again on the server against the record; its id unique on the screen); its dialog opens over the list and what it says shows under it. Rows a function works out only (each row's `id` is the record). On a phone, a ⋯ on each card. **`dim`** fades them (cancelled orders: there, but not to be looked at — clearer on hover).
- **On a screen about one record** (the screen has a `source` and a saved record is open), the function is told which: `ctx.record` and `ctx.id` — this order's tasks, as cards (`layout: "cards"`) whose click opens the task's own screen in a popup (`editScreen`). The record is read on the server, this company's and active; an id the caller cannot see is a 404. The list asks again when the record changes. Without a record (a board) there is no `ctx.record`.
- **Rows that are worked out are not a table's records**: no Delete, and Edit / New only with an `editScreen`. **New** (`actions: ["new"]`) shows a + New beside the title; `newScreen` makes it open a different screen from a row's click (rows open the task's view, New opens the task form), and `belongsTo` hands that screen the record the rows belong to — `{ orderId: <this order> }` as its params.
- Routes: `GET /factory/rows/:screen` (`?node=&q=&filter=&kpi=&from=&to=&id=`) and `/factory/rows/:screen/details` (`?node=&column=&id=`) — see `@xeplr/factory`.

## Text with suggestions — `autocomplete`

A text field that suggests as the person types: a product from the shop, a
customer by name. **Whatever is typed is saved** — a suggestion helps, it does
not decide — so the column is text, like `text` (255 unless `maxLength`).

```json
{ "id": "n3", "type": "autocomplete", "props": { "name": "name", "label": "Product", "required": true,
  "placeholder": "Type to search…", "suggestFrom": "productSuggestions", "minChars": 2 } }
```

In an entity spec: `{ "label": "Product", "name": "name", "type": "autocomplete", "suggestFrom": "productSuggestions" }`.

The function is the app's, registered for event **`suggest`** and named in the
screen (publishing refuses one nobody registered, or one written for another
event). After `minChars` letters (default 2) and a pause, it is given
`ctx.query.q` — the text, trimmed, at most 200 characters — and answers:

```js
actions.register({ name: 'productSuggestions', event: 'suggest', execute: async (ctx) =>
  (await shop.searchProducts(ctx.query.q)).map((p) => ({
    value: p.title,                    // what the field is set to
    label: p.title, sub: p.sku,        // the line, and one under it
    image: p.imageUrl,                 // a small picture beside it
    fill: { sku: p.sku, productImage: p.imageUrl }   // other fields on THIS screen, by name
  }))
})
```

- At most 20 are shown; one without a `value` is dropped.
- **Picking one** sets the field to `value`, and each field `fill` names that is
  on the same screen — set as if typed, so it is checked and saved like the rest.
  A name not on the screen is ignored, so one function serves several screens.
- Arrow keys move through them, Enter picks, Escape closes. Nothing matched says
  so, and keeps what was typed.
- Route: `GET /factory/suggest/:screen?node=&q=` (same access as a list's rows)
  — see `@xeplr/factory`. `createFactoryApi(...).suggest({ screen, node, q })`,
  handed to `FactoryScreen` in `screenProps`.
- On a phone the suggestions come under the box; a tap picks one.
- **`"scan": true` — a code picks.** A suggestion may carry `code` (a
  barcode). On a phone a **Scan** button opens the app's camera
  (`host.scanCode`), searches the code as if typed and picks the suggestion
  whose `code` it is — with `multiple`, adds it (or one more of it) and opens
  the camera again for the next. On a computer a handheld scanner types the
  code and Enter: the same match picks. Nothing with that code says so; the
  only suggestion is never picked unless its code matches.

### Several values, as chips — `multiple`

```json
{ "id": "n4", "type": "autocomplete", "props": { "name": "addProducts", "label": "Add products",
  "suggestFrom": "productSuggestions", "multiple": true, "quantity": true, "maxTags": 50, "placeholder": "Type a product…" } }
```

- Each pick — or Enter on what was typed — adds a **chip** (its picture, its
  name, ×) and empties the box for the next. The same value again adds one to
  its quantity. Backspace in an empty box removes the last chip.
- `quantity: true` puts a quantity box on each chip (a whole number from 1).
- **It adds no column.** The value is a list, `[{ value, label, sub?, image?, fill?, qty? }]`
  (`qty` with `quantity`), handed to the screen's events as `ctx.values.addProducts`
  — `beforeSave` and `afterSave` both see it — and never written. What the app
  keeps of it (a row per product in a table of its own) is the app's to do.
  `fill` rides along on the chip; it is not written into other fields.
- After a successful Save the box is empty again: a record opened later shows
  no chips, because none are stored.
- The server checks the list before the events see it — at most `maxTags`
  (default and most 100), each `value` text of at most 255, each `qty` a whole
  number from 1 to 100000, `fill` plain values only — and answers 400 on that
  field otherwise. `required` is at least one chip.
- In an entity spec: `{ "label": "Add products", "name": "addProducts", "type": "autocomplete", "suggestFrom": "productSuggestions", "multiple": true, "quantity": true }`.
  A list generated from the spec leaves it out of its columns.

## Comments and history — `feed`

What was said about a record and what happened to it, in one list: comments as
full rows (round initials, name, badge, when, the text, its file) and the
record's history as quiet one-line rows between them, with a box under the
title to write a comment. Palette: **Data → Comments & history**.

```json
{ "id": "n5", "type": "feed", "props": {
  "title": "Comments", "entriesFrom": "orderFeed", "order": "newest", "eventsSwitch": true, "refreshEvery": 60,
  "compose": { "screen": "order_comment_edit", "linkField": "orderId", "textField": "body",
               "fileField": "attachment", "placeholder": "Write a comment…", "button": "Post" } } }
```

- **It is about one record**: the screen needs a `source`, and the feed shows
  nothing (and takes no comment) until the record is saved.
- **The entries are worked out by a function** of the app, registered for event
  **`feedEntries`** and named in `entriesFrom` (publishing refuses one nobody
  registered, or one written for another event). It is given the record —
  read on the server, this company's and active, so another company's id is a
  404 — as `ctx.record` and `ctx.id`, and returns entries. Everything an entry
  shows is **text the server wrote**, so it reads the same in any renderer:

  ```js
  actions.register({ name: 'orderFeed', event: 'feedEntries', execute: async (ctx) => {
    var comments = await ctx.db('order_comments').where('orderId', ctx.id).orderBy('id', 'desc');
    return comments.map((c) => ({
      id: 'c' + c.id, kind: 'comment', text: c.body,
      author: { name: c.authorName, badge: c.teamName },      // badge optional
      at: formatWhen(c.recordCreatedDate),                    // "Today, 4:00 pm"
      files: c.attachment ? [{ path: c.attachment }] : [],
      sub: c.taskTitle ? 'on task ' + c.taskTitle : undefined  // a quieter line
    })).concat(statusChanges.map((s) => ({ id: 's' + s.id, kind: 'event', text: 'Status → ' + s.label, author: { name: s.by }, at: formatWhen(s.at) })));
  } });
  ```

  Return them in the order they are shown newest-first; `order: "oldest"`
  reverses them and puts the box under the list. An entry with no `id`, a
  repeated `id`, or nothing to show is dropped; at most 500 are kept
  (`entriesOf`).
- **A comment is saved through a form of the app** (`compose.screen`): the feed
  fills in `linkField` with the record's id, `textField` with what was typed
  and, when `fileField` is set and a file was attached, that field with the
  stored file. So the form's rules (required, length, the file's `accept` and
  `maxSize`), its access row and its events — telling everyone in `afterSave`
  — apply exactly as anywhere else. The file is stored when it is chosen, with
  the compose form's own rules. Ctrl/⌘ + Enter posts. Without `compose` the
  feed only reads.
- **A VIEW opened in the popup** — a screen with no fields and no buttons,
  only a record's details and comments (a task's own screen) — is not read
  through a form: its details and feed read the record by id themselves.
- **A comment can become a record of another form** — "Convert to task":
  `"convert": { "screen": "order_task_edit", "linkField": "orderId", "label": "Convert to task", "openScreen": "order_task_view" }`.
  The function decides, per entry: `convert: { name, details, sourceCommentId }`
  — the values that form opens with (field names to plain values only) — on a
  comment that can still be converted, or `converted: { id, text }` — the
  record it became — on one that was. The button opens `convert.screen` in the
  screen's popup with those values and, when `linkField` is given, that field
  set to this record (an entry cannot point it at another; leave it out when
  the new record belongs to nothing — a Tasks-section task made from another's comment); a field whose default is `{params.x}` stays
  hidden as with New. Saving is that form's own save, so **the app's rules
  decide whether the comment may still be converted** (Taskie claims it once,
  in the task's `beforeSave`). Once converted, the comment shows
  "✓ Became …", which opens the record in `openScreen` (just shown without it).
  The feed asks again when the popup closes.
- **`eventsSwitch`** shows a "Comments only" switch when there are events.
  **`refreshEvery`** (seconds, from 10) asks again — for "2h ago". It also asks
  again after a post and whenever `reloadKey` changes.
- **`empty`** is what shows when there is nothing yet (default "Nothing here yet.").
- Route: `GET /factory/feed/:screen?node=&id=` (same access as a list's rows) —
  see `@xeplr/factory`. `createFactoryApi(...).fetchFeed({ screen, node, id })`,
  handed to `FactoryScreen` in `screenProps`.
- The controller part is `useFeeds` inside `useFactoryScreen` — `ctrl.feedFor(node)`
  returns `{ entries, hasEvents, loading, error, waiting, commentsOnly,
  setCommentsOnly, reload, compose: { text, setText, file, upload, removeFile,
  post, posting, error, placeholder, button, fileRules } | null,
  convert: { label, can(entry), start(entry), canOpen(entry), open(entry) } | null }` — so a phone
  renderer draws the same feed from the same calls.

## What is known about a record — `details`

A read-only panel of one record's facts, in sections side by side: an order's
products, its contact and address, its delivery. Palette: **Data → Details**.
The sections are worked out by a function, so they can hold what is **not a
column** — what the shop knows, what the courier said.

```json
{ "id": "n6", "type": "details", "props": { "title": "", "detailsFrom": "orderDetails", "columns": 2, "moreLabel": "More" } }
```

```js
actions.register({ name: 'orderDetails', event: 'recordDetails', execute: async (ctx) => {
  if (ctx.query.more) return { sections: [{ title: 'Payment', rows: await shopPayment(ctx.record) }] };  // asked on "More"
  return { more: true, sections: [
    { title: 'Products', items: ctx.record.lines.map((l) => ({ src: l.image, name: l.title, detail: l.sku, qty: l.qty })) },
    { title: 'Contact', rows: [
      { label: 'Phone', text: ctx.record.phone, href: 'tel:' + ctx.record.phone },
      { label: 'Address', text: ctx.record.address },          // "\n" keeps its lines
      { label: 'Delivery', text: 'Delivered', tone: 'success' } ] } ] };
} });
```

- The screen needs a `source`; the function gets the record — this company's,
  active — as `ctx.record` / `ctx.id`, and `ctx.query.more`.
- **Only what the record has is shown**: a row with no text is dropped, and a
  section left with nothing. A panel with nothing at all draws nothing (or
  `empty`, when set).
- `href` makes the value a link — `http(s)`, `tel:` (a phone dials) or
  `mailto:`; any other link is dropped and the value stays plain text. A
  picture's `src` must be http(s). `tone` is one of the badge tones.
- **"More"** shows when the function answers `more: true`; pressing it asks
  again with `ctx.query.more = true` and draws that answer under the rest.
  Nothing is saved — it is asked again next time.
- `columns` (1–3) sections side by side — packed so a short box never
  leaves a hole, and never more columns than boxes; one under another on a phone.
- Two sections go across the whole width, above the rest:
  `{ kind: 'header', title: '#GA3068', badges: [{ text: 'Ordered', tone: 'accent' }], sub: 'Naresh, Chennai', aside: '₹8,883 · COD' }`
  — the record's own line, big, with coloured pills; and
  `{ kind: 'journey', title?, steps: [{ label, at, sub, done, tone? }] }` — a
  dot per step joined by a line, green up to where the record is (the same
  journey a list column draws with `display: "steps"`).
- On a screen about a record, set the screen's **`layout: "flow"`** (designer:
  screen → Size → Heights) so the panel — and a feed or list under it — is as
  tall as its content rather than the box it was drawn in.
- Route: `GET /factory/details/:screen?node=&id=&more=1` (same access as a
  list's rows). `createFactoryApi(...).fetchDetails`, in `screenProps`.
  Controller: `ctrl.detailsFor(node)` → `{ sections, loading, error, waiting,
  canShowMore, showMore, more, hideMore }`.

## Web-only pages — `ui/pages.json`

Each app keeps an inventory of its pages: drawn from documents, or
hand-written for the browser (and so **not** in a phone app).

```json
{
  "routes": ["src/App.jsx"],
  "documents": [{ "path": "/orders", "menu": "Orders", "screen": "orders_board" }],
  "webOnly": [{ "path": "/home", "menu": "Home", "reason": "The dashboard's cards are hand-written" }]
}
```

```sh
npx xeplr-factory pages ui            # warnings, exit 0
npx xeplr-factory pages ui --strict   # warnings fail
```

It warns about every web-only page (with its reason), every `<Route path>`
in the `routes` files that the inventory does not list, and every listed page
no route declares any more. Redirects and `*` are not pages. Run it from the
app's pre-commit hook; it never blocks a commit. `webOnlyMenus(inventory)`
gives `{ menu key → reason }`, for a menu-settings screen to tag those items
"Web only".

## On a phone — `@xeplr/ui-factory/native`

The same screen documents, drawn with **React Native** components for a phone
app — not a web view. The controllers and the model are the web's own
(`useFactoryScreen`, `buttons.js`, `feed.js`…), so a screen's rules, checks,
lists, buttons, comments and details behave exactly as in a browser; only the
views differ.

```jsx
import { NativeScreen, useScreenDocument } from '@xeplr/ui-factory/native'
import { createFactoryApi } from '@xeplr/ui-factory/model'

const factory = createFactoryApi({ fetch: authFetch, fetchFile: authFetchFile, base: '/api' })
const screen = useScreenDocument(factory.loadScreen, 'orders_board')
<NativeScreen document={screen.doc} {...factory.screenProps} record={record}
              onOpenRecord={({ id }) => router.push(`/orders/${id}`)}
              host={{ pickFile, pickDate, baseUrl }} />
```

- **Every control one under another, in reading order** — what the web does
  below 640px. Lists are a **card per row** (the first column the heading,
  pictures large, every other column a labelled line), with the date range,
  KPI cards, search and chips above. A popup (Edit, New, a task opened from its
  card, Convert to task, a button's question) is a **full-screen sheet**;
  Android's Back closes it.
- **`host`** is what only the app can do: `pickFile({ camera, multiple, accept })
  → [{ uri, name, type, size }]` (expo-image-picker / expo-document-picker),
  `pickDate({ mode, value }) → 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm'` (the phone's
  own picker), `scanCode({ title, note, many }) → the code | null` (the camera
  reading a barcode or QR code — expo-camera; `note` is what the last scan did,
  `many` that another follows; null when the person is done), and `baseUrl`
  for pictures the server names by a path. Without `pickDate` a date is typed;
  without `pickFile` files are shown only; without `scanCode` there is no Scan.
- **Lists** — a table's records or rows a function works out — are cards; a
  table's values read as its web table shows them (a dropdown's name, Yes /
  No, a readable date), and a tap opens the record.
- **Not on the phone yet:** a `table` control and a `subform` say so and point
  to a computer.
- **No URL.** Open steps, a list's search and the open popup are kept in memory.
  `@xeplr/ui-utils`' URL state imports `react-router-dom`, which does not
  compile for Hermes, so the app points it at `@xeplr/ui-factory/native/noRouter`
  — in **metro.config.js**:

  ```js
  const noRouter = require.resolve('@xeplr/ui-factory/native/noRouter')
  config.resolver.resolveRequest = (context, name, platform) =>
    name === 'react-router-dom' ? { type: 'sourceFile', filePath: noRouter } : context.resolveRequest(context, name, platform)
  ```
- **Look:** `<NativeTheme value={palette}>`, else the phone's own setting picks
  (`DARK` by default, `LIGHT`); tones are named as on the web. A full-screen
  sheet keeps clear of the notch with `<NativeInsets value={useSafeAreaInsets()}>`.
  `Btn`, `Field`, `Pill`, `Sheet` and `PickList` are exported, so an app's own
  pages (sign-in, a menu) look the same.
- `react-native` is an **optional peer**: a web-only app installs nothing new.
  `useScreenDocument(loadScreen, key)` is exported from the main entry too.

Taskie's phone app (`taskie/mobile`, Expo) is the worked example.

## The flow designer, as a list — `<FlowDesigner>`

Your screens as a journey: the steps down the left; for the one picked, its
**Form design** (the screen's builder), the **events** the app's functions run
on, and **where it goes next**. The selected step and tab live in the URL
(`<urlKey>Selected`, `<urlKey>Tab`).

```jsx
const factory = createFactoryApi({ fetch: authFetch, base: '/api' })
const flows = createFlowsApi({ fetch: authFetch, base: '/api/workflow' })

<FlowDesigner
  flow={flow} screens={screens} loadScreen={factory.loadScreen}
  onSave={flows.saveFlow} onPublish={flows.publishFlow}
  listFunctions={factory.listFunctions}
  loadDraft={factory.loadDraft} saveDraft={factory.saveDraft} publishScreen={factory.publish}
  builderProps={factory.builderProps}
  urlKey="flow"
/>
```

- **Events are the screen's.** Picking a function saves it to that screen's
  draft; it runs once the screen is **published** (a button on the card), and
  in every journey that shows the screen. Each picker offers only the functions
  the app registered for that event, with what each is handed and returns —
  the code itself is never in the designer.
- **Navigation is the flow's:** go to a screen, **let a function decide** (a
  registered `decide` function, and the steps it may choose), or finish the
  journey. A step whose arrows test its fields shows them, and can be replaced
  with one of the three.
- **Nothing runs in the browser.** Before load, Before save, After save,
  Before delete and On error run on the server; On load / On change / On exit
  are not offered, because nothing would run them.
- Approvals (another person's turn, with an assignee and a timeout) are not
  part of this designer.

An app page needs only its two API clients — the flow and the forms are
loaded for it:

```jsx
<FlowDesignerPage factory={factory} flows={flows} flowKey={key} urlKey="flow" />
```

Controllers, for a design of your own: `useFlowBuilder` (the flow, plus
`navigationOf` / `setNavigation`), `useScreenEvents` (one screen's events,
`adopt` to share its draft with a builder), `useFunctionCatalog` (the app's
functions, `forEvent`). Model: `navigationOf`, `setNavigation`, `arrowTargets`,
`setEvent`, `functionsFor`.

## Filled in from a screen before — `{previous.<screen>.values.<field>}`

In a flow, what one screen saved is handed to the screens after it as plain
JSON, by SCREEN key (the workflow API's `previous` on every run view):

```json
{ "department_edit": { "values": { "id": "dep_42", "name": "Finance" } } }
```

A field fills itself from it with a default of
`{previous.department_edit.values.name}` — or `.id`, the row that screen
saved, to link to it. Pick it in the builder: **Fill in from** on any field
offers this screen's own inputs (`{params.x}`) and every form's fields, so
nothing is typed. Any kind of field may be filled this way, a number or a date
too.

- **No contract.** A screen not on this run's way here, or a field it does not
  have, leaves the field empty — nothing errors. Making the names line up is
  the flow's author's job; declared contracts between steps are the paid
  workflow's.
- **By screen, not by step**, because the binding lives on the screen, and a
  screen is the same form in every flow. A screen shown twice hands over its
  latest.
- `FlowRunner` passes the run's `previous` to the screen; with your own design,
  hand it to `useFactoryScreen({ previous })`. Model: `previousBinding`,
  `resolveBinding(value, params, previous)`, `initialValues(doc, params,
  controls, previous)`.

## Masters — the lists the rest of the app points at

Departments, statuses, countries, categories. Mark a form as a master in its
design (select nothing on the canvas → **This is a master**), and say what a
picker should show for one of its records:

```js
{ master: true, labelField: 'name' }     // on the form's own document
```

**Made, not designed.** Every application repeats the same three things —
a name, an order of its own, and the master it belongs to — so a master is
created outright rather than drawn:

```js
import { createMaster } from '@xeplr/ui-factory'

await createMaster(factory, { name: 'States', parent: { table: 'countries', label: 'Country' } })
// → states_edit + states_list, marked as a master, published
```

- **Name** is required: a master row with no name is a blank line in every
  dropdown that points at it.
- **Sort order** is not: Low / Medium / High is never alphabetical, but most
  lists are fine, and a number somebody must invent for every row is a tax on
  adding one.
- **Belongs to** is a dropdown on the parent master, required when there is
  one — a state in no country is a row nothing can use. A master is never
  offered as its own parent.

It is **published** on creation, which is the one place doing that on
somebody's behalf is right: a master that is a draft has no table, so nothing
can point at it and nobody can add a row, which is all a master is for.

Named in the plural, stored in the singular: *Departments* makes the entity
`department` and the table `departments`. Without that step `entityNames`
would make `departmentses`, which is noticed only once the table exists and
then cannot be renamed.

**A flag on a form, not a kind of form.** A master has a table, a list, an
edit screen and permissions like anything else; a separate type would be two
things that behave the same until they do not, and every feature after it
would have to ask which one it is holding. The flag adds a fact; a type adds
a fork.

`labelField` is said once, here, rather than on every dropdown that points at
this form — thirty dropdowns should not each be told that a department is
shown by its name.

`useScreenSource` returns `masters` alongside `screens`: one entry per FORM
(`{ key, name, labelField, edit, list, source }`), gathered by `masterForms`,
so an app's admin section renders a list and groups nothing itself. That is
what `@xeplr/cli` generates as Configure UI → **Masters**.

They are gathered in the admin section rather than scattered through the side
rail because that is what they are — reference data somebody maintains
occasionally. The rail stays for the work.

**And they are what a dropdown offers first.** A field's *where its options
come from* now reads:

```
Masters        Departments, Statuses, Countries      ← named, first
Other tables   complaints, employees, pod_items      ← still there, below
```

`/factory/tables` marks and names them (`@xeplr/factory`'s
`tablesForPicker`), so the picker groups rather than guesses. Two `<optgroup>`s
in a plain `<select>`, not a combobox: typing jumps to an option in every
browser, which is the searching anybody wants here, and a widget of our own
would have to reimplement the keyboard to match.

## Your screens, inside someone else's designer

`@xeplr/ui-workflow`'s flow designer has a **Screen** step, and it asks its
host two things: which screens exist and what each one hands back, and how to
design one without leaving the flow. It cannot answer either itself — it
carries a screen key and knows nothing else about forms, on purpose, so an app
with a different screen system is not locked out.

This package answers both, in one hook:

```jsx
import { useScreenSource, FactoryBuilder } from '@xeplr/ui-factory'

const { screens, screenEditor } = useScreenSource(factory, { Builder: FactoryBuilder })
<WorkflowDesigner screens={screens} screenEditor={screenEditor} … />
```

- **`screens`** is `[{ key, name, fields }]`. `fields` comes from
  `inputNodes(doc)` — this package's own answer to "which nodes hold a value"
  — so a label or a stepper is never offered as a field, and a control type
  added here reaches every app without one of them being edited. Names arrive
  first and fields follow, so the menu is usable while documents load; a
  document that will not load leaves its screen choosable without fields.
- **`screenEditor`** is the body of the designer's modal: the builder, on the
  form that step shows, or on a new one it makes (`screenKey: null` → name it
  → `createEntity`). **Publishing** is what fires `onDone({ key, name, fields })`,
  because a draft changes nothing anybody can run — and that is what tells the
  flow the form's new shape, so a field added there appears in every step that
  shows that form.

**Why this is a package and not four lines in your app.** It used to be the
latter, and that is a bug: an app is generated once and then lives its own
life, so glue copied into it can never be fixed centrally. An app scaffolded
last month would keep the old version forever, and a control added here would
never reach it. Anything every app would write identically belongs on this
side of the line — `@xeplr/cli`'s generated `FlowDesigner.jsx` is two props,
and its test suite fails if the glue reappears in the app.

The pure half is `screenSource.js` — `describeScreen`, `loadScreens`,
`keyFromName`, `editScreenOf` — testable with no React and no server.

## Flows — screens, one after another

A screen is a form; a **flow** is the journey across several of them. Design it
the same way you design a form — screens on a canvas, arrows between them:

```jsx
import { FlowBuilder, FlowRunner, createFlowsApi } from '@xeplr/ui-factory'
const flows = createFlowsApi({ fetch: authFetch, base: '/api' })

<FlowBuilder {...flows.builderProps} flow={flow} screens={published} loadScreen={factory.loadScreen} />
<FlowRunner  {...flows.runnerProps} {...factory.screenProps} flowKey="employee_registration" runId={runId} />
```

An arrow is a question asked once its screen is filled in — the first one that
fits wins, and the one with no test ("otherwise") catches the rest:

```json
{ "stepKey": "details", "screen": "employee_edit",
  "transitions": [
    { "when": { "field": "type", "op": "=", "value": "contractor" }, "target": "contract" },
    { "when": null, "target": "payroll" }
  ] }
```

**The browser does not run the journey.** `createFlowsApi` talks to a service
that does — Xeplr Workflow — so a run remembers where it got to: a journey can
be left and picked up later, by someone else, on another day. Without such a
service there are no flows; the factory has no engine of its own, on purpose.

**Each screen still saves into its own table** — the flow's **Next** saves what is unsaved (one AJAX call) and then moves on. What travels with the
run is only what the arrows need and the id of the row that was written
(`recordId`), so the data is exactly where it would be without a flow.

`validateFlow(flow, { screens })` is the same check on both sides: a screen
that exists, arrows that point somewhere, one "otherwise" at the end, and
nothing unreachable.

### A review screen inside a workflow

A screen can also be one step of an ordinary Xeplr Workflow: the run parks on it until a person answers. The workflow step says what it is handed, who answers it and with which buttons:

```json
{ "actionName": "screen-show", "kind": "wait",
  "values": { "screen": "unmatched_review", "values": { "lines": "{steps.match.output.rows}" },
              "assignTo": "Accounts", "buttons": [{ "key": "approve", "label": "Approve" }, { "key": "send_back", "label": "Send back" }] } }
```

- **A `table` shows what it was handed** (`rows: '{params.lines}'`, a screen input), with a tick per row; the ticked rows are the field's value (`selected`).
- **The step's buttons replace Next** in `FlowRunner` (the first is the main one). The one pressed is sent as `action` and becomes the step's `output.action`, so its arrows branch on it.
- **A screen with no table of its own saves nothing**: a button goes straight to the run.
- `createFlowsApi(...).waiting()` lists every screen waiting for one of the signed-in person's roles (`GET /flows/waiting`).

### A flow and a stepper

Both walk someone through something, and they answer different questions:

| | stepper | flow |
|---|---|---|
| where | steps of ONE screen | several screens |
| when | one sitting | over days, if need be |
| who | one person | can change hands |
| decides | a `step` hook, in the browser | the engine, on the server |
| needs | nothing | a workflow service |

## Controls

| type | value | validation |
|---|---|---|
| `text` | string | `minLength`, `maxLength`, `pattern`, `patternMessage` — and `inputType` (`text`, `email`, `tel`, `url`): the phone keyboard and autofill |
| `textarea` | string | `minLength`, `maxLength` |
| `autocomplete` | string — whatever is typed; with `multiple`, a list of chips and **no column** | `minLength`, `maxLength`; `suggestFrom` (event `suggest`), `minChars`; `multiple`, `quantity`, `maxTags`, `scan` — see [Text with suggestions](#text-with-suggestions--autocomplete) |
| `number` | number | `min`, `max`, `integer` |
| `date` | `"YYYY-MM-DD"` | `min`, `max`, `notFuture` (on or before today, whenever it is filled in) |
| `datetime` | `"YYYY-MM-DDTHH:MM"` | `min`, `max` |
| `checkbox` | boolean | `required` = must be ticked |
| `dropdown` | option id | — |
| `radio` | option id | — |
| `multiselect` | array of option ids | `minItems`, `maxItems` |
| `file` | the stored file's path — or, with `multiple`, an array of them | `accept` (extensions), `maxSize` (MB), `multiple`, `maxFiles`, `source` (`any` / `camera`); see [Files: gallery, camera, several](#files-gallery-camera-several) |
| `stepper` | — | a journey across the top; every other control says which step it is on — or, with `display: "tabs"`, a row of tabs with no Back / Next |
| `label` | — | text with a heading, subheading or text preset |
| `list` | — | saved records, with New / Edit / Delete — or rows a function works out (`rowsFrom`), with search, filter chips and counts; see above |
| `buttons` | — | a panel of buttons, each a registered function and its parameters — see above (palette: **Actions → Buttons**) |
| `details` | — | read-only sections about the record from a function (`detailsFrom`, event `recordDetails`), with an optional "More" — see [What is known about a record](#what-is-known-about-a-record--details) |
| `feed` | — | a record's comments and history from a function (`entriesFrom`, event `feedEntries`), with a box that saves a comment through another form (`compose`) — see [Comments and history](#comments-and-history--feed) |
| `table` | array of the rows ticked | `minItems`, `maxItems`; `required` = at least one. Rows the screen is **handed** (`rows: '{params.lines}'`), not a table it reads; `columns` (`ref, amount`) or every key of the first row; `selectable` (a tick per row, on by default). Adds no column — see below |
| `subform` | — | another form drawn inside this one (palette: **Form**), saving into its own table — see below |

A screen is a **sheet**, centred in the space it is given and shown at its
design width: an elevated card in the app's theme (`--xeplr-bg-tertiary`, with
`--xeplr-border-primary` round it) — white in a light app, the lighter grey in
a dark one, with inputs in the theme's input colours. A screen whose style sets
its own `color` / `background` keeps them everywhere, input boxes included, so
dark ink on paper is never shown on a dark theme's input. Set
`--xeplr-factory-paper` on the host to change every sheet. A screen with no
fields (only lists) draws **no** sheet — the list is its own card.

Under the fields sits **one footer**, inset to line up with them: Back and
Next, then "Step 2 of 3" with the save status under it ("Unsaved changes",
"Saved"), then Cancel and Save. A screen without steps has the status, Cancel
and Save alone.

A **list** is a single card, as tall as its rows: the title and + New sit in
the table's own toolbar, paging appears only when there is more than one page,
and "Nothing saved yet." shows under the title when there are no rows.

### Ready-made fields

Twelve fields nobody should have to design twice, in the builder's palette under
**Common fields**: Email, Phone, LinkedIn profile, Website, Age, Date of birth,
Gender (Male, Female, Others), Country, Amount, Percentage, Yes / No, Postal code.

| field | made of | what it sets |
|---|---|---|
| Email / Phone / Website / LinkedIn profile | `text` | `inputType` (email, tel, url keyboards), a `pattern` with a plain-English message, a placeholder, a `maxLength` |
| Postal code | `text` | letters, digits, spaces and `-`, up to 10 |
| Age | `number` | a whole number, 0–130 |
| Amount / Percentage | `number` | 0 or more / 0–100 |
| Date of birth | `date` | `notFuture` |
| Gender / Yes / No | `radio`, side by side | its options |
| Country | `dropdown` | every country — stored as its ISO code (`IN`), shown by name |

A ready-made field is **not a new control**: its settings are copied into an
ordinary one, where they stay editable, and `props.preset` remembers where it
came from. Changing the catalogue never changes a form already made with it.
The rules are the field's own, so the server enforces them like any others.

**Any field can change kind at any time** — the panel's **Field type**, at the
top, lists the controls and the ready-made fields. The label, name, position,
step and required are kept; whatever does not carry over is said ("Not carried
over: the pattern"). A name that is already a column is never changed.

**Forgot?** A plain field whose label reads like a ready-made one ("LinkedIn
URL" as a text box) gets an offer in its panel — **Make it LinkedIn profile** /
**Keep as is** — and the builder's bar counts them ("1 suggestion"). They never
stop a save or a publish; **Keep as is** sets `preset: false` and stops asking.

**When the column has to follow.** A change of kind that stays text (text →
LinkedIn) publishes as usual. One that changes the column's kind (text → Age,
a number) is a **conversion**: publishing first checks every saved value, across
every company. If any will not fit, nothing changes and the publish says which
("`age` has 1 saved value that cannot become integer ("forty")"). If all fit,
it asks — **Convert and publish** — and then converts, blanks becoming empty.
A timestamp → date, or a dropdown moved to another table, is still refused.

In code: `FIELD_PRESETS`, `presetFor`, `presetProps`, `suggestPreset(label)`,
`presetHints(doc)`, `convertField(doc, id, target, controls, { lockedNames })`,
and `conversionFor(table, from, to)` / `planTableChange(…, { confirmConvert })`.
The builder hook adds `convertControl(id, target)` and `hints`; `publish(confirmDrop,
confirmConvert)`.

Every control also takes `style` — see [AUTHORING.md](./AUTHORING.md#styles) for the keys. Sizes are pixels at the screen's design `width` (default 800): a screen is shown at that size, never stretched, and scaled down only on a narrower display.

### Steps

A **stepper** turns one screen into several: a bar of steps across the top, and
one step's controls showing at a time. Type the steps as one line — `Connect,
Transform, Review` — and **click a step on the canvas to build it**: what you
drop while it is open belongs to it, and the canvas shows only that step. A
control can be put on *every* step instead (a heading, a list), which is what
one with no step means.

```json
{ "id": "n7", "type": "stepper", "props": { "steps": [{ "key": "connect", "label": "Connect" }, { "key": "review", "label": "Review" }] } }
{ "id": "n8", "type": "text", "step": { "of": "n7", "index": 0 }, "props": { "name": "host", "label": "Host" } }
```

`step` sits on the **node**, beside `x`/`y`/`w`/`h` — not in `props`. The
document stays flat, so a control is still moved, styled, checked and saved
exactly as before; the step only decides when it is on screen. Renaming a step
keeps its `key`, so the controls on it stay where they are.

A stepper also gives the front-end hooks a **`step`** method, run before every
move — Next, Back and a click on the bar alike, so a rule cannot be walked
around by clicking ahead:

```js
class TaskHooks extends FactoryHooks {
  step(ctx) {                       // { from, to, direction, values, screen }
    if (ctx.direction === 'next' && ctx.from === 0 && !ctx.values.title) return false
    return super.step(ctx)          // false stays, a number goes there instead
  }
}
```

A screen with branches can **rule steps out** from the same hook — they stay on
the bar, struck through, and Next and Back pass over them:

```js
step(ctx) {
  if (ctx.from === 0 && ctx.values.kind === 'simple') {
    ctx.disable(['pricing', 'approval'])   // by key, label or number
    return 'summary'                        // and go straight there
  }
  ctx.enable()                              // every step applies again
  return super.step(ctx)
}
```

`ctx.go`, `ctx.disable` and `ctx.enable` act on that stepper; `ctx.steps` is the
same for a screen with more than one (`ctx.steps.disable('approval', stepperId)`).
`ctx.steps` is on `save` and `get` too, since a save is usually where an app
learns which branch it is on. "Step 2 of 4" counts only the steps that apply.

**A step is not a separate form.** Every field is a column, is checked, and is
saved, whichever step is showing — Save can be pressed on any step. **Next** holds at a step whose own fields are not filled in, and says which,
rather than moving on and leaving a problem behind where nobody is looking.

#### A hidden field — `hidden: true`

Any input can be **hidden**: still a column, still saved, never drawn — a
value the server fills in itself (done by, added by). A field filled in by
whoever opened the screen — its default is `{params.x}` and `x` was given,
like the order a new task belongs to — is not drawn either. A hidden field
nobody can fill in cannot be `required`. Designer: the field's **Hidden** switch.

#### A screen that flows — `layout: "flow"`

By default every control is the size it was drawn on the canvas. With
`layout: "flow"` on the screen they go one under another in reading order,
**each as tall as its content** (across, each keeps where it was placed) —
what a phone does anyway. For a record's screen, whose details, comments and
lists vary in length. Designer: the screen's **Size → Heights**.

#### Tabs — `display: "tabs"`

The same stepper, drawn as a **row of tabs**: any tab opens with a click (or
the arrow keys along the row), there is no Back / Next and no "Step 2 of 3",
and the screen keeps its ordinary footer. Controls belong to a tab exactly as
to a step (`step` on the node; none means every tab), the open tab lives in the
URL with `urlKey` like a step, and the `step` hook still runs on every click —
so a tab can be ruled out (`ctx.disable`) or refused. In the designer: the
stepper's **Shown as → Tabs**. In a spec: `{ "type": "stepper", "steps": ["Comments", "Tasks"], "display": "tabs" }`.
On a phone the row scrolls sideways rather than wrapping.

### Options: dropdown, radio group, multi-select

All three **save an `id` and show a `name`**, from either source:

```json
{ "source": "static", "options": [{ "id": "ft", "name": "Full time" }, { "id": "pt", "name": "Part time" }] }
{ "source": "table",  "table": "departments" }
```

For a table, your `fetchOptions({ table })` returns `[{ id, name }]` — in SQL terms, `select id, name from departments`. The factory never builds or runs a query.

## Drafting screens with Claude

A screen can start from a **spec** — what is on it, in order — instead of coordinates:

```js
import { screenFromSpec } from '@xeplr/ui-factory/model'

const screen = screenFromSpec({
  name: 'New employee',
  fields: [
    { label: 'First name', required: true },
    { label: 'Last name', required: true },
    { label: 'Department', type: 'dropdown', table: 'departments', required: true },
    { label: 'Employment type', type: 'dropdown', options: ['Full time', 'Part time'] },
    { label: 'Start date', type: 'date' }
  ],
  source: 'employees',
  list: true
})
```

It lays the fields out as a tidy one- or two-column form and returns a checked document. The same is available on the command line:

```sh
npx xeplr-factory screens entity.json -o dir   # an entity → list + edit screens, pages, server functions + model  (--no-pages, --force)
npx xeplr-factory migration edit.screen.json   # preview the SQL Publish would run
npx xeplr-factory generate spec.json -o screen.json   # one screen from a spec
npx xeplr-factory validate screen.json      # every problem, with its path
npx xeplr-factory controls                   # controls, props and rules
```

[AUTHORING.md](./AUTHORING.md) is the full guide for writing screens: the spec, every control and rule, and how to choose between them.

## The document

```json
{
  "kind": "xeplr-screen", "version": 1,
  "id": "new_employee", "name": "New employee",
  "source": "employees",
  "units": "fraction", "aspect": 1, "width": 800,
  "nodes": [
    { "id": "firstName", "type": "text", "x": 0.04, "y": 0.15, "w": 0.4475, "h": 0.08, "z": 2,
      "props": { "label": "First name", "name": "firstName", "required": true, "validation": { "maxLength": 80 } } }
  ]
}
```

Layout is **proportional**, like `@xeplr/ui-canvas` dashboards: `x` and `w` are fractions of the width, `y` and `h` fractions of a page (`width × aspect`). The screen is shown at its design `width`; on a narrower display everything — positions and text — scales down together.

## Where you are lives in the URL: `urlKey`

The control whose properties are open, the step a stepper is open at, and the flow step being edited are places a person navigates to. Give a controller (or its ready-made page) a `urlKey` and they are written to the URL's query, so a refresh or a shared link lands on them again:

| controller / page | key | holds | history |
|---|---|---|---|
| `useFactoryBuilder` / `<FactoryBuilder>` | `<urlKey>Selected` | the id of the one selected control | opening or closing its properties adds an entry (Back closes them); moving to another control replaces it |
| `useFactoryBuilder` / `<FactoryBuilder>` | `<urlKey>Steps` | the step each stepper is open at: `stepperId:index`, comma-separated, step 0 left out | replaces |
| `useFactoryScreen` / `<FactoryScreen>`, `<FlowRunner>` | `<urlKey>Steps` | as above | replaces |
| `useFactoryScreen` / `<FactoryScreen>` | `<urlKey>Open` | the record open in the screen's popup: `screen:id` (both URI-encoded) — a task opened from its card, the task a comment became. Only a screen this document opens records in (a list's `editScreen` / `newScreen`, a feed's `convert.openScreen`) is honoured; a NEW record's form is not a place | opening adds an entry (Back closes it); a link or a refresh opens it |
| `useFlowBuilder` / `<FlowBuilder>` | `<urlKey>Selected` | the key of the selected flow step | as for a control |
| `useFactoryScreen` / `<FactoryScreen>` | `<urlKey>Q`, `<urlKey>Filter` | a function-fed list's search and chip (the first chip is left out) | replaces |

```jsx
<FactoryBuilder urlKey="form" document={doc} onSave={save} />    // ?formSelected=email&formSteps=stepper:1
```

- **The key is the host's, never a default.** A builder, its Preview and a list's Edit popup can share a page, and the host has keys of its own, so nothing is written to the URL without a `urlKey` — give each its own. **Without one the state stays in memory**, as before. The Preview and the Edit popup are never given one.
- **A multi-selection is not a place.** Several controls selected is a working set for Delete and Duplicate, not somewhere a person goes, so it stays in memory and the URL then names nothing. Only a single selection — the one whose properties are open — is in the URL.
- **Ids, found again.** The selected control is looked up in the document; one that is not there selects nothing. A document handed in after mounting keeps the URL's control, so a host that loads the screen late still lands on it. A step past the last is pulled back to the last, and steppers not in the document (a screen still loading) are left alone.
- The rule is in `src/urlState.js` (`factoryUrlKeys`, `encodeSteps`, `decodeSteps`, `replacesHistory`, `selectionPlace`); the hooks that keep it are `src/useUrlPlaces.js`.

## Three ways to use it

1. **Ready-made** — `<FactoryBuilder>` and `<FactoryScreen>`.
2. **Your own design** — `useFactoryBuilder` / `useFactoryScreen` hold all the state and actions; draw them however you like.
3. **Model only** — `@xeplr/ui-factory/model` has no React: `screenFromSpec`, `validateDocument`, `formSchema`, `validateValues`, and the document operations (`addControl`, `moveNode`, `setNodeProperty`, …).

## Theming

Styles are namespaced `.xeplr-factory-*` and read `@xeplr/ui-account`'s theme variables (theme.css), each with a light fallback: `--xeplr-accent`, `--xeplr-accent-text`, `--xeplr-text-primary`, `--xeplr-text-secondary`, `--xeplr-border-primary`, `--xeplr-bg-primary` (the builder's plane), `--xeplr-bg-tertiary` (sheets, panels, popups), `--xeplr-bg-hover`, `--xeplr-bg-overlay`, `--xeplr-input-bg`, `--xeplr-input-border`, `--xeplr-success`, `--xeplr-warning`, `--xeplr-danger`. The screen, builder and popup follow the app's light or dark theme with the @xeplr/ui-table inside them — never a white sheet in a dark app.

Every dropdown the factory draws — on a screen, in the builder's panels, in the flow designer — has the factory's own ∨ arrow, set in from the right edge with room kept for it, in `--xeplr-text-secondary`. It is styled here, inside the factory's own containers, so an app gets it without adding CSS of its own. A dropdown's **Background** is applied as a background colour, so it never removes the arrow.

Buttons, steps and list actions all show hover, a visible press, and a keyboard-only focus ring.

## Try it

```sh
npm install
npm run dev     # http://localhost:19006 — Screen · List / Edit / Orders and Designer · List / Edit / Orders / Buttons, records kept in localStorage
```

## Files

```
src/
  controls.js            ─ the control registry: palette, property panel contract, rules
  document.js            ─ create and edit screen documents
  validateDocument.js    ─ the document checker
  values.js              ─ values, validation, whether Save can go out, records and list columns, formSchema
  generate.js            ─ screenFromSpec, screensFromSpec (list + edit), entity names
  scaffold.js            ─ an entity → its screen JSON, .jsx pages (with front-end hooks), server functions + model stubs
  hooks.js               ─ FactoryHooks: get / save / delete / actions — extend and call super
  presets.js             ─ ready-made fields (Email, Age, Gender…), changing a field's kind, label suggestions
  tableSchema.js         ─ a form → its table; the publish plan (create / add / widen / confirmed drops and conversions)
  remote.js              ─ createFactoryApi({ fetch, fetchFile }): the calls to @xeplr/factory's routes — fetch may be window.fetch or @xeplr/ui-account's authFetch (which returns parsed bodies); includes createEntity({ key, label })
  screenSource.js        ─ this app's screens as another designer wants them: describeScreen, loadScreens, keyFromName, editScreenOf (React-free)
  model.js               ─ everything above, React-free
  useFactoryBuilder.js   ─ builder controller
  useFactoryScreen.js    ─ screen controller
  useFlowBuilder.js      ─ flow designer controller
  buttons.js             ─ buttons and function-fed lists: conditions, what a press sends, asked values (askFieldValues), functionProblems' checks (React-free)
  listRange.js           ─ a list's date range: presets → days (resolveRange) (React-free)
  details.js             ─ a record's details: detailsOf, safeHref (React-free)
  useRecordDetails.js    ─ the details panels on a screen, and their "More" (inside useFactoryScreen)
  tones.js               ─ the badge tones every rule file may name
  feed.js                ─ a record's feed: entriesOf, composeValues, convertParams, the compose/convert checks (React-free)
  useFeeds.js            ─ the feeds on a screen: entries, "Comments only", posting (inside useFactoryScreen)
  pagesInventory.js      ─ ui/pages.json: routesIn, pageWarnings, webOnlyMenus (React-free)
  urlState.js            ─ the URL keys and values for selection and steps (React-free)
  useUrlPlaces.js        ─ useUrlSteps, useUrlSelection: those places, in the URL or in memory
  useScreenSource.js     ─ { screens, screenEditor } for @xeplr/ui-workflow's Screen step
  useFilePreview.js      ─ a stored picture as an object URL, through readFile
  native/                ─ the phone's views (React Native): NativeScreen, NativeList, NativeButtons, NativeDetails, NativeFeed, inputs, parts, theme, noRouter
  useScreenDocument.js   ─ a published screen, loaded once per visit, for a page that is one screen
  designs/               ─ BuilderSample, ScreenSample, ScreenEditorSample, ControlView, ListView, FedList, ButtonsView, FeedView, DetailsView, FileField, Palette, PropertyPanel, styles.js, factory.css
  pages.jsx              ─ FactoryBuilder, FactoryScreen
bin/xeplr-factory.js     ─ screens / generate / validate / controls / schema / pages
examples/                ─ employee.entity.json and what `screens` makes of it; orders-board and order-actions (a function-fed list, buttons — one takes photos); delivery-photos (several pictures, camera only)
dev/                     ─ the stand-in app for `npm run dev` (not published)
```

## Tests

```sh
npm test
```

`test/buttons.test.js` covers buttons and function-fed lists in the document: what the checker refuses, when a button shows or is greyed out, what a press sends (the document's parameters, never the request's), and `functionProblems` against a registry. `test/cli.test.js` includes `pages`. `test/dashboard.test.js` covers a list's date range and KPI cards, and a button that asks for values. `test/details.test.js` covers a details panel: what the checker refuses and what an answer becomes (links, tones, empty rows). `test/tabs.test.js` covers a stepper shown as tabs. `test/feed.test.js` covers a feed: what the checker refuses, what a function's answer becomes, and what posting a comment saves. `test/askrows.test.js` covers a button's rows question. `test/files.test.js` covers files: several in one field (the value, its column, its checks), camera only, and a button whose press takes files.

`test/native.test.js` covers the phone's views: nothing of the web's (designs, CSS, react-dom, ui-table) is reached from `@xeplr/ui-factory/native`, the router stand-in answers "no router", and the controller calls no browser-only function without one. Drawing them is checked in an Expo app.

`test/urlState.test.js` covers the URL state: the key format, and the three controllers reading their places back from a real `MemoryRouter` and being clicked through in memory, rendered with `react-dom/server`.

```sh
npx playwright install chromium-headless-shell   # once
npm run test:phone
```

`test/phone.check.js` opens the dev app (`dev/`) in a real browser at 360, 390 and 430px wide and holds every screen to the phone rules: the page never scrolls sideways; fields are one per row, full width, in reading order, none overlapping; inputs are 16px or larger and 44px tall; the footer's buttons are 44px and on screen; a list's row buttons are on screen without scrolling the table; a popup fills the screen. At 1280px it checks that the designed layout is untouched. On the Orders page it checks the function-fed list and buttons at phone sizes (16px / 44px search, chips on screen, an "ask first" that fills the screen) and, at 1280px, that they work: search and chips narrow the rows and the counts, the hover box lists entries, a row opens, a press with a note changes the order and greys its button out, and Confirm COD gives way to Undo. It checks the dashboard (KPI cards two to a row on a phone, a card showing its rows and letting go, a range narrowing the counts) and Packed asking for the parcel's size (nothing sent without it, numbers reaching the function). On the Photos page it checks the pickers (several images; the back camera for camera only), the thumbnails, Remove, and a button whose press takes a photo end to end. It is not part of `npm test` — it needs a browser and starts a dev server — so run it before releasing anything that changes how a screen is drawn. The list checks use the `@xeplr/ui-table` installed here.

## License

MIT

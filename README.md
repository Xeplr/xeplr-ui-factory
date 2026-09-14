# @xeplr/ui-factory

**Design data-entry screens, save them as JSON, run them as working forms.** Drag controls onto a canvas, set their labels, validation, options, fonts and colours. The same document renders as a live form in your app that **saves itself** as it is filled in, with a list of the saved records to open, edit or delete.

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
#  employee-list.screen.json   EmployeeList.jsx
#  employee-edit.screen.json   EditEmployee.jsx
```

See [examples/](./examples) for exactly what it writes.

(The package name on npm is `@xeplr/ui-factory` — the GitHub repo and folder are named `xeplr-ui-factory`.)

## Why

Most internal apps are a long tail of forms, and every one of them is hand-built: markup, layout, validation in the browser, validation again on the server, and dropdowns wired to tables. This turns a form into **data**:

- a person — or Claude — describes the screen once;
- the builder lets anyone move, resize and adjust it without a developer;
- the renderer runs it, and the server checks submissions against the **same** rules.

**The factory never has a database.** Your app stores screen documents and supplies the rows dropdowns read. The factory draws, edits and validates.

**Records live in real tables** — `employees`, one column per field — never in JSON, so `select * from employees` and ordinary reporting just work. `xeplr-factory migration` drafts each table's migration from its form, and [`@xeplr/factory`](https://www.npmjs.com/package/@xeplr/factory) is the server package that saves screens (draft / publish) and reads and writes those tables with the screen's own validation. `createFactoryApi({ fetch })` connects the components to it.

## Install

```sh
npm i @xeplr/ui-factory @xeplr/ui-canvas @xeplr/ui-table @tanstack/react-table
```

Peer dependencies: `react ^18 || ^19`, [`@xeplr/ui-canvas`](https://www.npmjs.com/package/@xeplr/ui-canvas) (the canvas the builder places controls on) and [`@xeplr/ui-table`](https://www.npmjs.com/package/@xeplr/ui-table) (lists of saved records). Your bundler must compile JSX and import CSS from the package (Vite does both).

## The builder

```jsx
import { FactoryBuilder } from '@xeplr/ui-factory'

<div style={{ height: '100vh' }}>
  <FactoryBuilder
    document={screen}                                  // omit to start a new one
    onSave={async (doc) => api.saveScreen(doc)}        // your storage — called automatically
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
- **No Save button.** Edits are saved (as a draft) a moment after you stop, whenever the screen is valid; problems are marked on the controls that have them until they are fixed.
- **Publish** (when `onPublish` is given) makes the draft the version everyone sees. It may be refused — e.g. the table has no column for a new field — and the reason, with the migration to run, is shown.
- **`lockedNames`**: fields that are already columns of the table. Their names are read-only, because renaming one would leave its data behind.

## The screen

```jsx
import { FactoryScreen } from '@xeplr/ui-factory'

<FactoryScreen
  document={screen}
  record={employee}                                   // optional: open an existing record
  onSave={async (values, { id, source }) => api.save(source, id, values)}  // returns the saved record, with its id
  fetchRecords={async ({ source }) => api.records(source)}
  onDelete={async ({ id, source }) => api.remove(source, id)}
  fetchOptions={async ({ table }) => api.options(table)}
  screens={{ employee_edit: editScreen }}             // what a list's Edit / New open in a popup
/>
```

**There is no submit.** The screen saves itself in the background (one AJAX call to your `onSave`) a moment after a change, once the entered values are acceptable. Until then it says what is missing — "Fill in the required fields to save" — and a field's message appears once the person has been in it. The first save of a new record creates it: return the saved record and its `id` makes every later save an update.

Values arrive typed: numbers as numbers, checkboxes as booleans, dates as `"YYYY-MM-DD"`, and a dropdown as the option's own `id` (a table's numeric id stays a number).

### Lists of saved records

A **List** control shows the records of the table the screen saves to (or another), in `@xeplr/ui-table`, with the columns you tick. Its **Edit in** names the edit screen: **Edit** and **New** open that screen in a popup, where it saves itself and the list refreshes behind it. **Delete** removes a row after a confirmation. Dropdown columns show names, not ids — read from the edit screen's fields.

The edit screen comes from `screens` (`{ id → document }`) or your `loadScreen(id)`. A list on a form with no **Edit in** opens rows in that form's own fields instead.

`@xeplr/ui-table` reads the xeplr theme tokens (`--xeplr-bg-*`, `--xeplr-text-*`, `--xeplr-border-*`) and defaults to a dark look; define them for a light app.

On your server, check the submission against the same rules with [`@xeplr/schema-handler`](https://www.npmjs.com/package/@xeplr/schema-handler):

```js
import { formSchema } from '@xeplr/ui-factory/model'
import schemaHandler from '@xeplr/schema-handler'          // CommonJS: default import in ESM,
                                                          // or require('@xeplr/schema-handler')
const clean = schemaHandler.applySchema(formSchema(screen), req.body)   // throws ValidationError listing each field
```

## Controls

| type | value | validation |
|---|---|---|
| `text` | string | `minLength`, `maxLength`, `pattern`, `patternMessage` |
| `textarea` | string | `minLength`, `maxLength` |
| `number` | number | `min`, `max`, `integer` |
| `date` | `"YYYY-MM-DD"` | `min`, `max` |
| `checkbox` | boolean | `required` = must be ticked |
| `dropdown` | option id | — |
| `label` | — | text with a heading, subheading or text preset |
| `list` | — | saved records, with New / Edit / Delete |

Every control also takes `style` — see [AUTHORING.md](./AUTHORING.md#styles) for the keys. Sizes are pixels at the screen's design `width` (default 800): a screen is shown at that size, never stretched, and scaled down only on a narrower display.

### Dropdown options

A dropdown **always saves an `id` and shows a `name`**, from either source:

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
npx xeplr-factory screens entity.json -o dir   # an entity → list + edit screens and pages
npx xeplr-factory migration edit.screen.json -o migrations   # the entity's table, as a migration
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

## Three ways to use it

1. **Ready-made** — `<FactoryBuilder>` and `<FactoryScreen>`.
2. **Your own design** — `useFactoryBuilder` / `useFactoryScreen` hold all the state and actions; draw them however you like.
3. **Model only** — `@xeplr/ui-factory/model` has no React: `screenFromSpec`, `validateDocument`, `formSchema`, `validateValues`, and the document operations (`addControl`, `moveNode`, `setNodeProperty`, …).

## Theming

Styles are namespaced `.xeplr-factory-*` and read the xeplr theme variables with light fallbacks: `--xeplr-accent`, `--xeplr-text`, `--xeplr-muted`, `--xeplr-border`, `--xeplr-surface`, `--xeplr-danger`, `--xeplr-input-bg`, `--xeplr-input-border`.

## Try it

```sh
npm install
npm run dev     # http://localhost:19006 — Screen · List / Edit and Designer · List / Edit for the example employee, records kept in localStorage
```

## Files

```
src/
  controls.js            ─ the control registry: palette, property panel contract, rules
  document.js            ─ create and edit screen documents
  validateDocument.js    ─ the document checker
  values.js              ─ values, validation, autosave readiness, records and list columns, formSchema
  generate.js            ─ screenFromSpec, screensFromSpec (list + edit), entity names
  scaffold.js            ─ an entity → its screen JSON and .jsx pages
  tableSchema.js         ─ a form → its table; CREATE / ALTER TABLE migrations, safe changes only
  remote.js              ─ createFactoryApi: the calls to @xeplr/factory's routes
  model.js               ─ everything above, React-free
  useFactoryBuilder.js   ─ builder controller
  useFactoryScreen.js    ─ screen controller
  designs/               ─ BuilderSample, ScreenSample, ControlView, ListView, Palette, PropertyPanel, styles.js, factory.css
  pages.jsx              ─ FactoryBuilder, FactoryScreen
bin/xeplr-factory.js     ─ screens / generate / validate / controls / schema
examples/                ─ employee.entity.json and what `screens` makes of it
dev/                     ─ the stand-in app for `npm run dev` (not published)
```

## Tests

```sh
npm test
```

## License

MIT

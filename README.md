# @xeplr/ui-factory

**Design data-entry screens, save them as JSON, run them as working forms.** Drag controls onto a canvas, set their labels, validation and options, and save. The same document renders as a live form in your app.

It is built to work with Claude: ask for *"a form for a new employee with name, email, department and start date"*, Claude drafts the screen, and a person refines it in the builder.

(The package name on npm is `@xeplr/ui-factory` — the GitHub repo and folder are named `xeplr-ui-factory`.)

## Why

Most internal apps are a long tail of forms, and every one of them is hand-built: markup, layout, validation in the browser, validation again on the server, and dropdowns wired to tables. This turns a form into **data**:

- a person — or Claude — describes the screen once;
- the builder lets anyone move, resize and adjust it without a developer;
- the renderer runs it, and the server checks submissions against the **same** rules.

**The factory never has a database.** Your app stores screen documents and supplies the rows dropdowns read. The factory draws, edits and validates.

## Install

```sh
npm i @xeplr/ui-factory @xeplr/ui-canvas
```

Peer dependencies: `react ^18 || ^19` and [`@xeplr/ui-canvas`](https://www.npmjs.com/package/@xeplr/ui-canvas) (the canvas the builder places controls on). Your bundler must compile JSX and import CSS from the package (Vite does both).

## The builder

```jsx
import { FactoryBuilder } from '@xeplr/ui-factory'

<div style={{ height: '100vh' }}>
  <FactoryBuilder
    document={screen}                                  // omit to start a new one
    onSave={async (doc) => api.saveScreen(doc)}        // your storage
    listTables={async () => api.listTables()}          // offered for "dropdown from a table"
    fetchOptions={async ({ table }) => api.options(table)}  // enables Preview with real options
  />
</div>
```

- Drag controls from the palette onto the screen, or click one to add it at the bottom.
- Move, resize, align with guides; drag a box to select several; <kbd>Delete</kbd> removes, <kbd>Ctrl/⌘ D</kbd> duplicates.
- Select a control to set its label, field name, placeholder, required, default, validation, and — for a dropdown — where its options come from.
- **Save** checks the whole screen first; problems are shown on the controls that have them, and `onSave` is only called with a valid document.

## The screen

```jsx
import { FactoryScreen } from '@xeplr/ui-factory'

<FactoryScreen
  document={screen}
  values={employee}                                   // optional: the record being edited
  fetchOptions={async ({ table }) => api.options(table)}
  onSubmit={async (values) => api.saveEmployee(values)}
/>
```

Values arrive typed: numbers as numbers, checkboxes as booleans, dates as `"YYYY-MM-DD"`, and a dropdown as the option's own `id` (a table's numeric id stays a number).

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
| `label` | — | heading, subheading or text |
| `button` | — | submit or reset |

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
  ]
})
```

It lays the fields out as a tidy one- or two-column form and returns a checked document. The same is available on the command line:

```sh
npx xeplr-factory generate spec.json -o screen.json
npx xeplr-factory validate screen.json      # every problem, with its path
npx xeplr-factory controls                   # controls, props and rules
```

[AUTHORING.md](./AUTHORING.md) is the full guide for writing screens: the spec, every control and rule, and how to choose between them.

## The document

```json
{
  "kind": "xeplr-screen", "version": 1,
  "id": "new_employee", "name": "New employee",
  "units": "fraction", "aspect": 1,
  "nodes": [
    { "id": "firstName", "type": "text", "x": 0.04, "y": 0.15, "w": 0.4475, "h": 0.08, "z": 2,
      "props": { "label": "First name", "name": "firstName", "required": true, "validation": { "maxLength": 80 } } }
  ]
}
```

Layout is **proportional**, like `@xeplr/ui-canvas` dashboards: `x` and `w` are fractions of the width, `y` and `h` fractions of a page (`width × aspect`). Text and controls scale with it, so a screen looks the same at any width.

## Three ways to use it

1. **Ready-made** — `<FactoryBuilder>` and `<FactoryScreen>`.
2. **Your own design** — `useFactoryBuilder` / `useFactoryScreen` hold all the state and actions; draw them however you like.
3. **Model only** — `@xeplr/ui-factory/model` has no React: `screenFromSpec`, `validateDocument`, `formSchema`, `validateValues`, and the document operations (`addControl`, `moveNode`, `setNodeProperty`, …).

## Theming

Styles are namespaced `.xeplr-factory-*` and read the xeplr theme variables with light fallbacks: `--xeplr-accent`, `--xeplr-text`, `--xeplr-muted`, `--xeplr-border`, `--xeplr-surface`, `--xeplr-danger`, `--xeplr-input-bg`, `--xeplr-input-border`.

## Try it

```sh
npm install
npm run dev     # http://localhost:19006 — builder + saved screen, with an in-memory stand-in app
```

## Files

```
src/
  controls.js            ─ the control registry: palette, property panel contract, rules
  document.js            ─ create and edit screen documents
  validateDocument.js    ─ the document checker
  values.js              ─ initial values, parsing, field validation, formSchema
  generate.js            ─ screenFromSpec
  model.js               ─ everything above, React-free
  useFactoryBuilder.js   ─ builder controller
  useFactoryScreen.js    ─ screen controller
  designs/               ─ BuilderSample, ScreenSample, ControlView, Palette, PropertyPanel, factory.css
  pages.jsx              ─ FactoryBuilder, FactoryScreen
bin/xeplr-factory.js     ─ generate / validate / controls / schema
examples/                ─ new-employee spec and screen
dev/                     ─ the stand-in app for `npm run dev` (not published)
```

## Tests

```sh
npm test
```

## License

MIT

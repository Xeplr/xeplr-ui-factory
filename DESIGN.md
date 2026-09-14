# @xeplr/ui-factory — design (agreed 2026-09-14)

Design a screen on the shared canvas, save it as metadata, render it as a working form.

## Decisions

| Question | Decision |
|---|---|
| Storage | **Always the consuming app's.** The factory has no database and never will. The app stores the screen document (`onSave`) and hands it back (`document` prop). |
| Layout | **Proportional, like dashboards.** `units: "fraction"` on `@xeplr/ui-canvas`: x/w are fractions of the width, y/h of the page height; rendered in the same proportions at any size. No cell grid. |
| First use | **Data-entry forms** (e.g. "New employee"). |
| Linking objects together | **Phase 2**, with workflow. Phase 1 has no cross-object links. |
| Property panel | Built in the factory, using BI's contract shape `{ key, title, fields: [{ path, label, type }] }`. |
| Authoring | **Claude drafts, people refine.** A short spec → `screenFromSpec` lays it out; `xeplr-factory validate` checks it; [AUTHORING.md](./AUTHORING.md) is the guide. |

## Phase 1 — the designer

1. **New screen** — give it a name ("New employee").
2. **Drag controls** from a palette onto the canvas; move, resize and align them (guides, snapping, marquee — all `@xeplr/ui-canvas`).
3. **Select a control** → the property panel sets:
   - label and field name
   - control type
   - validation — required, min/max, min/max length, pattern
   - for a dropdown, its **data source** (below)
4. **Save** → `onSave(document)`; the app persists it.

And the renderer: `<FactoryScreen document fetchOptions onSubmit />` draws the saved screen, validates, and calls `onSubmit(values)`.

### Controls

| type | value | notes |
|---|---|---|
| `text` | string | min/max length, pattern |
| `textarea` | string | min/max length |
| `number` | number | min, max, integer |
| `date` | date | min, max |
| `checkbox` | boolean | |
| `dropdown` | id | data source: static or table |
| `label` | — | static text on the screen |
| `button` | — | `submit` or `reset` |

### Dropdown data sources

A dropdown **always binds `id` and shows `name`.**

```json
{ "source": "static", "options": [ { "id": "ft", "name": "Full time" }, { "id": "pt", "name": "Part time" } ] }
{ "source": "table",  "table": "departments" }
```

The factory never runs SQL — the database is the app's. The app supplies two functions:

| function | used by | returns |
|---|---|---|
| `listTables()` | the designer, to offer a table picker | `[{ id, name }]` or `['departments', …]` |
| `fetchOptions({ table })` | the screen, when a table dropdown renders | `[{ id, name }]` — the app's equivalent of `select id, name from <table>` |

## Screen document

```json
{
  "kind": "xeplr-screen", "version": 1,
  "id": "new_employee", "name": "New employee",
  "units": "fraction", "aspect": 1,
  "nodes": [
    { "id": "firstName", "type": "text", "x": 0.04, "y": 0.15, "w": 0.4475, "h": 0.08, "z": 2,
      "props": { "label": "First name", "name": "firstName", "required": true, "validation": { "maxLength": 80 } } },
    { "id": "department", "type": "dropdown", "x": 0.5125, "y": 0.27, "w": 0.4475, "h": 0.08, "z": 3,
      "props": { "label": "Department", "name": "department", "required": true, "placeholder": "Select…",
                 "data": { "source": "table", "table": "departments" } } },
    { "id": "button", "type": "button", "x": 0.04, "y": 0.9, "w": 0.18, "h": 0.07, "z": 9,
      "props": { "label": "Save", "action": "submit" } }
  ]
}
```

A full example: [examples/new-employee.screen.json](./examples/new-employee.screen.json), generated from [examples/new-employee.spec.json](./examples/new-employee.spec.json).

- Geometry is `@xeplr/ui-canvas` items as-is (`id, x, y, w, h, z, groupId`).
- `formSchema(document)` turns the inputs' props into a `@xeplr/schema-handler` schema, so the app's server checks submissions with `applySchema`.

## Control registry (`src/controls.js`)

One entry per control type — pure data, no React. The palette, property panel, checker and form schema all read it; the matching renderer is `designs/ControlView.jsx`:

```js
text: { type: 'text', label: 'Text', group: 'Inputs', input: true, valueType: 'string',
        defaultSize: { w: 0.44, h: 0.08 }, defaults: { label: 'Text' },
        props: ['name', 'label', 'placeholder', 'required', 'default', 'validation'],
        validation: ['minLength', 'maxLength', 'pattern', 'patternMessage'],
        properties: [ { key: 'field', title: 'Field', fields: [ { path: 'props.label', label: 'Label', type: 'text' }, … ] } ] }
```

## Reused, not reinvented

| Need | From |
|---|---|
| Canvas | `@xeplr/ui-canvas` (fraction units, resize, marquee, snap) |
| Field schema + validation | `@xeplr/schema-handler` |
| Property contract | BI `dashboardBuilder/widgetProperties.js` + `propertyPath.js` |
| Theme | `@xeplr/ui-account` CSS tokens / `ThemeProvider` |

## As built (phase 1)

- **Controls render with the factory's own inputs**, not `@xeplr/ui-utils` field pages: one `ControlView` serves both the canvas and the live screen, and needs no extra peer dependencies.
- **Proportions everywhere**: the builder uses `@xeplr/ui-canvas` with `pageAspect` (added in ui-canvas for this), and the screen renders with CSS container-query units — no measuring, and text scales with layout.
- **Server parity**: `formSchema(document)` is a `@xeplr/schema-handler` schema; tests check the browser's rules and `applySchema` agree.
- **Default heights**: inputs 0.08, text areas 0.18, row gap 0.04 (room for an error message).

## Package layout (xeplr-os MVC rules)

```
src/
  controls.js          ─ the control registry
  document.js          ─ create a screen; add, move, edit, remove controls
  generate.js          ─ screenFromSpec: spec → laid-out document
  values.js            ─ initial values, parsing, field validation, formSchema
  validateDocument.js  ─ static check: known types, unique ids and field names, dropdown sources
  propertyPath.js      ─ get/set/prune by path
  model.js             ─ all of the above, React-free ('@xeplr/ui-factory/model')
  useFactoryBuilder.js ─ name, palette drop, selection, property edits, save
  useFactoryScreen.js  ─ values, option loading, validation, submit
  designs/             ─ BuilderSample, ScreenSample, ControlView, Palette, PropertyPanel, factory.css
  pages.jsx            ─ FactoryBuilder, FactoryScreen
  index.js
bin/xeplr-factory.js   ─ generate / validate / controls / schema
```

## Phases

1. **Forms** — everything above. **Built 2026-09-14.**
2. **Linking with workflow** — relating one screen/object to another; actions and workflows behind buttons; show/enable rules (`@xeplr/expression-handler`).
3. **More controls** — table (`@xeplr/ui-table`), chart (`@xeplr/ui-charts`), and the shared property panel that BI's dashboard builder moves onto.

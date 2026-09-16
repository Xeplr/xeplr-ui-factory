# Authoring screens with @xeplr/ui-factory

This guide is for whoever **writes** a screen definition — usually Claude, from a request like *"make a form for a new employee with name, email, department and start date"*. A person then refines the result in the builder.

> **In an app made by `@xeplr/cli`**, read the project's own `CLAUDE.md` first — it says where each file below goes in that app and how to wire it in. This guide is what the files mean.

## What a new UI is made of

A request for "a form for employees" is an **entity**. Every entity is the same set of files — create all of them, even the ones that only run the defaults:

| file | what | runs |
|---|---|---|
| `employee.entity.json` | the spec: name and fields | — |
| `employee-list.screen.json` | the **list** screen | browser |
| `employee-edit.screen.json` | the **add / edit form** the list opens in a popup | browser |
| `EditEmployee.jsx` | the form's page, holding the **front-end hooks** class (`EmployeeHooks extends FactoryHooks`) | browser |
| `EmployeeList.jsx` | the list's page — uses `EditEmployee.jsx`'s hooks | browser |
| `employee.hooks.js` | **server hooks**: `save` / `get` / `delete` × `before` / `after` / `error` / `override` | server |
| `employee.model.js` | **server model**: `EmployeeModel extends FactoryModel` — getters / setters for values | server |

`npx xeplr-factory screens employee.entity.json -o <dir>` writes all of them from the spec (`--no-pages` leaves out the two `.jsx`). The hooks and the model start as defaults — every method calling `super` — and stay that way unless the request needs more.

**Which file for which request:**

| the request says… | change |
|---|---|
| a field, a label, a rule, a dropdown, the layout, a colour | the screen JSON (then validate) |
| "show / hide / filter rows on screen", "an extra button on each row", "fill in X before saving" (convenience) | front-end hooks in `EditEmployee.jsx` |
| "must", "only if", "check against…", "email when…", "only managers see…" | server hooks in `employee.hooks.js` |
| "store as…", "convert…", "comma-separated / array", "work out X from Y" (data shape) | server model in `employee.model.js` |
| a query in your own server code | `factory.table('employees')` — this company, active rows, the model applied |

## The workflow

1. **Write an entity spec** — the entity's name and its fields, in reading order. Do not write coordinates.
2. **Generate** both screens and their pages:
   ```sh
   npx xeplr-factory screens employee.entity.json -o src/screens/employee
   ```
   This writes `employee-list.screen.json`, `employee-edit.screen.json`, `EmployeeList.jsx`, `EditEmployee.jsx` (which holds the front-end hooks — see below) and an empty `employee.hooks.js` (the server's). Wire the two pages into the app's menu next to two `<FactoryBuilder>` pages for designing them (Screen · List, Screen · Edit, Designer · List, Designer · Edit). It refuses to overwrite existing files — they may have been refined in the designer — unless given `--force`, which replaces the screen JSON only: the `.jsx` pages and the hooks file are the app's code and are always kept.

   A single screen that is not an entity (a settings form, say) uses `npx xeplr-factory generate spec.json -o screen.json` with the screen spec below.
3. **The table comes from Publish.** Records live in a **real table** — `employees`, one column per field — never in JSON, and there are no migration files to write: **publishing** the edit screen creates its table (`CREATE TABLE`, a column per field, real foreign keys for table dropdowns, the standard `id` / `isActive` / `mtId1–4` / audit columns), and publishing a later version changes it:
   - a new field → `ADD COLUMN`; a wider text or number → `ALTER COLUMN … TYPE`
   - narrowing, or a different kind of value → **refused**; tell the person why
   - a **removed field drops its column and all its data** — Publish asks the person to confirm first, showing how many values would go. Never confirm a drop on their behalf.
   - a column not created by a screen, or still used by another company's screen, is never dropped

   Publish a table that others point at first: `departments` before `employees`. To preview the SQL without applying it: `npx xeplr-factory migration employee-edit.screen.json`.

   **Never rename a field that is already a column** (the designer locks those names) — it would drop the old column and its data and start an empty one.
4. **Validate** — `screens` and `generate` already refuse a bad spec, but check any document you edited by hand:
   ```sh
   npx xeplr-factory validate screen.json
   ```
   Every problem names a path (`nodes[3].props.data.table`) and what belongs there. Fix and re-run until it prints `ok`.
5. **Save and publish.** Save the screens as drafts, then publish — edit screens of referenced tables first. Publishing changes the table; if it would drop columns it returns them for the person to confirm.
6. **Front-end hooks, if the request needs them in the browser.** `EditEmployee.jsx` holds a class, used by both pages and by the popup:

   ```jsx
   export class EmployeeHooks extends FactoryHooks {
     get(ctx) { return super.get(ctx) }                          // a list's rows (ctx.many), or the record Edit opens (ctx.id)
     save(values, ctx) { return super.save(values, ctx) }        // every autosave; returns the saved record
     delete(record, ctx) { return super.delete(record, ctx) }    // a list row, after the person confirmed
     actions(ctx) { return super.actions(ctx) }                  // extra row buttons: [{ label, onClick: (record, ctx) => … }]
   }
   ```

   Every method already runs the default. **Change only the method the request is about** and keep calling `super`:
   - *before* — change the input, then `return super.save(changed, ctx)`
   - *after* — `const saved = await super.save(values, ctx)`, then use or change it
   - *override* — do not call `super`
   - *extra row buttons* — `actions(ctx) { return [{ label: 'Mark done', onClick: async (record) => { …; ctx.refresh() } }] }`

   `ctx.screen` says which screen is calling (`employee_list` or `employee_edit`). Keep them **methods** — `super` does not work in arrow functions. Do not delete the unchanged ones; they show what can be changed.

   Front-end hooks shape what the person sees and sends. **Anything that must hold goes in the server's hooks** (next step). The server keeps only values that are fields of the form: a value added in `save` that is not a field needs a server `save.before` that accepts it.
7. **Server model, if values need shaping.** `employee.model.js`:

   ```js
   class EmployeeModel extends FactoryModel {
     static table = 'employees';
     static fields = {
       skills: { set: (v) => (Array.isArray(v) ? v.join(',') : v), get: (v) => (v ? v.split(',') : []) }
     };
     static toDb(values) { return super.toDb(values); }     // override for more than one field at a time
     static fromDb(row) { return super.fromDb(row); }
   }
   ```

   Setters run on every write (after `save.before`, before the screen's rules), getters on every read, on the routes and in `factory.table()`. Register it: `factory.init({ knex, hooks, models: [require('./employee.model')] })`.
8. **Server hooks, if the request needs them.** Anything beyond storing what the form shows — a value worked out on save, a check against other records, an email afterwards, a list narrowed to the user — goes in `employee.hooks.js`, never in the screen: `save`, `get` (list and one record) and `delete`, each with `before`, `after`, `error` and `override`. Register it with `factory.init({ hooks: { employee_edit: require('./employee.hooks') } })`. `override` replaces the whole operation — rules and the other hooks included — so use it only when the generic save / get / delete does not apply at all. The `screens` command never overwrites an existing hooks file, even with `--force`. Details: the [`@xeplr/factory` README](https://www.npmjs.com/package/@xeplr/factory#hooks).
9. **Hand over.** The person opens the screens in the designer to move, resize and restyle controls.

There is **no submit button** to add: a screen saves itself as it is filled in. If the request mentions seeing or editing what was entered ("…and show the employees below"), add a `list`.

Changing an existing screen: edit the document's `props` directly (labels, validation, options), validate, and hand it back. Regenerate from a spec only when the layout should start over.

## The entity spec

```json
{
  "entity": "employee",
  "fields": [
    { "label": "First name", "required": true },
    { "label": "Last name", "required": true },
    { "label": "Work email", "required": true,
      "validation": { "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "patternMessage": "Enter a valid email address" } },
    { "label": "Department", "type": "dropdown", "table": "departments", "required": true },
    { "label": "Start date", "type": "date", "required": true }
  ],
  "listColumns": ["firstName", "lastName", "departmentId", "startDate"]
}
```

| key | meaning |
|---|---|
| `entity` | **required** — singular, e.g. `"employee"`, `"leave request"` |
| `plural` | when the plural is irregular, e.g. `"people"` (default: `entity` + s / es / ies) |
| `source` | the table records are saved in (default: the plural, snake_cased — `employees`) |
| `fields` | **required** — the edit form's fields, exactly as in the screen spec below |
| `listColumns` | the list's columns: field names, or `{ "field", "label" }` (default: the first five fields). Pick the few that identify a record |

A dropdown reading another table stores that row's id, so its field (and column) is named for it: "Department" becomes `departmentId`, a foreign key to `departments.id`. The other table needs an `id` and a `name` column — create that entity first.
| `columns` | `1` or `2` — the edit form's layout (default `2`) |
| `pageSize`, `actions`, `width`, `style` | as below |

Names are derived once and agree everywhere: ids `employee_list` / `employee_edit`, files `employee-*.screen.json`, components `EmployeeList` / `EditEmployee`, table `employees`.

## The screen spec

```json
{
  "name": "New employee",
  "source": "employees",
  "columns": 2,
  "fields": [
    { "label": "First name", "required": true, "validation": { "maxLength": 80 } },
    { "label": "Last name", "required": true },
    { "label": "Work email", "required": true,
      "validation": { "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "patternMessage": "Enter a valid email address" } },
    { "type": "label", "text": "Employment", "variant": "subheading" },
    { "label": "Department", "type": "dropdown", "table": "departments", "required": true },
    { "label": "Employment type", "type": "dropdown", "options": ["Full time", "Part time", "Contract"] },
    { "label": "Start date", "type": "date", "required": true },
    { "label": "Annual salary", "type": "number", "validation": { "min": 0 } },
    { "label": "Remote", "type": "checkbox" },
    { "label": "Notes", "type": "textarea", "validation": { "maxLength": 1000 } }
  ],
  "list": { "title": "Employees" }
}
```

| key | meaning |
|---|---|
| `name` | **required** — the screen's title |
| `source` | the table records are saved to, e.g. `"employees"` — use the app's real table name |
| `id` | document id; defaults to the name in snake_case |
| `columns` | `1` or `2` (default `2`) |
| `heading` | `true` (default) puts the name at the top; a string uses that text; `false` for none |
| `fields` | **required** — in reading order |
| `list` | `true`, or `{ title, source, columns: [{ field, label }], pageSize, actions: ["new","edit","delete"], openIn: "popup" \| "page" }` — saved records below the fields |
| `width` | design width in px (default `800`) |
| `style` | screen-wide defaults: `{ fontFamily, fontSize, color, background }` |

Each field:

| key | meaning |
|---|---|
| `label` | **required** for inputs — shown above the field |
| `type` | `text` (default), `textarea`, `number`, `date`, `datetime`, `checkbox`, `dropdown`, `radio`, `multiselect`, `file`, `stepper`, or `label` for a section heading |
| `name` | the key the value is saved under; defaults to the label in camelCase (`"Date of birth"` → `dateOfBirth`) |
| `required` | `true` to require a value (a checkbox must be ticked) |
| `placeholder` | text, textarea, number, dropdown |
| `default` | starting value — a string, a number, `true`/`false`, or a date as `"YYYY-MM-DD"` |
| `validation` | see below |
| `width` | `"full"` to take the whole row in a two-column form (textareas and labels always do) |
| `options` | dropdown, radio, multiselect: `["Full time", "Part time"]` (ids are made from the names: `full_time`) or `[{ "id": "ft", "name": "Full time" }]` |
| `table` | dropdown, radio, multiselect: read options from this table in the app's database |
| `layout` | radio, multiselect: `"vertical"` (default) or `"horizontal"` |
| `accept` | file: the extensions it takes, e.g. `".pdf,.docx"` |
| `steps` | stepper: `["Connect", "Transform", "Review"]` — at least two |
| `step` | which step this field is on: the step's label, or its number from 1. Needs a `stepper` earlier in `fields`; without a `step` a field shows on every step |
| `maxSize` | file: the largest file in megabytes (default 10) |
| `text`, `variant` | `label` only — `variant` is `heading`, `subheading` (default for a section) or `text` |
| `style` | how it looks — see Styles |

## Validation rules

| control | rules |
|---|---|
| `text` | `minLength`, `maxLength`, `pattern` (a regex string), `patternMessage` (shown when it fails) |
| `textarea` | `minLength`, `maxLength` |
| `number` | `min`, `max`, `integer` |
| `date` | `min`, `max` — as `"YYYY-MM-DD"` |
| `datetime` | `min`, `max` — as `"YYYY-MM-DDTHH:MM"` |
| `multiselect` | `minItems`, `maxItems` — how many may be chosen |
| `checkbox`, `dropdown`, `radio`, `file` | none (use `required`) |

Anything else is rejected, with the list of what is allowed.

## Styles

Every control takes `style`. Sizes are **pixels at the screen's `width`**.

| key | controls | value |
|---|---|---|
| `fontFamily` | all | a CSS font family, e.g. `"Georgia, serif"` |
| `fontSize` | all | 8–96 |
| `fontWeight` | all but list | 300, 400, 500, 600, 700, 800 |
| `fontStyle` | all but list | `"normal"` or `"italic"` |
| `textAlign` | text, textarea, number, date, label | `"left"`, `"center"`, `"right"` |
| `color` | all | `#rgb` or `#rrggbb` |
| `background`, `borderColor` | inputs (not checkbox), label, list | `#rgb`, `#rrggbb` or `"transparent"` |
| `borderWidth` | inputs (not checkbox), label, list | 0–10 |
| `borderRadius` | inputs (not checkbox), label, list | 0–40 |
| `labelFontSize`, `labelFontWeight`, `labelColor` | inputs (not checkbox) | the label above the field |

Only style when the request asks for a look ("make the heading blue", "bigger labels"); otherwise leave the defaults.

## Lists

For an entity, `screens` makes the list for you. By hand: a `list` shows the saved records of the screen's `source` (or its own `source`) with **New**, **Edit** and **Delete**; `editScreen` names the screen those open in a popup. Columns default to every field; name the few that identify a record instead:

```json
{ "title": "Employees", "columns": [{ "field": "firstName", "label": "First name" }, { "field": "departmentId", "label": "Department" }] }
```

A list needs a table: set the screen's `source` or the list's own.

## Dropdowns

A dropdown **always saves an `id` and shows a `name`.**

- **Fixed values** — `options`. Use when the choices belong to the form: employment type, yes/no/maybe, priority.
- **A table** — `table`. Use when the choices are records the app already keeps: departments, locations, managers. The factory never queries the database: the app returns `[{ id, name }]` rows for the table. Use the app's real table name; if you do not know it, ask, or leave a fixed list and say so.

## Choosing controls

| the request says | use |
|---|---|
| a name, title, email, phone, code | `text` (add a `pattern` for email/phone/code formats) |
| notes, description, address, comments | `textarea` |
| amount, salary, quantity, age | `number` (`integer: true` for counts) |
| a date — birth, start, due | `date` |
| an appointment, a deadline with a time, when something happened | `datetime` |
| yes/no, agree, active, remote | `checkbox` |
| one of a known set | `dropdown` with `options` — a `radio` group when there are two or three and they should all be visible |
| one of the app's records | `dropdown` with `table` |
| several of a set — tags, skills, days | `multiselect` |
| a document, a contract, a spreadsheet, a photo | `file` with `accept` (`".pdf,.docx"`) |
| a section title between groups | `{ "type": "label", "text": "…", "variant": "subheading" }` |
| a long form people work through in stages | a `stepper`, then `step` on each field |

Keep labels short and in sentence case ("Start date", not "START DATE:"). Mark only what the request needs as required.

## The document, if you edit it directly

```json
{
  "kind": "xeplr-screen", "version": 1,
  "id": "new_employee", "name": "New employee",
  "units": "fraction", "aspect": 1, "width": 800,
  "nodes": [
    { "id": "firstName", "type": "text", "x": 0.04, "y": 0.15, "w": 0.4475, "h": 0.08, "z": 2,
      "props": { "label": "First name", "name": "firstName", "required": true } }
  ]
}
```

- `x`, `w` are fractions of the screen width; `y`, `h` fractions of a page (with `aspect: 1`, also of the width). `x + w` must not exceed 1.
- Node `id`s are unique; input `props.name`s are unique and match `^[A-Za-z_][A-Za-z0-9_]*$`.
- `props` allowed per control: `npx xeplr-factory controls`.

## Field names are column names

- camelCase, as generated from the label: `firstName`, `startDate`, `departmentId`.
- Not a standard column: `id`, `isActive`, `mtId1`–`mtId4`, `recordCreatedDate`, `recordModifiedDate`, `recordCreatedBy`, `recordModifiedBy`.
- At most 63 characters.
- Choose them as if naming a database column — because you are.

## Commands

```sh
npx xeplr-factory screens <entity.json|-> [-o <dir>] [--force] # entity → list + edit screens and pages
npx xeplr-factory migration <edit.screen.json> [--from <previous.screen.json>]   # preview a table's SQL (Publish applies it)
npx xeplr-factory generate <spec.json|-> [-o <screen.json>]   # spec → document
npx xeplr-factory validate <screen.json|->                    # exit 1 with every problem listed
npx xeplr-factory controls                                     # controls, props, validation rules
npx xeplr-factory schema <screen.json|->                       # the form's @xeplr/schema-handler schema
```

The `schema` output is what the app's server checks a submission against: `applySchema(formSchema(document), body)`.

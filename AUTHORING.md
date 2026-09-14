# Authoring screens with @xeplr/ui-factory

This guide is for whoever **writes** a screen definition — usually Claude, from a request like *"make a form for a new employee with name, email, department and start date"*. A person then refines the result in the builder.

## The workflow

1. **Write a spec** — a short list of what is on the screen, in reading order. Do not write coordinates.
2. **Generate** the screen document from it:
   ```sh
   npx xeplr-factory generate spec.json -o screen.json
   ```
   or in code: `screenFromSpec(spec)` from `@xeplr/ui-factory/model`.
3. **Validate** — `generate` already refuses a bad spec, but check any document you edited by hand:
   ```sh
   npx xeplr-factory validate screen.json
   ```
   Every problem names a path (`nodes[3].props.data.table`) and what belongs there. Fix and re-run until it prints `ok`.
4. **Hand the document to the app.** The app stores it and opens it in `<FactoryBuilder>`, where the person moves, resizes and adjusts controls.

Changing an existing screen: edit the document's `props` directly (labels, validation, options), validate, and hand it back. Regenerate from a spec only when the layout should start over.

## The spec

```json
{
  "name": "New employee",
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
  "submit": "Create employee",
  "reset": "Clear"
}
```

| key | meaning |
|---|---|
| `name` | **required** — the screen's title |
| `id` | document id; defaults to the name in snake_case |
| `columns` | `1` or `2` (default `2`) |
| `heading` | `true` (default) puts the name at the top; a string uses that text; `false` for none |
| `fields` | **required** — in reading order |
| `submit` | submit button label (default `"Save"`); `false` for none |
| `reset` | reset button label; omit for none |

Each field:

| key | meaning |
|---|---|
| `label` | **required** for inputs — shown above the field |
| `type` | `text` (default), `textarea`, `number`, `date`, `checkbox`, `dropdown`, or `label` for a section heading |
| `name` | the key the value is saved under; defaults to the label in camelCase (`"Date of birth"` → `dateOfBirth`) |
| `required` | `true` to require a value (a checkbox must be ticked) |
| `placeholder` | text, textarea, number, dropdown |
| `default` | starting value — a string, a number, `true`/`false`, or a date as `"YYYY-MM-DD"` |
| `validation` | see below |
| `width` | `"full"` to take the whole row in a two-column form (textareas and labels always do) |
| `options` | dropdown: `["Full time", "Part time"]` (ids are made from the names: `full_time`) or `[{ "id": "ft", "name": "Full time" }]` |
| `table` | dropdown: read options from this table in the app's database |
| `text`, `variant` | `label` only — `variant` is `heading`, `subheading` (default for a section) or `text` |

## Validation rules

| control | rules |
|---|---|
| `text` | `minLength`, `maxLength`, `pattern` (a regex string), `patternMessage` (shown when it fails) |
| `textarea` | `minLength`, `maxLength` |
| `number` | `min`, `max`, `integer` |
| `date` | `min`, `max` — as `"YYYY-MM-DD"` |
| `checkbox`, `dropdown` | none (use `required`) |

Anything else is rejected, with the list of what is allowed.

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
| yes/no, agree, active, remote | `checkbox` |
| one of a known set | `dropdown` with `options` |
| one of the app's records | `dropdown` with `table` |
| a section title between groups | `{ "type": "label", "text": "…", "variant": "subheading" }` |

Keep labels short and in sentence case ("Start date", not "START DATE:"). Mark only what the request needs as required.

## The document, if you edit it directly

```json
{
  "kind": "xeplr-screen", "version": 1,
  "id": "new_employee", "name": "New employee",
  "units": "fraction", "aspect": 1,
  "nodes": [
    { "id": "firstName", "type": "text", "x": 0.04, "y": 0.15, "w": 0.4475, "h": 0.08, "z": 2,
      "props": { "label": "First name", "name": "firstName", "required": true } }
  ]
}
```

- `x`, `w` are fractions of the screen width; `y`, `h` fractions of a page (with `aspect: 1`, also of the width). `x + w` must not exceed 1.
- Node `id`s are unique; input `props.name`s are unique and match `^[A-Za-z_][A-Za-z0-9_]*$`.
- `props` allowed per control: `npx xeplr-factory controls`.

## Commands

```sh
npx xeplr-factory generate <spec.json|-> [-o <screen.json>]   # spec → document
npx xeplr-factory validate <screen.json|->                    # exit 1 with every problem listed
npx xeplr-factory controls                                     # controls, props, validation rules
npx xeplr-factory schema <screen.json|->                       # the form's @xeplr/schema-handler schema
```

The `schema` output is what the app's server checks a submission against: `applySchema(formSchema(document), body)`.

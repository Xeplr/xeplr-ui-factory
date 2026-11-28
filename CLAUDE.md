# @xeplr/ui-factory — map

Design data-entry screens on `@xeplr/ui-canvas`, save them as JSON **screen documents**, run them
as forms/lists on the web and (via `./native`) in React Native. Browser half of `@xeplr/factory`
(server: routes, real tables, functions); used by `@xeplr/cli` apps (Configure UI, taskie, Rental
Desk) and inside `@xeplr/ui-workflow`'s designer. It has NO database and runs NO app code: storage
is the host's, every button/list/event names a server function. User docs: README, AUTHORING.md
(how Claude drafts screens), DESIGN.md (decisions).

## The model: screen → nodes → buttons/functions
- **Screen document** (`src/document.js`): `{ kind: 'xeplr-screen', version, id, name, source?, units: 'fraction', aspect, width, style, params?, events?, nodes: [{ id, type, x, y, w, h, z, props }] }`. Geometry = fractions of width. Pure, immutable edit functions.
- **Control registry** (`src/controls.js` → `CONTROLS`): one entry per `type` (inputs, `stepper`, `label`, `list`, `table`, `subform`, `buttons`, `details`, `feed`, `tiles`…) — palette, property panel, checker and `formSchema` all read it.
- **Buttons** (`src/buttons.js`): a button = `action` (function name) + `params`, plus `ask` (note/fields/rows/file), `when`/`disabledWhen`/`pressedWhen` conditions (`buttonShown`/`buttonDisabled`/`buttonPressed`), `opens` (a screen). Lists with `rowsFrom` are function-fed (`listRows` event).
- **Function events**: `button`, `listRows`, `rowDetails`, `buttonOptions` (`buttons.js`), `suggest` (`suggest.js`), `feedEntries` (`feed.js`), `recordDetails` (`details.js`), screen events `beforeLoad/beforeSave/afterSave/beforeDelete/onError` (`events.js` → `SCREEN_EVENTS`). All run on the server; `functionProblems(doc, registry)` checks names.
- **Flow** (`src/flow.js`): `{ kind: 'xeplr-flow', steps: [{ stepKey, screen, transitions: [{ when, target }] }] }`; run by the app's workflow service, not here.

## Where things are
Model (React-free, `@xeplr/ui-factory/model` = `src/model.js` re-exports):
- `document.js` (create/add/move/set/remove, steps), `controls.js`, `validateDocument.js` (`validateDocument` → `{ ok, errors: [{ path, message }] }`, `assertValidDocument`)
- `values.js` — `initialValues`, `parseInput`, `validateValues`, `formSchema` (→ `@xeplr/schema-handler`), `saveState`, `listColumns`, `resolveBinding` (`{params.x}`), `generateCode`
- `buttons.js`, `suggest.js`, `feed.js`, `details.js`, `tiles.js`, `listRows.js` (row menus), `listRange.js` (date presets), `events.js`, `tones.js`
- `generate.js` (`screenFromSpec`, `screensFromSpec`), `scaffold.js` (`scaffoldEntity`), `presets.js` (ready-made fields), `masters.js`, `bulk.js` (paste grid)
- `tableSchema.js` — form → table: `tableForScreen`, `planTableChange`, `migrationFor`, `diffTables`
- `remote.js` — `createFactoryApi({ fetch, fetchFile, base })` → `/factory/*` calls + `screenProps` / `builderProps` bundles
- `flows.js` (`createFlowsApi` → `runnerProps`/`builderProps`), `screenSource.js` (screens for ui-workflow), `pagesInventory.js` (ui/pages.json web-only check), `phoneMenu.js`, `urlState.js`, `propertyPath.js`, `portalHost.js`
Controllers (hooks, no JSX):
- `useFactoryScreen.js` — the big one: values, dirty/Save, options, lists, popups, buttons, subforms; composes `useFeeds.js`, `useRecordDetails.js`, `useFilePreview.js`, `useUrlPlaces.js`
- `useFactoryBuilder.js` (designer), `useFlowBuilder.js` (autosave `FLOW_AUTOSAVE_DELAY`), `useFlowRun.js`, `useScreenEvents.js`, `useFunctionCatalog.js`, `useFormFields.js`, `useScreenSource.js`, `useScreenDocument.js`
- `hooks.js` — `FactoryHooks` class (get/save/delete/actions; extend + `super`), resolved by `hookMethod`
Web designs (`src/designs/`, props only, `factory.css` `xeplr-factory-*`):
- `ScreenSample.jsx` (screen; dispatches per node to `ControlView.jsx`), `ControlView.jsx` (every control; delegates to `ListView` (→ `FedList` for `rowsFrom`, `BulkAdd`, `listExtras`), `ButtonsView`, `FeedView`, `DetailsView`, `TilesView`, `FileField`), `ScreenModal.jsx`
- `BuilderSample.jsx` + `Palette.jsx` + `PropertyPanel.jsx` (`EDITORS`), `FlowBuilderSample`, `FlowDesignerSample` (`FLOW_DESIGNER_TABS`), `FlowRunnerSample`, `ScreenEditorSample`; `styles.js` (style props → CSS)
Web pages: `src/pages.jsx` — `FactoryBuilder`, `FactoryScreen`, `FlowRunner`, `FlowBuilder`, `FlowDesigner`, `FlowDesignerPage`.
Native (`src/native/`, entry `index.js` = `@xeplr/ui-factory/native`):
- `NativeScreen.jsx` — same `useFactoryScreen`, controls in `readingOrder`; `Control` switch → `NativeList`, `NativeButtons`, `NativeDetails`, `NativeFeed`, `NativeTiles`, `NativeTable`, subform = nested `NativeScreen`; inputs → `inputs.jsx` `NativeInput`
- `pages.jsx` — `NativeFormRecords`, `NativeRecord`, `NativeMenu`, `NativeFlows` (no router; app handles `onOpen`/`onDone`); `NativeFlowRunner.jsx`
- `host.jsx` — `NativeHostProvider({ modules })` / `useNativeHost()`: Expo pickers/camera handed in, never imported
- `parts.jsx` (`Btn`, `Field`, `Sheet`, `PickList`), `theme.js` (`DARK`/`LIGHT`), `safeArea.js`, `noRouter.js` (stand-in for `react-router-dom`)
Other: `bin/xeplr-factory.js` (CLI: screens, migration, generate, validate, controls, schema, pages), `examples/` (entity + screens + pages), `dev/` (stand-in app for `npm run dev`).

## Flow
- Run: `createFactoryApi({ fetch: authFetch })` → `<FactoryScreen document {...api.screenProps} />` → `useFactoryScreen` → `validateDocument` (invalid → `ScreenSample` / `NativeScreen` render the problems, nothing else) → `inputNodes` → Save → `hook('save')` → `onSave(values, { id, screen })` → `POST /factory/records/:screen/save`.
- Button: `ButtonsView`/`NativeButtons` → controller `buttonsFor(node)` → `buttonInput()` → `pressButton` → `POST /factory/buttons/:screen/:button` (server runs the registered function).
- Design: `FactoryBuilder` → `useFactoryBuilder` → document.js edits → autosave `onSave` only when valid (`saveDraft`) → `onPublish` (`publish`, 409 asks `confirmDrop`/`confirmConvert`).

## To change X, edit Y
- New control type → `controls.js` (`CONTROLS` entry) + `designs/ControlView.jsx` + `native/NativeScreen.jsx` `Control` / `native/inputs.jsx` + checks in `validateDocument.js` + column in `tableSchema.js` → `columnForField`
- New property in the designer → `controls.js` entry's `properties` (+ an editor in `PropertyPanel.jsx` → `EDITORS` if a new `type`)
- What the checker refuses → `validateDocument.js`
- Field validation / parsing → `values.js` → `parseInput`, `validateValues`, `formSchema` (keep server parity)
- Button behaviour (conditions, ask, what a press sends) → `buttons.js`; drawing → `ButtonsView.jsx` / `NativeButtons.jsx`
- Function-fed list → `useFactoryScreen.js` (`listFor`) + `designs/FedList.jsx` / `native/NativeList.jsx`
- Feed / details / tiles → `feed.js` + `useFeeds.js` / `details.js` + `useRecordDetails.js` / `tiles.js`; views `FeedView`/`DetailsView`/`TilesView` and `Native*`
- New server call → `remote.js` (add to `screenProps` or `builderProps` too)
- Spec → layout (Claude drafting) → `generate.js`; entity scaffold → `scaffold.js`; CLI → `bin/xeplr-factory.js`
- Form → table / publish plan → `tableSchema.js`
- URL state keys → `urlState.js` + `useUrlPlaces.js`
- Phone menu → `phoneMenu.js`; phone host abilities → `native/host.jsx`

## Rules and traps
- Two renderers, one controller: web and native must both handle every control; the native side may import only `src/*.js`, `src/native/*` — never `designs/`, CSS, `react-dom`, `@xeplr/ui-table`, `@xeplr/ui-canvas` (enforced by `test/native.test.js`).
- Phone apps alias `react-router-dom` → `native/noRouter.js` in Metro so `@xeplr/ui-utils` URL state stays in memory.
- Screens hold no code: a button is a function name + params; parameters come from the document, never the request.
- Screen saves only on Save (one `onSave`); the builder autosaves drafts. Preview in `FactoryBuilder` passes no `onSave`/`onDelete` on purpose.
- Field names are column names (`tableSchema.js`); names in `lockedNames` are read-only; `STANDARD_COLUMNS` are reserved.
- Validation layer here is `validateDocument` on the document, not a selector check on a custom design.
- `remote.js` accepts both a `window.fetch` (Response) and `authFetch` (parsed body); keep both paths.
- Popups portal into the `xeplr-theme-*` wrapper (`portalHost`), not `<body>`, to keep the theme.

## Test
- `npm test` — runs each `test/*.test.js` as a plain node script (no framework, no services); `phone.check.js` is excluded.
- Key files: `model.test.js` (document/values/schema), `buttons.test.js`, `table.test.js` (tableSchema), `feed`/`details`/`tiles`/`files`/`ask*`/`checklist`/`choice`/`autocomplete`/`tags`/`scan` tests (their model files), `flow.test.js`, `remote.test.js` (canned replies for both fetch kinds), `native.test.js` (import graph of `./native`), `urlState.test.js` (MemoryRouter via `react-dom/server`), `cli.test.js`.
- `npm run test:phone` — Playwright (`npx playwright install chromium-headless-shell` once); starts the `dev/` app and checks 360/390/430/1280px layouts. Run before releasing render changes.

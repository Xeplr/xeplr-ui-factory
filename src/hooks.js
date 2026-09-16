// FRONT-END HOOKS — the app's own code around what a screen does in the
// browser: load its rows, save, delete, and extra buttons on a list's rows.
//
// Every method here IS the default. Extend the class, override only what you
// need, and call super to run the default where you want it:
//
//   class TaskHooks extends FactoryHooks {
//     async save(values, ctx) {
//       values = { ...values, priority: values.priority || 'normal' }   // before
//       const saved = await super.save(values, ctx)                     // the default save
//       notify('Saved ' + saved.title)                                  // after
//       return saved
//     }
//   }
//   <FactoryScreen document={taskList} hooks={new TaskHooks()} />
//
//   before    change the input, then call super
//   after     call super, then use or change what it returns
//   override  do not call super
//   error     try { return await super.save(values, ctx) } catch (err) { … }
//
// Write hooks as METHODS (save(values, ctx) { … }), not as arrow-function
// properties (save = () => …) — super only works in methods.
//
// The same hooks run in the popup a list opens for Edit / New. ctx.screen says
// which screen is calling ("task_list", "task_edit").
//
// The browser is not a security boundary: anything that must hold (a price, a
// permission) belongs in the server's hooks. And the server keeps only values
// that are fields of the form — a value added here that is not one needs a
// server save.before that accepts it.

export class FactoryHooks {
  /**
   * The rows of a list (ctx.many), or one record when Edit opens it (ctx.id).
   * @returns rows | record
   */
  get(ctx) {
    return ctx.defaults.get()
  }

  /**
   * Save — called on every autosave, so keep it quick and safe to repeat.
   * @param values  what the form holds
   * @param ctx.steps  switch steps off or on as the record decides them —
   *        ctx.steps.disable('approval'), ctx.steps.enable()
   * @returns the saved record (its id makes the next save an update)
   */
  save(values, ctx) {
    return ctx.defaults.save(values)
  }

  /** Delete a row of a list — after the person confirmed. */
  delete(record, ctx) {
    return ctx.defaults.delete(record)
  }

  /**
   * Before a stepper moves — Next, Back, or a click on the bar itself.
   *
   *   step(ctx) {
   *     if (ctx.direction === 'next' && ctx.from === 0 && !ctx.values.title) return false
   *     return super.step(ctx)
   *   }
   *
   * A screen with branches decides which of them apply from here:
   *
   *   step(ctx) {
   *     if (ctx.from === 0) {
   *       if (ctx.values.kind === 'simple') { ctx.disable(['pricing', 'approval']); return 'summary' }
   *       ctx.enable()                       // every step applies again
   *     }
   *     return super.step(ctx)
   *   }
   *
   * @param ctx.from       the step being left, counting from 0
   * @param ctx.to         the step asked for
   * @param ctx.direction  'next' | 'back' | 'jump' (a click on the bar)
   * @param ctx.values     what the form holds
   * @param ctx.stepper    the stepper's node id
   * @param ctx.go         (step) → move there (a key or a number)
   * @param ctx.disable    (steps) → switch them off: shown, but passed over by
   *                       Next and Back and not clickable. A key, a number, or
   *                       a list of either.
   * @param ctx.enable     (steps) → switch them back on; no arguments, all of them
   * @param ctx.steps      the same, for a screen with more than one stepper:
   *                       disable(which, stepperId), active(id), disabled(id)
   * @returns false to stay where you are, a step (its key or its number) to go
   *          somewhere else, anything else to move as asked. The step's own
   *          required fields are checked before this runs, so this is for your
   *          rules, not theirs.
   */
  step(ctx) {
    return true
  }

  /**
   * Extra buttons on each row, beside Edit and Delete:
   *   [{ label: 'Mark done', onClick: (record, ctx) => … }]
   * ctx.refresh() reloads the list.
   */
  actions(ctx) {
    return []
  }
}

/** A method of the given hooks, or the default when they do not have it — so a plain object with only save() works too. */
export function hookMethod(hooks, name) {
  return hooks && typeof hooks[name] === 'function' ? hooks[name].bind(hooks) : FactoryHooks.prototype[name]
}

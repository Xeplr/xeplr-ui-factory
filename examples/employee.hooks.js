// Server hooks for employee records — screen "employee_edit" (and "employee_list", which edits in it).
//
// Register with @xeplr/factory:
//   factory.init({ knex, hooks: { employee_edit: require('./employee.hooks') } })
//
// Each operation has four hooks. Delete the ones you do not need.
//   before(ctx)       first — save: return new values to replace them (they are then checked
//                     against the screen's rules); get: narrow ctx.query; any: ctx.reject(message, { field })
//   after(ctx)        once it succeeded — ctx.id, ctx.result; return a value to replace the result.
//                     If it throws, the operation still happened (and error is told).
//   error(ctx, err)   when the operation failed
//   override(ctx)     does the WHOLE operation instead — no rules, no before / after / error,
//                     no generic query. What it returns is the response.
//
// ctx: op, screenKey, screen, table, id, isNew (save), many (get), input (what the UI sent, read-only),
//      values (save), previous (save / delete: the row before), result, user, tenant, knex, query (get), reject

module.exports = {
  save: {
    // before: async function(ctx) { return ctx.values },
    // after: async function(ctx) {},
    // error: async function(ctx, err) {},
    // override: async function(ctx) { return savedRecord },
  },
  get: {
    // before: async function(ctx) { /* ctx.query.where(...) */ },
    // after: async function(ctx) { return ctx.result },
    // error: async function(ctx, err) {},
    // override: async function(ctx) { return ctx.id ? record : records },
  },
  delete: {
    // before: async function(ctx) {},
    // after: async function(ctx) {},
    // error: async function(ctx, err) {},
    // override: async function(ctx) { return { id: ctx.id } },
  }
}

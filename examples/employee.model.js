// The model for employee records — how values are shaped between your code and
// the "employees" table, like Sequelize's getters and setters.
//
// Register with @xeplr/factory:  factory.init({ knex, hooks, models: [require('./employee.model')] })
//
// Used everywhere: the screens' routes and factory.table('employees'). Models shape
// data; the hooks file decides behaviour.

var { FactoryModel } = require('@xeplr/factory');

class EmployeeModel extends FactoryModel {
  static table = 'employees';

  // Per field: set(value, values) before it is written, get(value, row) after it is read.
  //   tags: { set: (v) => (Array.isArray(v) ? v.join(',') : v), get: (v) => (v ? v.split(',') : []) }
  static fields = {};

  /** Every value about to be written. Override for more than one field at a time. */
  static toDb(values) {
    return super.toDb(values);
  }

  /** Every row just read. */
  static fromDb(row) {
    return super.fromDb(row);
  }
}

module.exports = EmployeeModel;

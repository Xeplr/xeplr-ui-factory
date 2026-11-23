// A PHONE APP'S MENU (phoneMenu.js): read from what the server says this
// person may see, in its order, under its labels.
//
// Plain script: prints its checks, exits non-zero on failure. No framework.
import { phoneMenu } from '../src/phoneMenu.js'

const results = []
const check = (name, cond, detail) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const keys = (list) => list.map((m) => m.key).join(',')

const access = {
  menus: ['Admin', 'Configure UI', 'form:rental', 'form:equipment_item', 'form:customer', 'Flows', 'Home', 'Tasks'],
  menuItems: [
    { name: 'Admin', label: 'Admin', sortOrder: 4 },
    { name: 'Configure UI', label: 'Configure UI', sortOrder: 7 },
    { name: 'form:rental', label: 'Rentals', sortOrder: 8 },
    { name: 'form:equipment_item', label: 'Equipment', sortOrder: 10 },
    { name: 'form:secret', label: 'Payroll', sortOrder: 11 },
    { name: 'form:customer', label: 'Customers', sortOrder: 12 },
    { name: 'Flows', label: 'Journeys', sortOrder: 13 },
    { name: 'Home', label: 'Home', sortOrder: 21 },
    { name: 'Tasks', label: 'Tasks', sortOrder: 25, isHidden: true }
  ]
}
const menu = phoneMenu(access)
check('forms added to the menu, in the server\'s order', keys(menu) === 'form:rental,form:equipment_item,form:customer,Flows', keys(menu))
check('...each knowing its form', menu[0].kind === 'form' && menu[0].form === 'rental' && menu[1].form === 'equipment_item')
check('...under the label set in Configure UI → Menu', menu[0].label === 'Rentals' && menu[3].label === 'Journeys')
check('a form the person may not open is not offered', !menu.some((m) => m.key === 'form:secret'))
check('the designers and admin screens stay on the computer', !menu.some((m) => m.key === 'Configure UI' || m.key === 'Admin'))
check('a hidden item stays hidden', !phoneMenu({ ...access, menus: [...access.menus, 'form:old'], menuItems: [{ name: 'form:old', label: 'Old', isHidden: true }] }).length)
check('Flows can be left out', !phoneMenu(access, { flows: false }).some((m) => m.kind === 'flows'))
const own = phoneMenu(access, { pages: { Home: { label: 'Today', icon: '⌂' } } })
check('an app\'s own page, by its key, with its own label and icon', own.some((m) => m.key === 'Home' && m.kind === 'page' && m.label === 'Today' && m.icon === '⌂'))
check('nobody signed in: nothing', phoneMenu(null).length === 0)

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)

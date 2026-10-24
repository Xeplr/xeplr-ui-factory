import { useCallback, useMemo, useRef } from 'react'
import { useUrlState } from '@xeplr/ui-utils/src/url/useUrlState.js'
import { factoryUrlKeys, encodeSteps, decodeSteps, replacesHistory } from './urlState.js'

// The two places the factory's controllers keep, each in useState's shape so
// a controller swaps one line. In the URL under the host's `urlKey`; without
// one, in memory with the same rules (see urlState.js).

/**
 * [openSteps, setOpenSteps] — which step each stepper is open at,
 * { stepper id: index }. Moving between steps is a switch, so it replaces the
 * history entry rather than adding one.
 */
export function useUrlSteps(urlKey) {
  const keys = factoryUrlKeys(urlKey)
  const [value, setValue] = useUrlState(keys ? keys.steps : 'steps', { inUrl: Boolean(keys), replace: true })
  const open = useMemo(() => decodeSteps(value), [value])
  // Two moves in one event build on each other, as useState's updater would.
  const openRef = useRef(open); openRef.current = open
  const setOpen = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(openRef.current) : next
    const encoded = encodeSteps(resolved)
    if (encoded === encodeSteps(openRef.current)) return
    openRef.current = decodeSteps(encoded)
    setValue(encoded)
  }, [setValue])
  return [open, setOpen]
}

/**
 * [selected, setSelected] — the one thing whose properties are open (a
 * control's id, a flow step's key), or null. Opening or closing the
 * properties adds a history entry; moving to another thing replaces it.
 * Read back from the URL it is a string.
 */
export function useUrlSelection(urlKey) {
  const keys = factoryUrlKeys(urlKey)
  const [value, setValue] = useUrlState(keys ? keys.selected : 'selected', { inUrl: Boolean(keys) })
  const valueRef = useRef(value); valueRef.current = value
  const select = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(valueRef.current) : next
    const v = resolved === undefined || resolved === '' ? null : resolved
    if ((v === null ? null : String(v)) === valueRef.current) return
    setValue(v, { replace: replacesHistory(valueRef.current, v) })
    valueRef.current = v === null ? null : String(v)
  }, [setValue])
  return [value, select]
}

/**
 * lib/costco-stores.js — Static list of Costco warehouses we monitor for
 * bourbon alerts.  Currently Illinois-only (the Tatera relay scope).
 *
 * The `number` field matches Costco's internal warehouse code that Tatera
 * publishes in alerts — e.g. "Naperville (342), IL".  If a future alert
 * references a store not in this list, the alert still flows through (the
 * backend persists everything it sees), but the store will appear in the
 * favorites picker only after it's added here.
 */

export const COSTCO_STORES_IL = [
  { number: '342',  name: 'Naperville',           state: 'IL' },
  { number: '348',  name: 'Glenview',             state: 'IL' },
  { number: '371',  name: 'Bloomingdale',         state: 'IL' },
  { number: '378',  name: 'Lake Zurich',          state: 'IL' },
  { number: '380',  name: 'Chicago Lincoln Park', state: 'IL' },
  { number: '383',  name: 'Niles',                state: 'IL' },
  { number: '387',  name: 'Schaumburg',           state: 'IL' },
  { number: '388',  name: 'Oak Brook',            state: 'IL' },
  { number: '580',  name: 'Bedford Park',         state: 'IL' },
  { number: '647',  name: 'Orland Park',          state: 'IL' },
  { number: '774',  name: 'Lake In The Hills',    state: 'IL' },
  { number: '779',  name: 'Mt. Prospect',         state: 'IL' },
  { number: '1040', name: 'St. Charles',          state: 'IL' },
  { number: '1074', name: 'Mettawa',              state: 'IL' },
  { number: '1085', name: 'Melrose Park',         state: 'IL' },
  { number: '1088', name: 'Bolingbrook',          state: 'IL' },
  { number: '1107', name: 'Chicago South Loop',   state: 'IL' },
  { number: '1126', name: 'East Peoria',          state: 'IL' },
  { number: '1153', name: 'North Riverside',      state: 'IL' },
  { number: '1353', name: 'Loves Park',           state: 'IL' },
  { number: '1384', name: 'Champaign',            state: 'IL' },
  { number: '1388', name: 'Plainfield',           state: 'IL' },
  { number: '1443', name: 'NE Naperville',        state: 'IL' },
  { number: '1763', name: 'Yorkville',            state: 'IL' },
]

const _byNumber = Object.fromEntries(COSTCO_STORES_IL.map(s => [s.number, s]))

export function getCostcoStore(number) {
  return _byNumber[String(number)] ?? null
}

export function getCostcoStoreLabel(number) {
  const store = getCostcoStore(number)
  return store ? `${store.name} (${store.number})` : `Store ${number}`
}

/**
 * Normalize a store name observed in an alert payload.  Tatera occasionally
 * appends the state code to the warehouse name (e.g. "North Riverside IL").
 * We strip that so comparisons against the static list don't false-positive
 * a "correction" that's really just a formatting difference.
 */
export function normalizeStoreName(name, state) {
  if (!name) return ''
  const trimmed = String(name).trim()
  if (!state) return trimmed
  const re = new RegExp(`[\\s,-]+${state.trim()}\\s*$`, 'i')
  return trimmed.replace(re, '').trim()
}

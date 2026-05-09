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
  { number: '342',  name: 'Naperville',         state: 'IL' },
  { number: '409',  name: 'Mettawa',            state: 'IL' },
  { number: '580',  name: 'Bedford Park',       state: 'IL' },
  { number: '729',  name: 'Niles',              state: 'IL' },
  { number: '774',  name: 'Lake In The Hills',  state: 'IL' },
  { number: '847',  name: 'Bloomington',        state: 'IL' },
  { number: '1107', name: 'Chicago South Loop', state: 'IL' },
  { number: '1126', name: 'East Peoria',        state: 'IL' },
  { number: '1153', name: 'North Riverside',    state: 'IL' },
  { number: '1212', name: 'Orland Park',        state: 'IL' },
  { number: '1227', name: 'Schaumburg',         state: 'IL' },
  { number: '1228', name: 'Lake Zurich',        state: 'IL' },
  { number: '1289', name: 'Rockford',           state: 'IL' },
  { number: '1320', name: 'Vernon Hills',       state: 'IL' },
  { number: '1410', name: 'Glenview',           state: 'IL' },
  { number: '1466', name: 'Algonquin',          state: 'IL' },
  { number: '1741', name: 'Oak Brook',          state: 'IL' },
]

const _byNumber = Object.fromEntries(COSTCO_STORES_IL.map(s => [s.number, s]))

export function getCostcoStore(number) {
  return _byNumber[String(number)] ?? null
}

export function getCostcoStoreLabel(number) {
  const store = getCostcoStore(number)
  return store ? `${store.name} (${store.number})` : `Store ${number}`
}

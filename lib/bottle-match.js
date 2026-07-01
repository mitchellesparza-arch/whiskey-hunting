/**
 * Shared bottle name-matching primitives.
 *
 * Every fuzzy resolver in the app (catalog, market-prices, search UI, detail
 * page) historically rolled its own normalizer + scorer. They disagreed, and
 * crucially none required the BRAND to agree — so "Jack Daniels 10 Year" scored
 * a positive match against "Eagle Rare 10 Year" purely on the shared "10"/"year"
 * tokens, attaching the wrong bottle's MSRP/distillery/proof.
 *
 * This module centralizes the two gates that prevent cross-bottle contamination:
 *   1. numbersAgree — every age/year/proof number in the query must appear in
 *      the candidate (an exact-number guard).
 *   2. brandAgrees  — the query's most distinctive (longest) significant token
 *      must appear in the candidate, anchoring the brand/line.
 *
 * `nameScore` is a symmetric Jaccard similarity gated by both, and `namesRefer`
 * is a convenience for "do these two names refer to the same bottle?".
 */

/** Lowercase, strip apostrophes/quotes, non-alphanumerics → space, collapse. */
export function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['‘’‛`´ʼ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toks(s) {
  return normName(s).split(' ').filter(Boolean)
}

/** Every numeric token in the query must also appear in the candidate. */
export function numbersAgree(query, candidate) {
  const qn = toks(query).filter(t => /^\d+$/.test(t))
  if (qn.length === 0) return true
  const cn = new Set(toks(candidate).filter(t => /^\d+$/.test(t)))
  return qn.every(n => cn.has(n))
}

/**
 * The query's most distinctive significant token (longest non-numeric token of
 * length >= 3) must appear in the candidate. Using the LONGEST token rather than
 * the first avoids being fooled by shared generic leading words: "Old Forester
 * 1920" anchors on "forester", not "old", so it won't match "Old Fitzgerald".
 */
export function brandAgrees(query, candidate) {
  const sig = toks(query).filter(t => t.length >= 3 && !/^\d+$/.test(t))
  if (sig.length === 0) return true   // nothing to anchor on — numbersAgree handles it
  const brand = sig.reduce((a, b) => (b.length > a.length ? b : a))
  return new Set(toks(candidate)).has(brand)
}

/**
 * Gate: does the candidate plausibly refer to the same bottle line as the query?
 * Directional — the brand anchor is taken from the QUERY (first arg).
 */
export function sameBottleLine(query, candidate) {
  if (!query || !candidate) return false
  return numbersAgree(query, candidate) && brandAgrees(query, candidate)
}

/**
 * Symmetric token similarity (Jaccard), 0..1, gated by brand + numbers.
 * Returns 0 when the brand/numbers don't agree so cross-bottle pairs never score.
 */
export function nameScore(query, candidate) {
  const q = normName(query)
  const c = normName(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (!sameBottleLine(query, candidate)) return 0
  const qs = new Set(toks(query))
  const cs = new Set(toks(candidate))
  const inter = [...qs].filter(t => cs.has(t)).length
  const union = new Set([...qs, ...cs]).size
  return union === 0 ? 0 : inter / union
}

/**
 * "Do these two names refer to the same bottle?" — symmetric, with a similarity
 * floor so a query that is merely a prefix of a different SKU (e.g. "Buffalo
 * Trace" vs "Buffalo Trace Bourbon Cream") does not over-match.
 */
export function namesRefer(a, b, floor = 0.6) {
  if (!a || !b) return false
  if (normName(a) === normName(b)) return true
  return Math.max(nameScore(a, b), nameScore(b, a)) >= floor
}

/**
 * Gated word-overlap score, 0..1 — directional (fraction of the larger side's
 * significant words that overlap, not Jaccard union), with an exact-substring
 * match clamped to at least 0.8. Used by the market-price matchers (static
 * catalog lookup, weekly UA/Binny's refresh) where "candidate name loosely
 * contains query" should score higher than symmetric Jaccard would.
 */
export function overlapScore(query, candidate) {
  if (!sameBottleLine(query, candidate)) return 0
  const q = normName(query), c = normName(candidate)
  if (!q || !c) return 0
  const qWords = q.split(' ').filter(w => w.length >= 3)
  const cWords = c.split(' ').filter(w => w.length >= 3)
  if (!qWords.length || !cWords.length) return 0
  const hits  = qWords.filter(w => cWords.some(cw => cw.includes(w) || w.includes(cw))).length
  const score = hits / Math.max(qWords.length, cWords.length)
  const exact = q.includes(c) || c.includes(q)
  return exact ? Math.max(score, 0.8) : score
}

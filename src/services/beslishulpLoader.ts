import type { BeslishulpTree } from '../utils/beslishulp'

// Same revalidation reasoning as formLoader: the asset lives at a stable URL, so
// a browser that cached it before nginx sent Cache-Control would keep serving an
// old decision tree against a new bundle. 'no-cache' still uses the cache, it
// just checks with the server first (a cheap 304 when nothing changed).
const REVALIDATE: RequestInit = { cache: 'no-cache' }

let treePromise: Promise<BeslishulpTree> | null = null

/** The vendored MinBZK decision tree, fetched once per session.
 *  Caching the promise (not the value) means concurrent callers — the tile and
 *  the AIIA risk view can both mount at once — share a single request. */
export function loadBeslishulpTree(): Promise<BeslishulpTree> {
  if (!treePromise) {
    treePromise = fetch('/beslishulp/ai-verordening.json', REVALIDATE)
      .then((res) => {
        if (!res.ok) throw new Error('Beslishulp AI-verordening kon niet worden geladen')
        return res.json() as Promise<BeslishulpTree>
      })
      .catch((err) => {
        // Don't cache a failure: a transient network error should not disable the
        // beslishulp for the rest of the session.
        treePromise = null
        throw err
      })
  }
  return treePromise
}

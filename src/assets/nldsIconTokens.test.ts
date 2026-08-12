/**
 * Guard rail for the NLDS icon-token family.
 *
 * @nl-rvo/component-library-css draws icons by masking a pseudo-element with
 * `var(--rvo-icon-<naam>)`. Those tokens live in @nl-rvo/assets/icons/index.css,
 * which we deliberately do NOT import (5000 lines, every icon becomes a build
 * asset), so each one we actually need is declared by hand in main.css.
 *
 * Forget one and the mask silently drops out — the pseudo-element then paints
 * as a solid coloured block. That has bitten twice: the chevrons of
 * rvo-expandable-content, and --rvo-icon-vinkje, where the white ::after of a
 * checked rvo-checkbox covered its own blue ::before and every ticked box
 * looked empty (12 aug 2026).
 *
 * This test walks the RVO stylesheet, keeps the rules whose classes this app
 * actually uses, and demands a declaration for every icon token they reference.
 * A new RVO component with a masked icon fails here instead of in production.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

const rvoCss = readFileSync(
  join(root, 'node_modules/@nl-rvo/component-library-css/dist/index.css'),
  'utf8',
)
const tokenCss = readFileSync(
  join(root, 'node_modules/@nl-rvo/design-tokens/dist/index.css'),
  'utf8',
)
const mainCss = readFileSync(join(here, 'main.css'), 'utf8')

/** Every `.rvo-*` / `.utrecht-*` class this app writes in a template or style. */
function collectUsedClasses(): Set<string> {
  const used = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        walk(path)
      } else if (/\.(vue|ts|html|css)$/.test(entry)) {
        for (const m of readFileSync(path, 'utf8').matchAll(/\b(rvo|utrecht)-[a-z0-9_-]+/g)) {
          used.add(m[0])
        }
      }
    }
  }
  walk(join(root, 'src'))
  walk(join(root, 'index.html').replace(/index\.html$/, '') === root ? join(root, 'src') : join(root, 'src'))
  return used
}

/** Naive rule splitter — the inner `sel{body}` pairs are what we need, and an
 *  @media prelude simply rides along in the selector text. */
function rules(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }))
}

const declaredTokens = new Set(
  [...`${tokenCss}\n${mainCss}`.matchAll(/(--rvo-icon-[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
)

describe('NLDS icon tokens', () => {
  const used = collectUsedClasses()

  /** Icon tokens referenced by RVO rules for components this app renders. */
  const required = new Map<string, string>() // token -> first selector needing it
  for (const { selector, body } of rules(rvoCss)) {
    const tokens = [...body.matchAll(/var\((--rvo-icon-[a-z0-9-]+)\)/g)].map((m) => m[1])
    if (tokens.length === 0) continue
    const classes = [...selector.matchAll(/\.((?:rvo|utrecht)-[a-z0-9_-]+)/g)].map((m) => m[1])
    if (!classes.some((c) => used.has(c))) continue
    for (const t of tokens) if (!required.has(t)) required.set(t, selector.slice(0, 80))
  }

  it('finds the components that mask with an icon token', () => {
    // Sanity: if this ever hits zero the walk above is broken, not the CSS.
    expect(required.size).toBeGreaterThan(0)
  })

  it.each([...required.entries()])(
    '%s is declared in main.css (used by %s)',
    (token) => {
      expect(declaredTokens.has(token)).toBe(true)
    },
  )
})

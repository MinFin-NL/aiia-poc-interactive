/**
 * Render smoke test for the two toepassingsscan components.
 *
 * Not a UI spec — it only proves the templates compile and `setup` survives
 * both states (no scan yet / a finished scan), which is the failure mode a
 * pure-logic test cannot catch. SSR keeps it dependency-free: no DOM, no
 * @vue/test-utils.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import ToepassingsscanTile from './ToepassingsscanTile.vue'
import ToepassingsscanModal from './ToepassingsscanModal.vue'
import { deriveKenmerken, SCAN_VERSION } from '../utils/toepassingsscan'

async function render(component: unknown, props: Record<string, unknown> = {}) {
  const app = createSSRApp(component as never, props)
  app.use(createPinia())
  return renderToString(app)
}

describe('toepassingsscan components render', () => {
  it('tile without a run', async () => {
    const html = await render(ToepassingsscanTile, {
      run: null,
      kenmerken: null,
      counts: { verplicht: 0, mogelijk: 0, nvt: 0 },
    })
    expect(html).toContain('Start toepassingsscan')
  })

  it('tile with a run', async () => {
    const answers = { pg: ['ja'], bijzonder: ['bsn'], schaal: ['groot'], gedrag: ['geen'] }
    const html = await render(ToepassingsscanTile, {
      run: { scanVersion: SCAN_VERSION, answers, kenmerken: deriveKenmerken(answers), completedAt: Date.now() },
      kenmerken: deriveKenmerken(answers),
      counts: { verplicht: 3, mogelijk: 2, nvt: 4 },
    })
    expect(html).toContain('persoonsgegevens')
    expect(html).toContain('niet van toepassing')
  })

  it('modal', async () => {
    const html = await render(ToepassingsscanModal)
    expect(html).toContain('Toepassingsscan')
  })
})

/**
 * NL Design System guard rail. The scan is itself a form, so it must use the
 * RVO form components and no bespoke inputs — see the NLDS rule in CLAUDE.md.
 */
describe('NL Design System conformance', () => {
  it('renders the tile as an RVO card with RVO tags', async () => {
    const answers = { pg: ['ja'] }
    const html = await render(ToepassingsscanTile, {
      run: { scanVersion: SCAN_VERSION, answers, kenmerken: deriveKenmerken(answers), completedAt: Date.now() },
      kenmerken: deriveKenmerken(answers),
      counts: { verplicht: 1, mogelijk: 0, nvt: 0 },
    })
    expect(html).toContain('rvo-card')
    expect(html).toContain('rvo-tag rvo-tag--pill')
    expect(html).toContain('rvo-button')
  })

  it('asks the first question with RVO fieldset + radio markup', async () => {
    const html = await render(ToepassingsscanModal)
    expect(html).toContain('rvo-form-fieldset')
    expect(html).toContain('rvo-form-fieldset__legend')
    expect(html).toContain('rvo-radio-button__group')
    // The radio input class RVO actually styles — not rvo-radio-button__input.
    expect(html).toContain('utrecht-radio-button utrecht-radio-button--html-input')
  })

  it('uses no colours of its own', async () => {
    // Raw hex in a scoped <style> means a token was skipped. (The shared modal
    // backdrop rgb() values are inherited from the other dialogs.)
    for (const file of ['ToepassingsscanTile.vue', 'ToepassingsscanModal.vue']) {
      const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
      expect(source, `${file} contains a hard-coded colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { scopeFormsToRoles, type FormIndexEntry, type FormRole } from './formLoader'

// De echte registry, niet een fixture: de rollen verwijzen naar formulier-ids
// en die verwijzing moet blijven kloppen als een formulier wordt hernoemd.
const registry = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/forms/index.json', import.meta.url)), 'utf8'),
) as { forms: FormIndexEntry[]; roles?: FormRole[] }

const roles = registry.roles ?? []

describe('rollen in index.json', () => {
  it('verwijst alleen naar bestaande formulieren', () => {
    const ids = new Set(registry.forms.map((f) => f.id))
    for (const role of roles) {
      for (const formId of role.forms) {
        expect(ids.has(formId), `rol "${role.id}" noemt onbekend formulier "${formId}"`).toBe(true)
      }
    }
  })

  it('geeft elke rol een titel en minstens één formulier', () => {
    for (const role of roles) {
      expect(role.title, `rol "${role.id}" mist een titel`).toBeTruthy()
      expect(role.forms.length, `rol "${role.id}" ziet geen enkel formulier`).toBeGreaterThan(0)
    }
  })

  it('kent projectmanagement de zestien projectformulieren toe', () => {
    const pm = roles.find((r) => r.id === 'projectmanagement')
    expect(pm).toBeDefined()
    // De lijst uit de fase-indeling: de kernvragen vooraf, intake en aanbieding,
    // de initiatiefase, de twee uitvoeringsrapportages en de twee
    // afrondingsformulieren.
    expect(pm!.forms).toEqual([
      'kernvragen', 'intake', 'aanbiedingsformulier', 'ppm', 'psa', 'quickscan', 'prescandpia',
      'dpia', 'aiia', 'ihhtoets', 'cloudtoets', 'bia', 'voortgangsrapportage',
      'afwijkingsformulier', 'evaluatie', 'risicoimpact',
    ])
    // Wat een projectleider níét ziet — de vakinhoudelijke formulieren.
    expect(pm!.forms).not.toContain('iama')
    expect(pm!.forms).not.toContain('verwerkingsregister')
  })
})

describe('scopeFormsToRoles', () => {
  const entries = [{ id: 'intake' }, { id: 'iama' }, { id: 'dpia' }] as FormIndexEntry[]
  const testRoles: FormRole[] = [
    { id: 'projectmanagement', title: 'PM', forms: ['intake', 'dpia'] },
    { id: 'ai', title: 'AI', forms: ['iama'] },
  ]

  it('toont alles aan wie geen inperkende rol heeft', () => {
    expect(scopeFormsToRoles(entries, testRoles, ['gebruiker', 'beheerder'])).toEqual(entries)
    expect(scopeFormsToRoles(entries, testRoles, [])).toEqual(entries)
    expect(scopeFormsToRoles(entries, testRoles, undefined)).toEqual(entries)
  })

  it('beperkt tot de formulieren van de rol', () => {
    const seen = scopeFormsToRoles(entries, testRoles, ['gebruiker', 'projectmanagement'])
    expect(seen.map((f) => f.id)).toEqual(['intake', 'dpia'])
  })

  it('telt meerdere rollen bij elkaar op in plaats van ze te doorsnijden', () => {
    const seen = scopeFormsToRoles(entries, testRoles, ['projectmanagement', 'ai'])
    expect(seen.map((f) => f.id)).toEqual(['intake', 'iama', 'dpia'])
  })

  it('negeert een onbekend formulier-id in een rol', () => {
    const seen = scopeFormsToRoles(entries, [{ id: 'x', title: 'X', forms: ['typo'] }], ['x'])
    expect(seen).toEqual([])
  })

  it('laat het aanbod ongemoeid als er geen rollen geregistreerd zijn', () => {
    expect(scopeFormsToRoles(entries, [], ['projectmanagement'])).toEqual(entries)
  })
})

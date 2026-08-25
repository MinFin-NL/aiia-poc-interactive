import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  KENMERK_IDS,
  evaluateApplicability,
  type ApplicabilityRule,
  type Kenmerken,
} from './toepasselijkheid'

// The real registry, not a fixture: these tests are the guard rail on the
// applicability rules in index.json — the one place kenmerk names live as data.
const index: { forms: { id: string; applicability?: ApplicabilityRule }[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/forms/index.json', import.meta.url)), 'utf8'),
)

function kenmerken(overrides: Partial<Kenmerken>): Kenmerken {
  const base = Object.fromEntries(KENMERK_IDS.map((k) => [k, 'onbekend'])) as Kenmerken
  return { ...base, ...overrides }
}

describe('index.json applicability rules', () => {
  it('only reference kenmerken the kernvragen can derive', () => {
    const known = new Set<string>(KENMERK_IDS)
    for (const form of index.forms) {
      for (const group of form.applicability?.allOf ?? []) {
        expect(group.length, `${form.id}: empty OR group`).toBeGreaterThan(0)
        for (const k of group) {
          expect(known, `${form.id} references unknown kenmerk "${k}"`).toContain(k)
        }
      }
    }
  })

  it('give every conditional form a reason to show on the card', () => {
    for (const form of index.forms) {
      if (!form.applicability) continue
      expect(form.applicability.reason, `${form.id} has no reason`).toBeTruthy()
    }
  })

  it('read every kenmerk — one nothing tests is a question nobody has to answer', () => {
    // The reason the choice questions are six and not eight (docs §7.2).
    const tested = new Set(index.forms.flatMap((f) => f.applicability?.allOf.flat() ?? []))
    expect([...KENMERK_IDS].filter((k) => !tested.has(k))).toEqual([])
  })
})

describe('evaluateApplicability', () => {
  const rule: ApplicabilityRule = {
    allOf: [['algoritme_of_ai'], ['besluit_over_personen', 'raakt_burgers']],
    reason: 'reden',
  }

  it('calls a form without a rule always applicable', () => {
    expect(evaluateApplicability(undefined, kenmerken({})).status).toBe('altijd')
  })

  it('is onbepaald before the kernvragen have been answered', () => {
    expect(evaluateApplicability(rule, null).status).toBe('onbepaald')
  })

  it('requires the form when every group holds', () => {
    const v = evaluateApplicability(rule, kenmerken({ algoritme_of_ai: true, raakt_burgers: true }))
    expect(v.status).toBe('verplicht')
    expect(v.reason).toBe('reden')
  })

  it('rules the form out when one group is decidedly false', () => {
    const v = evaluateApplicability(rule, kenmerken({ algoritme_of_ai: false, raakt_burgers: true }))
    expect(v.status).toBe('nvt')
    expect(v.kenmerken).toEqual(['algoritme_of_ai'])
  })

  it('needs every member of an OR group to be false before ruling out', () => {
    const v = evaluateApplicability(
      rule,
      kenmerken({ algoritme_of_ai: true, besluit_over_personen: false, raakt_burgers: 'onbekend' }),
    )
    expect(v.status).toBe('mogelijk')
  })

  it('never turns an unknown kenmerk into "niet van toepassing"', () => {
    const v = evaluateApplicability(rule, kenmerken({ algoritme_of_ai: 'onbekend', raakt_burgers: true }))
    expect(v.status).toBe('mogelijk')
    expect(v.kenmerken).toEqual(['algoritme_of_ai'])
  })

  it('downgrades an advisory rule to "mogelijk relevant"', () => {
    const v = evaluateApplicability(
      { allOf: [['persoonsgegevens']], reason: 'reden', advisory: true },
      kenmerken({ persoonsgegevens: true }),
    )
    expect(v.status).toBe('mogelijk')
  })
})

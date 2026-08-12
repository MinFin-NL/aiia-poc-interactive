import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { groupFormsByTrack, trackIdFor, trackLabel, connectorGlyph, PHASE_IDS } from './tracks'
import type { FormIndexEntry } from '../services/formLoader'

// The real registry, not a fixture: adding a form with a typo'd track should
// fail here rather than silently in the browser.
const registry: { forms: FormIndexEntry[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/forms/index.json', import.meta.url)), 'utf8'),
)

describe('groupFormsByTrack', () => {
  it('orders the groups by lifecycle phase', () => {
    const groups = groupFormsByTrack(registry.forms)
    expect(groups.map((g) => g.track)).toEqual([
      'intake', 'aanbieding', 'initiatie', 'uitvoering', 'afronding',
    ])
  })

  it('numbers only the real phases; intake and aanbieding get none', () => {
    const groups = groupFormsByTrack(registry.forms)
    expect(groups.map((g) => g.phaseNumber)).toEqual([0, 0, 1, 2, 3])
    expect(new Set(groups.map((g) => g.phaseCount))).toEqual(new Set([PHASE_IDS.length]))
    expect(PHASE_IDS).toEqual(['initiatie', 'uitvoering', 'afronding'])
  })

  it('marks intake and aanbieding as no phase, so the UI can lift them out', () => {
    const groups = groupFormsByTrack(registry.forms)
    const notAPhase = groups.filter((g) => !g.isPhase).map((g) => g.track)
    expect(notAPhase).toEqual(['intake', 'aanbieding'])
    expect(groups.filter((g) => g.isPhase).map((g) => g.track)).toEqual(PHASE_IDS)
  })

  it('sorts the forms inside a group by their order field', () => {
    const shuffled = [...registry.forms].reverse()
    const initiatie = groupFormsByTrack(shuffled).find((g) => g.track === 'initiatie')!
    expect(initiatie.forms.map((f) => f.order)).toEqual([...initiatie.forms.map((_, i) => i + 1)])
    expect(initiatie.forms[0].id).toBe('ppm')
  })

  it('keeps announced-but-unbuilt forms in the registry as placeholders', () => {
    const afronding = groupFormsByTrack(registry.forms).find((g) => g.track === 'afronding')!
    expect(afronding.forms.map((f) => f.id)).toEqual(['evaluatie', 'risicoimpact'])
    // Een placeholder heeft geen JSON-bestand — dat is precies wat hem
    // onklikbaar maakt in de UI.
    expect(afronding.forms.every((f) => f.placeholder)).toBe(true)
    expect(registry.forms.filter((f) => f.placeholder).every((f) => !('file' in f))).toBe(true)
  })

  it('files an unknown track under onbekend and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const groups = groupFormsByTrack([
      { id: 'typo', title: 'Typo', track: 'ontwerp', order: 1 },
      ...registry.forms,
    ])
    const onbekend = groups.find((g) => g.track === 'onbekend')!
    expect(onbekend.forms.map((f) => f.id)).toEqual(['typo'])
    // The bucket sorts last and must not shift the numbering of the real phases.
    expect(groups[groups.length - 1].track).toBe('onbekend')
    expect(groups.find((g) => g.track === 'afronding')!.phaseNumber).toBe(3)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('has no unknown tracks in the shipped registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    groupFormsByTrack(registry.forms)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('trackIdFor / trackLabel', () => {
  it('falls back to onbekend for a missing track', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(trackIdFor(undefined)).toBe('onbekend')
    warn.mockRestore()
    expect(trackLabel('initiatie')).toBe('Initiatiefase')
    expect(trackLabel('nietbestaand')).toBe('Niet ingedeeld')
  })
})

describe('connectorGlyph', () => {
  const group = (track: string, ids: string[]) => ({ track, forms: ids.map((id) => ({ id, title: id })) })

  it('is bidirectional between two assessments', () => {
    expect(connectorGlyph(group('initiatie', ['dpia', 'aiia']), 1)).toBe('↔')
  })

  it('is bidirectional for the ppm/psa pair, one-way into an assessment', () => {
    const initiatie = group('initiatie', ['ppm', 'psa', 'quickscan'])
    expect(connectorGlyph(initiatie, 1)).toBe('↔')
    expect(connectorGlyph(initiatie, 2)).toBe('→')
  })
})

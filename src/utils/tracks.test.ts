import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { groupFormsByTrack, trackIdFor, trackLabel, connectorGlyph, TRACK_IDS } from './tracks'
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
      'verkennen', 'besluiten', 'ontwerpen', 'toetsen', 'ingebruikname', 'beheer',
    ])
  })

  it('numbers the phases 1..n regardless of which ones hold forms', () => {
    const groups = groupFormsByTrack(registry.forms)
    expect(groups.map((g) => g.phaseNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(groups.map((g) => g.phaseCount))).toEqual(new Set([TRACK_IDS.length]))
  })

  it('sorts the forms inside a group by their order field', () => {
    const shuffled = [...registry.forms].reverse()
    const ontwerpen = groupFormsByTrack(shuffled).find((g) => g.track === 'ontwerpen')!
    expect(ontwerpen.forms.map((f) => f.order)).toEqual([1, 2, 3, 4])
  })

  it('keeps the empty beheer phase visible via its emptyHint', () => {
    const beheer = groupFormsByTrack(registry.forms).find((g) => g.track === 'beheer')!
    expect(beheer.forms).toHaveLength(0)
    expect(beheer.emptyHint).toBeTruthy()
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
    expect(groups.find((g) => g.track === 'beheer')!.phaseNumber).toBe(6)
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
    expect(trackLabel('toetsen')).toBe('Toetsen')
    expect(trackLabel('nietbestaand')).toBe('Niet ingedeeld')
  })
})

describe('connectorGlyph', () => {
  const group = (track: string, ids: string[]) => ({ track, forms: ids.map((id) => ({ id, title: id })) })

  it('is bidirectional across the whole toetsen phase', () => {
    expect(connectorGlyph(group('toetsen', ['dpia', 'aiia']), 1)).toBe('↔')
  })

  it('is bidirectional for the ppm/psa pair only', () => {
    const ontwerpen = group('ontwerpen', ['ppm', 'psa', 'datakwaliteit'])
    expect(connectorGlyph(ontwerpen, 1)).toBe('↔')
    expect(connectorGlyph(ontwerpen, 2)).toBe('→')
  })
})

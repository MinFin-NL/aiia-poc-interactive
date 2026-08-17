import { describe, it, expect, afterEach } from 'vitest'
import { onAiBusy, setLocalAiBusy, setLocalUser, type AiBusyPeer } from './dossierTransport'

// Node test path: no WebSocket provider is ever created, so these exercise the
// offline branch — the one that keeps the bar working for a solo user.
describe('AI-busy awareness channel', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn())
    setLocalAiBusy('d1', null)
  })

  function collect(dossierId: string) {
    const seen: AiBusyPeer[][] = []
    cleanups.push(onAiBusy(dossierId, (p) => seen.push(p)))
    return seen
  }

  it('fires immediately with the current (empty) roster', () => {
    expect(collect('d1')).toEqual([[]])
  })

  it('publishes the busy question to subscribers and clears it again', () => {
    const seen = collect('d1')
    setLocalAiBusy('d1', { formId: 'f1', questionId: 'q1' })
    expect(seen.at(-1)).toEqual([
      { clientId: -1, name: expect.any(String), isSelf: true, formId: 'f1', questionId: 'q1' },
    ])
    setLocalAiBusy('d1', null)
    expect(seen.at(-1)).toEqual([])
  })

  it('labels the entry with the local user', () => {
    setLocalUser({ sub: 'u-1', name: 'Laurens' })
    const seen = collect('d1')
    setLocalAiBusy('d1', { formId: 'f1', questionId: 'q1' })
    expect(seen.at(-1)?.[0].name).toBe('Laurens')
  })

  it('keeps dossiers apart', () => {
    const other = collect('d2')
    setLocalAiBusy('d1', { formId: 'f1', questionId: 'q1' })
    expect(other.at(-1)).toEqual([])
  })
})

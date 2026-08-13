import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildFormUrn,
  isFormUrn,
  parseFormUrn,
  FORM_URN_AUTHORITY,
  FORM_URN_REGISTRY,
  PLACEHOLDER_URN_VERSION,
} from './formUrn'
import type { FormIndexEntry } from '../services/formLoader'
import type { FormConfig } from '../models/Assessment'

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../public/forms/${name}`, import.meta.url)), 'utf8'))

// The real registry and the real form files: a form added without a URN, or
// with a URN that drifts from its version, has to fail here rather than ship a
// definition nothing can refer to.
const registry = read<{ forms: (FormIndexEntry & { file?: string })[] }>('index.json').forms

// The upstream shape this convention mirrors — schemas/schema_instruments.json
// in MinBZK/task-registry pins instrument URNs to exactly this.
const UPSTREAM_PATTERN = /^urn:nl:aivt:tr:[a-z]+:[0-9]+\.[0-9]+/

describe('buildFormUrn', () => {
  it('mints in our own authority, in task-registry shape', () => {
    expect(buildFormUrn('dpia', '3.0')).toBe('urn:nl:minfin:tr:dpia:3.0')
  })

  it('rejects an id or version that breaks the convention', () => {
    expect(() => buildFormUrn('model-card', '1.0')).toThrow()
    expect(() => buildFormUrn('modelcard', 'v1')).toThrow()
    expect(() => buildFormUrn('modelcard2', '1.0')).toThrow()
  })

  it('parses back into its segments', () => {
    expect(parseFormUrn('urn:nl:aivt:tr:iama:1.0')).toEqual({
      authority: 'aivt', registry: 'tr', instrument: 'iama', version: '1.0',
    })
    expect(parseFormUrn('urn:nl:minfin:tr:dpia')).toBeNull()
  })
})

describe('the form registry', () => {
  it('gives every form a URN in our authority and registry', () => {
    for (const entry of registry) {
      expect(entry.urn, `${entry.id} mist een urn in index.json`).toBeDefined()
      expect(isFormUrn(entry.urn!), `${entry.id}: ${entry.urn}`).toBe(true)
      expect(parseFormUrn(entry.urn!)).toMatchObject({
        authority: FORM_URN_AUTHORITY,
        registry: FORM_URN_REGISTRY,
        instrument: entry.id,
      })
    }
  })

  it('keeps every URN unique', () => {
    const urns = registry.map((f) => f.urn)
    expect(new Set(urns).size).toBe(urns.length)
  })

  it('versions a real form by its own version and a placeholder by 0.1', () => {
    for (const entry of registry) {
      const version = entry.file
        ? read<FormConfig>(entry.file).version
        : PLACEHOLDER_URN_VERSION
      expect(entry.urn, entry.id).toBe(buildFormUrn(entry.id, version))
    }
  })

  it('repeats the same URN inside the form file itself', () => {
    for (const entry of registry.filter((f) => f.file)) {
      const form = read<FormConfig>(entry.file!)
      expect(form.urn, `${entry.id}: urn ontbreekt in ${entry.file}`).toBe(entry.urn)
      expect(form.registryUrn, `${entry.id}: registryUrn wijkt af`).toBe(entry.registryUrn)
    }
  })

  it('points registryUrn at a real task-registry instrument', () => {
    const withRegistry = registry.filter((f) => f.registryUrn)
    // AIIA, IAMA and the EU-conformiteitsverklaring exist upstream; the rest of
    // our forms have no counterpart there and must not claim one.
    expect(withRegistry.map((f) => f.id).sort()).toEqual(['aiia', 'euaiact', 'iama'])
    for (const entry of withRegistry) {
      expect(entry.registryUrn, entry.id).toMatch(UPSTREAM_PATTERN)
    }
  })
})

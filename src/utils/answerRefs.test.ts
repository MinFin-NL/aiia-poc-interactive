import { describe, it, expect } from 'vitest'
import { isQuestionVisible, dynamicOptions, mergedOptions } from './answerRefs'
import { serializeTableAnswer } from './tableAnswer'
import type { FormConfig } from '../models/Assessment'

// Minimal form: a source table (d2.1) with a "persoonsgegeven" column (id "1"),
// and a checkbox column elsewhere that reads its values.
const form = {
  id: 'dpia',
  sections: [
    {
      id: 's', title: 's', part: 'A',
      subsections: [
        {
          id: 'ss', title: 'ss',
          questions: [
            { id: 'd2.1', text: 't', type: 'table', importance: 'optional', columns: [{ id: '1', label: 'Persoonsgegeven' }, { id: '2', label: 'Bron' }] },
            { id: 'd2.1.1', text: 'radio', type: 'radio', importance: 'optional', options: ['Nee', 'Ja'] },
          ],
        },
      ],
    },
  ],
} as unknown as FormConfig

function answerMap(m: Record<string, string | string[]>) {
  return (id: string) => m[id] ?? ''
}

describe('isQuestionVisible', () => {
  it('shows a question with no visibleIf', () => {
    expect(isQuestionVisible({}, answerMap({}))).toBe(true)
  })
  it('hides until the referenced radio matches', () => {
    const q = { visibleIf: { questionId: 'd2.1.1', equals: 'Ja' } }
    expect(isQuestionVisible(q, answerMap({ 'd2.1.1': 'Nee' }))).toBe(false)
    expect(isQuestionVisible(q, answerMap({ 'd2.1.1': 'Ja' }))).toBe(true)
  })
  it('matches the radio value even with a follow-up appended', () => {
    const q = { visibleIf: { questionId: 'd2.1.1', equals: 'Ja' } }
    expect(isQuestionVisible(q, answerMap({ 'd2.1.1': 'Ja\n---\nsome follow up' }))).toBe(true)
  })
  it('matches against a checkbox (array) answer via includes', () => {
    const q = { visibleIf: { questionId: 'd2.1.1', equals: 'Ja' } }
    expect(isQuestionVisible(q, answerMap({ 'd2.1.1': ['Nee', 'Ja'] }))).toBe(true)
    expect(isQuestionVisible(q, answerMap({ 'd2.1.1': ['Nee'] }))).toBe(false)
  })
})

describe('dynamicOptions / mergedOptions', () => {
  it('reads distinct non-empty values from a source table column', () => {
    const tableVal = serializeTableAnswer({ rows: [['BSN', 'x'], ['NAW', 'y'], ['BSN', 'z'], ['', 'q']], notes: '' })
    const opts = dynamicOptions({ questionId: 'd2.1', column: '1' }, answerMap({ 'd2.1': tableVal }), form)
    expect(opts).toEqual(['BSN', 'NAW'])
  })
  it('merges static options with dynamic ones, deduped', () => {
    const tableVal = serializeTableAnswer({ rows: [['BSN', 'x']], notes: '' })
    const opts = mergedOptions(['BSN', 'e-mail'], { questionId: 'd2.1', column: '1' }, answerMap({ 'd2.1': tableVal }), form)
    expect(opts).toEqual(['BSN', 'e-mail'])
  })
  it('returns empty for an unfilled source', () => {
    expect(dynamicOptions({ questionId: 'd2.1', column: '1' }, answerMap({}), form)).toEqual([])
  })
})

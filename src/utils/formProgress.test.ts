/**
 * "Afgerond" has to mean filled in, not clicked through.
 *
 * SectionView marks a section completed the moment the user presses "Volgende",
 * regardless of what is in the fields. So completedSections alone can never
 * carry the afgerond verdict — the dossier card's "x/y formulieren afgerond"
 * and the phase bars all read from it. These tests pin the split between
 * 'onvolledig' (doorgeklikt, verplichte vragen leeg) and 'afgerond'.
 */
import { describe, it, expect } from 'vitest'
import { formProgress, missingMandatoryBySubsection, missingMandatoryCount } from './formProgress'
import type { FormConfig, Question } from '../models/Assessment'
import type { FormState } from '../stores/assessmentStore'

function q(id: string, extra: Partial<Question> = {}): Question {
  return { id, text: `Vraag ${id}`, type: 'text', importance: 'mandatory', ...extra }
}

const CONFIG: FormConfig = {
  id: 'test',
  version: '1.0',
  title: 'Testformulier',
  meta: {
    homeComponent: 'FormIntro',
    exportLabel: 'Test',
    docTitle: 'Test',
    footerLabel: 'Test',
    filename: 'test',
  },
  features: { riskClassification: false, decisionGate: false, conditionalPartB: true },
  navigation: [
    { type: 'subsections', sectionId: 'a' },
    { type: 'subsections', sectionId: 'b', condition: { storeKey: 'goDecision', value: true } },
    { type: 'specialView', viewId: 'summary' },
  ],
  sections: [
    {
      id: 'a',
      title: 'Deel A',
      part: 'A',
      subsections: [
        {
          id: 'a1',
          title: 'A1',
          questions: [
            q('a1-verplicht'),
            q('a1-aanvullend', { importance: 'optional' }),
            q('a1-conditioneel', { visibleIf: { questionId: 'a1-keuze', equals: 'Ja' } }),
            q('a1-keuze', { type: 'radio', importance: 'optional', options: ['Ja', 'Nee'] }),
          ],
        },
        { id: 'a2', title: 'A2', questions: [q('a2-verplicht')] },
      ],
    },
    {
      id: 'b',
      title: 'Deel B',
      part: 'B',
      subsections: [{ id: 'b1', title: 'B1', questions: [q('b1-verplicht')] }],
    },
  ],
}

function state(overrides: Partial<FormState> = {}): FormState {
  return {
    answers: {},
    currentView: 'home',
    completedSections: [],
    riskLevel: null,
    goDecision: null,
    ...overrides,
  }
}

/** Every step the user walks with deel B switched off. */
const ALL_STEPS_A = ['a1', 'a2']

describe('missingMandatoryBySubsection', () => {
  it('counts only mandatory questions, per subsection', () => {
    const missing = missingMandatoryBySubsection(CONFIG, state())
    expect(missing.get('a1')).toBe(1) // alleen a1-verplicht; a1-conditioneel is verborgen
    expect(missing.get('a2')).toBe(1)
  })

  it('skips a conditional subsection the user never reaches', () => {
    expect(missingMandatoryBySubsection(CONFIG, state()).has('b1')).toBe(false)
    expect(missingMandatoryBySubsection(CONFIG, state({ goDecision: true })).get('b1')).toBe(1)
  })

  it('counts a visibleIf question only once its condition is met', () => {
    const shown = state({ answers: { 'a1-keuze': 'Ja' } })
    expect(missingMandatoryBySubsection(CONFIG, shown).get('a1')).toBe(2)
  })

  it('treats an empty rich-text answer as unanswered', () => {
    for (const empty of ['', '   ', '<p></p>', '<p>&nbsp;</p>']) {
      const s = state({ answers: { 'a1-verplicht': empty } })
      expect(missingMandatoryCount(CONFIG, s), `"${empty}"`).toBe(2)
    }
    const filled = state({ answers: { 'a1-verplicht': '<p>Een antwoord</p>' } })
    expect(missingMandatoryCount(CONFIG, filled)).toBe(1)
  })

  it('treats an empty checkbox array as unanswered', () => {
    expect(missingMandatoryCount(CONFIG, state({ answers: { 'a1-verplicht': [] } }))).toBe(2)
    expect(missingMandatoryCount(CONFIG, state({ answers: { 'a1-verplicht': ['Ja'] } }))).toBe(1)
  })
})

describe('formProgress', () => {
  it('reports onvolledig — not afgerond — when every step is clicked through but empty', () => {
    const p = formProgress(CONFIG, state({ completedSections: ALL_STEPS_A }))
    expect(p.status).toBe('onvolledig')
    expect(p.completed).toBe(p.total)
    expect(p.missingMandatory).toBe(2)
  })

  it('reports afgerond once every visible mandatory question has an answer', () => {
    const p = formProgress(
      CONFIG,
      state({
        completedSections: ALL_STEPS_A,
        answers: { 'a1-verplicht': '<p>x</p>', 'a2-verplicht': '<p>y</p>' },
      }),
    )
    expect(p.status).toBe('afgerond')
    expect(p.missingMandatory).toBe(0)
  })

  it('does not require optional questions', () => {
    const p = formProgress(
      CONFIG,
      state({
        completedSections: ALL_STEPS_A,
        answers: { 'a1-verplicht': 'x', 'a2-verplicht': 'y' },
      }),
    )
    expect(p.status).toBe('afgerond')
  })

  it('keeps deel B out of the verdict until goDecision opens it', () => {
    const answers = { 'a1-verplicht': 'x', 'a2-verplicht': 'y' }
    expect(formProgress(CONFIG, state({ completedSections: ALL_STEPS_A, answers })).status)
      .toBe('afgerond')

    const withB = state({ completedSections: [...ALL_STEPS_A, 'b1'], answers, goDecision: true })
    expect(formProgress(CONFIG, withB).status).toBe('onvolledig')
    expect(formProgress(CONFIG, withB).missingMandatory).toBe(1)
  })

  it('still reports bezig and niet-gestart as before', () => {
    expect(formProgress(CONFIG, state()).status).toBe('niet-gestart')
    expect(formProgress(CONFIG, state({ completedSections: ['a1'] })).status).toBe('bezig')
    expect(formProgress(CONFIG, state({ answers: { 'a1-verplicht': 'x' } })).status).toBe('bezig')
  })
})

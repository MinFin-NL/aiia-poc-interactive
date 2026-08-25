import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  KEUZEVRAGEN,
  KEUZEVRAAG_IDS,
  deriveKenmerken,
  hasKernvragenAnswers,
  migrateScanAnswers,
  type ToepassingsscanRun,
} from './kernvragen'
import {
  KENMERK_IDS,
  activeKenmerken,
  evaluateApplicability,
  unknownKenmerken,
  type ApplicabilityRule,
  type Kenmerken,
} from './toepasselijkheid'
import type { Answers, FormConfig, Question } from '../models/Assessment'
import type { BeslishulpRun } from './beslishulp'

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'))
}

// The real form and the real registry: the whole point of keeping the
// option→kenmerk table in code is that a JSON typo must fail loudly here
// rather than silently switch a rule off.
const form = readJson<FormConfig>('../../public/forms/kernvragen.json')
const index = readJson<{ forms: { id: string; applicability?: ApplicabilityRule }[] }>(
  '../../public/forms/index.json',
)

const questions = new Map<string, Question>(
  form.sections.flatMap((s) => s.subsections).flatMap((sub) => sub.questions.map((q) => [q.id, q])),
)

function beslishulpRun(conclusionId: string, labels: string[] = []): BeslishulpRun {
  return { treeVersion: 'test', steps: [], labels, conclusionId, completedAt: 0 }
}

/**
 * Build kernvragen answers from the old scan option ids.
 *
 * Written through the migration on purpose: it keeps these tests as readable
 * as they were before the kernvragen existed, and every one of them doubles as
 * proof that a dossier from the toepassingsscan era still reaches the same
 * verdict.
 */
function answers(scan: Record<string, string[]>): Answers {
  return migrateScanAnswers({
    scanVersion: '2',
    answers: scan,
    kenmerken: {} as Kenmerken,
    completedAt: 0,
  })
}

describe('the kernvragen form', () => {
  it('asks ten questions, no more', () => {
    const blokken = form.sections.flatMap((s) => s.subsections)
    expect(blokken).toHaveLength(10)
  })

  it('gives every question a unique id', () => {
    const ids = [...questions.keys()]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every kenmerk-bearing option in step with the form', () => {
    for (const [questionId, vraag] of Object.entries(KEUZEVRAGEN)) {
      const question = questions.get(questionId)
      expect(question, `${questionId} is not in kernvragen.json`).toBeDefined()
      const options = question!.options ?? []
      const referenced = [
        ...Object.keys(vraag.sets),
        ...(vraag.onbekend ?? []),
        ...(vraag.exclusief ?? []),
      ]
      for (const label of referenced) {
        expect(options, `${questionId}: "${label}" is not an option`).toContain(label)
      }
    }
  })

  it('only sets kenmerken the question claims to decide', () => {
    for (const [questionId, vraag] of Object.entries(KEUZEVRAGEN)) {
      for (const [label, kenmerken] of Object.entries(vraag.sets)) {
        for (const k of kenmerken) {
          expect(vraag.bepaalt, `${questionId}/"${label}" sets ${k} undeclared`).toContain(k)
        }
      }
    }
  })

  it('leaves every kenmerk except ai_verordening_in_scope derivable here', () => {
    const covered = new Set(Object.values(KEUZEVRAGEN).flatMap((v) => v.bepaalt))
    covered.add('ai_verordening_in_scope') // comes from the beslishulp
    expect([...KENMERK_IDS].filter((k) => !covered.has(k))).toEqual([])
  })

  it('matches the choice questions to their type in the form', () => {
    // A radio answer is a string and a checkbox answer an array; derivation
    // handles both, but a question that switched type would change what
    // "exclusief" and multi-select even mean.
    for (const id of KEUZEVRAAG_IDS) {
      expect(['radio', 'checkbox'], `${id} is not a choice question`).toContain(questions.get(id)?.type)
    }
  })
})

describe('deriveKenmerken', () => {
  it('leaves everything onbekend when nothing has been answered', () => {
    expect(unknownKenmerken(deriveKenmerken({}))).toEqual([...KENMERK_IDS])
  })

  it('concludes false when a question is answered without a setter', () => {
    expect(deriveKenmerken(answers({ dataset: ['nee'] })).eigen_dataset).toBe(false)
  })

  it('keeps "weet ik niet" out of the false bucket', () => {
    expect(deriveKenmerken(answers({ dataset: ['onbekend'] })).eigen_dataset).toBe('onbekend')
  })

  it('ORs the options of a multi-select', () => {
    expect(deriveKenmerken(answers({ oplevering: ['api', 'webapp'] })).gebruikersinterface).toBe(true)
    expect(deriveKenmerken(answers({ oplevering: ['api', 'infra'] })).gebruikersinterface).toBe(false)
  })

  it('lets "geen van deze" win over a contradictory tick', () => {
    // The form's checkbox cannot enforce exclusivity; the conservative reading
    // is that the person meant the exclusive option.
    expect(deriveKenmerken(answers({ gedrag: ['leert', 'geen'] })).algoritme_of_ai).toBe(false)
    expect(deriveKenmerken(answers({ doelgroep: ['burgers', 'intern'] })).raakt_burgers).toBe(false)
  })

  it('ignores answers to questions that no longer exist', () => {
    // A run stored under SCAN_VERSION 1 still carries `bijzonder` and `schaal`.
    const a = answers({ pg: ['ja'], bijzonder: ['gezondheid'], schaal: ['groot'] })
    expect(deriveKenmerken(a).persoonsgegevens).toBe(true)
    expect(activeKenmerken(deriveKenmerken(a))).toEqual(['persoonsgegevens'])
  })

  it('rules out the AI-verordening when there is no algorithm at all', () => {
    expect(deriveKenmerken(answers({ gedrag: ['geen'] })).ai_verordening_in_scope).toBe(false)
  })

  it('takes the verordening verdict from the beslishulp, not from the kernvragen', () => {
    const a = answers({ gedrag: ['leert'] })
    expect(deriveKenmerken(a).ai_verordening_in_scope).toBe('onbekend')
    expect(deriveKenmerken(a, beslishulpRun('11.1')).ai_verordening_in_scope).toBe(false)
    expect(deriveKenmerken(a, beslishulpRun('4.2', ['hoog-risico AI'])).ai_verordening_in_scope).toBe(true)
  })

  it('reports only the kenmerken that hold as tags', () => {
    expect(activeKenmerken(deriveKenmerken(answers({ pg: ['ja'], gedrag: ['geen'] })))).toEqual([
      'persoonsgegevens',
    ])
  })

  it('ignores the narrative answers entirely', () => {
    const a: Answers = { 'kern.aanleiding': '<p>Handhaving loopt vast.</p>' }
    expect(hasKernvragenAnswers(a)).toBe(false)
    expect(unknownKenmerken(deriveKenmerken(a))).toEqual([...KENMERK_IDS])
  })
})

describe('migrating a stored toepassingsscan', () => {
  const run: ToepassingsscanRun = {
    scanVersion: '2',
    answers: { pg: ['ja'], gedrag: ['leert'], besluit: ['neemt'], doelgroep: ['burgers'] },
    kenmerken: {} as Kenmerken,
    completedAt: 0,
  }

  it('turns option ids into the answers the form stores', () => {
    const a = migrateScanAnswers(run)
    expect(a['kern.persoonsgegevens']).toBe('Ja')
    expect(a['kern.gedrag']).toEqual(['Leert van data of past zijn gedrag in de tijd aan'])
    expect(a['kern.besluit']).toBe('Ja, het neemt zo’n besluit of bereidt het voor')
  })

  it('reaches the same kenmerken it did as a scan', () => {
    const k = deriveKenmerken(migrateScanAnswers(run))
    expect(activeKenmerken(k)).toEqual([
      'persoonsgegevens',
      'besluit_over_personen',
      'algoritme_of_ai',
      'raakt_burgers',
    ])
  })

  it('is empty for a dossier that never ran the scan', () => {
    expect(migrateScanAnswers(null)).toEqual({})
    expect(hasKernvragenAnswers(migrateScanAnswers(null))).toBe(false)
  })

  it('drops option ids the kernvragen no longer offer', () => {
    const a = migrateScanAnswers({ ...run, answers: { pg: ['weggevallen'] } })
    expect(a['kern.persoonsgegevens']).toBeUndefined()
  })
})

describe('the matrix in docs §5.4', () => {
  /** Status of every form in the registry for a given set of answers. */
  function statuses(scan: Record<string, string[]>, beslishulp?: BeslishulpRun): Record<string, string> {
    const k = deriveKenmerken(answers(scan), beslishulp)
    return Object.fromEntries(
      index.forms.map((f) => [f.id, evaluateApplicability(f.applicability, k).status]),
    )
  }

  it('keeps intake, kernvragen and quickscan applicable no matter what', () => {
    const s = statuses({ pg: ['nee'], gedrag: ['geen'], dataset: ['nee'], oplevering: ['api'], doelgroep: ['intern'] })
    expect(s.kernvragen).toBe('altijd')
    expect(s.intake).toBe('altijd')
    expect(s.quickscan).toBe('altijd')
  })

  it('rules out the privacy forms for an infrastructure replacement without persoonsgegevens', () => {
    const s = statuses({ pg: ['nee'], gedrag: ['geen'], dataset: ['nee'], oplevering: ['infra'], doelgroep: ['intern'] })
    expect(s.prescandpia).toBe('nvt')
    expect(s.verwerkingsregister).toBe('nvt')
    expect(s.dpia).toBe('nvt')
    expect(s.toegankelijkheid).toBe('nvt')
    expect(s.modelcard).toBe('nvt')
  })

  it('AI without persoonsgegevens: IAMA and DPIA off, Model Card on', () => {
    const s = statuses({
      pg: ['nee'],
      gedrag: ['leert'],
      besluit: ['nee'],
      dataset: ['ja'],
      oplevering: ['api'],
      doelgroep: ['intern'],
    })
    expect(s.dpia).toBe('nvt')
    expect(s.iama).toBe('nvt')
    expect(s.modelcard).toBe('verplicht')
    expect(s.datakwaliteit).toBe('verplicht')
  })

  it('persoonsgegevens without AI is the mirror image', () => {
    const s = statuses({
      pg: ['ja'],
      gedrag: ['geen'],
      besluit: ['nee'],
      dataset: ['nee'],
      oplevering: ['webapp'],
      doelgroep: ['burgers'],
    })
    expect(s.prescandpia).toBe('verplicht')
    expect(s.verwerkingsregister).toBe('verplicht')
    expect(s.modelcard).toBe('nvt')
    expect(s.iama).toBe('nvt')
    expect(s.algoritmeregister).toBe('nvt')
    expect(s.euaiact).toBe('nvt')
    expect(s.toegankelijkheid).toBe('verplicht')
  })

  it('leaves the EU AI Act checklist to the beslishulp', () => {
    const scan = { gedrag: ['leert'], besluit: ['neemt'], doelgroep: ['burgers'] }
    expect(statuses(scan).euaiact).toBe('mogelijk')
    expect(statuses(scan, beslishulpRun('11.1')).euaiact).toBe('nvt')
    expect(statuses(scan, beslishulpRun('4.2', ['hoog-risico AI'])).euaiact).toBe('verplicht')
  })

  it('keeps the project forms off the kenmerken axis entirely', () => {
    const s = statuses({ pg: ['nee'], gedrag: ['geen'], dataset: ['nee'], oplevering: ['infra'], doelgroep: ['intern'] })
    for (const id of ['ppm', 'psa', 'aanbiedingsformulier', 'restrisico']) {
      expect(s[id], `${id} should not be gated by the kernvragen`).toBe('altijd')
    }
  })
})

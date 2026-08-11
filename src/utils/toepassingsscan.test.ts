import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  KENMERK_IDS,
  SCAN_QUESTIONS,
  activeKenmerken,
  deriveKenmerken,
  evaluateApplicability,
  unknownKenmerken,
  visibleQuestions,
  type ApplicabilityRule,
  type KenmerkId,
  type Kenmerken,
  type ScanAnswers,
} from './toepassingsscan'
import type { BeslishulpRun } from './beslishulp'

// The real registry, not a fixture: these tests are the guard rail on the
// applicability rules in index.json — the one place kenmerk names live as data.
const index: { forms: { id: string; applicability?: ApplicabilityRule }[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/forms/index.json', import.meta.url)), 'utf8'),
)

function kenmerken(overrides: Partial<Kenmerken>): Kenmerken {
  const base = Object.fromEntries(KENMERK_IDS.map((k) => [k, 'onbekend'])) as Kenmerken
  return { ...base, ...overrides }
}

function beslishulpRun(conclusionId: string, labels: string[] = []): BeslishulpRun {
  return { treeVersion: 'test', steps: [], labels, conclusionId, completedAt: 0 }
}

describe('index.json applicability rules', () => {
  it('only reference kenmerken the scan can derive', () => {
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
})

describe('scan definition', () => {
  it('has unique question and option ids', () => {
    expect(new Set(SCAN_QUESTIONS.map((q) => q.id)).size).toBe(SCAN_QUESTIONS.length)
    for (const q of SCAN_QUESTIONS) {
      expect(new Set(q.opties.map((o) => o.id)).size, `${q.id} has duplicate option ids`).toBe(q.opties.length)
    }
  })

  it('only sets kenmerken the question claims to decide', () => {
    for (const q of SCAN_QUESTIONS) {
      for (const o of q.opties) {
        for (const k of o.sets ?? []) {
          expect(q.bepaalt, `${q.id}/${o.id} sets ${k} without declaring it`).toContain(k)
        }
      }
    }
  })

  it('gates only on a kenmerk an earlier question decides', () => {
    const decided = new Set<KenmerkId>()
    for (const q of SCAN_QUESTIONS) {
      if (q.alleenAls) expect(decided, `${q.id} gates on a later kenmerk`).toContain(q.alleenAls)
      for (const k of q.bepaalt) decided.add(k)
    }
  })

  it('leaves every kenmerk except ai_verordening_in_scope derivable from the scan', () => {
    const covered = new Set(SCAN_QUESTIONS.flatMap((q) => q.bepaalt))
    covered.add('ai_verordening_in_scope') // comes from the beslishulp
    expect([...KENMERK_IDS].filter((k) => !covered.has(k))).toEqual([])
  })
})

describe('deriveKenmerken', () => {
  it('leaves everything onbekend when nothing has been answered', () => {
    const result = deriveKenmerken({})
    expect(unknownKenmerken(result)).toEqual([...KENMERK_IDS])
  })

  it('concludes false when a question is answered without a setter', () => {
    expect(deriveKenmerken({ dataset: ['nee'] }).eigen_dataset).toBe(false)
  })

  it('keeps "weet ik niet" out of the false bucket', () => {
    expect(deriveKenmerken({ dataset: ['onbekend'] }).eigen_dataset).toBe('onbekend')
  })

  it('ORs the options of a multi-select', () => {
    expect(deriveKenmerken({ oplevering: ['api', 'webapp'] }).gebruikersinterface).toBe(true)
    expect(deriveKenmerken({ oplevering: ['api', 'infra'] }).gebruikersinterface).toBe(false)
  })

  it('rules out gated kenmerken when the gate is false', () => {
    const result = deriveKenmerken({ pg: ['nee'] })
    expect(result.persoonsgegevens).toBe(false)
    expect(result.bijzondere_persoonsgegevens).toBe(false)
    expect(result.grootschalig).toBe(false)
  })

  it('leaves gated kenmerken unknown when the gate is unknown', () => {
    const result = deriveKenmerken({ pg: ['onbekend'], bijzonder: ['gezondheid'] })
    expect(result.bijzondere_persoonsgegevens).toBe('onbekend')
  })

  it('ignores an answer to a question the gate hid', () => {
    // Stale answers from before the gate flipped must not resurrect a kenmerk.
    const answers: ScanAnswers = { pg: ['nee'], bijzonder: ['gezondheid'] }
    expect(deriveKenmerken(answers).bijzondere_persoonsgegevens).toBe(false)
  })

  it('rules out the AI-verordening when there is no algorithm at all', () => {
    expect(deriveKenmerken({ gedrag: ['geen'] }).ai_verordening_in_scope).toBe(false)
  })

  it('takes the verordening verdict from the beslishulp, not from the scan', () => {
    const answers: ScanAnswers = { gedrag: ['leert'] }
    expect(deriveKenmerken(answers).ai_verordening_in_scope).toBe('onbekend')
    expect(deriveKenmerken(answers, beslishulpRun('11.1')).ai_verordening_in_scope).toBe(false)
    expect(deriveKenmerken(answers, beslishulpRun('4.2', ['hoog-risico AI'])).ai_verordening_in_scope).toBe(true)
  })

  it('reports only the kenmerken that hold as tags', () => {
    const result = deriveKenmerken({ pg: ['ja'], bijzonder: ['geen'], gedrag: ['geen'] })
    expect(activeKenmerken(result)).toEqual(['persoonsgegevens'])
  })
})

describe('visibleQuestions', () => {
  it('hides the persoonsgegevens follow-ups once the answer is "nee"', () => {
    const ids = visibleQuestions({ pg: ['nee'] }).map((q) => q.id)
    expect(ids).not.toContain('bijzonder')
    expect(ids).not.toContain('schaal')
  })

  it('shows them again on "ja"', () => {
    expect(visibleQuestions({ pg: ['ja'] }).map((q) => q.id)).toContain('bijzonder')
  })

  it('keeps them visible while the gate is unanswered — nothing is ruled out yet', () => {
    expect(visibleQuestions({}).map((q) => q.id)).toContain('bijzonder')
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

  it('is onbepaald before a scan has been run', () => {
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

describe('the matrix in docs §5.4', () => {
  /** Status of every form in the registry for a given set of answers. */
  function statuses(answers: ScanAnswers, beslishulp?: BeslishulpRun): Record<string, string> {
    const k = deriveKenmerken(answers, beslishulp)
    return Object.fromEntries(
      index.forms.map((f) => [f.id, evaluateApplicability(f.applicability, k).status]),
    )
  }

  it('keeps intake and quickscan applicable no matter what', () => {
    const s = statuses({ pg: ['nee'], gedrag: ['geen'], dataset: ['nee'], oplevering: ['api'], doelgroep: ['intern'] })
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
      bijzonder: ['geen'],
      schaal: ['middel'],
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
    const answers: ScanAnswers = { gedrag: ['leert'], besluit: ['neemt'], doelgroep: ['burgers'] }
    expect(statuses(answers).euaiact).toBe('mogelijk')
    expect(statuses(answers, beslishulpRun('11.1')).euaiact).toBe('nvt')
    expect(statuses(answers, beslishulpRun('4.2', ['hoog-risico AI'])).euaiact).toBe('verplicht')
  })

  it('keeps the project forms off the kenmerken axis entirely', () => {
    const s = statuses({ pg: ['nee'], gedrag: ['geen'], dataset: ['nee'], oplevering: ['infra'], doelgroep: ['intern'] })
    for (const id of ['ppm', 'psa', 'aanbiedingsformulier', 'restrisico']) {
      expect(s[id], `${id} should not be gated by the scan`).toBe('altijd')
    }
  })
})

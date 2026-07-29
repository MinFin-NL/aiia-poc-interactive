import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  answerStep,
  evaluateGuard,
  findQuestion,
  replay,
  resolveTarget,
  riskLevelFor,
  rolesFor,
  verdictSummary,
  isOutOfScope,
  RISK_NEUTRAL_LABELS,
  type BeslishulpTree,
  type BeslishulpStep,
  type GuardNode,
} from './beslishulp'

// The real generated asset, not a fixture: these tests double as the guard rail
// for refreshing the vendored MinBZK snapshot (see vendor/.../PROVENANCE.md).
const tree: BeslishulpTree = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/beslishulp/ai-verordening.json', import.meta.url)), 'utf8'),
)

/** Walk the tree the way a user would, always taking answer `pick(question)`. */
function run(pick: (questionId: string) => number): { steps: BeslishulpStep[]; labels: Set<string>; conclusionId: string | null } {
  let steps: BeslishulpStep[] = []
  for (let guard = 0; guard < 50; guard++) {
    const { position } = replay(tree, steps)
    if (position.kind !== 'question') {
      const { labels } = replay(tree, steps)
      return {
        steps,
        labels,
        conclusionId: position.kind === 'conclusion' ? position.conclusion.conclusionId : null,
      }
    }
    steps = answerStep(position.question, pick(position.question.questionId), steps)
  }
  throw new Error('tree did not terminate within 50 steps')
}

describe('guard evaluation', () => {
  const has = (label: string): GuardNode => ({ op: 'has', label })

  it('evaluates has / not / and / or', () => {
    const labels = new Set(['aanbieder', 'AI-systeem'])
    expect(evaluateGuard(has('aanbieder'), labels)).toBe(true)
    expect(evaluateGuard(has('distributeur'), labels)).toBe(false)
    expect(evaluateGuard({ op: 'not', operand: has('distributeur') }, labels)).toBe(true)
    expect(evaluateGuard({ op: 'and', left: has('aanbieder'), right: has('AI-systeem') }, labels)).toBe(true)
    expect(evaluateGuard({ op: 'and', left: has('aanbieder'), right: has('importeur') }, labels)).toBe(false)
    expect(evaluateGuard({ op: 'or', left: has('importeur'), right: has('AI-systeem') }, labels)).toBe(true)
  })

  it('takes the first matching redirect, in file order', () => {
    const answer = {
      answer: 'x',
      labels: [],
      redirects: [
        { ifSource: '', if: has('distributeur'), nextConclusionId: '16.0.1' },
        { ifSource: '', if: has('aanbieder'), nextQuestionId: '2.3' },
      ],
    }
    expect(resolveTarget(answer, new Set(['aanbieder']))).toEqual({ kind: 'question', questionId: '2.3' })
    expect(resolveTarget(answer, new Set(['aanbieder', 'distributeur']))).toEqual({
      kind: 'conclusion',
      conclusionId: '16.0.1',
    })
  })

  it('reports a dead end when no guard matches', () => {
    const answer = {
      answer: 'x',
      labels: [],
      redirects: [{ ifSource: '', if: has('importeur'), nextQuestionId: '2.3' }],
    }
    expect(resolveTarget(answer, new Set())).toEqual({ kind: 'deadEnd' })
  })
})

describe('the generated asset', () => {
  it('starts at 1.1 and has every question and conclusion reachable by id', () => {
    expect(tree.startQuestionId).toBe('1.1')
    expect(tree.questions.length).toBeGreaterThan(0)
    expect(findQuestion(tree, '1.1')?.question).toMatch(/algoritme/i)
  })

  it('accounts for every label the tree can assign', () => {
    // Either the label carries a risk level (the ladder in beslishulp.ts) or it is
    // explicitly risk-neutral. A vendor refresh that renames a label fails here
    // rather than silently classifying someone's system as 'minimaal'.
    const accountedFor = new Set([
      ...RISK_NEUTRAL_LABELS,
      'verboden AI',
      'hoog-risico AI',
      'systeemrisico',
      'transparantieverplichting',
    ])
    const unknown = tree.labels.filter((l) => !accountedFor.has(l))
    expect(unknown).toEqual([])
  })
})

describe('walking the tree', () => {
  it('"geen algoritme" leaves the verordening out of scope', () => {
    // 1.1 "Bevat de toepassing een algoritme?" -> Nee
    const { labels, conclusionId } = run(() => 1)
    expect(conclusionId).toBe('11.0')
    expect(labels.has('geen algoritme')).toBe(true)
    expect(isOutOfScope(labels)).toBe(true)
    expect(riskLevelFor(labels)).toBe('minimaal')
    expect(verdictSummary(labels, conclusionId)).toBe('Verordening niet van toepassing')
  })

  it('always taking the first answer reaches a conclusion and assigns a role', () => {
    const { labels, conclusionId, steps } = run(() => 0)
    expect(conclusionId).not.toBeNull()
    expect(steps.length).toBeGreaterThan(3)
    // 1.2 answer 1 is "We ontwikkelen enkel" -> aanbieder
    expect(rolesFor(labels)).toContain('aanbieder')
  })

  it('replays a trail into the same labels it was built with', () => {
    const { steps, labels } = run(() => 0)
    const replayed = replay(tree, steps)
    expect([...replayed.labels].sort()).toEqual([...labels].sort())
  })

  it('stepping back drops exactly the labels that step added', () => {
    const { steps } = run(() => 0)
    const full = replay(tree, steps)
    const back = replay(tree, steps.slice(0, -1))
    const dropped = [...full.labels].filter((l) => !back.labels.has(l))
    // Everything dropped must be attributable to the removed step.
    expect(dropped.every((l) => steps[steps.length - 1].labelsAdded.includes(l))).toBe(true)
    expect(back.position.kind).toBe('question')
  })

  it('tolerates a trail that no longer fits the tree', () => {
    const bogus: BeslishulpStep[] = [
      { questionId: '1.1', answerIndex: 0, answerLabel: 'Ja', labelsAdded: [] },
      { questionId: 'does-not-exist', answerIndex: 0, answerLabel: '?', labelsAdded: [] },
    ]
    const { position } = replay(tree, bogus)
    // Stops at the last step that still made sense (question 1.2), never throws.
    expect(position.kind).toBe('question')
    if (position.kind === 'question') expect(position.question.questionId).toBe('1.2')
  })
})

describe('risk level mapping', () => {
  it('is a most-severe-first ladder', () => {
    expect(riskLevelFor(new Set(['verboden AI', 'hoog-risico AI']))).toBe('onaanvaardbaar')
    expect(riskLevelFor(new Set(['hoog-risico AI', 'transparantieverplichting']))).toBe('hoog')
    expect(riskLevelFor(new Set(['transparantieverplichting']))).toBe('beperkt')
    expect(riskLevelFor(new Set(['aanbieder', 'AI-systeem', 'geen hoog-risico AI']))).toBe('minimaal')
  })

  it('reads scope from the conclusion, not from the "niet van toepassing" label', () => {
    // 2.7.1 answers "Nee" with the label `niet van toepassing`, meaning no
    // third-party conformity assessment is needed — NOT that the verordening is
    // inapplicable. Treating it as out of scope would tell a high-risk provider
    // they have no obligations.
    const highRisk = new Set(['hoog-risico AI', 'aanbieder', 'niet van toepassing'])
    expect(isOutOfScope(highRisk, '12.0.2')).toBe(false)
    expect(verdictSummary(highRisk, '12.0.2')).toBe('Hoog risico · aanbieder')

    // The 11.x family is upstream's "verordening niet van toepassing" group.
    expect(isOutOfScope(new Set(['aanbieder']), '11.1')).toBe(true)
    expect(verdictSummary(new Set(['aanbieder']), '11.1')).toBe('Verordening niet van toepassing · aanbieder')
  })

  it('falls back to scope labels when there is no conclusion id', () => {
    expect(isOutOfScope(new Set(['geen algoritme']))).toBe(true)
    expect(isOutOfScope(new Set(['uitzondering van toepassing']))).toBe(true)
    expect(isOutOfScope(new Set(['niet van toepassing']))).toBe(false)
  })

  it('summarises verdict plus roles', () => {
    expect(verdictSummary(new Set(['hoog-risico AI', 'aanbieder']))).toBe('Hoog risico · aanbieder')
    expect(verdictSummary(new Set(['transparantieverplichting', 'aanbieder', 'gebruiksverantwoordelijke']))).toBe(
      'Beperkt risico · aanbieder + gebruiksverantwoordelijke',
    )
  })
})

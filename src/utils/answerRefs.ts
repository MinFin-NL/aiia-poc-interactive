import type { AnswerRef, FormConfig, Question } from '../models/Assessment'
import { parseTableAnswer } from './tableAnswer'

type Answer = string | string[]
type GetAnswer = (questionId: string) => Answer

function findQuestion(form: FormConfig | undefined, id: string): Question | undefined {
  if (!form) return undefined
  for (const s of form.sections)
    for (const ss of s.subsections)
      for (const q of ss.questions) if (q.id === id) return q
  return undefined
}

// DOM-free (this module runs in plain-node tests too), and only ever applied to
// choice answers — an option label is short plain text, never real markup.
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// A radio answer is stored as "value" or "value\n---\nfollow-up"; the value is
// the part before the separator. Answers written before radio values were kept
// out of the rich-text CRDT bucket come back HTML-wrapped ("<p>Ja</p>"), and
// with their separator flattened to " --- " by the HTML round-trip — hence the
// tag strip and the whitespace-tolerant split. An option label never contains
// "---", so splitting on it cannot swallow a real value.
export function radioScalar(v: Answer | undefined): string {
  if (Array.isArray(v)) return ''
  const head = (v ?? '').split(/\s*---\s*/)[0] ?? ''
  return stripTags(head)
}

/** Whether a question should render, given its `visibleIf` and current answers. */
export function isQuestionVisible(q: Pick<Question, 'visibleIf'>, getAnswer: GetAnswer): boolean {
  if (!q.visibleIf) return true
  const v = getAnswer(q.visibleIf.questionId)
  if (Array.isArray(v)) return v.includes(q.visibleIf.equals)
  return radioScalar(v) === q.visibleIf.equals
}

/** Live values referenced by an `optionsFrom`/`AnswerRef` (a column of a table,
 *  the entries of a checkbox, or a single radio value). Deduped, non-empty. */
export function dynamicOptions(ref: AnswerRef, getAnswer: GetAnswer, form?: FormConfig): string[] {
  const raw = getAnswer(ref.questionId)
  let vals: string[] = []
  if (ref.column) {
    const src = findQuestion(form, ref.questionId)
    const idx = src?.columns?.findIndex((c) => c.id === ref.column) ?? -1
    if (idx >= 0) {
      const parsed = parseTableAnswer(typeof raw === 'string' ? raw : '')
      vals = (parsed?.rows ?? []).map((r) => r[idx] ?? '')
    }
  } else if (Array.isArray(raw)) {
    vals = raw
  } else if (typeof raw === 'string' && raw) {
    vals = [radioScalar(raw)]
  }
  return [...new Set(vals.map((v) => v.trim()).filter(Boolean))]
}

/** Static options plus any dynamic ones, deduped in order. */
export function mergedOptions(
  staticOpts: string[] | undefined,
  ref: AnswerRef | undefined,
  getAnswer: GetAnswer,
  form?: FormConfig,
): string[] {
  const dyn = ref ? dynamicOptions(ref, getAnswer, form) : []
  return [...new Set([...(staticOpts ?? []), ...dyn])]
}

import type { FormConfig, Question } from '../models/Assessment'
import { loadCrossFormMappings, loadForm, flattenFormQuestions } from '../services/formLoader'
import { useAssessmentStore } from '../stores/assessmentStore'
import { copyMappingsFor, copyValueFor, isEmptyAnswer } from '../utils/crossFormCopy'
import { mergedOptions } from '../utils/answerRefs'

export interface PrefillSummary {
  /** How many questions were filled in. */
  count: number
  /** The source forms they came from, uppercased for display. */
  sourceFormIds: string[]
}

/**
 * Fill every still-empty question of `form` that has a `mode: 'copy'` mapping
 * with the answer already given in the source form. Runs when the form is
 * opened, so the user sees the shared questions (contactgegevens, aanleiding,
 * doelstelling, …) already answered instead of an empty form — no AI Modus, no
 * per-question clicking.
 *
 * Only empty questions are touched, so it never overwrites the user's own work.
 * Clearing a prefilled answer and reopening the form does fill it again: the
 * answer state records no "deliberately left empty" flag, and refilling from a
 * source the user themselves wrote is the friendlier of the two failure modes.
 */
export async function prefillCopyAnswers(form: FormConfig): Promise<PrefillSummary> {
  const store = useAssessmentStore()
  const empty: PrefillSummary = { count: 0, sourceFormIds: [] }
  if (!store.canEdit) return empty

  const mappings = copyMappingsFor(await loadCrossFormMappings(), form.id)
  if (mappings.length === 0) return empty

  // Source forms supply the question types/columns copyValueFor needs; a form
  // that no longer exists simply disables its mappings.
  const sourceForms = new Map<string, FormConfig | undefined>()
  await Promise.all(
    [...new Set(mappings.map((m) => m.sourceFormId))].map(async (id) => {
      try {
        sourceForms.set(id, await loadForm(id))
      } catch {
        sourceForms.set(id, undefined)
      }
    }),
  )

  const questions = new Map<string, Question>(
    flattenFormQuestions(form).map((q) => [q.id, q]),
  )
  const getAnswer = (formId: string, questionId: string) => store.forms[formId]?.answers[questionId]
  const getTargetAnswer = (questionId: string) => getAnswer(form.id, questionId) ?? ''

  const filled: string[] = []
  for (const mapping of mappings) {
    const question = questions.get(mapping.targetQuestionId)
    if (!question) continue
    // Never overwrite an existing answer — including one an earlier mapping in
    // this same pass just wrote.
    if (!isEmptyAnswer(getAnswer(form.id, question.id))) continue

    const value = copyValueFor(
      mapping,
      question,
      getAnswer,
      sourceForms.get(mapping.sourceFormId),
      mergedOptions(question.options, question.optionsFrom, getTargetAnswer, form),
    )
    if (value === null) continue

    store.setAnswerForForm(form.id, question.id, value)
    filled.push(mapping.sourceFormId)
  }

  return { count: filled.length, sourceFormIds: [...new Set(filled)] }
}

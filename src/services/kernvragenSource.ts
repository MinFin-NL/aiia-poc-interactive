/**
 * The kernvragen as source material for the AI.
 *
 * AI Modus is a retrieval pipeline: it answers a form question from indexed
 * chunks and refuses when it finds nothing (`readyDocIds.length === 0` and the
 * run does not even start). That is the right default — it is what keeps it
 * from inventing a DPIA out of thin air — but it also meant the tool could do
 * nothing at all until somebody uploaded a stack of documents.
 *
 * The kernvragen break that deadlock without weakening the rule: the project
 * leader writes ~500 words about why the project exists, what it does, who it
 * touches and what could go wrong, and *those* get indexed, as an ordinary
 * document, through the ordinary endpoint. Every later answer is then grounded
 * in something a human actually wrote and can be shown back to them.
 *
 * The honesty this buys has to be preserved in the UI: this document is a
 * transcript of the user's own answers, not evidence. `derived` marks it so
 * SourcePanel can say so — an AI answer citing it is a rephrasing of the
 * invuller, not a corroboration by a source.
 */
import type { FormConfig, Question } from '../models/Assessment'
import { useAssessmentStore } from '../stores/assessmentStore'
import { answerPlainText } from '../utils/sourceMatching'
import { isEmptyAnswer } from '../utils/crossFormCopy'

/** Shown in the document list and in every citation that comes out of it. */
export const KERNVRAGEN_DOC_NAME = 'Projectstart — uw eigen antwoorden'

/**
 * Render the answered kernvragen as one plain-text document.
 *
 * Question text included, and grouped under the block headings, because the
 * chunker splits on structure and the retriever matches on words: an answer
 * that reads "Ja, maar alleen als hulpmiddel" is useless on its own and
 * precise under "Ondersteunt of vervangt het systeem een besluit …".
 *
 * Unanswered questions are left out entirely rather than emitted as empty
 * headings, so a half-filled set of kernvragen does not fill the index with
 * chunks that promise an answer and hold none.
 */
export function renderKernvragen(
  form: FormConfig,
  getAnswer: (questionId: string) => string | string[],
): string {
  const blocks: string[] = []

  for (const section of form.sections) {
    for (const sub of section.subsections) {
      const answered = sub.questions.filter((q: Question) => !isEmptyAnswer(getAnswer(q.id)))
      if (answered.length === 0) continue

      const lines = [`## ${sub.title}`, '']
      for (const question of answered) {
        lines.push(question.text, answerPlainText(getAnswer(question.id)).trim(), '')
      }
      blocks.push(lines.join('\n'))
    }
  }

  // Nothing answered means no document, not a document holding only a title —
  // syncKernvragenSource reads the empty string as "remove the transcript".
  if (blocks.length === 0) return ''
  return [form.title, '', ...blocks].join('\n').trim()
}

/**
 * Index the kernvragen for the active dossier, replacing any earlier version.
 *
 * Replace rather than update: the index has no notion of a changed document,
 * and a stale chunk saying "no personal data" next to a fresh one saying the
 * opposite is worse than a second of re-indexing. Best-effort throughout — a
 * failure here must never block leaving the page, it only means AI Modus has
 * nothing to work from yet.
 */
export async function syncKernvragenSource(form: FormConfig): Promise<void> {
  const store = useAssessmentStore()
  const dossier = store.activeDossier
  if (!dossier || !store.canEdit) return

  const content = renderKernvragen(form, (id) => dossier.forms[form.id]?.answers[id] ?? '')

  const existing = dossier.documents.filter((d) => d.derived === 'kernvragen')
  // Nothing answered yet: drop the stale transcript rather than index an empty
  // one, so the document list does not advertise a source with no content.
  if (content === '') {
    for (const doc of existing) await store.removeDocument(doc.id)
    return
  }

  const unchanged = existing.length === 1 && existing[0].content === content
  if (unchanged) return

  for (const doc of existing) await store.removeDocument(doc.id)
  await store.addDocument(KERNVRAGEN_DOC_NAME, content, 'kernvragen')
}

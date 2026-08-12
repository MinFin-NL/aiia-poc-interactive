import { ref, computed } from 'vue'
import { useAssessmentStore } from '../stores/assessmentStore'
import { loadForm, aiFillableQuestions, isAiFillable } from '../services/formLoader'
import {
  bulkExtractFromDocument,
  fetchImageDimensions,
  smoothFormAnswers,
  verifyDocuments,
} from '../services/llmService'
import type { SmoothSection } from '../services/llmService'
import { stripHtml } from '../utils/sourceMatching'
import { isQuestionVisible } from '../utils/answerRefs'
import type { AnswerSource, FormConfig } from '../models/Assessment'

// Module-level singleton — shared across all component instances
const aiModeActive = ref<Set<string>>(new Set())
const aiModeProgress = ref<Record<string, { filled: number; total: number }>>({})
const aiModeDone = ref<Record<string, number>>({})
// Total questions attempted in the last completed run, per form — used to show
// how many were left without an answer.
const aiModeTotal = ref<Record<string, number>>({})
// Question IDs the AI looked at but couldn't answer, per form. Drives the
// per-question "AI vond hier geen antwoord" markers. Transient (not persisted).
const aiModeUnanswered = ref<Record<string, Set<string>>>({})
const aiModeError = ref<Record<string, string>>({})
const aiModeCancelled: Record<string, boolean> = {}
// Final AI Modus phase: deduplicating/tightening the filled longtext answers.
// The server batches them to fit the model, so this counts batches, not
// sections. Drives the "Antwoorden gladstrijken…" banner text.
const aiModePhase = ref<Record<string, { current: number; total: number } | null>>({})
// Pre-smoothing originals per form, session-only — powers both the one-click
// undo of the whole pass and the per-answer "herstel origineel". The dossier id
// pins the undo to the dossier the run happened in. Outlives the done banner:
// per-answer undo lives on the questions themselves, and an entry is dropped
// once the user edits that answer.
const aiModePreSmooth = ref<Record<string, { dossierId: string; originals: Record<string, string> }>>({})
// Answers the smoothing pass rewrote, per form: question id → the HTML it wrote.
// Drives the per-question "gladgestreken" marker. Transient, like
// aiModeUnanswered. The text is kept because the editor echoes our own store
// write back through v-model, which would otherwise read as a user edit and
// clear the marker the moment it appears.
const aiModeSmoothed = ref<Record<string, Record<string, string>>>({})

// Answers with markup beyond plain paragraphs (lists, bold, …) are usually
// user-authored; smoothing works on plaintext and would flatten them.
const RICH_HTML_RE = /<(?!\/?(p|br)\b)[a-z]/i

// Figure attachments (see attachFigures). A figure travels with the prose
// around it, so it surfaces for plenty of loosely-related questions; these two
// caps are what keep "the AI adds the diagram where it belongs" from becoming
// "the same diagram is stapled to twenty answers".
const FIGURE_MAX_RANK = 3 // must be among the top-N retrieved chunks
const FIGURE_MAX_PER_QUESTION = 2

export function useAiMode() {
  const store = useAssessmentStore()

  const readyDocIds = computed(() =>
    store.documents
      .filter((d) => !d.indexing && d.chunkCount && d.chunkCount > 0)
      .map((d) => d.id),
  )

  async function startAiMode(formId: string) {
    if (aiModeActive.value.has(formId) || readyDocIds.value.length === 0) return

    // Capture the dossier the run started in: the user can switch dossiers
    // mid-run and answers must not leak into the newly active one.
    const dossierId = store.activeDossierId
    if (!dossierId) return

    let formConfig
    try {
      formConfig = await loadForm(formId)
    } catch {
      return
    }

    // Sections another party fills in (`aiFill: false`) are left untouched, and
    // don't count toward the progress total either.
    const questions = aiFillableQuestions(formConfig)
    if (questions.length === 0) return

    // Pre-flight: verify documents are actually in the vector store
    const { missing } = await verifyDocuments(store.sessionId, readyDocIds.value)
    if (missing.length === readyDocIds.value.length) {
      // All documents are missing from the index — stale browser state
      aiModeError.value = { ...aiModeError.value, [formId]: 'documenten_niet_gevonden' }
      return
    }

    // Figures already placed in this run, so one diagram lands at its
    // best-matching question instead of on every question that retrieved it.
    const usedFigures = new Set<string>()
    // Only questions flagged for attachments render them (QuestionItem), and
    // that flag marks exactly the diagram-worthy questions — so it doubles as
    // the shortlist of places an extracted figure belongs.
    const figureTargets = new Set(questions.filter((q) => q.allowAttachments).map((q) => q.id))

    delete aiModeError.value[formId]
    aiModeCancelled[formId] = false
    aiModeActive.value = new Set([...aiModeActive.value, formId])
    aiModeProgress.value = { ...aiModeProgress.value, [formId]: { filled: 0, total: questions.length } }
    delete aiModeDone.value[formId]
    aiModeTotal.value = { ...aiModeTotal.value, [formId]: questions.length }
    aiModeUnanswered.value = { ...aiModeUnanswered.value, [formId]: new Set() }

    const filled = await bulkExtractFromDocument({
      sessionId: store.sessionId,
      docIds: readyDocIds.value,
      questions,
      formContext: formConfig.aiContext,
      onAnswer: (qId, value) => store.setAnswerForForm(formId, qId, value, dossierId),
      onSources: (qId, meta) => store.setAnswerSourcesForForm(formId, qId, meta, dossierId),
      onRetrieved: (qId, sources) => {
        if (!figureTargets.has(qId)) return
        // Not awaited: fetching the image only sizes the attachment, and the
        // next question shouldn't wait on it.
        void attachFigures(formId, dossierId, qId, sources, usedFigures)
      },
      onEmpty: (qId) => {
        const set = new Set(aiModeUnanswered.value[formId] ?? [])
        set.add(qId)
        aiModeUnanswered.value = { ...aiModeUnanswered.value, [formId]: set }
      },
      onProgress: (f, t) => {
        aiModeProgress.value = { ...aiModeProgress.value, [formId]: { filled: f, total: t } }
      },
      isCancelled: () => aiModeCancelled[formId] === true,
      // Re-checked live: don't spend a call on a question hidden by its visibleIf,
      // and pick up any that became visible once the AI filled its controller.
      // Reads the run's own dossier (not the active one — the user may switch).
      shouldAnswer: (q) =>
        isQuestionVisible(q, (id) => store.dossiers[dossierId]?.forms[formId]?.answers?.[id] ?? ''),
    })

    if (!aiModeCancelled[formId]) {
      await smoothForm(formId, formConfig, dossierId)
    }

    aiModeActive.value = new Set([...aiModeActive.value].filter((id) => id !== formId))

    if (!aiModeCancelled[formId]) {
      aiModeDone.value = { ...aiModeDone.value, [formId]: filled }
      // Fully-empty run: the banner already says "found nothing", so don't also
      // spam a marker on every single question. Markers are for partial runs.
      if (filled === 0) {
        aiModeUnanswered.value = { ...aiModeUnanswered.value, [formId]: new Set() }
      }
    }
    delete aiModeCancelled[formId]
  }

  /** Attach the figures behind an answer's retrieved chunks to that question.
   *  Callers gate on `allowAttachments` — a figure on any other question would
   *  be invisible in the form yet still surface in the exports.
   *
   *  Picks from the raw retrieval hits rather than the stored citations: a
   *  figure chunk is only its caption, so the grounding filter in
   *  buildAnswerSourceMeta drops it from the citations almost every time.
   *  Only figures whose bytes were extracted (assetId set) can be attached —
   *  see backend/pdfextract.py, which finds embedded raster images but not
   *  vector diagrams. */
  async function attachFigures(
    formId: string,
    dossierId: string,
    questionId: string,
    sources: AnswerSource[],
    usedFigures: Set<string>,
  ) {
    const figures = sources
      .slice(0, FIGURE_MAX_RANK)
      .filter((s) => s.blockType === 'figure' && s.assetId && !usedFigures.has(s.assetId))
      .slice(0, FIGURE_MAX_PER_QUESTION)
    // Claim them all before the first await: the callbacks of two questions
    // can otherwise interleave and both take the same figure.
    for (const source of figures) usedFigures.add(source.assetId!)

    for (const source of figures) {
      const assetId = source.assetId!
      const dims = await fetchImageDimensions(assetId, store.sessionId)
      if (aiModeCancelled[formId]) return
      const page = source.page ? `, pagina ${source.page}` : ''
      store.addAttachmentForForm(
        formId,
        questionId,
        {
          id: assetId,
          filename: `figuur-pagina-${source.page ?? 0}.png`,
          caption: source.figureCaption || `Afbeelding uit ${source.docName}${page}`,
          mimeType: 'image/png',
          ...dims,
          uploadedAt: Date.now(),
          sourceDocId: source.docId,
        },
        dossierId,
      )
    }
  }

  /** Final AI Modus phase: rewrite the form's longtext answers to remove
   *  duplication across them. Applies rewrites directly to the store;
   *  originals are snapshotted for a one-click undo. */
  async function smoothForm(formId: string, formConfig: FormConfig, dossierId: string) {
    const answers = store.dossiers[dossierId]?.forms[formId]?.answers ?? {}
    const originals: Record<string, string> = {}
    const sections: SmoothSection[] = []

    for (const section of formConfig.sections) {
      const eligible: SmoothSection['answers'] = []
      for (const q of section.subsections.flatMap((ss) => ss.questions)) {
        if (!isAiFillable(q, section)) continue
        if (q.type !== 'text' || (q.format && q.format !== 'longtext')) continue
        const value = answers[q.id]
        if (typeof value !== 'string' || !value.trim()) continue
        if (RICH_HTML_RE.test(value)) continue
        const plain = stripHtml(value).trim()
        if (!plain) continue
        eligible.push({ questionId: q.id, questionText: q.text, answer: plain })
        originals[q.id] = value
      }
      if (eligible.length > 0) sections.push({ title: section.title, answers: eligible })
    }

    // A single answer has nothing to be deduplicated against.
    if (Object.keys(originals).length < 2) return

    aiModePreSmooth.value = { ...aiModePreSmooth.value, [formId]: { dossierId, originals } }
    aiModeSmoothed.value = { ...aiModeSmoothed.value, [formId]: {} }
    aiModePhase.value = { ...aiModePhase.value, [formId]: { current: 0, total: sections.length } }
    let rewritten = 0
    try {
      rewritten = await smoothFormAnswers({
        sections,
        onRewrite: (qId, html) => {
          store.setAnswerForForm(formId, qId, html, dossierId)
          markSmoothed(formId, qId, html)
          // The citations were matched against the pre-smoothing text, so flag
          // that the answer has changed since it was extracted.
          store.markAnswerSmoothed(formId, qId, dossierId)
        },
        onSectionProgress: (current, total) => {
          aiModePhase.value = { ...aiModePhase.value, [formId]: { current, total } }
        },
        isCancelled: () => aiModeCancelled[formId] === true,
      })
    } finally {
      const phases = { ...aiModePhase.value }
      delete phases[formId]
      aiModePhase.value = phases
      if (rewritten === 0) clearSmoothingUndo(formId)
    }
  }

  function hasSmoothingUndo(formId: string): boolean {
    return !!aiModePreSmooth.value[formId]
  }

  function markSmoothed(formId: string, questionId: string, html: string) {
    const entries = { ...(aiModeSmoothed.value[formId] ?? {}), [questionId]: html }
    aiModeSmoothed.value = { ...aiModeSmoothed.value, [formId]: entries }
  }

  /** Whether smoothing rewrote this answer and the user hasn't touched it since.
   *  Scoped to the dossier the run happened in — the same form in another
   *  dossier holds different answers. */
  function isAiSmoothed(formId: string, questionId: string): boolean {
    if (aiModePreSmooth.value[formId]?.dossierId !== store.activeDossierId) return false
    return aiModeSmoothed.value[formId]?.[questionId] !== undefined
  }

  /** Drop the marker and the per-answer undo — called when the user edits the
   *  answer themselves, at which point the snapshot no longer describes it.
   *  Passing the current value makes this a no-op while the value is still the
   *  text smoothing wrote, so the editor echoing it back doesn't count as an
   *  edit. */
  function clearAiSmoothed(formId: string, questionId: string, currentValue?: string) {
    const entries = aiModeSmoothed.value[formId]
    if (entries?.[questionId] !== undefined) {
      if (currentValue !== undefined && currentValue === entries[questionId]) return
      const next = { ...entries }
      delete next[questionId]
      aiModeSmoothed.value = { ...aiModeSmoothed.value, [formId]: next }
    }
    const snapshot = aiModePreSmooth.value[formId]
    if (snapshot?.originals[questionId] !== undefined) {
      const originals = { ...snapshot.originals }
      delete originals[questionId]
      if (Object.keys(originals).length > 0) {
        aiModePreSmooth.value = { ...aiModePreSmooth.value, [formId]: { ...snapshot, originals } }
      } else {
        clearSmoothingUndo(formId)
      }
    }
  }

  /** Restore one answer to its pre-smoothing text. */
  function undoSmoothingFor(formId: string, questionId: string) {
    const snapshot = aiModePreSmooth.value[formId]
    const original = snapshot?.originals[questionId]
    if (!snapshot || original === undefined) return
    store.setAnswerForForm(formId, questionId, original, snapshot.dossierId)
    clearAiSmoothed(formId, questionId)
  }

  /** Restore the pre-smoothing answers of the last AI Modus run. Atomic: all
   *  answers are restored in one transaction, so a collaborator sees the undo as
   *  a single coherent change (and it's one server push). */
  function undoSmoothing(formId: string) {
    const snapshot = aiModePreSmooth.value[formId]
    if (!snapshot) return
    store.batchAnswers(snapshot.dossierId, () => {
      for (const [qId, value] of Object.entries(snapshot.originals)) {
        store.setAnswerForForm(formId, qId, value, snapshot.dossierId)
      }
    })
    clearSmoothingUndo(formId)
  }

  function clearSmoothingUndo(formId: string) {
    const next = { ...aiModePreSmooth.value }
    delete next[formId]
    aiModePreSmooth.value = next
    const markers = { ...aiModeSmoothed.value }
    delete markers[formId]
    aiModeSmoothed.value = markers
  }

  /** Whether the AI looked at this question but couldn't answer it. */
  function isAiUnanswered(formId: string, questionId: string): boolean {
    return aiModeUnanswered.value[formId]?.has(questionId) ?? false
  }

  /** Clear a per-question "no answer" marker once the user fills it in. */
  function clearAiUnanswered(formId: string, questionId: string) {
    const set = aiModeUnanswered.value[formId]
    if (!set || !set.has(questionId)) return
    const next = new Set(set)
    next.delete(questionId)
    aiModeUnanswered.value = { ...aiModeUnanswered.value, [formId]: next }
  }

  function cancelAiMode(formId: string) {
    aiModeCancelled[formId] = true
    aiModeActive.value = new Set([...aiModeActive.value].filter((id) => id !== formId))
    const progress = aiModeProgress.value[formId]
    if (progress && progress.filled > 0) {
      aiModeDone.value = { ...aiModeDone.value, [formId]: progress.filled }
    }
  }

  function dismissAiModeDone(formId: string) {
    const next = { ...aiModeDone.value }
    delete next[formId]
    aiModeDone.value = next
    const totals = { ...aiModeTotal.value }
    delete totals[formId]
    aiModeTotal.value = totals
    // Per-question markers persist until the user fills each question, so they
    // survive dismissing the banner. The smoothing snapshot stays too: the
    // per-answer "herstel origineel" lives on the questions, not the banner.
  }

  function dismissAiModeError(formId: string) {
    const next = { ...aiModeError.value }
    delete next[formId]
    aiModeError.value = next
  }

  return {
    aiModeActive,
    aiModeProgress,
    aiModeDone,
    aiModeTotal,
    aiModeUnanswered,
    aiModeError,
    aiModePhase,
    readyDocIds,
    startAiMode,
    cancelAiMode,
    dismissAiModeDone,
    dismissAiModeError,
    isAiUnanswered,
    clearAiUnanswered,
    hasSmoothingUndo,
    undoSmoothing,
    isAiSmoothed,
    clearAiSmoothed,
    undoSmoothingFor,
  }
}

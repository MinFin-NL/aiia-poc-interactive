<template>
  <dialog
    ref="dialogEl"
    class="invulhulp-modal beslishulp"
    aria-labelledby="beslishulp-title"
    @click="onBackdropClick"
    @close="onDialogClose"
  >
    <div class="invulhulp-modal__container beslishulp__container">

      <header class="beslishulp__header">
        <div class="beslishulp__brand">
          <span class="beslishulp__brand-icon" aria-hidden="true" />
          <div>
            <h2 id="beslishulp-title" class="beslishulp__title">Beslishulp AI-verordening</h2>
            <p class="beslishulp__subtitle">
              Bepaal of de AI-verordening op jouw toepassing van toepassing is — en zo ja, met welke verplichtingen.
            </p>
          </div>
        </div>
        <button type="button" class="beslishulp__close" aria-label="Sluiten" @click="close">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <!-- Phase rail: the tree has two substantive stages plus the conclusion. -->
      <ol class="beslishulp__phases" aria-label="Voortgang">
        <li
          v-for="phase in PHASES"
          :key="phase.id"
          class="beslishulp__phase"
          :class="{
            'beslishulp__phase--active': currentPhase === phase.id,
            'beslishulp__phase--done': phaseIndex(phase.id) < phaseIndex(currentPhase),
          }"
          :aria-current="currentPhase === phase.id ? 'step' : undefined"
        >
          {{ phase.label }}
        </li>
      </ol>

      <div class="beslishulp__body">

        <p v-if="loading" class="rvo-text beslishulp__status">Beslishulp laden…</p>

        <div v-else-if="loadError" class="rvo-alert rvo-alert--error rvo-alert--padding-md" role="alert">
          <div class="rvo-alert__container">{{ loadError }}</div>
        </div>

        <!-- ---------------- Question ---------------- -->
        <template v-else-if="position?.kind === 'question'">
          <p class="beslishulp__kicker">
            {{ position.question.categoryLabel ?? 'Vraag' }}
            <span aria-hidden="true">·</span>
            {{ position.question.subcategory }}
            <span class="beslishulp__step-count">Stap {{ steps.length + 1 }}</span>
          </p>

          <h3 class="beslishulp__question">{{ position.question.question }}</h3>

          <!-- Vendored MinBZK markup (bold/bullets/<br>), not user input. -->
          <div
            v-if="position.question.explanation"
            class="beslishulp__explanation"
            v-html="position.question.explanation"
          />

          <ul class="beslishulp__answers" :class="{ 'beslishulp__answers--grid': useAnswerGrid }">
            <li v-for="(answer, index) in position.question.answers" :key="index">
              <button type="button" class="beslishulp__answer" @click="choose(index)">
                <span class="beslishulp__answer-text">{{ answer.answer }}</span>
                <span class="beslishulp__answer-arrow" aria-hidden="true">→</span>
              </button>
            </li>
          </ul>

          <details v-if="relevantDefinitions.length > 0" class="rvo-expandable-content rvo-expandable-content--subtle beslishulp__details">
            <summary class="rvo-expandable-content__summary rvo-text rvo-text--sm">
              Begrippen in deze vraag ({{ relevantDefinitions.length }})
            </summary>
            <div class="rvo-expandable-content__details">
              <dl class="beslishulp__definitions">
                <template v-for="def in relevantDefinitions" :key="def.term">
                  <dt>{{ def.term }}</dt>
                  <dd>{{ def.definition }}</dd>
                </template>
              </dl>
            </div>
          </details>

          <details v-if="position.question.sources.length > 0" class="rvo-expandable-content rvo-expandable-content--subtle beslishulp__details">
            <summary class="rvo-expandable-content__summary rvo-text rvo-text--sm">
              Bronnen bij deze vraag ({{ position.question.sources.length }})
            </summary>
            <div class="rvo-expandable-content__details">
              <ul class="rvo-ul beslishulp__sources">
                <li v-for="src in position.question.sources" :key="src.url">
                  <a class="rvo-link" :href="src.url" target="_blank" rel="noopener noreferrer">{{ src.source }}</a>
                </li>
              </ul>
            </div>
          </details>
        </template>

        <!-- ---------------- Conclusion ---------------- -->
        <template v-else-if="position?.kind === 'conclusion'">
          <div class="rvo-alert rvo-alert--padding-md beslishulp__verdict" :class="`rvo-alert--${alertModifier}`">
            <div class="rvo-alert__container">
              <strong>{{ verdictLine }}</strong>
              <span v-if="savedNotice" class="beslishulp__saved">{{ savedNotice }}</span>
            </div>
          </div>

          <p class="rvo-text beslishulp__conclusion">{{ position.conclusion.conclusion }}</p>

          <section v-if="position.conclusion.obligation" class="beslishulp__obligation-block">
            <h4 class="beslishulp__section-title">Wat betekent dit voor jou?</h4>
            <!-- Vendored MinBZK markup: the obligation lists are HTML upstream. -->
            <div class="beslishulp__obligation" v-html="position.conclusion.obligation" />
          </section>

          <section v-if="labelList.length > 0">
            <h4 class="beslishulp__section-title">Vastgestelde kenmerken</h4>
            <ul class="beslishulp__labels">
              <li v-for="label in labelList" :key="label" class="beslishulp__label">{{ label }}</li>
            </ul>
          </section>

          <details class="rvo-expandable-content rvo-expandable-content--subtle beslishulp__details">
            <summary class="rvo-expandable-content__summary rvo-text rvo-text--sm">
              Jouw antwoorden ({{ steps.length }})
            </summary>
            <div class="rvo-expandable-content__details">
              <ol class="beslishulp__trail">
                <li v-for="(step, index) in steps" :key="index">
                  <span class="beslishulp__trail-q">{{ questionTextFor(step.questionId) }}</span>
                  <span class="beslishulp__trail-a">{{ step.answerLabel }}</span>
                  <button type="button" class="rvo-link beslishulp__trail-back" @click="rewindTo(index)">
                    Terug naar deze vraag
                  </button>
                </li>
              </ol>
            </div>
          </details>

          <details v-if="position.conclusion.sources.length > 0" class="rvo-expandable-content rvo-expandable-content--subtle beslishulp__details">
            <summary class="rvo-expandable-content__summary rvo-text rvo-text--sm">
              Bronnen bij deze conclusie ({{ position.conclusion.sources.length }})
            </summary>
            <div class="rvo-expandable-content__details">
              <ul class="rvo-ul beslishulp__sources">
                <li v-for="src in position.conclusion.sources" :key="src.url">
                  <a class="rvo-link" :href="src.url" target="_blank" rel="noopener noreferrer">{{ src.source }}</a>
                </li>
              </ul>
            </div>
          </details>
        </template>

        <!-- ---------------- Dead end ----------------
             Upstream writes no fallback redirect, so a combination of answers can
             in principle match no route. Say so plainly instead of freezing. -->
        <div v-else-if="position?.kind === 'deadEnd'" class="rvo-alert rvo-alert--warning rvo-alert--padding-md" role="alert">
          <!-- One element inside the container: rvo-alert lays its children out in a row. -->
          <div class="rvo-alert__container">
            <div>
              <strong>Geen vervolgvraag gevonden.</strong><br />
              Deze combinatie van antwoorden leidt in de beslisboom niet naar een vervolgvraag of conclusie.
              Ga een stap terug en kies een ander antwoord, of raadpleeg
              <a class="rvo-link" href="mailto:ai-verordening@minbzk.nl">ai-verordening@minbzk.nl</a>.
            </div>
          </div>
        </div>
      </div>

      <footer class="beslishulp__footer">
        <div class="beslishulp__footer-actions">
          <button
            v-if="steps.length > 0"
            type="button"
            class="rvo-button rvo-button--tertiary rvo-button--size-sm"
            @click="back"
          >
            ← Vorige vraag
          </button>
          <button
            v-if="steps.length > 0"
            type="button"
            class="rvo-button rvo-button--tertiary rvo-button--size-sm"
            @click="restart"
          >
            Opnieuw beginnen
          </button>
          <button
            v-if="position?.kind === 'conclusion'"
            type="button"
            class="rvo-button rvo-button--primary rvo-button--size-sm beslishulp__done"
            @click="close"
          >
            Sluiten
          </button>
        </div>
        <p class="beslishulp__credit">
          Beslisboom:
          <a class="rvo-link" :href="tree?.source.repository" target="_blank" rel="noopener noreferrer">
            Beslishulp AI-verordening
          </a>
          — AI Validatieteam, MinBZK (EUPL-1.2). Geen juridisch advies.
        </p>
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { loadBeslishulpTree } from '../services/beslishulpLoader'
import { useAssessmentStore } from '../stores/assessmentStore'
import { useAuthStore } from '../stores/authStore'
import {
  answerStep,
  isOutOfScope,
  replay,
  riskLevelFor,
  verdictSummary,
  type BeslishulpDefinition,
  type BeslishulpStep,
  type BeslishulpTree,
} from '../utils/beslishulp'

const emit = defineEmits<{ completed: [] }>()

const store = useAssessmentStore()
const auth = useAuthStore()

const dialogEl = ref<HTMLDialogElement | null>(null)
const tree = ref<BeslishulpTree | null>(null)
const loading = ref(false)
const loadError = ref('')
const steps = ref<BeslishulpStep[]>([])
const savedNotice = ref('')

const state = computed(() => (tree.value ? replay(tree.value, steps.value) : null))
const position = computed(() => state.value?.position ?? null)
const labelList = computed(() => [...(state.value?.labels ?? [])].sort())

// ---- Phase rail -----------------------------------------------------------
// The upstream tree tags every question with a category; those two categories
// plus the conclusion are exactly the stages the user experiences.
const PHASES = [
  { id: 'van_toepassing', label: '1. Geldt de verordening?' },
  { id: 'risicogroep', label: '2. Welke risicogroep?' },
  { id: 'conclusie', label: '3. Conclusie' },
] as const
type PhaseId = (typeof PHASES)[number]['id']

const currentPhase = computed((): PhaseId => {
  const pos = position.value
  if (!pos || pos.kind !== 'question') return 'conclusie'
  // 'tussenscherm' is the interstitial between the two stages; it announces the
  // risk-group stage, so show it as part of that stage.
  return pos.question.category === 'van_toepassing' ? 'van_toepassing' : 'risicogroep'
})

function phaseIndex(id: PhaseId): number {
  return PHASES.findIndex((p) => p.id === id)
}

// ---- Verdict --------------------------------------------------------------
const verdictLine = computed(() =>
  verdictSummary(
    state.value?.labels ?? new Set(),
    position.value?.kind === 'conclusion' ? position.value.conclusion.conclusionId : null,
  ),
)

const alertModifier = computed(() => {
  const conclusionId = position.value?.kind === 'conclusion' ? position.value.conclusion.conclusionId : null
  if (isOutOfScope(state.value?.labels ?? new Set(), conclusionId)) return 'info'
  switch (riskLevelFor(state.value?.labels ?? new Set())) {
    case 'onaanvaardbaar': return 'error'
    case 'hoog': return 'warning'
    case 'beperkt': return 'info'
    default: return 'success'
  }
})

// ---- Glossary -------------------------------------------------------------
// Terms from the vendored Algoritmekader begrippenlijst that literally occur in
// the question being asked. Cheap (108 terms) and keeps the definitions where
// they help, instead of behind a separate glossary nobody opens.
const relevantDefinitions = computed((): BeslishulpDefinition[] => {
  const pos = position.value
  if (!tree.value || pos?.kind !== 'question') return []
  const haystack = `${pos.question.question} ${pos.question.explanation}`
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
  return Object.values(tree.value.definitions)
    .filter((d) => {
      const term = d.term.toLowerCase()
      if (term.length < 4) return false
      const at = haystack.indexOf(term)
      if (at === -1) return false
      // Word boundary on both sides, so "AI-systeem" doesn't match inside
      // "AI-systeem voor algemene doeleinden" and drag in the wrong definition.
      const before = haystack[at - 1] ?? ' '
      const after = haystack[at + term.length] ?? ' '
      return !/[a-z0-9-]/.test(before) && !/[a-z0-9-]/.test(after)
    })
    .sort((a, b) => b.term.length - a.term.length)
    .slice(0, 8)
})

/**
 * Long option lists (question 1.2 has nine) push the question and its
 * explanation off the top of a one-per-row list. Short options get a two-column
 * grid instead, which halves the height; genuinely long options stay stacked,
 * because two columns would just make them wrap into the same space.
 */
const useAnswerGrid = computed(() => {
  const pos = position.value
  if (pos?.kind !== 'question' || pos.question.answers.length < 4) return false
  return pos.question.answers.every((a) => a.answer.length <= 70)
})

function questionTextFor(questionId: string): string {
  return tree.value?.questions.find((q) => q.questionId === questionId)?.question ?? questionId
}

// ---- Flow -----------------------------------------------------------------
function choose(answerIndex: number) {
  const pos = position.value
  if (pos?.kind !== 'question') return
  steps.value = answerStep(pos.question, answerIndex, steps.value)
  persistIfConcluded()
}

function back() {
  steps.value = steps.value.slice(0, -1)
  savedNotice.value = ''
}

function rewindTo(index: number) {
  steps.value = steps.value.slice(0, index)
  savedNotice.value = ''
}

function restart() {
  steps.value = []
  savedNotice.value = ''
}

/** A finished run is recorded on the dossier straight away — the whole point is
 *  that the outcome outlives the modal. Read-only (shared) dossiers keep the
 *  result on screen but write nothing. */
function persistIfConcluded() {
  const pos = position.value
  if (pos?.kind !== 'conclusion' || !tree.value) return
  if (!store.canEdit) {
    savedNotice.value = 'Niet opgeslagen — u heeft leesrechten op dit dossier.'
    return
  }
  store.setBeslishulpRun({
    treeVersion: tree.value.version,
    steps: [...steps.value],
    labels: [...(state.value?.labels ?? [])].sort(),
    conclusionId: pos.conclusion.conclusionId,
    completedAt: Date.now(),
    completedBy: auth.user?.name ?? auth.user?.email ?? undefined,
  })
  savedNotice.value = 'Opgeslagen in dit dossier'
  emit('completed')
}

// ---- Open / close ---------------------------------------------------------
async function open() {
  savedNotice.value = ''
  dialogEl.value?.showModal()
  if (!tree.value && !loading.value) {
    loading.value = true
    loadError.value = ''
    try {
      tree.value = await loadBeslishulpTree()
      resumeFromDossier()
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Beslishulp kon niet worden geladen.'
    } finally {
      loading.value = false
    }
  } else {
    resumeFromDossier()
  }
}

/** Reopen on the stored outcome rather than back at question 1 — unless the
 *  user is mid-run, in which case their unfinished trail wins. */
function resumeFromDossier() {
  if (steps.value.length > 0) return
  const run = store.beslishulpRun
  if (run) steps.value = [...run.steps]
}

function close() {
  dialogEl.value?.close()
}

function onDialogClose() {
  savedNotice.value = ''
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialogEl.value) close()
}

defineExpose({ open })
</script>

<style scoped>
/* Modal shell mirrors ConfirmDialog/DocumentViewerModal (their styles are scoped). */
.invulhulp-modal {
  border: 0;
  padding: 0;
  background: transparent;
  max-inline-size: min(820px, 94vw);
  inline-size: 100%;
  margin-block-start: 4vh;
  color: inherit;
}

.invulhulp-modal::backdrop {
  background: rgb(15 45 92 / 55%);
}

.beslishulp__container {
  background: var(--rvo-color-wit);
  border-radius: var(--rvo-border-radius-lg);
  box-shadow: 0 0 1.5em 0 rgb(0 0 0 / 35%);
  display: flex;
  flex-direction: column;
  max-block-size: 92vh;
  overflow: hidden;
}

/* --- Header --- */
.beslishulp__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--rvo-space-sm);
  padding: var(--rvo-space-lg) var(--rvo-space-lg) var(--rvo-space-md);
  background: linear-gradient(135deg, var(--rvo-color-lintblauw) 0%, #1e3a6d 60%, #2a4a80 100%);
  color: var(--rvo-color-wit);
}

.beslishulp__brand {
  display: flex;
  align-items: flex-start;
  gap: var(--rvo-space-sm);
}

.beslishulp__brand-icon {
  inline-size: 2rem;
  block-size: 2rem;
  flex-shrink: 0;
  background-color: currentColor;
  /* Static stylesheet url(): a runtime url() renders as a white square in the
     production build (see the NLDS icon-mask note in DossierDetail.vue). */
  -webkit-mask: url('@nl-rvo/assets/icons/gebruiksvoorwerpen/weegschaal.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/gebruiksvoorwerpen/weegschaal.svg') center / contain no-repeat;
}

.beslishulp__title {
  margin: 0;
  font-size: var(--rvo-font-size-xl);
  font-weight: var(--rvo-font-weight-bold);
  color: var(--rvo-color-wit);
}

.beslishulp__subtitle {
  margin: var(--rvo-space-3xs) 0 0;
  font-size: var(--rvo-font-size-sm);
  color: rgb(255 255 255 / 0.8);
  max-inline-size: 52ch;
}

.beslishulp__close {
  background: none;
  border: 0;
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
  color: rgb(255 255 255 / 0.8);
  padding: 0 var(--rvo-space-3xs);
}

.beslishulp__close:hover {
  color: var(--rvo-color-wit);
}

/* --- Phase rail --- */
.beslishulp__phases {
  display: flex;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--rvo-color-lichtblauw-150);
  border-block-end: 1px solid var(--invulhulp-color-border);
}

.beslishulp__phase {
  flex: 1;
  padding: var(--rvo-space-2xs) var(--rvo-space-sm);
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  font-weight: var(--rvo-font-weight-semibold);
  color: var(--invulhulp-color-text-subtle);
  text-align: center;
  border-block-end: 3px solid transparent;
}

.beslishulp__phase--done {
  color: var(--rvo-color-lintblauw);
  border-block-end-color: var(--rvo-color-lichtblauw-300);
}

.beslishulp__phase--active {
  color: var(--rvo-color-lintblauw);
  background: var(--rvo-color-wit);
  border-block-end-color: var(--rvo-color-lintblauw);
}

/* --- Body --- */
.beslishulp__body {
  padding: var(--rvo-space-lg);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-md);
}

.beslishulp__status {
  margin: 0;
  color: var(--invulhulp-color-text-subtle);
}

.beslishulp__kicker {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-2xs);
  margin: 0;
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--invulhulp-color-text-subtle);
}

.beslishulp__step-count {
  margin-inline-start: auto;
  text-transform: none;
  letter-spacing: 0;
}

.beslishulp__question {
  margin: 0;
  font-size: var(--rvo-font-size-lg);
  font-weight: var(--rvo-font-weight-bold);
  line-height: var(--rvo-line-height-md);
  color: var(--rvo-color-lintblauw);
}

.beslishulp__explanation,
.beslishulp__obligation {
  font-size: var(--rvo-font-size-sm);
  line-height: var(--rvo-line-height-lg);
  color: var(--invulhulp-color-text-subtle);
  max-block-size: 22rem;
  /* Scroll internally instead of being squeezed to a clipped single line by the
     flex column when the answer list is tall. */
  flex-shrink: 0;
  overflow-y: auto;
  padding: var(--rvo-space-sm) var(--rvo-space-md);
  background: var(--rvo-color-lichtblauw-150);
  border-inline-start: 3px solid var(--rvo-color-lichtblauw-300);
  border-radius: var(--rvo-border-radius-sm);
}

.beslishulp__explanation :deep(strong),
.beslishulp__obligation :deep(strong) {
  color: var(--rvo-color-zwart);
}

/* --- Answers --- */
.beslishulp__answers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-2xs);
  /* Never shrink away under the explanation: the options are the point of the screen. */
  flex-shrink: 0;
}

/* Short option lists: two columns, so nine answers cost five rows instead of nine. */
.beslishulp__answers--grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
  align-items: stretch;
}

.beslishulp__answers--grid .beslishulp__answer {
  block-size: 100%;
}

.beslishulp__answer {
  inline-size: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rvo-space-sm);
  text-align: start;
  font: inherit;
  font-size: var(--rvo-font-size-md);
  cursor: pointer;
  padding: var(--rvo-space-sm) var(--rvo-space-md);
  background: var(--rvo-color-wit);
  border: 1px solid var(--invulhulp-color-border);
  border-radius: var(--rvo-border-radius-md);
  color: var(--rvo-color-zwart);
  transition: border-color var(--invulhulp-duration-instant), background var(--invulhulp-duration-instant), transform var(--invulhulp-duration-instant);
}

.beslishulp__answer:hover {
  border-color: var(--rvo-color-lintblauw);
  background: var(--rvo-color-lichtblauw-150);
  transform: translateX(2px);
}

.beslishulp__answer-arrow {
  color: var(--rvo-color-lintblauw);
  flex-shrink: 0;
}

/* --- Conclusion --- */
.beslishulp__verdict .rvo-alert__container {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--rvo-space-sm);
  flex-wrap: wrap;
}

.beslishulp__saved {
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  color: var(--invulhulp-color-text-subtle);
}

.beslishulp__conclusion {
  margin: 0;
}

.beslishulp__section-title {
  margin: 0 0 var(--rvo-space-2xs);
  font-size: var(--rvo-font-size-md);
  font-weight: var(--rvo-font-weight-bold);
  color: var(--rvo-color-lintblauw);
}

.beslishulp__labels {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rvo-space-2xs);
  list-style: none;
  margin: 0;
  padding: 0;
}

.beslishulp__label {
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  padding: 0 var(--rvo-space-2xs);
  background: var(--rvo-color-lichtblauw-150);
  border: 1px solid var(--rvo-color-lichtblauw-300);
  border-radius: var(--rvo-border-radius-md);
  color: var(--rvo-color-lintblauw);
}

/* --- Trail & sources --- */
.beslishulp__details {
  margin: 0;
}

.beslishulp__definitions {
  margin: 0;
  font-size: var(--rvo-font-size-sm);
}

.beslishulp__definitions dt {
  font-weight: var(--rvo-font-weight-semibold);
  color: var(--rvo-color-lintblauw);
}

.beslishulp__definitions dd {
  margin: 0 0 var(--rvo-space-xs);
  color: var(--invulhulp-color-text-subtle);
}

.beslishulp__sources {
  margin: 0;
  font-size: var(--rvo-font-size-sm);
}

.beslishulp__trail {
  margin: 0;
  padding-inline-start: var(--rvo-space-lg);
  font-size: var(--rvo-font-size-sm);
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-2xs);
}

.beslishulp__trail-q {
  display: block;
  color: var(--invulhulp-color-text-subtle);
}

.beslishulp__trail-a {
  font-weight: var(--rvo-font-weight-semibold);
}

.beslishulp__trail-back {
  background: none;
  border: 0;
  padding: 0;
  margin-inline-start: var(--rvo-space-xs);
  font: inherit;
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  cursor: pointer;
  color: var(--rvo-color-lintblauw);
  text-decoration: underline;
}

/* --- Footer --- */
.beslishulp__footer {
  padding: var(--rvo-space-sm) var(--rvo-space-lg) var(--rvo-space-md);
  border-block-start: 1px solid var(--invulhulp-color-border);
  background: var(--rvo-color-lichtblauw-150);
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-2xs);
}

.beslishulp__footer-actions {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-xs);
  flex-wrap: wrap;
}

.beslishulp__done {
  margin-inline-start: auto;
}

.beslishulp__credit {
  margin: 0;
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  color: var(--invulhulp-color-text-subtle);
}
</style>

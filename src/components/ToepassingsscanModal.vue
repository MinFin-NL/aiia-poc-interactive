<template>
  <dialog
    ref="dialogEl"
    class="invulhulp-modal scan"
    aria-labelledby="scan-title"
    @click="onBackdropClick"
  >
    <div class="invulhulp-modal__container scan__container">

      <header class="scan__header">
        <div class="scan__brand">
          <span class="rvo-icon rvo-icon--xl scan__brand-icon" aria-hidden="true" />
          <div>
            <h2 id="scan-title" class="rvo-heading rvo-heading--xl scan__title">Toepassingsscan</h2>
            <p class="rvo-text rvo-text--sm scan__subtitle">
              Wat doet en levert dit project? Daarmee bepalen we welke formulieren hier gelden.
            </p>
          </div>
        </div>
        <!-- Plain button, not rvo-button: on the dark header an rvo-button
             variant would need overriding anyway. Mirrors BeslishulpModal. -->
        <button type="button" class="scan__close" aria-label="Sluiten" @click="close">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div class="scan__body">

        <!-- Six independent questions, so they go on one page: a wizard would
             add eight screens of chrome around forty words of question. Each is
             a fieldset/legend with native inputs and the RVO classes, exactly as
             QuestionItem renders a form question. -->
        <ol class="scan__questions">
          <li v-for="question in SCAN_QUESTIONS" :key="question.id">
            <fieldset class="rvo-form-fieldset scan__fieldset">
              <legend class="rvo-form-fieldset__legend scan__legend">
                <span class="scan__question">{{ question.vraag }}</span>
              </legend>
              <p v-if="question.toelichting" class="rvo-text rvo-text--sm scan__explanation">
                {{ question.toelichting }}
              </p>

              <div v-if="question.type === 'single'" class="rvo-radio-button__group">
                <label v-for="option in question.opties" :key="option.id" class="rvo-radio-button">
                  <input
                    type="radio"
                    class="utrecht-radio-button utrecht-radio-button--html-input"
                    :name="question.id"
                    :value="option.id"
                    :checked="isChosen(question.id, option.id)"
                    @change="chooseSingle(question.id, option.id)"
                  />
                  <span class="rvo-radio-button__label">
                    {{ option.label }}
                    <span v-if="option.hint" class="rvo-text rvo-text--sm rvo-text--subtle scan__hint">
                      {{ option.hint }}
                    </span>
                  </span>
                </label>
              </div>

              <div v-else class="rvo-checkbox__group">
                <label v-for="option in question.opties" :key="option.id" class="rvo-checkbox">
                  <input
                    type="checkbox"
                    class="rvo-checkbox__input"
                    :name="question.id"
                    :value="option.id"
                    :checked="isChosen(question.id, option.id)"
                    @change="toggleMulti(question.id, option.id)"
                  />
                  <span class="rvo-checkbox__label">
                    {{ option.label }}
                    <span v-if="option.hint" class="rvo-text rvo-text--sm rvo-text--subtle scan__hint">
                      {{ option.hint }}
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </li>
        </ol>

        <!-- The consequence list, live: answering a question moves a form in it
             immediately, which is the whole argument for asking. -->
        <section class="scan__result" aria-labelledby="scan-result-title">
          <h3 id="scan-result-title" class="rvo-heading rvo-heading--md scan__result-title">
            Wat dit betekent voor de formulieren
          </h3>

          <!-- The list updates on every answer. Announcing all ten rows each
               time would drown a screenreader, so the live region carries the
               tally and the list itself stays quiet. -->
          <p class="invulhulp-visually-hidden" role="status">{{ tally }}</p>

          <p v-if="consequences.length === 0" class="rvo-text rvo-text--sm rvo-text--subtle">
            Beantwoord de vragen hierboven — hier verschijnt meteen per formulier of het geldt.
          </p>
          <ul v-else class="rvo-item-list scan__consequences">
            <li v-for="row in consequences" :key="row.id" class="rvo-item-list__item scan__consequence">
              <span class="scan__consequence-title">{{ row.title }}</span>
              <span class="rvo-tag rvo-tag--pill" :class="tagModifier(row.status)">
                {{ applicabilityLabel(row.status) }}
              </span>
              <span class="rvo-text rvo-text--sm rvo-text--subtle scan__consequence-reason">{{ row.reason }}</span>
            </li>
          </ul>

          <div
            v-if="!hasBeslishulp && kenmerken.algoritme_of_ai !== false"
            class="rvo-alert rvo-alert--info rvo-alert--padding-md scan__alert"
          >
            <!-- One element inside the container: rvo-alert lays its children out
                 in a row, so a bare <strong> would sit beside the text. -->
            <div class="rvo-alert__container">
              <div>
                Of de AI-verordening geldt, bepaalt de <strong>Beslishulp AI-verordening</strong> —
                op de dossierpagina bij de EU AI Act-kaart.
              </div>
            </div>
          </div>

          <p class="rvo-text rvo-text--sm rvo-text--subtle scan__note">
            Advies, geen juridisch oordeel: leg een "niet van toepassing" voor aan de FG, privacy
            officer of CISO.
          </p>
        </section>
      </div>

      <footer class="scan__footer">
        <div class="rvo-action-group scan__footer-actions">
          <button
            type="button"
            class="rvo-button rvo-button--primary rvo-button--size-sm"
            :disabled="!store.canEdit"
            @click="save"
          >
            Opslaan in dossier
          </button>
          <button
            type="button"
            class="rvo-button rvo-button--tertiary rvo-button--size-sm"
            @click="restart"
          >
            Opnieuw beginnen
          </button>
        </div>
        <p v-if="savedNotice" class="rvo-text rvo-text--sm scan__saved" role="status">{{ savedNotice }}</p>
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { loadAvailableForms, type FormIndexEntry } from '../services/formLoader'
import { useAssessmentStore } from '../stores/assessmentStore'
import { useAuthStore } from '../stores/authStore'
import {
  SCAN_QUESTIONS,
  SCAN_VERSION,
  applicabilityLabel,
  deriveKenmerken,
  evaluateApplicability,
  type ApplicabilityStatus,
  type ScanAnswers,
} from '../utils/toepassingsscan'

const emit = defineEmits<{ completed: [] }>()

const store = useAssessmentStore()
const auth = useAuthStore()

const dialogEl = ref<HTMLDialogElement | null>(null)
const forms = ref<FormIndexEntry[]>([])
const answers = ref<ScanAnswers>({})
const savedNotice = ref('')

onMounted(async () => {
  forms.value = await loadAvailableForms()
})

const kenmerken = computed(() => deriveKenmerken(answers.value, store.beslishulpRun))
const hasBeslishulp = computed(() => store.beslishulpRun !== null)

const ORDER: Record<ApplicabilityStatus, number> = {
  verplicht: 0, mogelijk: 1, nvt: 2, altijd: 3, onbepaald: 4,
}

/** Only the forms the scan actually says something about — "altijd" is noise here. */
const consequences = computed(() =>
  forms.value
    .map((f) => ({ id: f.id, title: f.title, ...evaluateApplicability(f.applicability, kenmerken.value) }))
    .filter((row) => row.status !== 'altijd' && row.status !== 'onbepaald')
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]),
)

/** What the live region says: the tally, not the ten rows behind it. */
const tally = computed(() => {
  if (consequences.value.length === 0) return ''
  const count = (status: ApplicabilityStatus) =>
    consequences.value.filter((row) => row.status === status).length
  return `${count('verplicht')} van toepassing, ${count('mogelijk')} mogelijk relevant, ${count('nvt')} niet van toepassing.`
})

/** Stock rvo-tag modifiers, so the scan introduces no colours of its own.
 *  "Van toepassing" stays the neutral default — it is the ordinary case; the
 *  two states worth noticing get the warning and subtle treatments. */
function tagModifier(status: ApplicabilityStatus): string {
  if (status === 'mogelijk') return 'rvo-tag--warning'
  if (status === 'nvt') return 'scan__tag--nvt'
  return ''
}

// ---- Answering ------------------------------------------------------------
function isChosen(questionId: string, optionId: string): boolean {
  return (answers.value[questionId] ?? []).includes(optionId)
}

function chooseSingle(questionId: string, optionId: string) {
  answers.value = { ...answers.value, [questionId]: [optionId] }
  savedNotice.value = ''
}

function toggleMulti(questionId: string, optionId: string) {
  const q = SCAN_QUESTIONS.find((question) => question.id === questionId)
  if (!q) return
  const current = answers.value[q.id] ?? []
  const isExclusive = (id: string) => q.opties.find((o) => o.id === id)?.exclusief === true
  // "Nee, geen van deze" contradicts every other option, so ticking it clears
  // the rest — and ticking anything else clears it.
  const chosen = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : isExclusive(optionId)
      ? [optionId]
      : [...current.filter((id) => !isExclusive(id)), optionId]
  answers.value = { ...answers.value, [q.id]: chosen }
  savedNotice.value = ''
}

function restart() {
  answers.value = {}
  savedNotice.value = ''
}

/** Saved only on request: unlike the beslishulp, a filled-in question is not
 *  itself a conclusion — the consequence list is what the user reviews. */
function save() {
  if (!store.canEdit) {
    savedNotice.value = 'Niet opgeslagen — u heeft leesrechten op dit dossier.'
    return
  }
  store.setToepassingsscanRun({
    scanVersion: SCAN_VERSION,
    answers: { ...answers.value },
    kenmerken: kenmerken.value,
    completedAt: Date.now(),
    completedBy: auth.user?.name ?? auth.user?.email ?? undefined,
  })
  savedNotice.value = 'Opgeslagen in dit dossier.'
  emit('completed')
}

// ---- Open / close ---------------------------------------------------------
function open() {
  savedNotice.value = ''
  // Reopen on the stored answers so "bijwerken" is an edit, not a redo.
  const run = store.toepassingsscanRun
  if (run && Object.keys(answers.value).length === 0) answers.value = { ...run.answers }
  dialogEl.value?.showModal()
}

function close() {
  dialogEl.value?.close()
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialogEl.value) close()
}

defineExpose({ open })
</script>

<style scoped>
/* Layout and the modal shell only — every colour, space and font value is an
   RVO token. The shell mirrors BeslishulpModal (their styles are scoped, so it
   is repeated here rather than shared — same trade-off as ConfirmDialog). */
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

.scan__container {
  background: var(--rvo-color-wit);
  border-radius: var(--rvo-border-radius-lg);
  box-shadow: 0 0 1.5em 0 rgb(0 0 0 / 35%);
  display: flex;
  flex-direction: column;
  max-block-size: 92vh;
  overflow: hidden;
}

/* --- Header --- */
/* Ruimer dan het corpus: dit is een gekleurd vlak, en tekst die tot aan de rand
   van een gekleurd vlak loopt oogt geknepen. Inline gelijk aan .scan__body en
   .scan__footer, zodat titel, vraag en knoppen op één lijn beginnen. */
.scan__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--rvo-space-md);
  padding: var(--rvo-space-xl);
  background: var(--rvo-color-lintblauw);
  color: var(--rvo-color-wit);
}

.scan__brand {
  display: flex;
  align-items: flex-start;
  gap: var(--rvo-space-md);
}

/* .rvo-icon zet alleen een min-inline-size — zonder expliciete box heeft het
   masker geen hoogte om in te tekenen: een onzichtbaar icoon dat wél breedte
   inneemt. Zelfde patroon als de andere hergekleurde iconen in de app. */
.scan__brand-icon {
  display: inline-block;
  inline-size: var(--rvo-size-xl);
  block-size: var(--rvo-size-xl);
  margin-block-start: var(--rvo-space-3xs);
  flex-shrink: 0;
  background-color: currentColor;
  /* Static stylesheet url() — a runtime url() renders as a white square in the
     production build (see the icon-mask note in DossierDetail.vue). */
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/zoek.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/zoek.svg') center / contain no-repeat;
}

.scan__title {
  margin: 0;
  color: var(--rvo-color-wit);
}

.scan__subtitle {
  margin: var(--rvo-space-xs) 0 0;
  max-inline-size: 56ch;
  line-height: var(--rvo-line-height-md);
  /* Solid tint rather than an opacity, so the contrast ratio is knowable. */
  color: var(--rvo-color-lintblauw-150);
}

.scan__close {
  font: inherit;
  font-size: var(--rvo-font-size-xl);
  line-height: 1;
  cursor: pointer;
  padding: 0 var(--rvo-space-2xs);
  color: var(--rvo-color-wit);
  background: transparent;
  border: 0;
}

/* --- Body --- */
.scan__body {
  padding: var(--rvo-space-xl);
  overflow-y: auto;
}

/* Grijze vlak van .rvo-form-fieldset eraf, net als in QuestionItem.vue — dat
   vlak kan een vraag niet netjes omsluiten: een native <legend> valt buiten de
   padding-box (Chrome legt de bovenrand van de fieldset op halve legend-hoogte),
   dus de kicker staat erboven en de vraag klemt tegen de bovenrand. De vraag
   staat hier op het witte corpus, met de ruimte van .scan__body eromheen. */
.scan__fieldset {
  background: transparent;
  border: 0;
  margin: 0;
  padding: 0;
  min-inline-size: 0;
}

/* One question after another, so the separation has to come from spacing
   rather than from a screen change. */
.scan__questions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-xl);
}

.scan__legend {
  padding: 0;
  margin: 0 0 var(--rvo-space-2xs);
}

.scan__question {
  font-size: var(--rvo-font-size-lg);
  font-weight: var(--rvo-font-weight-bold);
  line-height: var(--rvo-line-height-sm);
}

.scan__explanation {
  margin: 0 0 var(--rvo-space-sm);
  max-inline-size: 68ch;
}

/* --- Result --- */
.scan__result {
  margin-block-start: var(--rvo-space-xl);
  padding-block-start: var(--rvo-space-lg);
  border-block-start: 1px solid var(--rvo-color-grijs-300);
}

.scan__result-title {
  margin: 0 0 var(--rvo-space-sm);
}

/* The hint under an option label: a block inside the RVO label span, so the
   whole thing stays one click target and one accessible name. */
.scan__hint {
  display: block;
}

.scan__note {
  margin: var(--rvo-space-md) 0 0;
  max-inline-size: 68ch;
}

.scan__consequences {
  margin: 0;
}

.scan__consequence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--rvo-space-3xs) var(--rvo-space-sm);
}

.scan__consequence-title {
  font-weight: var(--rvo-font-weight-semibold);
}

.scan__consequence-reason {
  grid-column: 1 / -1;
}

/* Not-applicable rows are quieter than the rest of the list, but never hidden. */
.scan__tag--nvt {
  color: var(--rvo-color-grijs-700);
}

.scan__alert {
  margin-block-start: var(--rvo-space-md);
}

/* Lopende tekst in een gekleurd vlak heeft lucht nodig: padding-md in plaats
   van -sm op het vlak zelf, en een ruimere regelafstand erbinnen. */
.scan__alert .rvo-alert__container {
  line-height: var(--rvo-line-height-md);
  max-inline-size: 72ch;
}

.scan__saved {
  margin: 0;
  color: var(--rvo-color-groen);
}

/* --- Footer --- */
.scan__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--rvo-space-sm);
  padding: var(--rvo-space-md) var(--rvo-space-xl);
  border-block-start: 1px solid var(--rvo-color-grijs-300);
  background: var(--rvo-color-grijs-100);
}

.scan__footer-actions {
  display: flex;
  gap: var(--rvo-space-2xs);
  flex-wrap: wrap;
}
</style>

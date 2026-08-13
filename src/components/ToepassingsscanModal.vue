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
              Een paar vragen over wat dit project doet en oplevert. Daarmee bepalen we welke
              formulieren in dit dossier van toepassing zijn — en welke aantoonbaar niet.
            </p>
          </div>
        </div>
        <!-- Plain button, not rvo-button: on the dark header an rvo-button
             variant would need overriding anyway. Mirrors BeslishulpModal. -->
        <button type="button" class="scan__close" aria-label="Sluiten" @click="close">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div class="scan__progress" aria-hidden="true">
        <div class="scan__progress-bar" :style="{ inlineSize: `${progressPct}%` }" />
      </div>

      <div class="scan__body">

        <!-- ---------------- Question ----------------
             fieldset/legend for the group semantics and native inputs with the
             RVO classes, exactly as QuestionItem renders a form question. The
             legend carries the question, so there is no second heading. -->
        <fieldset v-if="question" class="rvo-form-fieldset scan__fieldset">
          <legend class="rvo-form-fieldset__legend scan__legend">
            <span class="rvo-text rvo-text--sm rvo-text--subtle scan__kicker">
              Vraag {{ stepIndex + 1 }} van {{ questions.length }}
            </span>
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
                :checked="isChosen(option.id)"
                @change="chooseSingle(option.id)"
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
                :checked="isChosen(option.id)"
                @change="toggleMulti(option.id)"
              />
              <span class="rvo-checkbox__label">
                {{ option.label }}
                <span v-if="option.hint" class="rvo-text rvo-text--sm rvo-text--subtle scan__hint">
                  {{ option.hint }}
                </span>
              </span>
            </label>
          </div>

          <p v-if="question.type === 'multi' && multiEmpty" class="rvo-text rvo-text--sm rvo-text--subtle scan__note">
            Niets aangekruist? Dan slaan we deze vraag over en blijft het kenmerk onbekend —
            de betrokken formulieren blijven dan als "mogelijk relevant" staan.
          </p>
        </fieldset>

        <!-- ---------------- Summary ---------------- -->
        <template v-else>
          <p class="rvo-text rvo-text--sm rvo-text--subtle scan__kicker">Uitkomst</p>
          <h3 class="rvo-heading rvo-heading--lg scan__heading">Dit weten we nu over dit dossier</h3>

          <section>
            <h4 class="rvo-heading rvo-heading--md scan__section-title">Kenmerken</h4>
            <ul v-if="tags.length > 0" class="scan__tags">
              <li v-for="k in tags" :key="k">
                <span class="rvo-tag rvo-tag--pill">
                  {{ KENMERK_LABEL[k] }}<template v-if="KENMERK_SOURCE[k] === 'beslishulp'"> · uit de beslishulp</template>
                </span>
              </li>
            </ul>
            <p v-else class="rvo-text rvo-text--sm rvo-text--subtle">
              Geen van de kenmerken is vastgesteld.
            </p>
            <p v-if="unknowns.length > 0" class="rvo-text rvo-text--sm rvo-text--subtle scan__note">
              Nog onbekend: {{ unknowns.map((k) => KENMERK_LABEL[k]).join(', ') }}.
              Formulieren die daarvan afhangen blijven als "mogelijk relevant" staan.
            </p>
          </section>

          <div
            v-if="!hasBeslishulp && kenmerken.algoritme_of_ai !== false"
            class="rvo-alert rvo-alert--info rvo-alert--padding-md scan__alert"
          >
            <!-- One element inside the container: rvo-alert lays its children out
                 in a row, so a bare <strong> would sit beside the text. -->
            <div class="rvo-alert__container">
              <div>
                Er is sprake van (mogelijk) een algoritme. Of de AI-verordening geldt, bepaalt de
                <strong>Beslishulp AI-verordening</strong> — die staat op de dossierpagina bij de EU AI Act-kaart.
              </div>
            </div>
          </div>

          <section>
            <h4 class="rvo-heading rvo-heading--md scan__section-title">Wat dit betekent voor de formulieren</h4>
            <ul v-if="consequences.length > 0" class="rvo-item-list scan__consequences">
              <li v-for="row in consequences" :key="row.id" class="rvo-item-list__item scan__consequence">
                <span class="scan__consequence-title">{{ row.title }}</span>
                <span class="rvo-tag rvo-tag--pill" :class="tagModifier(row.status)">
                  {{ applicabilityLabel(row.status) }}
                </span>
                <span class="rvo-text rvo-text--sm rvo-text--subtle scan__consequence-reason">{{ row.reason }}</span>
              </li>
            </ul>
            <p v-else class="rvo-text rvo-text--sm rvo-text--subtle">
              Geen enkel formulier is op grond van deze antwoorden uitgesloten of aangemerkt.
            </p>
          </section>

          <div class="rvo-alert rvo-alert--warning rvo-alert--padding-md scan__alert" role="note">
            <div class="rvo-alert__container">
              Dit is geen juridisch oordeel. Op basis van je antwoorden lijken bovenstaande onderdelen
              wel of niet van toepassing — leg een "niet van toepassing" altijd voor aan de FG,
              privacy officer of CISO en noteer de motivatie in het betreffende formulier.
            </div>
          </div>

          <p v-if="savedNotice" class="rvo-text rvo-text--bold scan__saved" role="status">{{ savedNotice }}</p>
        </template>
      </div>

      <footer class="scan__footer">
        <div class="rvo-action-group scan__footer-actions">
          <button
            v-if="stepIndex > 0"
            type="button"
            class="rvo-button rvo-button--tertiary rvo-button--size-sm"
            @click="back"
          >
            ← Vorige
          </button>
          <button
            v-if="question"
            type="button"
            class="rvo-button rvo-button--primary rvo-button--size-sm"
            @click="next"
          >
            {{ stepIndex === questions.length - 1 ? 'Naar de uitkomst →' : 'Volgende →' }}
          </button>
          <template v-else>
            <button
              type="button"
              class="rvo-button rvo-button--primary rvo-button--size-sm"
              :disabled="!store.canEdit"
              @click="save"
            >
              {{ savedNotice ? 'Opgeslagen' : 'Opslaan in dossier' }}
            </button>
            <button
              type="button"
              class="rvo-button rvo-button--tertiary rvo-button--size-sm"
              @click="restart"
            >
              Opnieuw beginnen
            </button>
          </template>
        </div>
        <p class="rvo-text rvo-text--sm rvo-text--subtle scan__credit">
          De scan adviseert, jij beslist. Reeds ingevulde antwoorden gaan nooit verloren wanneer
          een formulier n.v.t. wordt.
        </p>
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
  KENMERK_LABEL,
  KENMERK_SOURCE,
  SCAN_VERSION,
  activeKenmerken,
  applicabilityLabel,
  deriveKenmerken,
  evaluateApplicability,
  unknownKenmerken,
  visibleQuestions,
  type ApplicabilityStatus,
  type ScanAnswers,
} from '../utils/toepassingsscan'

const emit = defineEmits<{ completed: [] }>()

const store = useAssessmentStore()
const auth = useAuthStore()

const dialogEl = ref<HTMLDialogElement | null>(null)
const forms = ref<FormIndexEntry[]>([])
const answers = ref<ScanAnswers>({})
const stepIndex = ref(0)
const savedNotice = ref('')

onMounted(async () => {
  forms.value = await loadAvailableForms()
})

// The question list is recomputed from the answers, so a gated question
// (bijzondere pg) appears or disappears the moment its gate is answered.
const questions = computed(() => visibleQuestions(answers.value))
const question = computed(() => questions.value[stepIndex.value] ?? null)

const progressPct = computed(() =>
  Math.round((Math.min(stepIndex.value, questions.value.length) / questions.value.length) * 100),
)

const kenmerken = computed(() => deriveKenmerken(answers.value, store.beslishulpRun))
const tags = computed(() => activeKenmerken(kenmerken.value))
const unknowns = computed(() => unknownKenmerken(kenmerken.value))
const hasBeslishulp = computed(() => store.beslishulpRun !== null)

const multiEmpty = computed(() => (answers.value[question.value?.id ?? '']?.length ?? 0) === 0)

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

/** Stock rvo-tag modifiers, so the scan introduces no colours of its own.
 *  "Van toepassing" stays the neutral default — it is the ordinary case; the
 *  two states worth noticing get the warning and subtle treatments. */
function tagModifier(status: ApplicabilityStatus): string {
  if (status === 'mogelijk') return 'rvo-tag--warning'
  if (status === 'nvt') return 'scan__tag--nvt'
  return ''
}

// ---- Answering ------------------------------------------------------------
function isChosen(optionId: string): boolean {
  return (answers.value[question.value?.id ?? ''] ?? []).includes(optionId)
}

/** Radios do not advance by themselves: with a keyboard, arrow keys move the
 *  selection, and auto-advancing on that makes the last option unreachable. */
function chooseSingle(optionId: string) {
  if (!question.value) return
  answers.value = { ...answers.value, [question.value.id]: [optionId] }
  savedNotice.value = ''
}

function toggleMulti(optionId: string) {
  const q = question.value
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

function next() {
  // Clamp to one past the last question: that slot is the summary.
  stepIndex.value = Math.min(stepIndex.value + 1, questions.value.length)
}

function back() {
  stepIndex.value = Math.max(stepIndex.value - 1, 0)
  savedNotice.value = ''
}

function restart() {
  answers.value = {}
  stepIndex.value = 0
  savedNotice.value = ''
}

/** Saved only on request: unlike the beslishulp, answering the last question is
 *  not itself a conclusion — the summary is where the user reviews it. */
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

/* --- Progress --- */
.scan__progress {
  block-size: var(--rvo-space-3xs);
  background: var(--rvo-color-grijs-200);
}

.scan__progress-bar {
  block-size: 100%;
  background: var(--rvo-color-hemelblauw);
  transition: inline-size 0.2s ease-out;
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

.scan__legend {
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-3xs);
  padding: 0;
  margin: 0 0 var(--rvo-space-sm);
}

.scan__kicker {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.scan__question {
  font-size: var(--rvo-font-size-lg);
  font-weight: var(--rvo-font-weight-bold);
  line-height: var(--rvo-line-height-sm);
}

.scan__heading {
  margin: 0 0 var(--rvo-space-md);
}

.scan__explanation {
  margin: var(--rvo-space-sm) 0 var(--rvo-space-md);
  max-inline-size: 68ch;
}

/* The hint under an option label: a block inside the RVO label span, so the
   whole thing stays one click target and one accessible name. */
.scan__hint {
  display: block;
}

.scan__note {
  margin: var(--rvo-space-sm) 0 0;
  max-inline-size: 68ch;
}

.scan__section-title {
  margin: var(--rvo-space-lg) 0 var(--rvo-space-2xs);
}

.scan__tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--rvo-space-2xs);
  margin: 0;
  padding: 0;
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
  margin-block-start: var(--rvo-space-lg);
}

/* Lopende tekst in een gekleurd vlak heeft lucht nodig: padding-md in plaats
   van -sm op het vlak zelf, en een ruimere regelafstand erbinnen. */
.scan__alert .rvo-alert__container {
  line-height: var(--rvo-line-height-md);
  max-inline-size: 72ch;
}

.scan__saved {
  margin: var(--rvo-space-md) 0 0;
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

.scan__credit {
  margin: 0;
  max-inline-size: 44ch;
}
</style>

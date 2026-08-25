<template>
  <div class="rvo-max-width-layout rvo-max-width-layout--lg rvo-max-width-layout-inline-padding--sm kern">

    <header class="kern__header">
      <p class="rvo-text rvo-text--sm rvo-text--bold kern__kicker">
        <span class="rvo-icon rvo-icon--md kern__kicker-icon" aria-hidden="true" />
        Kernvragen · {{ dossierName }}
      </p>
      <h1 class="rvo-heading rvo-heading--2xl kern__title">Tien vragen om mee te beginnen</h1>
      <p class="rvo-text kern__intro">
        Deze vragen bepalen welke formulieren voor dit project gelden, en de antwoorden worden
        hergebruikt in de rest van het dossier. U hoeft er geen documenten voor te uploaden.
        Alles wordt direct bewaard — u kunt hier later altijd op terugkomen.
      </p>
    </header>

    <div v-if="loading" class="kern__loading">
      <p class="rvo-text">Kernvragen laden…</p>
    </div>

    <div v-else-if="loadError" class="rvo-alert rvo-alert--error rvo-alert--padding-md" role="alert">
      <div class="rvo-alert__container">{{ loadError }}</div>
    </div>

    <div v-else-if="form" class="kern__layout">

      <!-- The questions. One scrolling page rather than a wizard: the ten
           blocks are independent, and ten screens of chrome around them would
           hide exactly the thing that makes them worth answering — the
           consequence list beside them moving while you type. Same reasoning as
           docs/toepasselijkheid-van-formulieren.md §7.2. -->
      <div class="kern__questions">
        <section
          v-for="blok in blokken"
          :key="blok.id"
          :id="blok.id"
          class="kern__blok"
          :aria-labelledby="`${blok.id}-title`"
        >
          <h2 :id="`${blok.id}-title`" class="rvo-heading rvo-heading--lg kern__blok-title">
            {{ blok.title }}
          </h2>
          <p v-if="blok.description" class="rvo-text rvo-text--sm kern__blok-desc">
            {{ blok.description }}
          </p>

          <QuestionItem
            v-for="question in blok.questions"
            :key="question.id"
            :question="question"
            :modelValue="store.getAnswer(question.id)"
            @update:modelValue="store.setAnswer(question.id, $event)"
          />
        </section>

        <div class="rvo-action-group kern__actions">
          <button
            type="button"
            class="rvo-button rvo-button--primary"
            @click="finish"
          >
            {{ anyAnswer ? 'Naar het dossier' : 'Overslaan en naar het dossier' }}
          </button>
          <button
            type="button"
            class="rvo-button rvo-button--tertiary"
            @click="store.goToDossierList()"
          >
            Terug naar mijn dossiers
          </button>
        </div>
      </div>

      <!-- The consequence list, live: answering a question moves a form in it
           immediately, which is the whole argument for asking. -->
      <aside class="kern__gevolgen" aria-labelledby="kern-gevolgen-title">
        <div class="kern__gevolgen-inner">
          <h2 id="kern-gevolgen-title" class="rvo-heading rvo-heading--md kern__gevolgen-title">
            Wat dit betekent voor de formulieren
          </h2>

          <!-- The list updates on every answer. Announcing all ten rows each
               time would drown a screenreader, so the live region carries the
               tally and the list itself stays quiet. -->
          <p class="invulhulp-visually-hidden" role="status">{{ tally }}</p>

          <p v-if="consequences.length === 0" class="rvo-text rvo-text--sm rvo-text--subtle">
            Beantwoord de aankruisvragen — hier verschijnt meteen per formulier of het geldt.
          </p>
          <ul v-else class="rvo-item-list kern__consequences">
            <li v-for="row in consequences" :key="row.id" class="rvo-item-list__item kern__consequence">
              <span class="kern__consequence-title">{{ row.title }}</span>
              <span class="rvo-tag rvo-tag--pill" :class="tagModifier(row.status)">
                {{ applicabilityLabel(row.status) }}
              </span>
              <span class="rvo-text rvo-text--sm rvo-text--subtle kern__consequence-reason">{{ row.reason }}</span>
            </li>
          </ul>

          <div
            v-if="kenmerken && kenmerken.algoritme_of_ai !== false && !hasBeslishulp"
            class="rvo-alert rvo-alert--info rvo-alert--padding-md kern__alert"
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

          <p class="rvo-text rvo-text--sm rvo-text--subtle kern__note">
            Advies, geen juridisch oordeel: leg een "niet van toepassing" voor aan de FG, privacy
            officer of CISO.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import QuestionItem from './QuestionItem.vue'
import { loadAvailableForms, loadForm, type FormIndexEntry } from '../services/formLoader'
import { useAssessmentStore } from '../stores/assessmentStore'
import { KERNVRAGEN_FORM_ID, deriveKenmerken, hasKernvragenAnswers } from '../utils/kernvragen'
import {
  applicabilityLabel,
  evaluateApplicability,
  type ApplicabilityStatus,
} from '../utils/toepasselijkheid'
import { isEmptyAnswer } from '../utils/crossFormCopy'
import type { FormConfig, Question } from '../models/Assessment'

const store = useAssessmentStore()

const form = ref<FormConfig | null>(null)
const forms = ref<FormIndexEntry[]>([])
const loading = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    ;[form.value, forms.value] = await Promise.all([loadForm(KERNVRAGEN_FORM_ID), loadAvailableForms()])
  } catch {
    loadError.value = 'De kernvragen konden niet worden geladen. Ververs de pagina om het opnieuw te proberen.'
  } finally {
    loading.value = false
  }
})

const dossierName = computed(() => store.activeDossier?.name ?? '')

/** The ten blocks, flattened out of the four sections: the grouping into parts
 *  is for the export and the summary, not for this page — here they are simply
 *  question one through ten. */
const blokken = computed(() =>
  (form.value?.sections ?? []).flatMap((section) =>
    section.subsections.map((sub) => ({
      id: sub.id,
      title: sub.title,
      description: sub.description,
      questions: sub.questions as Question[],
    })),
  ),
)

const answers = computed(() => store.activeDossier?.forms[KERNVRAGEN_FORM_ID]?.answers ?? {})
const anyAnswer = computed(() =>
  Object.values(answers.value).some((value) => !isEmptyAnswer(value)),
)

/** Recomputed from the live answers rather than read from the store getter, so
 *  the list moves while the user is still on this page. */
const kenmerken = computed(() =>
  hasKernvragenAnswers(answers.value) ? deriveKenmerken(answers.value, store.beslishulpRun) : null,
)
const hasBeslishulp = computed(() => store.beslishulpRun !== null)

const ORDER: Record<ApplicabilityStatus, number> = {
  verplicht: 0, mogelijk: 1, nvt: 2, altijd: 3, onbepaald: 4,
}

/** Only the forms the kernvragen actually say something about — "altijd" is
 *  noise here, and so is the kernvragen form itself. */
const consequences = computed(() =>
  forms.value
    .filter((f) => f.id !== KERNVRAGEN_FORM_ID)
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

/** Stock rvo-tag modifiers, so this page introduces no colours of its own.
 *  "Van toepassing" stays the neutral default — it is the ordinary case; the
 *  two states worth noticing get the warning and subtle treatments. */
function tagModifier(status: ApplicabilityStatus): string {
  if (status === 'mogelijk') return 'rvo-tag--warning'
  if (status === 'nvt') return 'kern__tag--nvt'
  return ''
}

/**
 * No save button: answers go through the store on every keystroke, exactly as
 * in any other form. This only closes the page — and re-indexes the answers as
 * the AI's source material, which is the one thing that is cheaper to do once
 * on leaving than on every edit.
 */
async function finish() {
  const config = form.value
  if (config && store.canEdit) {
    const { syncKernvragenSource } = await import('../services/kernvragenSource')
    void syncKernvragenSource(config)
  }
  store.goToPortal()
}
</script>

<style scoped>
/* Layout only — every colour, space, radius and font size is an RVO token. */
.kern {
  padding-block: var(--rvo-space-2xl);
}

.kern__header {
  max-inline-size: 72ch;
  margin-block-end: var(--rvo-space-2xl);
}

.kern__kicker {
  display: flex;
  align-items: center;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rvo-color-lintblauw);
}

/* .rvo-icon only sets a min-inline-size — without an explicit box the mask has
   no height to paint in. Static stylesheet url(): a runtime url() renders as a
   white square in the production build. */
.kern__kicker-icon {
  display: inline-block;
  inline-size: var(--rvo-size-md);
  block-size: var(--rvo-size-md);
  flex-shrink: 0;
  margin-inline-end: var(--rvo-space-2xs);
  background-color: var(--rvo-color-lintblauw);
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/vraagteken.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/vraagteken.svg') center / contain no-repeat;
}

.kern__title {
  margin: var(--rvo-space-2xs) 0 var(--rvo-space-sm);
}

.kern__intro {
  margin: 0;
  line-height: var(--rvo-line-height-md);
}

.kern__loading {
  padding-block: var(--rvo-space-2xl);
}

/* Two columns where there is room, one below it: the consequence list is the
   feedback on the answers, so on a narrow screen it belongs after them. */
.kern__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--rvo-space-2xl);
}

@media (min-width: 64rem) {
  .kern__layout {
    grid-template-columns: minmax(0, 1fr) 22rem;
    align-items: start;
  }
}

.kern__questions {
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-3xl);
  min-inline-size: 0;
}

.kern__blok {
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-lg);
}

.kern__blok-title {
  margin: 0;
}

.kern__blok-desc {
  margin: calc(-1 * var(--rvo-space-md)) 0 0;
  max-inline-size: 72ch;
  line-height: var(--rvo-line-height-md);
}

.kern__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rvo-space-sm);
  padding-block-start: var(--rvo-space-lg);
  border-block-start: 1px solid var(--rvo-color-grijs-300);
}

.kern__gevolgen-inner {
  padding: var(--rvo-space-lg);
  background: var(--rvo-color-grijs-100);
  border-radius: var(--rvo-border-radius-md);
}

@media (min-width: 64rem) {
  .kern__gevolgen-inner {
    position: sticky;
    /* Clear of the AI Modus banner, which is sticky at the top of the shell. */
    top: var(--rvo-space-xl);
    max-block-size: calc(100vh - 8rem);
    overflow-y: auto;
  }
}

.kern__gevolgen-title {
  margin: 0 0 var(--rvo-space-sm);
}

.kern__consequences {
  margin: 0;
}

.kern__consequence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--rvo-space-3xs) var(--rvo-space-sm);
}

.kern__consequence-title {
  font-weight: var(--rvo-font-weight-semibold);
}

.kern__consequence-reason {
  grid-column: 1 / -1;
}

/* Not-applicable rows are quieter than the rest of the list, but never hidden. */
.kern__tag--nvt {
  color: var(--rvo-color-grijs-700);
}

.kern__alert {
  margin-block-start: var(--rvo-space-md);
}

/* Lopende tekst in een gekleurd vlak heeft lucht nodig: padding-md in plaats
   van -sm op het vlak zelf, en een ruimere regelafstand erbinnen. */
.kern__alert .rvo-alert__container {
  line-height: var(--rvo-line-height-md);
}

.kern__note {
  margin: var(--rvo-space-md) 0 0;
  line-height: var(--rvo-line-height-md);
}
</style>

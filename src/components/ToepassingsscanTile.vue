<template>
  <!-- Dossier-level, above the phases: which forms apply is a property of the
       dossier, not of any one form (docs §5.1). The kenmerk tags are the
       visible explanation for every "Van toepassing" and "Niet van toepassing"
       badge further down the page.

       Stock NLDS: an outlined rvo-card like the form cards, rvo-tag pills for
       the kenmerken, rvo-button for the action. No colours of its own — see
       the NL Design System rule in CLAUDE.md. -->
  <section
    class="rvo-card rvo-card--outline rvo-card--padding--md scan-tile"
    aria-labelledby="scan-tile-title"
  >
    <div class="scan-tile__main">
      <span class="rvo-icon rvo-icon--lg scan-tile__icon" aria-hidden="true" />
      <div class="scan-tile__body">
        <p class="rvo-text rvo-text--sm rvo-text--bold scan-tile__kicker">Toepassingsscan</p>
        <h2 id="scan-tile-title" class="rvo-heading rvo-heading--lg scan-tile__title">
          {{ run ? 'Kenmerken van dit dossier' : 'Welke formulieren gelden hier eigenlijk?' }}
        </h2>

        <template v-if="run">
          <ul v-if="tags.length > 0" class="scan-tile__tags">
            <li v-for="k in tags" :key="k">
              <span class="rvo-tag rvo-tag--pill">{{ KENMERK_LABEL[k] }}</span>
            </li>
          </ul>
          <p v-else class="rvo-text rvo-text--sm rvo-text--subtle scan-tile__line">
            De scan stelde geen van de kenmerken vast.
          </p>
          <p class="rvo-text rvo-text--sm rvo-text--subtle scan-tile__line">
            {{ counts.verplicht }} van toepassing · {{ counts.mogelijk }} mogelijk relevant ·
            {{ counts.nvt }} niet van toepassing ·
            gescand op {{ completedOn }}<template v-if="run.completedBy"> door {{ run.completedBy }}</template>
          </p>
          <p v-if="unknowns.length > 0" class="rvo-text rvo-text--sm rvo-text--subtle scan-tile__line">
            Nog onbekend: {{ unknowns.map((k) => KENMERK_LABEL[k]).join(', ') }}.
          </p>
        </template>

        <p v-else class="rvo-text rvo-text--sm scan-tile__line scan-tile__intro">
          Beantwoord acht vragen over wat dit project doet en oplevert. Daarna staat per formulier
          of het van toepassing is — en waarom niet, als het niet van toepassing is. Zolang de scan
          niet is gedaan, blijven alle formulieren gewoon zichtbaar.
        </p>
      </div>
    </div>

    <div class="scan-tile__actions">
      <button type="button" class="rvo-button rvo-button--primary rvo-button--size-sm" @click="$emit('open')">
        {{ run ? 'Scan bekijken of bijwerken' : 'Start toepassingsscan' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  KENMERK_LABEL,
  activeKenmerken,
  unknownKenmerken,
  type Kenmerken,
  type ToepassingsscanRun,
} from '../utils/toepassingsscan'

const props = defineProps<{
  run: ToepassingsscanRun | null
  /** Live-derived kenmerken; null while no scan has been run. */
  kenmerken: Kenmerken | null
  counts: { verplicht: number; mogelijk: number; nvt: number }
}>()
defineEmits<{ open: [] }>()

const tags = computed(() => (props.kenmerken ? activeKenmerken(props.kenmerken) : []))
const unknowns = computed(() => (props.kenmerken ? unknownKenmerken(props.kenmerken) : []))

const completedOn = computed(() =>
  props.run
    ? new Date(props.run.completedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    : '',
)
</script>

<style scoped>
/* Layout only: colour, spacing, radius and type all come from RVO tokens, and
   the card frame itself from .rvo-card--outline. */
.scan-tile {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--rvo-space-md);
  margin-block-end: var(--rvo-space-xl);
  /* The one accent: marks the tile as the dossier-level control above the
     phase timeline, in the same lintblauw the beslishulp tile uses. */
  border-inline-start: var(--rvo-space-3xs) solid var(--rvo-color-lintblauw);
}

.scan-tile__main {
  display: flex;
  align-items: flex-start;
  gap: var(--rvo-space-md);
  flex: 1 1 28rem;
}

.scan-tile__icon {
  flex-shrink: 0;
  margin-block-start: var(--rvo-space-2xs);
  color: var(--rvo-color-lintblauw);
  background-color: currentColor;
  /* Static stylesheet url() — a runtime url() renders as a white square in the
     production build (see the icon-mask note in DossierDetail.vue). */
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/zoek.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/zoek.svg') center / contain no-repeat;
}

.scan-tile__kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rvo-color-lintblauw);
}

.scan-tile__title {
  margin: 0 0 var(--rvo-space-2xs);
}

.scan-tile__line {
  margin: 0;
}

.scan-tile__intro {
  max-inline-size: 72ch;
}

.scan-tile__tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--rvo-space-2xs);
  margin: 0 0 var(--rvo-space-2xs);
  padding: 0;
}

.scan-tile__actions {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-2xs);
}
</style>

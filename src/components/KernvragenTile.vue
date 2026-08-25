<template>
  <!-- Dossier-level, above the phases: the kernvragen describe the dossier, not
       any one form (docs §5.1). The kenmerk tags are the visible explanation for
       every "Van toepassing" and "Niet van toepassing" badge further down the
       page, and the progress line is why the AI band below can offer to fill the
       rest of the dossier without a single upload.

       Stock NLDS: an outlined rvo-card like the form cards, rvo-tag pills for
       the kenmerken, rvo-button for the action. No colours of its own — see
       the NL Design System rule in CLAUDE.md.

       Padding--xl and no left gutter: the title has to start on the same
       vertical line as "Vul dit dossier in met AI" and "Vooraf" around it, so
       the icon rides along in the kicker line instead of in a column of its
       own. -->
  <section
    class="rvo-card rvo-card--outline rvo-card--padding--xl kern-tile"
    aria-labelledby="kern-tile-title"
  >
    <div class="kern-tile__body">
      <p class="rvo-text rvo-text--sm rvo-text--bold kern-tile__kicker">
        <span class="rvo-icon rvo-icon--md kern-tile__icon" aria-hidden="true" />
        Kernvragen
      </p>
      <h2 id="kern-tile-title" class="rvo-heading rvo-heading--lg kern-tile__title">
        {{ started ? 'Kenmerken van dit dossier' : 'Begin met de tien kernvragen' }}
      </h2>

      <template v-if="started">
        <!-- Two kinds of tag, and the difference matters: most are what the
             invuller ticked, but a kenmerk sourced from the beslishulp is the
             outcome of an instrument. Marked, not colour-coded — the legend
             below spells it out in words. -->
        <ul v-if="tags.length > 0" class="kern-tile__tags">
          <li v-for="k in tags" :key="k">
            <span class="rvo-tag rvo-tag--pill">
              {{ KENMERK_LABEL[k] }}<template v-if="KENMERK_SOURCE[k] === 'beslishulp'">
                <span aria-hidden="true"> ·</span>
                <span class="kern-tile__tag-source"> uit de beslishulp</span>
              </template>
            </span>
          </li>
        </ul>
        <p v-else class="rvo-text rvo-text--sm rvo-text--subtle kern-tile__line">
          Geen van de kenmerken is vastgesteld.
        </p>
        <p class="rvo-text rvo-text--sm rvo-text--subtle kern-tile__line">
          {{ counts.verplicht }} van toepassing · {{ counts.mogelijk }} mogelijk relevant ·
          {{ counts.nvt }} niet van toepassing · {{ answered }} van {{ total }} velden beantwoord
        </p>
        <p v-if="unknowns.length > 0" class="rvo-text rvo-text--sm rvo-text--subtle kern-tile__line">
          Nog onbekend: {{ unknowns.map((k) => KENMERK_LABEL[k]).join(', ') }}.
        </p>
      </template>

      <p v-else class="rvo-text rvo-text--sm kern-tile__line kern-tile__intro">
        Tien vragen over waarom dit project bestaat, wat het doet, wie het raakt en wat er mis kan
        gaan. Ze bepalen welke formulieren hier gelden, en de antwoorden worden hergebruikt in de
        rest van het dossier.
      </p>
    </div>

    <div class="kern-tile__actions">
      <button type="button" class="rvo-button rvo-button--primary rvo-button--size-sm" @click="$emit('open')">
        {{ started ? 'Kernvragen bekijken of bijwerken' : 'Start met de kernvragen' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  KENMERK_LABEL,
  KENMERK_SOURCE,
  activeKenmerken,
  unknownKenmerken,
  type Kenmerken,
} from '../utils/toepasselijkheid'

const props = defineProps<{
  /** Live-derived kenmerken; null while the kernvragen are unanswered. */
  kenmerken: Kenmerken | null
  counts: { verplicht: number; mogelijk: number; nvt: number }
  /** How many of the kernvragen fields carry an answer, and how many there are. */
  answered: number
  total: number
}>()
defineEmits<{ open: [] }>()

/** Started, not finished: the tags are worth showing from the first answer on,
 *  and the engine already treats the rest as `onbekend` rather than as "nee". */
const started = computed(() => props.kenmerken !== null)

const tags = computed(() => (props.kenmerken ? activeKenmerken(props.kenmerken) : []))
const unknowns = computed(() => (props.kenmerken ? unknownKenmerken(props.kenmerken) : []))
</script>

<style scoped>
/* Layout only: colour, spacing, radius and type all come from RVO tokens, and
   the card frame itself from .rvo-card--outline. */
.kern-tile {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--rvo-space-md);
  margin-block-end: var(--rvo-space-2xl);
  /* Same frame as the bands above and below it (bulk-ai, Vooraf), so the four
     dossier-level blocks read as one column instead of four stray boxes. */
  --rvo-card-outline-border-color: var(--rvo-color-lichtblauw-300);
  border-radius: var(--rvo-border-radius-md);
}

.kern-tile__body {
  flex: 1 1 28rem;
}

/* .rvo-icon only sets a min-inline-size — without an explicit box the mask has
   no height to paint in, which leaves an invisible icon that still takes up
   its width. Sized here like every other recoloured icon in the app. */
.kern-tile__icon {
  display: inline-block;
  inline-size: var(--rvo-size-md);
  block-size: var(--rvo-size-md);
  flex-shrink: 0;
  margin-inline-end: var(--rvo-space-2xs);
  background-color: var(--rvo-color-lintblauw);
  /* Static stylesheet url() — a runtime url() renders as a white square in the
     production build (see the icon-mask note in DossierDetail.vue). */
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/vraagteken.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/vraagteken.svg') center / contain no-repeat;
}

.kern-tile__kicker {
  display: flex;
  align-items: center;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rvo-color-lintblauw);
}

.kern-tile__title {
  margin: 0 0 var(--rvo-space-2xs);
  color: var(--rvo-color-lintblauw);
}

.kern-tile__line {
  margin: 0;
  line-height: var(--rvo-line-height-md);
}

.kern-tile__intro {
  max-inline-size: 72ch;
}

.kern-tile__tag-source {
  font-weight: var(--rvo-font-weight-normal);
}

.kern-tile__tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--rvo-space-2xs);
  margin: 0 0 var(--rvo-space-2xs);
  padding: 0;
}

.kern-tile__actions {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-2xs);
}
</style>

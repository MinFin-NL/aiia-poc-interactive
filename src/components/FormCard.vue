<template>
  <!-- Eén kaart, of — met iets in de `lead`-slot — het tegel-plus-kaart-paar
       waarmee de beslishulp aan zijn gastformulier vastzit. -->
  <div class="form-slot" :class="{ 'form-slot--paired': paired }">
    <slot name="lead" />

    <!-- Aangekondigd, maar nog niet gebouwd: de tegel staat er wel, de kaart is
         zichtbaar uitgeschakeld. Een gat in de rij zou de fase onvolledig laten
         lijken. -->
    <article
      v-if="form.placeholder"
      class="rvo-card rvo-card--outline rvo-card--padding--md form-card form-card--placeholder"
    >
      <div class="form-card__body">
        <h3 class="rvo-heading rvo-heading--md form-card__title">{{ form.title }}</h3>
        <ul v-if="form.domains?.length" class="form-card__domains">
          <li v-for="domain in form.domains" :key="domain" class="form-card__domain">
            {{ domainLabel(domain) }}
          </li>
        </ul>
        <p class="rvo-text rvo-text--sm form-card__desc">{{ form.shortDescription }}</p>
      </div>
      <div class="form-card__actions">
        <span
          class="rvo-tag rvo-tag--pill form-card__status"
          :class="{ 'rvo-tag--warning': form.placeholder === 'onzeker' }"
        >
          {{ PLACEHOLDER_LABELS[form.placeholder] }}
        </span>
        <button
          type="button"
          class="rvo-button rvo-button--secondary rvo-button--size-sm form-card__btn"
          disabled
        >
          Nog niet beschikbaar
        </button>
      </div>
    </article>

    <article
      v-else
      class="rvo-card rvo-card--outline rvo-card--padding--md form-card"
      :class="{
        'form-card--ai-mode': aiActive,
        'form-card--paired': paired,
      }"
    >
      <div class="form-card__body">
        <h3 class="rvo-heading rvo-heading--md form-card__title">{{ form.title }}</h3>
        <ul v-if="form.domains?.length" class="form-card__domains">
          <li v-for="domain in form.domains" :key="domain" class="form-card__domain">
            {{ domainLabel(domain) }}
          </li>
        </ul>
        <p class="rvo-text rvo-text--sm form-card__desc">{{ form.shortDescription }}</p>
      </div>
      <div class="form-card__actions">
        <!-- The beslishulp verdict, echoed on the card it belongs to. -->
        <span
          v-if="beslishulpVerdict"
          class="rvo-tag rvo-tag--pill form-card__status form-card__verdict"
          :class="`form-card__verdict--${beslishulpVerdict.tone}`"
        >
          {{ beslishulpVerdict.label }}
        </span>
        <!-- Why this form is here at all, per the toepassingsscan. The reason is
             hidden text rather than only a `title`, which a keyboard or screen
             reader never reaches. -->
        <span
          v-if="verdict.status === 'verplicht' || verdict.status === 'mogelijk'"
          class="rvo-tag rvo-tag--pill form-card__status"
          :class="{ 'rvo-tag--warning': verdict.status === 'mogelijk' }"
          :title="verdict.reason"
        >
          {{ applicabilityLabel(verdict.status) }}
          <span class="invulhulp-visually-hidden">: {{ verdict.reason }}</span>
        </span>
        <span
          v-if="status"
          class="rvo-tag rvo-tag--pill form-card__status"
          :class="{
            'rvo-tag--info': status.status === 'bezig',
            'rvo-tag--success': status.status === 'afgerond',
          }"
        >
          {{ statusLabel(status) }}
        </span>
        <button
          class="rvo-button rvo-button--primary rvo-button--size-sm form-card__btn"
          @click="emit('open', form.id)"
        >
          {{ status?.status === 'bezig' ? 'Verder' : 'Openen' }}
        </button>
        <AiModeToggle
          v-if="canEdit"
          :form-id="form.id"
          :has-documents="hasDocuments"
          :is-active="aiActive"
          :is-done="aiDone"
          :done-filled-count="aiDoneFilled"
          :done-total-count="aiDoneTotal"
          :progress="aiProgress"
          :phase="aiPhase"
          :can-undo-smoothing="canUndoSmoothing"
          @activate="emit('activate', $event)"
          @cancel="emit('cancel', $event)"
          @dismiss="emit('dismiss', $event)"
          @undo-smoothing="emit('undoSmoothing', $event)"
        />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import AiModeToggle from './AiModeToggle.vue'
import type { FormIndexEntry, FormPlaceholder } from '../services/formLoader'
import type { FormProgress } from '../utils/formProgress'
import { applicabilityLabel, type ApplicabilityVerdict } from '../utils/toepassingsscan'

/**
 * Eén formulierkaart op de dossierpagina. De kaart is dom: alle oordelen
 * (toepassingsscan, voortgang, AI Modus) worden door DossierDetail berekend en
 * hier alleen getoond, zodat dezelfde kaart in de fasetijdlijn én in de
 * "Vooraf"-band precies dezelfde affordances heeft.
 */
withDefaults(defineProps<{
  form: FormIndexEntry
  /** Voortgang, of null wanneer het formulier (nog) niet geladen is. */
  status?: FormProgress | null
  verdict: ApplicabilityVerdict
  /** Aan de beslishulptegel vastgeplakt: geen ronding op de gedeelde rand. */
  paired?: boolean
  /** Het beslishulpoordeel, alleen op het gastformulier van de beslishulp. */
  beslishulpVerdict?: { label: string; tone: string } | null
  canEdit?: boolean
  hasDocuments?: boolean
  aiActive?: boolean
  aiDone?: boolean
  aiDoneFilled?: number
  aiDoneTotal?: number
  aiProgress?: { filled: number; total: number } | null
  aiPhase?: { current: number; total: number } | null
  canUndoSmoothing?: boolean
}>(), {
  status: null,
  paired: false,
  beslishulpVerdict: null,
  canEdit: false,
  hasDocuments: false,
  aiActive: false,
  aiDone: false,
  aiDoneFilled: 0,
  aiDoneTotal: 0,
  aiProgress: null,
  aiPhase: null,
  canUndoSmoothing: false,
})

const emit = defineEmits<{
  open: [formId: string]
  activate: [formId: string]
  cancel: [formId: string]
  dismiss: [formId: string]
  undoSmoothing: [formId: string]
}>()

const PLACEHOLDER_LABELS: Record<FormPlaceholder, string> = {
  gepland: 'In ontwikkeling',
  onzeker: 'Nog niet besloten',
}

const DOMAIN_LABELS: Record<string, string> = {
  privacy: 'Privacy',
  beveiliging: 'Beveiliging',
  ai: 'AI',
  data: 'Data',
  project: 'Project',
}

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain
}

function statusLabel(p: FormProgress): string {
  if (p.status === 'afgerond') return 'Afgerond'
  if (p.status === 'bezig') return `Bezig (${p.completed}/${p.total})`
  return 'Niet gestart'
}
</script>

<style scoped>
/* One card, or — for the beslishulp host form — the tile-plus-card pair. */
.form-slot {
  display: flex;
  align-items: stretch;
}

.form-card {
  inline-size: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: box-shadow 0.15s, border-color 0.3s;
}

.form-card:hover {
  box-shadow: 0 2px 8px rgb(21 66 115 / 0.12);
}

/* Fused to the beslishulp tile: no rounding or hairline on the joined edge, so
   the pair reads as a single framed object. */
.form-card--paired {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
  border-inline-start-color: var(--rvo-color-lintblauw);
}

.form-slot--paired:hover .form-card--paired {
  box-shadow: 0 2px 8px rgb(21 66 115 / 0.12);
}

/* Aangekondigd maar nog niet gebouwd: gedempt en met een streepjesrand, zodat
   de kaart op afstand al leest als "hier kan je nog niets". De knop is echt
   `disabled` — de status staat als tekst op de kaart, niet alleen in de kleur. */
.form-card--placeholder {
  border-style: dashed;
  border-color: var(--rvo-color-grijs-400);
  background: var(--rvo-color-grijs-100);
  box-shadow: none;
}

.form-card--placeholder:hover {
  box-shadow: none;
}

.form-card--placeholder .form-card__title {
  color: var(--rvo-color-grijs-700);
}

.form-card--placeholder .form-card__btn[disabled] {
  cursor: not-allowed;
}

.form-card__verdict {
  border: 1px solid transparent;
}

.form-card__verdict--success { background: #e6f6ec; color: #1d6b3a; border-color: #b7e4c7; }
.form-card__verdict--info    { background: var(--rvo-color-lichtblauw-150); color: var(--rvo-color-lintblauw); border-color: var(--rvo-color-lichtblauw-300); }
.form-card__verdict--warning { background: #fdf3e0; color: #8a5a00; border-color: #f0d49b; }
.form-card__verdict--error   { background: #fdecea; color: #8f2436; border-color: #f5c2bd; }

/* AI Mode active: animated gradient border + pulsing glow */
.form-card--ai-mode {
  border: 2px solid transparent;
  background-image:
    linear-gradient(var(--rvo-color-wit), var(--rvo-color-wit)),
    linear-gradient(135deg, #0f2d5c, #5b21b6, #0ea5e9, #5b21b6, #0f2d5c);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  background-size: 100%, 300% 100%;
  animation: ai-border-shift 4s linear infinite, ai-card-glow 3s ease-in-out infinite;
}

@keyframes ai-border-shift {
  0%   { background-position: 0 0, 0% 50%; }
  100% { background-position: 0 0, 200% 50%; }
}

@keyframes ai-card-glow {
  0%, 100% { box-shadow: 0 0 8px 3px rgba(91, 33, 182, 0.2); }
  50%       { box-shadow: 0 0 22px 7px rgba(14, 165, 233, 0.35); }
}

.form-card__body {
  margin-block-end: var(--rvo-space-md);
}

/* Dutch compound nouns ("Toegankelijkheidsverklaring") are wider than the
   210px card, so hyphenate and hard-break rather than overflow the border. */
.form-card__title {
  color: var(--rvo-color-lintblauw);
  margin: 0 0 var(--rvo-space-xs);
  overflow-wrap: break-word;
  hyphens: auto;
}

/* Subject-domain facet: which domains this form touches, independent of the
   lifecycle track it is filed under. */
.form-card__domains {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rvo-space-2xs);
  list-style: none;
  padding: 0;
  margin: 0 0 var(--rvo-space-xs);
}

.form-card__domain {
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  line-height: 1.4;
  color: var(--invulhulp-color-text-subtle);
  background: var(--rvo-color-lichtblauw-150);
  border-radius: var(--rvo-border-radius-md, 4px);
  padding: 0 var(--rvo-space-2xs);
  white-space: nowrap;
}

.form-card__desc {
  color: var(--invulhulp-color-text-subtle);
  line-height: var(--rvo-line-height-md);
  overflow-wrap: break-word;
  hyphens: auto;
}

.form-card__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--rvo-space-xs);
}

.form-card__status {
  font-size: var(--rvo-font-size-2xs);
}

.form-card__btn {
  align-self: flex-start;
}
</style>

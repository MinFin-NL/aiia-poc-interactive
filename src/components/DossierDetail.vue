<template>
  <div class="portal-page">
    <div class="rvo-max-width-layout rvo-max-width-layout--lg rvo-max-width-layout-inline-padding--sm">

      <!-- Dossier page header -->
      <section class="dossier-header" aria-labelledby="dossier-title">
        <button
          type="button"
          class="rvo-link dossier-header__back"
          @click="store.goToDossierList()"
        >
          ‹ Alle dossiers
        </button>
        <div class="dossier-header__row">
          <div class="dossier-header__title-group">
            <span class="dossier-header__icon" aria-hidden="true" />
            <h1 id="dossier-title" class="rvo-heading rvo-heading--2xl dossier-header__name">
              {{ store.activeDossier.name }}
            </h1>
          </div>
          <div class="dossier-actions">
            <button
              v-if="store.isOwner"
              type="button"
              class="rvo-button rvo-button--tertiary rvo-button--size-sm dossier-actions__share"
              @click="openShareDialog"
            >
              <span class="dossier-actions__share-icon" aria-hidden="true" />
              Delen
            </button>
            <button
              v-if="store.canEdit"
              type="button"
              class="rvo-button rvo-button--tertiary rvo-button--size-sm"
              @click="openRenameDialog"
            >
              Hernoemen
            </button>
            <button
              v-if="store.isOwner"
              type="button"
              class="rvo-button rvo-button--warning-subtle rvo-button--size-sm"
              @click="openDeleteDialog"
            >
              Verwijderen
            </button>
          </div>
        </div>
        <p class="rvo-text dossier-header__desc">
          Dit dossier groepeert de brondocumenten en formulierantwoorden voor één project of systeem.
        </p>
        <div v-if="store.readOnly" class="rvo-alert rvo-alert--info rvo-alert--padding-sm">
          <div class="rvo-alert__container">
            Gedeeld door {{ store.activeDossier.ownerName ?? 'een collega' }} — u heeft leesrechten.
          </div>
        </div>
        <div v-if="shareError" class="rvo-alert rvo-alert--error rvo-alert--padding-sm" role="alert">
          <div class="rvo-alert__container">{{ shareError }}</div>
        </div>
      </section>

      <!-- Phase rail: the whole lifecycle in one row, as a table of contents
           for the timeline below. Each circle fills from the bottom with the
           share of that phase's forms that are afgerond. -->
      <nav class="phase-rail" aria-label="Fasen in dit dossier">
        <ol class="phase-rail__list">
          <li
            v-for="group in railGroups"
            :key="group.track"
            class="phase-rail__item"
          >
            <button
              type="button"
              class="phase-rail__step"
              :aria-label="phaseRailLabel(group)"
              @click="goToPhase(group)"
            >
              <span
                class="phase-rail__circle"
                :class="[
                  `phase-rail__circle--${markerState(group)}`,
                  `phase-rail__circle--icon-${group.track}`,
                  { 'phase-rail__circle--minor': !group.isPhase },
                ]"
                :style="{ '--phase-fill': phaseFill(group) }"
              >
                <span class="phase-rail__icon" aria-hidden="true" />
              </span>
              <span class="phase-rail__label">{{ group.label }}</span>
              <span class="phase-rail__count">
                {{ trackCount(group).total > 0
                  ? `${trackCount(group).done}/${trackCount(group).total}`
                  : '—' }}
              </span>
            </button>
          </li>
        </ol>
      </nav>

      <!-- Brondocumenten upload -->
      <section class="portal-card" aria-labelledby="docs-title">
        <div class="portal-card__header">
          <div class="docs-title-row">
            <h2 id="docs-title" class="rvo-heading rvo-heading--lg portal-card__title">Brondocumenten</h2>
            <span v-if="store.documents.length > 0" class="rvo-tag rvo-tag--info rvo-tag--pill" aria-live="polite">
              {{ store.documents.length }} {{ store.documents.length === 1 ? 'document' : 'documenten' }} beschikbaar
            </span>
            <button
              v-if="hasAnyOntology"
              type="button"
              class="rvo-button rvo-button--secondary rvo-button--size-sm docs-graph-btn"
              :aria-pressed="showGraph"
              aria-controls="entity-graph-region"
              @click="showGraph = !showGraph"
            >
              {{ showGraph ? 'Verberg entiteitengrafiek' : 'Toon entiteitengrafiek' }}
            </button>
          </div>
          <p class="rvo-text portal-card__desc">
            Upload achtergronddocumenten (notulen, brainstorms, agenda's) in .txt, .md, .docx, .xlsx, .pptx of .pdf formaat.
            Bij het invullen van een formulier kun je per vraag automatisch een antwoord laten extraheren uit deze documenten.
          </p>
        </div>

        <div v-if="store.canEdit" class="docs-controls">
          <label
            class="rvo-button rvo-button--primary docs-upload-btn"
            :class="{ 'docs-upload-btn--busy': isUploading }"
            :aria-disabled="isUploading"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".txt,.md,.docx,.xlsx,.pptx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              :disabled="isUploading"
              class="invulhulp-visually-hidden"
              @change="onFilesSelected"
            />
            <span v-if="!isUploading" aria-hidden="true">↑</span>
            <span v-if="isUploading">Bezig met inlezen…</span>
            <span v-else>Document(en) uploaden</span>
          </label>

          <details class="rvo-expandable-content rvo-expandable-content--subtle docs-info-details">
            <summary class="rvo-expandable-content__summary rvo-text rvo-text--sm">
              <img :src="infoIcon" class="docs-info-icon" aria-hidden="true" alt="" />
              Ondersteunde bestandstypen
            </summary>
            <div class="rvo-expandable-content__details">
              <ul class="rvo-ul rvo-text rvo-text--sm docs-info-list">
                <li><strong>.txt / .md</strong> — platte tekst, volledig gebruikt</li>
                <li><strong>.docx</strong> — Word-document, tekst en opmaak worden gelezen</li>
                <li><strong>.xlsx</strong> — Excel-spreadsheet, celinhoud per blad</li>
                <li><strong>.pptx</strong> — PowerPoint-presentatie, alleen de tekst uit de dia's wordt gelezen (geen afbeeldingen of grafieken)</li>
                <li><strong>.pdf</strong> — alleen tekst-PDF's (bijv. geëxporteerd uit Word); gescande PDF's met alleen afbeeldingen worden geweigerd</li>
              </ul>
            </div>
          </details>
        </div>

        <!-- Live status alerts -->
        <div class="docs-alerts" role="status" aria-live="polite">
          <div v-if="isUploading" class="rvo-alert rvo-alert--info rvo-alert--padding-sm">
            <div class="rvo-alert__container">{{ uploadingLabel }}</div>
          </div>
          <div v-if="successMessage" class="rvo-alert rvo-alert--success rvo-alert--padding-sm">
            <div class="rvo-alert__container">
              <strong>Toegevoegd:</strong> {{ successMessage }}
            </div>
          </div>
          <div v-if="uploadError" class="rvo-alert rvo-alert--error rvo-alert--padding-sm">
            <div class="rvo-alert__container">{{ uploadError }}</div>
          </div>
        </div>

        <EntityGraph
          v-if="showGraph"
          id="entity-graph-region"
          :documents="store.documents"
          @close="showGraph = false"
        />

        <ul v-if="store.documents.length > 0" class="docs-list">
          <li
            v-for="doc in store.documents"
            :key="doc.id"
            class="docs-item"
            :class="{ 'docs-item--new': recentlyAddedIds.has(doc.id) }"
          >
            <div class="docs-item__row">
              <div class="docs-item__info">
                <img :src="bevestigingIcon" class="docs-item__check" aria-hidden="true" alt="" />
                <div class="docs-item__text">
                  <span class="docs-item__name">{{ doc.name }}</span>
                  <span class="docs-item__meta rvo-text rvo-text--sm">
                    {{ formatSize(doc.content.length) }}
                    <template v-if="doc.indexing"> · indexeren…</template>
                    <template v-else-if="doc.indexError"> · indexering mislukt</template>
                    <template v-else-if="doc.chunkCount"> · {{ doc.chunkCount }} fragmenten</template>
                  </span>
                </div>
              </div>
              <button
                v-if="store.canEdit"
                type="button"
                class="rvo-link docs-item__remove"
                @click="store.removeDocument(doc.id)"
              >
                Verwijderen
              </button>
            </div>
            <DocumentOntology v-if="!doc.indexing && doc.ontology" :ontology="doc.ontology" />
            <p v-else-if="doc.indexError" class="docs-item__error rvo-text rvo-text--sm">{{ doc.indexError }}</p>
          </li>
        </ul>
        <p v-else-if="!isUploading" class="docs-empty rvo-text rvo-text--sm">Nog geen documenten geüpload.</p>
      </section>

      <!-- Toepassingsscan: which of the forms below actually apply here. -->
      <ToepassingsscanTile
        :run="store.toepassingsscanRun"
        :kenmerken="store.kenmerken"
        :counts="scanCounts"
        @open="scanModal?.open()"
      />

      <!-- Intake en aanbieding gaan aan de fasering vooraf. Ze horen erbij, maar
           als eigen tijdlijnsectie kostten ze een half scherm voor één kaart —
           dus staan ze samen in één platte band boven de spine. -->
      <section
        v-if="preludeForms.length > 0"
        id="fase-vooraf"
        class="prelude"
        aria-labelledby="prelude-title"
      >
        <div class="prelude__header">
          <h2 id="prelude-title" class="rvo-heading rvo-heading--md prelude__title">Vooraf</h2>
          <p class="rvo-text rvo-text--sm prelude__meta">
            Nog geen projectfase<template v-if="preludeCount.total > 0">
              · {{ preludeCount.done }}/{{ preludeCount.total }} afgerond</template>
          </p>
        </div>
        <div class="card-row">
          <template v-for="(form, idx) in preludeForms" :key="form.id">
            <div class="card-chain-item">
              <div v-if="idx > 0" class="card-connector" aria-hidden="true">→</div>
              <FormCard v-bind="cardProps(form)" @open="$emit('open', $event)" v-on="cardHandlers" />
            </div>
          </template>
        </div>
      </section>

      <!-- Lifecycle timeline: one phase per step, always expanded. The spine is
           the point of the page — it is what makes the forms read as phases of
           a process rather than as three unrelated lists. -->
      <ol class="track-timeline">
      <li
        v-for="group in timelineGroups"
        :key="group.track"
        :id="`fase-${group.track}`"
        class="track-phase"
        :aria-labelledby="`track-${group.track}-title`"
      >
        <div
          class="track-phase__marker"
          :class="`track-phase__marker--${markerState(group)}`"
          aria-hidden="true"
        >
          <svg v-if="markerState(group) === 'done'" class="track-phase__check" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" focusable="false"><path fill="currentColor" d="m41.262 6.164c-1.133-.836-2.707-.676-3.641.367l-15.879 17.77-9.547-8.27a2.7 2.7 0 0 0 -3.516-.027 2.71 2.71 0 0 0 -.586 3.469l11.563 19.301a2.72 2.72 0 0 0 2.316 1.316c.957 0 1.836-.492 2.328-1.301l17.66-29.043c.727-1.195.426-2.75-.699-3.582zm0 0"/></svg>
          <template v-else-if="group.phaseNumber > 0">{{ group.phaseNumber }}</template>
        </div>

        <div class="track-phase__body">
          <div class="track-header">
            <p v-if="group.phaseNumber > 0" class="track-eyebrow">
              Fase {{ group.phaseNumber }} van {{ group.phaseCount }}
            </p>
            <div class="track-title-row">
              <h2 :id="`track-${group.track}-title`" class="rvo-heading rvo-heading--xl track-title">{{ group.label }}</h2>
              <span v-if="trackCount(group).total > 0" class="rvo-text rvo-text--sm track-count">
                {{ trackCount(group).done }}/{{ trackCount(group).total }} afgerond
              </span>
            </div>
            <p class="rvo-text track-desc">{{ group.description }}</p>
          </div>

          <p v-if="group.forms.length === 0" class="rvo-text rvo-text--sm track-empty">
            {{ group.emptyHint }}
          </p>

          <div v-else-if="applicableForms(group).length > 0" class="card-row">
            <!-- Connector + card travel as one unit, so a wrapping row never
                 strands a lone glyph at the end of the line above. -->
            <template v-for="(form, idx) in applicableForms(group)" :key="form.id">
            <div class="card-chain-item">
            <div v-if="idx > 0" class="card-connector" aria-hidden="true">
              {{ connectorGlyph({ track: group.track, forms: applicableForms(group) }, idx) }}
            </div>
            <!-- The beslishulp host form is rendered as a pair: its card keeps
                 every affordance the others have, with the beslishulp tile fused
                 to its leading edge. -->
            <FormCard v-bind="cardProps(form)" @open="$emit('open', $event)" v-on="cardHandlers">
              <template v-if="form.id === BESLISHULP_HOST_FORM_ID" #lead>
                <BeslishulpTile :run="store.beslishulpRun" @open="beslishulpModal?.open()" />
              </template>
            </FormCard>
            </div>
            </template>
          </div>

          <!-- Not applicable, collapsed but never hidden: a decision nobody can
               find is worse than a form nobody fills in (docs §5.6). Opening a
               form from here still works — the scan advises, the user decides. -->
          <details v-if="nvtForms(group).length > 0" class="rvo-expandable-content rvo-expandable-content--subtle nvt-group">
            <summary class="rvo-expandable-content__summary rvo-text rvo-text--sm">
              Niet van toepassing in dit dossier ({{ nvtForms(group).length }})
            </summary>
            <div class="rvo-expandable-content__details">
              <ul class="rvo-item-list nvt-list">
                <li v-for="form in nvtForms(group)" :key="form.id" class="rvo-item-list__item nvt-item">
                  <div class="nvt-item__text">
                    <span class="nvt-item__title">{{ form.title }}</span>
                    <span class="rvo-text rvo-text--sm rvo-text--subtle">{{ verdictFor(form.id).reason }}</span>
                  </div>
                  <button
                    type="button"
                    class="rvo-button rvo-button--tertiary rvo-button--size-sm"
                    @click="$emit('open', form.id)"
                  >
                    Toch openen
                  </button>
                </li>
              </ul>
              <p class="rvo-text rvo-text--sm rvo-text--subtle nvt-note">
                Op basis van de toepassingsscan lijken deze onderdelen niet te gelden. Dat is geen
                juridisch oordeel: leg het voor aan de FG, privacy officer of CISO. Al ingevulde
                antwoorden blijven bewaard.
              </p>
            </div>
          </details>
        </div>
      </li>
      </ol>

    </div>

    <ConfirmDialog
      ref="aiModeErrorDialog"
      title="Documenten niet bereikbaar"
      message="De brondocumenten zijn niet meer beschikbaar in de index. Verwijder de documenten en upload ze opnieuw om AI Modus te gebruiken."
      confirm-label="Sluiten"
      cancel-label=""
      @confirm="onAiModeErrorDismissed"
      @cancel="onAiModeErrorDismissed"
    />
    <ConfirmDialog
      ref="renameDialog"
      title="Dossier hernoemen"
      kind="prompt"
      input-label="Nieuwe naam"
      confirm-label="Opslaan"
      @confirm="onRenameConfirmed"
    />
    <ConfirmDialog
      ref="deleteDialog"
      title="Dossier definitief verwijderen"
      :message="deleteMessage"
      :confirm-phrase="store.activeDossier?.name"
      confirm-label="Dossier verwijderen"
      cancel-label="Annuleren"
      variant="warning"
      @confirm="onDeleteConfirmed"
    >
      <template #danger>
        <ul class="rvo-item-list">
          <li v-for="line in deleteImpact" :key="line" class="rvo-item-list__item">{{ line }}</li>
        </ul>
      </template>
    </ConfirmDialog>
    <ShareDialog
      v-if="store.activeDossierId"
      ref="shareDialog"
      :dossier-id="store.activeDossierId"
    />
    <BeslishulpModal ref="beslishulpModal" />
    <ToepassingsscanModal ref="scanModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import bevestigingIcon from '@nl-rvo/assets/icons/status/bevestiging.svg'
import infoIcon from '@nl-rvo/assets/icons/functioneel/info.svg'
import { loadFormRegistry, type FormIndexEntry } from '../services/formLoader'
import { useAssessmentStore } from '../stores/assessmentStore'
import { useAiMode } from '../composables/useAiMode'
import { useFormProgress } from '../composables/useFormProgress'
import type { FormProgress } from '../utils/formProgress'
import { groupFormsByTrack, connectorGlyph, type TrackGroup } from '../utils/tracks'
import DocumentOntology from './DocumentOntology.vue'
import EntityGraph from './EntityGraph.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ShareDialog from './ShareDialog.vue'
import FormCard from './FormCard.vue'
import BeslishulpModal from './BeslishulpModal.vue'
import BeslishulpTile from './BeslishulpTile.vue'
import ToepassingsscanModal from './ToepassingsscanModal.vue'
import ToepassingsscanTile from './ToepassingsscanTile.vue'
import { evaluateApplicability, type ApplicabilityVerdict } from '../utils/toepassingsscan'
import { BESLISHULP_HOST_FORM_ID, isOutOfScope, riskLevelFor, verdictLevelLabel } from '../utils/beslishulp'
import { fetchDossier, saveDossier } from '../services/dossierService'
import { PdfNoTextError } from '../services/llmService'

defineEmits<{ open: [id: string] }>()

const store = useAssessmentStore()
const forms = ref<FormIndexEntry[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref('')
const successMessage = ref('')
const isUploading = ref(false)
const uploadingLabel = ref('')
const recentlyAddedIds = ref<Set<string>>(new Set())
const showGraph = ref(false)
const hasAnyOntology = computed(() => store.documents.some(d => !!d.ontology))

const { aiModeActive, aiModeProgress, aiModeDone, aiModeTotal, aiModeError, aiModePhase, readyDocIds, startAiMode, cancelAiMode, dismissAiModeDone, dismissAiModeError, hasSmoothingUndo, undoSmoothing } = useAiMode()
const { progressFor, trackSummary } = useFormProgress()

const renameDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const deleteDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const shareDialog = ref<InstanceType<typeof ShareDialog> | null>(null)
const shareError = ref('')
const aiModeErrorDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const aiModeErrorFormId = ref<string | null>(null)
const beslishulpModal = ref<InstanceType<typeof BeslishulpModal> | null>(null)
const scanModal = ref<InstanceType<typeof ToepassingsscanModal> | null>(null)

// ---- Toepassingsscan ------------------------------------------------------
// One verdict per form, recomputed whenever the scan (or the beslishulp, which
// feeds one of the kenmerken) changes. `store.kenmerken` is null until a scan
// has been run — every verdict is then 'onbepaald' and the page looks exactly
// as it did before the scan existed.
const ALWAYS: ApplicabilityVerdict = { status: 'altijd', reason: '', kenmerken: [] }

const verdicts = computed(
  () => new Map(forms.value.map((f) => [f.id, evaluateApplicability(f.applicability, store.kenmerken)])),
)

function verdictFor(formId: string): ApplicabilityVerdict {
  return verdicts.value.get(formId) ?? ALWAYS
}

function applicableForms(group: TrackGroup): FormIndexEntry[] {
  return group.forms.filter((f) => verdictFor(f.id).status !== 'nvt')
}

function nvtForms(group: TrackGroup): FormIndexEntry[] {
  return group.forms.filter((f) => verdictFor(f.id).status === 'nvt')
}

const nvtFormIds = computed(
  () => new Set(forms.value.filter((f) => verdictFor(f.id).status === 'nvt').map((f) => f.id)),
)

const scanCounts = computed(() => {
  const counts = { verplicht: 0, mogelijk: 0, nvt: 0 }
  for (const form of forms.value) {
    const status = verdictFor(form.id).status
    if (status === 'verplicht' || status === 'mogelijk' || status === 'nvt') counts[status]++
  }
  return counts
})

// Verdict echoed as a tag on the EU AI Act card. Level only — the tile beside
// it already spells out the roles, and the tag has one line to work with.
const verdictLabel = computed(() =>
  store.beslishulpRun
    ? verdictLevelLabel(new Set(store.beslishulpRun.labels), store.beslishulpRun.conclusionId)
    : '',
)
const verdictTone = computed(() => {
  const run = store.beslishulpRun
  if (!run) return 'neutral'
  if (isOutOfScope(new Set(run.labels), run.conclusionId)) return 'info'
  switch (riskLevelFor(new Set(run.labels))) {
    case 'onaanvaardbaar': return 'error'
    case 'hoog': return 'warning'
    case 'beperkt': return 'info'
    default: return 'success'
  }
})

watch(aiModeError, (errors) => {
  const formId = Object.keys(errors)[0]
  if (formId && !aiModeErrorFormId.value) {
    aiModeErrorFormId.value = formId
    aiModeErrorDialog.value?.open()
  }
}, { deep: true })

const deleteMessage = computed(() => {
  const current = store.activeDossierId ? store.dossiers[store.activeDossierId] : null
  if (!current) return ''
  return `U staat op het punt het dossier "${current.name}" en alle bijbehorende gegevens te verwijderen.`
})

/** Wat er concreet weg is na het verwijderen — zodat de bevestiging over dit
 *  dossier gaat en niet over "een dossier". */
const deleteImpact = computed(() => {
  const current = store.activeDossierId ? store.dossiers[store.activeDossierId] : null
  if (!current) return []
  const docs = current.documents.length
  const filled = Object.values(current.forms).filter(
    (f) => Object.values(f.answers ?? {}).some((a) => a),
  ).length
  return [
    `${docs} ${docs === 1 ? 'brondocument' : 'brondocumenten'}, inclusief de zoekindex en geüploade afbeeldingen`,
    `Alle ingevulde antwoorden${filled ? ` (${filled} ${filled === 1 ? 'formulier' : 'formulieren'})` : ''} en de bewerkgeschiedenis`,
    'De toegang van iedereen met wie dit dossier is gedeeld',
  ]
})


onMounted(async () => {
  store.ensureDossier()
  // Registry incl. placeholders: dit overzicht toont ook wat er nog niet is.
  forms.value = await loadFormRegistry()
})

function onAiModeErrorDismissed() {
  if (aiModeErrorFormId.value) {
    dismissAiModeError(aiModeErrorFormId.value)
    aiModeErrorFormId.value = null
  }
}

function statusFor(formId: string): FormProgress | null {
  if (!store.activeDossierId) return null
  const dossier = store.dossiers[store.activeDossierId]
  return dossier ? progressFor(dossier, formId) : null
}

function openRenameDialog() {
  if (!store.activeDossierId) return
  const current = store.dossiers[store.activeDossierId]
  if (!current) return
  renameDialog.value?.open(current.name)
}

function openDeleteDialog() {
  if (!store.activeDossierId) return
  deleteDialog.value?.open()
}

async function openShareDialog() {
  const id = store.activeDossierId
  const dossier = id ? store.dossiers[id] : null
  if (!id || !dossier) return
  shareError.value = ''
  let grants
  try {
    grants = (await fetchDossier(id)).grants
  } catch {
    // Not on the server yet (never synced) — push it now so it can be shared.
    try {
      const saved = await saveDossier({
        id,
        name: dossier.name,
        createdAt: dossier.createdAt,
        updatedAt: dossier.updatedAt,
        sessionId: dossier.sessionId,
        activeFormId: dossier.activeFormId,
        forms: dossier.forms,
      })
      dossier.myRole = saved.myRole
      grants = saved.grants
    } catch (e) {
      // Sharing needs the server; tell the user why it won't open.
      shareError.value = e instanceof TypeError
        ? 'Delen lukt niet: geen verbinding met de server.'
        : `Delen lukt niet: ${e instanceof Error ? e.message : String(e)}`
      return
    }
  }
  shareDialog.value?.open(grants)
}

function onRenameConfirmed(name: string) {
  if (!store.activeDossierId) return
  const trimmed = name.trim()
  if (!trimmed) return
  store.renameDossier(store.activeDossierId, trimmed)
}

async function onDeleteConfirmed() {
  if (!store.activeDossierId) return
  shareError.value = ''
  try {
    await store.deleteDossier(store.activeDossierId)
  } catch (e) {
    // De server weigerde (bijv. geen eigenaar meer): het dossier blijft staan,
    // dus blijf hier en zeg waarom in plaats van stil terug te navigeren.
    shareError.value = `Verwijderen lukt niet: ${e instanceof Error ? e.message : String(e)}`
    return
  }
  // Never land unannounced in whichever dossier became active next
  store.goToDossierList()
}

async function extractPptxText(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const n = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? '0', 10)
      return n(a) - n(b)
    })
  const parts: string[] = []
  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('string')
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? []
    const slideText = matches
      .map((m) => m.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ')
    if (slideText) parts.push(slideText)
  }
  return parts.join('\n\n')
}

async function onFilesSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  if (files.length === 0) return

  uploadError.value = ''
  successMessage.value = ''
  isUploading.value = true

  const addedNames: string[] = []
  const errors: string[] = []
  const previousIds = new Set(store.documents.map((d) => d.id))

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    uploadingLabel.value =
      files.length > 1
        ? `Inlezen van ${file.name} (${i + 1} van ${files.length})…`
        : `Inlezen van ${file.name}…`

    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!['txt', 'md', 'docx', 'xlsx', 'pptx', 'pdf'].includes(ext)) {
      errors.push(`${file.name}: alleen .txt, .md, .docx, .xlsx, .pptx en .pdf zijn toegestaan.`)
      continue
    }
    try {
      // PDFs go to the backend whole: server-side extraction keeps tables and
      // figures intact, which the browser text layer cannot do.
      if (ext === 'pdf') {
        await store.addPdfDocument(file)
        addedNames.push(file.name)
        continue
      }
      let text: string
      if (ext === 'docx') {
        const mammoth = await import('mammoth/mammoth.browser')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value
      } else if (ext === 'xlsx') {
        const XLSX = await import('xlsx')
        const arrayBuffer = await file.arrayBuffer()
        const wb = XLSX.read(arrayBuffer, { type: 'array' })
        const parts: string[] = []
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
          if (csv.trim()) parts.push(`# ${sheetName}\n${csv}`)
        }
        text = parts.join('\n\n')
      } else if (ext === 'pptx') {
        text = await extractPptxText(file)
      } else {
        text = await file.text()
      }
      if (!text.trim()) {
        errors.push(`${file.name}: geen tekst gevonden.`)
        continue
      }
      // PDFs keep their own name — the backend extracts them as-is.
      const baseName = file.name.replace(/\.(docx|xlsx|pptx)$/i, '.txt')
      await store.addDocument(baseName, text)
      addedNames.push(file.name)
    } catch (err) {
      if (err instanceof PdfNoTextError) {
        errors.push(
          `${file.name}: dit is een gescande PDF (alleen afbeeldingen) — er kon geen tekst uit worden gehaald. Upload een tekst-PDF of het originele Word-bestand.`,
        )
      } else {
        errors.push(`${file.name}: kon bestand niet inlezen.`)
      }
    }
  }

  const newIds = store.documents.map((d) => d.id).filter((id) => !previousIds.has(id))
  recentlyAddedIds.value = new Set(newIds)
  setTimeout(() => {
    for (const id of newIds) recentlyAddedIds.value.delete(id)
    recentlyAddedIds.value = new Set(recentlyAddedIds.value)
  }, 3000)

  isUploading.value = false
  uploadingLabel.value = ''
  if (addedNames.length > 0) {
    successMessage.value = addedNames.join(', ')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  }
  if (errors.length > 0) {
    uploadError.value = errors.join(' ')
  }

  if (fileInput.value) fileInput.value.value = ''
}


function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const trackGroups = computed(() => groupFormsByTrack(forms.value))

// Intake en aanbieding: geen fase, dus geen sectie op de spine. Ze komen samen
// in de "Vooraf"-band, in dezelfde volgorde als hun sporen (TRACK_META.order,
// en `order` daarbinnen).
const preludeGroups = computed(() =>
  trackGroups.value.filter((g) => !g.isPhase && g.track !== 'onbekend'),
)
const preludeForms = computed(() => preludeGroups.value.flatMap((g) => applicableForms(g)))

// De tijdlijn houdt de echte fasen — plus de `onbekend`-bak, want die is het
// zichtbare vangnet voor een typo in index.json.
const timelineGroups = computed(() =>
  trackGroups.value.filter((g) => g.isPhase || g.track === 'onbekend'),
)

const preludeCount = computed(() =>
  preludeGroups.value.reduce(
    (acc, g) => {
      const { done, total } = trackCount(g)
      return { done: acc.done + done, total: acc.total + total }
    },
    { done: 0, total: 0 },
  ),
)

/** Alles wat een kaart nodig heeft, op één plek berekend — de kaart in de band
 *  en de kaart in de tijdlijn krijgen zo gegarandeerd dezelfde affordances. */
function cardProps(form: FormIndexEntry) {
  return {
    form,
    status: statusFor(form.id),
    verdict: verdictFor(form.id),
    paired: form.id === BESLISHULP_HOST_FORM_ID,
    beslishulpVerdict:
      form.id === BESLISHULP_HOST_FORM_ID && store.beslishulpRun
        ? { label: verdictLabel.value, tone: verdictTone.value }
        : null,
    canEdit: store.canEdit,
    hasDocuments: readyDocIds.value.length > 0,
    aiActive: aiModeActive.value.has(form.id),
    aiDone: form.id in aiModeDone.value,
    aiDoneFilled: aiModeDone.value[form.id] ?? 0,
    aiDoneTotal: aiModeTotal.value[form.id] ?? 0,
    aiProgress: aiModeProgress.value[form.id] ?? null,
    aiPhase: aiModePhase.value[form.id] ?? null,
    canUndoSmoothing: hasSmoothingUndo(form.id),
  }
}

const cardHandlers = {
  activate: startAiMode,
  cancel: cancelAiMode,
  dismiss: dismissAiModeDone,
  undoSmoothing: undoSmoothing,
}

// Per-phase completion, recomputed whenever answers change so the timeline
// marker fills in as the user finishes forms in that phase.
// Forms the scan ruled out are left out of the count: otherwise a phase could
// never reach "afgerond" because of a form nobody is supposed to fill in.
const trackCounts = computed(() => {
  const dossier = store.activeDossierId ? store.dossiers[store.activeDossierId] : null
  return dossier ? trackSummary(dossier, nvtFormIds.value) : null
})

function trackCount(group: TrackGroup): { done: number; total: number } {
  if (group.track === 'onbekend') return { done: 0, total: 0 }
  // Placeholders zijn geen formulier: ze mogen de noemer niet optillen, anders
  // kan een fase nooit "afgerond" worden.
  const real = group.forms.filter((f) => !f.placeholder).length
  return trackCounts.value?.[group.track] ?? { done: 0, total: real }
}

// The rail is the lifecycle, so the `onbekend` bucket — which is a symptom of a
// typo in index.json, not a track — stays out of it. It is still rendered as a
// section in the timeline below. Intake en aanbieding staan er wél in: ze zijn
// geen fase, maar wel een stap die de gebruiker doorloopt.
const railGroups = computed(() => trackGroups.value.filter((g) => g.track !== 'onbekend'))

/** How full the rail circle is: the share of this phase's forms that are done.
 *  Any progress at all gets a visible sliver, so "started" never reads as
 *  "untouched" — one form out of nine is 11% and would otherwise vanish. */
function phaseFill(group: TrackGroup): string {
  const { done, total } = trackCount(group)
  if (total === 0 || done === 0) return '0%'
  if (done === total) return '100%'
  return `${Math.max(12, Math.round((done / total) * 100))}%`
}

function phaseRailLabel(group: TrackGroup): string {
  const { done, total } = trackCount(group)
  const progress = total === 0 ? 'nog geen formulieren beschikbaar' : `${done} van ${total} afgerond`
  const prefix = group.phaseNumber > 0 ? `Fase ${group.phaseNumber} van ${group.phaseCount}: ` : ''
  return `${prefix}${group.label} — ${progress}`
}

/** Intake en aanbieding hebben geen eigen sectie meer: beide railstappen
 *  landen op de gedeelde "Vooraf"-band. */
function goToPhase(group: TrackGroup) {
  const id = group.isPhase ? `fase-${group.track}` : 'fase-vooraf'
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Marker state on the spine: filled+check when the phase is finished, a solid
 *  dot while it is under way, an outline when nothing has been started, and a
 *  dashed outline for a phase that has no forms yet (`beheer`). */
function markerState(group: TrackGroup): 'done' | 'busy' | 'todo' | 'empty' {
  const { done, total } = trackCount(group)
  if (total === 0) return 'empty'
  if (done === total) return 'done'
  return done > 0 || applicableForms(group).some((f) => statusFor(f.id)?.status === 'bezig') ? 'busy' : 'todo'
}
</script>

<style scoped>
.portal-page {
  /* Shared by the phase rail and the timeline spine. lichtblauw-300 is
     invisible against the lichtblauw-150 page background — tint the page's own
     lintblauw down instead, as the card shadows do. */
  --track-line: rgb(21 66 115 / 0.22);
  padding: var(--rvo-space-3xl) 0 var(--rvo-space-4xl);
  background: var(--rvo-color-lichtblauw-150);
  min-height: 100%;
}

.dossier-header {
  margin-block-end: var(--rvo-space-2xl);
}

.dossier-header__back {
  display: inline-block;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-size: var(--rvo-font-size-sm);
  color: var(--rvo-color-lintblauw);
  text-decoration: underline;
  margin-block-end: var(--rvo-space-sm);
}

.dossier-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rvo-space-md);
  flex-wrap: wrap;
}

.dossier-header__title-group {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-sm);
  min-inline-size: 0;
}

/* Static mask URL so Vite resolves the NLDS icon in the production build —
   a runtime url(...) binding renders as a white square. */
.dossier-header__icon {
  display: inline-block;
  inline-size: 2rem;
  block-size: 2rem;
  flex-shrink: 0;
  background-color: var(--rvo-color-lintblauw);
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/map-vol-documenten.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/map-vol-documenten.svg') center / contain no-repeat;
}

.dossier-header__name {
  color: var(--rvo-color-lintblauw);
  margin: 0;
  overflow-wrap: anywhere;
}

.dossier-header__desc {
  color: var(--invulhulp-color-text-subtle);
  font-size: var(--rvo-font-size-sm);
  margin: var(--rvo-space-2xs) 0 0;
}

.portal-card {
  position: relative;
  margin-block-end: var(--rvo-space-2xl);
  padding: var(--rvo-space-lg) var(--rvo-space-xl);
  background: var(--rvo-color-wit);
  border: 1px solid var(--rvo-color-lichtblauw-300);
  border-radius: var(--rvo-border-radius-md);
  box-shadow: 0 1px 3px rgb(21 66 115 / 0.06), 0 4px 12px rgb(21 66 115 / 0.04);
}

.portal-card::before {
  content: "";
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  block-size: 4px;
  background: var(--rvo-color-lintblauw);
  border-start-start-radius: var(--rvo-border-radius-md);
  border-start-end-radius: var(--rvo-border-radius-md);
}

.portal-card__header {
  margin-block-end: var(--rvo-space-md);
}

.portal-card__title {
  color: var(--rvo-color-lintblauw);
  margin: 0 0 var(--rvo-space-2xs);
}

.portal-card__desc {
  color: var(--invulhulp-color-text-subtle);
  font-size: var(--rvo-font-size-sm);
  margin: 0;
}

.portal-card__controls {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--rvo-space-md);
  flex-wrap: wrap;
}

.dossier-actions {
  display: flex;
  gap: var(--rvo-space-xs);
  align-items: center;
}

.dossier-actions__share {
  display: inline-flex;
  align-items: center;
  gap: var(--rvo-space-3xs);
}

/* Static mask URL so Vite resolves the NLDS icon in the production build —
   a runtime url(...) binding renders as a white square. */
.dossier-actions__share-icon {
  display: inline-block;
  inline-size: 1rem;
  block-size: 1rem;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/delen.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/delen.svg') center / contain no-repeat;
}

.docs-title-row {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-sm);
  flex-wrap: wrap;
  margin-block-end: var(--rvo-space-2xs);
}

.docs-graph-btn {
  margin-inline-start: auto;
}

.docs-controls {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-sm);
  margin-block-end: var(--rvo-space-sm);
}

.docs-upload-btn {
  cursor: pointer;
}
.docs-upload-btn--busy {
  cursor: progress;
  opacity: 0.7;
  pointer-events: none;
}

.docs-info-details {
  align-self: center;
  position: relative;
}

.docs-info-details :deep(.rvo-expandable-content__summary::after) {
  display: none;
}

.docs-info-details :deep(.rvo-expandable-content__details) {
  position: absolute;
  inset-block-start: calc(100% + var(--rvo-space-2xs));
  inset-inline-start: 0;
  z-index: 100;
  background: var(--rvo-color-wit);
  border: 1px solid var(--invulhulp-color-border);
  border-radius: var(--rvo-border-radius-sm);
  box-shadow: 0 4px 12px rgb(21 66 115 / 0.12);
  padding: var(--rvo-space-xs) var(--rvo-space-sm);
  min-inline-size: 280px;
  max-inline-size: 380px;
}

.docs-info-icon {
  inline-size: 16px;
  block-size: 16px;
  flex-shrink: 0;
  opacity: 0.7;
}

.docs-info-list {
  margin-block-start: var(--rvo-space-2xs);
  margin-block-end: 0;
}

.docs-alerts {
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-xs);
  margin-block-end: var(--rvo-space-sm);
}

.docs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-2xs);
}

.docs-item {
  display: flex;
  flex-direction: column;
  gap: var(--rvo-space-2xs);
  padding: var(--rvo-space-xs) var(--rvo-space-sm);
  background: var(--rvo-color-grijs-100);
  border: 1px solid var(--invulhulp-color-border);
  border-radius: var(--rvo-border-radius-sm);
  transition: background 0.6s ease, border-color 0.6s ease;
}

.docs-item__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rvo-space-xs);
}

.docs-item__error {
  margin: var(--rvo-space-2xs) 0 0;
  color: var(--rvo-color-rood);
}

.docs-item--new {
  background: var(--rvo-color-groen-150);
  border-color: var(--rvo-color-groen);
  animation: doc-pulse 1.2s ease-out;
}

@keyframes doc-pulse {
  0% { background: var(--rvo-color-groen-300); }
  100% { background: var(--rvo-color-groen-150); }
}


.docs-item__info {
  display: flex;
  align-items: center;
  gap: var(--rvo-space-xs);
}

.docs-item__check {
  inline-size: 20px;
  block-size: 20px;
  flex-shrink: 0;
  /* Tint the SVG to the RVO groen colour via a CSS filter */
  filter: invert(40%) sepia(80%) saturate(500%) hue-rotate(65deg) brightness(90%);
}

.docs-item__text {
  display: flex;
  flex-direction: column;
}

.docs-item__name {
  font-weight: var(--rvo-font-weight-semibold);
  color: var(--rvo-color-grijs-800);
  font-size: var(--rvo-font-size-sm);
}

.docs-item__meta {
  color: var(--invulhulp-color-text-subtle);
}

.docs-item__remove {
  background: none;
  border: 0;
  color: var(--rvo-color-rood);
  cursor: pointer;
  font-size: var(--rvo-font-size-sm);
  text-decoration: underline;
  padding: var(--rvo-space-2xs) var(--rvo-space-xs);
}

.docs-empty {
  color: var(--rvo-color-grijs-500);
  font-style: italic;
  margin: 0;
}

/* ---- Phase rail ------------------------------------------------------- */

.phase-rail {
  margin-block-end: var(--rvo-space-2xl);
  padding: var(--rvo-space-lg) var(--rvo-space-md);
  background: var(--rvo-color-wit);
  border: 1px solid var(--rvo-color-lichtblauw-300);
  border-radius: var(--rvo-border-radius-md);
  box-shadow: 0 1px 3px rgb(21 66 115 / 0.06), 0 4px 12px rgb(21 66 115 / 0.04);
  /* Six phases don't fit a phone; scroll the rail rather than the page. */
  overflow-x: auto;
}

.phase-rail__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: flex-start;
  min-inline-size: 34rem;
  --rail-circle-size: 2.75rem;
}

.phase-rail__item {
  flex: 1;
  position: relative;
}

/* Intake en aanbieding zijn aanloop, geen fase: alleen een kleiner rondje.
   Alle cellen houden dezelfde breedte — de verbindingslijn hieronder is
   `inline-size: 100%` van de eigen cel en loopt tot het midden van de volgende,
   wat alleen klopt zolang buren even breed zijn. */

/* Verkleinen met `transform`, niet met --rail-circle-size: de verbindingslijn
   loopt op de hoogte van het grote midden, dus het rondje moet zijn hoogte
   houden om erop uitgelijnd te blijven. */
.phase-rail__circle--minor {
  transform: scale(0.72);
}

/* The connector runs behind the circles, from this step's centre to the next. */
.phase-rail__item:not(:last-child)::after {
  content: "";
  position: absolute;
  inset-block-start: calc(var(--rail-circle-size) / 2 - 1px);
  inset-inline-start: 50%;
  inline-size: 100%;
  block-size: 2px;
  background: var(--track-line);
}

.phase-rail__step {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rvo-space-2xs);
  inline-size: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  padding: var(--rvo-space-2xs) var(--rvo-space-3xs);
}

/* Hover lands on the circle and the label, never on the cell: a filled block
   would paint over the connector line running behind it. */
.phase-rail__step:hover .phase-rail__circle {
  border-color: var(--rvo-color-lintblauw);
  box-shadow: 0 0 0 4px var(--rvo-color-lichtblauw-300);
}

.phase-rail__step:hover .phase-rail__label {
  text-decoration: underline;
}

.phase-rail__step:focus-visible {
  outline: none;
}

.phase-rail__step:focus-visible .phase-rail__circle {
  outline: 2px solid var(--rvo-color-lintblauw);
  outline-offset: 3px;
}

.phase-rail__step:focus-visible .phase-rail__label {
  text-decoration: underline;
}

/* The circle fills from the bottom up to --phase-fill. The wash is a light
   tint rather than full lintblauw so the icon stays legible at any level;
   only a completed phase goes solid (see --done below). */
.phase-rail__circle {
  inline-size: var(--rail-circle-size);
  block-size: var(--rail-circle-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 2px solid var(--track-line);
  color: var(--rvo-color-lintblauw);
  transition: border-color 0.15s, box-shadow 0.15s;
  background:
    linear-gradient(
      to top,
      var(--rvo-color-lichtblauw-750) 0 var(--phase-fill, 0%),
      var(--rvo-color-wit) var(--phase-fill, 0%) 100%
    );
}

.phase-rail__circle--busy {
  border-color: var(--rvo-color-lintblauw);
}

.phase-rail__circle--done {
  border-color: var(--rvo-color-lintblauw);
  background: var(--rvo-color-lintblauw);
  color: var(--rvo-color-wit);
}

/* A phase with no forms yet (beheer) — deliberately visible, visibly unfillable. */
.phase-rail__circle--empty {
  border-style: dashed;
  border-color: var(--rvo-color-grijs-400);
  color: var(--rvo-color-grijs-500);
  background: var(--rvo-color-wit);
}

.phase-rail__icon {
  display: block;
  inline-size: 1.375rem;
  block-size: 1.375rem;
  background-color: currentColor;
}

/* Static mask URLs so Vite resolves the NLDS icons in the production build —
   a runtime url(...) binding renders as a white square. One rule per phase. */
.phase-rail__circle--icon-intake .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-lijnen.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-lijnen.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-aanbieding .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-lijnen-en-lint.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-lijnen-en-lint.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-initiatie .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/navigatie/kompas.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/navigatie/kompas.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-uitvoering .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/gereedschap/moersleutel-en-schroevendraaier.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/gereedschap/moersleutel-en-schroevendraaier.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-afronding .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/klembord-met-vinkje.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/klembord-met-vinkje.svg') center / contain no-repeat;
}

.phase-rail__label {
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  line-height: 1.3;
  font-weight: var(--rvo-font-weight-semibold);
  color: var(--rvo-color-lintblauw);
  text-align: center;
  text-wrap: balance;
}

.phase-rail__count {
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  color: var(--invulhulp-color-text-subtle);
}

/* ---- Vooraf-band ------------------------------------------------------ */

/* Platter dan .portal-card en zonder de blauwe kaartrand bovenaan: de band mag
   niet concurreren met de fasen eronder — hij gaat eraan vooraf. */
.prelude {
  margin-block-end: var(--rvo-space-2xl);
  padding: var(--rvo-space-md) var(--rvo-space-lg);
  background: var(--rvo-color-wit);
  border: 1px solid var(--rvo-color-lichtblauw-300);
  border-radius: var(--rvo-border-radius-md);
  /* Clear the sticky header when the fase rail scrolls here. */
  scroll-margin-block-start: calc(var(--invulhulp-header-height) + var(--rvo-space-lg));
}

.prelude__header {
  display: flex;
  align-items: baseline;
  gap: var(--rvo-space-sm);
  flex-wrap: wrap;
  margin-block-end: var(--rvo-space-sm);
}

.prelude__title {
  color: var(--rvo-color-lintblauw);
  margin: 0;
}

.prelude__meta {
  color: var(--invulhulp-color-text-subtle);
  margin: 0;
}

/* ---- Timeline --------------------------------------------------------- */

/* Vertical lifecycle timeline. The spine is drawn per phase (not once on the
   list) so it can stop cleanly at the last marker instead of trailing into the
   whitespace below the final card row. */
.track-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  --track-marker-size: 2.25rem;
  --track-gutter: 3.25rem;
}

.track-phase {
  position: relative;
  /* Clear the sticky header, or the fase rail scrolls a phase to right under it. */
  scroll-margin-block-start: calc(var(--invulhulp-header-height) + var(--rvo-space-lg));
  padding-inline-start: var(--track-gutter);
  padding-block-end: var(--rvo-space-3xl);
}

.track-phase:last-child {
  padding-block-end: 0;
}

/* The connecting line: from just under this marker down to the next one. */
.track-phase::before {
  content: "";
  position: absolute;
  inset-block-start: var(--track-marker-size);
  inset-block-end: 0;
  inset-inline-start: calc(var(--track-marker-size) / 2 - 1px);
  inline-size: 2px;
  background: var(--track-line);
}

.track-phase:last-child::before {
  display: none;
}

.track-phase__marker {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  inline-size: var(--track-marker-size);
  block-size: var(--track-marker-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--rvo-font-size-sm);
  font-weight: var(--rvo-font-weight-bold);
  box-sizing: border-box;
  background: var(--rvo-color-wit);
  color: var(--rvo-color-lintblauw);
  border: 2px solid var(--track-line);
}

.track-phase__marker--todo {
  border-color: var(--track-line);
  color: var(--invulhulp-color-text-subtle);
}

.track-phase__marker--busy {
  border-color: var(--rvo-color-lintblauw);
  color: var(--rvo-color-lintblauw);
  box-shadow: inset 0 0 0 3px var(--rvo-color-lichtblauw-150);
}

.track-phase__marker--done {
  background: var(--rvo-color-lintblauw);
  border-color: var(--rvo-color-lintblauw);
  color: var(--rvo-color-wit);
}

/* A phase with no forms yet (beheer) — deliberately visible, visibly unfilled. */
.track-phase__marker--empty {
  border-style: dashed;
  border-color: var(--rvo-color-grijs-400);
  color: var(--rvo-color-grijs-500);
}

.track-phase__check {
  inline-size: 1rem;
  block-size: 1rem;
}

.track-eyebrow {
  margin: 0 0 var(--rvo-space-3xs);
  font-size: var(--rvo-font-size-2xs, 0.75rem);
  font-weight: var(--rvo-font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--invulhulp-color-text-subtle);
}

.track-title-row {
  display: flex;
  align-items: baseline;
  gap: var(--rvo-space-sm);
  flex-wrap: wrap;
}

.track-count {
  color: var(--invulhulp-color-text-subtle);
  white-space: nowrap;
}

.track-header {
  /* Reserve the marker's height so short headings still clear the spine. */
  min-block-size: var(--track-marker-size);
  margin-block-end: var(--rvo-space-md);
}

@media (max-width: 640px) {
  .track-timeline {
    --track-marker-size: 1.75rem;
    --track-gutter: 2.5rem;
  }
}

.track-title {
  color: var(--rvo-color-lintblauw);
  margin: 0 0 var(--rvo-space-2xs);
}

.track-desc {
  color: var(--invulhulp-color-text-subtle);
  font-size: var(--rvo-font-size-sm);
  margin: 0;
}

.track-empty {
  color: var(--invulhulp-color-text-subtle);
  max-inline-size: 60ch;
  margin: 0;
  padding: var(--rvo-space-md);
  border: 1px dashed var(--rvo-color-grijs-400);
  border-radius: var(--rvo-border-radius-md, 4px);
}

.card-row {
  display: flex;
  align-items: stretch;
  column-gap: 0;
  row-gap: var(--rvo-space-md);
  flex-wrap: wrap;
}

/* Connector + card as one unwrappable unit; each line stretches its own cards
   to equal height. */
.card-chain-item {
  display: flex;
  align-items: stretch;
}

.card-connector {
  display: flex;
  align-items: center;
  padding: 0 var(--rvo-space-xs);
  color: var(--rvo-color-grijs-400);
  font-size: var(--rvo-font-size-md);
  flex-shrink: 0;
  align-self: center;
}

/* --- Niet van toepassing, per phase. Stock rvo-item-list rows; only the
   layout inside a row and the struck-through title are ours. --- */
.nvt-group {
  margin-block-start: var(--rvo-space-md);
  max-inline-size: 52rem;
}

.nvt-list {
  margin: 0;
}

.nvt-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rvo-space-md);
}

.nvt-item__text {
  display: flex;
  flex-direction: column;
}

.nvt-item__title {
  font-weight: var(--rvo-font-weight-semibold);
  text-decoration: line-through;
  text-decoration-color: var(--rvo-color-grijs-500);
  color: var(--rvo-color-grijs-700);
}

.nvt-note {
  margin-block: var(--rvo-space-sm) 0;
  max-inline-size: 68ch;
}

</style>

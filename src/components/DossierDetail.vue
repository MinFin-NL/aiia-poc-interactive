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
          <li v-for="group in railGroups" :key="group.track" class="phase-rail__item">
            <button
              type="button"
              class="phase-rail__step"
              :aria-label="phaseRailLabel(group)"
              @click="goToPhase(group.track)"
            >
              <span
                class="phase-rail__circle"
                :class="[`phase-rail__circle--${markerState(group)}`, `phase-rail__circle--icon-${group.track}`]"
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

      <!-- Lifecycle timeline: one phase per step, always expanded. The spine is
           the point of the page — it is what makes the forms read as phases of
           a process rather than as six unrelated lists. -->
      <ol class="track-timeline">
      <li
        v-for="group in trackGroups"
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

          <div v-else class="card-row">
            <!-- Connector + card travel as one unit, so a wrapping row never
                 strands a lone glyph at the end of the line above. -->
            <template v-for="(form, idx) in group.forms" :key="form.id">
            <div class="card-chain-item">
            <div v-if="idx > 0" class="card-connector" aria-hidden="true">
              {{ connectorGlyph(group, idx) }}
            </div>
            <!-- The beslishulp host form is rendered as a pair: its card keeps
                 every affordance the others have, with the beslishulp tile fused
                 to its leading edge. -->
            <div class="form-slot" :class="{ 'form-slot--paired': form.id === BESLISHULP_HOST_FORM_ID }">
              <BeslishulpTile
                v-if="form.id === BESLISHULP_HOST_FORM_ID"
                :run="store.beslishulpRun"
                @open="beslishulpModal?.open()"
              />
            <article
              class="rvo-card rvo-card--outline rvo-card--padding--md form-card"
              :class="{
                'form-card--ai-mode': aiModeActive.has(form.id),
                'form-card--paired': form.id === BESLISHULP_HOST_FORM_ID,
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
                  v-if="form.id === BESLISHULP_HOST_FORM_ID && store.beslishulpRun"
                  class="rvo-tag rvo-tag--pill form-card__status form-card__verdict"
                  :class="`form-card__verdict--${verdictTone}`"
                >
                  {{ verdictLabel }}
                </span>
                <span
                  v-if="statusFor(form.id)"
                  class="rvo-tag rvo-tag--pill form-card__status"
                  :class="{
                    'rvo-tag--info': statusFor(form.id)!.status === 'bezig',
                    'rvo-tag--success': statusFor(form.id)!.status === 'afgerond',
                  }"
                >
                  {{ statusLabel(statusFor(form.id)!) }}
                </span>
                <button
                  class="rvo-button rvo-button--primary rvo-button--size-sm form-card__btn"
                  @click="$emit('open', form.id)"
                >
                  {{ statusFor(form.id)?.status === 'bezig' ? 'Verder' : 'Openen' }}
                </button>
                <AiModeToggle
                  v-if="store.canEdit"
                  :form-id="form.id"
                  :has-documents="readyDocIds.length > 0"
                  :is-active="aiModeActive.has(form.id)"
                  :is-done="form.id in aiModeDone"
                  :done-filled-count="aiModeDone[form.id] ?? 0"
                  :done-total-count="aiModeTotal[form.id] ?? 0"
                  :progress="aiModeProgress[form.id] ?? null"
                  :phase="aiModePhase[form.id] ?? null"
                  :can-undo-smoothing="hasSmoothingUndo(form.id)"
                  @activate="startAiMode"
                  @cancel="cancelAiMode"
                  @dismiss="dismissAiModeDone"
                  @undo-smoothing="undoSmoothing"
                />
              </div>
            </article>
            </div>
            </div>
            </template>
          </div>
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
      title="Dossier verwijderen"
      :message="deleteMessage"
      confirm-label="Verwijderen"
      cancel-label="Annuleren"
      variant="warning"
      @confirm="onDeleteConfirmed"
    />
    <ShareDialog
      v-if="store.activeDossierId"
      ref="shareDialog"
      :dossier-id="store.activeDossierId"
    />
    <BeslishulpModal ref="beslishulpModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import bevestigingIcon from '@nl-rvo/assets/icons/status/bevestiging.svg'
import infoIcon from '@nl-rvo/assets/icons/functioneel/info.svg'
import { loadAvailableForms, type FormIndexEntry } from '../services/formLoader'
import { useAssessmentStore } from '../stores/assessmentStore'
import { useAiMode } from '../composables/useAiMode'
import { useFormProgress } from '../composables/useFormProgress'
import type { FormProgress } from '../utils/formProgress'
import { groupFormsByTrack, connectorGlyph, type TrackGroup } from '../utils/tracks'
import DocumentOntology from './DocumentOntology.vue'
import EntityGraph from './EntityGraph.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ShareDialog from './ShareDialog.vue'
import AiModeToggle from './AiModeToggle.vue'
import BeslishulpModal from './BeslishulpModal.vue'
import BeslishulpTile from './BeslishulpTile.vue'
import { BESLISHULP_HOST_FORM_ID, isOutOfScope, riskLevelFor, verdictLevelLabel } from '../utils/beslishulp'
import { fetchDossier, saveDossier } from '../services/dossierService'

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
  return `Dossier "${current.name}" verwijderen? Alle formulierantwoorden en brondocumenten in dit dossier gaan verloren.`
})


onMounted(async () => {
  store.ensureDossier()
  forms.value = await loadAvailableForms()
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

function statusLabel(p: FormProgress): string {
  if (p.status === 'afgerond') return 'Afgerond'
  if (p.status === 'bezig') return `Bezig (${p.completed}/${p.total})`
  return 'Niet gestart'
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

function onDeleteConfirmed() {
  if (!store.activeDossierId) return
  store.deleteDossier(store.activeDossierId)
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

/**
 * Extracts the embedded text layer from a PDF. Works for "born-digital" PDFs
 * (exported from Word, etc.). Scanned/image-only PDFs have no text layer, so
 * this throws PDF_NO_TEXT — we deliberately do not OCR.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  // The worker's content never changes between builds, so Vite keeps giving it
  // the same hashed filename — and browsers that cached it while nginx still
  // served .mjs as application/octet-stream keep replaying that wrong MIME
  // type, which blocks the module worker no matter what the server now sends.
  // A version query yields a URL those caches have never seen. Bump it if a
  // cached worker response ever needs invalidating again.
  pdfjs.GlobalWorkerOptions.workerSrc = `${worker}?v=2`

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const parts: string[] = []
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (pageText) parts.push(pageText)
    }
  } finally {
    await doc.destroy()
  }
  const text = parts.join('\n\n')
  if (!text.trim()) throw new Error('PDF_NO_TEXT')
  return text
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
      } else if (ext === 'pdf') {
        text = await extractPdfText(file)
      } else {
        text = await file.text()
      }
      if (!text.trim()) {
        errors.push(`${file.name}: geen tekst gevonden.`)
        continue
      }
      const baseName = file.name.replace(/\.(docx|xlsx|pptx|pdf)$/i, '.txt')
      await store.addDocument(baseName, text)
      addedNames.push(file.name)
    } catch (err) {
      if (err instanceof Error && err.message === 'PDF_NO_TEXT') {
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

const trackGroups = computed(() => groupFormsByTrack(forms.value))

// Per-phase completion, recomputed whenever answers change so the timeline
// marker fills in as the user finishes forms in that phase.
const trackCounts = computed(() => {
  const dossier = store.activeDossierId ? store.dossiers[store.activeDossierId] : null
  return dossier ? trackSummary(dossier) : null
})

function trackCount(group: TrackGroup): { done: number; total: number } {
  if (group.track === 'onbekend') return { done: 0, total: 0 }
  return trackCounts.value?.[group.track] ?? { done: 0, total: group.forms.length }
}

// The rail is the lifecycle, so the `onbekend` bucket — which is a symptom of a
// typo in index.json, not a phase — stays out of it. It is still rendered as a
// section in the timeline below.
const railGroups = computed(() => trackGroups.value.filter((g) => g.phaseNumber > 0))

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
  const progress = total === 0 ? 'nog geen formulieren' : `${done} van ${total} afgerond`
  return `Fase ${group.phaseNumber} van ${group.phaseCount}: ${group.label} — ${progress}`
}

function goToPhase(track: string) {
  const el = document.getElementById(`fase-${track}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Marker state on the spine: filled+check when the phase is finished, a solid
 *  dot while it is under way, an outline when nothing has been started, and a
 *  dashed outline for a phase that has no forms yet (`beheer`). */
function markerState(group: TrackGroup): 'done' | 'busy' | 'todo' | 'empty' {
  const { done, total } = trackCount(group)
  if (total === 0) return 'empty'
  if (done === total) return 'done'
  return done > 0 || group.forms.some((f) => statusFor(f.id)?.status === 'bezig') ? 'busy' : 'todo'
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
.phase-rail__circle--icon-verkennen .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/navigatie/kompas.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/navigatie/kompas.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-besluiten .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-lijnen-en-lint.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-lijnen-en-lint.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-ontwerpen .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-potlood.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/document-met-potlood.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-toetsen .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/klembord-met-loep.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/klembord-met-loep.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-ingebruikname .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/functioneel/publicatie.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/functioneel/publicatie.svg') center / contain no-repeat;
}
.phase-rail__circle--icon-beheer .phase-rail__icon {
  -webkit-mask: url('@nl-rvo/assets/icons/op-kantoor/pijlen-in-cirkel-om-document.svg') center / contain no-repeat;
  mask: url('@nl-rvo/assets/icons/op-kantoor/pijlen-in-cirkel-om-document.svg') center / contain no-repeat;
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
  scroll-margin-block-start: var(--rvo-space-lg);
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

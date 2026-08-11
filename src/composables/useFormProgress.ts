import { ref } from 'vue'
import { loadAvailableForms, loadForm, type FormIndexEntry } from '../services/formLoader'
import { formProgress, type FormProgress } from '../utils/formProgress'
import { TRACK_IDS, trackIdFor, type TrackId } from '../utils/tracks'
import type { FormConfig } from '../models/Assessment'
import type { Dossier } from '../stores/assessmentStore'

// Module-level singleton — the registry and form configs are static per
// deployment, so one load serves every component instance.
const formIndex = ref<FormIndexEntry[]>([])
const configs = ref<Map<string, FormConfig>>(new Map())
let loadPromise: Promise<void> | null = null

async function loadAll(): Promise<void> {
  const index = await loadAvailableForms()
  const loaded = await Promise.all(
    index.map(async (entry) => {
      try {
        return [entry.id, await loadForm(entry.id)] as const
      } catch {
        return null
      }
    }),
  )
  formIndex.value = index
  configs.value = new Map(loaded.filter((e): e is [string, FormConfig] => e !== null))
}

/**
 * Per-form and per-dossier completion status for the dossier overview and
 * detail pages. Loads all form configs once (loadForm caches the fetches).
 */
export function useFormProgress() {
  if (!loadPromise) loadPromise = loadAll()

  function progressFor(dossier: Dossier, formId: string): FormProgress | null {
    const config = configs.value.get(formId)
    if (!config) return null
    return formProgress(config, dossier.forms[formId])
  }

  function dossierSummary(dossier: Dossier): { done: number; total: number } {
    let done = 0
    for (const entry of formIndex.value) {
      if (progressFor(dossier, entry.id)?.status === 'afgerond') done++
    }
    return { done, total: formIndex.value.length }
  }

  /**
   * Completion per lifecycle phase, for the dossier timeline and the phase bar
   * on the dossier cards. Every phase is present, including ones without forms
   * (`beheer`), so callers can render the full lifecycle without holes.
   */
  function trackSummary(
    dossier: Dossier,
    /** Forms to leave out of the count entirely — the toepassingsscan ruled
     *  them not applicable, so a phase must be able to reach "afgerond"
     *  without them. */
    skip?: ReadonlySet<string>,
  ): Record<TrackId, { done: number; total: number }> {
    const out = Object.fromEntries(
      TRACK_IDS.map((t) => [t, { done: 0, total: 0 }]),
    ) as Record<TrackId, { done: number; total: number }>
    for (const entry of formIndex.value) {
      const t = trackIdFor(entry.track, entry.id)
      if (t === 'onbekend' || skip?.has(entry.id)) continue
      out[t].total++
      if (progressFor(dossier, entry.id)?.status === 'afgerond') out[t].done++
    }
    return out
  }

  return { formIndex, progressFor, dossierSummary, trackSummary, ready: () => loadPromise! }
}

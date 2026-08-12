import type { FormConfig, CrossFormMapping, Question } from '../models/Assessment'
import type { ApplicabilityRule } from '../utils/toepassingsscan'

const cache = new Map<string, FormConfig>()
let mappingsCache: CrossFormMapping[] | null = null

// The form registry and definitions live at stable URLs, so a browser that
// cached them before nginx sent Cache-Control keeps serving its own copy —
// new bundle, old form data, every form under "Niet ingedeeld". Server headers
// don't apply retroactively to an already-stored entry, so ask the fetch layer
// to revalidate: 'no-cache' still uses the cache, it just always checks with
// the server first (a cheap 304 when nothing changed).
const REVALIDATE: RequestInit = { cache: 'no-cache' }

export async function loadForm(id: string): Promise<FormConfig> {
  if (cache.has(id)) return cache.get(id)!
  const res = await fetch(`/forms/${id}.json`, REVALIDATE)
  if (!res.ok) throw new Error(`Form not found: ${id}`)
  const config = await res.json() as FormConfig
  cache.set(id, config)
  return config
}

/** Subject domain of a form. Orthogonal to `track` (which is the lifecycle
 *  phase): a form is shown under one track but can touch several domains. */
export type FormDomain = 'privacy' | 'beveiliging' | 'ai' | 'data' | 'project'

/**
 * Een aangekondigd formulier dat nog niet bestaat. `gepland` = komt er, staat op
 * de roadmap; `onzeker` = het is nog niet besloten of dit formulier er komt.
 * Zulke entries hebben geen JSON-bestand: ze zijn alleen een tegel op het
 * dossieroverzicht en tellen nergens in mee.
 */
export type FormPlaceholder = 'gepland' | 'onzeker'

export interface FormIndexEntry {
  id: string
  title: string
  track?: string
  order?: number
  domains?: FormDomain[]
  shortDescription?: string
  placeholder?: FormPlaceholder
  // When this form applies to a dossier, expressed over the kenmerken the
  // toepassingsscan derives. Absent ⇒ the form always applies. See
  // src/utils/toepassingsscan.ts and docs/toepasselijkheid-van-formulieren.md.
  applicability?: ApplicabilityRule
}

/** The registry as it stands, placeholders included. Only the dossier overview
 *  wants these — everything that counts, opens or scans forms wants
 *  `loadAvailableForms()` instead. */
export async function loadFormRegistry(): Promise<FormIndexEntry[]> {
  const res = await fetch('/forms/index.json', REVALIDATE)
  if (!res.ok) throw new Error('Could not load form index')
  const raw = await res.json() as { forms: FormIndexEntry[] }
  return raw.forms.map((f) => ({ id: f.id, title: f.title ?? f.id, track: f.track, order: f.order, domains: f.domains, shortDescription: f.shortDescription, placeholder: f.placeholder, applicability: f.applicability }))
}

/** The forms that actually exist and can be opened. Placeholders are left out:
 *  they have no JSON, so counting or fetching them would only produce holes. */
export async function loadAvailableForms(): Promise<FormIndexEntry[]> {
  return (await loadFormRegistry()).filter((f) => !f.placeholder)
}

export async function loadCrossFormMappings(): Promise<CrossFormMapping[]> {
  if (mappingsCache) return mappingsCache
  const res = await fetch('/forms/crossFormMappings.json', REVALIDATE)
  mappingsCache = res.ok ? (await res.json() as CrossFormMapping[]) : []
  return mappingsCache
}

export function getCachedForm(id: string): FormConfig | undefined {
  return cache.get(id)
}

export function flattenFormQuestions(form: FormConfig): Question[] {
  return form.sections.flatMap((s) => s.subsections.flatMap((ss) => ss.questions))
}

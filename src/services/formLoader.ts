import type { FormConfig, CrossFormMapping, Question } from '../models/Assessment'

const cache = new Map<string, FormConfig>()
let mappingsCache: CrossFormMapping[] | null = null

export async function loadForm(id: string): Promise<FormConfig> {
  if (cache.has(id)) return cache.get(id)!
  const res = await fetch(`/forms/${id}.json`)
  if (!res.ok) throw new Error(`Form not found: ${id}`)
  const config = await res.json() as FormConfig
  cache.set(id, config)
  return config
}

/** Subject domain of a form. Orthogonal to `track` (which is the lifecycle
 *  phase): a form is shown under one track but can touch several domains. */
export type FormDomain = 'privacy' | 'beveiliging' | 'ai' | 'data' | 'project'

export interface FormIndexEntry {
  id: string
  title: string
  track?: string
  order?: number
  domains?: FormDomain[]
  shortDescription?: string
}

export async function loadAvailableForms(): Promise<FormIndexEntry[]> {
  const res = await fetch('/forms/index.json')
  if (!res.ok) throw new Error('Could not load form index')
  const raw = await res.json() as { forms: FormIndexEntry[] }
  return raw.forms.map((f) => ({ id: f.id, title: f.title ?? f.id, track: f.track, order: f.order, domains: f.domains, shortDescription: f.shortDescription }))
}

export async function loadCrossFormMappings(): Promise<CrossFormMapping[]> {
  if (mappingsCache) return mappingsCache
  const res = await fetch('/forms/crossFormMappings.json')
  mappingsCache = res.ok ? (await res.json() as CrossFormMapping[]) : []
  return mappingsCache
}

export function getCachedForm(id: string): FormConfig | undefined {
  return cache.get(id)
}

export function flattenFormQuestions(form: FormConfig): Question[] {
  return form.sections.flatMap((s) => s.subsections.flatMap((ss) => ss.questions))
}

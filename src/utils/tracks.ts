import type { FormIndexEntry } from '../services/formLoader'

/**
 * Sporen are one axis only: the lifecycle phase of the project. The subject
 * domain (privacy / beveiliging / ai / data) is a facet on the card, not a
 * heading — see FormIndexEntry.domains.
 *
 * In the UI these are called "fasen"; "spoor" / `track` stays the term in the
 * code, the form registry and docs/sporen-en-roadmap.md.
 */
export type TrackId =
  | 'verkennen'
  | 'besluiten'
  | 'ontwerpen'
  | 'toetsen'
  | 'ingebruikname'
  | 'beheer'
  | 'onbekend'

export interface TrackMeta {
  label: string
  description: string
  order: number
  emptyHint?: string
}

// `emptyHint` is shown instead of cards for a track we deliberately want
// visible while it has no forms yet: the gap is information, not an omission.
export const TRACK_META: Record<TrackId, TrackMeta> = {
  verkennen: {
    label: 'Verkennen & afbakenen',
    description: 'Bepaal wat je gaat doen en welke zwaardere instrumenten je daarvoor nodig hebt.',
    order: 1,
  },
  besluiten: {
    label: 'Onderbouwen & besluiten',
    description: 'Bouw de business case op voor de portfolioafweging en leg het besluit vast.',
    order: 2,
  },
  ontwerpen: {
    label: 'Ontwerpen',
    description: 'Leg de aanpak, de architectuurkaders en de gegevensstromen vast.',
    order: 3,
  },
  toetsen: {
    label: 'Toetsen',
    description: 'De volledige impact assessments voor privacy, grondrechten en AI — deze voeden elkaar over en weer.',
    order: 4,
  },
  ingebruikname: {
    label: 'In gebruik nemen',
    description: 'Registreer en publiceer wat er daadwerkelijk live gaat.',
    order: 5,
  },
  beheer: {
    label: 'Beheren & evalueren',
    description: 'Herijking, incidenten en monitoring gedurende de levensduur van het systeem.',
    order: 6,
    emptyHint: 'Voor deze fase zijn nog geen formulieren beschikbaar. Verplichtingen zoals periodieke herijking (AVG art. 35 lid 11), incidentregistratie en post-market monitoring lopen door ná ingebruikname — die instrumenten staan op de roadmap.',
  },
  onbekend: {
    label: 'Niet ingedeeld',
    description: 'Deze formulieren hebben een onbekend spoor in index.json en zijn daardoor niet ingedeeld.',
    order: 98,
  },
}

/** The real lifecycle phases, in order. `onbekend` is a fallback bucket, not a
 *  phase, so it is deliberately excluded — it must not shift the numbering. */
export const TRACK_IDS: TrackId[] = (Object.keys(TRACK_META) as TrackId[])
  .filter((t) => t !== 'onbekend')
  .sort((a, b) => TRACK_META[a].order - TRACK_META[b].order)

/**
 * An unknown track used to fall through to the assessments group, which hid
 * typos in index.json. Surface them instead.
 */
export function trackIdFor(track: string | undefined, formId?: string): TrackId {
  const t = (track ?? 'onbekend') as TrackId
  if (!TRACK_META[t]) {
    console.warn(`[forms] Onbekend spoor "${track}" voor formulier "${formId ?? '?'}" — controleer public/forms/index.json`)
    return 'onbekend'
  }
  return t
}

export function trackLabel(track: string | undefined): string {
  const t = (track ?? 'onbekend') as TrackId
  return TRACK_META[t]?.label ?? TRACK_META.onbekend.label
}

export interface TrackGroup {
  track: TrackId
  label: string
  description: string
  emptyHint?: string
  forms: FormIndexEntry[]
  /** 1-based position among the real phases; 0 for the `onbekend` bucket. */
  phaseNumber: number
  /** How many real phases there are, so a heading can say "fase 3 van 6". */
  phaseCount: number
}

export function groupFormsByTrack(forms: FormIndexEntry[]): TrackGroup[] {
  const byTrack: Partial<Record<TrackId, FormIndexEntry[]>> = {}
  for (const form of forms) {
    const t = trackIdFor(form.track, form.id)
    ;(byTrack[t] ??= []).push(form)
  }
  // Iterate over TRACK_META (not over the forms present) so a track with an
  // emptyHint still renders when it has no forms yet.
  return (Object.keys(TRACK_META) as TrackId[])
    .filter((track) => byTrack[track]?.length || TRACK_META[track].emptyHint)
    .sort((a, b) => TRACK_META[a].order - TRACK_META[b].order)
    .map((track) => ({
      track,
      label: TRACK_META[track].label,
      description: TRACK_META[track].description,
      emptyHint: TRACK_META[track].emptyHint,
      forms: [...(byTrack[track] ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      phaseNumber: TRACK_IDS.indexOf(track) + 1,
      phaseCount: TRACK_IDS.length,
    }))
}

/**
 * Bidirectional glyph where answers genuinely flow both ways: across the whole
 * toetsen track (DPIA ↔ AIIA and friends), and for the PPM ↔ PSA pair.
 */
export function connectorGlyph(group: { track: string; forms: FormIndexEntry[] }, idx: number): string {
  if (group.track === 'toetsen') return '↔'
  const pair = new Set([group.forms[idx - 1]?.id, group.forms[idx]?.id])
  if (pair.has('ppm') && pair.has('psa')) return '↔'
  return '→'
}

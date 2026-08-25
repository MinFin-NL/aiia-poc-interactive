/**
 * Kernvragen — the ten questions a dossier starts with.
 *
 * They do two jobs at once, which is the whole design:
 *
 *  1. Six of the twenty-two fields are choices, and those *derive the
 *     kenmerken* that decide which forms apply (see src/utils/toepasselijkheid.ts).
 *  2. All of them are ordinary form answers, so they feed the rest of the
 *     dossier — through the `copy` mappings in crossFormMappings.json and,
 *     via src/services/kernvragenSource.ts, as the AI's source material.
 *
 * Because of (2) the questions themselves live in public/forms/kernvragen.json
 * rather than in this file: they need the editor, the exports, the attachments
 * and the collab envelope that every other form gets for free. What stays in
 * code is the part a JSON typo must not be able to break silently — the map
 * from an answer option to the kenmerk it asserts. `kernvragen.test.ts` checks
 * both directions against the real JSON.
 *
 * Predecessor: the "toepassingsscan", six questions in a modal whose answers
 * lived in a blob on the intake form. Its questions are questions 2 to 5 here,
 * word for word; `migrateScanAnswers` carries old dossiers over.
 */
import type { Answers } from '../models/Assessment'
import type { BeslishulpRun } from './beslishulp'
import { isOutOfScope } from './beslishulp'
import { allUnknownKenmerken, type KenmerkId, type Kenmerken } from './toepasselijkheid'

/** The form that holds the kernvragen. */
export const KERNVRAGEN_FORM_ID = 'kernvragen'

/**
 * Which kenmerk each answer option asserts.
 *
 * Keyed by question id, then by the option text *exactly* as it appears in
 * public/forms/kernvragen.json. Long keys, but the alternative — a parallel
 * set of option ids — is a second thing to keep in sync, and the test pins
 * these against the JSON either way.
 *
 * An option that appears in the JSON but not here asserts nothing, which is
 * how "Backoffice-software" and "API of koppelvlak" conclude *no*
 * gebruikersinterface rather than leaving it unknown.
 */
interface KeuzeVraag {
  /** The kenmerken this question decides. Answering it without picking a
   *  setter concludes `false` for all of them. */
  bepaalt: KenmerkId[]
  /** Option text → the kenmerken it asserts. */
  sets: Record<string, KenmerkId[]>
  /** "Weet ik niet": leaves this question's kenmerken at `onbekend` instead of
   *  concluding false. */
  onbekend?: string[]
  /**
   * Multi-select only: this option contradicts every other one ("nee, geen van
   * deze"). Picked together with anything else — which the JSON checkbox
   * cannot prevent — it wins, because it is the more conservative reading of a
   * contradictory answer.
   */
  exclusief?: string[]
}

export const KEUZEVRAGEN: Record<string, KeuzeVraag> = {
  'kern.oplevering': {
    bepaalt: ['gebruikersinterface'],
    sets: {
      'Publieke website of webformulier': ['gebruikersinterface'],
      'Besloten webapplicatie achter een login': ['gebruikersinterface'],
      'Mobiele app': ['gebruikersinterface'],
      'Intranet of extranet': ['gebruikersinterface'],
    },
  },
  'kern.gedrag': {
    bepaalt: ['algoritme_of_ai'],
    sets: {
      'Rangschikt, scoort of prioriteert mensen of zaken': ['algoritme_of_ai'],
      'Genereert tekst, beeld, geluid of code': ['algoritme_of_ai'],
      'Leert van data of past zijn gedrag in de tijd aan': ['algoritme_of_ai'],
      'Herkent patronen, beelden, spraak of tekst': ['algoritme_of_ai'],
      'Bevat een ingekochte component die als "slim" of "AI" wordt aangeprezen': ['algoritme_of_ai'],
    },
    exclusief: ['Nee, geen van deze — het systeem volgt alleen vaste, door mensen opgeschreven regels'],
  },
  'kern.doelgroep': {
    bepaalt: ['raakt_burgers'],
    sets: {
      Burgers: ['raakt_burgers'],
      'Bedrijven of instellingen buiten de rijksoverheid': ['raakt_burgers'],
    },
    exclusief: ['Niemand buiten het projectteam — alleen interne techniek'],
  },
  'kern.besluit': {
    bepaalt: ['besluit_over_personen'],
    sets: {
      'Ja, het neemt zo’n besluit of bereidt het voor': ['besluit_over_personen'],
      'Ja, maar alleen als hulpmiddel bij een menselijk oordeel': ['besluit_over_personen'],
    },
    onbekend: ['Weet ik niet'],
  },
  'kern.persoonsgegevens': {
    bepaalt: ['persoonsgegevens'],
    sets: { Ja: ['persoonsgegevens'] },
    onbekend: ['Weet ik niet'],
  },
  'kern.eigen_dataset': {
    bepaalt: ['eigen_dataset'],
    sets: { Ja: ['eigen_dataset'] },
    onbekend: ['Weet ik niet'],
  },
}

/** The choice questions, in the order they appear in the form. */
export const KEUZEVRAAG_IDS = Object.keys(KEUZEVRAGEN)

// ---------------------------------------------------------------------------
// Derivation: answers → kenmerken
// ---------------------------------------------------------------------------

function chosen(answers: Answers, questionId: string): string[] {
  const value = answers[questionId]
  if (Array.isArray(value)) return value
  return typeof value === 'string' && value !== '' ? [value] : []
}

/**
 * Derive the dossier's kenmerken from the kernvragen answers plus the
 * beslishulp run.
 *
 * Two sources, per docs §5.3: the kernvragen self-declare most kenmerken, but
 * `ai_verordening_in_scope` comes from the beslishulp — the instrument that
 * actually decides it. Recomputed live rather than read from a snapshot so
 * that running the beslishulp afterwards updates the picture.
 */
export function deriveKenmerken(answers: Answers, beslishulp?: BeslishulpRun | null): Kenmerken {
  const kenmerken = allUnknownKenmerken()

  for (const [questionId, vraag] of Object.entries(KEUZEVRAGEN)) {
    // Unanswered stays `onbekend`: a question nobody got to is not a "nee".
    let picked = chosen(answers, questionId)
    if (picked.length === 0) continue
    if (vraag.onbekend?.some((label) => picked.includes(label))) continue

    // "Geen van deze" alongside real options is a contradiction; take the
    // conservative reading and let it stand alone.
    const exclusive = vraag.exclusief?.find((label) => picked.includes(label))
    if (exclusive) picked = [exclusive]

    for (const k of vraag.bepaalt) {
      kenmerken[k] = picked.some((label) => vraag.sets[label]?.includes(k) === true)
    }
  }

  // No AI at all ⇒ the verordening cannot apply; otherwise only a finished
  // beslishulp run may decide it.
  if (kenmerken.algoritme_of_ai === false) {
    kenmerken.ai_verordening_in_scope = false
  } else if (beslishulp?.conclusionId) {
    kenmerken.ai_verordening_in_scope = !isOutOfScope(new Set(beslishulp.labels), beslishulp.conclusionId)
  }

  return kenmerken
}

/** Have the kernvragen been answered at all? Below this, every verdict is
 *  `onbepaald` — the engine never guesses from an empty form. */
export function hasKernvragenAnswers(answers: Answers | undefined): boolean {
  if (!answers) return false
  return KEUZEVRAAG_IDS.some((id) => chosen(answers, id).length > 0)
}

// ---------------------------------------------------------------------------
// Legacy: the toepassingsscan
// ---------------------------------------------------------------------------

/**
 * A stored toepassingsscan run, as dossiers created before the kernvragen have
 * it — a blob at `FormState.toepassingsscan` on the intake form.
 *
 * Read-only from here on: `migrateScanAnswers` turns it into kernvragen
 * answers the first time such a dossier is opened. Kept in the model so the
 * CRDT codec keeps round-tripping old documents instead of dropping the field.
 */
export interface ToepassingsscanRun {
  scanVersion: string
  /** Question id → chosen option ids (one for a radio). */
  answers: Record<string, string[]>
  kenmerken: Kenmerken
  completedAt: number
  completedBy?: string
}

/** The form the toepassingsscan blob rode on. */
export const TOEPASSINGSSCAN_HOST_FORM_ID = 'intake'

/**
 * Old scan option id → the kernvraag answer that now means the same thing.
 *
 * The wording did not change, only where it lives: questions 2 to 5 of the
 * kernvragen are the six scan questions verbatim. So the migration is a
 * lookup, not a re-interpretation — nobody's saved verdict shifts.
 */
const SCAN_TO_KERNVRAAG: Record<string, { questionId: string; opties: Record<string, string> }> = {
  pg: {
    questionId: 'kern.persoonsgegevens',
    opties: {
      ja: 'Ja',
      nee: 'Nee, uitsluitend gegevens die niet naar personen herleidbaar zijn',
      onbekend: 'Weet ik niet',
    },
  },
  gedrag: {
    questionId: 'kern.gedrag',
    opties: {
      rangschikt: 'Rangschikt, scoort of prioriteert mensen of zaken',
      genereert: 'Genereert tekst, beeld, geluid of code',
      leert: 'Leert van data of past zijn gedrag in de tijd aan',
      herkent: 'Herkent patronen, beelden, spraak of tekst',
      ingekocht: 'Bevat een ingekochte component die als "slim" of "AI" wordt aangeprezen',
      geen: 'Nee, geen van deze — het systeem volgt alleen vaste, door mensen opgeschreven regels',
    },
  },
  besluit: {
    questionId: 'kern.besluit',
    opties: {
      neemt: 'Ja, het neemt zo’n besluit of bereidt het voor',
      hulpmiddel: 'Ja, maar alleen als hulpmiddel bij een menselijk oordeel',
      nee: 'Nee',
      onbekend: 'Weet ik niet',
    },
  },
  oplevering: {
    questionId: 'kern.oplevering',
    opties: {
      website: 'Publieke website of webformulier',
      webapp: 'Besloten webapplicatie achter een login',
      app: 'Mobiele app',
      intranet: 'Intranet of extranet',
      backoffice: 'Backoffice- of desktopsoftware zonder webinterface',
      api: 'API of koppelvlak',
      data: 'Dataproduct, dataset of model zonder eigen interface',
      infra: 'Infrastructuur of hardware',
    },
  },
  dataset: {
    questionId: 'kern.eigen_dataset',
    opties: {
      ja: 'Ja',
      nee: 'Nee, er wordt geen eigen dataset beheerd of geleverd',
      onbekend: 'Weet ik niet',
    },
  },
  doelgroep: {
    questionId: 'kern.doelgroep',
    opties: {
      burgers: 'Burgers',
      bedrijven: 'Bedrijven of instellingen buiten de rijksoverheid',
      medewerkers: 'Medewerkers van het ministerie of andere overheidsorganisaties',
      intern: 'Niemand buiten het projectteam — alleen interne techniek',
    },
  },
}

/** Multi-select in the kernvragen form ⇒ the answer must stay an array. */
const MULTI_SELECT = new Set(['kern.oplevering', 'kern.gedrag', 'kern.doelgroep'])

/**
 * Turn a stored toepassingsscan into kernvragen answers.
 *
 * Options that no longer exist are dropped, exactly as `deriveKenmerken`
 * always ignored answers to questions that were gone — an old run stays valid,
 * it just says less.
 */
export function migrateScanAnswers(run: ToepassingsscanRun | null | undefined): Answers {
  const answers: Answers = {}
  if (!run) return answers

  for (const [scanId, mapping] of Object.entries(SCAN_TO_KERNVRAAG)) {
    const labels = (run.answers[scanId] ?? [])
      .map((optionId) => mapping.opties[optionId])
      .filter((label): label is string => label !== undefined)
    if (labels.length === 0) continue
    answers[mapping.questionId] = MULTI_SELECT.has(mapping.questionId) ? labels : labels[0]
  }

  return answers
}

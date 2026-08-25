/**
 * Toepasselijkheid — which forms apply to this dossier, and why.
 *
 * See docs/toepasselijkheid-van-formulieren.md §5. Three moving parts:
 *
 *   kernvragen  →  kenmerken  →  per-form applicability
 *
 * This module owns the last two arrows: the vocabulary of *kenmerken* and the
 * rule engine that tests a form's condition against them. The first arrow —
 * turning answers into kenmerken — lives in src/utils/kernvragen.ts, because
 * that is where the questions are.
 *
 * The middle layer is the point. Forms never reference a question id: they
 * declare conditions over named kenmerken (`persoonsgegevens`,
 * `algoritme_of_ai`, …) in public/forms/index.json. That way question wording
 * can change without breaking nineteen forms, and a kenmerk can get a better
 * source later (a form outcome instead of a self-declaration) without touching
 * the forms at all.
 *
 * Everything here is pure and synchronous — state in, verdict out — so the
 * components stay thin renderers and toepasselijkheid.test.ts can prove the
 * matrix in docs §5.4 against the real index.json.
 *
 * Three-valued on purpose: a kenmerk is true, false, or `onbekend`, and
 * `onbekend` is NOT false. "We don't know yet" must surface as *mogelijk
 * relevant*, never as "niet van toepassing" — see the liability note in §5.7.
 */

// ---------------------------------------------------------------------------
// Kenmerken
// ---------------------------------------------------------------------------

/** The properties a dossier can have. The vocabulary shared by the kernvragen
 *  (which derive them) and index.json (which tests them). */
export type KenmerkId =
  | 'persoonsgegevens'
  | 'besluit_over_personen'
  | 'algoritme_of_ai'
  | 'ai_verordening_in_scope'
  | 'gebruikersinterface'
  | 'eigen_dataset'
  | 'raakt_burgers'

/** `'onbekend'` is a third value, not a synonym for false. */
export type KenmerkValue = boolean | 'onbekend'

export type Kenmerken = Record<KenmerkId, KenmerkValue>

/** How a kenmerk reads as a tag on the dossier page. */
export const KENMERK_LABEL: Record<KenmerkId, string> = {
  persoonsgegevens: 'persoonsgegevens',
  besluit_over_personen: 'besluit over personen',
  algoritme_of_ai: 'algoritme of AI',
  ai_verordening_in_scope: 'AI-verordening van toepassing',
  gebruikersinterface: 'gebruikersinterface',
  eigen_dataset: 'eigen dataset',
  raakt_burgers: 'externe werking',
}

export const KENMERK_IDS = Object.keys(KENMERK_LABEL) as KenmerkId[]

/** Where a kenmerk got its value — the distinction in docs §5.3: a kernvraag
 *  answer is a cheap self-declaration, a form outcome is derived evidence.
 *  Shown in the kernvragen summary so nobody mistakes the first for the second. */
export const KENMERK_SOURCE: Record<KenmerkId, 'kernvragen' | 'beslishulp'> = {
  persoonsgegevens: 'kernvragen',
  besluit_over_personen: 'kernvragen',
  algoritme_of_ai: 'kernvragen',
  ai_verordening_in_scope: 'beslishulp',
  gebruikersinterface: 'kernvragen',
  eigen_dataset: 'kernvragen',
  raakt_burgers: 'kernvragen',
}

export function allUnknownKenmerken(): Kenmerken {
  return Object.fromEntries(KENMERK_IDS.map((k) => [k, 'onbekend'])) as Kenmerken
}

/** Kenmerken that hold, for the tag row on the dossier page. Only `true` ones:
 *  a tag says what this dossier *has*. */
export function activeKenmerken(kenmerken: Kenmerken): KenmerkId[] {
  return KENMERK_IDS.filter((k) => kenmerken[k] === true)
}

/** Kenmerken the kernvragen could not settle — the honest counterpart of the
 *  tags, and the reason a form can be "mogelijk relevant" rather than n.v.t. */
export function unknownKenmerken(kenmerken: Kenmerken): KenmerkId[] {
  return KENMERK_IDS.filter((k) => kenmerken[k] === 'onbekend')
}

// ---------------------------------------------------------------------------
// Applicability: kenmerken → per-form verdict
// ---------------------------------------------------------------------------

/**
 * A form's applicability condition, as declared in public/forms/index.json.
 *
 * `allOf` is an AND of ORs: every group must hold, and within a group any one
 * kenmerk suffices. That is exactly the shape the matrix in docs §5.4 needs
 * ("algoritme_of_ai EN (besluit_over_personen OF raakt_burgers)") and nothing
 * more — no negation, no nesting, no expression parser.
 */
export interface ApplicabilityRule {
  allOf: KenmerkId[][]
  /** Why the form applies when the condition holds. Shown on the card. */
  reason: string
  /**
   * The condition makes the form *possibly* relevant rather than required —
   * the real decision comes from another instrument. The DPIA is the case that
   * forces this: persoonsgegevens alone does not make a DPIA mandatory, the
   * prescan does (docs §5.3).
   */
  advisory?: boolean
}

/**
 * - `altijd`      — no condition declared: the form always belongs in a dossier
 * - `verplicht`   — the condition holds
 * - `mogelijk`    — the condition holds but only advises, or a kenmerk is unknown
 * - `nvt`         — a required group is decidedly false
 * - `onbepaald`   — the kernvragen have not been answered yet
 */
export type ApplicabilityStatus = 'altijd' | 'verplicht' | 'mogelijk' | 'nvt' | 'onbepaald'

export interface ApplicabilityVerdict {
  status: ApplicabilityStatus
  /** One line for the card, the collapsed n.v.t. group and the export. */
  reason: string
  /** For `nvt`: the group that failed. For `mogelijk`: what is still unknown. */
  kenmerken: KenmerkId[]
}

function listLabels(ids: KenmerkId[]): string {
  const labels = ids.map((k) => KENMERK_LABEL[k])
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} of ${labels[labels.length - 1]}`
}

/**
 * Evaluate one form's rule against the dossier's kenmerken.
 *
 * `kenmerken` is null when the kernvragen have not been answered — everything
 * is `onbepaald` then, which the UI renders neutrally. Never guess: an
 * unanswered kernvraag is not the same as one answered "nee".
 */
export function evaluateApplicability(
  rule: ApplicabilityRule | undefined,
  kenmerken: Kenmerken | null,
): ApplicabilityVerdict {
  if (!rule) {
    return { status: 'altijd', reason: 'Dit formulier hoort bij elk dossier.', kenmerken: [] }
  }
  if (!kenmerken) {
    return { status: 'onbepaald', reason: 'De kernvragen zijn nog niet beantwoord.', kenmerken: [] }
  }

  // One decidedly-false group is enough: the AND can never hold.
  const failed = rule.allOf.find((group) => group.every((k) => kenmerken[k] === false))
  if (failed) {
    return {
      status: 'nvt',
      reason: `Dit dossier heeft geen ${listLabels(failed)}.`,
      kenmerken: failed,
    }
  }

  const unknown = rule.allOf
    .filter((group) => !group.some((k) => kenmerken[k] === true))
    .flatMap((group) => group.filter((k) => kenmerken[k] === 'onbekend'))

  if (unknown.length > 0) {
    return {
      status: 'mogelijk',
      reason: `Nog niet vast te stellen: ${listLabels([...new Set(unknown)])} is onbekend.`,
      kenmerken: [...new Set(unknown)],
    }
  }

  return {
    status: rule.advisory ? 'mogelijk' : 'verplicht',
    reason: rule.reason,
    kenmerken: rule.allOf.flat(),
  }
}

const STATUS_LABEL: Record<ApplicabilityStatus, string> = {
  altijd: '',
  verplicht: 'Van toepassing',
  mogelijk: 'Mogelijk relevant',
  nvt: 'Niet van toepassing',
  onbepaald: '',
}

export function applicabilityLabel(status: ApplicabilityStatus): string {
  return STATUS_LABEL[status]
}

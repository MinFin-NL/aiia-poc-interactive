/**
 * Toepassingsscan — which forms apply to this dossier, and why.
 *
 * See docs/toepasselijkheid-van-formulieren.md §5. Three moving parts:
 *
 *   scan answers  →  kenmerken  →  per-form applicability
 *
 * The middle layer is the point. Forms never reference a scan question id:
 * they declare conditions over named *kenmerken* (`persoonsgegevens`,
 * `algoritme_of_ai`, …) in public/forms/index.json. That way question wording
 * can change without breaking nineteen forms, and a kenmerk can get a better
 * source later (a form outcome instead of a self-declaration) without touching
 * the forms at all.
 *
 * Everything here is pure and synchronous — state in, verdict out — so the
 * components stay thin renderers and toepassingsscan.test.ts can prove the
 * matrix in docs §5.4 against the real index.json.
 *
 * Three-valued on purpose: a kenmerk is true, false, or `onbekend`, and
 * `onbekend` is NOT false. "We don't know yet" must surface as *mogelijk
 * relevant*, never as "niet van toepassing" — see the liability note in §5.7.
 */
import type { BeslishulpRun } from './beslishulp'
import { isOutOfScope } from './beslishulp'

// ---------------------------------------------------------------------------
// Kenmerken
// ---------------------------------------------------------------------------

/** The properties a dossier can have. The vocabulary shared by the scan (which
 *  derives them) and index.json (which tests them). */
export type KenmerkId =
  | 'persoonsgegevens'
  | 'bijzondere_persoonsgegevens'
  | 'grootschalig'
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
  bijzondere_persoonsgegevens: 'bijzondere persoonsgegevens',
  grootschalig: 'grootschalige verwerking',
  besluit_over_personen: 'besluit over personen',
  algoritme_of_ai: 'algoritme of AI',
  ai_verordening_in_scope: 'AI-verordening van toepassing',
  gebruikersinterface: 'gebruikersinterface',
  eigen_dataset: 'eigen dataset',
  raakt_burgers: 'externe werking',
}

export const KENMERK_IDS = Object.keys(KENMERK_LABEL) as KenmerkId[]

/** Where a kenmerk got its value — the distinction in docs §5.3: a scan answer
 *  is a cheap self-declaration, a form outcome is derived evidence. Shown in
 *  the scan summary so nobody mistakes the first for the second. */
export const KENMERK_SOURCE: Record<KenmerkId, 'scan' | 'beslishulp'> = {
  persoonsgegevens: 'scan',
  bijzondere_persoonsgegevens: 'scan',
  grootschalig: 'scan',
  besluit_over_personen: 'scan',
  algoritme_of_ai: 'scan',
  ai_verordening_in_scope: 'beslishulp',
  gebruikersinterface: 'scan',
  eigen_dataset: 'scan',
  raakt_burgers: 'scan',
}

function allUnknown(): Kenmerken {
  return Object.fromEntries(KENMERK_IDS.map((k) => [k, 'onbekend'])) as Kenmerken
}

// ---------------------------------------------------------------------------
// The scan itself
// ---------------------------------------------------------------------------

export interface ScanOption {
  id: string
  label: string
  hint?: string
  /** Kenmerken this option asserts as true. Options OR together. */
  sets?: KenmerkId[]
  /** "Weet ik niet": leaves this question's kenmerken at `onbekend` instead of
   *  concluding false. */
  onbekend?: boolean
  /**
   * Multi-select only: this option cannot be combined with any other ("nee,
   * geen van deze"). Not the same as having no `sets` — a project really can
   * deliver both an API and infrastructure, and both of those set nothing.
   */
  exclusief?: boolean
}

export interface ScanQuestion {
  id: string
  vraag: string
  toelichting?: string
  /** 'single' = radio, 'multi' = checkbox. Both persist as a list of option ids. */
  type: 'single' | 'multi'
  /** The kenmerken this question decides. Answering it without picking a
   *  setter concludes `false` for all of them. */
  bepaalt: KenmerkId[]
  /** Ask this question only when the named kenmerk is true so far. When it is
   *  false the question's kenmerken are false by implication; when it is
   *  `onbekend` they stay `onbekend`. */
  alleenAls?: KenmerkId
  opties: ScanOption[]
}

/** Bumped when the questions change meaning, so a stored run can say which
 *  wording it was answered against. */
export const SCAN_VERSION = '1'

/**
 * The questions.
 *
 * Deliberately behavioural rather than label-based (docs §5.5): nobody
 * recognises their Excel scoring rule or a vendor's "smart suggestions" as AI,
 * and the incentive here runs the wrong way — a "nee" saves you six forms. So
 * we ask what the system *does*, and let the engine draw the conclusion.
 *
 * In code rather than in public/ on purpose: every `sets` entry has to be a
 * real KenmerkId, and a typo in a JSON asset would silently disable a rule.
 * The per-form conditions in index.json stay data — those are validated
 * against KENMERK_IDS by toepassingsscan.test.ts.
 */
export const SCAN_QUESTIONS: ScanQuestion[] = [
  {
    id: 'pg',
    vraag: 'Komen er in dit project gegevens voor die — ook indirect — naar een persoon te herleiden zijn?',
    toelichting:
      'Denk breed: namen en e-mailadressen, maar ook personeelsnummers, dossiernummers, IP-adressen, logging en pseudoniemen. Gegevens over eigen medewerkers tellen net zo goed mee, en gegevens uit een basisregistratie ook.',
    type: 'single',
    bepaalt: ['persoonsgegevens'],
    opties: [
      { id: 'ja', label: 'Ja', sets: ['persoonsgegevens'] },
      { id: 'nee', label: 'Nee, uitsluitend gegevens die niet naar personen herleidbaar zijn' },
      { id: 'onbekend', label: 'Weet ik niet', onbekend: true },
    ],
  },
  {
    id: 'bijzonder',
    vraag: 'Gaat het (ook) om een van deze categorieën gegevens?',
    toelichting:
      'Deze categorieën maken een verwerking zwaarder: bijzondere persoonsgegevens (AVG art. 9), strafrechtelijke gegevens (art. 10) en het BSN (art. 46 UAVG).',
    type: 'multi',
    bepaalt: ['bijzondere_persoonsgegevens'],
    alleenAls: 'persoonsgegevens',
    opties: [
      { id: 'gezondheid', label: 'Gezondheid', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'herkomst', label: 'Ras of etnische afkomst', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'overtuiging', label: 'Politieke opvatting, religie of levensovertuiging', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'vakbond', label: 'Lidmaatschap van een vakbond', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'biometrie', label: 'Biometrische of genetische gegevens', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'seksueel', label: 'Seksueel gedrag of gerichtheid', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'strafrecht', label: 'Strafrechtelijke gegevens', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'bsn', label: 'Burgerservicenummer (BSN)', sets: ['bijzondere_persoonsgegevens'] },
      { id: 'geen', label: 'Nee, geen van deze', exclusief: true },
    ],
  },
  {
    id: 'schaal',
    vraag: 'Over hoeveel personen gaat het, ruw geschat?',
    toelichting:
      'Grootschaligheid gaat niet alleen over aantallen: ook de duur, het gebied en de mate waarin het (bijna) iedereen in een doelgroep raakt, tellen mee (EDPB-richtsnoeren).',
    type: 'single',
    bepaalt: ['grootschalig'],
    alleenAls: 'persoonsgegevens',
    opties: [
      { id: 'klein', label: 'Minder dan 100 personen' },
      { id: 'middel', label: '100 tot 10.000 personen' },
      { id: 'groot', label: 'Meer dan 10.000 personen', sets: ['grootschalig'] },
      {
        id: 'doelgroep',
        label: '(Bijna) iedereen binnen een doelgroep, ongeacht het aantal',
        hint: 'Bijvoorbeeld alle medewerkers van het ministerie of alle aanvragers van een regeling.',
        sets: ['grootschalig'],
      },
      { id: 'onbekend', label: 'Weet ik niet', onbekend: true },
    ],
  },
  {
    id: 'gedrag',
    vraag: 'Wat doet het systeem? Kruis alles aan wat van toepassing is.',
    toelichting:
      'Vraag jezelf niet af of iets "AI" heet. Een scoringsregel in een spreadsheet en de "slimme suggesties" van een leverancier vallen hier net zo goed onder als een taalmodel.',
    type: 'multi',
    bepaalt: ['algoritme_of_ai'],
    opties: [
      { id: 'rangschikt', label: 'Rangschikt, scoort of prioriteert mensen of zaken', sets: ['algoritme_of_ai'] },
      { id: 'genereert', label: 'Genereert tekst, beeld, geluid of code', sets: ['algoritme_of_ai'] },
      { id: 'leert', label: 'Leert van data of past zijn gedrag in de tijd aan', sets: ['algoritme_of_ai'] },
      { id: 'herkent', label: 'Herkent patronen, beelden, spraak of tekst', sets: ['algoritme_of_ai'] },
      {
        id: 'ingekocht',
        label: 'Bevat een ingekochte component die als "slim" of "AI" wordt aangeprezen',
        hint: 'Ook als de leverancier het bouwt en beheert: het ministerie biedt het aan.',
        sets: ['algoritme_of_ai'],
      },
      { id: 'geen', label: 'Nee, geen van deze — het systeem volgt alleen vaste, door mensen opgeschreven regels', exclusief: true },
    ],
  },
  {
    id: 'besluit',
    vraag: 'Ondersteunt of vervangt het systeem een besluit of beoordeling over een persoon?',
    toelichting:
      'Bijvoorbeeld toekennen of afwijzen van een aanvraag, selecteren voor controle, een risico-inschatting, roosteren, of het beoordelen van medewerkers.',
    type: 'single',
    bepaalt: ['besluit_over_personen'],
    opties: [
      { id: 'neemt', label: 'Ja, het neemt zo’n besluit of bereidt het voor', sets: ['besluit_over_personen'] },
      { id: 'hulpmiddel', label: 'Ja, maar alleen als hulpmiddel bij een menselijk oordeel', sets: ['besluit_over_personen'] },
      { id: 'nee', label: 'Nee' },
      { id: 'onbekend', label: 'Weet ik niet', onbekend: true },
    ],
  },
  {
    id: 'oplevering',
    vraag: 'Wat levert dit project op, of wat gaat het ministerie hiermee aanbieden?',
    toelichting:
      'Het gaat om wat er wordt aangeboden, niet om wie het bouwt: ook bij ingekochte software rust de verplichting op de organisatie die de voorziening publiceert of aanbiedt.',
    type: 'multi',
    bepaalt: ['gebruikersinterface'],
    opties: [
      { id: 'website', label: 'Publieke website of webformulier', sets: ['gebruikersinterface'] },
      { id: 'webapp', label: 'Besloten webapplicatie achter een login', sets: ['gebruikersinterface'] },
      { id: 'app', label: 'Mobiele app', sets: ['gebruikersinterface'] },
      { id: 'intranet', label: 'Intranet of extranet', sets: ['gebruikersinterface'] },
      { id: 'backoffice', label: 'Backoffice- of desktopsoftware zonder webinterface' },
      { id: 'api', label: 'API of koppelvlak' },
      { id: 'data', label: 'Dataproduct, dataset of model zonder eigen interface' },
      { id: 'infra', label: 'Infrastructuur of hardware' },
    ],
  },
  {
    id: 'dataset',
    vraag: 'Beheert dit project een eigen dataset, of levert het zelf gegevens aan anderen?',
    toelichting:
      'Standaardsoftware waarin alleen gegevens van een ander systeem worden getoond telt niet mee; een eigen bestand, koppelbestand, datawarehouse of trainingsset wel.',
    type: 'single',
    bepaalt: ['eigen_dataset'],
    opties: [
      { id: 'ja', label: 'Ja', sets: ['eigen_dataset'] },
      { id: 'nee', label: 'Nee, er wordt geen eigen dataset beheerd of geleverd' },
      { id: 'onbekend', label: 'Weet ik niet', onbekend: true },
    ],
  },
  {
    id: 'doelgroep',
    vraag: 'Wie merkt straks iets van de werking van dit systeem?',
    toelichting:
      'Werking buiten de eigen organisatie bepaalt onder meer of publicatie in het Algoritmeregister aan de orde is.',
    type: 'multi',
    bepaalt: ['raakt_burgers'],
    opties: [
      { id: 'burgers', label: 'Burgers', sets: ['raakt_burgers'] },
      { id: 'bedrijven', label: 'Bedrijven of instellingen buiten de rijksoverheid', sets: ['raakt_burgers'] },
      { id: 'medewerkers', label: 'Medewerkers van het ministerie of andere overheidsorganisaties' },
      { id: 'intern', label: 'Niemand buiten het projectteam — alleen interne techniek', exclusief: true },
    ],
  },
]

/**
 * The form whose state carries the toepassingsscan for a dossier.
 *
 * The scan describes the dossier, not a form — but the CRDT envelope is keyed
 * by form, and a genuine dossier-level field would mean touching the codec, the
 * server payload model and the stored dossier shape. So it rides on the intake,
 * the one form that is always applicable and always comes first, exactly as the
 * beslishulp rides on `euaiact` (see BESLISHULP_HOST_FORM_ID and docs
 * §5.2, "Opslagkeuze"). `toepassingsscanRun` in assessmentStore is the only
 * accessor — nothing else should reach for `forms.intake.toepassingsscan`.
 */
export const TOEPASSINGSSCAN_HOST_FORM_ID = 'intake'

/** Answers as persisted: question id → chosen option ids (one for 'single'). */
export type ScanAnswers = Record<string, string[]>

/** What we persist on the dossier once the scan has been run. */
export interface ToepassingsscanRun {
  /** SCAN_VERSION at the time of answering. */
  scanVersion: string
  answers: ScanAnswers
  /**
   * The kenmerken as they were when the scan was saved. Denormalised for the
   * record and the export, exactly like BeslishulpRun.labels: a later change to
   * the questions must never silently rewrite what somebody signed off on. The
   * live UI recomputes from `answers` instead — see deriveKenmerken.
   */
  kenmerken: Kenmerken
  completedAt: number
  completedBy?: string
}

// ---------------------------------------------------------------------------
// Derivation: answers → kenmerken
// ---------------------------------------------------------------------------

/** Whether a question is asked at all, given what we know so far. */
export function questionApplies(question: ScanQuestion, sofar: Kenmerken): KenmerkValue {
  if (!question.alleenAls) return true
  return sofar[question.alleenAls]
}

/**
 * Derive the dossier's kenmerken from the scan answers plus the beslishulp run.
 *
 * Two sources, per docs §5.3: the scan self-declares most kenmerken, but
 * `ai_verordening_in_scope` comes from the beslishulp — the instrument that
 * actually decides it. Recomputed live rather than read from the stored
 * snapshot so that running the beslishulp after the scan updates the picture.
 */
export function deriveKenmerken(answers: ScanAnswers, beslishulp?: BeslishulpRun | null): Kenmerken {
  const kenmerken = allUnknown()

  // Questions are evaluated in order: `alleenAls` may only depend on a kenmerk
  // an earlier question has already decided.
  for (const question of SCAN_QUESTIONS) {
    const gate = questionApplies(question, kenmerken)
    if (gate === false) {
      // The gate ruled it out ("geen persoonsgegevens" ⇒ ook geen bijzondere).
      for (const k of question.bepaalt) kenmerken[k] = false
      continue
    }
    if (gate === 'onbekend') continue

    const chosen = answers[question.id] ?? []
    if (chosen.length === 0) continue

    const opties = chosen
      .map((id) => question.opties.find((o) => o.id === id))
      .filter((o): o is ScanOption => o !== undefined)
    if (opties.some((o) => o.onbekend)) continue

    for (const k of question.bepaalt) {
      kenmerken[k] = opties.some((o) => o.sets?.includes(k)) === true
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

/** The questions actually put to the user, given the answers so far. Recomputed
 *  after every answer so a gated question appears or disappears immediately. */
export function visibleQuestions(answers: ScanAnswers): ScanQuestion[] {
  const kenmerken = deriveKenmerken(answers)
  return SCAN_QUESTIONS.filter((q) => questionApplies(q, kenmerken) !== false)
}

/** Kenmerken that hold, for the tag row on the dossier page. Only `true` ones:
 *  a tag says what this dossier *has*. */
export function activeKenmerken(kenmerken: Kenmerken): KenmerkId[] {
  return KENMERK_IDS.filter((k) => kenmerken[k] === true)
}

/** Kenmerken the scan could not settle — the honest counterpart of the tags,
 *  and the reason a form can be "mogelijk relevant" rather than n.v.t. */
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
 * - `onbepaald`   — no scan has been run yet
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
 * `kenmerken` is null when no scan has been run — everything is `onbepaald`
 * then, which the UI renders neutrally. Never guess: a missing scan is not the
 * same as a scan that answered "nee".
 */
export function evaluateApplicability(
  rule: ApplicabilityRule | undefined,
  kenmerken: Kenmerken | null,
): ApplicabilityVerdict {
  if (!rule) {
    return { status: 'altijd', reason: 'Dit formulier hoort bij elk dossier.', kenmerken: [] }
  }
  if (!kenmerken) {
    return { status: 'onbepaald', reason: 'Nog geen toepassingsscan gedaan.', kenmerken: [] }
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

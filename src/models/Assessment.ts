export type QuestionType = 'text' | 'radio' | 'checkbox' | 'table'
export type QuestionImportance = 'mandatory' | 'optional'
// Hint for AI extraction: tells the model (and client validation) what shape a
// short text field should have. Untagged text fields are treated as 'longtext'.
export type QuestionFormat = 'email' | 'phone' | 'date' | 'shorttext' | 'longtext'

// Points at another question's answer (optionally a specific table column of
// it) to derive live values from — used for dynamic option lists (`optionsFrom`)
// and conditional visibility (`visibleIf`).
export interface AnswerRef {
  questionId: string
  // When the referenced question is a 'table', which column id to read.
  column?: string
}

// Show a question only when another question's answer equals `equals`. Restores
// the upstream `conditional` dependency for standalone questions. (Conditions
// that live between columns of the same table are kept as column hints instead.)
export interface VisibleCondition {
  questionId: string
  equals: string
}

// Column definition for a 'table' question. `hint` feeds both the column
// header tooltip and the AI extraction prompt.
export interface TableColumn {
  id: string
  label: string
  hint?: string
  // Cell input kind. 'select' renders a dropdown; 'suggest' renders a free text
  // cell with a datalist of suggestions (used for multi-value columns); absent
  // or 'text' is a plain text cell.
  type?: 'text' | 'select' | 'suggest'
  // Static choices for a 'select'/'suggest' column.
  options?: string[]
  // Dynamic choices, read live from another answer (restores upstream
  // `source_options`). Merged with `options` when both are present.
  optionsFrom?: AnswerRef
}

export interface Question {
  id: string
  // Official source identifier when this question is generated from an external
  // standard (e.g. the Model DPIA Rijksdienst task id "2.1.4" that our local
  // `id` maps to). Purely informational/traceability — no runtime behaviour
  // depends on it. Set by scripts/convert-form.mjs during form generation.
  officialId?: string
  text: string
  guidance?: string
  type: QuestionType
  importance: QuestionImportance
  options?: string[]
  followUp?: string
  format?: QuestionFormat
  // Opt-in: show the image-attachment control under this question. Reserved
  // for questions where a picture genuinely helps (architectuur, datamodel,
  // processchema) so the other questions stay uncluttered.
  allowAttachments?: boolean
  // Radio/checkbox questions: derive the option list live from another answer
  // instead of (or in addition to) the static `options` (upstream source_options).
  optionsFrom?: AnswerRef
  // Show this question only when the referenced answer matches (upstream
  // conditional). When absent the question is always visible.
  visibleIf?: VisibleCondition
  // Table questions only: fixed column schema plus grid bounds and the label
  // of the free-text notes field rendered under the grid.
  columns?: TableColumn[]
  notesLabel?: string
  minRows?: number
  maxRows?: number
}

export interface Subsection {
  id: string
  title: string
  description?: string
  questions: Question[]
}

export interface Section {
  id: string
  title: string
  part: 'A' | 'B' | 'C' | 'D' | 'summary'
  // Small eyebrow label shown above the section title. Defaults to "Deel {part}"
  // (or "Samenvatting" for the summary part) when omitted.
  kicker?: string
  subsections: Subsection[]
}

export interface Answers {
  [questionId: string]: string | string[]
}

// A RAG chunk that was given to the model when it produced an answer.
// `text` is self-contained so the citation survives document deletion.
export interface AnswerSource {
  docId: string
  docName: string
  chunkIndex: number
  text: string
  score: number
}

export interface AnswerSourceMeta {
  sources: AnswerSource[]
  // false ⇒ the answer could not be matched to any source passage and the
  // field shows a hallucination warning until the user reviews/edits it.
  grounded: boolean
  createdAt: number
}

// An image attached to a question. Only this metadata is persisted client-side
// (localStorage); the bytes live on the backend under the `id`.
export interface QuestionAttachment {
  id: string // server image_id
  filename: string
  caption: string
  mimeType: string
  // Natural pixel dimensions, measured client-side at upload; used to size
  // the image in Word exports.
  width?: number
  height?: number
  uploadedAt: number
  // v2: set when the image was extracted from an uploaded source document.
  sourceDocId?: string
}

export type RiskLevelValue = 'onaanvaardbaar' | 'hoog' | 'beperkt' | 'minimaal' | null

export interface RiskLevel {
  level: RiskLevelValue
  label?: string
}

// A form-local yes/no risk questionnaire used to live here (`riskQuestions`).
// The risk classification now runs on the vendored MinBZK Beslishulp
// AI-verordening instead — see src/utils/beslishulp.ts and RiskClassification.vue.
// `riskLevelInfo` below stays: it is how a form words the four levels.

// ── Form config types (JSON-driven form registry) ────────────────────────────

export interface NavStepSubsections {
  type: 'subsections'
  sectionId: string
  exclude?: string[]
  condition?: { storeKey: 'goDecision'; value: boolean }
}

export interface NavStepSpecialView {
  type: 'specialView'
  viewId: string
  label?: string
  navLabel?: string
  navGroupHeader?: string
  completionSectionId?: string
  conditionalNext?: {
    storeKey: 'goDecision'
    ifTrue: string
    ifFalse: string
  }
}

export type NavStep = NavStepSubsections | NavStepSpecialView

export interface FormHomeContent {
  notice: string
  description: string
  steps: string[]
  buttonLabel: string
}

export interface FormMeta {
  homeComponent: string
  exportLabel: string
  docTitle: string
  footerLabel: string
  filename: string
  systemNamePlaceholder?: string
  homeContent?: FormHomeContent
}

export interface FormFeatures {
  riskClassification: boolean
  decisionGate: boolean
  conditionalPartB: boolean
}

export interface RiskLevelInfoEntry {
  label: string
  description: string
  color: string
}

// Provenance of a form: which external instrument it comes from, and how
// faithfully. Purely informational — nothing at runtime depends on it — but it
// keeps every form traceable back to its original, mirroring the lineage table
// in the README. `derivation`:
//   'generated'  — machine-converted from a vendored upstream definition
//   'harmonized' — hand-built, but field-for-field aligned with the upstream
//   'derived'    — modelled on a framework that ships no fill-in template
//   'original'   — written for this tool, no external original
export interface FormSource {
  instrument: string
  publisher: string
  version?: string
  url?: string
  // Where inside the source: chapter, template number, article, page range.
  reference?: string
  derivation: 'generated' | 'harmonized' | 'derived' | 'original'
  note?: string
}

export interface FormConfig {
  id: string
  version: string
  title: string
  // Where this form comes from — see FormSource and the README lineage table.
  source?: FormSource
  // One or two sentences describing the form's purpose, audience and tone,
  // prepended to the AI extraction prompt so answers are framed correctly.
  aiContext?: string
  meta: FormMeta
  features: FormFeatures
  navigation: NavStep[]
  sections: Section[]
  riskLevelInfo?: Record<string, RiskLevelInfoEntry>
}

export interface CrossFormMapping {
  targetFormId: string
  targetQuestionId: string
  sourceFormId: string
  sourceQuestionIds: string[]
  synthesisHint: string
}

export type AssessmentData = Pick<FormConfig, 'version' | 'title' | 'sections'>

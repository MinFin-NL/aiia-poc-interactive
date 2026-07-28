# Schema harmonization with MinBZK/par-dpia-form

_Last updated: 2026-07-28_

## Why

We want our DPIA question content to track the **official government source** instead of being
hand-maintained. That source is [MinBZK/par-dpia-form](https://github.com/MinBZK/par-dpia-form),
which encodes the **Model DPIA Rijksdienst** as YAML. Our app already described its DPIA as
"conform het Model DPIA Rijksdienst", so the content is meant to be the same thing — this change
makes that link explicit and reproducible.

The two projects are architecturally close (Vue 3, Pinia, RVO Design System, Keycloak, pdfmake)
but their **form schemas differ fundamentally**:

| | Our app (findocs) | par-dpia-form |
|---|---|---|
| Format | JSON in `public/forms/` | YAML in `sources/` |
| Model | fixed 3 levels: `section → subsection → question` | recursive `tasks` tree (`task_group`, `repeatable`) |
| Types | `text` / `radio` / `checkbox` / `table` | `open_text`, `text_input`, `select_option`, `checkbox_option`, `radio_option`, `task_group`, `date`, `image`, … |
| Conditionals | `followUp` + bespoke `goDecision` nav gate | `dependencies` engine (`conditional` / `source_options` / `instance_mapping`) |
| Validation | none (cast on load) | JSON Schema |
| Answer keys | question `id` (`d1.1`) | official task `id` (`2.1.4`) |

**Chosen approach:** a build-time **converter** turns the vendored upstream YAML into our runtime
JSON. We did **not** adopt their engine or rewrite our renderers. Content tracks upstream; our
UI, stores, exports and backend stay unchanged.

## Key finding — upstream is a newer, richer model (v3.0)

Our previous hand-written `public/forms/dpia.json` is a simplified DPIA (Deel A–D, ~46 questions,
ids `d1.1`…`d17.5`). The pinned upstream `dpia.yaml` is the **Model DPIA Rijksdienst v3.0**:
20 numbered paragraphs, ~91 leaf questions, and heavy use of **repeatable, relational**
task-groups (e.g. "for each gegevensverwerking, repeat these fields"). It is not a rename of our
old form — it is a genuinely different, larger question set.

Consequence: the plan's original idea of "keep our `d*` ids 1:1 with a translation map" is **not
achievable**, because most upstream questions have no counterpart in our old form. So:

- The generated form uses ids derived from the upstream numbering: `d` + official id →
  `d2.1.4`. Every question also carries `officialId` (the raw upstream id) for cross-tool
  traceability.

## Promotion (done — pre-launch replace)

There was no production DPIA data, so v3.0 **replaced** the old form in place:

- The converter writes directly to `public/forms/dpia.json` (form id stays `dpia`), so the app
  serves v3.0 immediately. The old hand-written content is gone (recoverable from git history);
  the previous `dpia.v3.json` staging file was removed.
- `public/forms/index.json` was left unchanged — its `dpia` entry already points at `dpia.json`.
- `crossFormMappings.json` was **remapped** onto v3 ids (see below), so the AI cross-form fill
  keeps working. No code hardcodes DPIA question ids, so nothing else needed changing.

> **Local dev note:** two dossiers under `backend/data/dossiers/*.json` still hold answers keyed
> by *old* DPIA ids (e.g. `d3.1`). Under v3.0 those may render as stale/empty. This is local dev
> state only — clear those dossiers' `dpia` answers if the leftovers are distracting. No
> production data was affected.

### Cross-form mapping remap

`crossFormMappings.json` referenced old DPIA ids both as synthesis **targets** (from aiia/ppm/psa/
quickscan/prescandpia → dpia) and as **sources** (dpia → aiia). All were remapped (22 target refs,
19 source refs) onto valid v3 ids. Because v3's structured data now lives in **tables** — which are
not sensible free-text synthesis targets — narrative mappings were redirected onto v3's matching
`text` fields (mostly the per-paragraph "Aanvullende informatie …" fields). Several old ids
therefore collapse onto one v3 field (e.g. old `d17.1` technical + `d17.2` organisational measures
→ v3 `d17.2`). The full table lives in the git diff of `crossFormMappings.json`; **these mappings
are judgment calls and should be reviewed** by someone who knows the DPIA intent.

## What changed in this repo

### New files
| Path | What it is |
|---|---|
| `vendor/par-dpia-form/dpia.yaml` | Pinned snapshot of upstream `sources/dpia.yaml` (commit `3d76a6d`, 2026-07-23). |
| `vendor/par-dpia-form/PROVENANCE.md` | Source URL, pinned commit, refresh + licensing notes. |
| `scripts/convert-form.mjs` | The converter (Node ESM). |
| `scripts/form-overlays/dpia.overlay.json` | Hand-authored: our presentation (`meta`/`homeContent`/`aiContext`/`features`) + the mapping of upstream paragraphs into Deel A/B/C/D. |
| `scripts/schemas/findocs-form.schema.json` | JSON Schema for **our** `FormConfig`; the converter validates output against it and fails the build on mismatch. |
| `scripts/form-overlays/dpia.dropped-dependencies.json` | Generated report of every lossy conversion (see below). |
| `docs/SCHEMA_HARMONIZATION.md` | This document. |

### Modified files
| Path | Change |
|---|---|
| `src/models/Assessment.ts` | Added optional `officialId?: string` to `Question` (purely additive; no runtime behaviour depends on it). |
| `package.json` | Added `forms:build` script; added dev-deps `yaml`, `ajv`. |
| `public/forms/dpia.json` | **Regenerated as Model DPIA Rijksdienst v3.0** (was the hand-written v2 form). Now produced by `npm run forms:build`. |
| `public/forms/crossFormMappings.json` | DPIA target + source refs remapped onto v3 ids. |

### Unchanged (proves the low blast radius)
`formLoader.ts`, `QuestionItem.vue`, `TableQuestion.vue`, all exports, `assessmentStore.ts`,
`public/forms/index.json`, the whole Python backend. No runtime code changed except the additive
`officialId` field. All 31 unit tests still pass.

## How the converter maps the schema

Run: `npm run forms:build` (→ `node scripts/convert-form.mjs dpia`).

**Structure**
- Upstream paragraph (top-level `task_group`) → **Subsection**; the overlay assigns each paragraph
  to a Deel A/B/C/D/summary **Section**.
- Non-repeatable `task_group` inside a paragraph → **flattened** (its leaf children become
  questions).
- Repeatable `task_group` of leaf fields → **`table`** question, one column per child field.
- Relational wrappers (`instance_mapping`, e.g. "repeat per gegevensverwerking") are **collapsed**:
  the converter descends to the inner row template and emits a single table.

**Types**
| Upstream | Ours |
|---|---|
| `open_text`, `informational` | `text` |
| `text_input` | `text` + `format: shorttext` |
| `date` | `text` + `format: date` |
| `image` | `text` + `allowAttachments: true` |
| `select_option`, `radio_option` | `radio` (options preserved verbatim) |
| `checkbox_option`, `multiselect_scrollable` | `checkbox` (options preserved verbatim) |

**Options** are copied byte-for-byte (`label ?? value`) — never reworded, because the backend LLM
grounding enforces exact-match against option strings.

**Restored reactive behaviour** (added after the first pass — see "Fidelity restoration" below):
- `conditional` → question-level **`visibleIf`** (19 restored).
- `source_options` → **`optionsFrom`** dynamic dropdowns (18 restored), plus static select/checkbox
  options rendered as real dropdowns (incl. table columns).

**Still lossy (recorded, not silent)** — 12 in the current run, in
`scripts/form-overlays/dpia.dropped-dependencies.json`:
- `conditional_column` (6): a show-if condition *between columns of the same table row* — per-cell
  visibility we don't render; kept as a column hint.
- `instance_mapping` (6): per-instance relational repetition, collapsed into a single flat table.

**Result of the current run:** 5 sections, 21 subsections, 91 questions, 19 `visibleIf`,
18 `optionsFrom`, 29 select/suggest columns, 0 warnings, all ids unique, passes schema validation.

## Fidelity restoration (`visibleIf` + `optionsFrom`)

To recover the upstream form's reactivity within our (deliberately non-relational) model:

- **`Question.visibleIf`** `{ questionId, equals }` — a question renders only when another answer
  matches. The converter emits it for standalone conditionals (all of §15's rechten follow-ups,
  the §12 special-category tables gated by a radio). Evaluated in `src/utils/answerRefs.ts` and
  applied in `SectionView.vue` (hidden questions don't render).
- **`optionsFrom`** `{ questionId, column? }` on a question or a table column — options are read
  live from another answer (e.g. §3's "Persoonsgegevens" column suggests the values you typed in
  §2's table). `TableColumn.type` `select`/`suggest` renders a dropdown / datalist cell.
- **AI Modus respects visibility.** `bulkExtractFromDocument` takes a `shouldAnswer` predicate,
  re-checked live per question, so it never spends an LLM call on a hidden field and picks up any
  that become visible once their controller is filled (the flattened order puts controllers first).
  See `useAiMode.ts`.

Files touched for this: `src/models/Assessment.ts` (types), `src/utils/answerRefs.ts` (+ test),
`src/components/SectionView.vue`, `QuestionItem.vue`, `TableQuestion.vue`,
`src/composables/useAiMode.ts`, `src/services/llmService.ts`, and the converter/schema.

**Two behaviours we intentionally did not build** (they'd need a relational answer store — the
widest-blast-radius change in the app): per-cell conditional columns (6) and `instance_mapping`
(6). These remain flattened with notes.

## How to refresh from upstream

1. Bump the pinned file + SHA per `vendor/par-dpia-form/PROVENANCE.md`.
2. `npm run forms:build`.
3. Review `git diff public/forms/dpia.json` and the dropped-dependencies report.

## Next steps

1. **Review the generated form** (`public/forms/dpia.json`) with a privacy/DPIA expert —
   especially the collapsed relational tables (§2, 3, 5–13, 17) and the 58 dropped dependencies.
   Decide per case whether the flattened representation is acceptable or needs a manual overlay tweak.
2. **Review the remapped cross-form mappings** (`crossFormMappings.json` git diff) — the old→v3
   redirections and collapses are judgment calls; confirm each still makes sense for the DPIA.
3. **Clear stale local dev dossiers** (optional): the two `backend/data/dossiers/*.json` with old
   `dpia` answer keys can be reset so they don't show orphaned answers under v3.0.
4. **Consider a UI affordance for the collapsed conditionals.** If the "Alleen relevant indien…"
   guidance proves clunky, the cheapest real fix is extending our model with a lightweight
   per-question `visibleIf` — a separate, larger change deliberately out of scope here.
5. **Optionally validate the live form loader** against `scripts/schemas/findocs-form.schema.json`
   (add ajv to `loadForm` in dev) so hand-edited forms get the same safety net as generated ones.
6. **Extend to other assessments only where the frameworks actually match.** Upstream `iama.yaml`
   and `prescan.yaml` are *different* frameworks from our `aiia.json` / `prescandpia.json`
   (IAMA = human-rights/algorithms; our AIIA = EU AI Act risk classification; upstream prescan uses
   an `assessments` rules-engine vs our `goDecision` gate). Harmonize those only after a content
   review confirms they're the same instrument.

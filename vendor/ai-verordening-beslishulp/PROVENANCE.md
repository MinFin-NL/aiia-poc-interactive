# Vendored snapshot — MinBZK/ai-verordening-beslishulp

These files are a **pinned copy** of the *Beslishulp AI-verordening* decision tree from the
official government repository, vendored so our build is reproducible and does not fetch from
the network. They are the upstream source of truth for the beslishulp content; do not hand-edit
them here. To update, re-copy from the upstream repo at a new commit and bump the SHA below.

| File (local) | Upstream path | Pinned commit | Commit date |
|------|---------------|---------------|-------------|
| `decision-tree.yaml` | `decision-tree.yaml` | `ab943a0da02441fe532a65acb6eba431a9188c4d` | 2026-07-27 |
| `definitions.yaml` | `definitions.yaml` | `ab943a0da02441fe532a65acb6eba431a9188c4d` | 2026-07-27 |
| `categories.yaml` | `categories.yaml` | `ab943a0da02441fe532a65acb6eba431a9188c4d` | 2026-07-27 |
| `schema_decision_tree.json` | `schemas/schema_decision_tree.json` | `ab943a0da02441fe532a65acb6eba431a9188c4d` | 2026-07-27 |

- Upstream repository: https://github.com/MinBZK/ai-verordening-beslishulp
- Published by: AI Validatieteam, Ministerie van Binnenlandse Zaken en Koninkrijksrelaties (MinBZK)
- Part of the Algoritmekader: https://minbzk.github.io/Algoritmekader/
- Legal content questions: ai-verordening@minbzk.nl (the AI Validatieteam built the tool but is
  explicitly **not** responsible for the legal content).

## What the converter does with these

`scripts/convert-beslishulp.mjs` merges the three YAML files into one runtime asset,
`public/beslishulp/ai-verordening.json`. The only real transformation is that each answer's
`redirects[].if` guard — a small boolean expression over the accumulated labels, e.g.
`'"aanbieder" in labels && "hoog-risico AI" in labels'` — is **parsed at build time into an
AST**. That keeps expression parsing (and anything resembling `eval`) out of the shipped app:
at runtime `src/utils/beslishulp.ts` only walks the AST. A guard the converter cannot parse is
a build error, not a runtime surprise.

## How to refresh

```bash
SHA=<new-sha>
for f in decision-tree.yaml definitions.yaml categories.yaml; do
  curl -sL -o vendor/ai-verordening-beslishulp/$f \
    "https://raw.githubusercontent.com/MinBZK/ai-verordening-beslishulp/$SHA/$f"
done
curl -sL -o vendor/ai-verordening-beslishulp/schema_decision_tree.json \
  "https://raw.githubusercontent.com/MinBZK/ai-verordening-beslishulp/$SHA/schemas/schema_decision_tree.json"
# then update the table above and run: npm run beslishulp:build
```

After refreshing, re-check `RISK_LEVEL_BY_LABEL` in `src/utils/beslishulp.ts`: it maps upstream
labels (`verboden AI`, `hoog-risico AI`, `transparantieverplichting`, …) onto our four
`riskLevel` values. New or renamed upstream labels are the one thing a refresh can silently
break — `src/utils/beslishulp.test.ts` asserts every label used by the tree is accounted for.

## Licensing

ai-verordening-beslishulp is published under the **EUPL-1.2**. The vendored YAML and the
generated `public/beslishulp/ai-verordening.json` are redistributed under those terms;
the upstream licence text is kept alongside this file in `LICENSE-EUPL-1.2.txt`. The
beslishulp modal in the app credits MinBZK and links back to the upstream repository.

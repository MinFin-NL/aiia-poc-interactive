# Vendored snapshot — MinBZK/par-dpia-form

These files are a **pinned copy** of assessment source definitions from the official
government repository, vendored so our build is reproducible and does not fetch from
the network. They are the upstream source of truth for question content; do not hand-edit
them here. To update, re-copy from the upstream repo at a new commit and bump the SHA below.

| File (local) | Upstream path | Pinned commit | Commit date |
|------|---------------|---------------|-------------|
| `dpia.yaml` | `sources/dpia.yaml` | `3d76a6d5da166b0dc089ca80740ac7be64fb7ab8` | 2026-07-23 |
| `prescandpia.yaml` | `sources/prescan.yaml` | `3d76a6d5da166b0dc089ca80740ac7be64fb7ab8` | 2026-07-23 |
| `iama.yaml` | `sources/iama.yaml` | `3d76a6d5da166b0dc089ca80740ac7be64fb7ab8` | 2026-07-23 |

> **Local filename ≠ upstream filename.** Each vendored file is named after **our**
> form id (`prescandpia`, `iama`) so the converter's single `name` argument selects
> the YAML, the overlay, and the output `public/forms/<name>.json` together. The
> "Upstream path" column is the real source. Content standards: `urn:nl:prescan`
> (Pre-scan DPIA v2.0) and `urn:nl:iama` (IAMA v2) respectively. Note `iama` is a
> **new, separate** form; the hand-written MinFin AIIA (`aiia`) is unrelated to this
> vendored source and is not generated.

- Upstream repository: https://github.com/MinBZK/par-dpia-form
- Upstream schema this YAML validates against: `schemas/assessment-definition.v2.schema.json`
- Content standard: **Model DPIA Rijksdienst v3.0** (`urn:nl:dpia`).

## How to refresh

```bash
# <upstream> = dpia | prescan | iama    <local> = dpia | prescandpia | iama
gh api "repos/MinBZK/par-dpia-form/contents/sources/<upstream>.yaml?ref=<new-sha>" \
  --jq '.content' | base64 -d > vendor/par-dpia-form/<local>.yaml
# then update the table above and run: npm run forms:build
```

## Licensing

par-dpia-form is published by the Ministerie van Binnenlandse Zaken en Koninkrijksrelaties
(MinBZK). Check the upstream `LICENSE`/`docs` for the exact terms before redistributing;
record any attribution requirements alongside this file.

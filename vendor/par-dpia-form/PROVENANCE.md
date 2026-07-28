# Vendored snapshot — MinBZK/par-dpia-form

These files are a **pinned copy** of assessment source definitions from the official
government repository, vendored so our build is reproducible and does not fetch from
the network. They are the upstream source of truth for question content; do not hand-edit
them here. To update, re-copy from the upstream repo at a new commit and bump the SHA below.

| File | Upstream path | Pinned commit | Commit date |
|------|---------------|---------------|-------------|
| `dpia.yaml` | `sources/dpia.yaml` | `3d76a6d5da166b0dc089ca80740ac7be64fb7ab8` | 2026-07-23 |

- Upstream repository: https://github.com/MinBZK/par-dpia-form
- Upstream schema this YAML validates against: `schemas/assessment-definition.v2.schema.json`
- Content standard: **Model DPIA Rijksdienst v3.0** (`urn:nl:dpia`).

## How to refresh

```bash
gh api "repos/MinBZK/par-dpia-form/contents/sources/dpia.yaml?ref=<new-sha>" \
  --jq '.content' | base64 -d > vendor/par-dpia-form/dpia.yaml
# then update the table above and run: npm run forms:build
```

## Licensing

par-dpia-form is published by the Ministerie van Binnenlandse Zaken en Koninkrijksrelaties
(MinBZK). Check the upstream `LICENSE`/`docs` for the exact terms before redistributing;
record any attribution requirements alongside this file.

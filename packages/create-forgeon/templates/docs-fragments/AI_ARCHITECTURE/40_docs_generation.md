## Docs Generation Pipeline

Project docs are assembled from markdown fragments in:

- `packages/create-forgeon/templates/docs-fragments/README`
- `packages/create-forgeon/templates/docs-fragments/AI_PROJECT`
- `packages/create-forgeon/templates/docs-fragments/AI_ARCHITECTURE`

During scaffold generation, the CLI selects fragments based on chosen flags and writes final docs into project root and `docs/AI`.

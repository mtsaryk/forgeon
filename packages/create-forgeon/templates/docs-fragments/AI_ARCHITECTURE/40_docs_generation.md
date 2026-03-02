## Docs Generation Pipeline

Project docs are assembled from markdown fragments in:

- `packages/create-forgeon/templates/docs-fragments/README`
- `packages/create-forgeon/templates/docs-fragments/AI_PROJECT`
- `packages/create-forgeon/templates/docs-fragments/AI_ARCHITECTURE`

During scaffold generation, the CLI currently writes the generated project `README.md` from these fragments.

Internal architecture fragments remain in the Forgeon repository as generator source material and are not emitted into generated projects by default.

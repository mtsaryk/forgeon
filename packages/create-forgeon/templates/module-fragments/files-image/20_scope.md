## Scope

Current stage:
- requires `files-runtime` capability (`files` module)
- supports image sanitization for:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- integrates into files upload flow before storage write
- adds probe endpoint:
  - `GET /api/health/files-image`

Default policy:
- `FILES_IMAGE_STRIP_METADATA=true`
- metadata is removed unless explicitly disabled by config

Future work:
- richer resize/thumbnail presets
- optional async processing mode
- extended format support based on project needs

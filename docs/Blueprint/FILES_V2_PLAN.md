# FILES V2 PLAN

This document defines the next stage after the current files runtime baseline (`files`, `files-local`, `files-s3`, `files-access`, `files-quotas`, `files-image`).

Primary focus of v2: introduce **variants** without breaking v1 contracts.

## Current Implementation Snapshot

v2.1 baseline is now wired in scaffold/templates:

- `FileVariant` model + migration are added by `files` module
- download route supports `?variant=original|preview`
- `original` variant is always persisted
- `preview` generation is optional and currently provided by `files-image`
- diagnostics probe is available at `GET /api/health/files-variants`
- dedup v1 is enabled via `FileBlob` (`sha256 + size + mime + driver`) for `original` and `preview`
- create-flow hardening is in place for blob unique-race (`P2002`) to avoid orphan storage writes
- cleanup-flow hardening uses DB-first orphan checks (`deleteMany where variants none`) before storage delete
- `files-s3` preset ergonomics: region/endpoint/path-style can be left empty in env to follow provider preset defaults

## Goals

- keep `FileRecord` as the stable canonical file entity
- add variant support in a backward-compatible way
- keep storage-provider-agnostic behavior (`files-storage-adapter` capability)
- avoid coupling variant generation to a specific provider (`local` vs `s3`)
- prepare for future async processing (`queue`) without making it mandatory in v2

## Non-Goals (v2)

- no CDN edge transform orchestration
- no full media pipeline engine
- no video/audio transcoding pipeline
- no hard requirement on background workers for the first v2 step

## Variant Model

Recommended v2 shape:

1. Keep `FileRecord` as-is (public identity + ownership + visibility metadata).
2. Add `FileVariant` as a child entity of `FileRecord`.

`FileVariant` draft fields:

- `id`
- `fileId` (FK to `FileRecord`)
- `variantKey` (e.g. `original`, `preview`, `thumb_sm`)
- `storageDriver`
- `storageKey`
- `mimeType`
- `size`
- `width?`
- `height?`
- `status` (`ready | pending | failed`)
- `createdAt`
- `updatedAt`

Constraints:

- unique `(fileId, variantKey)`
- index on `(variantKey, status)`

## API Strategy

Backward-compatible serving route:

- existing route: `GET /api/files/:publicId/download`
- v2 extension: `GET /api/files/:publicId/download?variant=<variantKey>`

Behavior:

- no `variant` param -> serve `original`
- unknown variant -> return canonical `NOT_FOUND` envelope
- not-yet-ready async variant -> return a stable error code (`FILES_VARIANT_NOT_READY`)

## Generation Strategy

Phase v2.1 (sync-first, minimal risk):

- if `files-image` is installed and enabled:
  - sanitize/re-encode original as currently implemented
  - optionally generate one additional deterministic variant (`preview`) inline
- if `files-image` is not installed:
  - only `original` variant is persisted

Phase v2.2 (async optional):

- if `queue` capability is present:
  - create variant job
  - mark variant `pending`
  - worker updates to `ready` or `failed`

## Module Boundaries

- `files`:
  - owns `FileRecord` + `FileVariant` persistence model
  - owns download routing and variant selection
- `files-image`:
  - owns image-safe transform pipeline
  - owns transform presets and quality defaults
- `files-access`:
  - access checks happen before serving any variant
- `files-quotas`:
  - should account for storage usage in a deterministic way (original-only in v2.1, extended in v2.2)

## Storage Adapters and Variants

`files-local` and `files-s3` both must support variant keys without branching API semantics.

Key rule:

- client never sees raw `storageKey`
- variant resolution stays backend-side

## Security Rules

- keep magic-bytes verification + decode/re-encode for image variants
- strip metadata by default for generated image variants
- reject declared MIME/ext mismatch before variant generation
- log suspicious uploads with `requestId`/`ip` when available

## Migration Notes

From v1 to v2:

- add `FileVariant` migration
- backfill `original` variant rows from existing `FileRecord` rows
- keep legacy files readable during backfill window

## Acceptance Criteria

v2 planning is complete when:

- schema draft is locked
- variant API contract is locked
- sync-first implementation plan is approved
- async extension points are documented but optional

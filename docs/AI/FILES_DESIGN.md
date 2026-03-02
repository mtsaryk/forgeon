# FILES DESIGN PLAN

This document captures the planned design for the `files` family of modules.

The goal is to define `files v1` in a way that is useful immediately and does not block later expansion into:

- `files-access`
- `files-quotas`
- `files-s3`
- `files-image`

This is a design document, not an implementation spec for one release only.

## Design Goals

`files v1` must:

1. provide a usable upload flow immediately
2. avoid hard-coding future storage, access, or quota assumptions
3. keep the storage layer separate from authorization and usage policies
4. establish stable metadata and service boundaries

## Module Family

The intended long-term split is:

1. `files`
- base upload/download/delete primitives
- file metadata
- storage abstraction
- local disk storage preset

2. `files-access`
- resource-level authorization for file operations
- ownership / visibility / group / tenant rules
- integration with `jwt-auth` + `rbac`

3. `files-quotas`
- file count and byte usage limits
- policy per user / group / tenant
- upload allowance checks before storage writes

4. `files-s3`
- S3-compatible storage adapter
- supports AWS S3, Cloudflare R2, MinIO, and similar providers via config

5. `files-image`
- optional image processing pipeline
- thumbnails, resizing, format conversion
- likely based on `sharp`

## Why This Split

These concerns should stay separate:

- file transport and persistence
- file access control
- file usage limits
- storage provider implementation
- media processing

If they are merged too early into one large module, the result becomes hard to reason about, hard to test, and expensive to evolve.

## `files v1` Scope

`files v1` should implement only the base layer.

Included:

- upload endpoint(s)
- basic metadata persistence
- local storage driver
- MIME and file size validation
- stable file identifiers
- a simple probe / demo flow

Excluded from v1:

- advanced authorization rules
- quotas
- S3-compatible providers
- image processing
- signed URLs
- public/private CDN strategies

## Core Design Rule: Metadata First

`files v1` should not be "save bytes and return a raw path".

Instead, every upload should create a file metadata record.

That metadata record is the stable source of truth for future:

- access checks
- quota accounting
- storage migration
- signed URL generation
- ownership and visibility rules

## Canonical Metadata Shape (Initial)

The exact persistence schema can change, but the canonical shape should conceptually include:

- `id`
- `storageKey`
- `originalName`
- `mimeType`
- `size`
- `ownerType`
- `ownerId`
- `visibility`
- `createdBy`
- `createdAt`
- `updatedAt`

Recommended semantics:

- `id`: stable public/internal file identifier
- `storageKey`: provider-specific storage object key
- `ownerType`: who the file belongs to (`user`, `group`, `system`, etc.)
- `ownerId`: identifier of that owner
- `visibility`: coarse visibility (`private`, `owner`, `group`, `public`)
- `createdBy`: actor who uploaded the file

Even if some fields are minimally used in v1, they define the right long-term shape.

## Canonical Upload Flow

The preferred upload flow is:

1. receive request
2. validate transport-level constraints
   - file present
   - MIME allowed
   - size allowed
3. build canonical metadata draft
4. write bytes through storage adapter
5. persist metadata record
6. return file DTO

Important:

- storage happens through a storage abstraction
- metadata persistence happens through the app's DB layer
- future access and quota checks should plug in before and after storage writes without changing the overall flow

## Storage Abstraction

`files v1` should define a backend storage abstraction now.

Suggested responsibilities:

- save file bytes
- open/read file bytes
- delete file bytes
- generate provider-native key

The `files` module should not assume:

- local filesystem forever
- S3 forever
- public URLs forever

The adapter boundary should exist in v1 even if only the local driver is implemented at first.

## Database Expectations

Best practical direction:

- `files v1` should be designed as DB-backed
- metadata persistence is not optional in the main design

Reason:

- file metadata is the future base for access control and quota accounting
- a storage-only approach creates migration pain later

Current Forgeon implication:

- `files` should likely integrate with `db-prisma` first
- if a project has no DB module, `files` should either:
  - warn clearly and refuse install, or
  - install in a reduced mode only if that mode is explicitly supported

Preferred direction:

- require a DB adapter for the canonical path

## Access Control Strategy (Future: `files-access`)

Access control should not live inside the storage driver.

The storage layer should only handle bytes.

Actual file authorization should be decided by a dedicated policy layer that uses:

- file metadata
- authenticated user identity
- role / permission checks
- domain context (group membership, tenant boundaries, ownership)

Recommended future service shape:

- `canRead(user, file)`
- `canDownload(user, file)`
- `canDelete(user, file)`
- `canUpdate(user, file)`
- `canGenerateSignedUrl(user, file)`

Important architectural rule:

- `rbac` is coarse-grained authorization
- `files-access` is resource-level authorization

`rbac` may answer:

- "is this user allowed to perform file-management actions in general?"

`files-access` must answer:

- "is this user allowed to access this specific file?"

## Quota Strategy (Future: `files-quotas`)

Quotas should be a separate policy layer, not part of the storage adapter.

Typical quota dimensions:

- max single-file size
- max total bytes
- max file count
- max uploads per period

Recommended design:

1. check quota allowance before writing bytes
2. store file
3. persist metadata
4. update usage counters

This implies two concepts:

- file metadata records
- usage counters

Recommended usage counter dimensions:

- `subjectType`
- `subjectId`
- `bytesUsed`
- `filesCount`

Where `subject` may be:

- a user
- a group
- a tenant

Best-practice note:

- do not recalculate usage from raw storage on every request
- maintain counters and provide a repair/reconcile path later

## S3-Compatible Strategy (Future: `files-s3`)

Do not create separate top-level modules for every provider unless behavior truly diverges.

Preferred model:

- one module: `files-s3`
- one config surface for S3-compatible providers

That module should support:

- AWS S3
- Cloudflare R2
- MinIO
- other S3-like endpoints where possible

Why:

- these providers are mostly connection/config variants of the same object-storage model
- fewer modules
- less duplicated logic

## Image Strategy (Future: `files-image`)

Image processing should remain separate from `files`.

Reason:

- not every project needs transforms
- `sharp` adds heavier dependencies and build complexity
- transport/storage concerns should stay independent from image transforms

`files-image` can later hook into:

- post-upload processing
- derivative generation
- thumbnail metadata

## Canonical Recommendation

Build the family in this order:

1. `files`
2. `files-s3`
3. `files-access`
4. `files-quotas`
5. `files-image`

This gives a stable base first, then expands storage, then policy, then media processing.

## Open Decisions Before Implementation

Before coding `files v1`, the following should be explicitly decided:

1. exact canonical metadata shape
2. whether `files v1` hard-requires a DB module
3. initial upload API shape:
   - single upload only?
   - public DTO shape?
4. where local files are stored in dev and Docker
5. whether the initial probe is:
   - upload-only
   - upload + fetch metadata
   - upload + delete cleanup

## Current Recommendation

Proceed with:

- `files v1` as a DB-backed base module
- local storage only in v1
- metadata-first design
- no access-control or quota enforcement inside `files v1`
- explicit future modules for:
  - `files-access`
  - `files-quotas`
  - `files-s3`
  - `files-image`

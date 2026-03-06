## Overview

`files` is the base runtime for upload/download with DB-backed metadata.

It currently adds:
- `@forgeon/files` package
- upload endpoint: `POST /api/files/upload`
- metadata endpoint: `GET /api/files/:publicId`
- download endpoint: `GET /api/files/:publicId/download?variant=original|preview`
- delete endpoint: `DELETE /api/files/:publicId`
- files probe endpoint: `POST /api/health/files`
- files variants probe endpoint: `GET /api/health/files-variants`
- web probe button and result block

The module follows capability-first rules:
- requires `db-adapter`
- requires `files-storage-adapter`

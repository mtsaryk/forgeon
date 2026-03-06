## Scope

Current stage:
- requires `files-runtime` capability (`files` module)
- protects:
  - `GET /api/files/:publicId`
  - `GET /api/files/:publicId/download`
  - `DELETE /api/files/:publicId`
- adds probe endpoint:
  - `GET /api/health/files-access`

Current policy:
- allow when `files.manage` permission is present
- allow owner (`ownerType=user` and `ownerId===actorId`)
- allow read for `visibility=public`

Future work:
- integrate richer actor context from auth/rbac modules
- extend policy for group/tenant membership
- move toward dedicated `files-access` integration strategy for domain rules

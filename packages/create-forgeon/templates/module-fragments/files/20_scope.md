## Scope

Current stage:
- runtime local-storage flow is available
- Prisma `FileRecord` and `FileVariant` schema + migrations are included
- Prisma `FileBlob` model enables dedup for original uploads
- MIME and max-size validation are enforced via files env config
- health probe uses create+cleanup flow to avoid storage growth
- `preview` variant generation stays optional and is enabled by `files-image`

Planned next:
- hardening for S3 runtime path (`files-s3`) and optional signed URL flow
- image pipeline hardening (`files-image`) for richer format policy and optional async transforms

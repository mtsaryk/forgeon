## Scope

Current stage:
- provider config and env surface
- runtime S3 storage is wired through the files service
- provider presets (`minio | r2 | aws | custom`) with override-friendly env keys
- retry tuning via `FILES_S3_MAX_ATTEMPTS`
- empty `FILES_S3_REGION` / `FILES_S3_ENDPOINT` / `FILES_S3_FORCE_PATH_STYLE` use preset defaults

Future work:
- upload/download and signed URL strategy integration in `files`

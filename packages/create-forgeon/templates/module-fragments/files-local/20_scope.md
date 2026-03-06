## Scope

Current stage:
- used by `files` runtime when `FILES_STORAGE_DRIVER=local`
- local root configuration via `FILES_LOCAL_ROOT`
- Docker compose named volume `files_data` is mounted to `/app/storage`

Future work:
- local storage operational hardening
- optional Docker volume presets via dedicated follow-up task/module

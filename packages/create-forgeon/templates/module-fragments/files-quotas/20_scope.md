## Scope

Current stage:
- requires `files-runtime` capability (`files` module)
- owner-based limits:
  - max files per owner
  - max total bytes per owner
- upload check runs before file write
- probe endpoint:
  - `GET /api/health/files-quotas`

Current limitations:
- per-owner only
- no tenant-wide or group-wide aggregation yet
- no async reconciliation job yet

Future work:
- richer quota subjects (`tenant`, `group`)
- reconciliation support for drift correction
- integration with future `files-quotas` accounting enhancements

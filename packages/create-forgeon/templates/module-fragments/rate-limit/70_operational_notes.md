## Operational Notes

Current scope:

- in-memory throttling only
- one global baseline policy
- no Redis / distributed storage
- no route-specific policy DSL in v1

That means this module is appropriate for local development, simple deployments, and as a base preset. If a project later needs distributed throttling or different policies per route or user, this module should be extended rather than replaced blindly.

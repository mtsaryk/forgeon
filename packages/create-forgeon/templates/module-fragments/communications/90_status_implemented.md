## Current State

Status: implemented.

Notes:
- `communications` is the canonical communication boundary for domain modules.
- Provider selection is module-owned config, not a runtime request field.
- Scheduling, queueing, retries, and persistent delivery history are intentionally deferred.

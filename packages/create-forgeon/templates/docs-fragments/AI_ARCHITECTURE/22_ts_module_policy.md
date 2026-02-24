## TypeScript Module Policy

- Keep app/runtime packages on Node config (`tsconfig.base.node.json`) when they run under NestJS/Node.
- Keep frontend-consumed shared packages on ESM config (`tsconfig.base.esm.json`).
- Contracts packages (`@forgeon/<feature>-contracts`) are ESM-first and imported only via package entrypoint.
- Do not import workspace internals via `/src/*` paths across packages.

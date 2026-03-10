---
name: forgeon-docker-build-triage
description: Use for diagnosing Forgeon Docker build or runtime failures in generated projects. Covers Dockerfile/compose context, workspace package copy/build order, proxy-specific issues, native dependencies, and runtime crash loops after successful builds.
---

# Forgeon Docker Build Triage

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/DOCKER_BUILD_GOTCHAS.md`
3. relevant module docs if the failure is module-specific

## Use this skill when

- the user provides `pnpm docker:up` or `docker compose up --build` logs
- Docker build passes but API/web container crashes in runtime
- failures happen only in proxy or only in Docker, not locally

## Triage order

1. classify the failure:
   - compile-time TS/Vite/Rollup
   - Docker context/COPY issue
   - runtime Nest wiring/config issue
   - CJS/ESM/package export issue
   - native dependency issue
2. inspect generated Dockerfiles and compose
3. inspect workspace build order in `apps/api/package.json` and Dockerfile
4. inspect package entrypoints and exports
5. inspect runtime module graph if the container crashes after boot

## Must do

- find the real root cause
- state whether the issue is build-time or runtime
- check whether the failure is generator-level or module-level

## Must not do

- do not stop at the first symptom
- do not assume Docker failure means Dockerfile only; many Forgeon Docker failures are package-boundary or module-order problems

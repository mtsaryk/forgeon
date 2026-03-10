---
name: forgeon-task-orchestrator
description: Use for non-trivial Forgeon work such as creating a module, refactoring a module, planning a complex feature, or fixing a bug that may touch architecture, docs, dependencies, Docker, or integrations. This is the primary orchestration skill for Forgeon repository tasks.
---

# Forgeon Task Orchestrator

Read `../../../docs/Agents.md` first.

Then open only the relevant deep docs under `../../../docs/Blueprint/`.

## Use this skill when

- the user asks to create or refactor a module
- the task may touch multiple Forgeon conventions
- the task may affect architecture, docs, dependency doctrine, Docker, or integration sync
- the user gives a short instruction like "create module X" or "implement the next module"

## Workflow

1. Restate the request in technical terms.
2. Classify the task:
   - new module
   - module refactor
   - build/runtime bug
   - integration sync
   - doctrine/docs/architecture update
3. If module-related, classify the module as:
   - `fullstack`
   - `backend-only`
   - `web-only`
4. Read the minimum necessary docs.
5. Analyze existing modules and patterns when needed.
6. Split scope into:
   - must-have now
   - good-to-have in v1
   - explicitly deferred
7. If anything is ambiguous, ask direct questions instead of guessing.
8. If the task would benefit from an additional missing skill, recommend creating or installing it before implementation.
9. Produce a concrete plan and do not start coding until the plan is approved.
10. After implementation, trigger a docs consistency sweep.

## Which worker skills to use

- module implementation: `../forgeon-module-implementer/SKILL.md`
- dependency doctrine: `../forgeon-capability-dependencies/SKILL.md`
- integration rules: `../forgeon-integration-sync/SKILL.md`
- Nest wiring and DI issues: `../forgeon-nest-wiring/SKILL.md`
- TS/ESM/CJS/build boundary issues: `../forgeon-ts-module-boundaries/SKILL.md`
- Docker failures: `../forgeon-docker-build-triage/SKILL.md`
- docs drift review: `../forgeon-doc-consistency/SKILL.md`

## Must do

- keep planning explicit
- identify affected files and subsystems before coding
- explain when current Forgeon conventions are sufficient and when they are not
- recommend structural changes only with clear rationale

## Must not do

- do not jump straight to code for complex work
- do not guess through ambiguous module semantics
- do not silently invent new Forgeon conventions

# SKILLS

This document defines the repo-local AI skills architecture for Forgeon.

## Purpose

Forgeon uses repo-specific skills to make repeated development workflows explicit, consistent, and cheaper to execute.

Skills are stored in:

- `.codex/skills/*`

They are internal to the Forgeon repository and are not generated into end-user projects.

## Skill Artifact Shape

Each Forgeon repo-local skill should contain at minimum:

- `SKILL.md`
- `agents/openai.yaml`

`SKILL.md` is the procedural source of truth.

`agents/openai.yaml` is the UI/discovery metadata layer for the skill.

If the helper generator is unavailable in the local environment, keep the same file shape and field rules manually.

## Skill Model

Forgeon uses two layers:

1. orchestration skill
- routes the task
- gathers context
- identifies ambiguity
- proposes the plan
- decides when worker skills are needed

2. worker skills
- solve one narrow Forgeon workflow well
- reuse accepted conventions
- avoid rediscovering the same failure patterns

## Current Wave 1 Skills

1. `forgeon-task-orchestrator`
- primary entrypoint for non-trivial Forgeon work

2. `forgeon-module-implementer`
- canonical add-module implementation workflow

3. `forgeon-capability-dependencies`
- capability-first prerequisite handling

4. `forgeon-integration-sync`
- cross-module integration rules and provider-strategy sync

5. `forgeon-nest-wiring`
- NestJS module/provider/controller wiring and DI troubleshooting

6. `forgeon-ts-module-boundaries`
- CJS/ESM boundaries, exports, entrypoints, native deps, build-order concerns

7. `forgeon-docker-build-triage`
- Docker build/runtime diagnosis in generated projects

8. `forgeon-doc-consistency`
- internal docs drift detection and update recommendations

## Current Wave 2 Skills

1. `forgeon-probe-pattern`
- canonical API + web diagnostics probe workflow

2. `forgeon-testing-matrix`
- generator/module test coverage, mixed-order checks, and smoke expectations

## Deferred Wave 3 Candidates

- `forgeon-files-stack`

This remains useful, but is less urgent than the generic probe and testing workflows.

## Canonical Workflow

For module work, refactors, and complex fixes:

1. restate the task in technical terms
2. read `docs/Agents.md`
3. open only the relevant deep docs
4. analyze existing modules, structure, and conventions when needed
5. classify scope:
- must-have now
- good-to-have in v1
- deferred
6. identify ambiguity and ask direct questions instead of guessing
7. check whether current repo skills are sufficient
8. if not sufficient, recommend creating or installing an additional skill before implementation
9. present a concrete plan and wait for approval
10. only then start code changes
11. after implementation, run docs consistency review

## Module-Type Rule

When planning a new module, always classify it as one of:

- `fullstack`
- `backend-only`
- `web-only`

This classification controls package layout, runtime wiring, probes, docs, and tests.

## Skill Recommendation Rule

During planning, the agent may recommend creating or installing an additional skill when:

- the task relies on a library or framework with repeated high-friction rules
- the current Forgeon skills do not cover the workflow adequately
- using an ad-hoc approach would likely create drift or regressions

Examples:

- React-heavy frontend architecture work
- library-specific background processing workflows
- future provider-specific storage or DB adapter families

The recommendation must explain:

- why current repo skills are insufficient
- what the new skill would cover
- whether the skill should be repo-local or externally installed

## Docs Consistency Rule

After meaningful changes, sweep for contradictions across:

- `docs/Agents.md`
- `docs/Blueprint/ARCHITECTURE.md`
- `docs/Blueprint/DEPENDENCY_DOCTRINE.md`
- `docs/Blueprint/MODULE_SPEC.md`
- `docs/Blueprint/ROADMAP.md`
- `docs/Blueprint/TASKS.md`
- module notes and README sections touched by the change

Default recommendation when drift is found:

- update docs now

## Non-Goals

These skills are not meant to:

- replace primary framework documentation
- hide architecture decisions
- justify silent cross-module patching
- bypass planning for complex changes



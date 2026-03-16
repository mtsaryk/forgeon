---
name: forgeon-doc-consistency
description: Use after Forgeon code, doctrine, architecture, module, integration, route, env, package, command, workflow, or status changes to keep Forgeon documentation in sync. Detect contradictions, map changed facts to the right doc surfaces, patch confirmed drift immediately when safe, and report unresolved documentation follow-up across Agents.md, Blueprint docs, README, template docs, module notes, and skill metadata.
---

# Forgeon Doc Consistency

Read in order:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/SKILLS.md`
3. `references/doc-surfaces.md` only for the sections relevant to the change

Then inspect only the doc surfaces implied by the changed facts.

## Use this skill when

- a Forgeon change may have altered routes, env keys, package names, module ids, commands, status labels, or workflow rules
- a module was implemented, refactored, hardened, or re-scoped
- doctrine, architecture, integration-sync, skills, or roadmap wording may now be stale
- generated-project-facing docs may have drifted from current scaffold or add-module behavior
- a user asks to verify the approved workflow or the next development stage

## Workflow

1. Extract the factual deltas first.
   Build a compact fact list from code, diffs, tests, and generated artifacts:
   - routes and probes
   - env keys and defaults
   - package names and commands
   - module ids, capability names, and status labels
   - architecture or workflow decisions
   - roadmap or "next stage" claims
2. Decide the documentation audience.
   Separate:
   - internal Forgeon docs
   - generated-project or template-facing docs
   - skill metadata and repo-local skill docs
3. Open only the affected doc surfaces.
   Start from `references/doc-surfaces.md` and load the smallest relevant set.
   Do not sweep every doc file unless the change is genuinely cross-cutting.
4. Compare docs against code and against each other.
   Treat any contradiction as drift even if one file is "close enough".
   Prefer the current code and accepted blueprint docs over memory.
5. Default to maintenance mode.
   If the correct wording is clear, patch docs now in the same task.
   If the decision itself is unclear, stop and report the ambiguity instead of inventing policy.
6. Run a final drift sweep after patching.
   Re-check duplicated status text, next-stage claims, README/module-note wording, and skill metadata.

## What to look for

- `not implemented`, `[ ]`, `[~]`, or deferred text that is no longer true
- stale TODOs after completion or hardening passes
- changed route, env, package, module, command, or workflow names still referenced in docs
- doctrine stated differently across `Agents.md`, Blueprint docs, README, templates, or skill docs
- roadmap or "next step" claims that no longer match implementation state
- template docs or module notes that lag behind actual scaffold/add-module behavior
- skill metadata (`SKILL.md`, `agents/openai.yaml`) that no longer matches the skill body

## Expected output

1. the factual changes checked
2. confirmed-consistent surfaces
3. contradictions or stale statements found
4. exact files patched or exact files that still need patching
5. any unresolved ambiguity that blocks safe wording

Default action:

- update docs now when the change is factual and unambiguous

## Must do

- preserve the split between internal Forgeon docs and generated-project docs
- verify "approved workflow" and "next stage" claims against `../../../docs/Blueprint/ROADMAP.md`
- check README and module-note surfaces when CLI, scaffold, or add-module behavior changed
- keep status wording aligned across roadmap, Agents, and skill/docs indexes

## Must not do

- do not patch just one status file if the same decision is described elsewhere
- do not treat README drift as harmless; in Forgeon it often causes repeated future mistakes
- do not treat `IDEAS.md` or stale notes as approved roadmap
- do not copy internal-only docs into generated-project docs unless the generator explicitly does that

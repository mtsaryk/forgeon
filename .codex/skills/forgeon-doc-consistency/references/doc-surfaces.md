# Doc Surfaces

Use this file to choose the smallest correct documentation sweep.

## Fact Extraction

Build the review around concrete facts, not around file names.

Typical fact buckets:

- routes and probes
- env keys and defaults
- package names, commands, and scripts
- module ids, capability names, and status labels
- install flow and integration-sync behavior
- stack defaults and architecture decisions
- roadmap and "next stage" claims
- skill workflow or skill discovery metadata

## Surface Map

### Workflow, planning, and repo conventions

Check:

- `../../../docs/Agents.md`
- `../../../docs/Blueprint/SKILLS.md`

Use when:

- workflow rules changed
- planning expectations changed
- a repo-local skill changed meaning or scope

### Architecture, stack, and scaffold defaults

Check:

- `../../../docs/Blueprint/ARCHITECTURE.md`
- `../../../docs/Agents.md`
- `../../../README.md`
- `../../../packages/create-forgeon/templates/base/docs/AI/ARCHITECTURE.md`

Use when:

- canonical stack changed
- scaffold defaults changed
- runtime/build assumptions changed

### Dependency doctrine and integration-sync behavior

Check:

- `../../../docs/Blueprint/DEPENDENCY_DOCTRINE.md`
- `../../../docs/Blueprint/MODULE_SPEC.md`
- `../../../docs/Agents.md`
- `../../../README.md`

Use when:

- prerequisites, capabilities, or provider-selection logic changed
- integration-sync rules changed
- install flow or follow-up commands changed

### Module status, probes, env keys, and runtime behavior

Check:

- `../../../docs/Agents.md`
- `../../../docs/Blueprint/ROADMAP.md`
- related root `README.md` sections
- related generated module notes under `modules/<module-id>/README.md`
- related template fragments under `../../../packages/create-forgeon/templates/module-fragments/`

Use when:

- a module moved from planned to implemented
- routes, env keys, or runtime notes changed
- probe wiring or Docker ownership changed

### Roadmap and next-stage claims

Check:

- `../../../docs/Blueprint/ROADMAP.md`
- `../../../docs/Agents.md`
- stage-specific blueprint docs such as `../../../docs/Blueprint/FILES_V2_PLAN.md`

Use when:

- the user asks what comes next
- implementation status changed
- a previously planned item is now done

### Generated-project-facing docs

Check:

- `../../../README.md`
- generated module notes emitted by add-modules
- `../../../packages/create-forgeon/templates/base/docs/AI/*` only if still part of the emitted doc surface or compatibility path

Use when:

- scaffold output changed
- add-module output changed
- user-facing setup or operational instructions changed

### Skill metadata

Check:

- `../SKILL.md`
- `../agents/openai.yaml`

Use when:

- a skill was created or updated
- invocation guidance changed
- the UI description or default prompt is now stale

## Search Shortcuts

When you already know the changed fact, search it directly:

```text
rg -n "<fact>" docs README.md .codex/skills packages/create-forgeon/templates
```

Good fact strings include:

- route fragments like `health/scheduler`
- env keys like `SCHEDULER_TIMEZONE`
- package names like `@forgeon/scheduler`
- commands like `pnpm forgeon:sync-integrations`
- status words like `implemented`, `planned`, `[~]`

## Patch Priority

Prefer this patch order when multiple surfaces drift:

1. canonical source of truth (`docs/Agents.md`, roadmap, doctrine, architecture)
2. repo index docs (`README.md`, `docs/Blueprint/SKILLS.md`)
3. generated-project-facing docs and module notes
4. skill metadata (`SKILL.md`, `agents/openai.yaml`)

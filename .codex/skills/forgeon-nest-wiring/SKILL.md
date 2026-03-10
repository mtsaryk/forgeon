---
name: forgeon-nest-wiring
description: Use for NestJS module wiring in Forgeon: AppModule imports, feature module providers and exports, controller constructor dependencies, and DI troubleshooting in generated projects and module packages.
---

# Forgeon Nest Wiring

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/MODULE_SPEC.md`

## Use this skill when

- adding a Nest feature module
- patching `app.module.ts`
- changing controller constructor dependencies
- debugging DI errors such as unknown dependencies or invalid exports

## Checklist

- is the service listed in `providers`?
- is the service exported if another module needs it?
- is the owning module imported into the module graph where the controller lives?
- does the controller inject only providers available in its module scope?
- is config wiring separated from runtime provider wiring?

## Common failure patterns

- service injected into controller but module not imported
- provider exported but not part of the current module
- config module imported, but runtime module forgotten
- text patch added constructor dependency without corresponding module graph change

## Must not do

- do not "fix" DI by importing random modules blindly
- do not export unavailable providers
- do not inject feature services into `HealthController` unless the AppModule graph includes them

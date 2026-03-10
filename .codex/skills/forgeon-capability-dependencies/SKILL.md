---
name: forgeon-capability-dependencies
description: Use for Forgeon capability-first dependency handling, including provides/requires metadata, optional integrations, interactive provider selection, and non-interactive prerequisite resolution with --with-required and --provider.
---

# Forgeon Capability Dependencies

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/DEPENDENCY_DOCTRINE.md`
3. `../../../docs/Blueprint/ARCHITECTURE.md`

## Use this skill when

- adding or refactoring module prerequisite metadata
- moving from concrete provider assumptions to capability-first rules
- implementing interactive dependency resolution in `create-forgeon add`
- working on `optionalIntegrations`

## Canonical rules

- hard prerequisites should be expressed as capabilities when possible
- only two dependency classes exist:
  - hard prerequisite
  - optional integration
- silent auto-install is forbidden

## TTY behavior

- detect missing capability
- ask for provider explicitly
- build a concrete install plan
- require confirmation before applying

## Non-TTY behavior

- fail by default if required capability is missing
- allow recursive prerequisite install only with `--with-required`
- require explicit `--provider <capability>=<module>` for ambiguous capabilities

## Must do

- keep provider choice explicit
- keep install plans concrete
- keep user-facing messaging precise

## Must not do

- do not hard-code `db-prisma` if the real boundary is `db-adapter`
- do not treat optional integrations as blockers
- do not invent hidden fallback behavior

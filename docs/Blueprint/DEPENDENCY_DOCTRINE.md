# DEPENDENCY DOCTRINE

This document defines the accepted dependency-resolution model for Forgeon add-modules.

It is the canonical reference for CLI behavior, generator behavior, and future module refactors.

## Purpose

The goal is to keep module installation:

- explicit
- predictable
- composable
- future-proof across multiple providers for the same capability

This doctrine replaces ad-hoc module-specific dependency handling.

## Core Rule: Depend On Capabilities, Not On Concrete Modules

Modules must describe hard dependencies in terms of capabilities, not specific providers.

Correct:

- `files` requires `db-adapter`

Not canonical:

- `files` requires `db-prisma`

Reason:

- multiple modules may provide the same capability
- provider choice must stay flexible
- capability rules remain stable even when new providers are added later

## Dependency Taxonomy

Forgeon uses exactly two dependency classes.

### 1. Hard Prerequisite

Definition:

- the target module cannot be installed correctly without the missing capability or module

Examples:

- `files` requires `db-adapter`
- `files-s3` requires `files`
- `files-image` requires `files`

Rules:

- hard prerequisites block installation until they are resolved
- resolution is explicit and never silent

### 2. Optional Integration

Definition:

- the target module can be installed without this dependency
- but an additional module or pair of modules can unlock extra behavior

Examples:

- `jwt-auth` + `db-adapter`
- `jwt-auth` + `rbac`

Rules:

- optional integrations do not block installation
- they are not auto-installed
- they are communicated to the user as follow-up opportunities
- they may be applied later through explicit integration tooling

## Hard Prerequisite Resolution: Interactive (TTY)

When `create-forgeon add <module>` is executed in an interactive terminal and a hard prerequisite is missing:

1. detect the missing capability or module
2. if the missing item is a capability:
   - show available providers
   - allow the user to choose one provider or cancel
3. once provider choices are known, build a concrete install plan
4. show the install plan in execution order
5. ask for explicit confirmation
6. execute only after confirmation

If the user cancels:

- no partial installation should occur
- exit cleanly

### Capability Provider Selection

For a missing capability, the CLI should present available providers explicitly.

Example:

```text
Module "files" requires capability: db-adapter

Available providers:
- db-prisma (Recommended)
- db-mongo
- Cancel
```

Only after provider selection should the CLI render the final concrete module plan.

### Guided Install Plan

`guided install plan` is not a preset.

It is a dynamic execution plan built at runtime from:

- the requested module
- its hard prerequisites
- currently installed capabilities
- available providers
- the resulting dependency chain

The final displayed plan must show concrete modules, not unresolved capabilities.

Example after provider selection:

```text
Install plan:
1. db-prisma
2. files
3. files-image
```

## Hard Prerequisite Resolution: Non-Interactive (non-TTY / CI / scripts)

In non-interactive mode, the CLI must not guess.

### Default behavior

If a hard prerequisite is missing:

- fail immediately
- print a clear error
- show the missing capability or module
- provide exact follow-up commands

Example:

```text
Cannot install "files": required capability "db-adapter" is missing.

Install one of the supported DB modules first:
- npx create-forgeon@latest add db-prisma
```

### Explicit non-interactive dependency resolution

Accepted flags:

- `--with-required`
  - allows the CLI to install hard prerequisites recursively
  - this already implies walking the full required dependency chain
  - no separate `deep` flag is needed

- `--provider <capability>=<module>`
  - explicitly selects a provider for an otherwise ambiguous capability
  - may be repeated

Example:

```bash
npx create-forgeon@latest add files --with-required --provider db-adapter=db-prisma
```

Rules:

- without `--with-required`, missing hard prerequisites always fail
- with `--with-required`, the CLI may proceed through the hard dependency chain
- if any capability has multiple providers and no matching `--provider` is supplied:
  - fail explicitly
  - print the exact `--provider` mapping required

Silent non-interactive auto-install is forbidden.

## Optional Integration UX

If a module has optional integrations available, the CLI should notify the user with a warning after installation.

CLI presentation rules:

- warning text: yellow
- involved module names: cyan / blue-green
- explanatory text: default terminal color

The warning should include:

1. the list of involved modules and/or capabilities
2. a short plain-language summary of what the integration enables
3. exact follow-up commands for doing it later

Example shape:

```text
Warning: optional integration available

Modules / capabilities:
- jwt-auth
- rbac

This enables:
- RBAC demo claims in JWT payloads
- permissions in refresh and /me responses

Apply later:
- pnpm forgeon:sync-integrations
```

If the integration also depends on a module not yet installed, the warning may additionally include the exact add command:

```text
- npx create-forgeon@latest add rbac
- pnpm forgeon:sync-integrations
```

Optional integrations never block install.

## Execution Constraints

- no silent auto-install of prerequisites
- no hidden cross-module mutations inside a module installer
- no capability should resolve to a default provider automatically when multiple providers exist
- provider choice is explicit in TTY and explicit via flags in non-TTY

## Required Future Refactor Direction

Existing module metadata and sync rules must be refactored toward this model.

Priority refactors:

1. add capability metadata to module definitions:
   - `provides`
   - `requires`
   - `optionalIntegrations`

2. change existing hard-coded module assumptions to capability-based rules

3. update dependency resolution in `create-forgeon add` to use:
   - interactive provider selection in TTY
   - `--with-required`
   - `--provider <capability>=<module>` in non-TTY

4. refactor current integrations that assume concrete modules where a capability boundary should exist

## Immediate Known Refactor Targets

### `jwt-auth`

Current state:

- current conceptual optional integration is modeled as `jwt-auth + db-adapter`
- the first concrete provider implementation remains `db-prisma`

Target state:

- dependency and integration logic should move to `db-adapter`

Implication:

- `jwt-auth` should be conceptually compatible with any future DB adapter
- provider-specific persistence wiring should be delegated to capability-aware integration logic

### `files` family

The `files` family must be built on this doctrine from the start:

- `files` requires `db-adapter`
- `files-s3` requires `files`
- `files-access` requires `files`
- `files-quotas` requires `files`
- `files-image` requires `files`

Any future extra behavior beyond hard prerequisites should be modeled as optional integration, not hidden dependency installation.

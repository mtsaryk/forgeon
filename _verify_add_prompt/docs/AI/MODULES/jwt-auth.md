# MODULE: JWT Auth

## Overview

- Id: `jwt-auth`
- Category: `auth-security`
- Status: implemented
- Description: JWT auth preset with contracts/api module split, guard+strategy, and DB-aware refresh token storage wiring.

## Scope

Implemented scope:

1. Split into reusable packages:
   - `@forgeon/auth-contracts`
   - `@forgeon/auth-api`
2. API runtime:
   - JWT login/refresh/logout/me endpoints
   - `JwtStrategy` + `JwtAuthGuard`
   - `authConfig` + `authEnvSchema` wiring through root `ConfigModule` validator chain
3. DB behavior:
   - if supported DB adapter is present (`db-prisma`), refresh token hash persistence is auto-wired
   - if DB is missing/unsupported, module installs in stateless mode and prints red warning
4. Module checks:
   - API probe endpoint: `GET /api/health/auth`
   - default web probe button + result block

## Current State

Status: implemented.

Notes:
- DB adapter auto-detection is currently implemented for `db-prisma`.
- Unknown/missing DB adapter falls back to stateless refresh flow with explicit warning.

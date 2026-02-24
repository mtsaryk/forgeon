import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePresetSupport } from './validate.mjs';

describe('validatePresetSupport', () => {
  it('accepts current supported presets', () => {
    assert.doesNotThrow(() =>
      validatePresetSupport({
        frontend: 'react',
        db: 'prisma',
        dockerEnabled: true,
        proxy: 'caddy',
      }),
    );

    assert.doesNotThrow(() =>
      validatePresetSupport({
        frontend: 'react',
        db: 'prisma',
        dockerEnabled: true,
        proxy: 'none',
      }),
    );
  });

  it('throws for angular not-yet-implemented preset', () => {
    assert.throws(
      () =>
        validatePresetSupport({
          frontend: 'angular',
          db: 'prisma',
          dockerEnabled: false,
          proxy: 'none',
        }),
      /Frontend preset "angular" is not implemented yet/,
    );
  });

  it('throws for unsupported db preset', () => {
    assert.throws(
      () =>
        validatePresetSupport({
          frontend: 'react',
          db: 'mongo',
          dockerEnabled: false,
          proxy: 'none',
        }),
      /Unsupported db preset: mongo/,
    );
  });

  it('throws for unsupported proxy only when docker is enabled', () => {
    assert.throws(
      () =>
        validatePresetSupport({
          frontend: 'react',
          db: 'prisma',
          dockerEnabled: true,
          proxy: 'traefik',
        }),
      /Unsupported proxy preset: traefik/,
    );

    assert.doesNotThrow(() =>
      validatePresetSupport({
        frontend: 'react',
        db: 'prisma',
        dockerEnabled: false,
        proxy: 'traefik',
      }),
    );
  });
});

const MODULE_PRESETS = {
  'db-prisma': {
    id: 'db-prisma',
    label: 'DB Prisma',
    category: 'database-layer',
    implemented: true,
    description: 'Current Prisma/Postgres provider for the db-adapter capability, including env config, scripts, and DB probe wiring.',
    detectionPaths: ['packages/db-prisma/package.json'],
    provides: ['db-adapter'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  'files-local': {
    id: 'files-local',
    label: 'Files Local Adapter',
    category: 'file-storage',
    implemented: true,
    description:
      'Local disk provider for the files-storage-adapter capability. Recommended/default provider in interactive resolution.',
    detectionPaths: ['packages/files-local/package.json'],
    provides: ['files-storage-adapter'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  'files-s3': {
    id: 'files-s3',
    label: 'Files S3 Adapter',
    category: 'file-storage',
    implemented: true,
    description:
      'S3-compatible provider for the files-storage-adapter capability (AWS S3, R2, MinIO, compatible endpoints).',
    detectionPaths: ['packages/files-s3/package.json'],
    provides: ['files-storage-adapter'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  files: {
    id: 'files',
    label: 'Files',
    category: 'file-storage',
    implemented: true,
    description:
      'Foundation files module with typed config wiring. Requires db-adapter and files-storage-adapter capabilities.',
    detectionPaths: ['packages/files/package.json'],
    provides: ['files-runtime'],
    requires: [
      { type: 'capability', id: 'db-adapter' },
      { type: 'capability', id: 'files-storage-adapter' },
    ],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  i18n: {
    id: 'i18n',
    label: 'I18n',
    category: 'localization',
    implemented: true,
    description:
      'Independent backend/frontend i18n wiring with contracts, web helpers, shared translation resources, and locale maintenance scripts.',
    detectionPaths: ['packages/i18n/package.json'],
    provides: ['i18n-runtime'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  logger: {
    id: 'logger',
    label: 'Logger',
    category: 'observability',
    implemented: true,
    description:
      'Independent structured API logger with request id middleware and HTTP logging interceptor; intentionally no dedicated runtime probe.',
    detectionPaths: ['packages/logger/package.json'],
    provides: ['logger-runtime'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  swagger: {
    id: 'swagger',
    label: 'Swagger / OpenAPI',
    category: 'api-documentation',
    implemented: true,
    description:
      'Independent OpenAPI docs setup with env-based toggle and route path; feature-level Swagger decorators remain manual.',
    detectionPaths: ['packages/swagger/package.json'],
    provides: ['openapi-runtime'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  'jwt-auth': {
    id: 'jwt-auth',
    label: 'JWT Auth',
    category: 'auth-security',
    implemented: true,
    description:
      'JWT auth preset with contracts/api module split, guard+strategy, and optional db-adapter-backed refresh token persistence via integration sync.',
    detectionPaths: ['packages/auth-api/package.json'],
    provides: ['auth-runtime'],
    requires: [],
    optionalIntegrations: [
      {
        id: 'auth-persistence',
        title: 'Auth Persistence Integration',
        modules: ['jwt-auth', 'db-adapter'],
        requires: [{ type: 'capability', id: 'db-adapter' }],
        description: [
          'Persist refresh-token state through the db-adapter capability boundary',
          'Use the current DB adapter implementation (today: db-prisma) for refresh-token storage',
          'Enable stronger refresh-token invalidation flows after logout and rotation',
        ],
        followUpCommands: [
          'npx create-forgeon@latest add db-prisma',
          'pnpm forgeon:sync-integrations',
        ],
      },
      {
        id: 'auth-rbac-claims',
        title: 'Auth Claims Integration',
        modules: ['jwt-auth', 'rbac'],
        requires: [{ type: 'module', id: 'rbac' }],
        description: [
          'Expose demo RBAC permissions inside JWT payloads',
          'Return permissions through refresh and /me responses',
        ],
        followUpCommands: [
          'npx create-forgeon@latest add rbac',
          'pnpm forgeon:sync-integrations',
        ],
      },
    ],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  'rate-limit': {
    id: 'rate-limit',
    label: 'Rate Limit',
    category: 'auth-security',
    implemented: true,
    description:
      'Independent request throttling preset with env-based limits, proxy-aware trust, and a runtime probe endpoint.',
    detectionPaths: ['packages/rate-limit/package.json'],
    provides: ['rate-limit-runtime'],
    requires: [],
    optionalIntegrations: [],
    docFragments: [
      '00_title',
      '10_overview',
      '20_idea',
      '30_what_it_adds',
      '40_how_it_works',
      '50_how_to_use',
      '60_configuration',
      '70_operational_notes',
      '90_status_implemented',
    ],
  },
  rbac: {
    id: 'rbac',
    label: 'RBAC / Permissions',
    category: 'auth-security',
    implemented: true,
    description:
      'Role and permission decorators with a Nest guard and a protected probe endpoint; installs independently and optionally integrates with jwt-auth.',
    detectionPaths: ['packages/rbac/package.json'],
    provides: ['rbac-runtime'],
    requires: [],
    optionalIntegrations: [
      {
        id: 'auth-rbac-claims',
        title: 'Auth Claims Integration',
        modules: ['jwt-auth', 'rbac'],
        requires: [{ type: 'module', id: 'jwt-auth' }],
        description: [
          'Expose demo RBAC permissions inside JWT payloads',
          'Return permissions through refresh and /me responses',
        ],
        followUpCommands: [
          'npx create-forgeon@latest add jwt-auth',
          'pnpm forgeon:sync-integrations',
        ],
      },
    ],
    docFragments: [
      '00_title',
      '10_overview',
      '20_idea',
      '30_what_it_adds',
      '40_how_it_works',
      '50_how_to_use',
      '60_configuration',
      '70_operational_notes',
      '90_status_implemented',
    ],
  },
  queue: {
    id: 'queue',
    label: 'Queue Worker',
    category: 'background-jobs',
    implemented: false,
    description: 'Queue processing preset (BullMQ-style app wiring).',
    detectionPaths: ['packages/queue/package.json'],
    provides: ['queue-runtime'],
    requires: [],
    optionalIntegrations: [],
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_planned'],
  },
};

export function listModulePresets() {
  return Object.values(MODULE_PRESETS);
}

export function getModulePreset(moduleId) {
  return MODULE_PRESETS[moduleId] ?? null;
}

export function getCapabilityProviders(capabilityId, { implementedOnly = true } = {}) {
  return listModulePresets().filter((preset) => {
    if (implementedOnly && !preset.implemented) {
      return false;
    }
    return Array.isArray(preset.provides) && preset.provides.includes(capabilityId);
  });
}

export function ensureModuleExists(moduleId) {
  const preset = getModulePreset(moduleId);
  if (!preset) {
    const available = listModulePresets()
      .map((item) => item.id)
      .join(', ');
    throw new Error(`Unknown module "${moduleId}". Available modules: ${available}`);
  }
  return preset;
}

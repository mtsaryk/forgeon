const MODULE_PRESETS = {
  i18n: {
    id: 'i18n',
    label: 'I18n',
    category: 'localization',
    implemented: true,
    description: 'Backend/frontend i18n wiring with locale contracts and translation resources.',
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  logger: {
    id: 'logger',
    label: 'Logger',
    category: 'observability',
    implemented: true,
    description: 'Structured API logger with request id middleware and HTTP logging interceptor.',
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  swagger: {
    id: 'swagger',
    label: 'Swagger / OpenAPI',
    category: 'api-documentation',
    implemented: true,
    description: 'OpenAPI docs setup with env-based toggle and route path.',
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_implemented'],
  },
  'jwt-auth': {
    id: 'jwt-auth',
    label: 'JWT Auth',
    category: 'auth-security',
    implemented: false,
    description: 'JWT auth preset with guards and passport strategy wiring.',
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_planned'],
  },
  queue: {
    id: 'queue',
    label: 'Queue Worker',
    category: 'background-jobs',
    implemented: false,
    description: 'Queue processing preset (BullMQ-style app wiring).',
    docFragments: ['00_title', '10_overview', '20_scope', '90_status_planned'],
  },
};

export function listModulePresets() {
  return Object.values(MODULE_PRESETS);
}

export function getModulePreset(moduleId) {
  return MODULE_PRESETS[moduleId] ?? null;
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

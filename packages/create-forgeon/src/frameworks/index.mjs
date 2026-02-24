const FRONTEND_PRESETS = {
  react: {
    id: 'react',
    label: 'React + Vite + TypeScript',
    implemented: true,
  },
  angular: {
    id: 'angular',
    label: 'Angular',
    implemented: false,
    message: 'Frontend preset "angular" is not implemented yet. Use --frontend react.',
  },
};

export function getFrontendPreset(frontend) {
  return FRONTEND_PRESETS[frontend] ?? null;
}

export function getFrontendLabel(frontend) {
  return getFrontendPreset(frontend)?.label ?? frontend;
}

export function ensureFrontendSupported(frontend) {
  const preset = getFrontendPreset(frontend);
  if (!preset) {
    throw new Error(`Unsupported frontend preset: ${frontend}`);
  }

  if (!preset.implemented) {
    throw new Error(preset.message ?? `Frontend preset "${frontend}" is not implemented yet.`);
  }
}

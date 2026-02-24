const DATABASE_PRESETS = {
  prisma: {
    id: 'prisma',
    label: 'Prisma + PostgreSQL',
    implemented: true,
  },
};

export function getDatabasePreset(db) {
  return DATABASE_PRESETS[db] ?? null;
}

export function getDatabaseLabel(db) {
  return getDatabasePreset(db)?.label ?? db;
}

export function ensureDatabaseSupported(db) {
  const preset = getDatabasePreset(db);
  if (!preset) {
    throw new Error(`Unsupported db preset: ${db}. Currently implemented: prisma.`);
  }

  if (!preset.implemented) {
    throw new Error(`DB preset "${db}" is not implemented yet.`);
  }
}

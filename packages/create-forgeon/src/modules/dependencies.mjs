import fs from 'node:fs';
import path from 'node:path';
import { promptSelect } from '../cli/prompt-select.mjs';
import { getCapabilityProviders, listModulePresets } from './registry.mjs';

function getPresetMap(presets) {
  return new Map(presets.map((preset) => [preset.id, preset]));
}

function getDetectionPaths(preset) {
  if (Array.isArray(preset.detectionPaths) && preset.detectionPaths.length > 0) {
    return preset.detectionPaths;
  }
  return [path.join('packages', preset.id, 'package.json')];
}

export function detectInstalledModules(targetRoot, presets = listModulePresets()) {
  const installed = new Set();
  const absoluteRoot = path.resolve(targetRoot);

  for (const preset of presets) {
    const detectionPaths = getDetectionPaths(preset);
    if (
      detectionPaths.some((relativePath) => fs.existsSync(path.join(absoluteRoot, relativePath)))
    ) {
      installed.add(preset.id);
    }
  }

  return installed;
}

export function collectProvidedCapabilities(moduleIds, presets = listModulePresets()) {
  const presetMap = getPresetMap(presets);
  const capabilities = new Set();

  for (const moduleId of moduleIds) {
    const preset = presetMap.get(moduleId);
    if (!preset || !Array.isArray(preset.provides)) {
      continue;
    }
    for (const capabilityId of preset.provides) {
      capabilities.add(capabilityId);
    }
  }

  return capabilities;
}

function describeMissingRequirement(requirement) {
  if (requirement.type === 'capability') {
    return `required capability "${requirement.id}" is missing`;
  }
  return `required module "${requirement.id}" is missing`;
}

function getNonInteractiveHint(requirement, providers, selectedProviderId) {
  if (requirement.type === 'capability') {
    if (providers.length === 0) {
      return 'No implemented providers are currently available for this capability.';
    }
    const providerLines = providers.map((provider) => `- npx create-forgeon@latest add ${provider.id}`);
    const withRequiredExample = selectedProviderId
      ? [
          '',
          'Or re-run with:',
          `- npx create-forgeon@latest add <module-id> --with-required --provider ${requirement.id}=${selectedProviderId}`,
        ]
      : [];
    return [
      'Install one of the supported providers first:',
      ...providerLines,
      ...withRequiredExample,
    ].join('\n');
  }

  return `Install it first:\n- npx create-forgeon@latest add ${requirement.id}`;
}

function createResolutionError(moduleId, requirement, providers = [], selectedProviderId = null) {
  const hint = getNonInteractiveHint(requirement, providers, selectedProviderId);
  return new Error(`Cannot install "${moduleId}": ${describeMissingRequirement(requirement)}.\n\n${hint}`);
}

async function selectProviderForCapability({
  moduleId,
  capabilityId,
  providers,
  promptSelectImpl,
}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `Interactive provider selection requires a TTY for capability "${capabilityId}" while installing "${moduleId}".`,
    );
  }

  const choices = providers.map((provider, index) => ({
    label: index === 0 ? `${provider.id} (Recommended)` : provider.id,
    value: provider.id,
  }));
  choices.push({ label: 'Cancel', value: '__cancel' });

  const picked = await promptSelectImpl({
    message: `Module "${moduleId}" requires capability: ${capabilityId}`,
    defaultValue: '__cancel',
    choices,
  });

  if (picked === '__cancel') {
    return null;
  }

  return picked;
}

export async function resolveModuleInstallPlan({
  moduleId,
  targetRoot,
  presets = listModulePresets(),
  withRequired = false,
  providerSelections = {},
  promptSelectImpl = promptSelect,
  isInteractive = process.stdin.isTTY && process.stdout.isTTY,
}) {
  const presetMap = getPresetMap(presets);
  if (!presetMap.has(moduleId)) {
    throw new Error(`Unknown module "${moduleId}".`);
  }

  const installed = detectInstalledModules(targetRoot, presets);
  const planned = [];
  const plannedSet = new Set();
  const providedCapabilities = collectProvidedCapabilities(installed, presets);
  const selectedProviders = new Map();

  async function ensureModule(moduleIdToEnsure, isRoot = false) {
    const preset = presetMap.get(moduleIdToEnsure);
    if (!preset) {
      throw new Error(`Unknown module "${moduleIdToEnsure}".`);
    }

    const requirements = Array.isArray(preset.requires) ? preset.requires : [];
    for (const requirement of requirements) {
      if (requirement.type === 'module') {
        if (installed.has(requirement.id) || plannedSet.has(requirement.id)) {
          continue;
        }
        if (!isInteractive && !withRequired) {
          throw createResolutionError(moduleId, requirement);
        }
        await ensureModule(requirement.id);
        continue;
      }

      if (requirement.type !== 'capability') {
        continue;
      }

      if (providedCapabilities.has(requirement.id)) {
        continue;
      }

      const providers = getCapabilityProviders(requirement.id, { implementedOnly: true });
      if (providers.length === 0) {
        throw createResolutionError(moduleId, requirement, providers);
      }

      let providerId = null;
      if (selectedProviders.has(requirement.id)) {
        providerId = selectedProviders.get(requirement.id);
      } else if (isInteractive) {
        providerId = await selectProviderForCapability({
          moduleId,
          capabilityId: requirement.id,
          providers,
          promptSelectImpl,
        });
        if (!providerId) {
          return { cancelled: true };
        }
      } else {
        if (!withRequired) {
          throw createResolutionError(moduleId, requirement, providers);
        }

        if (providers.length === 1) {
          providerId = providers[0].id;
        } else {
          const explicitProvider = providerSelections[requirement.id];
          if (!explicitProvider) {
            throw createResolutionError(moduleId, requirement, providers);
          }
          const matchedProvider = providers.find((provider) => provider.id === explicitProvider);
          if (!matchedProvider) {
            throw createResolutionError(moduleId, requirement, providers, explicitProvider);
          }
          providerId = matchedProvider.id;
        }
      }

      selectedProviders.set(requirement.id, providerId);
      const providerResult = await ensureModule(providerId);
      if (providerResult?.cancelled) {
        return providerResult;
      }
    }

    if (!isRoot && !installed.has(moduleIdToEnsure) && !plannedSet.has(moduleIdToEnsure)) {
      planned.push(moduleIdToEnsure);
      plannedSet.add(moduleIdToEnsure);
      const provided = Array.isArray(preset.provides) ? preset.provides : [];
      for (const capabilityId of provided) {
        providedCapabilities.add(capabilityId);
      }
    }

    if (isRoot && !plannedSet.has(moduleIdToEnsure)) {
      planned.push(moduleIdToEnsure);
      plannedSet.add(moduleIdToEnsure);
    }
    return { cancelled: false };
  }

  const result = await ensureModule(moduleId, true);
  return {
    cancelled: result?.cancelled === true,
    moduleSequence: planned,
    selectedProviders: Object.fromEntries(selectedProviders),
  };
}

function requirementIsMissing(requirement, installedModules, providedCapabilities) {
  if (requirement.type === 'capability') {
    return !providedCapabilities.has(requirement.id);
  }
  return !installedModules.has(requirement.id);
}

export function getPendingOptionalIntegrations({
  moduleId,
  targetRoot,
  presets = listModulePresets(),
}) {
  const presetMap = getPresetMap(presets);
  const preset = presetMap.get(moduleId);
  if (!preset || !Array.isArray(preset.optionalIntegrations)) {
    return [];
  }

  const installedModules = detectInstalledModules(targetRoot, presets);
  const providedCapabilities = collectProvidedCapabilities(installedModules, presets);

  return preset.optionalIntegrations
    .map((integration) => {
      const requirements = Array.isArray(integration.requires) ? integration.requires : [];
      const missing = requirements.filter((requirement) =>
        requirementIsMissing(requirement, installedModules, providedCapabilities),
      );
      if (missing.length === 0) {
        return null;
      }
      return {
        ...integration,
        missing,
      };
    })
    .filter(Boolean);
}

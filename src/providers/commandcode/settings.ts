import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';
import { getHostnameKey, getLegacyHostnameKey, migrateLegacyHostnameKeyedMap } from '../../utils/env';
import { type CommandCodeModel, normalizeCommandCodeModels } from './models';

export interface CommandCodeProviderSettings {
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  discoveredModels: CommandCodeModel[];
  enabled: boolean;
  environmentHash: string;
  environmentVariables: string;
  modelAliases: Record<string, string>;
  visibleModels: string[] | null;
}

export const DEFAULT_COMMAND_CODE_PROVIDER_SETTINGS: Readonly<CommandCodeProviderSettings> = Object.freeze({
  cliPath: '',
  cliPathsByHost: {},
  discoveredModels: [],
  enabled: false,
  environmentHash: '',
  environmentVariables: '',
  modelAliases: {},
  visibleModels: null,
});

export function getCommandCodeProviderSettings(
  settings: Record<string, unknown>,
): CommandCodeProviderSettings {
  const config = getProviderConfig(settings, 'commandcode');
  const discoveredModels = normalizeCommandCodeModels(config.discoveredModels);
  const cliPaths = normalizeStringMap(config.cliPathsByHost);
  const cliPathsByHost = Object.keys(cliPaths).length > 0
    ? migrateLegacyHostnameKeyedMap(cliPaths, getHostnameKey(), getLegacyHostnameKey())
    : cliPaths;

  return {
    cliPath: stringValue(config.cliPath),
    cliPathsByHost,
    discoveredModels,
    enabled: config.enabled === true,
    environmentHash: stringValue(config.environmentHash),
    environmentVariables: stringValue(config.environmentVariables)
      || getProviderEnvironmentVariables(settings, 'commandcode')
      || '',
    modelAliases: normalizeAliases(config.modelAliases, discoveredModels),
    visibleModels: normalizeCommandCodeVisibleModels(config.visibleModels, discoveredModels),
  };
}

export function updateCommandCodeProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<CommandCodeProviderSettings>,
): CommandCodeProviderSettings {
  const current = getCommandCodeProviderSettings(settings);
  const discoveredModels = normalizeCommandCodeModels(updates.discoveredModels ?? current.discoveredModels);
  const visibleModels = normalizeCommandCodeVisibleModels(
    'visibleModels' in updates ? updates.visibleModels : current.visibleModels,
    discoveredModels,
  );
  const next: CommandCodeProviderSettings = {
    ...current,
    ...updates,
    cliPath: stringValue(updates.cliPath ?? current.cliPath),
    cliPathsByHost: normalizeStringMap(updates.cliPathsByHost ?? current.cliPathsByHost),
    discoveredModels,
    environmentHash: stringValue(updates.environmentHash ?? current.environmentHash),
    environmentVariables: stringValue(updates.environmentVariables ?? current.environmentVariables),
    modelAliases: normalizeAliases(updates.modelAliases ?? current.modelAliases, discoveredModels),
    visibleModels,
  };
  setProviderConfig(settings, 'commandcode', { ...next });
  return next;
}

export function normalizeCommandCodeVisibleModels(
  value: unknown,
  discoveredModels: CommandCodeModel[],
): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const known = new Set(discoveredModels.map(model => model.id));
  const visible: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const id = entry.trim();
    if (!id || seen.has(id) || (known.size > 0 && !known.has(id))) continue;
    seen.add(id);
    visible.push(id);
  }
  return visible;
}

function normalizeAliases(value: unknown, models: CommandCodeModel[]): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const known = new Set(models.map(model => model.id));
  const aliases: Record<string, string> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    const alias = typeof entry === 'string' ? entry.trim() : '';
    if (id.trim() && alias && (known.size === 0 || known.has(id))) aliases[id] = alias;
  }
  return aliases;
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => (
    typeof entry === 'string' && entry.trim() ? [[key, entry.trim()]] : []
  )));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

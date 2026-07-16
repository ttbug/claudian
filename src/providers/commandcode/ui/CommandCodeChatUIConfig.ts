import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderUIOption,
} from '../../../core/providers/types';
import {
  COMMAND_CODE_SYNTHETIC_MODEL_ID,
  decodeCommandCodeModelId,
  encodeCommandCodeModelId,
} from '../models';
import { getCommandCodeProviderSettings } from '../settings';

const DEFAULT_CONTEXT_WINDOW = 200_000;
const PERMISSION_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'standard',
  inactiveLabel: 'Safe',
  activeValue: 'auto-accept',
  activeLabel: 'YOLO',
  planValue: 'plan',
  planLabel: 'Plan',
};

export const commandCodeChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(settings): ProviderUIOption[] {
    const providerSettings = getCommandCodeProviderSettings(settings);
    const visible = providerSettings.visibleModels === null
      ? providerSettings.discoveredModels.map(model => model.id)
      : providerSettings.visibleModels;
    const models = new Map(providerSettings.discoveredModels.map(model => [model.id, model]));
    const options = visible.flatMap((id): ProviderUIOption[] => {
      const model = models.get(id);
      if (!model) return [];
      return [buildModelOption(id, model, providerSettings.modelAliases[id])];
    });
    const seen = new Set(options.map(option => option.value));
    const savedProviderModel = settings.savedProviderModel
      && typeof settings.savedProviderModel === 'object'
      && !Array.isArray(settings.savedProviderModel)
      ? (settings.savedProviderModel as Record<string, unknown>).commandcode
      : undefined;
    for (const selected of [settings.model, savedProviderModel]) {
      if (typeof selected !== 'string' || seen.has(selected)) continue;
      const id = decodeCommandCodeModelId(selected);
      if (!id) continue;
      const model = models.get(id);
      options.push(model
        ? buildModelOption(id, model, providerSettings.modelAliases[id])
        : { description: 'Selected in an existing session', label: id, value: selected });
      seen.add(selected);
    }
    return options.length > 0 ? options : [{
      description: 'Discover models in settings',
      label: 'Command Code',
      value: COMMAND_CODE_SYNTHETIC_MODEL_ID,
    }];
  },

  getDefaultModel(settings): string {
    const providerSettings = getCommandCodeProviderSettings(settings);
    const model = providerSettings.discoveredModels.find(entry => entry.isDefault)
      ?? providerSettings.discoveredModels[0];
    return model ? encodeCommandCodeModelId(model.id) : COMMAND_CODE_SYNTHETIC_MODEL_ID;
  },

  ownsModel(model): boolean {
    return model === COMMAND_CODE_SYNTHETIC_MODEL_ID || decodeCommandCodeModelId(model) !== null;
  },

  isAdaptiveReasoningModel(): boolean {
    return false;
  },

  getReasoningOptions() {
    return [{ label: 'Off', value: 'off' }];
  },

  getDefaultReasoningValue(): string {
    return 'off';
  },

  getContextWindowSize(model, customLimits): number {
    return customLimits?.[model] ?? DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model): boolean {
    return model === COMMAND_CODE_SYNTHETIC_MODEL_ID || decodeCommandCodeModelId(model) !== null;
  },

  applyModelDefaults(model, settings): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;
    const bag = settings as Record<string, unknown>;
    bag.model = model;
    bag.effortLevel = 'off';
  },

  normalizeModelVariant(model): string {
    return model;
  },

  getCustomModelIds(): Set<string> {
    return new Set();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return PERMISSION_TOGGLE;
  },

  resolvePermissionMode(settings): string {
    const value = settings.permissionMode;
    return value === 'plan' || value === 'auto-accept' ? value : 'standard';
  },

  applyPermissionMode(value, settings): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;
    (settings as Record<string, unknown>).permissionMode = value;
  },
};

function buildModelOption(
  id: string,
  model: ReturnType<typeof getCommandCodeProviderSettings>['discoveredModels'][number],
  alias?: string,
): ProviderUIOption {
  return {
    description: model.description,
    group: model.group || undefined,
    label: alias ?? model.label,
    value: encodeCommandCodeModelId(id),
  };
}

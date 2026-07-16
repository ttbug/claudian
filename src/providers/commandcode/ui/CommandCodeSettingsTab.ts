import * as fs from 'node:fs';

import { Notice, Setting } from 'obsidian';

import { ProviderSettingsCoordinator } from '../../../core/providers/ProviderSettingsCoordinator';
import type {
  ProviderSettingsTabRenderer,
  ProviderSettingsTabRendererContext,
} from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../shared/settings/EnvironmentSettingsSection';
import {
  type ProviderModelPickerModel,
  type ProviderModelPickerState,
  renderProviderModelPicker,
} from '../../../shared/settings/ProviderModelPicker';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { maybeGetCommandCodeWorkspaceServices } from '../app/CommandCodeWorkspaceServices';
import { type CommandCodeModel } from '../models';
import {
  getCommandCodeProviderSettings,
  normalizeCommandCodeVisibleModels,
  updateCommandCodeProviderSettings,
} from '../settings';

export const commandCodeSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const settings = context.plugin.settings as unknown as Record<string, unknown>;
    const providerSettings = getCommandCodeProviderSettings(settings);
    const hostname = getHostnameKey();

    new Setting(container).setName('Setup').setHeading();
    new Setting(container)
      .setName('Enable cmd provider')
      .setDesc('Launch cmd -p in headless mode as a provider.')
      .addToggle(toggle => toggle.setValue(providerSettings.enabled).onChange(async (enabled) => {
        await context.plugin.mutateSettings((next) => {
          ProviderSettingsCoordinator.applyProviderEnablement(next, 'commandcode', enabled);
        });
        context.refreshModelSelectors();
        context.refreshTitleGenerationModelOptions();
      }));

    const validation = container.createDiv({
      cls: 'claudian-cli-path-validation claudian-setting-validation claudian-setting-validation-error claudian-hidden',
    });
    new Setting(container)
      .setName('CLI path')
      .setDesc(process.platform === 'win32'
        ? 'Required on Windows to avoid confusing Command Code with cmd.exe.'
        : 'Optional absolute path. Leave empty to resolve `cmd` from PATH.')
      .addText((text) => {
        const current = providerSettings.cliPathsByHost[hostname] ?? '';
        text.setValue(current).setPlaceholder('/opt/homebrew/bin/cmd').onChange(async (value) => {
          const error = validateCliPath(value);
          validation.setText(error ?? '');
          validation.toggleClass('claudian-hidden', !error);
          text.inputEl.toggleClass('claudian-input-error', !!error);
          if (error) return;

          await context.plugin.mutateSettings((next) => {
            const paths = { ...getCommandCodeProviderSettings(next).cliPathsByHost };
            if (value.trim()) paths[hostname] = value.trim();
            else delete paths[hostname];
            updateCommandCodeProviderSettings(next, { cliPathsByHost: paths, discoveredModels: [] });
            maybeGetCommandCodeWorkspaceServices()?.cliResolver.reset();
          });
          context.refreshModelSelectors();
        });
      });

    new Setting(container).setName('Models').setHeading();
    renderModelPicker(container, context, settings);

    renderEnvironmentSettingsSection({
      container,
      desc: 'Environment variables passed only to Command Code.',
      heading: 'Environment',
      name: 'Command Code environment variables',
      placeholder: 'OPENAI_API_KEY=...',
      plugin: context.plugin,
      scope: 'provider:commandcode',
    });
  },
};

function renderModelPicker(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  settings: Record<string, unknown>,
): void {
  const getState = (): ProviderModelPickerState => {
    const current = getCommandCodeProviderSettings(settings);
    const selectedIds = current.visibleModels ?? current.discoveredModels.map(model => model.id);
    return {
      aliases: current.modelAliases,
      discoveredCount: current.discoveredModels.length,
      models: buildPickerModels(current.discoveredModels, selectedIds),
      selectedIds,
    };
  };

  renderProviderModelPicker({
    container,
    emptyCatalogText: 'No models discovered yet. Click Discover to query Command Code.',
    failedCatalogText: 'Could not load models. Check the CLI path and login state.',
    getState,
    async loadCatalog() {
      const result = await maybeGetCommandCodeWorkspaceServices()?.refreshModelCatalog?.();
      if (!result) return 'empty';
      if (result.diagnostics) {
        new Notice(`Command Code discovery failed: ${result.diagnostics}`);
        return 'failed';
      }
      context.refreshModelSelectors();
      return getCommandCodeProviderSettings(settings).discoveredModels.length > 0 ? 'loaded' : 'empty';
    },
    loadingCatalogText: 'Loading Command Code models...',
    modifier: 'commandcode',
    async onAliasesChange(modelAliases) {
      await context.plugin.mutateSettings((next) => {
        updateCommandCodeProviderSettings(next, { modelAliases });
      });
      context.refreshModelSelectors();
    },
    async onSelectedIdsChange(visibleModels) {
      await context.plugin.mutateSettings((next) => {
        const current = getCommandCodeProviderSettings(next);
        updateCommandCodeProviderSettings(next, {
          visibleModels: normalizeCommandCodeVisibleModels(visibleModels, current.discoveredModels),
        });
      });
      context.refreshModelSelectors();
    },
    providerName: 'Command Code',
    settingDescription: 'Choose which Command Code models appear in the chat selector.',
  });
}

function buildPickerModels(models: CommandCodeModel[], selectedIds: string[]): ProviderModelPickerModel[] {
  const selected = new Set(selectedIds);
  return models.map(model => ({
    description: model.description,
    id: model.id,
    isAvailable: true,
    name: model.label,
    providerKey: model.group.toLowerCase() || 'commandcode',
    providerLabel: model.group || 'Command Code',
  })).sort((left, right) => Number(selected.has(right.id)) - Number(selected.has(left.id))
    || left.name.localeCompare(right.name));
}

function validateCliPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return process.platform === 'win32' ? 'CLI path is required on Windows' : null;
  const expanded = expandHomePath(trimmed);
  if (!fs.existsSync(expanded)) return 'Path does not exist';
  return fs.statSync(expanded).isFile() ? null : 'Path must point to a file';
}

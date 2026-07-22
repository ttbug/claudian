import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { ProviderSettingsCoordinator } from '../../../core/providers/ProviderSettingsCoordinator';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import { CommandCodeCliResolver } from '../runtime/CommandCodeCliResolver';
import { CommandCodeModelDiscoveryService } from '../runtime/CommandCodeModelDiscoveryService';
import {
  getCommandCodeProviderSettings,
  normalizeCommandCodeVisibleModels,
  updateCommandCodeProviderSettings,
} from '../settings';
import { commandCodeSettingsTabRenderer } from '../ui/CommandCodeSettingsTab';

export interface CommandCodeWorkspaceServices extends ProviderWorkspaceServices {
  cliResolver: CommandCodeCliResolver;
}

export async function createCommandCodeWorkspaceServices(
  plugin: ProviderHost,
): Promise<CommandCodeWorkspaceServices> {
  const discovery = new CommandCodeModelDiscoveryService(plugin);
  const services: CommandCodeWorkspaceServices = {
    cliResolver: new CommandCodeCliResolver(),
    settingsTabRenderer: commandCodeSettingsTabRenderer,
    refreshModelCatalog: async () => {
      const result = await discovery.discoverModels();
      if (result.kind === 'skipped') return { changed: false };
      if (result.diagnostics) return { changed: false, diagnostics: result.diagnostics };
      if (result.models.length === 0) {
        return { changed: false, diagnostics: 'Command Code returned no models.' };
      }

      let refreshResult = { changed: false, persistedSettingsChanged: false };
      await plugin.mutateSettingsConditionally((settings) => {
        const current = getCommandCodeProviderSettings(settings);
        const visibleModels = normalizeCommandCodeVisibleModels(current.visibleModels, result.models);
        const catalogChanged = JSON.stringify(current.discoveredModels) !== JSON.stringify(result.models);
        const visibilityChanged = JSON.stringify(current.visibleModels) !== JSON.stringify(visibleModels);
        if (catalogChanged || visibilityChanged) {
          updateCommandCodeProviderSettings(settings, {
            discoveredModels: result.models,
            visibleModels,
          });
        }
        const selectionChanged = ProviderSettingsCoordinator.normalizeAllModelVariants(settings);
        refreshResult = {
          changed: catalogChanged || visibilityChanged || selectionChanged,
          persistedSettingsChanged: visibilityChanged || selectionChanged,
        };
        return refreshResult.persistedSettingsChanged;
      });
      return refreshResult;
    },
  };

  return services;
}

export const commandCodeWorkspaceRegistration: ProviderWorkspaceRegistration<CommandCodeWorkspaceServices> = {
  initialize: async ({ plugin }) => createCommandCodeWorkspaceServices(plugin),
};

export function maybeGetCommandCodeWorkspaceServices(): CommandCodeWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('commandcode') as CommandCodeWorkspaceServices | null;
}

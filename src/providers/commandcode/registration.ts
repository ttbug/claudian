import type { ProviderModule } from '../../core/providers/types';
import { commandCodeWorkspaceRegistration } from './app/CommandCodeWorkspaceServices';
import { CommandCodeInlineEditService } from './auxiliary/CommandCodeInlineEditService';
import { CommandCodeInstructionRefineService } from './auxiliary/CommandCodeInstructionRefineService';
import { CommandCodeTaskResultInterpreter } from './auxiliary/CommandCodeTaskResultInterpreter';
import { CommandCodeTitleGenerationService } from './auxiliary/CommandCodeTitleGenerationService';
import { COMMAND_CODE_PROVIDER_CAPABILITIES } from './capabilities';
import { commandCodeSettingsReconciler } from './env/CommandCodeSettingsReconciler';
import { CommandCodeConversationHistoryService } from './history/CommandCodeConversationHistoryService';
import { CommandCodeChatRuntime } from './runtime/CommandCodeChatRuntime';
import { getCommandCodeProviderSettings, updateCommandCodeProviderSettings } from './settings';
import { commandCodeChatUIConfig } from './ui/CommandCodeChatUIConfig';

export const commandCodeProviderRegistration: ProviderModule = {
  id: 'commandcode',
  blankTabOrder: 12,
  capabilities: COMMAND_CODE_PROVIDER_CAPABILITIES,
  chatUIConfig: commandCodeChatUIConfig,
  createInlineEditService: plugin => new CommandCodeInlineEditService(plugin),
  createInstructionRefineService: plugin => new CommandCodeInstructionRefineService(plugin),
  createRuntime: ({ plugin }) => new CommandCodeChatRuntime(plugin),
  createTitleGenerationService: plugin => new CommandCodeTitleGenerationService(plugin),
  displayName: 'Command Code',
  environmentKeyPatterns: [/^COMMANDCODE_/i],
  historyService: new CommandCodeConversationHistoryService(),
  isEnabled: settings => getCommandCodeProviderSettings(settings).enabled,
  setEnabled: (settings, enabled) => updateCommandCodeProviderSettings(settings, { enabled }),
  settingsReconciler: commandCodeSettingsReconciler,
  settingsStorage: {
    hostScopedFields: ['cliPathsByHost'],
    runtimeOnlyFields: ['discoveredModels'],
    normalizeStored(target, stored) {
      updateCommandCodeProviderSettings(target, getCommandCodeProviderSettings(stored));
      return false;
    },
  },
  taskResultInterpreter: new CommandCodeTaskResultInterpreter(),
  workspace: commandCodeWorkspaceRegistration,
};

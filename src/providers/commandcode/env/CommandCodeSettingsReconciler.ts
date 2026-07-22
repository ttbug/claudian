import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { decodeCommandCodeModelId, encodeCommandCodeModelId } from '../models';
import { getCommandCodeProviderSettings, updateCommandCodeProviderSettings } from '../settings';

function invalidateCommandCodeConversationSessions(conversations: Conversation[]): Conversation[] {
  return conversations.filter((conversation) => {
    if (conversation.providerId !== 'commandcode') return false;
    const state = conversation.providerState;
    const hasState = !!conversation.sessionId
      || !!(state && typeof state === 'object' && !Array.isArray(state) && state.sessionId);
    if (!hasState) return false;
    conversation.sessionId = null;
    conversation.providerState = undefined;
    return true;
  });
}

export const commandCodeSettingsReconciler: ProviderSettingsReconciler = {
  handleEnvironmentChange(settings): boolean {
    const current = getCommandCodeProviderSettings(settings);
    if (current.discoveredModels.length === 0) return false;
    updateCommandCodeProviderSettings(settings, { discoveredModels: [] });
    return true;
  },

  invalidateConversationSessions: invalidateCommandCodeConversationSessions,

  reconcileModelWithEnvironment(settings, conversations): {
    changed: boolean;
    invalidatedConversations: Conversation[];
  } {
    if (!getCommandCodeProviderSettings(settings).enabled) {
      return { changed: false, invalidatedConversations: [] };
    }
    const currentHash = getRuntimeEnvironmentText(settings, 'commandcode').trim();
    const savedHash = getCommandCodeProviderSettings(settings).environmentHash;
    if (currentHash === savedHash) return { changed: false, invalidatedConversations: [] };

    const invalidatedConversations = invalidateCommandCodeConversationSessions(conversations);
    updateCommandCodeProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings): boolean {
    let changed = false;
    for (const field of ['model', 'titleGenerationModel'] as const) {
      const value = settings[field];
      if (typeof value !== 'string') continue;
      const raw = decodeCommandCodeModelId(value);
      if (!raw) continue;
      const normalized = encodeCommandCodeModelId(raw);
      if (normalized !== value) {
        settings[field] = normalized;
        changed = true;
      }
    }
    return changed;
  },
};

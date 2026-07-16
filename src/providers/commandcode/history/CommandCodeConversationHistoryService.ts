import * as fs from 'node:fs/promises';

import type {
  ProviderConversationHistoryService,
  ProviderHistoryPathContext,
} from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { resolveCommandCodeSessionFile } from './CommandCodeHistoryPathResolver';
import { parseCommandCodeSessionContent } from './CommandCodeHistoryStore';

type SessionResolver = (
  persistedPath: string | null | undefined,
  sessionId: string | null | undefined,
  vaultPath: string | null,
  context?: ProviderHistoryPathContext,
) => Promise<string | null>;

export class CommandCodeConversationHistoryService implements ProviderConversationHistoryService {
  constructor(
    private readonly resolveSessionFile: SessionResolver = resolveCommandCodeSessionFile,
    private readonly readFile: (path: string) => Promise<string> = path => fs.readFile(path, 'utf8'),
  ) {}

  async hydrateConversationHistory(
    conversation: Conversation,
    vaultPath: string | null,
    pathContext?: ProviderHistoryPathContext,
  ): Promise<void> {
    const state = getState(conversation.providerState);
    const sessionId = state.sessionId ?? conversation.sessionId;
    const sessionFile = await this.resolveSessionFile(state.sessionFile, sessionId, vaultPath, pathContext);
    if (!sessionFile) return;

    try {
      const messages = parseCommandCodeSessionContent(await this.readFile(sessionFile));
      if (messages.length === 0) return;
      conversation.messages = messages;
      conversation.providerState = { sessionId, sessionFile };
    } catch {
      // Preserve locally cached messages when native history cannot be read.
    }
  }

  async deleteConversationSession(
    _conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    // Never mutate Command Code native history.
  }

  resolveSessionIdForConversation(conversation: Conversation | null): string | null {
    const state = getState(conversation?.providerState);
    return state.sessionId ?? conversation?.sessionId ?? null;
  }

  isPendingForkConversation(_conversation: Conversation): boolean {
    return false;
  }

  buildForkProviderState(
    _sourceSessionId: string,
    _resumeAt: string,
    _sourceProviderState?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {};
  }

  buildPersistedProviderState(conversation: Conversation): Record<string, unknown> | undefined {
    const state = getState(conversation.providerState);
    const sessionId = state.sessionId ?? conversation.sessionId;
    if (!sessionId && !state.sessionFile) return undefined;
    return {
      ...(sessionId ? { sessionId } : {}),
      ...(state.sessionFile ? { sessionFile: state.sessionFile } : {}),
    };
  }
}

function getState(value: unknown): { sessionFile?: string; sessionId?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const state = value as Record<string, unknown>;
  return {
    ...(typeof state.sessionFile === 'string' && state.sessionFile ? { sessionFile: state.sessionFile } : {}),
    ...(typeof state.sessionId === 'string' && state.sessionId ? { sessionId: state.sessionId } : {}),
  };
}

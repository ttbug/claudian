import type { Conversation } from '@/core/types';
import { commandCodeSettingsReconciler } from '@/providers/commandcode/env/CommandCodeSettingsReconciler';

describe('commandCodeSettingsReconciler', () => {
  it('invalidates only Command Code conversations with session state', () => {
    const sessionConversation = {
      providerId: 'commandcode',
      sessionId: 'session-1',
      providerState: { sessionId: 'session-1' },
    } as unknown as Conversation;
    const statelessConversation = {
      providerId: 'commandcode',
      sessionId: null,
    } as unknown as Conversation;
    const otherConversation = {
      providerId: 'claude',
      sessionId: 'session-2',
    } as unknown as Conversation;

    const result = commandCodeSettingsReconciler.invalidateConversationSessions([
      sessionConversation,
      statelessConversation,
      otherConversation,
    ]);

    expect(result).toEqual([sessionConversation]);
    expect(sessionConversation.sessionId).toBeNull();
    expect(sessionConversation.providerState).toBeUndefined();
    expect(statelessConversation.sessionId).toBeNull();
    expect(otherConversation.sessionId).toBe('session-2');
  });
});

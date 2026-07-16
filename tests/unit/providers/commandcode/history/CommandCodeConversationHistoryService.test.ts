import type { Conversation } from '@/core/types';
import { CommandCodeConversationHistoryService } from '@/providers/commandcode/history/CommandCodeConversationHistoryService';

function conversation(): Conversation {
  return {
    id: 'conversation-1',
    title: 'Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    providerId: 'commandcode',
    providerState: { sessionId: 'session-1' },
    sessionId: 'session-1',
  } as Conversation;
}

describe('CommandCodeConversationHistoryService', () => {
  it('hydrates a conversation from provider-native JSONL', async () => {
    const service = new CommandCodeConversationHistoryService(
      async () => '/home/.commandcode/projects/vault/session-1.jsonl',
      async () => [
        JSON.stringify({ role: 'user', content: [{ type: 'text', text: 'Hello' }] }),
        JSON.stringify({ role: 'assistant', content: [{ type: 'text', text: 'Hi' }] }),
      ].join('\n'),
    );
    const target = conversation();

    await service.hydrateConversationHistory(target, '/vault', { environment: { HOME: '/home' } });

    expect(target.messages.map(message => [message.role, message.content])).toEqual([
      ['user', 'Hello'],
      ['assistant', 'Hi'],
    ]);
    expect(target.providerState).toEqual({
      sessionFile: '/home/.commandcode/projects/vault/session-1.jsonl',
      sessionId: 'session-1',
    });
  });

  it('never deletes Command Code native history and does not support forks', async () => {
    const service = new CommandCodeConversationHistoryService();
    await expect(service.deleteConversationSession(conversation(), '/vault')).resolves.toBeUndefined();
    expect(service.isPendingForkConversation(conversation())).toBe(false);
    expect(service.buildForkProviderState('session-1', 'message-1')).toEqual({});
  });
});

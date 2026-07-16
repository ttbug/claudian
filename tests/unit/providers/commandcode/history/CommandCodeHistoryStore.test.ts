import { parseCommandCodeSessionContent } from '@/providers/commandcode/history/CommandCodeHistoryStore';

describe('CommandCodeHistoryStore', () => {
  it('parses text, reasoning, tool calls, and tool results', () => {
    const content = [
      JSON.stringify({
        id: 'u1',
        role: 'user',
        sessionId: 'session-1',
        timestamp: '2026-07-15T08:00:00.000Z',
        content: [{ type: 'text', text: 'Inspect the file' }],
      }),
      JSON.stringify({
        id: 'a1',
        parentId: 'u1',
        role: 'assistant',
        sessionId: 'session-1',
        timestamp: '2026-07-15T08:00:01.000Z',
        content: [
          { type: 'reasoning', text: 'I should read it.' },
          { type: 'tool-call', toolCallId: 'tool-1', toolName: 'read', input: { path: 'a.md' } },
        ],
      }),
      JSON.stringify({
        id: 't1',
        parentId: 'a1',
        role: 'tool',
        sessionId: 'session-1',
        timestamp: '2026-07-15T08:00:02.000Z',
        content: [{
          type: 'tool-result',
          toolCallId: 'tool-1',
          toolName: 'read',
          output: { type: 'text', value: 'contents' },
        }],
      }),
      JSON.stringify({
        id: 'a2',
        parentId: 't1',
        role: 'assistant',
        sessionId: 'session-1',
        timestamp: '2026-07-15T08:00:03.000Z',
        content: [{ type: 'text', text: 'Done.' }],
      }),
      'not-json',
    ].join('\n');

    expect(parseCommandCodeSessionContent(content)).toEqual([
      expect.objectContaining({
        content: 'Inspect the file',
        id: 'u1',
        role: 'user',
        userMessageId: 'u1',
      }),
      expect.objectContaining({
        assistantMessageId: 'a1',
        content: 'Done.',
        contentBlocks: [
          { type: 'thinking', content: 'I should read it.' },
          { type: 'tool_use', toolId: 'tool-1' },
          { type: 'text', content: 'Done.' },
        ],
        id: 'a1',
        role: 'assistant',
        toolCalls: [{
          id: 'tool-1',
          input: { path: 'a.md' },
          name: 'read',
          result: 'contents',
          status: 'completed',
        }],
      }),
    ]);
  });
});


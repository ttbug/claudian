import type { ChatMessage, ToolCallInfo } from '../../../core/types';

type JsonRecord = Record<string, unknown>;

export function parseCommandCodeSessionContent(content: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let activeAssistant: ChatMessage | null = null;

  for (const line of content.split(/\r?\n/)) {
    const entry = parseRecord(line);
    if (!entry) {
      continue;
    }

    const role = entry.role;
    if (role === 'user') {
      const text = extractText(entry.content);
      if (!text) {
        continue;
      }
      const id = stringValue(entry.id) ?? crypto.randomUUID();
      messages.push({
        id,
        role: 'user',
        content: text,
        timestamp: parseTimestamp(entry.timestamp),
        userMessageId: id,
      });
      activeAssistant = null;
      continue;
    }

    if (role === 'assistant') {
      const blocks = arrayValue(entry.content);
      if (!activeAssistant) {
        const id = stringValue(entry.id) ?? crypto.randomUUID();
        activeAssistant = {
          id,
          role: 'assistant',
          content: '',
          timestamp: parseTimestamp(entry.timestamp),
          assistantMessageId: id,
          contentBlocks: [],
          toolCalls: [],
        };
        messages.push(activeAssistant);
      }
      appendAssistantBlocks(activeAssistant, blocks);
      continue;
    }

    if (role === 'tool' && activeAssistant) {
      attachToolResults(activeAssistant, arrayValue(entry.content));
    }
  }

  return messages.map(message => ({
    ...message,
    ...(message.contentBlocks?.length ? {} : { contentBlocks: undefined }),
    ...(message.toolCalls?.length ? {} : { toolCalls: undefined }),
  }));
}

function appendAssistantBlocks(message: ChatMessage, blocks: unknown[]): void {
  for (const value of blocks) {
    const block = asRecord(value);
    if (!block) {
      continue;
    }
    const type = stringValue(block.type);
    if (type === 'text') {
      const text = stringValue(block.text);
      if (!text) continue;
      message.content += text;
      message.contentBlocks!.push({ type: 'text', content: text });
    } else if (type === 'reasoning') {
      const text = stringValue(block.text);
      if (text) message.contentBlocks!.push({ type: 'thinking', content: text });
    } else if (type === 'tool-call') {
      const id = stringValue(block.toolCallId);
      const name = stringValue(block.toolName);
      if (!id || !name) continue;
      const toolCall: ToolCallInfo = {
        id,
        name,
        input: asRecord(block.input) ?? {},
        status: 'running',
      };
      message.toolCalls!.push(toolCall);
      message.contentBlocks!.push({ type: 'tool_use', toolId: id });
    }
  }
}

function attachToolResults(message: ChatMessage, blocks: unknown[]): void {
  for (const value of blocks) {
    const block = asRecord(value);
    if (!block || block.type !== 'tool-result') continue;
    const id = stringValue(block.toolCallId);
    const toolCall = message.toolCalls?.find(call => call.id === id);
    if (!toolCall) continue;
    const output = asRecord(block.output);
    const result = output ? stringValue(output.value) ?? JSON.stringify(output.value) : stringValue(block.output);
    toolCall.result = result ?? '';
    toolCall.status = output?.type === 'error' || block.isError === true ? 'error' : 'completed';
  }
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  return arrayValue(value)
    .map(block => asRecord(block))
    .filter((block): block is JsonRecord => block?.type === 'text')
    .map(block => stringValue(block.text) ?? '')
    .join('');
}

function parseRecord(line: string): JsonRecord | null {
  try {
    return asRecord(JSON.parse(line));
  } catch {
    return null;
  }
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return Date.now();
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

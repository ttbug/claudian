import { buildSystemPrompt } from '../../../core/prompt/mainAgent';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type {
  ApprovalCallback,
  AskUserQuestionCallback,
  AutoTurnCallback,
  ChatRewindMode,
  ChatRewindResult,
  ChatRuntimeConversationState,
  ChatRuntimeEnsureReadyOptions,
  ChatRuntimeQueryOptions,
  ChatTurnMetadata,
  ChatTurnRequest,
  ExitPlanModeCallback,
  PreparedChatTurn,
  SessionUpdateResult,
} from '../../../core/runtime/types';
import type { ChatMessage, Conversation, SlashCommand, StreamChunk } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { COMMAND_CODE_PROVIDER_CAPABILITIES } from '../capabilities';
import { getCommandCodeProviderSettings } from '../settings';
import { buildCommandCodePrompt } from './buildCommandCodePrompt';
import { buildCommandCodeLaunchSpec } from './CommandCodeLaunchSpec';
import { CommandCodeProcess } from './CommandCodeProcess';

class ChunkQueue {
  private closed = false;
  private readonly chunks: StreamChunk[] = [];
  private readonly waiters: Array<(chunk: StreamChunk | null) => void> = [];

  push(chunk: StreamChunk): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter(chunk);
    else this.chunks.push(chunk);
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length > 0) this.waiters.shift()?.(null);
  }

  next(): Promise<StreamChunk | null> {
    if (this.chunks.length > 0) return Promise.resolve(this.chunks.shift() ?? null);
    if (this.closed) return Promise.resolve(null);
    return new Promise(resolve => this.waiters.push(resolve));
  }
}

export class CommandCodeChatRuntime implements ChatRuntime {
  readonly providerId = 'commandcode' as const;
  private activeProcess: CommandCodeProcess | null = null;
  private activeQueue: ChunkQueue | null = null;
  private currentModel: string | null = null;
  private currentTurnMetadata: ChatTurnMetadata = {};
  private ready = false;
  private readonly readyListeners = new Set<(ready: boolean) => void>();
  private sessionId: string | null = null;
  private sessionInvalidated = false;

  constructor(private readonly plugin: ProviderHost) {}

  getCapabilities(): Readonly<ProviderCapabilities> {
    return COMMAND_CODE_PROVIDER_CAPABILITIES;
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    return {
      isCompact: false,
      mcpMentions: new Set(),
      persistedContent: request.text,
      prompt: buildCommandCodePrompt(request),
      request,
    };
  }

  onReadyStateChange(listener: (ready: boolean) => void): () => void {
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  setResumeCheckpoint(_checkpointId: string | undefined): void {}

  syncConversationState(conversation: ChatRuntimeConversationState | null): void {
    this.sessionId = conversation?.sessionId ?? stringValue(conversation?.providerState?.sessionId);
    this.currentModel = stringValue(conversation?.selectedModel);
  }

  async reloadMcpServers(): Promise<void> {}

  async ensureReady(_options?: ChatRuntimeEnsureReadyOptions): Promise<boolean> {
    const enabled = getCommandCodeProviderSettings(this.plugin.settings).enabled;
    const ready = enabled && Boolean(await this.plugin.getResolvedProviderCliPath('commandcode'));
    this.setReady(ready);
    return ready;
  }

  async *query(
    turn: PreparedChatTurn,
    conversationHistory: ChatMessage[] = [],
    queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!await this.ensureReady()) {
      yield { type: 'error', content: 'Failed to start Command Code. Check the CLI path and login state.' };
      yield { type: 'done' };
      return;
    }

    const settings = this.getProviderSettings(queryOptions?.model);
    const command = (await this.plugin.getResolvedProviderCliPath('commandcode'))!;
    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const launchSpec = buildCommandCodeLaunchSpec({
      command,
      cwd,
      model: queryOptions?.model ?? this.currentModel ?? stringValue(settings.model) ?? undefined,
      permissionMode: stringValue(settings.permissionMode) ?? undefined,
      sessionId: this.sessionId,
    });
    const customEnv = parseEnvironmentVariables(getCommandCodeProviderSettings(settings).environmentVariables);
    const proc = new CommandCodeProcess(launchSpec, { ...process.env, ...customEnv });
    const queue = new ChunkQueue();
    let stderr = '';
    this.activeProcess = proc;
    this.activeQueue = queue;

    proc.onStdout(text => queue.push({ type: 'text', content: text }));
    proc.onStderr((text) => {
      stderr += text;
      const sessionId = parseSessionId(stderr);
      if (sessionId) this.sessionId = sessionId;
    });
    proc.onClose((code, signal, error) => {
      if (this.activeProcess !== proc) return;
      if (code !== 0 || signal || error) {
        queue.push({ type: 'error', content: formatProcessError(code, stderr, error) });
      }
      queue.push({ type: 'done' });
      queue.close();
      this.activeProcess = null;
      this.activeQueue = null;
    });

    proc.start();
    const systemPrompt = buildSystemPrompt({
      customPrompt: this.plugin.settings.systemPrompt,
      mediaFolder: this.plugin.settings.mediaFolder,
      userName: this.plugin.settings.userName,
      vaultPath: cwd,
    });
    proc.writePrompt(`${systemPrompt}\n\n${buildCommandCodePrompt(turn.request, conversationHistory)}`);
    this.currentTurnMetadata = { wasSent: true };
    yield { type: 'user_message_start', content: turn.persistedContent };

    try {
      while (true) {
        const chunk = await queue.next();
        if (!chunk) return;
        yield chunk;
        if (chunk.type === 'done') return;
      }
    } finally {
      if (this.activeProcess === proc) {
        this.activeProcess = null;
        this.activeQueue = null;
        queue.close();
        await proc.shutdown().catch(() => {});
      }
    }
  }

  cancel(): void {
    const proc = this.activeProcess;
    const queue = this.activeQueue;
    this.activeProcess = null;
    this.activeQueue = null;
    if (proc) void proc.shutdown().catch(() => {});
    if (queue) {
      queue.push({ type: 'done' });
      queue.close();
    }
  }

  resetSession(): void {
    this.cancel();
    this.sessionId = null;
    this.sessionInvalidated = true;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  consumeSessionInvalidation(): boolean {
    const invalidated = this.sessionInvalidated;
    this.sessionInvalidated = false;
    return invalidated;
  }

  isReady(): boolean {
    return this.ready;
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    return [];
  }

  getAuxiliaryModel(): string | null {
    return this.currentModel;
  }

  cleanup(): void {
    this.cancel();
    this.setReady(false);
  }

  async rewind(
    _userMessageId: string,
    _assistantMessageId: string | undefined,
    _mode?: ChatRewindMode,
  ): Promise<ChatRewindResult> {
    return { canRewind: false };
  }

  setApprovalCallback(_callback: ApprovalCallback | null): void {}
  setApprovalDismisser(_dismisser: (() => void) | null): void {}
  setAskUserQuestionCallback(_callback: AskUserQuestionCallback | null): void {}
  setExitPlanModeCallback(_callback: ExitPlanModeCallback | null): void {}
  setPermissionModeSyncCallback(_callback: ((sdkMode: string) => void) | null): void {}
  setAutoTurnCallback(_callback: AutoTurnCallback | null): void {}

  consumeTurnMetadata(): ChatTurnMetadata {
    const metadata = this.currentTurnMetadata;
    this.currentTurnMetadata = {};
    return metadata;
  }

  buildSessionUpdates(params: {
    conversation: Conversation | null;
    sessionInvalidated: boolean;
  }): SessionUpdateResult {
    if (params.sessionInvalidated && !this.sessionId) {
      return { updates: { providerState: undefined, sessionId: null } };
    }
    return {
      updates: {
        providerState: this.sessionId ? { sessionId: this.sessionId } : undefined,
        sessionId: this.sessionId,
      },
    };
  }

  resolveSessionIdForFork(_conversation: Conversation | null): string | null {
    return null;
  }

  private getProviderSettings(model?: string): Record<string, unknown> {
    return model ? { ...this.plugin.settings, model } : this.plugin.settings;
  }

  private setReady(ready: boolean): void {
    if (this.ready === ready) return;
    this.ready = ready;
    for (const listener of this.readyListeners) listener(ready);
  }
}

function parseSessionId(stderr: string): string | null {
  return stderr.match(/(?:^|\n)session:\s*([\w-]+)/i)?.[1] ?? null;
}

function formatProcessError(code: number | null, stderr: string, error?: Error): string {
  if (code === 3) return 'Command Code is not authenticated.';
  if (code === 4) return 'Command Code denied the requested operation.';
  if (code === 5) return 'Command Code rate limit exceeded.';
  if (code === 6) return 'Command Code could not connect to the provider.';
  if (code === 7) return 'Command Code provider service failed.';
  if (code === 8) return 'Command Code reached the maximum turn limit.';
  return stderr.trim() || error?.message || `Command Code exited with code ${code ?? 'unknown'}.`;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

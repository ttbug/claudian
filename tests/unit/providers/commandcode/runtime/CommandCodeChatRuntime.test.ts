const processInstances: MockCommandCodeProcess[] = [];

class MockCommandCodeProcess {
  readonly start = jest.fn();
  readonly writePrompt = jest.fn();
  readonly shutdown = jest.fn(async () => {});
  private stdoutHandler: ((text: string) => void) | null = null;
  private stderrHandler: ((text: string) => void) | null = null;
  private closeHandler: ((code: number | null, signal: string | null, error?: Error) => void) | null = null;

  constructor(readonly launchSpec: unknown) {
    processInstances.push(this);
  }

  onStdout(handler: (text: string) => void): void {
    this.stdoutHandler = handler;
  }

  onStderr(handler: (text: string) => void): void {
    this.stderrHandler = handler;
  }

  onClose(handler: (code: number | null, signal: string | null, error?: Error) => void): void {
    this.closeHandler = handler;
  }

  emitStdout(text: string): void {
    this.stdoutHandler?.(text);
  }

  emitStderr(text: string): void {
    this.stderrHandler?.(text);
  }

  close(code = 0, signal: string | null = null, error?: Error): void {
    this.closeHandler?.(code, signal, error);
  }
}

jest.mock('@/providers/commandcode/runtime/CommandCodeProcess', () => ({
  CommandCodeProcess: MockCommandCodeProcess,
}));

import { CommandCodeChatRuntime } from '@/providers/commandcode/runtime/CommandCodeChatRuntime';

function createPlugin(): any {
  return {
    app: { vault: { adapter: { basePath: '/vault' } } },
    getResolvedProviderCliPath: jest.fn(() => '/bin/cmd'),
    settings: {
      model: 'commandcode/gpt-5.6-sol',
      permissionMode: 'plan',
      providerConfigs: {
        commandcode: {
          enabled: true,
        },
      },
    },
  };
}

describe('CommandCodeChatRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    processInstances.length = 0;
  });

  it('streams stdout and captures the verbose session id', async () => {
    const runtime = new CommandCodeChatRuntime(createPlugin());
    runtime.syncConversationState({ sessionId: 'session-1', selectedModel: 'commandcode/gpt-5.6-sol' });
    const iterator = runtime.query(runtime.prepareTurn({ text: 'Hello' }));

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'user_message_start', content: 'Hello' },
    });
    expect(processInstances[0].launchSpec).toEqual({
      args: [
        '-p', '--verbose', '--skip-onboarding', '--trust',
        '--model', 'gpt-5.6-sol', '--resume', 'session-1', '--plan',
      ],
      command: '/bin/cmd',
      cwd: '/vault',
    });
    expect(processInstances[0].writePrompt).toHaveBeenCalledWith(expect.stringContaining('Hello'));

    const textChunk = iterator.next();
    processInstances[0].emitStdout('Hi there');
    await expect(textChunk).resolves.toEqual({
      done: false,
      value: { type: 'text', content: 'Hi there' },
    });

    const doneChunk = iterator.next();
    processInstances[0].emitStderr('session: session-2\n');
    processInstances[0].close();
    await expect(doneChunk).resolves.toEqual({ done: false, value: { type: 'done' } });
    expect(runtime.getSessionId()).toBe('session-2');
  });

  it('maps a failed process into an error and done', async () => {
    const runtime = new CommandCodeChatRuntime(createPlugin());
    const iterator = runtime.query(runtime.prepareTurn({ text: 'Hello' }));

    await iterator.next();
    const errorChunk = iterator.next();
    processInstances[0].emitStderr('Not authenticated');
    processInstances[0].close(3);

    await expect(errorChunk).resolves.toEqual({
      done: false,
      value: { type: 'error', content: 'Command Code is not authenticated.' },
    });
    await expect(iterator.next()).resolves.toEqual({ done: false, value: { type: 'done' } });
  });

  it('stops the active subprocess when cancelled', async () => {
    const runtime = new CommandCodeChatRuntime(createPlugin());
    const iterator = runtime.query(runtime.prepareTurn({ text: 'Hello' }));
    await iterator.next();

    runtime.cancel();

    expect(processInstances[0].shutdown).toHaveBeenCalledTimes(1);
    await expect(iterator.next()).resolves.toEqual({ done: false, value: { type: 'done' } });
  });
});


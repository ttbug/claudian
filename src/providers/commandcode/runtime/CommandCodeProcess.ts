import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as path from 'node:path';

import { getEnhancedPath } from '../../../utils/env';
import { resolveWindowsCmdShimSpawnSpec, terminateSpawnedProcess } from '../../../utils/windowsCmdShim';
import type { CommandCodeLaunchSpec } from './CommandCodeLaunchSpec';

type CloseHandler = (code: number | null, signal: string | null, error?: Error) => void;

export class CommandCodeProcess {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private closeError: Error | undefined;
  private closeNotified = false;
  private readonly stdoutHandlers = new Set<(text: string) => void>();
  private readonly stderrHandlers = new Set<(text: string) => void>();
  private readonly closeHandlers = new Set<CloseHandler>();
  private spawnSpec: ReturnType<typeof resolveWindowsCmdShimSpawnSpec> | null = null;

  constructor(
    private readonly launchSpec: CommandCodeLaunchSpec,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  start(): void {
    if (this.proc) return;
    this.spawnSpec = resolveWindowsCmdShimSpawnSpec(this.launchSpec);
    const proc = spawn(this.spawnSpec.command, this.spawnSpec.args, {
      cwd: this.launchSpec.cwd,
      env: {
        ...this.env,
        PATH: getEnhancedPath(
          this.env.PATH,
          path.isAbsolute(this.launchSpec.command) ? this.launchSpec.command : undefined,
        ),
      },
      stdio: 'pipe',
      windowsHide: true,
      ...(this.spawnSpec.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
    });
    proc.stdout.on('data', (chunk: Buffer) => this.emit(this.stdoutHandlers, chunk));
    proc.stderr.on('data', (chunk: Buffer) => this.emit(this.stderrHandlers, chunk));
    proc.on('error', (error) => {
      this.closeError = error;
      this.notifyClose(null, null, error);
    });
    proc.on('exit', (code, signal) => {
      this.notifyClose(code, signal, this.closeError);
    });
    this.proc = proc;
  }

  writePrompt(prompt: string): void {
    if (!this.proc) throw new Error('Command Code process is not started');
    this.proc.stdin.end(prompt);
  }

  onStdout(handler: (text: string) => void): void {
    this.stdoutHandlers.add(handler);
  }

  onStderr(handler: (text: string) => void): void {
    this.stderrHandlers.add(handler);
  }

  onClose(handler: CloseHandler): void {
    this.closeHandlers.add(handler);
  }

  async shutdown(): Promise<void> {
    if (!this.proc || this.proc.exitCode !== null) return;
    terminateSpawnedProcess(this.proc, 'SIGTERM', spawn, this.spawnSpec ?? undefined);
  }

  private emit(handlers: Set<(text: string) => void>, chunk: Buffer | string): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    for (const handler of handlers) handler(text);
  }

  private notifyClose(code: number | null, signal: string | null, error?: Error): void {
    if (this.closeNotified) return;
    this.closeNotified = true;
    for (const handler of this.closeHandlers) handler(code, signal, error);
  }
}

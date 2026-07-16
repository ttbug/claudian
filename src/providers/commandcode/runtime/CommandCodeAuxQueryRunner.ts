import type { AuxQueryConfig, AuxQueryRunner } from '../../../core/auxiliary/AuxQueryRunner';
import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { buildCommandCodeLaunchSpec } from './CommandCodeLaunchSpec';
import { CommandCodeProcess } from './CommandCodeProcess';

export class CommandCodeAuxQueryRunner implements AuxQueryRunner {
  private activeProcess: CommandCodeProcess | null = null;
  private sessionId: string | null = null;

  constructor(private readonly plugin: ProviderHost) {}

  async query(config: AuxQueryConfig, prompt: string): Promise<string> {
    const command = this.plugin.getResolvedProviderCliPath('commandcode');
    if (!command) throw new Error('Command Code CLI was not found.');

    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const envText = getRuntimeEnvironmentText(this.plugin.settings, 'commandcode');
    const proc = new CommandCodeProcess(buildCommandCodeLaunchSpec({
      command,
      cwd,
      model: config.model,
      permissionMode: 'standard',
      sessionId: this.sessionId,
    }), { ...process.env, ...parseEnvironmentVariables(envText) });
    this.activeProcess = proc;

    let accumulated = '';
    let stderr = '';
    const abortHandler = () => void proc.shutdown().catch(() => {});
    config.abortController?.signal.addEventListener('abort', abortHandler, { once: true });

    try {
      const result = await new Promise<string>((resolve, reject) => {
        proc.onStdout((text) => {
          accumulated += text;
          config.onTextChunk?.(accumulated);
        });
        proc.onStderr((text) => {
          stderr += text;
          const sessionId = stderr.match(/(?:^|\n)session:\s*([\w-]+)/i)?.[1];
          if (sessionId) this.sessionId = sessionId;
        });
        proc.onClose((code, signal, error) => {
          if (config.abortController?.signal.aborted) {
            reject(new Error('Cancelled'));
          } else if (code !== 0 || signal || error) {
            reject(new Error(stderr.trim() || error?.message || `Command Code exited with code ${code ?? 'unknown'}.`));
          } else {
            resolve(accumulated);
          }
        });
        proc.start();
        proc.writePrompt(`${config.systemPrompt}\n\n${prompt}`);
      });
      return result;
    } finally {
      config.abortController?.signal.removeEventListener('abort', abortHandler);
      if (this.activeProcess === proc) this.activeProcess = null;
    }
  }

  reset(): void {
    const proc = this.activeProcess;
    this.activeProcess = null;
    this.sessionId = null;
    if (proc) void proc.shutdown().catch(() => {});
  }
}

import { execFile } from 'node:child_process';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { type CommandCodeModel,parseCommandCodeModelList } from '../models';
import { getCommandCodeProviderSettings } from '../settings';

interface RunOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

type CommandRunner = (
  command: string,
  args: string[],
  options: RunOptions,
) => Promise<{ stderr: string; stdout: string }>;

export type CommandCodeModelDiscoveryResult =
  | { kind: 'completed'; diagnostics?: string; models: CommandCodeModel[] }
  | { kind: 'skipped'; reason: 'provider-disabled' };

export class CommandCodeModelDiscoveryService {
  constructor(
    private readonly plugin: ProviderHost,
    private readonly run: CommandRunner = runCommand,
  ) {}

  async discoverModels(): Promise<CommandCodeModelDiscoveryResult> {
    if (!getCommandCodeProviderSettings(this.plugin.settings).enabled) {
      return { kind: 'skipped', reason: 'provider-disabled' };
    }

    const command = await this.plugin.getResolvedProviderCliPath('commandcode');
    if (!command) {
      return { kind: 'completed', diagnostics: 'Command Code CLI was not found.', models: [] };
    }

    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const envText = getRuntimeEnvironmentText(this.plugin.settings, 'commandcode');
    const customEnv = parseEnvironmentVariables(envText);
    try {
      const result = await this.run(command, ['--list-models'], {
        cwd,
        env: {
          ...process.env,
          ...customEnv,
          PATH: getEnhancedPath(customEnv.PATH, command),
        },
      });
      return { kind: 'completed', models: parseCommandCodeModelList(result.stdout) };
    } catch (error) {
      return {
        kind: 'completed',
        diagnostics: error instanceof Error ? error.message : 'Command Code model discovery failed.',
        models: [],
      };
    }
  }
}

function runCommand(command: string, args: string[], options: RunOptions): Promise<{ stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { ...options, encoding: 'utf8', windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message, { cause: error }));
        return;
      }
      resolve({ stderr, stdout });
    });
  });
}

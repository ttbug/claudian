import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { findCliBinaryPath, resolveConfiguredCliPath } from '../../../utils/cliBinaryLocator';
import { getHostnameKey, parseEnvironmentVariables } from '../../../utils/env';
import { getCommandCodeProviderSettings } from '../settings';

interface CommandCodeCliResolverOptions {
  findBinary: typeof findCliBinaryPath;
  hostname: string;
  platform: NodeJS.Platform;
  resolveConfigured: typeof resolveConfiguredCliPath;
}

export class CommandCodeCliResolver {
  private lastKey = '';
  private resolvedPath: string | null = null;
  private readonly options: CommandCodeCliResolverOptions;

  constructor(options?: CommandCodeCliResolverOptions) {
    this.options = options ?? {
      findBinary: findCliBinaryPath,
      hostname: getHostnameKey(),
      platform: process.platform,
      resolveConfigured: resolveConfiguredCliPath,
    };
  }

  resolveFromSettings(settings: Record<string, unknown>): string | null {
    const commandCodeSettings = getCommandCodeProviderSettings(settings);
    const envText = getRuntimeEnvironmentText(settings, 'commandcode');
    const key = JSON.stringify([
      commandCodeSettings.cliPath,
      commandCodeSettings.cliPathsByHost[this.options.hostname] ?? '',
      envText,
    ]);
    if (key === this.lastKey) return this.resolvedPath;

    this.lastKey = key;
    this.resolvedPath = this.resolve(
      commandCodeSettings.cliPathsByHost,
      commandCodeSettings.cliPath,
      envText,
    );
    return this.resolvedPath;
  }

  resolve(hostnamePaths: Record<string, string> | undefined, legacyPath: string, envText = ''): string | null {
    const configured = this.options.resolveConfigured(hostnamePaths?.[this.options.hostname] ?? '')
      ?? this.options.resolveConfigured(legacyPath.trim());
    if (configured || this.options.platform === 'win32') return configured;

    const customEnv = parseEnvironmentVariables(envText);
    return this.options.findBinary('cmd', customEnv.PATH);
  }

  reset(): void {
    this.lastKey = '';
    this.resolvedPath = null;
  }
}

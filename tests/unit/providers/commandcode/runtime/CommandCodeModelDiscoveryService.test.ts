import { CommandCodeModelDiscoveryService } from '@/providers/commandcode/runtime/CommandCodeModelDiscoveryService';

describe('CommandCodeModelDiscoveryService', () => {
  it('skips discovery while the provider is disabled', async () => {
    const run = jest.fn();
    const service = new CommandCodeModelDiscoveryService({
      app: {},
      settings: { providerConfigs: { commandcode: { enabled: false } } },
    } as any, run);

    await expect(service.discoverModels()).resolves.toEqual({
      kind: 'skipped',
      reason: 'provider-disabled',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('parses the CLI model catalog', async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = '/usr/bin:/bin';
    const run = jest.fn(async () => ({
      stderr: '',
      stdout: 'Available models\nOpenAI\ngpt-5.6-sol  Coding model (default)\n',
    }));
    const plugin = {
      app: { vault: { adapter: { basePath: '/vault' } } },
      getResolvedProviderCliPath: jest.fn(() => '/opt/homebrew/bin/cmd'),
      settings: { providerConfigs: { commandcode: { enabled: true } } },
    } as any;
    const service = new CommandCodeModelDiscoveryService(plugin, run);

    try {
      await expect(service.discoverModels()).resolves.toEqual({
        kind: 'completed',
        models: [{
          description: 'Coding model',
          group: 'OpenAI',
          id: 'gpt-5.6-sol',
          isDefault: true,
          label: 'GPT-5.6 Sol',
        }],
      });
      expect(run).toHaveBeenCalledWith(
        '/opt/homebrew/bin/cmd',
        ['--list-models'],
        expect.objectContaining({
          cwd: '/vault',
          env: expect.objectContaining({ PATH: expect.stringContaining('/opt/homebrew/bin') }),
        }),
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

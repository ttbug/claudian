import {
  DEFAULT_COMMAND_CODE_PROVIDER_SETTINGS,
  getCommandCodeProviderSettings,
  updateCommandCodeProviderSettings,
} from '@/providers/commandcode/settings';

describe('Command Code settings', () => {
  it('defaults to disabled with all discovered models visible', () => {
    expect(DEFAULT_COMMAND_CODE_PROVIDER_SETTINGS).toMatchObject({
      enabled: false,
      visibleModels: null,
    });
  });

  it('normalizes provider-owned settings without touching other providers', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: { codex: { enabled: true } },
    };

    updateCommandCodeProviderSettings(settings, {
      enabled: true,
      visibleModels: ['gpt-5.6-sol', 'gpt-5.6-sol', 'missing'],
      discoveredModels: [{
        description: 'frontier',
        group: 'OpenAI',
        id: 'gpt-5.6-sol',
        isDefault: true,
        label: 'GPT-5.6 Sol',
      }],
    });

    expect(getCommandCodeProviderSettings(settings)).toMatchObject({
      enabled: true,
      visibleModels: ['gpt-5.6-sol'],
    });
    expect((settings.providerConfigs as any).codex).toEqual({ enabled: true });
  });
});


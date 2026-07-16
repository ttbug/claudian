import { commandCodeChatUIConfig } from '@/providers/commandcode/ui/CommandCodeChatUIConfig';

const settings: Record<string, unknown> = {
  providerConfigs: {
    commandcode: {
      discoveredModels: [
        {
          description: 'OpenAI coding model',
          group: 'OpenAI',
          id: 'gpt-5.6-sol',
          isDefault: true,
          label: 'GPT-5.6 Sol',
        },
        {
          description: 'Anthropic model',
          group: 'Anthropic',
          id: 'claude-sonnet-4-5',
          isDefault: false,
          label: 'Claude Sonnet 4 5',
        },
      ],
      modelAliases: { 'gpt-5.6-sol': 'GPT Latest' },
      visibleModels: ['gpt-5.6-sol'],
    },
  },
};

describe('CommandCodeChatUIConfig', () => {
  it('exposes encoded visible models and owns only its namespace', () => {
    expect(commandCodeChatUIConfig.getModelOptions(settings)).toEqual([
      {
        description: 'OpenAI coding model',
        group: 'OpenAI',
        label: 'GPT Latest',
        value: 'commandcode/gpt-5.6-sol',
      },
    ]);
    expect(commandCodeChatUIConfig.ownsModel('commandcode/gpt-5.6-sol', settings)).toBe(true);
    expect(commandCodeChatUIConfig.ownsModel('gpt-5.6-sol', settings)).toBe(false);
  });

  it('uses the discovered default and maps all three permission modes', () => {
    expect(commandCodeChatUIConfig.getDefaultModel?.(settings)).toBe('commandcode/gpt-5.6-sol');
    expect(commandCodeChatUIConfig.getPermissionModeToggle?.()).toEqual({
      inactiveValue: 'standard',
      inactiveLabel: 'Safe',
      activeValue: 'auto-accept',
      activeLabel: 'YOLO',
      planValue: 'plan',
      planLabel: 'Plan',
    });

    const mutable = structuredClone(settings);
    commandCodeChatUIConfig.applyPermissionMode?.('plan', mutable);
    expect(mutable.permissionMode).toBe('plan');
    expect(commandCodeChatUIConfig.resolvePermissionMode?.(mutable)).toBe('plan');
  });

  it('keeps an existing hidden session model available', () => {
    expect(commandCodeChatUIConfig.getModelOptions({
      ...settings,
      savedProviderModel: { commandcode: 'commandcode/claude-sonnet-4-5' },
    })).toEqual([
      expect.objectContaining({ value: 'commandcode/gpt-5.6-sol' }),
      expect.objectContaining({ value: 'commandcode/claude-sonnet-4-5' }),
    ]);
  });
});

import {
  decodeCommandCodeModelId,
  encodeCommandCodeModelId,
  parseCommandCodeModelList,
} from '@/providers/commandcode/models';

describe('Command Code models', () => {
  it('parses grouped CLI model output and keeps the default marker', () => {
    const models = parseCommandCodeModelList(`
Available models  ·  3 models

Open Source

deepseek/deepseek-v4-flash  fast reasoning (default)
moonshotai/Kimi-K2.7-Code   long-horizon coding with vision

OpenAI

gpt-5.6-sol                 frontier model

Pass the full id, or just the short name after the last "/":
cmd --model kimi-k2.7-code
`);

    expect(models).toEqual([
      {
        description: 'fast reasoning',
        group: 'Open Source',
        id: 'deepseek/deepseek-v4-flash',
        isDefault: true,
        label: 'DeepSeek V4 Flash',
      },
      {
        description: 'long-horizon coding with vision',
        group: 'Open Source',
        id: 'moonshotai/Kimi-K2.7-Code',
        isDefault: false,
        label: 'Kimi K2.7 Code',
      },
      {
        description: 'frontier model',
        group: 'OpenAI',
        id: 'gpt-5.6-sol',
        isDefault: false,
        label: 'GPT-5.6 Sol',
      },
    ]);
  });

  it('namespaces overlapping model ids for provider routing', () => {
    expect(encodeCommandCodeModelId('gpt-5.6-sol')).toBe('commandcode/gpt-5.6-sol');
    expect(decodeCommandCodeModelId('commandcode/gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(decodeCommandCodeModelId('gpt-5.6-sol')).toBeNull();
  });
});


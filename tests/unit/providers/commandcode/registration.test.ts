import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { commandCodeProviderRegistration } from '@/providers/commandcode/registration';

describe('Command Code provider registration', () => {
  it('registers metadata, enablement, and model ownership', () => {
    const settings = { providerConfigs: { commandcode: { enabled: true } } };

    expect(commandCodeProviderRegistration.displayName).toBe('Command Code');
    expect(commandCodeProviderRegistration.isEnabled(settings)).toBe(true);
    expect(ProviderRegistry.resolveProviderForModel('commandcode/gpt-5.6-sol', settings)).toBe('commandcode');
    expect(ProviderRegistry.resolveProviderForModel('gpt-5.6-sol', settings)).not.toBe('commandcode');
  });
});

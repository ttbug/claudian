const mockDiscoverModels = jest.fn();

jest.mock('@/providers/commandcode/runtime/CommandCodeModelDiscoveryService', () => ({
  CommandCodeModelDiscoveryService: jest.fn().mockImplementation(() => ({
    discoverModels: mockDiscoverModels,
  })),
}));

import { createCommandCodeWorkspaceServices } from '@/providers/commandcode/app/CommandCodeWorkspaceServices';

describe('CommandCodeWorkspaceServices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDiscoverModels.mockResolvedValue({
      diagnostics: 'Command Code CLI was not found.',
      kind: 'completed',
      models: [],
    });
  });

  it('defers model discovery during workspace initialization', async () => {
    const plugin = {
      settings: { providerConfigs: { commandcode: { enabled: true } } },
    } as any;

    const services = await createCommandCodeWorkspaceServices(plugin);

    expect(mockDiscoverModels).not.toHaveBeenCalled();
    await services.refreshModelCatalog!();
    expect(mockDiscoverModels).toHaveBeenCalledTimes(1);
  });
});

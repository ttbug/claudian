import { CommandCodeCliResolver } from '@/providers/commandcode/runtime/CommandCodeCliResolver';

describe('CommandCodeCliResolver', () => {
  it('prefers the current host path over the legacy path', () => {
    const resolver = new CommandCodeCliResolver({
      findBinary: jest.fn(() => '/path/cmd'),
      hostname: 'host-a',
      platform: 'darwin',
      resolveConfigured: jest.fn(value => value || null),
    });

    expect(resolver.resolve({ 'host-a': '/host/cmd' }, '/legacy/cmd')).toBe('/host/cmd');
  });

  it('does not auto-resolve Windows cmd.exe as Command Code', () => {
    const findBinary = jest.fn(() => 'C:\\Windows\\System32\\cmd.exe');
    const resolver = new CommandCodeCliResolver({
      findBinary,
      hostname: 'host-a',
      platform: 'win32',
      resolveConfigured: jest.fn(() => null),
    });

    expect(resolver.resolve({}, '')).toBeNull();
    expect(findBinary).not.toHaveBeenCalled();
  });
});

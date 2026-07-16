import { buildCommandCodeLaunchSpec } from '@/providers/commandcode/runtime/CommandCodeLaunchSpec';

describe('CommandCodeLaunchSpec', () => {
  it('builds an explicit resumed plan-mode headless invocation', () => {
    expect(buildCommandCodeLaunchSpec({
      command: '/bin/cmd',
      cwd: '/vault',
      model: 'commandcode/gpt-5.6-sol',
      permissionMode: 'plan',
      sessionId: 'session-1',
    })).toEqual({
      args: [
        '-p',
        '--verbose',
        '--skip-onboarding',
        '--trust',
        '--model',
        'gpt-5.6-sol',
        '--resume',
        'session-1',
        '--plan',
      ],
      command: '/bin/cmd',
      cwd: '/vault',
    });
  });

  it('uses yolo only for auto-accept mode', () => {
    expect(buildCommandCodeLaunchSpec({
      command: 'cmd',
      cwd: '/vault',
      permissionMode: 'auto-accept',
    }).args).toContain('--yolo');
    expect(buildCommandCodeLaunchSpec({
      command: 'cmd',
      cwd: '/vault',
      permissionMode: 'plan',
    }).args).not.toContain('--yolo');
  });

  it('uses the safe headless default without adding a permission flag', () => {
    expect(buildCommandCodeLaunchSpec({
      command: 'cmd',
      cwd: '/vault',
      permissionMode: 'standard',
    }).args).toEqual(['-p', '--verbose', '--skip-onboarding', '--trust']);
  });

  it('omits the synthetic model before discovery', () => {
    expect(buildCommandCodeLaunchSpec({
      command: 'cmd',
      cwd: '/vault',
      model: 'commandcode',
    }).args).not.toContain('--model');
  });
});

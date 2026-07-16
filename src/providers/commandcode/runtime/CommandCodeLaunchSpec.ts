import { toCommandCodeRuntimeModelId } from '../models';

export interface CommandCodeLaunchSpec {
  args: string[];
  command: string;
  cwd: string;
}

export interface BuildCommandCodeLaunchSpecOptions {
  command: string;
  cwd: string;
  model?: string;
  permissionMode?: string;
  sessionId?: string | null;
}

export function buildCommandCodeLaunchSpec(
  options: BuildCommandCodeLaunchSpecOptions,
): CommandCodeLaunchSpec {
  const args = ['-p', '--verbose', '--skip-onboarding', '--trust'];
  const model = options.model?.trim();
  const runtimeModel = model ? toCommandCodeRuntimeModelId(model) : '';
  const sessionId = options.sessionId?.trim();

  if (runtimeModel) {
    args.push('--model', runtimeModel);
  }
  if (sessionId) {
    args.push('--resume', sessionId);
  }
  if (options.permissionMode === 'auto-accept') {
    args.push('--yolo');
  } else if (options.permissionMode === 'plan') {
    args.push('--plan');
  }

  return {
    args,
    command: options.command,
    cwd: options.cwd,
  };
}

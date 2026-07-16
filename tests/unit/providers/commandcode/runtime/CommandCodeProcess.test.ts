import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

import { spawn } from 'node:child_process';

import { CommandCodeProcess } from '@/providers/commandcode/runtime/CommandCodeProcess';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function createMockProcess(): any {
  const proc = new EventEmitter() as any;
  proc.stdin = new Writable({ write: (_chunk, _encoding, callback) => callback() });
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.exitCode = null;
  proc.kill = jest.fn(() => true);
  return proc;
}

describe('CommandCodeProcess', () => {
  it('settles listeners when spawning the CLI fails', () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const commandCode = new CommandCodeProcess({ command: '/missing/cmd', args: [], cwd: '/vault' });
    const onClose = jest.fn();
    commandCode.onClose(onClose);
    commandCode.start();

    const error = new Error('spawn ENOENT');
    proc.emit('error', error);

    expect(onClose).toHaveBeenCalledWith(null, null, error);
  });
});

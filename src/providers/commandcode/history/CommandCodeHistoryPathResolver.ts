import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ProviderHistoryPathContext } from '../../../core/providers/types';
import { isPathWithinRoot } from '../../../core/storage/pathContainment';

export async function resolveCommandCodeSessionFile(
  persistedPath: string | null | undefined,
  sessionId: string | null | undefined,
  _vaultPath: string | null,
  context?: ProviderHistoryPathContext,
): Promise<string | null> {
  const home = context?.environment.HOME?.trim()
    || context?.environment.USERPROFILE?.trim()
    || os.homedir();
  const root = path.join(home, '.commandcode', 'projects');

  if (persistedPath && isPathWithinRoot(persistedPath, root)) {
    return persistedPath;
  }
  if (!sessionId || !/^[\w-]+$/.test(sessionId)) return null;

  try {
    const projects = await fs.readdir(root, { withFileTypes: true });
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      const candidate = path.join(root, project.name, `${sessionId}.jsonl`);
      if (!isPathWithinRoot(candidate, root)) continue;
      try {
        if ((await fs.stat(candidate)).isFile()) return candidate;
      } catch {
        // Continue searching other project directories.
      }
    }
  } catch {
    return null;
  }
  return null;
}

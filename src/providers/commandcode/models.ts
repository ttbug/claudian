import {
  encodeProviderModelSelectionId,
  isProviderModelSelectionId,
  toProviderRuntimeModelId,
} from '../../core/providers/modelSelection';

export interface CommandCodeModel {
  description: string;
  group: string;
  id: string;
  isDefault: boolean;
  label: string;
}

export const COMMAND_CODE_SYNTHETIC_MODEL_ID = 'commandcode';

const MODEL_LINE = /^(\S+)\s{2,}(.+)$/;
const LABEL_OVERRIDES: Record<string, string> = {
  deepseek: 'DeepSeek',
  glm: 'GLM',
  gpt: 'GPT',
  kimi: 'Kimi',
  minimax: 'MiniMax',
  qwen: 'Qwen',
  xai: 'xAI',
};

export function encodeCommandCodeModelId(modelId: string): string {
  return encodeProviderModelSelectionId('commandcode', modelId);
}

export function decodeCommandCodeModelId(modelId: string): string | null {
  return isProviderModelSelectionId('commandcode', modelId)
    ? toProviderRuntimeModelId('commandcode', modelId)
    : null;
}

export function toCommandCodeRuntimeModelId(modelId: string): string {
  if (modelId === COMMAND_CODE_SYNTHETIC_MODEL_ID) return '';
  return toProviderRuntimeModelId('commandcode', modelId);
}

export function parseCommandCodeModelList(output: string): CommandCodeModel[] {
  const models: CommandCodeModel[] = [];
  let group = '';

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Available models')) {
      continue;
    }
    if (line.startsWith('Pass the full id') || line.startsWith('cmd --model') || line.startsWith('Docs:')) {
      break;
    }

    const match = line.match(MODEL_LINE);
    if (!match) {
      group = line;
      continue;
    }

    const id = match[1];
    const isDefault = /\s*\(default\)\s*$/.test(match[2]);
    const description = match[2].replace(/\s*\(default\)\s*$/, '').trim();
    if (!id || !description || models.some(model => model.id === id)) {
      continue;
    }
    models.push({
      description,
      group,
      id,
      isDefault,
      label: formatCommandCodeModelLabel(id),
    });
  }

  return models;
}

export function normalizeCommandCodeModels(value: unknown): CommandCodeModel[] {
  if (!Array.isArray(value)) return [];
  const models: CommandCodeModel[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({
      description: typeof record.description === 'string' ? record.description.trim() : '',
      group: typeof record.group === 'string' ? record.group.trim() : '',
      id,
      isDefault: record.isDefault === true,
      label: typeof record.label === 'string' && record.label.trim()
        ? record.label.trim()
        : formatCommandCodeModelLabel(id),
    });
  }
  return models;
}

function formatCommandCodeModelLabel(modelId: string): string {
  const name = modelId.slice(modelId.lastIndexOf('/') + 1);
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const override = LABEL_OVERRIDES[part.toLowerCase()];
      return override ?? (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1));
    })
    .join(' ')
    .replace(/^GPT (?=\d)/, 'GPT-');
}

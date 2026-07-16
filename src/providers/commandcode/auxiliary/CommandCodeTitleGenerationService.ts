import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { CommandCodeAuxQueryRunner } from '../runtime/CommandCodeAuxQueryRunner';
import { commandCodeChatUIConfig } from '../ui/CommandCodeChatUIConfig';

export class CommandCodeTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: ProviderHost) {
    super({
      createRunner: () => new CommandCodeAuxQueryRunner(plugin),
      resolveModel: () => {
        const settings = plugin.settings as unknown as Record<string, unknown>;
        const model = typeof settings.titleGenerationModel === 'string' ? settings.titleGenerationModel : '';
        return commandCodeChatUIConfig.ownsModel(model, settings) ? model : undefined;
      },
    });
  }
}

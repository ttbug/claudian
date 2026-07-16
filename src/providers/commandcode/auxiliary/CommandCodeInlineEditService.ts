import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { CommandCodeAuxQueryRunner } from '../runtime/CommandCodeAuxQueryRunner';

export class CommandCodeInlineEditService extends QueryBackedInlineEditService {
  constructor(plugin: ProviderHost) {
    super(new CommandCodeAuxQueryRunner(plugin));
  }
}

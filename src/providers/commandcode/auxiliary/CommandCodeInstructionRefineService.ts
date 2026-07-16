import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type { ProviderHost } from '../../../core/providers/ProviderHost';
import { CommandCodeAuxQueryRunner } from '../runtime/CommandCodeAuxQueryRunner';

export class CommandCodeInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: ProviderHost) {
    super(new CommandCodeAuxQueryRunner(plugin));
  }
}

// src/commands/index.ts
import { help } from './help';
import { createCommand } from './character/create';
import { interactNpc } from './character/interact';
import { statusCommand } from './character/statusCommand';
import { explorationCommands } from './exploration/explorationCommands';
import { inventoryCommands } from './inventory/inventoryCommands';
import { questCommands } from './quest/questCommands';

export default {
  help,
  create: createCommand,
  interact: interactNpc,
  status: statusCommand,
  explore: explorationCommands,
  inventory: inventoryCommands,
  quest: questCommands,
}; 
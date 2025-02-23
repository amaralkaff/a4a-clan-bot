// src/commands/commandList.ts
import { data as basicData } from './basic/command';
import { data as helpData } from './help/command';
import { data as startData } from './start/command';
import { execute as handleBasicCommand } from './basic/handlers/index';
import { handleHelp } from './basic/handlers/help';
import { handleStart } from './start/handler';
import { resetCommand } from './character/resetCommand';
import { CommandHandler } from '@/types/commands';

// Simplified command structure like OwO bot
const basicCommands: CommandHandler = { data: basicData, execute: handleBasicCommand };
const helpCommand: CommandHandler = { data: helpData, execute: handleHelp };
const startCommand: CommandHandler = { data: startData, execute: handleStart };

const commandList: Record<string, CommandHandler> = {
  a: basicCommands,
  help: helpCommand,
  start: startCommand,
  reset: resetCommand
};

export default commandList;
export { commandList }; 
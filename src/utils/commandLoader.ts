import { Client, Collection, REST, Routes, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { CONFIG } from '../config/config';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import commands from '../commands';
import { CommandHandler } from '@/types/commands';

export async function loadCommands(client: Client) {
  const commandCollection = new Collection();
  const commandsArray: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  // Load commands from the commands object
  for (const [name, command] of Object.entries(commands)) {
    const cmd = command as CommandHandler;
    if ('data' in cmd && 'execute' in cmd) {
      logger.info(`Registering command: ${name}`);
      commandCollection.set(name, cmd);
      commandsArray.push(cmd.data.toJSON());
    } else {
      logger.warn(`Invalid command structure for ${name}`);
    }
  }

  try {
    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    logger.info('Started refreshing application (/) commands.');
    logger.info('Commands to register:', commandsArray.map(cmd => cmd.name).join(', '));

    // Coba register commands secara global jika guild-specific gagal
    try {
      await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commandsArray },
      );
      logger.info('Successfully registered guild commands.');
    } catch (error: any) {
      if (error?.code === 50001) {
        logger.warn('Failed to register guild commands, trying global commands...');
        await rest.put(
          Routes.applicationCommands(CONFIG.CLIENT_ID),
          { body: commandsArray },
        );
        logger.info('Successfully registered global commands.');
      } else {
        throw error;
      }
    }

    return commandCollection;
  } catch (error) {
    logger.error('Error loading commands:', error);
    throw new Error('Failed to register Discord commands. Please check bot permissions and try again.');
  }
}
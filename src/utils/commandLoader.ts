import { Client, Collection, REST, Routes, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { CONFIG } from '../config/config';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export async function loadCommands(client: Client) {
  const commands = new Collection();
  const commandsArray: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  const commandsPath = path.join(__dirname, '..', 'commands');
  
  async function readCommands(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        await readCommands(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          commands.set(command.data.name, command);
          commandsArray.push(command.data.toJSON());
        }
      }
    }
  }

  try {
    await readCommands(commandsPath);

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    logger.info('Started refreshing application (/) commands.');

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

    return commands;
  } catch (error) {
    logger.error('Error loading commands:', error);
    throw new Error('Failed to register Discord commands. Please check bot permissions and try again.');
  }
}
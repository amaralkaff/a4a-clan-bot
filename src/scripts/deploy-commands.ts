import { REST, Routes, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { config } from 'dotenv';
import { commandList } from '../utils/commandLoader';
import { logger } from '../utils/logger';
import { CommandHandler } from '@/types/commands';

config();

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
for (const [name, command] of Object.entries(commandList)) {
  const cmd = command as CommandHandler;
  if ('data' in cmd && 'execute' in cmd) {
    commands.push(cmd.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Deploy commands
(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // Register commands globally
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands },
    );

    logger.info(`Successfully reloaded ${(data as any[]).length} application (/) commands.`);
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
})(); 
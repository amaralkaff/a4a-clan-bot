import { REST, Routes } from 'discord.js';
import { CONFIG } from './config/config';
import { commandList } from './commands/commandList';
import { logger } from './utils/logger';

// Convert commands to JSON format
const commandsToRegister = Object.values(commandList).map(cmd => cmd.data.toJSON());

const rest = new REST().setToken(CONFIG.BOT_TOKEN);

async function deployCommands() {
  try {
    logger.info(`Started refreshing ${commandsToRegister.length} application (/) commands.`);
    logger.info('Commands to deploy:', commandsToRegister.map(cmd => cmd.name).join(', '));

    try {
      logger.info(`Deploying commands to guild: ${CONFIG.GUILD_ID}`);
      const guildData = await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commandsToRegister },
      );
      logger.info(`Successfully reloaded ${(guildData as any[]).length} guild (/) commands.`);
    } catch (error) {
      logger.warn('Failed to register guild commands, trying global commands...');
      const globalData = await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commandsToRegister },
      );
      logger.info(`Successfully registered ${(globalData as any[]).length} global commands.`);
    }

    logger.info('\nSetup Instructions:');
    logger.info('1. Use this URL to invite the bot:');
    logger.info(CONFIG.INVITE_URL);
    logger.info('\n2. Make sure to:');
    logger.info('   - Select the server you want to add the bot to');
    logger.info('   - Keep all permission boxes checked');
    logger.info('\n3. Wait up to 1 hour for commands to register');
    logger.info('   If commands dont show up after 1 hour:');
    logger.info('   1. Remove the bot from your server');
    logger.info('   2. Use this URL to reinvite the bot WITH ALL PERMISSIONS:');
    logger.info(CONFIG.INVITE_URL);
    logger.info('   3. Make sure to check ALL permission boxes when inviting');
    logger.info('   4. Run this deploy command again after reinviting');

  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
}

deployCommands(); 
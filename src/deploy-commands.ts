import { REST, Routes } from 'discord.js';
import { CONFIG } from './config/config';
import commands from './commands';
import { logger } from './utils/logger';

const commandsData = Object.values(commands).map(command => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

async function deployCommands() {
  try {
    logger.info(`Started refreshing ${commandsData.length} application (/) commands.`);
    logger.info('Commands to deploy:', commandsData.map(cmd => cmd.name).join(', '));

    try {
      // Coba deploy ke guild terlebih dahulu
      logger.info(`Deploying commands to guild: ${CONFIG.GUILD_ID}`);
      const guildData = await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commandsData },
      );
      logger.info(`Successfully reloaded ${(guildData as any[]).length} guild (/) commands.`);
    } catch (guildError) {
      // Jika guild deploy gagal, coba deploy global
      logger.warn('Failed to register guild commands, trying global commands...');
      const globalData = await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commandsData },
      );
      logger.info(`Successfully registered ${(globalData as any[]).length} global commands.`);
    }

    logger.info('\nSetup Instructions:');
    logger.info('1. Use this URL to invite the bot:');
    logger.info(CONFIG.INVITE_URL);
    logger.info('\n2. Make sure to:');
    logger.info('   - Select the server you want to add the bot to');
    logger.info('   - Keep all permissions checked');
    logger.info('   - Authorize the bot');
    logger.info('\n3. In your Discord server:');
    logger.info('   - Go to Server Settings > Roles');
    logger.info('   - Move the bot\'s role above any roles it needs to manage');
    logger.info('   - Make sure the bot has "Administrator" permission for development');
  } catch (error: any) {
    logger.error('Error deploying commands:', error);
    if (error.code === 50001) {
      logger.error('\nMissing Access: Please follow these steps:');
      logger.error('1. Remove the bot from your server');
      logger.error('2. Use this URL to reinvite the bot WITH ALL PERMISSIONS:');
      logger.error(CONFIG.INVITE_URL);
      logger.error('3. Make sure to check ALL permission boxes when inviting');
      logger.error('4. Run this deploy command again after reinviting');
    }
  }
}

deployCommands(); 
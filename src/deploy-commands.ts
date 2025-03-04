import { REST, Routes } from 'discord.js';
import { CONFIG } from './config/config';
import { logger } from './utils/logger';
import { loadCommands } from './utils/commandLoader';

async function deployCommands() {
  try {
    // Create a dummy client to load commands
    const { Client } = await import('discord.js');
    const client = new Client({ 
      intents: [] 
    });
    
    // Load commands using the loadCommands function
    const commands = await loadCommands(client);
    const commandsToRegister = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    logger.info(`Started refreshing ${commandsToRegister.length} application (/) commands.`);
    logger.info('Commands to deploy:', commandsToRegister.map(cmd => cmd.name).join(', '));

    // First try to delete all existing commands
    try {
      logger.info('Removing old commands...');
      await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] });
      logger.info('Successfully removed old commands');
    } catch (error) {
      logger.warn('Failed to remove old commands:', error);
    }

    // Then register new commands
    try {
      logger.info(`Deploying commands to guild: ${CONFIG.GUILD_ID}`);
      const guildData = await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { 
          body: commandsToRegister,
        }
      );
      logger.info(`Successfully reloaded ${(guildData as any[]).length} guild (/) commands.`);
    } catch (error: any) {
      if (error?.code === 50001) {
        logger.warn('Failed to register guild commands, trying global commands...');
        const globalData = await rest.put(
          Routes.applicationCommands(CONFIG.CLIENT_ID),
          { body: commandsToRegister }
        );
        logger.info(`Successfully registered ${(globalData as any[]).length} global commands.`);
      } else {
        throw error;
      }
    }

    // Generate proper invite URL with required scopes and permissions
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&permissions=2147485760&scope=bot%20applications.commands`;

    logger.info('\nSetup Instructions:');
    logger.info('1. Use this URL to invite the bot:');
    logger.info(inviteUrl);
    logger.info('\n2. Make sure to:');
    logger.info('   - Select the server you want to add the bot to');
    logger.info('   - Enable BOTH "bot" and "applications.commands" scopes');
    logger.info('   - Keep all permission boxes checked');
    logger.info('\n3. Required Permissions:');
    logger.info('   - Send Messages');
    logger.info('   - Embed Links');
    logger.info('   - Attach Files');
    logger.info('   - Read Message History');
    logger.info('   - Add Reactions');
    logger.info('   - Use External Emojis');
    logger.info('   - Use Application Commands');
    logger.info('\n4. If commands dont show up:');
    logger.info('   1. Remove the bot from your server');
    logger.info('   2. Use the URL above to reinvite with ALL permissions');
    logger.info('   3. Make sure BOTH scopes are checked');
    logger.info('   4. Run this deploy command again');

    // Cleanup
    client.destroy();
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
}

// Run deployment
deployCommands(); 
import { Client, Events, Interaction, Collection } from 'discord.js';
import { logger } from '../utils/logger';
import { ServiceContainer } from '@/services';
import { loadCommands } from '@/utils/commandLoader';
import { CommandHandler } from '@/types/commands';
import { handleMessageCommand } from '../utils/messageHandler';
import { ErrorUtils } from '@/utils/errorUtils';
import { ErrorHandler } from '@/utils/errors';

interface Quest {
  id: string;
  name: string;
  description: string;
  reward: number;
  status: string;
  characterId: string;
}

export async function setupEventHandlers(client: Client, services: ServiceContainer) {
  // Load commands
  const commands = await loadCommands(client);

  // Handle slash commands and button interactions
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        logger.info(`Received command: ${interaction.commandName} from ${interaction.user.tag}`);

        const command = commands.get(interaction.commandName);

        if (!command) {
          logger.warn(`No command matching ${interaction.commandName} was found.`);
          await interaction.reply({ 
            content: '❌ Command tidak ditemukan. Gunakan `/help` untuk melihat daftar command.',
            ephemeral: true 
          });
          return;
        }

        try {
          logger.info(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
          await command.execute(interaction, services);
        } catch (error) {
          logger.error(`Error executing command ${interaction.commandName}:`, error);
          
          // Handle different error states
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Terjadi kesalahan saat menjalankan command.',
              ephemeral: true
            });
          } else if (interaction.deferred) {
            await interaction.editReply({
              content: '❌ Terjadi kesalahan saat menjalankan command.'
            });
          } else {
            await interaction.followUp({
              content: '❌ Terjadi kesalahan saat menjalankan command.',
              ephemeral: true
            });
          }
        }
      } else if (interaction.isButton()) {
        // Handle quiz button interactions
        if (interaction.customId.startsWith('quiz_answer_')) {
          try {
            await services.quiz.processAnswer(interaction, interaction.customId.split('_')[2]);
          } catch (error) {
            logger.error('Error handling quiz answer:', error);
            await ErrorHandler.handle(error, interaction);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
    }
  });

  // Handle message commands (legacy)
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith('a ')) return;
    
    try {
      await handleMessageCommand(message, services);
    } catch (error) {
      logger.error('Error handling message command:', error);
      await ErrorUtils.handleError({
        context: 'COMMAND',
        error: '❌ Terjadi kesalahan saat menjalankan command.',
        source: message
      });
    }
  });

  // Handle rate limits
  client.on('rateLimit', (rateLimitInfo) => {
    logger.warn('Rate limit hit:', rateLimitInfo);
  });

  // Handle ready event
  client.once(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user?.tag}!`);
    logger.info('Registered commands:', Array.from(commands.keys()).join(', '));
  });

  // Handle errors
  client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.Warn, warning => {
    logger.warn('Discord client warning:', warning);
  });

  client.on(Events.Debug, info => {
    logger.debug('Discord client debug:', info);
  });

  // Handle guild join/leave
  client.on(Events.GuildCreate, guild => {
    logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
    // Re-register commands for new guild
    loadCommands(client).catch(error => {
      logger.error(`Failed to register commands for new guild ${guild.id}:`, error);
    });
  });

  client.on(Events.GuildDelete, guild => {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
  });
}
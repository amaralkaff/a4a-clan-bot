import { Client, Events, Interaction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export function setupEventHandlers(client: Client, prisma: PrismaClient) {
  client.once(Events.ClientReady, c => {
    logger.info(`Ready! Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;

      const command = (interaction.client as any).commands.get(interaction.commandName);

      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({
          content: 'Sorry, that command was not found.',
          ephemeral: true
        });
        return;
      }

      logger.info(`Executing command: ${interaction.commandName}`);
      
      await command.execute(interaction, prisma);
      
      logger.info(`Command ${interaction.commandName} executed successfully`);
    } catch (error) {
      logger.error('Error executing command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      try {
        if ((interaction as any).replied || (interaction as any).deferred) {
          await (interaction as any).followUp({
            content: `There was an error while executing this command!\nError: ${errorMessage}`,
            ephemeral: true
          });
        } else {
          await (interaction as any).reply({
            content: `There was an error while executing this command!\nError: ${errorMessage}`,
            ephemeral: true
          });
        }
      } catch (followUpError) {
        logger.error('Error sending error message:', followUpError);
      }
    }
  });

  // Handle errors
  client.on(Events.Error, error => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.Warn, warning => {
    logger.warn('Discord client warning:', warning);
  });

  client.on(Events.Debug, info => {
    logger.debug('Discord client debug:', info);
  });
}
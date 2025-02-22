import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ServiceContainer } from '@/services';
import { logger } from '@/utils/logger';

export async function handleInventoryView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  return services.inventory.handleInventoryView(interaction);
}

export async function handleUseItem(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  try {
    // Get and validate item option
    const itemId = interaction.options.getString('item', true);
    
    // Debug logging
    logger.debug(`User ${interaction.user.id} attempting to use item with ID: ${itemId}`);
    
    // Get available choices for comparison
    const choices = await services.inventory.getItemChoices(interaction.user.id);
    logger.debug('Available choices:', {
      selectedItemId: itemId,
      availableChoices: choices.map(c => ({
        name: c.name,
        value: c.value
      }))
    });
    
    // Validate item choice
    const validChoice = choices.find(c => c.value === itemId);
    if (!validChoice) {
      logger.debug(`Invalid item choice. ItemID: ${itemId}, Available choices: ${choices.map(c => `${c.name} (${c.value})`).join(', ')}`);
      return interaction.reply({ 
        content: '❌ Item tidak valid atau tidak tersedia di inventory', 
        flags: MessageFlags.Ephemeral 
      });
    }

    logger.debug(`Using item: ${validChoice.name} (${validChoice.value})`);
    return services.inventory.handleUseItem(interaction, itemId);
  } catch (error) {
    logger.error('Error in handleUseItem:', error);
    return interaction.reply({ 
      content: '❌ Terjadi kesalahan saat menggunakan item', 
      flags: MessageFlags.Ephemeral 
    });
  }
} 
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { PrismaClient } from '@prisma/client';
  import { InventoryService } from '../../services/InventoryService';
  import { logger } from '../../utils/logger';
  
  export const data = new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Inventory commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show your inventory')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('use')
        .setDescription('Use an item')
        .addStringOption(option =>
          option
            .setName('item_id')
            .setDescription('ID of the item to use')
            .setRequired(true)
        )
    );
  
  export async function execute(
    interaction: ChatInputCommandInteraction,
    prisma: PrismaClient
  ) {
    try {
      const inventoryService = new InventoryService(prisma);
      const subcommand = interaction.options.getSubcommand();
  
      const character = await prisma.character.findFirst({
        where: {
          user: {
            discordId: interaction.user.id
          }
        }
      });
  
      if (!character) {
        return interaction.reply({
          content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create-character`',
          ephemeral: true
        });
      }
  
      switch (subcommand) {
        case 'show': {
          const inventory = await inventoryService.getInventory(character.id);
          
          const embed = new EmbedBuilder()
            .setTitle('Inventory')
            .setColor('#0099ff')
            .setDescription(
              inventory.length > 0
                ? inventory
                    .map(item => `**${item.name}** (${item.quantity}x)\n${item.description}`)
                    .join('\n\n')
                : 'Inventory kosong'
            );
  
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
  
        case 'use': {
          const itemId = interaction.options.getString('item_id', true);
          const result = await inventoryService.useItem(character.id, itemId);
          
          return interaction.reply({
            content: result.message,
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error('Error in inventory command:', error);
      return interaction.reply({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }
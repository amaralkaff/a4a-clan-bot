// src/commands/shop/shopCommands.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const shopCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Beli item dan equipment')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lihat daftar item yang tersedia')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Beli sebuah item')
        .addStringOption(option =>
          option
            .setName('item')
            .setDescription('Item yang ingin dibeli')
            .setRequired(true)
            .addChoices(
              { name: '🧪 Health Potion (50 coins)', value: 'health_potion' },
              { name: '⚔️ Basic Sword (100 coins)', value: 'basic_sword' },
              { name: '🛡️ Basic Armor (100 coins)', value: 'basic_armor' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, services) {
    try {
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);
      
      if (!character) {
        return interaction.reply(createEphemeralReply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan `/start`'
        }));
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'list': {
          const shopEmbed = {
            title: '🛍️ Toko',
            description: 'Item yang tersedia:',
            fields: [
              { 
                name: '🧪 Consumables',
                value: '• Health Potion - 50 coins\n  Pulihkan 50 HP'
              },
              {
                name: '⚔️ Weapons',
                value: '• Basic Sword - 100 coins\n  +5 Attack'
              },
              {
                name: '🛡️ Armor',
                value: '• Basic Armor - 100 coins\n  +5 Defense'
              }
            ]
          };
          
          return interaction.reply({ embeds: [shopEmbed], ephemeral: true });
        }

        case 'buy': {
          const itemId = interaction.options.getString('item', true);
          const result = await services.shop.buyItem(character.id, itemId);
          
          return interaction.reply(createEphemeralReply({
            content: result.message
          }));
        }
      }
    } catch (error) {
      services.logger.error('Error in shop command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
}; 
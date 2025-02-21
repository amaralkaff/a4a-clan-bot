import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';
  
  export const inventoryCommands: CommandHandler = {
    data: new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('Sistem inventaris')
      .addSubcommand(subcommand =>
        subcommand
          .setName('show')
          .setDescription('Tampilkan inventarismu')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('use')
          .setDescription('Gunakan sebuah item')
          .addStringOption(option =>
            option
              .setName('item')
              .setDescription('Item yang ingin digunakan')
              .setRequired(true)
              .addChoices(
                { name: 'Potion (Heal 50 HP)', value: 'potion' },
                { name: 'Super Potion (Heal 100 HP)', value: 'super_potion' },
                { name: 'Attack Boost (Attack +5)', value: 'attack_boost' },
                { name: 'Defense Boost (Defense +5)', value: 'defense_boost' }
              )
          )
      ),
  
    async execute(interaction, services) {
      try {
        const subcommand = interaction.options.getSubcommand();
  
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
          }));
        }
  
        switch (subcommand) {
          case 'show': {
            const inventory = await services.inventory.getInventory(character.id);
            
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
            const itemId = interaction.options.getString('item', true);
            const result = await services.inventory.useItem(character.id, itemId);
            
            return interaction.reply(createEphemeralReply({
              content: result.message
            }));
          }
        }
      } catch (error) {
        services.logger.error('Error in inventory command:', error);
        return interaction.reply(createEphemeralReply({
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };
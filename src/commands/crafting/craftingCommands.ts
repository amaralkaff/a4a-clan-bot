import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { ServiceContainer } from '@/services';
import { createEphemeralReply } from '@/utils/helpers';

export const craftingCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('crafting')
    .setDescription('Sistem crafting')
    .addSubcommand(subcommand =>
      subcommand
        .setName('recipes')
        .setDescription('Lihat resep yang tersedia')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('craft')
        .setDescription('Buat item dari resep')
        .addStringOption(option =>
          option
            .setName('recipe')
            .setDescription('ID resep yang ingin dibuat')
            .setRequired(true)
            .addChoices(
              { name: '🍱 Hidangan Dasar (Heal 20 HP)', value: 'sanji_basic_meal' },
              { name: '👨‍🍳 Masakan Spesial Sanji (Buff ATK & DEF)', value: 'sanji_special' },
              { name: '🍖 Daging Super (Heal 50 HP)', value: 'super_meat' },
              { name: '🔮 Ramuan Kekuatan (Buff ATK)', value: 'strength_potion' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
    try {
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);
      
      if (!character) {
        return interaction.reply(createEphemeralReply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
        }));
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'recipes') {
        const result = await services.crafting.getAvailableRecipes(interaction.user.id);
        
        const recipesEmbed = new EmbedBuilder()
          .setTitle('📖 Resep yang Tersedia')
          .setColor('#0099ff');

        if (result.recipes.length > 0) {
          for (const recipe of result.recipes) {
            let effectText = '';
            if (recipe.id === 'sanji_basic_meal') {
              effectText = '\n💚 Effect: Heal 20 HP';
            } else if (recipe.id === 'sanji_special') {
              effectText = '\n⚡ Effect: +10 ATK & DEF selama 1 jam';
            } else if (recipe.id === 'super_meat') {
              effectText = '\n💚 Effect: Heal 50 HP';
            } else if (recipe.id === 'strength_potion') {
              effectText = '\n⚔️ Effect: +15 ATK selama 30 menit';
            }

            recipesEmbed.addFields({
              name: recipe.name,
              value: `${recipe.description}${effectText}\n\nBahan:\n${recipe.ingredients.map(i => 
                `• ${i.quantity}x ${i.itemId}`
              ).join('\n')}\n\nHasil: ${recipe.result.quantity}x ${recipe.result.itemId}`
            });
          }
        } else {
          recipesEmbed.setDescription('❌ Tidak ada resep yang tersedia');
        }

        await interaction.reply({ embeds: [recipesEmbed], ephemeral: true });
      }
      else if (subcommand === 'craft') {
        const recipeId = interaction.options.getString('recipe', true);
        const result = await services.crafting.craft(interaction.user.id, recipeId);

        if (result.success) {
          switch (recipeId) {
            case 'sanji_basic_meal':
              await services.character.addStatusEffect(character.id, {
                type: 'HEAL_OVER_TIME',
                value: 20,
                duration: 1
              });
              break;
            case 'sanji_special':
              await services.character.addBuff(character.id, {
                type: 'ALL',
                value: 10,
                expiresAt: Date.now() + (3600 * 1000)
              });
              break;
            case 'super_meat':
              await services.character.addStatusEffect(character.id, {
                type: 'HEAL_OVER_TIME',
                value: 50,
                duration: 1
              });
              break;
            case 'strength_potion':
              await services.character.addBuff(character.id, {
                type: 'ATTACK',
                value: 15,
                expiresAt: Date.now() + (1800 * 1000)
              });
              break;
          }
        }

        await interaction.reply({ embeds: [result.embed], ephemeral: true });
      }
    } catch (error) {
      services.logger.error('Error in crafting command:', error);
      await interaction.reply(createEphemeralReply({ 
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
}; 
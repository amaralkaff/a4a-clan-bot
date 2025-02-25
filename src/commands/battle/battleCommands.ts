import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const battleCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Sistem pertarungan')
    .addSubcommand(subcommand =>
      subcommand
        .setName('fight')
        .setDescription('Bertarung melawan musuh')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('Level musuh yang ingin dilawan')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, services) {
    try {
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);

      if (!character) {
        return interaction.reply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`',
          flags: MessageFlags.Ephemeral
        });
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'fight') {
        const enemyLevel = interaction.options.getInteger('level', true);
        
        // Check if enemy level is too high
        if (enemyLevel > character.level + 3) {
          return interaction.reply({
            content: `❌ Level musuh terlalu tinggi! Max: ${character.level + 3}`,
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          // Start battle
          await interaction.deferReply({ ephemeral: true });
          const result = await services.battle.processBattle(character.id, enemyLevel);

          // Create battle result embed
          const embed = new EmbedBuilder()
            .setTitle(result.won ? '🎉 Victory!' : '💀 Defeat!')
            .setColor(result.won ? '#00ff00' : '#ff0000')
            .setDescription(result.battleLog.join('\n\n'))
            .addFields(
              { name: '✨ Experience', value: `${result.exp} EXP`, inline: true },
              { name: '🎁 Drops', value: result.drops.length > 0 ? result.drops.join(', ') : 'No drops', inline: true }
            );

          // Send battle result
          return interaction.editReply({ embeds: [embed] });
        } catch (error) {
          services.logger.error('Error in battle:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (interaction.deferred) {
            return interaction.editReply({
              content: `❌ Error: ${errorMessage}`,
              embeds: []
            });
          } else {
            return interaction.reply({
              content: `❌ Error: ${errorMessage}`,
              flags: MessageFlags.Ephemeral
            });
          }
        }
      }
    } catch (error) {
      services.logger.error('Error in battle command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (interaction.deferred) {
        return interaction.editReply({
          content: `❌ Error: ${errorMessage}`,
          embeds: []
        });
      } else {
        return interaction.reply({
          content: `❌ Error: ${errorMessage}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
}; 
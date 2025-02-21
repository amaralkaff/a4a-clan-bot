import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
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
        return interaction.reply(createEphemeralReply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
        }));
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'fight') {
        const enemyLevel = interaction.options.getInteger('level', true);
        
        // Check if enemy level is too high
        if (enemyLevel > character.level + 3) {
          return interaction.reply(createEphemeralReply({
            content: `❌ Level musuh terlalu tinggi! Max: ${character.level + 3}`
          }));
        }

        try {
          // Start battle
          await interaction.deferReply({ ephemeral: true });
          const battleResult = await services.battle.processBattle(character.id, enemyLevel);

          // Send battle log messages one by one
          for (let i = 0; i < battleResult.battleLog.length; i++) {
            const log = battleResult.battleLog[i];
            if (i === 0) {
              // First message uses editReply
              await interaction.editReply(log);
            } else {
              // Subsequent messages use followUp
              await interaction.followUp({
                ...log,
                ephemeral: true
              });
            }
          }

          // Update quest progress if won
          if (battleResult.won) {
            await services.quest.updateQuestProgress(character.id, 'COMBAT', 1);
          }
        } catch (error) {
          // If there's an error during battle, send error message
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(createEphemeralReply({
              content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }));
          } else {
            await interaction.followUp(createEphemeralReply({
              content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }));
          }
          services.logger.error('Error in battle:', error);
        }
      }
    } catch (error) {
      // Handle any other errors
      services.logger.error('Error in battle command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(createEphemeralReply({
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  }
}; 
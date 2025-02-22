// src/commands/mentor/mentorCommands.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const mentorCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('train')
    .setDescription('Berlatih dengan mentormu')
    .addSubcommand(subcommand =>
      subcommand
        .setName('with')
        .setDescription('Pilih latihan dengan mentor')
        .addStringOption(option =>
          option
            .setName('training')
            .setDescription('Jenis latihan')
            .setRequired(true)
            .addChoices(
              { name: '💪 Basic Training (+5 ATK/DEF)', value: 'basic' },
              { name: '🔥 Special Training (Unlock Skill)', value: 'special' }
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

      if (subcommand === 'with') {
        const trainingType = interaction.options.getString('training', true);
        
        // Get training result based on mentor
        const result = await services.mentor.train(character.id, trainingType);
        
        return interaction.reply(createEphemeralReply({
          content: result.message
        }));
      }
    } catch (error) {
      services.logger.error('Error in mentor command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
}; 
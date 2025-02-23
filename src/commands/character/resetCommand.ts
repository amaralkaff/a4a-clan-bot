// src/commands/character/resetCommand.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { CommandHandler } from '@/types/commands';

export const resetCommand: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset karakter kamu (PERINGATAN: Semua progress akan hilang!)')
    .addStringOption(option =>
      option
        .setName('confirmation')
        .setDescription('Ketik "CONFIRM" untuk konfirmasi reset karakter')
        .setRequired(true)
    ),

  async execute(interaction, services) {
    try {
      // Defer reply untuk menghindari timeout
      await interaction.deferReply({ ephemeral: true });

      const confirmation = interaction.options.getString('confirmation', true);
      
      if (confirmation !== 'CONFIRM') {
        return interaction.editReply({
          content: '❌ Untuk mereset karakter, kamu harus mengetik "CONFIRM" sebagai konfirmasi.'
        });
      }

      // Check if character exists
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);
      if (!character) {
        return interaction.editReply({
          content: '❌ Kamu belum memiliki karakter!'
        });
      }

      // Reset character
      await services.character.resetCharacter(interaction.user.id);

      return interaction.editReply({
        content: '✅ Karakter kamu telah berhasil direset. Gunakan `/start` untuk membuat karakter baru!'
      });
    } catch (error) {
      services.logger.error('Error in reset command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = {
        content: `❌ Error: ${errorMessage}`
      };

      // Jika interaction belum dibalas, gunakan reply dengan ephemeral
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ ...response, ephemeral: true });
      }
      
      // Jika sudah dibalas, gunakan editReply
      return interaction.editReply(response);
    }
  }
}; 
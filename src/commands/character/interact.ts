import { SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const interactNpc: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('interact')
    .setDescription('Berinteraksi dengan karakter utama')
    .addStringOption(option =>
      option
        .setName('character')
        .setDescription('Pilih karakter untuk berinteraksi')
        .setRequired(true)
        .addChoices(
          { name: 'Luffy (YB)', value: 'luffy' },
          { name: 'Zoro (Tierison)', value: 'zoro' },
          { name: 'Usopp (LYuka)', value: 'usopp' },
          { name: 'Sanji (GarryAng)', value: 'sanji' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction, services) {
    try {
      const npcId = interaction.options.getString('character', true);
      const discordId = interaction.user.id;

      // Dapatkan karakter user
      const character = await services.character.getCharacterByDiscordId(discordId);
      if (!character) {
        await interaction.reply(createEphemeralReply({
          content: 'Kamu belum memiliki karakter! Gunakan `/create-character` untuk membuat karakter.'
        }));
        return;
      }

      // Interaksi dengan NPC
      const npcInteraction = await services.npc.interactWithNpc(
        character.id,
        npcId
      );

      // Format pesan berdasarkan hasil interaksi
      let responseContent = npcInteraction.dialogue + '\n\n';
      if (npcInteraction.availableActions.length > 0) {
        responseContent += 'Aksi yang tersedia:\n';
        responseContent += npcInteraction.availableActions
          .map(action => `• ${action.toLowerCase()}`)
          .join('\n');
      }

      await interaction.reply(createEphemeralReply({
        content: responseContent
      }));
    } catch (error) {
      services.logger.error('Error interacting with NPC:', error);
      await interaction.reply(createEphemeralReply({
        content: 'Terjadi kesalahan saat berinteraksi dengan karakter. Silakan coba lagi.'
      }));
    }
  }
};

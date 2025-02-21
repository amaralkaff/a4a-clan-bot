import { SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const interactNpc: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('interact')
    .setDescription('Berinteraksi dengan NPC')
    .addStringOption(option =>
      option
        .setName('npc')
        .setDescription('NPC yang ingin diajak berinteraksi')
        .setRequired(true)
        .addChoices(
          { name: 'Luffy (YB)', value: 'YB' },
          { name: 'Zoro (Tierison)', value: 'Tierison' },
          { name: 'Usopp (LYuka)', value: 'LYuka' },
          { name: 'Sanji (GarryAng)', value: 'GarryAng' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction, services) {
    try {
      const npcId = interaction.options.getString('npc', true);
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);

      if (!character) {
        return interaction.reply(createEphemeralReply({
          content: 'Kamu belum memiliki karakter! Gunakan `/create-character` untuk membuat karakter.'
        }));
      }

      const result = await services.npc.interactWithNpc(character.id, npcId);

      // Format pesan berdasarkan hasil interaksi
      let responseContent = result.dialogue + '\n\n';
      if (result.availableActions.length > 0) {
        responseContent += 'Aksi yang tersedia:\n';
        responseContent += result.availableActions
          .map(action => `• ${action}`)
          .join('\n');
      }

      return interaction.reply(createEphemeralReply({
        content: responseContent
      }));
    } catch (error) {
      services.logger.error('Error in interact command:', error);
      return interaction.reply(createEphemeralReply({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
};

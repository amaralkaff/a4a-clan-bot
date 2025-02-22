import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';
import { MentorType } from '@/types/game';

export const interactNpc: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('interact')
    .setDescription('Berinteraksi dengan mentormu')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Aksi yang ingin dilakukan')
        .setRequired(true)
        .addChoices(
          { name: '🗣️ Bicara', value: 'talk' },
          { name: '⚔️ Latihan', value: 'train' }
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

      const mentor = character.mentor as MentorType;
      if (!mentor) {
        return interaction.reply(createEphemeralReply({
          content: '❌ Kamu belum memiliki mentor!'
        }));
      }

      const action = interaction.options.getString('action', true);

      switch (action) {
        case 'talk': {
          const messages = {
            'YB': '💪 "Jadilah kuat untuk melindungi teman-temanmu!"',
            'Tierison': '⚔️ "Disiplin dan latihan adalah kunci kekuatan."',
            'LYuka': '🎯 "Strategi yang baik lebih penting dari kekuatan mentah."',
            'GarryAng': '🍳 "Makanan yang baik membuat petarung yang kuat!"'
          };

          return interaction.reply(createEphemeralReply({
            content: `${mentor}: ${messages[mentor]}`
          }));
        }

        case 'train': {
          const result = await services.mentor.train(character.id, 'basic');
          return interaction.reply(createEphemeralReply({
            content: result.message
          }));
        }

        default:
          return interaction.reply(createEphemeralReply({
            content: '❌ Aksi tidak valid!'
          }));
      }
    } catch (error) {
      services.logger.error('Error in interact command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
};

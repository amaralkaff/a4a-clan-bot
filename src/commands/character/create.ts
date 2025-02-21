// src/commands/character/create.ts
import { SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const createCharacter: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('create-character')
    .setDescription('Buat karakter baru')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Nama karakter kamu')
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction, services) {
    try {
      const name = interaction.options.getString('name', true);
      const discordId = interaction.user.id;

      const character = await services.character.createCharacter({
        discordId,
        name
      });

      await interaction.reply(createEphemeralReply({
        content: `Karakter "${character.name}" berhasil dibuat!\nStats awal:\nHealth: ${character.health}\nAttack: ${character.attack}\nDefense: ${character.defense}`
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'Character already exists') {
        await interaction.reply(createEphemeralReply({
          content: 'Kamu sudah memiliki karakter!'
        }));
        return;
      }

      services.logger.error('Error creating character:', error);
      await interaction.reply(createEphemeralReply({
        content: 'Terjadi kesalahan saat membuat karakter. Silakan coba lagi.'
      }));
    }
  }
};
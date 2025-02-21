// src/commands/character/create.ts
import { SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';

export const createCommand: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Buat karakter baru')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Nama karakter kamu')
        .setRequired(true)
        .addChoices(
          { name: 'Rookie Pirate', value: 'Rookie' },
          { name: 'Aspiring Marine', value: 'Marine' },
          { name: 'Bounty Hunter', value: 'Hunter' },
          { name: 'Merchant', value: 'Merchant' }
        )
    )
    .addStringOption(option =>
      option
        .setName('mentor')
        .setDescription('Pilih mentormu')
        .setRequired(true)
        .addChoices(
          { name: 'Luffy (YB) - Combat Focus (+15% ATK, -10% DEF)', value: 'YB' },
          { name: 'Zoro (Tierison) - Explorer (+10% ATK & DEF)', value: 'Tierison' },
          { name: 'Usopp (LYuka) - Sniper (-10% ATK, +20% DEF)', value: 'LYuka' },
          { name: 'Sanji (GarryAng) - Support (+5% ATK, +15% DEF)', value: 'GarryAng' }
        )
    ),

  async execute(interaction, services) {
    try {
      const name = interaction.options.getString('name', true);
      const mentor = interaction.options.getString('mentor', true) as 'YB' | 'Tierison' | 'LYuka' | 'GarryAng';
      const discordId = interaction.user.id;

      const character = await services.character.createCharacter({
        discordId,
        name: `${name} the ${mentor} Apprentice`,
        mentor
      });

      await interaction.reply(createEphemeralReply({
        content: `Karakter "${character.name}" berhasil dibuat dengan mentor ${mentor}!\nStats awal:\nHealth: ${character.health}\nAttack: ${character.attack}\nDefense: ${character.defense}`
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
// src/commands/character/create.ts
import { SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';
import { StatusEffects, ActiveBuffs } from '@/types/game';

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
      const mentor = interaction.options.getString('mentor', true);
      const discordId = interaction.user.id;

      // Initialize empty status effects and buffs
      const initialStatusEffects: StatusEffects = { effects: [] };
      const initialActiveBuffs: ActiveBuffs = { buffs: [] };

      const character = await services.character.createCharacter({
        discordId,
        name: `${name} the ${mentor} Apprentice`,
        mentor: mentor as 'YB' | 'Tierison' | 'LYuka' | 'GarryAng'
      });

      // Format mentor bonus text
      let mentorBonusText = '';
      switch (mentor) {
        case 'YB':
          mentorBonusText = '+15% Attack, -10% Defense, +10% Health';
          break;
        case 'Tierison':
          mentorBonusText = '+10% Attack, +10% Defense';
          break;
        case 'LYuka':
          mentorBonusText = '-10% Attack, +20% Defense, +5% Health';
          break;
        case 'GarryAng':
          mentorBonusText = '+5% Attack, +15% Defense, +10% Health';
          break;
      }

      await interaction.reply(createEphemeralReply({
        content: [
          `✨ Karakter "${character.name}" berhasil dibuat!`,
          `\n👥 Mentor: ${mentor}`,
          `💫 Bonus Mentor: ${mentorBonusText}`,
          `\n📊 Stats Awal:`,
          `❤️ Health: ${character.health}/${character.maxHealth}`,
          `💪 Attack: ${character.attack}`,
          `🛡️ Defense: ${character.defense}`,
          `\n🗺️ Lokasi: ${character.currentIsland}`,
          `\nGunakan /status untuk melihat status karaktermu!`
        ].join('\n')
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'Character already exists') {
        await interaction.reply(createEphemeralReply({
          content: '❌ Kamu sudah memiliki karakter!'
        }));
        return;
      }

      services.logger.error('Error creating character:', error);
      await interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
};
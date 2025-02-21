// src/commands/character/createCharacter.ts
import { 
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags 
  } from 'discord.js';
  import { PrismaClient } from '@prisma/client';
  import { logger } from '../../utils/logger';
  import { CONFIG } from '../../config/config';
  import { createEphemeralReply } from '../../types/discord';
  
  export const data = new SlashCommandBuilder()
    .setName('create-character')
    .setDescription('Buat karakter baru')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Nama karakter kamu')
        .setRequired(true)
    );
  
  export async function execute(
    interaction: ChatInputCommandInteraction, 
    prisma: PrismaClient
  ) {
    try {
      const name = interaction.options.getString('name', true);
      const discordId = interaction.user.id;
  
      const existingUser = await prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });
  
      if (existingUser?.character) {
        return interaction.reply(createEphemeralReply({
          content: 'Kamu sudah memiliki karakter!'
        }));
      }
  
      const user = await prisma.user.create({
        data: {
          discordId,
          character: {
            create: {
              name,
              level: 1,
              experience: 0,
              health: CONFIG.STARTER_STATS.HEALTH,
              attack: CONFIG.STARTER_STATS.ATTACK,
              defense: CONFIG.STARTER_STATS.DEFENSE,
            },
          },
        },
        include: { character: true },
      });
  
      return interaction.reply(createEphemeralReply({
        content: `Karakter "${name}" berhasil dibuat! Stats awal:\nHealth: ${user.character?.health}\nAttack: ${user.character?.attack}\nDefense: ${user.character?.defense}`
      }));
    } catch (error) {
      logger.error('Error creating character:', error);
      return interaction.reply(createEphemeralReply({
        content: 'Terjadi kesalahan saat membuat karakter. Silakan coba lagi.'
      }));
    }
  }
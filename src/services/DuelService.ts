import { BaseService } from './BaseService';
import { PrismaClient } from '@prisma/client';
import { Message, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { BattleService } from './BattleService';
import { checkCooldown, setCooldown } from '@/utils/cooldown';
import { createEphemeralReply, createErrorReply } from '@/utils/helpers';
import { CharacterService } from './CharacterService';

export class DuelService extends BaseService {
  private battleService: BattleService | null = null;
  private characterService: CharacterService;

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.characterService = new CharacterService(prisma);
  }

  setBattleService(battleService: BattleService) {
    this.battleService = battleService;
  }

  async handleDuel(source: Message | ChatInputCommandInteraction, targetId: string) {
    try {
      // Check cooldown
      const userId = source instanceof Message ? source.author.id : source.user.id;
      if (!checkCooldown(userId, 'duel')) {
        return source.reply('⏰ Duel masih dalam cooldown! Tunggu beberapa saat.');
      }

      // Get challenger character
      const challenger = await this.prisma.character.findFirst({
        where: { user: { discordId: userId } }
      });

      if (!challenger) {
        return source.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      // Get challenged character
      const challenged = await this.prisma.character.findFirst({
        where: { user: { discordId: targetId } }
      });

      if (!challenged) {
        return source.reply('❌ Player yang ditantang belum memiliki karakter!');
      }

      // Check if there's already an active duel
      const existingDuel = await this.prisma.duel.findFirst({
        where: {
          OR: [
            { challengerId: challenger.id, status: 'PENDING' },
            { challengedId: challenger.id, status: 'PENDING' },
            { challengerId: challenged.id, status: 'PENDING' },
            { challengedId: challenged.id, status: 'PENDING' }
          ]
        }
      });

      if (existingDuel) {
        return source.reply('❌ Salah satu pemain sudah memiliki duel yang pending!');
      }

      // Create duel
      await this.prisma.duel.create({
        data: {
          challengerId: challenger.id,
          challengedId: challenged.id,
          status: 'PENDING'
        }
      });

      // Set cooldown
      setCooldown(userId, 'duel');

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Tantangan Duel!')
        .setColor('#ff9900')
        .setDescription(`${challenger.name} menantang ${challenged.name} untuk duel!\nGunakan \`a accept\` untuk menerima atau \`a reject\` untuk menolak.`)
        .addFields([
          { name: '👤 Penantang', value: challenger.name, inline: true },
          { name: '👥 Ditantang', value: challenged.name, inline: true }
        ]);

      return source.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleDuel:', error);
      return source.reply('❌ Terjadi kesalahan saat membuat duel.');
    }
  }

  async handleAccept(interaction: ChatInputCommandInteraction) {
    try {
      const duel = await this.prisma.duel.findFirst({
        where: {
          challengedId: interaction.user.id,
          status: 'PENDING'
        }
      });

      if (!duel) {
        return createErrorReply(interaction, 'No pending duel found.');
      }

      // Update duel status to IN_PROGRESS
      await this.prisma.duel.update({
        where: { id: duel.id },
        data: { status: 'IN_PROGRESS' }
      });

      const battleService = new BattleService(this.prisma, this.characterService);
      const battleResult = await battleService.processPvPBattle(duel.challengerId, duel.challengedId);

      // Update duel with results
      await this.prisma.duel.update({
        where: { id: duel.id },
        data: {
          status: 'COMPLETED',
          winner: battleResult.won ? duel.challengedId : duel.challengerId,
          completedAt: new Date()
        }
      });

      // Create embed for battle results
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Duel Results')
        .setDescription(battleResult.battleLog.join('\n\n'))
        .setColor(battleResult.won ? '#00ff00' : '#ff0000')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Error in handleAccept:', error);
      return createErrorReply(interaction, 'An error occurred while processing the duel.');
    }
  }

  async handleReject(source: Message | ChatInputCommandInteraction) {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      
      // Get character
      const character = await this.prisma.character.findFirst({
        where: { user: { discordId: userId } }
      });

      if (!character) {
        return source.reply('❌ Kamu belum memiliki karakter!');
      }

      // Find pending duel
      const pendingDuel = await this.prisma.duel.findFirst({
        where: {
          challengedId: character.id,
          status: 'PENDING'
        },
        include: {
          challenger: true
        }
      });

      if (!pendingDuel) {
        return source.reply('❌ Tidak ada tantangan duel yang pending!');
      }

      // Update duel status
      await this.prisma.duel.update({
        where: { id: pendingDuel.id },
        data: {
          status: 'REJECTED',
          completedAt: new Date()
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('❌ Duel Ditolak')
        .setColor('#ff0000')
        .setDescription(`${character.name} menolak tantangan duel dari ${pendingDuel.challenger.name}!`);

      return source.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleReject:', error);
      return source.reply('❌ Terjadi kesalahan saat menolak duel.');
    }
  }
} 
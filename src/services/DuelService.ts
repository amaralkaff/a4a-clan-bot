import { BaseService } from './BaseService';
import { PrismaClient, Duel } from '@prisma/client';
import { Message, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { BattleService } from './combat/BattleService';
import { checkCooldown, setCooldown } from '@/utils/cooldown';
import { createEphemeralReply, createErrorReply } from '@/utils/helpers';
import { CharacterService } from './CharacterService';
import { Cache } from '../utils/Cache';

interface CachedDuel extends Duel {
  challenger: {
    name: string;
  };
  challenged: {
    name: string;
  };
}

export class DuelService extends BaseService {
  private battleService: BattleService | null = null;
  private characterService: CharacterService;
  private duelCache: Cache<CachedDuel>;
  private readonly DUEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.characterService = new CharacterService(prisma);
    this.duelCache = new Cache<CachedDuel>(this.DUEL_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.duelCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  setBattleService(battleService: BattleService) {
    this.battleService = battleService;
  }

  private getDuelCacheKey(characterId: string): string {
    return `duel_${characterId}`;
  }

  private async findPendingDuel(characterId: string): Promise<CachedDuel | null> {
    // Check cache first
    const cacheKey = this.getDuelCacheKey(characterId);
    const cachedDuel = this.duelCache.get(cacheKey);
    if (cachedDuel) return cachedDuel;

    // If not in cache, fetch from database
    const duel = await this.prisma.duel.findFirst({
      where: {
        OR: [
          { challengerId: characterId, status: 'PENDING' },
          { challengedId: characterId, status: 'PENDING' }
        ]
      },
      include: {
        challenger: {
          select: { name: true }
        },
        challenged: {
          select: { name: true }
        }
      }
    });

    if (duel) {
      // Cache the duel
      this.duelCache.set(cacheKey, duel);
      // Also cache for the other participant
      const otherId = duel.challengerId === characterId ? duel.challengedId : duel.challengerId;
      this.duelCache.set(this.getDuelCacheKey(otherId), duel);
    }

    return duel;
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
      const existingDuel = await this.findPendingDuel(challenger.id) || await this.findPendingDuel(challenged.id);

      if (existingDuel) {
        return source.reply('❌ Salah satu pemain sudah memiliki duel yang pending!');
      }

      // Create duel
      const newDuel = await this.prisma.duel.create({
        data: {
          challengerId: challenger.id,
          challengedId: challenged.id,
          status: 'PENDING'
        },
        include: {
          challenger: {
            select: { name: true }
          },
          challenged: {
            select: { name: true }
          }
        }
      });

      // Cache the new duel
      this.duelCache.set(this.getDuelCacheKey(challenger.id), newDuel);
      this.duelCache.set(this.getDuelCacheKey(challenged.id), newDuel);

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
      const character = await this.prisma.character.findFirst({
        where: { user: { discordId: interaction.user.id } }
      });

      if (!character) {
        return createErrorReply(interaction, 'Character not found.');
      }

      // Find pending duel from cache or database
      const duel = await this.findPendingDuel(character.id);

      if (!duel) {
        return createErrorReply(interaction, 'No pending duel found.');
      }

      // Update duel status to IN_PROGRESS
      await this.prisma.duel.update({
        where: { id: duel.id },
        data: { status: 'IN_PROGRESS' }
      });

      // Clear duel from cache
      this.duelCache.delete(this.getDuelCacheKey(duel.challengerId));
      this.duelCache.delete(this.getDuelCacheKey(duel.challengedId));

      if (!this.battleService) {
        throw new Error('Battle service not initialized');
      }

      const battleResult = await this.battleService.processPvPBattle(duel.challengerId, duel.challengedId);

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

      // Find pending duel from cache or database
      const pendingDuel = await this.findPendingDuel(character.id);

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

      // Clear duel from cache
      this.duelCache.delete(this.getDuelCacheKey(pendingDuel.challengerId));
      this.duelCache.delete(this.getDuelCacheKey(pendingDuel.challengedId));

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
import { Message, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BaseService } from './BaseService';
import { PrismaClient } from '@prisma/client';
import { PaginationManager } from '@/utils/pagination';

type LeaderboardType = 'level' | 'coins' | 'bank' | 'streak' | 'highstreak' | 'wins' | 'winrate' | 'gambled' | 'won';

interface LeaderboardConfig {
  title: string;
  description: string;
  orderBy: any;
  valueFormatter: (value: any) => string;
  where?: any;
}

export class LeaderboardService extends BaseService {
  private readonly ITEMS_PER_PAGE = 10;
  private readonly LEADERBOARD_CONFIGS: Record<LeaderboardType, LeaderboardConfig> = {
    level: {
      title: '🏆 Level Leaderboard',
      description: 'Top players by level',
      orderBy: { level: 'desc' },
      valueFormatter: (value: number) => `Level ${value}`
    },
    coins: {
      title: '💰 Richest Players',
      description: 'Top players by coins',
      orderBy: { coins: 'desc' },
      valueFormatter: (value: bigint) => `${value} coins`
    },
    bank: {
      title: '🏦 Bank Leaderboard',
      description: 'Top players by bank balance',
      orderBy: { bank: 'desc' },
      valueFormatter: (value: bigint) => `${value} coins`
    },
    streak: {
      title: '🔥 Highest Hunt Streaks',
      description: 'Top players by hunt streak',
      orderBy: { huntStreak: 'desc' },
      valueFormatter: (value: number) => `${value} streak`
    },
    highstreak: {
      title: '👑 All-Time Highest Streaks',
      description: 'Top players by highest hunt streak achieved',
      orderBy: { highestHuntStreak: 'desc' },
      valueFormatter: (value: number) => `${value} streak`
    },
    wins: {
      title: '⚔️ Most Wins',
      description: 'Top players by battle wins',
      orderBy: { wins: 'desc' },
      valueFormatter: (value: number) => `${value} wins`
    },
    winrate: {
      title: '🎯 Best Win Rate',
      description: 'Top players by win/loss ratio',
      orderBy: [{ wins: 'desc' }, { losses: 'asc' }],
      valueFormatter: (char: any) => `${((char.wins / (char.wins + char.losses)) * 100).toFixed(1)}% (${char.wins}W/${char.losses}L)`,
      where: { wins: { gt: 0 } }
    },
    gambled: {
      title: '🎲 Biggest Gamblers',
      description: 'Top players by total amount gambled',
      orderBy: { totalGambled: 'desc' },
      valueFormatter: (value: bigint) => `${value} coins`
    },
    won: {
      title: '🎰 Luckiest Players',
      description: 'Top players by total gambling winnings',
      orderBy: { totalWon: 'desc' },
      valueFormatter: (value: bigint) => `${value} coins`
    }
  };

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  private async getLeaderboardData(type: LeaderboardType) {
    const config = this.LEADERBOARD_CONFIGS[type];
    if (!config) {
      throw new Error('Invalid leaderboard type');
    }

    const characters = await this.prisma.character.findMany({
      orderBy: config.orderBy,
      where: config.where,
      select: {
        name: true,
        level: true,
        coins: true,
        bank: true,
        huntStreak: true,
        highestHuntStreak: true,
        wins: true,
        losses: true,
        totalGambled: true,
        totalWon: true,
        user: {
          select: {
            discordId: true
          }
        }
      }
    });

    return characters.map(char => ({
      name: char.name,
      value: type === 'level' ? char.level :
             type === 'coins' ? char.coins :
             type === 'bank' ? char.bank :
             type === 'streak' ? char.huntStreak :
             type === 'highstreak' ? char.highestHuntStreak :
             type === 'winrate' ? char :
             type === 'gambled' ? char.totalGambled :
             type === 'won' ? char.totalWon :
             char.wins
    }));
  }

  async handleLeaderboard(
    source: Message | ChatInputCommandInteraction,
    type: LeaderboardType = 'level'
  ): Promise<void> {
    const config = this.LEADERBOARD_CONFIGS[type];
    if (!config) {
      throw new Error('Invalid leaderboard type');
    }

    const data = await this.getLeaderboardData(type);
    if (!data.length) {
      throw new Error('No data available for this leaderboard');
    }

    await PaginationManager.paginate(source, {
      items: data,
      itemsPerPage: this.ITEMS_PER_PAGE,
      embedBuilder: async (items, currentPage, totalPages) => {
        const embed = new EmbedBuilder()
          .setTitle(config.title)
          .setColor('#FFD700')
          .setDescription(config.description);

        const startRank = (currentPage - 1) * this.ITEMS_PER_PAGE;
        const entries = items.map((item, index) => {
          const position = startRank + index + 1;
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
          return `${medal} ${position}. ${item.name} - ${config.valueFormatter(item.value)}`;
        }).join('\n');

        embed.addFields({
          name: `Rankings (Page ${currentPage}/${totalPages})`,
          value: entries
        });

        embed.setFooter({ text: `Page ${currentPage}/${totalPages} • Use /leaderboard <type> <page>` });
        embed.setTimestamp();

        return embed;
      },
      ephemeral: false
    });
  }

  getAvailableTypes(): string {
    return Object.keys(this.LEADERBOARD_CONFIGS)
      .map(type => {
        const config = this.LEADERBOARD_CONFIGS[type as LeaderboardType];
        return `• ${type} - ${config.description}`;
      })
      .join('\n');
  }
} 
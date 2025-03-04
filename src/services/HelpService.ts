import { EmbedBuilder, Message, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { BaseService } from './BaseService';
import { PrismaClient } from '@prisma/client';
import { PaginationManager } from '@/utils/pagination';
import { ErrorHandler } from '@/utils/errors';
import { CharacterService } from './CharacterService';

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  'start': 'Buat karakter baru dan mulai petualanganmu',
  'hunt': 'Berburu monster untuk exp dan coins',
  'inventory': 'Lihat dan kelola inventorimu',
  'profile': 'Lihat profil dan statistik karaktermu',
  'balance': 'Cek jumlah coins yang kamu miliki',
  'duel': 'Tantang player lain untuk bertarung',
  'train': 'Latihan untuk mendapatkan exp',
  'shop': 'Kunjungi toko untuk membeli item',
  'buy': 'Beli item dari toko',
  'sell': 'Jual item ke toko',
  'use': 'Gunakan item dari inventori',
  'map': 'Lihat peta dan lokasi yang tersedia',
  'travel': 'Pindah ke lokasi lain',
  'quest': 'Lihat dan ambil quest',
  'daily': 'Klaim hadiah harian',
  'leaderboard': 'Lihat peringkat pemain'
};

export interface HelpTopic {
  title: string;
  description: string;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

export class HelpService extends BaseService {
  private readonly topics: Record<string, HelpTopic> = {
    getting_started: {
      title: '🎮 Cara Bermain',
      description: 'Selamat datang di A4A Clan Bot! Berikut adalah panduan dasar untuk memulai:',
      fields: [
        {
          name: '1️⃣ Buat Karakter',
          value: COMMAND_DESCRIPTIONS['start'] || 'Gunakan `/start` untuk membuat karakter baru. Pilih mentor yang sesuai dengan gaya bermainmu!'
        },
        {
          name: '2️⃣ Berburu Monster',
          value: COMMAND_DESCRIPTIONS['hunt'] || 'Gunakan `/hunt` atau `a h` untuk berburu monster dan mendapatkan exp & coins.'
        },
        {
          name: '3️⃣ Kelola Inventori',
          value: COMMAND_DESCRIPTIONS['inventory'] || 'Cek inventorimu dengan `/inventory` atau `a i`. Gunakan item dengan `/use [item]`.'
        },
        {
          name: '4️⃣ Tingkatkan Karakter',
          value: 'Naik level untuk meningkatkan stats. Beli equipment di `/shop` untuk tambahan stats.'
        },
        {
          name: '5️⃣ Jelajahi Dunia',
          value: COMMAND_DESCRIPTIONS['map'] || 'Kunjungi lokasi baru dengan `/map` dan selesaikan quest untuk rewards!'
        }
      ]
    },
    battle: {
      title: '⚔️ Sistem Pertarungan',
      description: 'Panduan lengkap sistem pertarungan:',
      fields: [
        {
          name: '🎯 Berburu Monster',
          value: COMMAND_DESCRIPTIONS['hunt'] || 'Gunakan `/hunt` untuk melawan monster. Level monster menyesuaikan levelmu.'
        },
        {
          name: '🤺 Duel PvP',
          value: COMMAND_DESCRIPTIONS['duel'] || 'Tantang player lain dengan `/duel @player`. Pemenang dapat exp dan coins!'
        },
        {
          name: '💪 Stats Pertarungan',
          value: '• Attack: Menentukan damage\n• Defense: Mengurangi damage\n• Speed: Menentukan urutan serangan'
        },
        {
          name: '🔄 Sistem Turn',
          value: 'Karakter dengan speed lebih tinggi menyerang duluan. Setiap turn bisa attack atau heal.'
        },
        {
          name: '💊 Healing',
          value: 'Gunakan item healing saat HP rendah. Beberapa item memberi buff tambahan.'
        }
      ]
    },
    commands: {
      title: '📝 Daftar Command',
      description: 'Berikut adalah daftar command yang tersedia:',
      fields: [
        {
          name: '📊 Stats & Profile',
          value: [
            `\`/profile\` - ${COMMAND_DESCRIPTIONS['profile']}`,
            `\`/balance\` - ${COMMAND_DESCRIPTIONS['balance']}`,
            `\`/inventory\` - ${COMMAND_DESCRIPTIONS['inventory']}`
          ].join('\n')
        },
        {
          name: '⚔️ Battle',
          value: [
            `\`/hunt\` - ${COMMAND_DESCRIPTIONS['hunt']}`,
            `\`/duel\` - ${COMMAND_DESCRIPTIONS['duel']}`,
            `\`/train\` - ${COMMAND_DESCRIPTIONS['train']}`
          ].join('\n')
        },
        {
          name: '🏪 Shop & Items',
          value: [
            `\`/shop\` - ${COMMAND_DESCRIPTIONS['shop']}`,
            `\`/buy\` - ${COMMAND_DESCRIPTIONS['buy']}`,
            `\`/sell\` - ${COMMAND_DESCRIPTIONS['sell']}`,
            `\`/use\` - ${COMMAND_DESCRIPTIONS['use']}`
          ].join('\n')
        },
        {
          name: '🗺️ Exploration',
          value: [
            `\`/map\` - ${COMMAND_DESCRIPTIONS['map']}`,
            `\`/travel\` - ${COMMAND_DESCRIPTIONS['travel'] || 'Pindah lokasi'}`,
            `\`/quest\` - ${COMMAND_DESCRIPTIONS['quest'] || 'Lihat quest'}`
          ].join('\n')
        },
        {
          name: '🎲 Misc',
          value: [
            `\`/daily\` - ${COMMAND_DESCRIPTIONS['daily']}`,
            `\`/help\` - Lihat panduan`,
            `\`/leaderboard\` - ${COMMAND_DESCRIPTIONS['leaderboard']}`
          ].join('\n')
        }
      ]
    }
  };

  private characterService: CharacterService;

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.characterService = new CharacterService(prisma);
  }

  async handleHelp(
    source: Message | ChatInputCommandInteraction,
    topic: string = 'getting_started'
  ): Promise<void> {
    try {
      const helpTopic = this.topics[topic];
      if (!helpTopic) {
        throw new Error('Topic not found');
      }

      await PaginationManager.paginate(source, {
        items: helpTopic.fields,
        itemsPerPage: 5,
        embedBuilder: async (fields, currentPage, totalPages) => {
          const embed = new EmbedBuilder()
            .setTitle(helpTopic.title)
            .setDescription(helpTopic.description)
            .setColor('#00ff00');

          fields.forEach(field => {
            embed.addFields(field);
          });

          if (totalPages > 1) {
            embed.setFooter({ text: `Page ${currentPage}/${totalPages}` });
          }

          return embed;
        },
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
  }

  async handleHelpButton(
    interaction: ButtonInteraction,
    action: 'prev' | 'next',
    topic: string,
    currentPage: number
  ): Promise<void> {
    try {
      const helpTopic = this.topics[topic];
      if (!helpTopic) {
        await interaction.reply({ content: '❌ Topic not found', ephemeral: true });
        return;
      }

      const totalPages = Math.ceil(helpTopic.fields.length / 5);
      const newPage = Math.max(1, Math.min(totalPages, action === 'prev' ? currentPage - 1 : currentPage + 1));

      const startIndex = (newPage - 1) * 5;
      const endIndex = startIndex + 5;
      const fields = helpTopic.fields.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setTitle(helpTopic.title)
        .setDescription(helpTopic.description)
        .setColor('#00ff00');

      fields.forEach(field => {
        embed.addFields(field);
      });

      if (totalPages > 1) {
        embed.setFooter({ text: `Page ${newPage}/${totalPages}` });
      }

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`prev_${topic}_${newPage}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage === 1),
          new ButtonBuilder()
            .setCustomId(`next_${topic}_${newPage}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage === totalPages)
        );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (error) {
      await interaction.reply({ 
        content: error instanceof Error ? error.message : 'An error occurred',
        ephemeral: true 
      });
    }
  }
}
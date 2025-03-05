import { EmbedBuilder, Message, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { BaseService } from './BaseService';
import { PrismaClient } from '@prisma/client';
import { ErrorHandler } from '@/utils/errors';
import { CharacterService } from './CharacterService';
import { sendResponse } from '@/utils/helpers';

const COMMAND_DESCRIPTIONS = {
  'start': 'Buat karakter baru (`/start` atau `a start`)',
  'profile': 'Lihat profil karaktermu (`/profile` atau `a p`)',
  'balance': 'Cek uangmu (`/balance` atau `a b`)',
  'inventory': 'Lihat inventorymu (`/inventory` atau `a i`)',
  'hunt': 'Berburu monster untuk exp dan coins (`/hunt` atau `a h`)',
  'duel': 'Tantang player lain untuk duel (`/duel` atau `a d`)',
  'train': 'Latihan dengan mentormu (`/train` atau `a t`)',
  'shop': 'Kunjungi toko untuk membeli item (`/shop` atau `a sh`)',
  'buy': 'Beli item dari toko (`/buy` atau `a buy`)',
  'sell': 'Jual item ke toko (`/sell` atau `a s`)',
  'use': 'Gunakan item dari inventory (`/use` atau `a u`)',
  'equip': 'Equip equipment dari inventory (`/equip` atau `a e`)',
  'unequip': 'Unequip equipment yang dipakai (`/unequip` atau `a ue`)',
  'map': 'Lihat peta dunia (`/map` atau `a m`)',
  'travel': 'Pergi ke lokasi lain (`/travel` atau `a tr`)',
  'quest': 'Lihat dan ambil quest (`/quest` atau `a q`)',
  'daily': 'Ambil hadiah harian (`/daily` atau `a daily`)',
  'help': 'Tampilkan bantuan (`/help` atau `a help`)',
  'leaderboard': 'Lihat peringkat (`/leaderboard` atau `a l`)',
  'gamble': 'Coba keberuntunganmu (`/gamble` atau `a g`)'
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
          value: 'Gunakan `/start` atau `a start <nama> <mentor>` untuk membuat karakter baru. Pilih mentor yang sesuai dengan gaya bermainmu!'
        },
        {
          name: '2️⃣ Berburu Monster',
          value: 'Gunakan `/hunt` atau `a h` untuk berburu monster dan mendapatkan exp & coins.'
        },
        {
          name: '3️⃣ Kelola Inventori',
          value: 'Cek inventorimu dengan `/inventory` atau `a i`. Gunakan item dengan `/use [item]` atau `a u [item]`.'
        },
        {
          name: '4️⃣ Tingkatkan Karakter',
          value: 'Naik level untuk meningkatkan stats. Beli equipment di `/shop` atau `a sh` untuk tambahan stats.'
        },
        {
          name: '5️⃣ Jelajahi Dunia',
          value: 'Kunjungi lokasi baru dengan `/map` atau `a m` dan selesaikan quest untuk rewards!'
        }
      ]
    },
    battle: {
      title: '⚔️ Sistem Pertarungan',
      description: 'Panduan lengkap sistem pertarungan:',
      fields: [
        {
          name: '🎯 Berburu Monster',
          value: 'Gunakan `/hunt` atau `a h` untuk melawan monster. Level monster menyesuaikan levelmu.'
        },
        {
          name: '🤺 Duel PvP',
          value: 'Tantang player lain dengan `/duel @player` atau `a d @player`. Pemenang dapat exp dan coins!'
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
          value: 'Gunakan item healing saat HP rendah dengan `/use [item]` atau `a u [item]`. Beberapa item memberi buff tambahan.'
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
            '`/profile` atau `a p` - Lihat profil',
            '`/balance` atau `a b` - Cek coins',
            '`/inventory` atau `a i` - Lihat inventori'
          ].join('\n')
        },
        {
          name: '⚔️ Battle',
          value: [
            '`/hunt` atau `a h` - Berburu monster',
            '`/duel` atau `a d` - Duel PvP',
            '`/train` atau `a t` - Latihan'
          ].join('\n')
        },
        {
          name: '🏪 Shop & Items',
          value: [
            '`/shop` atau `a sh` - Buka toko',
            '`/buy` atau `a buy` - Beli item',
            '`/sell` atau `a s` - Jual item',
            '`/use` atau `a u` - Pakai item',
            '`/equip` atau `a e` - Equip equipment',
            '`/unequip` atau `a ue` - Unequip equipment'
          ].join('\n')
        },
        {
          name: '🗺️ Exploration',
          value: [
            '`/map` atau `a m` - Lihat peta',
            '`/travel` atau `a tr` - Pindah lokasi',
            '`/quest` atau `a q` - Lihat quest'
          ].join('\n')
        },
        {
          name: '🎲 Misc',
          value: [
            '`/daily` atau `a daily` - Hadiah harian',
            '`/help` atau `a help` - Panduan',
            '`/leaderboard` atau `a l` - Peringkat',
            '`/gamble` atau `a g` - Gambling'
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

  async handleHelp(source: Message | ChatInputCommandInteraction, topic: string = 'commands'): Promise<void> {
    try {
      const helpTopic = this.topics[topic];
      if (!helpTopic) {
        throw new Error('Topic not found');
      }

      const embed = new EmbedBuilder()
        .setTitle(helpTopic.title)
        .setDescription(helpTopic.description)
        .setColor('#00ff00');

      helpTopic.fields.forEach(field => {
        embed.addFields(field);
      });

      await sendResponse(source, { 
        embeds: [embed],
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
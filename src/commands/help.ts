import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';

export const help: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tampilkan panduan bermain')
    .addStringOption(option =>
      option
        .setName('topic')
        .setDescription('Topik yang ingin dipelajari')
        .setRequired(false)
        .addChoices(
          { name: '🎮 Cara Bermain', value: 'getting_started' },
          { name: '⚔️ Sistem Pertarungan', value: 'battle' },
          { name: '🗺️ Eksplorasi', value: 'exploration' },
          { name: '📜 Quest', value: 'quest' },
          { name: '🎒 Inventaris', value: 'inventory' },
          { name: '👥 Mentor & Karakter', value: 'mentors' },
          { name: '🌤️ Cuaca', value: 'weather' }
        )
    ),

  async execute(interaction, services) {
    const topic = interaction.options.getString('topic') || 'getting_started';
    const embed = new EmbedBuilder().setColor('#0099ff');

    switch (topic) {
      case 'getting_started':
        embed
          .setTitle('🎮 Selamat Datang di A4A CLAN BOT!')
          .setDescription('Game RPG One Piece dimana kamu bisa berpetualang bersama karakter favorit dari A4A Clan!')
          .addFields(
            {
              name: '🎯 Cara Memulai',
              value: '1. Gunakan `/create` untuk membuat karakter\n2. Pilih mentor dari 4 karakter utama\n3. Mulai petualanganmu!'
            },
            {
              name: '📝 Command Dasar',
              value: '• `/status` - Cek status karaktermu\n• `/inventory` - Cek inventarismu\n• `/explore` - Jelajahi pulau\n• `/quest` - Lihat quest yang tersedia'
            },
            {
              name: '🌟 Mentor',
              value: '• **YB (Luffy)** - Fokus pertarungan (+15% Attack, -10% Defense)\n• **Tierison (Zoro)** - Fokus eksplorasi (+10% Attack & Defense)\n• **LYuka (Usopp)** - Fokus quest (-10% Attack, +20% Defense)\n• **GarryAng (Sanji)** - Fokus support (+5% Attack, +15% Defense)'
            }
          );
        break;

      case 'battle':
        embed
          .setTitle('⚔️ Sistem Pertarungan')
          .setDescription('Bertarung melawan musuh untuk mendapatkan pengalaman dan item!')
          .addFields(
            {
              name: '⚡ Combo System',
              value: '• Chain 5 serangan untuk aktivasi "Gear Second" (Luffy)\n• Gunakan "Kabuto" untuk instant-kill musuh lemah (Usopp)\n• Sanji dapat heal party 3x per hari'
            },
            {
              name: '📊 Stats',
              value: '• **Attack** - Damage yang kamu berikan\n• **Defense** - Mengurangi damage yang diterima\n• **Health** - HP karaktermu'
            },
            {
              name: '💪 Level Up',
              value: 'Setiap naik level:\n• +10 Max HP\n• +2 Attack\n• +2 Defense'
            }
          );
        break;

      case 'exploration':
        embed
          .setTitle('🗺️ Sistem Eksplorasi')
          .setDescription('Jelajahi dunia One Piece dan temukan harta karun!')
          .addFields(
            {
              name: '🏝️ Pulau',
              value: '• Starter Island - Pulau pemula\n• Shell Town - Kota pertama\n• Orange Town - Kota pedagang\n• Dan pulau tersembunyi lainnya!'
            },
            {
              name: '⛵ Navigasi',
              value: '• Gunakan `/sail` untuk berlayar ke pulau lain\n• Zoro dapat menghindari badai saat berlayar\n• Cuaca mempengaruhi kecepatan berlayar'
            },
            {
              name: '🔍 Eksplorasi',
              value: '• `/explore` untuk mencari item dan bertarung\n• Kesempatan mendapat item langka saat hujan\n• Temukan "Pop Greens" di hutan'
            }
          );
        break;

      case 'quest':
        embed
          .setTitle('📜 Sistem Quest')
          .setDescription('Selesaikan quest untuk mendapatkan hadiah dan pengalaman!')
          .addFields(
            {
              name: '📋 Tipe Quest',
              value: '• Story Quest - Quest utama cerita\n• Daily Quest - Quest harian\n• Character Quest - Quest khusus dari mentor'
            },
            {
              name: '🎁 Rewards',
              value: '• Experience Points\n• Item langka\n• Skill khusus\n• Peningkatan relasi dengan mentor'
            },
            {
              name: '🔄 Quest Chain',
              value: '• "Sogeking Unmasked" - Questline Usopp\n• "Three Swords Style" - Questline Zoro\n• "Baratie Challenge" - Questline Sanji'
            }
          );
        break;

      case 'inventory':
        embed
          .setTitle('🎒 Sistem Inventaris')
          .setDescription('Kelola item dan perlengkapanmu!')
          .addFields(
            {
              name: '📦 Item',
              value: '• Consumables - Potion, makanan\n• Equipment - Senjata, armor\n• Materials - Bahan crafting\n• Key Items - Item quest'
            },
            {
              name: '🍖 Makanan',
              value: '• Trade ikan dengan Sanji untuk buff\n• Makanan memberikan status boost\n• Beberapa buff bertahan 24 jam'
            },
            {
              name: '📝 Commands',
              value: '• `/inventory show` - Lihat inventaris\n• `/inventory use <item>` - Gunakan item\n• `/trade` - Barter dengan NPC'
            }
          );
        break;

      case 'mentors':
        embed
          .setTitle('👥 Sistem Mentor')
          .setDescription('Pelajari lebih dalam tentang sistem mentor!')
          .addFields(
            {
              name: '🌟 Luffy (YB)',
              value: '• Spesialis pertarungan\n• Gear Second setelah 5 combo\n• Bonus damage di boss fight'
            },
            {
              name: '⚔️ Zoro (Tierison)',
              value: '• Master navigasi\n• Menghindari badai saat berlayar\n• Menemukan pulau tersembunyi'
            },
            {
              name: '🎯 Usopp (LYuka)',
              value: '• Ahli strategi\n• Dapat memicu hujan untuk buff\n• Critical hit dari jarak jauh'
            },
            {
              name: '🍳 Sanji (GarryAng)',
              value: '• Support terbaik\n• Heal party 3x per hari\n• Crafting makanan dengan buff'
            }
          );
        break;

      case 'weather':
        embed
          .setTitle('🌤️ Sistem Cuaca')
          .setDescription('Cuaca mempengaruhi berbagai aspek gameplay!')
          .addFields(
            {
              name: '☀️ Cerah',
              value: '• Kecepatan berlayar normal\n• Drop rate normal\n• Perfect untuk eksplorasi'
            },
            {
              name: '🌧️ Hujan',
              value: '• Kecepatan berlayar -20%\n• Drop rate +30%\n• Kesempatan bertemu musuh berkurang'
            },
            {
              name: '⛈️ Badai',
              value: '• Kecepatan berlayar -50%\n• Drop rate +50%\n• Bahaya untuk kapal level rendah'
            }
          );
        break;
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}; 
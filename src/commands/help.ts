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
          { name: '🌤️ Cuaca', value: 'weather' },
          { name: '✨ Status Effects', value: 'effects' },
          { name: '⚡ Buffs & Debuffs', value: 'buffs' },
          { name: '🍳 Crafting', value: 'crafting' }
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
              value: [
                '• `/create` - Buat karakter baru',
                '• `/status` - Cek status karaktermu',
                '• `/interact` - Berinteraksi dengan NPC',
                '• `/inventory show` - Lihat inventarismu',
                '• `/inventory use` - Gunakan item',
                '• `/explore map` - Lihat peta',
                '• `/explore sail` - Berlayar ke pulau lain',
                '• `/explore search` - Jelajahi lokasi',
                '• `/quest list` - Lihat quest tersedia',
                '• `/quest accept` - Ambil quest',
                '• `/quest complete` - Selesaikan quest',
                '• `/crafting recipes` - Lihat resep',
                '• `/crafting craft` - Buat item',
                '• `/battle fight` - Bertarung dengan musuh'
              ].join('\n')
            },
            {
              name: '⚔️ Sistem Battle',
              value: [
                '**Cara Bertarung:**',
                '1. Gunakan `/battle fight`',
                '2. Pilih level musuh (1-10)',
                '3. Level musuh max = level karaktermu + 3',
                '',
                '**Bonus Mentor dalam Battle:**',
                '• YB (Luffy): Combo system & Gear Second',
                '  - Setelah 5 combo → Gear Second aktif',
                '  - Gear Second: 2x damage selama 3 turn',
                '',
                '• Tierison (Zoro): Critical Hit Master',
                '  - 10% chance critical hit (1.5x damage)',
                '  - 1% chance super critical (3x damage)',
                '',
                '• LYuka (Usopp): Status Effect Master',
                '  - 20% chance poison damage',
                '  - Poison damage meningkat tiap turn',
                '',
                '• GarryAng (Sanji): Support & Burn',
                '  - 15% chance burn damage',
                '  - Dapat heal party 3x per hari',
                '',
                '**Tips Battle:**',
                '• Mulai dari musuh level rendah',
                '• Gunakan item heal saat HP rendah',
                '• Manfaatkan bonus mentor',
                '• Selesaikan quest combat untuk EXP bonus'
              ].join('\n')
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
              value: [
                '• 🔥 **Gear Second** - Aktif setelah 5 combo (Luffy)',
                '  └ Damage x2 selama 3 turn',
                '',
                '• ⚔️ **Three Sword Style** - Triple damage pada critical (Zoro)',
                '',
                '• 🎯 **Kabuto** - 20% chance poison damage (Usopp)',
                '  └ Damage bertambah setiap turn',
                '',
                '• 🦵 **Black Leg** - 15% chance burn damage (Sanji)',
                '  └ Damage tetap setiap turn'
              ].join('\n')
            },
            {
              name: '📊 Stats & Damage',
              value: [
                '• 💪 **Attack** - Base damage',
                '• 🛡️ **Defense** - Damage reduction',
                '• ❤️ **Health** - HP points',
                '• 🎯 **Critical** - 10% chance (1.5x damage)',
                '• ⚡ **Super Critical** - 1% chance (3x damage)'
              ].join('\n')
            },
            {
              name: '✨ Status Effects',
              value: [
                '• 🔥 **Burn** - Fixed damage per turn',
                '• ☠️ **Poison** - Increasing damage per turn',
                '• ⚡ **Stun** - Skip turn',
                '• 💚 **Heal** - HP regen per turn'
              ].join('\n')
            },
            {
              name: '💫 Battle Rewards',
              value: [
                '• ✨ EXP berdasarkan level musuh',
                '• 💰 Bonus EXP dari combo',
                '• 📦 Drop item berdasarkan musuh',
                '• 🌟 Bonus drop dari critical hit'
              ].join('\n')
            }
          );
        break;

      case 'exploration':
        embed
          .setTitle('🗺️ Sistem Eksplorasi')
          .setDescription('Jelajahi dunia One Piece dan temukan harta karun!')
          .addFields(
            {
              name: '📝 Commands',
              value: [
                '• `/explore map` - Lihat peta dan lokasi terhubung',
                '• `/explore sail <island>` - Berlayar ke pulau lain',
                '• `/explore search` - Jelajahi lokasi saat ini'
              ].join('\n')
            },
            {
              name: '🏝️ Lokasi Tersedia',
              value: [
                '• 🌴 **Starter Island** (Level 1) - Pulau pemula',
                '• 🏘️ **Shell Town** (Level 2) - Kota marinir',
                '• 🏠 **Orange Town** (Level 2) - Kota Buggy',
                '• 🌾 **Syrup Village** (Level 3) - Desa Usopp',
                '• 🍴 **Baratie** (Level 4) - Restoran laut'
              ].join('\n')
            },
            {
              name: '⚡ Bonus Lokasi',
              value: [
                '• 🍴 **Baratie** - Regenerasi HP setiap turn',
                '• 🌾 **Syrup Village** - Defense +5 (1 jam)',
                '• 🏘️ **Shell Town** - Attack +5 (1 jam)',
                '• 🏠 **Orange Town** - Drop rate +20%'
              ].join('\n')
            },
            {
              name: '🌟 Fitur Spesial',
              value: [
                '• 🗺️ Zoro dapat menemukan jalan pintas',
                '• 🌧️ Usopp mendapat bonus di cuaca hujan',
                '• ⛵ Bonus speed saat cuaca berangin',
                '• 🛡️ Bonus defense saat berkabut'
              ].join('\n')
            }
          );
        break;

      case 'quest':
        embed
          .setTitle('📜 Sistem Quest')
          .setDescription('Selesaikan quest untuk mendapatkan hadiah dan pengalaman!')
          .addFields(
            {
              name: '📝 Commands',
              value: [
                '• `/quest list` - Lihat quest yang tersedia',
                '• `/quest accept <quest>` - Terima quest',
                '• `/quest complete <quest>` - Selesaikan quest aktif'
              ].join('\n')
            },
            {
              name: '📋 Tipe Quest',
              value: [
                '• 📖 **Story Quest** - Quest utama cerita',
                '• 📅 **Daily Quest** - Quest harian (reset 00:00)',
                '• 👥 **Character Quest** - Quest khusus mentor',
                '• 🔄 **Repeatable Quest** - Quest yang bisa diulang'
              ].join('\n')
            },
            {
              name: '🎁 Rewards',
              value: [
                '• ✨ Experience Points',
                '• 💰 Quest Points',
                '• 📦 Item langka',
                '• 💫 Skill khusus',
                '• 👥 Peningkatan relasi mentor'
              ].join('\n')
            },
            {
              name: '📊 Quest Progress',
              value: [
                '• Progress quest disimpan otomatis',
                '• Daily quest reset setiap hari 00:00',
                '• Quest points menentukan rank quest',
                '• Bonus reward dari mentor'
              ].join('\n')
            }
          );
        break;

      case 'inventory':
        embed
          .setTitle('🎒 Sistem Inventaris')
          .setDescription('Kelola item dan perlengkapanmu!')
          .addFields(
            {
              name: '📦 Tipe Item',
              value: [
                '• 🧪 **Consumables** - Potion dan makanan',
                '• ⚔️ **Equipment** - Senjata dan armor',
                '• 📦 **Materials** - Bahan crafting',
                '• 🔑 **Key Items** - Item quest'
              ].join('\n')
            },
            {
              name: '📝 Commands',
              value: [
                '• `/inventory show` - Lihat semua item',
                '• `/inventory use <item>` - Gunakan item',
                '\nItem yang dapat digunakan:',
                '• 🧪 Potion - Heal 50 HP',
                '• 🔮 Super Potion - Heal 100 HP',
                '• ⚔️ Attack Boost - ATK +5 (1 jam)',
                '• 🛡️ Defense Boost - DEF +5 (1 jam)',
                '• 🍖 Daging Super - Heal 50 HP + Buff',
                '• 🔮 Ramuan Kekuatan - ATK +15 (30 menit)'
              ].join('\n')
            },
            {
              name: '💫 Status Effects & Buffs',
              value: [
                '• Item consumable dapat memberikan status effects',
                '• Buff dari item berbeda dapat ditumpuk',
                '• Durasi buff dihitung dalam detik',
                '• Status effects dihitung dalam turn'
              ].join('\n')
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
              value: [
                '• 💪 **Combat Focus**',
                '  ├ +15% Attack',
                '  ├ -10% Defense',
                '  └ +10% Health',
                '',
                '• 🔥 **Gear Second**',
                '  ├ Aktif setelah 5 combo',
                '  ├ Damage x2 selama 3 turn',
                '  └ Reset combo setelah selesai',
                '',
                '• ⚡ **Training**',
                '  └ Attack +5 selama 1 jam'
              ].join('\n')
            },
            {
              name: '⚔️ Zoro (Tierison)',
              value: [
                '• 💪 **Explorer Focus**',
                '  ├ +10% Attack',
                '  └ +10% Defense',
                '',
                '• 🗺️ **Navigation**',
                '  ├ 30% chance jalan pintas',
                '  ├ Menemukan lokasi rahasia',
                '  └ Bonus defense saat badai',
                '',
                '• ⚡ **Training**',
                '  └ All stats +3 selama 1 jam'
              ].join('\n')
            },
            {
              name: '🎯 Usopp (LYuka)',
              value: [
                '• 💪 **Sniper Focus**',
                '  ├ -10% Attack',
                '  ├ +20% Defense',
                '  └ +5% Health',
                '',
                '• 🎯 **Critical Shot**',
                '  ├ 20% chance poison damage',
                '  ├ Damage meningkat per turn',
                '  └ Bonus accuracy saat hujan',
                '',
                '• ⚡ **Training**',
                '  └ Defense +5 selama 1 jam'
              ].join('\n')
            },
            {
              name: '🍳 Sanji (GarryAng)',
              value: [
                '• 💪 **Support Focus**',
                '  ├ +5% Attack',
                '  ├ +15% Defense',
                '  └ +10% Health',
                '',
                '• 🦵 **Black Leg**',
                '  ├ 15% chance burn damage',
                '  ├ Heal party 3x per hari',
                '  └ 20% bonus crafting',
                '',
                '• ⚡ **Training**',
                '  └ Heal 10 HP selama 5 turn'
              ].join('\n')
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
            },
            {
              name: '🌫️ Berkabut',
              value: '• Visibilitas rendah\n• Perfect untuk stealth\n• Bonus defense'
            },
            {
              name: '💨 Berangin',
              value: '• Kecepatan berlayar +20%\n• Bonus speed\n• Efektif untuk jarak jauh'
            }
          );
        break;

      case 'effects':
        embed
          .setTitle('✨ Status Effects')
          .setDescription('Efek status yang dapat mempengaruhi karaktermu!')
          .addFields(
            {
              name: '🔥 Burn',
              value: '• Damage tetap per turn\n• Dapat ditumpuk\n• Durasi dalam turn'
            },
            {
              name: '☠️ Poison',
              value: '• Damage meningkat per turn\n• Dapat ditumpuk\n• Durasi dalam turn'
            },
            {
              name: '⚡ Stun',
              value: '• Tidak bisa bergerak\n• Tidak bisa menyerang\n• Durasi dalam turn'
            },
            {
              name: '💚 Heal Over Time',
              value: '• Regenerasi HP per turn\n• Dapat ditumpuk\n• Durasi dalam turn'
            },
            {
              name: '💫 Cleansing',
              value: 'Beberapa item dapat menghapus status effects negatif'
            }
          );
        break;

      case 'buffs':
        embed
          .setTitle('⚡ Buffs & Debuffs')
          .setDescription('Peningkatan dan penurunan status sementara!')
          .addFields(
            {
              name: '⚔️ Attack Buff',
              value: '• Meningkatkan damage\n• Durasi dalam detik\n• Dapat ditumpuk'
            },
            {
              name: '🛡️ Defense Buff',
              value: '• Mengurangi damage yang diterima\n• Durasi dalam detik\n• Dapat ditumpuk'
            },
            {
              name: '💨 Speed Buff',
              value: '• Meningkatkan kecepatan\n• Bonus dodge chance\n• Durasi dalam detik'
            },
            {
              name: '🌟 All Stats Buff',
              value: '• Meningkatkan semua stats\n• Dari makanan spesial\n• Durasi dalam detik'
            },
            {
              name: '📊 Stacking',
              value: 'Buff dari sumber berbeda dapat ditumpuk'
            }
          );
        break;

      case 'crafting':
        embed
          .setTitle('🍳 Sistem Crafting')
          .setDescription('Buat item dan makanan untuk mendapatkan buff!')
          .addFields(
            {
              name: '📝 Commands',
              value: [
                '• `/crafting recipes` - Lihat resep yang tersedia',
                '• `/crafting craft <recipe>` - Buat item dari resep'
              ].join('\n')
            },
            {
              name: '🍱 Resep Dasar',
              value: [
                '• 🍱 **Hidangan Dasar**',
                '  ├ Effect: Heal 20 HP',
                '  └ Bahan: 1x Daging Mentah, 1x Rempah',
                '',
                '• 🍖 **Daging Super**',
                '  ├ Effect: Heal 50 HP',
                '  └ Bahan: 2x Daging Mentah, 1x Rempah',
                '',
                '• ⚔️ **Attack Boost**',
                '  ├ Effect: ATK +5 (1 jam)',
                '  └ Bahan: 1x Rempah, 1x Kristal',
                '',
                '• 🛡️ **Defense Boost**',
                '  ├ Effect: DEF +5 (1 jam)',
                '  └ Bahan: 1x Rempah, 1x Kristal'
              ].join('\n')
            },
            {
              name: '👨‍🍳 Resep Spesial',
              value: [
                '• 👨‍🍳 **Masakan Spesial Sanji**',
                '  ├ Effect: ATK & DEF +10 (1 jam)',
                '  └ Bahan: 2x Daging, 2x Ikan, 3x Rempah',
                '',
                '• 🔮 **Ramuan Kekuatan**',
                '  ├ Effect: ATK +15 (30 menit)',
                '  └ Bahan: 2x Kristal, 3x Rempah'
              ].join('\n')
            },
            {
              name: '💫 Bonus Crafting',
              value: [
                '• Sanji mendapat bonus 20% efektivitas',
                '• Resep spesial membutuhkan mentor tertentu',
                '• Efek buff dapat ditumpuk',
                '• Durasi buff dalam detik real-time'
              ].join('\n')
            }
          );
        break;
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}; 
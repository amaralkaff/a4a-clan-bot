import { ChatInputCommandInteraction, EmbedBuilder, Message } from 'discord.js';
import { ServiceContainer } from '@/services';
import { COMMAND_DESCRIPTIONS } from '@/commands/constants';

export async function handleHelp(source: Message | ChatInputCommandInteraction, services?: ServiceContainer) {
  const embed = new EmbedBuilder()
    .setTitle('📖 Panduan Command A4A CLAN BOT')
    .setColor('#0099ff')
    .setDescription('A4A CLAN BOT adalah game RPG One Piece. Gunakan prefix "a " sebelum setiap command.')
    .addFields([
      {
        name: '👤 Character Commands',
        value: [
          'a profile atau a p - 📊 Lihat status karaktermu',
          'a daily atau a d - 🎁 Klaim hadiah harian',
          'a balance atau a b - 💰 Cek uangmu',
          'a leaderboard atau a lb - 🏆 Lihat ranking pemain',
          'a give [user] [jumlah] - 💸 Berikan uang ke pemain lain'
        ].join('\n'),
        inline: false
      },
      {
        name: '⚔️ Battle Commands',
        value: [
          'a hunt atau a h - ⚔️ Berburu monster (15s cooldown)',
          'a duel [user] - ⚔️ Tantang pemain lain untuk duel (60s cooldown)',
          'a accept - ✅ Terima tantangan duel',
          'a reject - ❌ Tolak tantangan duel'
        ].join('\n'),
        inline: false
      },
      {
        name: '🎒 Inventory & Equipment',
        value: [
          'a inventory atau a i - 🎒 Lihat inventorymu',
          'a use [item] - 📦 Gunakan item dari inventory',
          'a equip [item] - 🔧 Pakai equipment',
          'a unequip [item] - 🔧 Lepas equipment'
        ].join('\n'),
        inline: false
      },
      {
        name: '🗺️ Location & Shop',
        value: [
          'a map atau a m - 🗺️ Lihat peta',
          'a shop atau a s - 🛍️ Buka toko',
          'a buy [item] [jumlah] - 💰 Beli item dari toko'
        ].join('\n'),
        inline: false
      },
      {
        name: '📚 Training & Quiz',
        value: [
          'a train atau a t - 📚 Berlatih dengan mentor (5m cooldown)',
          'a quiz atau a q - 📝 Ikuti quiz One Piece untuk hadiah (5m cooldown)'
        ].join('\n'),
        inline: false
      },
      {
        name: '🎰 Gambling Commands',
        value: [
          'a gamble slots [jumlah] atau a g s [jumlah] - 🎰 Main slot machine (10s cooldown)',
          'a gamble help atau a g help - ❓ Lihat panduan gambling'
        ].join('\n'),
        inline: false
      },
      {
        name: '💡 Tips',
        value: [
          '• Gunakan /a untuk command dengan animasi!',
          '• Mulai dengan berburu di Foosha Village untuk EXP dan item',
          '• Latih karaktermu dengan mentor untuk skill spesial',
          '• Upgrade equipment untuk stats lebih baik',
          '• Ikuti quiz untuk hadiah spesial'
        ].join('\n'),
        inline: false
      }
    ])
    .setFooter({ 
      text: 'Developed by A4A CLAN • Versi 1.0.0',
      iconURL: 'https://cdn.discordapp.com/emojis/1000000000000000000.png' // Replace with your bot's icon
    });

  return source.reply({ embeds: [embed] });
} 
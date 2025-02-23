import { ChatInputCommandInteraction, EmbedBuilder, Message, MessageFlags } from 'discord.js';
import { ServiceContainer } from '@/services';

export async function createHelpEmbed() {
  const commandList = [
    { cmd: '/a h', desc: '🗡️ Berburu dengan battle log animasi (15s cd)' },
    { cmd: 'a h', desc: '🗡️ Berburu tanpa animasi (15s cd)' },
    { cmd: 'a p', desc: '📊 Lihat profil' },
    { cmd: 'a d', desc: '🎁 Daily reward' },
    { cmd: 'a i', desc: '🎒 Inventory' },
    { cmd: 'a u', desc: '📦 Gunakan item' },
    { cmd: 'a b', desc: '💰 Balance' },
    { cmd: 'a t', desc: '⚔️ Training (5m cd)' },
    { cmd: 'a m', desc: '🗺️ Map' },
    { cmd: 'a s', desc: '🛍️ Shop' },
    { cmd: 'a lb', desc: '👑 Leaderboard' }
  ];

  return new EmbedBuilder()
    .setTitle('A4A CLAN BOT - Panduan')
    .setColor('#00ff00')
    .setDescription('A4A CLAN BOT adalah game RPG One Piece yang dikembangkan oleh <@714556781912653855>')
    .addFields([
      { 
        name: '📜 Basic Commands', 
        value: commandList.map(c => `\`${c.cmd}\` - ${c.desc}`).join('\n')
      },
      {
        name: '💡 Perbedaan Hunt Command',
        value: '• `/a h` - Dengan battle log animasi\n• `a h` - Langsung hasil akhir'
      },
      {
        name: '📊 Leaderboard',
        value: 'Gunakan `a lb [kategori]` untuk melihat leaderboard:\n• level - Level tertinggi\n• wins - Total kemenangan\n• coins - Total kekayaan\n• winStreak - Win streak saat ini\n• highestStreak - Win streak tertinggi'
      },
      {
        name: '🎮 Tips',
        value: 'Gunakan `/a h` untuk melihat battle log animasi saat berburu!\nMulai dengan berburu di Foosha Village untuk mendapatkan EXP dan item!'
      }
    ]);
}

export async function handleHelpMessage(message: Message, services: ServiceContainer) {
  const embed = await createHelpEmbed();
  return message.reply({ embeds: [embed] });
}

export async function handleHelp(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const embed = await createHelpEmbed();
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
} 
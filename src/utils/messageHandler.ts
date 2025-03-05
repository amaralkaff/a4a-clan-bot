import { Message, EmbedBuilder } from 'discord.js';
import { ServiceContainer } from '../services';
import { logger } from './logger';
import { ErrorHandler } from '@/utils/errors';
import { LocationId } from '@/types/game';

type LeaderboardType = 'level' | 'coins' | 'bank' | 'streak' | 'highstreak' | 'wins' | 'winrate' | 'gambled' | 'won';

const COMMAND_ALIASES: Record<string, string> = {
  // Profile & Stats
  'p': 'profile',
  'b': 'balance',
  'i': 'inventory',
  
  // Battle
  'h': 'hunt',
  'd': 'duel',
  't': 'train',
  
  // Shop & Items
  'sh': 'shop',
  'buy': 'buy',
  's': 'sell',
  'u': 'use',
  'e': 'equip',
  'ue': 'unequip',
  
  // Map & Exploration
  'm': 'map',
  'tr': 'travel',
  'q': 'quiz',
  
  // Misc
  'daily': 'daily',
  'help': 'help',
  'l': 'leaderboard',
  'g': 'gamble',
  'start': 'start'
};

export async function handleMessageCommand(message: Message, services: ServiceContainer): Promise<void> {
  if (!message.content.startsWith('a ')) return;

  const args = message.content.slice(2).trim().split(/ +/);
  const command = args.shift()?.toLowerCase() || '';

  // Convert alias to full command name
  const fullCommand = COMMAND_ALIASES[command] || command;

  try {
    switch (fullCommand) {
      // Character Creation
      case 'start':
        // Check if user already has a character
        const existingCharacter = await services.character.getCharacterByDiscordId(message.author.id);
        if (existingCharacter) {
          await message.reply('❌ Kamu sudah memiliki karakter! Gunakan `a p` untuk melihat karaktermu.');
          return;
        }

        // For message commands, show a more helpful message
        const embed = new EmbedBuilder()
          .setTitle('🎮 Buat Karakter Baru')
          .setDescription('Untuk membuat karakter baru, gunakan command:\n`a start <nama> <mentor>`\n\nContoh:\n`a start AmangLy YB`\n\nPilih mentor yang sesuai dengan gaya bermainmu:')
          .addFields(
            { 
              name: '🏴‍☠️ YB (Luffy)',
              value: '+15% Attack, -10% Defense, +10% Health, +20% Speed\nCocok untuk pemain agresif yang suka menyerang.',
              inline: true
            },
            {
              name: '⚔️ Tierison (Zoro)',
              value: '+10% Attack, +10% Defense, +10% Speed\nSeimbang untuk semua situasi.',
              inline: true
            },
            {
              name: '🎯 LYuka (Usopp)',
              value: '-10% Attack, +20% Defense, +5% Health, +15% Speed\nCocok untuk pemain yang suka bertahan.',
              inline: true
            },
            {
              name: '🔥 GarryAng (Sanji)',
              value: '+5% Attack, +15% Defense, +10% Health, +30% Speed\nCocok untuk pemain yang suka combo dan dodge.',
              inline: true
            }
          )
          .setColor('#00ff00')
          .setFooter({ text: 'Gunakan format: a start <nama> <mentor>' });

        // If no arguments provided, show help message
        if (args.length === 0) {
          await message.reply({ embeds: [embed] });
          return;
        }

        // If arguments provided, try to create character
        if (args.length < 2) {
          await message.reply('❌ Format tidak valid! Gunakan: `a start <nama> <mentor>`\nContoh: `a start AmangLy YB`');
          return;
        }

        const name = args[0];
        const mentor = args[1].toUpperCase();

        // Validate mentor
        if (!['YB', 'TIERISON', 'LYUKA', 'GARRYANG'].includes(mentor)) {
          await message.reply('❌ Mentor tidak valid! Pilih dari: YB, Tierison, LYuka, atau GarryAng');
          return;
        }

        // Create character
        try {
          const character = await services.character.createCharacter({
            name,
            mentor: mentor as any,
            discordId: message.author.id
          });

          const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Selamat Datang di A4A Clan!')
            .setDescription(`Karaktermu berhasil dibuat!\n\nNama: ${character.name}\nMentor: ${mentor}`)
            .setColor('#00ff00')
            .addFields(
              { 
                name: '📊 Stats', 
                value: [
                  `⚔️ Attack: ${character.attack}`,
                  `🛡️ Defense: ${character.defense}`,
                  `❤️ Health: ${character.health}`,
                  `💨 Speed: ${character.speed}`
                ].join('\n'),
                inline: true 
              },
              { 
                name: '💰 Balance', 
                value: [
                  `Coins: ${character.coins}`,
                  `Bank: ${character.bank}`
                ].join('\n'),
                inline: true 
              },
              { 
                name: '📜 Langkah Selanjutnya', 
                value: [
                  '• Gunakan `a h` untuk berburu dan mendapatkan exp',
                  '• Cek profilmu dengan `a p`',
                  '• Beli equipment di `a sh`',
                  '• Lihat inventory dengan `a i`'
                ].join('\n')
              }
            );

          await message.reply({ embeds: [welcomeEmbed] });
        } catch (error) {
          await message.reply('❌ Gagal membuat karakter! Pastikan nama belum digunakan dan mentor valid.');
        }
        break;

      // Profile & Stats
      case 'profile':
      case 'p':
        await services.character.handleProfile(message);
        break;

      case 'balance':
      case 'b':
        await services.character.handleBalance(message);
        break;

      case 'inventory':
      case 'i':
        await services.inventory.handleInventoryView(message);
        break;

      // Battle
      case 'hunt':
      case 'h':
        await services.character.handleHunt(message);
        break;

      case 'duel':
      case 'd':
        if (args.length === 0) {
          await message.reply('❌ Tag player yang ingin ditantang! Contoh: `a d @player`');
          return;
        }
        await services.duel.handleDuel(message, args[0]);
        break;

      case 'train':
      case 't':
        await services.mentor.handleTraining(message);
        break;

      // Shop & Items
      case 'shop':
      case 'sh':
        await services.shop.handleShop(message);
        break;

      case 'buy':
        if (args.length === 0) {
          await message.reply('❌ Sebutkan item yang ingin dibeli! Contoh: `a buy health_potion`');
          return;
        }
        await services.shop.handleBuyCommand(message, args);
        break;

      case 'sell':
        if (args.length === 0) {
          await message.reply('❌ Sebutkan item yang ingin dijual! Contoh: `a sell health_potion`');
          return;
        }
        await services.inventory.handleSellItem(message, args);
        break;

      case 'use':
      case 'u':
        if (args.length === 0) {
          await message.reply('❌ Sebutkan item yang ingin digunakan! Contoh: `a u health_potion`');
          return;
        }
        await services.inventory.handleUseItem(message, args.join(' '));
        break;

      case 'equip':
      case 'e':
        if (args.length === 0) {
          await message.reply('❌ Sebutkan item yang ingin diequip! Contoh: `a equip wooden sword`');
          return;
        }
        await services.equipment.handleEquipCommand(message, args);
        break;

      case 'unequip':
      case 'ue':
        if (args.length === 0) {
          await message.reply('❌ Sebutkan slot yang ingin diunequip! Contoh: `a unequip weapon`');
          return;
        }
        await services.equipment.handleUnequipCommand(message, args);
        break;

      // Map & Exploration
      case 'map':
      case 'm':
        await services.location.handleMapView(message);
        break;

      case 'travel':
      case 'tr':
        if (args.length === 0) {
          await message.reply('❌ Sebutkan lokasi tujuan! Contoh: `a tr foosha`');
          return;
        }
        // Convert location name to ID format
        const locationInput = args.join('_').toLowerCase();
        // Remove any special characters and emojis
        const cleanLocation = locationInput.replace(/[^\w_]/g, '');
        const result = await services.location.travel(message.author.id, cleanLocation as LocationId);
        await message.reply(result.message);
        break;

      case 'quiz':
      case 'q':
        await services.quiz.startQuiz(message);
        break;

      // Misc
      case 'daily':
        await services.character.handleDaily(message);
        break;

      case 'help':
        await services.help.handleHelp(message);
        break;

      case 'leaderboard':
      case 'l':
        await services.leaderboard.handleLeaderboard(message, args[0] as LeaderboardType);
        break;

      case 'gamble':
      case 'g':
        if (args.length < 1) {
          await message.reply('❌ Masukkan jumlah coins untuk gambling! Contoh: `a g 1000`');
          return;
        }
        await services.gambling.handleSlots(message, parseInt(args[0]));
        break;

      default:
        await message.reply('❌ Command tidak ditemukan. Gunakan `a help` untuk melihat daftar command.');
        break;
    }
  } catch (error) {
    logger.error('Command execution error:', error);
    await ErrorHandler.handle(error, message);
  }
} 
import { Message, ChatInputCommandInteraction } from 'discord.js';
import { ServiceContainer } from '@/services';

export async function handleGambling(
  source: Message | ChatInputCommandInteraction,
  services: ServiceContainer,
  subcommand?: string,
  args?: string[]
) {
  const { gambling } = services;

  // Handle slots command
  if (!subcommand || subcommand === 'slots' || subcommand === 's') {
    let betAmount = 100; // Default bet

    if (args && args.length > 0) {
      const amount = parseInt(args[0]);
      if (isNaN(amount)) {
        return source.reply('❌ Please enter a valid bet amount!');
      }
      betAmount = amount;
    }

    return gambling.handleSlots(source, betAmount);
  }

  // Handle help command
  if (subcommand === 'help' || subcommand === 'h') {
    return source.reply(`
🎰 **Panduan Gambling**
\`a gamble slots [jumlah]\` atau \`a g s [jumlah]\` - Main slot machine (10s cooldown)
\`a gamble help\` atau \`a g help\` - Lihat panduan gambling

**Bet Limits**
• Minimum bet: 100 coins
• Maximum bet: 50,000 coins

**Slot Machine Prizes**
🍒 Cherry - 2x
🍊 Orange - 3x
🍇 Grape - 4x
🍎 Apple - 5x
💎 Diamond - 10x
👑 Crown - 15x

Match 3 symbols to win! Good luck! 🎲
    `.trim());
  }

  // Invalid subcommand
  return source.reply('❌ Command tidak valid! Gunakan `a g help` untuk melihat panduan gambling.');
} 
import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { CharacterService } from './CharacterService';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createEphemeralReply } from '@/utils/helpers';
import { logger } from '@/utils/logger';

const COOLDOWN_TIME = 10000; // 10 seconds
const MIN_BET = 100;
const MAX_BET = 50000;

interface SlotSymbol {
  emoji: string;
  name: string;
  multiplier: number;
  weight: number;
}

const SLOT_SYMBOLS: SlotSymbol[] = [
  { emoji: '🍒', name: 'cherry', multiplier: 2, weight: 30 },
  { emoji: '🍊', name: 'orange', multiplier: 3, weight: 25 },
  { emoji: '🍇', name: 'grape', multiplier: 4, weight: 20 },
  { emoji: '🍎', name: 'apple', multiplier: 5, weight: 15 },
  { emoji: '💎', name: 'diamond', multiplier: 10, weight: 7 },
  { emoji: '👑', name: 'crown', multiplier: 15, weight: 3 }
];

const ANIMATIONS = [
  ['🎰 spinning...', '💫 spinning...', '✨ spinning...'],
  ['🎲 rolling...', '🎲 rolling...', '🎲 rolling...'],
  ['🌟 magic...', '💫 magic...', '✨ magic...']
];

export class GamblingService extends BaseService {
  private characterService: CharacterService;
  private lastGambleTime: Map<string, number> = new Map();

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  private getRandomSymbol(): SlotSymbol {
    const totalWeight = SLOT_SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const symbol of SLOT_SYMBOLS) {
      random -= symbol.weight;
      if (random <= 0) {
        return symbol;
      }
    }
    
    return SLOT_SYMBOLS[0];
  }

  private async checkCooldown(userId: string): Promise<{ canGamble: boolean; timeLeft: number }> {
    const lastTime = this.lastGambleTime.get(userId) || 0;
    const now = Date.now();
    const timeLeft = Math.max(0, COOLDOWN_TIME - (now - lastTime));
    
    return {
      canGamble: timeLeft === 0,
      timeLeft: Math.ceil(timeLeft / 1000)
    };
  }

  private async animateSlots(message: Message | ChatInputCommandInteraction, bet: number): Promise<{
    symbols: SlotSymbol[];
    multiplier: number;
    won: boolean;
  }> {
    const symbols: SlotSymbol[] = [];
    const animation = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
    
    // First animation phase
    const response = await message.reply('🎰 Starting slot machine...');
    
    // Animate spinning
    for (const frame of animation) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await response.edit(frame);
    }
    
    // Generate results
    for (let i = 0; i < 3; i++) {
      symbols.push(this.getRandomSymbol());
    }
    
    // Calculate win
    const allSame = symbols.every(s => s.emoji === symbols[0].emoji);
    const multiplier = allSame ? symbols[0].multiplier : 0;
    const won = multiplier > 0;
    
    // Show final result
    const resultEmbed = new EmbedBuilder()
      .setTitle('🎰 Slot Machine')
      .setDescription(`${symbols.map(s => s.emoji).join(' | ')}`)
      .addFields([
        { name: 'Bet', value: `${bet} 💰`, inline: true },
        { name: 'Result', value: won ? `Won ${bet * multiplier} 💰` : 'Lost 😢', inline: true }
      ])
      .setColor(won ? '#00ff00' : '#ff0000')
      .setTimestamp();

    await response.edit({ content: null, embeds: [resultEmbed] });
    
    return { symbols, multiplier, won };
  }

  async handleSlots(source: Message | ChatInputCommandInteraction, betAmount: number) {
    const userId = source instanceof Message ? source.author.id : source.user.id;
    
    // Check cooldown
    const { canGamble, timeLeft } = await this.checkCooldown(userId);
    if (!canGamble) {
      return source.reply(`⏰ Please wait ${timeLeft} seconds before gambling again!`);
    }

    // Validate bet amount
    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      return source.reply(`❌ Bet amount must be between ${MIN_BET} and ${MAX_BET} coins!`);
    }

    // Get character
    const character = await this.characterService.getCharacterByDiscordId(userId);
    if (!character) {
      return source.reply('❌ You need to create a character first! Use `/start` to begin.');
    }

    // Check if player has enough coins
    if (character.coins < betAmount) {
      return source.reply('❌ You don\'t have enough coins!');
    }

    try {
      // Remove bet amount
      await this.characterService.removeCoins(character.id, betAmount, 'GAMBLE_BET', 'Slot machine bet');
      
      // Run slot machine with animation
      const { symbols, multiplier, won } = await this.animateSlots(source, betAmount);
      
      // Process result
      if (won) {
        const winAmount = betAmount * multiplier;
        await this.characterService.addCoins(character.id, winAmount, 'GAMBLE_WIN', 'Slot machine win');
      }
      
      // Update gambling stats
      await this.characterService.updateGamblingStats(character.id, betAmount, won);
      
      // Set cooldown
      this.lastGambleTime.set(userId, Date.now());
      
    } catch (error) {
      logger.error('Error in handleSlots:', error);
      return source.reply('❌ An error occurred while processing your bet!');
    }
  }
} 
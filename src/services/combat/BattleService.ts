import { PrismaClient } from '@prisma/client';
import { CharacterService } from '../CharacterService';
import { Cache } from '../../utils/Cache';
import { BaseCombatService, CombatantFactory, MonsterFactory } from './BaseCombatService';
import { CombatResult, CombatParticipant } from '@/types/combat';
import { EmbedFactory } from '@/utils/embedBuilder';
import { EmbedBuilder } from 'discord.js';
import { DataCache } from '../DataCache';
import { CachedMonster, CharacterWithEquipment } from '@/types/game';
import { CharacterError } from '@/utils/errors';
import { BattleState } from '@/types/combat';

export interface BattleResponse {
  result: CombatResult;
  embed: EmbedBuilder;
}

export class BattleService extends BaseCombatService {
  private monsterCache: Cache<CachedMonster>;
  private readonly MONSTER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  protected readonly dataCache: DataCache;

  constructor(
    prisma: PrismaClient,
    characterService: CharacterService,
    dataCache: DataCache
  ) {
    super(prisma, characterService, dataCache);
    this.monsterCache = new Cache<CachedMonster>(this.MONSTER_CACHE_TTL);
    this.dataCache = dataCache;

    // Set up periodic cache cleanup
    setInterval(() => {
      this.monsterCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  getBattleStatesCache(): Cache<BattleState> {
    return this.battleStatesCache;
  }

  private getMonsterCacheKey(level: number, huntStreak: number): string {
    return `monster_${level}_${huntStreak}`;
  }

  private calculateStreakBonuses(huntStreak: number): {
    expMultiplier: number;
    coinsMultiplier: number;
    dropChanceBonus: number;
    statBonus: number;
  } {
    // Base multipliers start at 1.0 (no bonus)
    const baseExpMultiplier = 1.0;
    const baseCoinsMultiplier = 1.0;
    const baseDropChanceBonus = 0.0;
    const baseStatBonus = 0.0;

    // Calculate streak-based bonuses
    // Every 5 streak gives bigger bonuses
    const streakTier = Math.floor(huntStreak / 5);
    
    // Exp bonus: +10% per tier, max 100% bonus
    const expBonus = Math.min(streakTier * 0.1, 1.0);
    
    // Coins bonus: +15% per tier, max 150% bonus
    const coinsBonus = Math.min(streakTier * 0.15, 1.5);
    
    // Drop chance: +2% per tier, max 20% bonus
    const dropBonus = Math.min(streakTier * 0.02, 0.2);
    
    // Combat stat bonus: +3% per tier, max 30% bonus
    const statsBonus = Math.min(streakTier * 0.03, 0.3);

    return {
      expMultiplier: baseExpMultiplier + expBonus,
      coinsMultiplier: baseCoinsMultiplier + coinsBonus,
      dropChanceBonus: baseDropChanceBonus + dropBonus,
      statBonus: baseStatBonus + statsBonus
    };
  }

  private getRandomMonster(level: number, huntStreak: number = 0): CachedMonster {
    const cacheKey = this.getMonsterCacheKey(level, huntStreak);
    const cachedMonster = this.monsterCache.get(cacheKey);
    if (cachedMonster) return cachedMonster;

    // Filter monsters by level
    const monsters = this.dataCache.getMonsters();
    const availableMonsters = Object.entries(monsters)
      .filter(([_, monster]) => monster.level <= level)
      .map(([id, monster]) => ({ id, monster }));

    if (availableMonsters.length === 0) {
      throw new Error('No monsters available for this level');
    }

    // Select random monster
    const { id, monster } = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
    
    // Convert to CachedMonster
    const newMonster = MonsterFactory.fromJsonMonster(monster, id, cacheKey);
    
    // Cache the monster
    this.monsterCache.set(cacheKey, newMonster);
    
    return newMonster;
  }

  async processBattle(characterId: string, enemyLevel: number): Promise<BattleResponse> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          inventory: {
            where: {
              isEquipped: true
            },
            include: {
              item: true
            }
          },
          user: true
        }
      }) as unknown as CharacterWithEquipment;

      if (!character) {
        throw new CharacterError('❌ Karakter tidak ditemukan! Gunakan `/start` untuk membuat karakter baru.', 'CHARACTER_NOT_FOUND');
      }

      // Initialize battle state
      const battleState = await this.initBattleState(characterId);

      // Get random monster
      const monster = this.getRandomMonster(enemyLevel, character.huntStreak || 0);

      // Calculate streak bonuses
      const streakBonuses = this.calculateStreakBonuses(character.huntStreak || 0);

      // Convert character to CombatParticipant with streak stat bonuses
      const player = CombatantFactory.fromCharacter(character);
      if (streakBonuses.statBonus > 0) {
        player.attack = Math.floor(player.attack * (1 + streakBonuses.statBonus));
        player.defense = Math.floor(player.defense * (1 + streakBonuses.statBonus));
        player.speed = Math.floor((player.speed || 10) * (1 + streakBonuses.statBonus));
      }

      // Convert monster to CombatParticipant
      const enemy = MonsterFactory.toCombatParticipant(monster);

      const battleLog: string[] = [];
      let playerHealth = player.health;
      let monsterHealth = enemy.health;
      let turn = 1;
      
      // Track total damage
      let totalPlayerDamage = 0;
      let totalMonsterDamage = 0;

      // Add battle start message with clean formatting
      battleLog.push(
        `${'```ansi'}\n` +
        `⚔️ \u001b[1;36m${player.name}\u001b[0m Lv.${player.level} vs \u001b[1;31m${enemy.name}\u001b[0m Lv.${enemy.level}\n` +
        `${'```'}`
      );

      // Battle loop
      while (playerHealth > 0 && monsterHealth > 0 && turn <= 50) {
        const roundResult = await this.processCombatRound(
          { first: player, second: enemy },
          { firstState: battleState, secondState: battleState },
          { firstHealth: playerHealth, secondHealth: monsterHealth },
          turn,
          true // isMonster
        );

        playerHealth = roundResult.newFirstHealth;
        monsterHealth = roundResult.newSecondHealth;
        
        // Calculate damage dealt this round
        const playerDamageThisRound = Math.max(0, enemy.health - monsterHealth);
        const monsterDamageThisRound = Math.max(0, player.health - playerHealth);
        totalPlayerDamage += playerDamageThisRound;
        totalMonsterDamage += monsterDamageThisRound;

        // Add simplified round summary
        battleLog.push(
          `${'```'}\n` +
          `${player.name}: ${Math.max(0, playerHealth)}/${player.maxHealth}\n` +
          `${enemy.name}: ${Math.max(0, monsterHealth)}/${enemy.maxHealth}\n` +
          `${'```'}`
        );

        turn++;
      }

      const won = playerHealth > 0;

      // Add battle end message
      battleLog.push(
        `${'```ansi'}\n` +
        `${won ? '🎉 ' : '💀 '}\u001b[1;${won ? '32' : '31'}m${won ? 'VICTORY' : 'DEFEAT'}\u001b[0m\n` +
        `DMG Dealt: ${totalPlayerDamage} | DMG Taken: ${totalMonsterDamage}\n` +
        `${'```'}`
      );

      // If won, add rewards summary
      if (won) {
        const expGain = Math.floor(monster.exp * streakBonuses.expMultiplier);
        const coinsGain = Math.floor(monster.coins * streakBonuses.coinsMultiplier);
        const newStreak = (character.huntStreak || 0) + 1;

        battleLog.push(
          `${'```ansi'}\n` +
          `\u001b[1;33m✨ ${expGain} EXP\u001b[0m | \u001b[1;33m💰 ${coinsGain} Coins\u001b[0m\n` +
          `🔥 Streak: ${newStreak}\n` +
          `${'```'}`
        );
      }

      // Verify character still exists before updating
      const characterCheck = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true }
      });

      if (!characterCheck) {
        throw new CharacterError('❌ Karakter tidak ditemukan! Mungkin karakter telah dihapus.', 'CHARACTER_NOT_FOUND');
      }

      // Update character stats in transaction with increased timeout
      await this.prisma.$transaction(async (tx) => {
        const txCharacter = await tx.character.findUnique({
          where: { id: characterId },
          select: { 
            id: true,
            huntStreak: true,
            highestHuntStreak: true,
            mentor: true,
            experience: true,
            level: true
          }
        });

        if (!txCharacter) {
          throw new CharacterError('❌ Karakter tidak ditemukan saat update!', 'CHARACTER_NOT_FOUND');
        }

        // Calculate new hunt streak and highest streak
        const newHuntStreak = won ? (txCharacter.huntStreak || 0) + 1 : 0;
        const newHighestStreak = Math.max(newHuntStreak, txCharacter.highestHuntStreak || 0);

        // Calculate experience gain if won
        let expUpdate = {};
        if (won) {
          // Apply streak exp bonus
          const bonusExp = Math.floor(monster.exp * streakBonuses.expMultiplier);
          let newExp = BigInt(txCharacter.experience) + BigInt(bonusExp);
          let levelsGained = 0;
          let currentLevel = txCharacter.level;

          // Calculate levels gained
          while (Number(newExp) >= this.characterService.calculateExpNeeded(currentLevel)) {
            const expNeeded = this.characterService.calculateExpNeeded(currentLevel);
            newExp = BigInt(Number(newExp) - expNeeded);
            currentLevel++;
            levelsGained++;
          }

          // Calculate stat gains if leveled up
          const statsGained = levelsGained > 0 ? this.characterService.calculateStatGains(txCharacter.level, levelsGained) : undefined;

          expUpdate = {
            experience: Number(newExp),
            level: currentLevel,
            ...(statsGained && {
              attack: { increment: statsGained.attack },
              defense: { increment: statsGained.defense },
              maxHealth: { increment: statsGained.maxHealth },
              speed: { increment: statsGained.speed }
            })
          };
        }

        // Apply streak coin bonus
        const bonusCoins = won ? Math.floor(monster.coins * streakBonuses.coinsMultiplier) : 0;

        // Update character stats
        await tx.character.update({
          where: { id: characterId },
          data: {
            health: Math.max(0, playerHealth),
            huntStreak: newHuntStreak,
            highestHuntStreak: newHighestStreak,
            coins: won ? { increment: bonusCoins } : undefined,
            ...expUpdate
          }
        });

        // Update mentor progress if character has a mentor
        if (won && txCharacter.mentor) {
          // Increase mentor progress based on streak
          const baseProgressGain = 1;
          const bonusProgress = Math.floor(baseProgressGain * streakBonuses.expMultiplier);
          const progressField = {
            'YB': 'luffyProgress',
            'Tierison': 'zoroProgress',
            'LYuka': 'usoppProgress',
            'GarryAng': 'sanjiProgress'
          }[txCharacter.mentor];

          if (progressField) {
            await tx.character.update({
              where: { id: characterId },
              data: {
                [progressField]: { increment: bonusProgress }
              }
            });
          }
        }
      }, {
        timeout: 10000 // Increase timeout to 10 seconds
      });

      // Invalidate caches after all updates
      await this.characterService.invalidateAllCaches(characterId);

      const result: CombatResult = {
        won,
        battleLog,
        finalHealth: Math.max(0, playerHealth),
        exp: won ? Math.floor(monster.exp * streakBonuses.expMultiplier) : 0,
        coins: won ? Math.floor(monster.coins * streakBonuses.coinsMultiplier) : 0,
        monster: {
          name: monster.name,
          level: monster.level
        },
        streakInfo: won ? {
          streak: (character.huntStreak || 0) + 1,
          expBonus: `${Math.floor((streakBonuses.expMultiplier - 1) * 100)}%`,
          coinsBonus: `${Math.floor((streakBonuses.coinsMultiplier - 1) * 100)}%`,
          dropBonus: `${Math.floor(streakBonuses.dropChanceBonus * 100)}%`
        } : undefined
      };

      const response: BattleResponse = {
        result,
        embed: EmbedFactory.buildBattleResultEmbed(result)
      };

      return response;
    } catch (error) {
      this.logger.error('Error in processBattle:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  }

  async processPvPBattle(challengerId: string, challengedId: string): Promise<{
    won: boolean;
    battleLog: string[];
    finalHealth: number;
  }> {
    const challenger = await this.prisma.character.findUnique({
      where: { id: challengerId }
    }) as unknown as CharacterWithEquipment;

    const challenged = await this.prisma.character.findUnique({
      where: { id: challengedId }
    }) as unknown as CharacterWithEquipment;

    if (!challenger || !challenged) {
      throw new Error('One or both characters not found');
    }

    // Convert characters to CombatParticipants
    const player1 = CombatantFactory.fromCharacter(challenger);
    const player2 = CombatantFactory.fromCharacter(challenged);

    // Initialize battle states
    const [player1State, player2State] = await Promise.all([
      this.initBattleState(player1.id),
      this.initBattleState(player2.id)
    ]);

    const battleLog: string[] = [];
    battleLog.push(`${'```'}\n⚔️ ${player1.name} VS ${player2.name}\n${'```'}`);

    let player1Health = player1.health;
    let player2Health = player2.health;
    let turn = 1;

    // Battle loop
    while (player1Health > 0 && player2Health > 0) {
      const roundResult = await this.processCombatRound(
        { first: player1, second: player2 },
        { firstState: player1State, secondState: player2State },
        { firstHealth: player1Health, secondHealth: player2Health },
        turn
      );

      player1Health = roundResult.newFirstHealth;
      player2Health = roundResult.newSecondHealth;
      battleLog.push(...roundResult.roundLog);

      turn++;
    }

    // Update character health
    await this.updateCombatResults(
      { first: player1, second: player2 },
      { firstHealth: player1Health, secondHealth: player2Health }
    );

    // Victory condition: Player 2 HP <= 0 AND Player 1 HP > 0
    const player2Won = player1Health <= 0 && player2Health > 0;

    return {
      won: player2Won,
      battleLog,
      finalHealth: Math.max(0, player2Health)
    };
  }

  private createHealthBar(current: number, max: number): string {
    const barLength = 10;
    const currentHealth = Math.max(0, current); // Ensure health is not negative
    const filledBars = Math.min(barLength, Math.max(0, Math.round((currentHealth / max) * barLength)));
    const emptyBars = barLength - filledBars;
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  }
} 
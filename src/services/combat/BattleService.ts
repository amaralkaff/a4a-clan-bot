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
  private readonly dataCache: DataCache;

  constructor(prisma: PrismaClient, characterService?: CharacterService) {
    super(prisma, characterService);
    this.monsterCache = new Cache<CachedMonster>(this.MONSTER_CACHE_TTL);
    this.dataCache = DataCache.getInstance();

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

      // Convert character to CombatParticipant
      const player = CombatantFactory.fromCharacter(character);

      // Convert monster to CombatParticipant
      const enemy = MonsterFactory.toCombatParticipant(monster);

      const battleLog: string[] = [];
      let playerHealth = player.health;
      let monsterHealth = enemy.health;
      let turn = 1;

      // Battle loop
      while (playerHealth > 0 && monsterHealth > 0 && turn <= 50) { // Add max turns limit
        const roundResult = await this.processCombatRound(
          { first: player, second: enemy },
          { firstState: battleState, secondState: battleState },
          { firstHealth: playerHealth, secondHealth: monsterHealth },
          turn,
          true // isMonster
        );

        playerHealth = roundResult.newFirstHealth;
        monsterHealth = roundResult.newSecondHealth;
        battleLog.push(...roundResult.roundLog);

        turn++;
      }

      const won = playerHealth > 0;
      
      // Verify character still exists before updating
      const characterCheck = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true }
      });

      if (!characterCheck) {
        throw new CharacterError('❌ Karakter tidak ditemukan! Mungkin karakter telah dihapus.', 'CHARACTER_NOT_FOUND');
      }

      // Update character stats in transaction
      await this.prisma.$transaction(async (tx) => {
        const txCharacter = await tx.character.findUnique({
          where: { id: characterId },
          select: { id: true }
        });

        if (!txCharacter) {
          throw new CharacterError('❌ Karakter tidak ditemukan saat update!', 'CHARACTER_NOT_FOUND');
        }

        await tx.character.update({
          where: { id: characterId },
          data: {
            health: Math.max(0, playerHealth),
            huntStreak: won ? { increment: 1 } : 0
          }
        });
      });

      const result: CombatResult = {
        won,
        battleLog,
        finalHealth: Math.max(0, playerHealth),
        exp: won ? monster.exp : 0,
        coins: won ? monster.coins : 0,
        monster: {
          name: monster.name,
          level: monster.level
        }
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
} 
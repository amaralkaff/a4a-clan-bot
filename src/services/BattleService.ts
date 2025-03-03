import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder, MessageFlags, Message } from 'discord.js';
import { QuestService } from './QuestService';
import { CharacterService } from './CharacterService';
import { StatusEffect, ActiveBuff, StatusEffects, ActiveBuffs } from '@/types/game';
import { BaseService } from './BaseService';
import { MONSTERS, ITEMS, Monster, JsonMonster } from '../config/gameData';

interface BattleState {
  combo: number;
  isGearSecond: boolean;
  gearSecondTurns: number;
  activeBuffs: ActiveBuffs;
  statusEffects: StatusEffects;
  firstStrike: boolean;
}

interface DamageResult {
  damage: number;
  isCritical: boolean;
  critMultiplier: number;
}

export class BattleService extends BaseService {
  private battleStates: Map<string, BattleState>;
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService?: CharacterService) {
    super(prisma);
    this.battleStates = new Map();
    this.characterService = characterService || new CharacterService(prisma);
  }

  private async initBattleState(characterId: string): Promise<BattleState> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!character) throw new Error('Character not found');

    // Initialize with empty effects and buffs
    return {
      combo: 0,
      isGearSecond: false,
      gearSecondTurns: 0,
      activeBuffs: { buffs: [] },
      statusEffects: { effects: [] },
      firstStrike: false
    };
  }

  private async saveBattleState(characterId: string, state: BattleState): Promise<void> {
    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        combo: state.combo,
        statusEffects: JSON.stringify(state.statusEffects),
        activeBuffs: JSON.stringify(state.activeBuffs)
      }
    });
  }

  private async applyMentorEffects(character: any, damage: number, isCritical: boolean, battleState: BattleState): Promise<number> {
    let finalDamage = damage;

    switch (character.mentor) {
      case 'YB': // Luffy
        battleState.combo++;
        
        if (battleState.combo >= 5 && !battleState.isGearSecond) {
          battleState.isGearSecond = true;
          battleState.gearSecondTurns = 3;
          finalDamage *= 2;
        } else if (battleState.isGearSecond) {
          finalDamage *= 2;
          battleState.gearSecondTurns--;
          if (battleState.gearSecondTurns <= 0) {
            battleState.isGearSecond = false;
            battleState.combo = 0;
          }
        }
        break;

      case 'Tierison': // Zoro
        if (isCritical) {
          // Three Sword Style: Triple damage on crits
          finalDamage *= 3;
        }
        break;

      case 'LYuka': // Usopp
        // 20% chance to apply status effect
        if (Math.random() < 0.2) {
          const poisonEffect: StatusEffect = {
            type: 'POISON',
            value: Math.floor(damage * 0.2),
            duration: 3,
            source: 'battle'
          };
          await this.characterService.addStatusEffect(character.id, poisonEffect);
        }
        break;

      case 'GarryAng': // Sanji
        // 15% chance to apply burn
        if (Math.random() < 0.15) {
          const burnEffect: StatusEffect = {
            type: 'BURN',
            value: Math.floor(damage * 0.15),
            duration: 2,
            source: 'battle'
          };
          await this.characterService.addStatusEffect(character.id, burnEffect);
        }
        break;
    }

    await this.saveBattleState(character.id, battleState);
    this.battleStates.set(character.id, battleState);

    return Math.floor(finalDamage);
  }

  private async processStatusEffects(characterId: string, battleState: BattleState, health: number): Promise<{ health: number; messages: string[] }> {
    const messages: string[] = [];
    let currentHealth = health;

    // Ensure effects array exists
    if (!battleState.statusEffects) {
      battleState.statusEffects = { effects: [] };
    }

    if (!battleState.statusEffects.effects) {
      battleState.statusEffects.effects = [];
    }

    battleState.statusEffects.effects = battleState.statusEffects.effects.filter((effect: StatusEffect) => {
      effect.duration--;
      
      switch (effect.type) {
        case 'POISON':
          currentHealth -= effect.value;
          messages.push(`☠️ Racun memberikan ${effect.value} damage!`);
          break;
        case 'BURN':
          currentHealth -= effect.value;
          messages.push(`🔥 Terbakar! Menerima ${effect.value} damage!`);
          break;
        case 'HEAL_OVER_TIME':
          currentHealth += effect.value;
          messages.push(`💚 Regenerasi memulihkan ${effect.value} HP!`);
          break;
        case 'STUN':
          messages.push(`⚡ Terkena stun!`);
          break;
      }

      return effect.duration > 0;
    });

    await this.saveBattleState(characterId, battleState);
    return { health: currentHealth, messages };
  }

  calculateDamage(attackerAttack: number, defenderDefense: number, isMonster: boolean = false): DamageResult {
    // Special early game boost for levels 1-10
    const isEarlyGame = attackerAttack < 50;
    
    // Massively reduced monster damage scaling, increased player damage
    const attackPower = isMonster
      ? (isEarlyGame 
          ? Math.pow(attackerAttack, 0.8)  // Heavily reduced from 1.1
          : Math.pow(attackerAttack, 0.7)) // Heavily reduced from 1.05
      : (isEarlyGame 
          ? Math.pow(attackerAttack, 1.5)  // Increased from 1.2
          : Math.pow(attackerAttack, 1.4)); // Increased from 1.15
    
    const defensePower = isEarlyGame
      ? Math.pow(defenderDefense, 1.0)  // Reduced from 1.2
      : Math.pow(defenderDefense, 1.1); // Reduced from 1.3
    
    // Heavily reduced monster damage multiplier
    const powerRatio = attackPower / defensePower;
    let damageMultiplier = isMonster
      ? (isEarlyGame ? 0.5 : 0.4)  // Heavily reduced from 1.0/0.9
      : (isEarlyGame ? 1.5 : 1.3); // Increased from 1.1/1.0
    
    // Adjusted power ratio effects to favor players
    if (powerRatio >= 2.5) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 0.8 : 0.7)  // Heavily reduced from 1.6/1.4
        : (isEarlyGame ? 2.5 : 2.2); // Increased from 1.8/1.6
    } else if (powerRatio >= 1.5) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 0.6 : 0.5)  // Heavily reduced from 1.3/1.2
        : (isEarlyGame ? 2.0 : 1.8); // Increased from 1.4/1.3
    } else if (powerRatio <= 0.4) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 0.4 : 0.3)  // Heavily reduced from 0.8/0.75
        : (isEarlyGame ? 1.2 : 1.0); // Increased from 0.85/0.8
    } else if (powerRatio <= 0.7) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 0.5 : 0.4)  // Heavily reduced from 0.9/0.85
        : (isEarlyGame ? 1.3 : 1.1); // Increased from 0.95/0.9
    }
    
    // Further enhanced defense effectiveness against monsters
    const defenseImpact = isMonster
      ? (isEarlyGame ? 0.9 : 1.0)  // Increased from 0.75/0.85
      : (isEarlyGame ? 0.4 : 0.5); // Reduced from 0.6/0.7
    
    const baseDamage = Math.max(
      Math.floor((attackPower - defensePower * defenseImpact) * damageMultiplier),
      isMonster ? 1 : CONFIG.BATTLE.MIN_DAMAGE // Minimum 1 damage for monsters
    );
    
    // Heavily reduced critical hit system for monsters, enhanced for players
    const critRoll = Math.random();
    let isCritical = false;
    let critMultiplier = 1;

    const critBonus = Math.max(0, (powerRatio - 1) * (isMonster 
      ? (isEarlyGame ? 0.01 : 0.005)  // Heavily reduced from 0.03/0.02
      : (isEarlyGame ? 0.08 : 0.06))); // Increased from 0.05/0.03

    if (critRoll < (isMonster 
      ? (isEarlyGame ? 0.005 : 0.003)  // Heavily reduced from 0.008/0.006
      : (isEarlyGame ? 0.15 : 0.12)) + critBonus) { // Increased from 0.012/0.008
      isCritical = true;
      critMultiplier = isMonster
        ? (isEarlyGame ? 1.2 : 1.1)  // Heavily reduced from 1.6/1.4
        : (isEarlyGame ? 2.5 : 2.2); // Increased from 2.0/1.8
      if (powerRatio >= 2.0) {
        critMultiplier = isMonster
          ? (isEarlyGame ? 1.3 : 1.2)  // Heavily reduced from 2.0/1.8
          : (isEarlyGame ? 3.0 : 2.8); // Increased from 2.5/2.2
      }
    }
    
    // Lower damage cap for monsters, increased for players
    let finalDamage = Math.floor(baseDamage * critMultiplier);
    if (finalDamage > (isMonster ? 300 : 1500)) {  // Reduced monster cap from 600 to 300, increased player cap from 800 to 1500
      finalDamage = (isMonster ? 300 : 1500) + 
        Math.floor(Math.pow(finalDamage - (isMonster ? 300 : 1500), 
          isMonster ? 0.3 : 0.8)); // Further increased diminishing returns for monsters
    }
    
    return { damage: finalDamage, isCritical, critMultiplier };
  }

  private convertJsonMonsterToMonster(jsonMonster: JsonMonster, monsterId: string): Monster {
    return {
      id: monsterId,
      name: jsonMonster.name,
      level: jsonMonster.level,
      health: jsonMonster.hp,
      maxHealth: jsonMonster.hp,
      attack: jsonMonster.attack,
      defense: jsonMonster.defense,
      exp: jsonMonster.exp,
      coins: Math.floor(jsonMonster.exp * 1.5), // Base coins on exp
      drops: jsonMonster.drops.map(itemId => ({ itemId, chance: 0.3 })),
      description: ITEMS[jsonMonster.drops[0]]?.description || 'A mysterious creature',
      location: ['starter_island'] // Default location
    };
  }

  private getRandomMonster(level: number, huntStreak: number = 0): Monster {
    // Group monsters by level range
    const monsterEntries = Object.entries(MONSTERS);
    
    // Simplified level checks
    const isHighLevel = level >= 50;
    const tier = isHighLevel ? Math.floor((level - 50) / 30) : 0; // Simpler tier calculation
    
    // Reduced multipliers based on tier
    const tierMultiplier = isHighLevel ? {
      streakBonus: 1 + (tier * 0.1),    // Reduced from 0.3
      levelScaling: 1 + (tier * 0.1),    // Reduced from 0.2
      statScaling: 1 + (tier * 0.1)      // Reduced from 0.2
    } : {
      streakBonus: 1.1,    // Reduced from 1.2
      levelScaling: 1.05,   // Reduced from 1.1
      statScaling: 1.05     // Reduced from 1.1
    };

    // Reduced streak bonus for level calculation
    const streakLevelBonus = Math.floor(huntStreak / 5); // Reduced from /3
    
    // More favorable level range calculation
    const minLevel = Math.max(1, level - 5);  // Increased range below player level
    const maxLevel = level + streakLevelBonus + (isHighLevel ? 10 : 5); // Reduced from 20/15
    
    // Enhanced monster grouping with streak influence
    const easyMonsters = monsterEntries.filter(([_, m]) => m.level >= minLevel && m.level <= level);
    const fairMonsters = monsterEntries.filter(([_, m]) => m.level === level);
    const hardMonsters = monsterEntries.filter(([_, m]) => m.level > level && m.level <= level + 3);  // Reduced from 8
    const challengingMonsters = monsterEntries.filter(([_, m]) => m.level > level + 3 && m.level <= maxLevel);

    // Reduced difficulty modifier based on streak
    const streakDifficultyModifier = Math.min(huntStreak * 0.05, 1.0); // Reduced from 0.08, max 1.5

    // Enhanced monster pool selection with streak influence - favor easier monsters
    let selectedPool: [string, JsonMonster][];
    const roll = Math.random() + (streakDifficultyModifier * 0.2); // Reduced modifier impact

    // Adjusted probabilities to favor easier monsters
    if (roll < 0.4) {  // Increased from 0.15
        selectedPool = fairMonsters;
    } else if (roll < 0.7) {  // Increased from 0.3
        selectedPool = easyMonsters;
    } else if (roll < 0.9) {  // Increased from 0.7
        selectedPool = hardMonsters;
    } else {
        selectedPool = challengingMonsters;
    }

    // Fallback to easier monsters if pool is empty
    if (!selectedPool || selectedPool.length === 0) {
      selectedPool = monsterEntries
            .sort(([_, a], [__, b]) => Math.abs(a.level - level) - Math.abs(b.level - level))  // Sort by closest to player level
            .slice(0, 3);  // Reduced from 5 options
    }

    // Select random monster from pool
    const poolIndex = Math.floor(Math.random() * selectedPool.length);
    const [monsterId, baseMonster] = selectedPool[Math.min(poolIndex, selectedPool.length - 1)];
    
    // Reduced stat calculations
    const streakBonus = 1 + (huntStreak * 0.1); // Reduced from 0.2
    const statMultiplier = 1 + (Math.floor(huntStreak / 15) * 0.05); // Reduced from /10 * 0.1

    // Calculate reduced stats
    const monster = {
      ...baseMonster,
        hp: Math.floor(baseMonster.hp * (1 + (streakBonus * 0.4)) + (level >= 50 ? (huntStreak * 10000) : 0)), // 10K HP per streak only for level 50+
        attack: Math.floor(baseMonster.attack * (1 + (streakBonus * 0.3)) * statMultiplier * tierMultiplier.statScaling),
        defense: Math.floor(baseMonster.defense * (1 + (streakBonus * 0.3)) * statMultiplier * tierMultiplier.statScaling),
        exp: Math.floor(baseMonster.exp * (1 + (streakBonus * 0.3))),
        level: Math.floor(baseMonster.level * tierMultiplier.levelScaling)
    };

    // Simplified monster ranks
    const streakRank = huntStreak >= 100 ? '👑 Elite'
        : huntStreak >= 50 ? '⚔️ Strong'
        : huntStreak >= 25 ? '💪 Tough'
        : huntStreak >= 10 ? '🔰 Regular'
        : ''; // No rank for low streaks

    return this.convertJsonMonsterToMonster({
        ...monster,
        name: streakRank ? `${streakRank} ${monster.name}` : monster.name
    }, monsterId);
  }

  async processBattle(characterId: string, enemyLevel: number): Promise<{
    won: boolean;
    battleLog: string[];
    finalHealth: number;
    exp?: number;
    coins?: number;
    monster?: {
      name: string;
      level: number;
    }
  }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: {
          id: true,
          name: true,
          level: true,
          health: true,
          maxHealth: true,
          attack: true,
          defense: true,
          speed: true,
          huntStreak: true,
          highestHuntStreak: true
        }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Get enemy monster with enhanced streak scaling
      const enemy = this.getRandomMonster(enemyLevel, character.huntStreak || 0);
      let enemyHp = enemy.health;
      let characterHp = character.health;

      // Battle log
      const battleLog = [];
      battleLog.push(`${'```'}\n⚔️ ${character.name} VS ${enemy.name}\n${'```'}`);

      // Determine who goes first based on speed
      const characterSpeed = character.speed;
      const enemySpeed = Math.floor(enemy.level * 2); // Base enemy speed scaling
      const characterGoesFirst = characterSpeed >= enemySpeed;

      let totalCharacterDamage = 0;
      let totalEnemyDamage = 0;
      let criticalHits = 0;

      // Battle continues until someone reaches 0 HP
      while (characterHp > 0 && enemyHp > 0) {
        if (characterGoesFirst) {
          // Character attacks
          const characterDamage = this.calculateDamage(character.attack, enemy.defense, false);
          if (characterDamage.isCritical) criticalHits++;
          totalCharacterDamage += characterDamage.damage;
          enemyHp -= characterDamage.damage;

          // Enemy attacks if still alive
          if (enemyHp > 0) {
            const enemyDamage = this.calculateDamage(enemy.attack, character.defense, true);
            totalEnemyDamage += enemyDamage.damage;
            characterHp -= enemyDamage.damage;
          }
        } else {
          // Enemy attacks first
          const enemyDamage = this.calculateDamage(enemy.attack, character.defense, true);
          totalEnemyDamage += enemyDamage.damage;
          characterHp -= enemyDamage.damage;

          // Character attacks if still alive
          if (characterHp > 0) {
            const characterDamage = this.calculateDamage(character.attack, enemy.defense, false);
            if (characterDamage.isCritical) criticalHits++;
            totalCharacterDamage += characterDamage.damage;
            enemyHp -= characterDamage.damage;
          }
        }

        // Break if either one is defeated
        if (characterHp <= 0 || enemyHp <= 0) break;
      }

      // Add battle summary
      if (criticalHits > 0) {
        battleLog.push(`💥 Critical Hits: ${criticalHits}x`);
      }

      // Enhanced HP display with percentage and visual bar
      const charHpPercent = Math.floor((Math.max(0, characterHp) / character.maxHealth) * 100);
      const enemyHpPercent = Math.floor((Math.max(0, enemyHp) / enemy.health) * 100);
      
      // Create HP bars
      const getHpBar = (percent: number) => {
        const totalBars = 40; // Increased from 20 to 40 for much longer bars
        const filledBars = Math.floor(percent * totalBars / 100);
        return '█'.repeat(filledBars) + '▒'.repeat(totalBars - filledBars);
      };

      battleLog.push(`\n🛡️ Your HP: ${Math.max(0, characterHp)}/${character.maxHealth} [${charHpPercent}%]\n${'```'}\n${getHpBar(charHpPercent)}\n${'```'}`);
      battleLog.push(`❤️ Enemy HP: ${Math.max(0, enemyHp)}/${enemy.health} [${enemyHpPercent}%]\n${'```'}\n${getHpBar(enemyHpPercent)}\n${'```'}`);

      // Update character health
      await this.prisma.character.update({
        where: { id: character.id },
        data: { health: Math.max(0, characterHp) }
      });

      // Victory condition: Enemy HP <= 0 AND Character HP > 0
      const won = enemyHp <= 0 && characterHp > 0;

      // Enhanced reward calculation
      let exp, coins;
      if (won) {
        const huntStreak = (character.huntStreak || 0) + 1;
        
        // Super enhanced base rewards with even better multipliers
        let expMultiplier = 2.0; // Increased from 1.2 to 2.0 for better base rewards
        let coinMultiplier = 2.0; // Increased from 1.2 to 2.0 for better base rewards

        // Super enhanced level-based multipliers
        if (character.level <= 20) {
            expMultiplier = 8.0;  // Increased from 6.0
            coinMultiplier = 7.0; // Increased from 5.0
        } else if (character.level <= 40) {
            expMultiplier = 6.0;  // Increased from 4.0
            coinMultiplier = 5.0; // Increased from 3.5
        } else if (character.level <= 60) {
            expMultiplier = 4.0;  // Increased from 3.0
            coinMultiplier = 3.5; // Increased from 2.8
        }

        // Super enhanced streak bonus with even better scaling
        const streakBonus = 1 + (huntStreak * 0.25); // Increased from 0.15 to 0.25 for much better scaling
        expMultiplier *= streakBonus;
        coinMultiplier *= streakBonus;

        // Keep existing milestone bonuses but add more rewards
        if (huntStreak % 100 === 0) {
            expMultiplier *= 10.0;  // Increased from 7.0
            coinMultiplier *= 8.0;  // Increased from 6.0
            battleLog.push(`🌟 LEGENDARY MILESTONE! (${huntStreak} streak) - 10x Rewards!`);
        } else if (huntStreak % 50 === 0) {
            expMultiplier *= 7.0;   // Increased from 5.0
            coinMultiplier *= 6.0;  // Increased from 4.0
            battleLog.push(`💫 EPIC MILESTONE! (${huntStreak} streak) - 7x Rewards!`);
        } else if (huntStreak % 25 === 0) {
            expMultiplier *= 5.0;   // Increased from 4.0
            coinMultiplier *= 4.5;  // Increased from 3.5
            battleLog.push(`✨ AMAZING MILESTONE! (${huntStreak} streak) - 5x Rewards!`);
        } else if (huntStreak % 10 === 0) {
            expMultiplier *= 4.0;   // Increased from 3.0
            coinMultiplier *= 3.5;  // Increased from 2.5
            battleLog.push(`🎯 GREAT MILESTONE! (${huntStreak} streak) - 4x Rewards!`);
        } else if (huntStreak % 5 === 0) {
            expMultiplier *= 3.0;   // Increased from 2.0
            coinMultiplier *= 2.5;  // Increased from 1.8
            battleLog.push(`🔥 STREAK BONUS! (${huntStreak} streak) - 3x Rewards!`);
        }

        // New: Additional streak tier bonuses
        if (huntStreak >= 200) {
            expMultiplier *= 3.0;
            coinMultiplier *= 3.0;
            battleLog.push(`👑 GODLIKE STREAK BONUS! (${huntStreak}) - 3x Extra Rewards!`);
        } else if (huntStreak >= 150) {
            expMultiplier *= 2.5;
            coinMultiplier *= 2.5;
            battleLog.push(`⚡ MYTHICAL STREAK BONUS! (${huntStreak}) - 2.5x Extra Rewards!`);
        } else if (huntStreak >= 100) {
            expMultiplier *= 2.0;
            coinMultiplier *= 2.0;
            battleLog.push(`🌟 LEGENDARY STREAK BONUS! (${huntStreak}) - 2x Extra Rewards!`);
        } else if (huntStreak >= 50) {
            expMultiplier *= 1.5;
            coinMultiplier *= 1.5;
            battleLog.push(`💫 EPIC STREAK BONUS! (${huntStreak}) - 1.5x Extra Rewards!`);
        }

        // Additional streak bonus message with enhanced formatting
        if (huntStreak > 1) {
            const bonusPercent = Math.floor((streakBonus - 1) * 100);
            battleLog.push(`🔥 STREAK POWER: ${huntStreak}`);
            battleLog.push(`💪 Bonus Multiplier: +${bonusPercent}%`);
            battleLog.push(`✨ Final Multipliers: ${expMultiplier.toFixed(1)}x EXP, ${coinMultiplier.toFixed(1)}x Coins`);
        }

        // Calculate final rewards with super enhanced base values
        exp = BigInt(Math.floor(enemy.exp * expMultiplier * 1.5)); // Increased from 1.2 to 1.5
        coins = BigInt(Math.floor(enemy.coins * coinMultiplier * 1.5)); // Increased from 1.2 to 1.5

        // Add rewards summary
        battleLog.push(`\n💰 REWARDS SUMMARY:`);
        battleLog.push(`✨ Experience: ${exp}`);
        battleLog.push(`💎 Coins: ${coins}`);

        // Add experience and coins
        await this.characterService.addExperience(character.id, Number(exp));
        await this.characterService.addCoins(character.id, Number(coins), 'HUNT', `Hunt reward from ${enemy.name}`);

        // Update hunt streak
        await this.prisma.character.update({
          where: { id: character.id },
          data: {
            huntStreak: huntStreak,
            highestHuntStreak: Math.max(huntStreak, character.highestHuntStreak || 0)
          }
        });
      } else {
        // Reset hunt streak on defeat
        await this.prisma.character.update({
          where: { id: character.id },
          data: { huntStreak: 0 }
        });
      }

      return {
        won,
        battleLog,
        finalHealth: Math.max(0, characterHp),
        exp: Number(exp),
        coins: Number(coins),
        monster: {
          name: enemy.name,
          level: enemy.level
        }
      };
    } catch (error) {
      this.logger.error('Error in processBattle:', error);
      throw error;
    }
  }
}
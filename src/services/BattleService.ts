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
    
    // Further reduced monster damage scaling
    const attackPower = isMonster
      ? (isEarlyGame 
          ? Math.pow(attackerAttack, 1.1)  // Reduced from 1.2
          : Math.pow(attackerAttack, 1.05)) // Reduced from 1.15
      : (isEarlyGame 
          ? Math.pow(attackerAttack, 1.2)  
          : Math.pow(attackerAttack, 1.15));
    
    const defensePower = isEarlyGame
      ? Math.pow(defenderDefense, 1.2)  // Increased from 1.1 to help defense more
      : Math.pow(defenderDefense, 1.3); // Increased from 1.2 to help defense more
    
    // Further reduced monster damage multiplier
    const powerRatio = attackPower / defensePower;
    let damageMultiplier = isMonster
      ? (isEarlyGame ? 1.0 : 0.9)  // Reduced from 1.1/1.0
      : (isEarlyGame ? 1.1 : 1.0);
    
    // Further reduced power ratio effects
    if (powerRatio >= 2.5) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 1.6 : 1.4)  // Reduced from 1.8/1.6
        : (isEarlyGame ? 1.8 : 1.6);
    } else if (powerRatio >= 1.5) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 1.3 : 1.2)  // Reduced from 1.5/1.4
        : (isEarlyGame ? 1.4 : 1.3);
    } else if (powerRatio <= 0.4) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 0.8 : 0.75)  // Reduced monster minimum damage further
        : (isEarlyGame ? 0.85 : 0.8);
    } else if (powerRatio <= 0.7) {
      damageMultiplier = isMonster
        ? (isEarlyGame ? 0.9 : 0.85)  // Reduced from 0.95/0.9
        : (isEarlyGame ? 0.95 : 0.9);
    }
    
    // Further enhanced defense effectiveness against monsters
    const defenseImpact = isMonster
      ? (isEarlyGame ? 0.75 : 0.85)  // Increased from 0.65/0.75
      : (isEarlyGame ? 0.6 : 0.7);
    
    const baseDamage = Math.max(
      Math.floor((attackPower - defensePower * defenseImpact) * damageMultiplier),
      CONFIG.BATTLE.MIN_DAMAGE
    );
    
    // Further reduced critical hit system for monsters
    const critRoll = Math.random();
    let isCritical = false;
    let critMultiplier = 1;

    const critBonus = Math.max(0, (powerRatio - 1) * (isMonster 
      ? (isEarlyGame ? 0.03 : 0.02)  // Reduced from 0.04/0.03
      : (isEarlyGame ? 0.05 : 0.03)));

    if (critRoll < (isMonster 
      ? (isEarlyGame ? 0.008 : 0.006)  // Reduced from 0.01/0.008
      : (isEarlyGame ? 0.012 : 0.008)) + critBonus) {
      isCritical = true;
      critMultiplier = isMonster
        ? (isEarlyGame ? 1.6 : 1.4)  // Reduced from 1.8/1.6
        : (isEarlyGame ? 2.0 : 1.8);
      if (powerRatio >= 2.0) {
        critMultiplier = isMonster
          ? (isEarlyGame ? 2.0 : 1.8)  // Reduced from 2.2/2.0
          : (isEarlyGame ? 2.5 : 2.2);
      }
    } else if (critRoll < (isMonster
      ? (isEarlyGame ? 0.04 : 0.02)  // Reduced from 0.05/0.03
      : (isEarlyGame ? 0.06 : 0.04)) + critBonus) {
      isCritical = true;
      critMultiplier = isMonster
        ? (isEarlyGame ? 1.3 : 1.2)  // Reduced from 1.5/1.4
        : (isEarlyGame ? 1.5 : 1.4);
      if (powerRatio >= 1.5) {
        critMultiplier = isMonster
          ? (isEarlyGame ? 1.6 : 1.4)  // Reduced from 1.8/1.6
          : (isEarlyGame ? 1.8 : 1.6);
      }
    }
    
    // Lower damage cap for monsters
    let finalDamage = Math.floor(baseDamage * critMultiplier);
    if (finalDamage > (isMonster ? 600 : 800)) {  // Reduced monster cap from 800 to 600
      finalDamage = (isMonster ? 600 : 800) + 
        Math.floor(Math.pow(finalDamage - (isMonster ? 600 : 800), 
          isMonster ? 0.55 : 0.7)); // Further increased diminishing returns for monsters
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

  private getRandomMonster(level: number): Monster {
    // Special handling for early game (levels 1-10)
    if (level <= 10) {
      return this.createScaledBeginnersMonster(level);
    }

    // Rest of the existing monster selection logic...
    const monsterEntries = Object.entries(MONSTERS);
    
    // Make monsters more challenging by adjusting level ranges
    const minLevel = Math.max(1, Math.floor(level * 0.9));
    const maxLevel = Math.ceil(level * 1.8);
    
    // Group monsters by relative difficulty
    const easyMonsters = monsterEntries.filter(([_, m]) => m.level >= minLevel && m.level < level);
    const fairMonsters = monsterEntries.filter(([_, m]) => m.level === level);
    const hardMonsters = monsterEntries.filter(([_, m]) => m.level > level && m.level <= level + 3);
    const challengingMonsters = monsterEntries.filter(([_, m]) => m.level > level + 3 && m.level <= maxLevel);

    // Adjust probability distribution to favor harder monsters
    const roll = Math.random();
    let selectedPool: [string, JsonMonster][];

    if (level >= 50) {
      // High-level encounters heavily favor harder monsters
      if (roll < 0.10) {          // 10% chance for same level (reduced from 15%)
        selectedPool = fairMonsters;
      } else if (roll < 0.15) {   // 5% chance for easier (reduced from 10%)
        selectedPool = easyMonsters;
      } else if (roll < 0.85) {   // 70% chance for harder (increased from 55%)
        selectedPool = hardMonsters;
      } else {                    // 15% chance for challenging
        selectedPool = challengingMonsters;
      }
    } else if (level >= 15) {
      // Mid-level encounters favor harder monsters
      if (roll < 0.15) {         // 15% chance for same level
        selectedPool = fairMonsters;
      } else if (roll < 0.25) {  // 10% chance for easier
        selectedPool = easyMonsters;
      } else if (roll < 0.85) {  // 60% chance for harder
        selectedPool = hardMonsters;
      } else {                   // 15% chance for challenging
        selectedPool = challengingMonsters;
      }
    } else {
      // Low-level encounters with moderate challenge
      if (roll < 0.20) {
        selectedPool = fairMonsters;
      } else if (roll < 0.35) {
        selectedPool = easyMonsters;
      } else if (roll < 0.85) {
        selectedPool = hardMonsters;
      } else {
        selectedPool = challengingMonsters;
      }
    }

    // If selected pool is empty, fallback to closest level monsters
    if (!selectedPool || selectedPool.length === 0) {
      selectedPool = monsterEntries
        .sort(([_, a], [__, b]) => Math.abs(a.level - level) - Math.abs(b.level - level))
        .filter(([_, m]) => m.level >= minLevel && m.level <= maxLevel)
        .slice(0, 3);
    }

    // If still no monsters found, return scaled default monster
    if (selectedPool.length === 0) {
      return this.createScaledMonster(level);
    }

    const [monsterId, monster] = selectedPool[Math.floor(Math.random() * selectedPool.length)];
    return this.convertJsonMonsterToMonster(monster, monsterId);
  }

  private createScaledBeginnersMonster(level: number): Monster {
    // Much gentler scaling for true beginners (levels 1-10)
    const scaledHealth = 40 + (level * level * 2);      // Reduced from 60 + (level * level * 3)
    const scaledAttack = 5 + Math.floor(level * 1.5);   // Reduced from 8 + (level * 2)
    const scaledDefense = Math.max(2, level * 1);       // Reduced from Math.max(3, level * 1.2)
    const scaledExp = Math.floor(50 + (level * 20));    // Increased from 30 + (level * 15)
    const scaledCoins = Math.floor(80 + (level * 30));  // Increased from 50 + (level * 25)

    const monsterTypes = [
      { id: 'training_dummy', name: '🎯 Training Dummy', desc: 'A basic training dummy for beginners' },
      { id: 'wooden_soldier', name: '🪖 Wooden Soldier', desc: 'A simple wooden training partner' },
      { id: 'practice_target', name: '🎪 Practice Target', desc: 'An automated training target' },
      { id: 'rookie_bandit', name: '👥 Rookie Bandit', desc: 'A novice bandit still learning the ropes' },
      { id: 'young_wolf', name: '🐺 Young Wolf', desc: 'A small wolf pup learning to hunt' }
    ];
    
    const monster = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];

    return {
      id: monster.id,
      name: `${monster.name} Lv.${level}`,
      level: level,
      health: scaledHealth,
      maxHealth: scaledHealth,
      attack: scaledAttack,
      defense: scaledDefense,
      exp: scaledExp,
      coins: scaledCoins,
      drops: [
        { itemId: 'training_gear', chance: 0.5 },    // Increased from 0.4
        { itemId: 'beginner_potion', chance: 0.4 },  // Increased from 0.3
        { itemId: `level_${level}_material`, chance: 0.3 }, // Increased from 0.2
        { itemId: 'lucky_coin', chance: 0.08 }       // Increased from 0.05
      ],
      description: monster.desc,
      location: ['starter_island']
    };
  }

  private createScaledMonster(level: number, huntStreak: number = 0): Monster {
    let scaledHealth, scaledAttack, scaledDefense, scaledExp, scaledCoins;
    
    // Further reduced streak scaling
    const streakMultiplier = Math.min(1 + (huntStreak * 0.05), 2.0); // Reduced from 0.08 and max 3.0
    const streakBonusStats = Math.floor(huntStreak * 0.5); // Reduced from 1

    if (level >= 70) {
      // Level 70+ monsters - Ultimate challenge
      scaledHealth = (2000 + Math.pow(level, 3.2)) * streakMultiplier; // Reduced from 2500 and 3.5
      scaledAttack = (150 + Math.floor(Math.pow(level, 1.7)) + streakBonusStats) * streakMultiplier; // Reduced from 180 and 1.9
      scaledDefense = (100 + Math.floor(Math.pow(level, 1.5)) + streakBonusStats) * streakMultiplier; // Reduced from 130 and 1.7
      scaledExp = Math.floor((7000 + (level * Math.pow(level, 0.9))) * Math.sqrt(streakMultiplier));
      scaledCoins = Math.floor((8000 + (level * Math.pow(level, 0.8))) * Math.sqrt(streakMultiplier));
    }
    else if (level >= 50) {
      // Level 50-69 monsters - Elite challenge
      scaledHealth = (1500 + Math.pow(level, 3.0)) * streakMultiplier; // Reduced from 1800 and 3.2
      scaledAttack = (100 + Math.floor(Math.pow(level, 1.5)) + streakBonusStats) * streakMultiplier; // Reduced from 130 and 1.7
      scaledDefense = (80 + Math.floor(Math.pow(level, 1.4)) + streakBonusStats) * streakMultiplier; // Reduced from 100 and 1.6
      scaledExp = Math.floor((5000 + (level * Math.pow(level, 0.8))) * Math.sqrt(streakMultiplier));
      scaledCoins = Math.floor((6000 + (level * Math.pow(level, 0.7))) * Math.sqrt(streakMultiplier));
    }
    else if (level >= 30) {
      // Level 30-49 monsters - Veteran challenge
      scaledHealth = (800 + Math.pow(level, 2.5)) * streakMultiplier; // Reduced from 1000 and 2.8
      scaledAttack = (70 + Math.floor(Math.pow(level, 1.3)) + streakBonusStats) * streakMultiplier; // Reduced from 85 and 1.5
      scaledDefense = (50 + Math.floor(Math.pow(level, 1.2)) + streakBonusStats) * streakMultiplier; // Reduced from 65 and 1.4
      scaledExp = Math.floor((3000 + (level * Math.pow(level, 0.7))) * Math.sqrt(streakMultiplier));
      scaledCoins = Math.floor((4000 + (level * Math.pow(level, 0.6))) * Math.sqrt(streakMultiplier));
    } 
    else if (level >= 15) {
      // Level 15-29 monsters - Advanced challenge
      scaledHealth = (400 + Math.pow(level, 2.2)) * streakMultiplier; // Reduced from 600 and 2.5
      scaledAttack = (40 + Math.floor(Math.pow(level, 1.2)) + streakBonusStats) * streakMultiplier; // Reduced from 55 and 1.4
      scaledDefense = (30 + Math.floor(Math.pow(level, 1.1)) + streakBonusStats) * streakMultiplier; // Reduced from 40 and 1.3
      scaledExp = Math.floor((2000 + (level * Math.pow(level, 0.6))) * Math.sqrt(streakMultiplier));
      scaledCoins = Math.floor((2500 + (level * Math.pow(level, 0.55))) * Math.sqrt(streakMultiplier));
    }
    else if (level >= 5) {
      // Level 5-14 monsters - Intermediate challenge
      scaledHealth = (200 + Math.pow(level, 2.0)) * streakMultiplier; // Reduced from 300 and 2.2
      scaledAttack = (20 + Math.floor(Math.pow(level, 1.1)) + streakBonusStats) * streakMultiplier; // Reduced from 30 and 1.2
      scaledDefense = (15 + Math.floor(Math.pow(level, 1.0)) + streakBonusStats) * streakMultiplier; // Reduced from 25 and 1.1
      scaledExp = Math.floor((1000 + (level * Math.pow(level, 0.5))) * Math.sqrt(streakMultiplier));
      scaledCoins = Math.floor((1500 + (level * Math.pow(level, 0.45))) * Math.sqrt(streakMultiplier));
    }
    else {
      // Level 1-4 monsters - Basic challenge but still threatening
      scaledHealth = (100 + Math.pow(level, 1.8)) * streakMultiplier; // Reduced from 150 and 2.0
      scaledAttack = (15 + Math.floor(Math.pow(level, 1.0)) + streakBonusStats) * streakMultiplier; // Reduced from 20 and 1.1
      scaledDefense = (10 + Math.floor(Math.pow(level, 0.9)) + streakBonusStats) * streakMultiplier; // Reduced from 12 and 1.0
      scaledExp = Math.floor((500 + (level * Math.pow(level, 0.4))) * Math.sqrt(streakMultiplier));
      scaledCoins = Math.floor((800 + (level * Math.pow(level, 0.35))) * Math.sqrt(streakMultiplier));
    }

    // Enhanced drop system with streak bonuses
    let rareDropChance, materialDropChance, legendaryDropChance;
    const streakDropBonus = Math.min(huntStreak * 0.02, 0.3); // Up to 30% additional drop chance from streaks
    
    if (level >= 70) {
      rareDropChance = Math.min(0.40 + (Math.pow(level - 69, 0.5) * 0.02) + streakDropBonus, 0.95);
      materialDropChance = Math.min(0.50 + (Math.pow(level - 69, 0.4) * 0.02) + streakDropBonus, 0.85);
      legendaryDropChance = Math.min(0.20 + (Math.pow(level - 69, 0.3) * 0.01) + (streakDropBonus * 0.5), 0.45);
    }
    else if (level >= 50) {
      rareDropChance = Math.min(0.30 + (Math.pow(level - 49, 0.4) * 0.02) + streakDropBonus, 0.80);
      materialDropChance = Math.min(0.40 + (Math.pow(level - 49, 0.3) * 0.02) + streakDropBonus, 0.70);
      legendaryDropChance = Math.min(0.15 + (Math.pow(level - 49, 0.25) * 0.01) + (streakDropBonus * 0.5), 0.35);
    }
    else if (level >= 30) {
      rareDropChance = Math.min(0.20 + (level * 0.01) + streakDropBonus, 0.65);
      materialDropChance = Math.min(0.30 + (level * 0.008) + streakDropBonus, 0.55);
      legendaryDropChance = Math.min(0.10 + (level * 0.004) + (streakDropBonus * 0.5), 0.25);
    }
    else {
      rareDropChance = Math.min(0.15 + (level * 0.008) + streakDropBonus, 0.45);
      materialDropChance = Math.min(0.25 + (level * 0.006) + streakDropBonus, 0.40);
      legendaryDropChance = Math.min(0.05 + (level * 0.003) + (streakDropBonus * 0.5), 0.15);
    }

    // Enhanced monster names with streak titles
    let monsterPrefix = '🦹‍♂️';
    let monsterName = 'Marinir Korup';
    let monsterDesc = 'A corrupt marine who requires basic equipment to defeat';
    
    // Add streak rank to monster names
    const streakRank = huntStreak >= 50 ? '👑 Supreme'
      : huntStreak >= 40 ? '⚜️ Mythical'
      : huntStreak >= 30 ? '🌟 Legendary'
      : huntStreak >= 20 ? '💫 Elite'
      : huntStreak >= 10 ? '⭐ Veteran'
      : huntStreak >= 5 ? '✨ Skilled'
      : '';
    
    if (level >= 70) {
      const ultimateTypes = [
        { prefix: '👹', name: 'Marinir Legendaris', desc: `A legendary marine warrior with devastating power (Streak: ${huntStreak})` },
        { prefix: '⚔️', name: 'Laksamana Agung', desc: `A supreme admiral whose might strikes fear into all (Streak: ${huntStreak})` },
        { prefix: '🌟', name: 'Prajurit Suci', desc: `A holy warrior blessed with divine strength (Streak: ${huntStreak})` }
      ];
      const type = ultimateTypes[Math.floor(Math.random() * ultimateTypes.length)];
      monsterPrefix = type.prefix;
      monsterName = streakRank ? `${streakRank} ${type.name}` : type.name;
      monsterDesc = type.desc;
    } else if (level >= 50) {
      const eliteTypes = [
        { prefix: '💀', name: 'Marinir Elite', desc: `An elite marine commander with fearsome strength (Streak: ${huntStreak})` },
        { prefix: '⚡', name: 'Kapten Veteran', desc: `A battle-hardened captain with overwhelming power (Streak: ${huntStreak})` },
        { prefix: '🔥', name: 'Perwira Tinggi', desc: `A high-ranking officer with exceptional combat skills (Streak: ${huntStreak})` }
      ];
      const type = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
      monsterPrefix = type.prefix;
      monsterName = streakRank ? `${streakRank} ${type.name}` : type.name;
      monsterDesc = type.desc;
    }

    // Enhanced drops with streak bonuses
    const baseDrops = [
      { itemId: 'common_treasure', chance: Math.min(0.7 + (streakDropBonus * 0.5), 0.9) },
      { itemId: 'bandit_gear', chance: Math.min(0.6 + (streakDropBonus * 0.5), 0.8) },
      { itemId: `level_${level}_material`, chance: materialDropChance }
    ];

    if (level >= 70) {
      baseDrops.push(
        { itemId: 'rare_treasure', chance: rareDropChance },
        { itemId: 'legendary_treasure', chance: legendaryDropChance },
        { itemId: 'ultimate_essence', chance: Math.min(0.15 + (streakDropBonus * 0.3), 0.3) },
        { itemId: 'ancient_scroll', chance: Math.min(0.08 + (streakDropBonus * 0.2), 0.2) }
      );
    } else if (level >= 50) {
      baseDrops.push(
        { itemId: 'rare_treasure', chance: rareDropChance },
        { itemId: 'legendary_treasure', chance: legendaryDropChance },
        { itemId: 'elite_essence', chance: Math.min(0.10 + (streakDropBonus * 0.3), 0.25) },
        { itemId: 'power_crystal', chance: Math.min(0.05 + (streakDropBonus * 0.2), 0.15) }
      );
    } else {
      baseDrops.push(
        { itemId: 'rare_treasure', chance: rareDropChance },
        { itemId: 'strength_stone', chance: Math.min(0.03 + (streakDropBonus * 0.2), 0.1) }
      );
    }

    return {
      id: 'bandit_scaled',
      name: `${monsterPrefix} ${monsterName} Lv.${level}`,
      level: level,
      health: Math.floor(scaledHealth),
      maxHealth: Math.floor(scaledHealth),
      attack: Math.floor(scaledAttack),
      defense: Math.floor(scaledDefense),
      exp: Math.floor(scaledExp),
      coins: Math.floor(scaledCoins),
      drops: baseDrops,
      description: monsterDesc,
      location: ['starter_island']
    };
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

      // Get enemy monster with hunt streak scaling
      const enemy = this.createScaledMonster(enemyLevel, character.huntStreak || 0);
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
        const filledBars = Math.floor(percent / 10);
        return '█'.repeat(filledBars) + '▒'.repeat(10 - filledBars);
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

      // Calculate rewards with enhanced streak bonus if won
      let exp, coins;
      if (won) {
        const huntStreak = (character.huntStreak || 0) + 1;
        
        // Increased base streak bonus (15% per streak, up from 8%)
        const baseStreakBonus = huntStreak * 0.15;
        
        // Enhanced streak bonuses with better scaling
        let streakBonus;
        if (enemy.level >= 70) {
          // Ultimate tier (70+) - Massive rewards
          streakBonus = Math.min(baseStreakBonus * 2.0, 3.0); // Up to 300% max bonus
        } else if (enemy.level >= 50) {
          // Elite tier (50-69) - Great rewards
          streakBonus = Math.min(baseStreakBonus * 1.8, 2.5); // Up to 250% max bonus
        } else if (enemy.level >= 30) {
          // Veteran tier (30-49) - Good rewards
          streakBonus = Math.min(baseStreakBonus * 1.5, 2.0); // Up to 200% max bonus
        } else if (enemy.level >= 15) {
          // Advanced tier (15-29) - Decent rewards
          streakBonus = Math.min(baseStreakBonus * 1.2, 1.5); // Up to 150% max bonus
        } else {
          // Beginner tier (1-14) - Fair rewards
          streakBonus = Math.min(baseStreakBonus * 1.0, 1.0); // Up to 100% max bonus
        }
        
        // Enhanced level difference bonus
        const levelDiff = enemy.level - character.level;
        let levelDiffBonus = 0;
        
        if (levelDiff > 0) {
          if (levelDiff >= 10) {
            levelDiffBonus = 0.5; // Up to +50% for 10+ levels higher
          } else if (levelDiff >= 5) {
            levelDiffBonus = 0.3; // Up to +30% for 5-9 levels higher
          } else {
            levelDiffBonus = levelDiff * 0.05; // Up to +5% per level difference
          }
        }
        
        // Calculate final rewards with enhanced bonuses
        const totalMultiplier = (1 + streakBonus + levelDiffBonus);
        
        // Enhanced base exp/coin calculation
        let baseExp = enemy.exp;
        let baseCoins = enemy.coins;
        let tierBonusMultiplier = 1.0;

        if (enemy.level >= 70) {
          tierBonusMultiplier = 2.5;    // Up to 150% more base rewards for ultimate tier
        } else if (enemy.level >= 50) {
          tierBonusMultiplier = 2.0;    // Up to 100% more base rewards for elite tier
        } else if (enemy.level >= 30) {
          tierBonusMultiplier = 1.75;   // Up to 75% more base rewards for veteran tier
        } else if (enemy.level >= 15) {
          tierBonusMultiplier = 1.5;    // Up to 50% more base rewards for advanced tier
        }
        
        baseExp = Math.floor(enemy.exp * tierBonusMultiplier * 1.5); // Up to 50% exp boost
        baseCoins = Math.floor(enemy.coins * tierBonusMultiplier * 1.3); // Up to 30% coin boost
        
        exp = Math.floor(baseExp * totalMultiplier);
        coins = Math.floor(baseCoins * totalMultiplier);

        // Enhanced milestone bonuses
        if (huntStreak % 100 === 0) {  // Epic milestone bonus
          exp = Math.floor(exp * 8.0);   // Up to 8x rewards
          coins = Math.floor(coins * 6.0); // Up to 6x rewards
          battleLog.push(`🌟 LEGENDARY MILESTONE! (${huntStreak} streak) - 8x EXP, 6x Coins!`);
        }
        else if (huntStreak % 50 === 0) {  // Massive milestone bonus
          exp = Math.floor(exp * 6.0);   // Up to 6x rewards
          coins = Math.floor(coins * 4.0); // Up to 4x rewards
          battleLog.push(`🌟 EPIC MILESTONE! (${huntStreak} streak) - 6x EXP, 4x Coins!`);
        }
        else if (huntStreak % 25 === 0) {  // Major milestone bonus
          exp = Math.floor(exp * 4.0);   // Up to 4x rewards
          coins = Math.floor(coins * 3.0); // Up to 3x rewards
          battleLog.push(`✨ AMAZING MILESTONE! (${huntStreak} streak) - 4x EXP, 3x Coins!`);
        }
        else if (huntStreak % 10 === 0) {  // Good milestone bonus
          exp = Math.floor(exp * 3.0);   // Up to 3x rewards
          coins = Math.floor(coins * 2.0); // Up to 2x rewards
          battleLog.push(`🎯 GREAT MILESTONE! (${huntStreak} streak) - 3x EXP, 2x Coins!`);
        }
        else if (huntStreak % 5 === 0) {   // Basic milestone bonus
          exp = Math.floor(exp * 2.0);   // Up to 2x rewards
          coins = Math.floor(coins * 1.5); // Up to 1.5x rewards
          battleLog.push(`🎯 MILESTONE BONUS! (${huntStreak} streak) - 2x EXP, 1.5x Coins!`);
        }

        // Add detailed rewards breakdown
        battleLog.push(`✨ Experience`);
        battleLog.push(`Base EXP: ${enemy.exp}`);
        if (tierBonusMultiplier > 1) {
          battleLog.push(`Tier Bonus: +${Math.floor(enemy.exp * (tierBonusMultiplier - 1))}`);
        }
        if (streakBonus > 0) {
          battleLog.push(`Streak Bonus: +${Math.floor(baseExp * streakBonus)}`);
        }
        if (levelDiffBonus > 0) {
          battleLog.push(`Level Diff: +${Math.floor(baseExp * levelDiffBonus)}`);
        }
        battleLog.push(`Total: +${exp} EXP`);

        // Add experience and coins
        await this.characterService.addExperience(character.id, exp);
        await this.characterService.addCoins(character.id, coins, 'HUNT', `Hunt reward from ${enemy.name}`);

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
        exp,
        coins,
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
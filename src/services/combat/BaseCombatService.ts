import { PrismaClient } from '@prisma/client';
import { BaseService } from '../BaseService';
import { CharacterService } from '../CharacterService';
import { Cache } from '@/utils/Cache';
import { StatusEffect, CharacterWithEquipment, CachedMonster } from '@/types/game';
import {
  BattleState,
  DamageResult,
  StatusEffectResult,
  CombatParticipant,
  CombatResult
} from '@/types/combat';
import { JsonMonster } from '@/config/gameData';
import { DataCache } from '@/services/DataCache';

export class MonsterFactory {
  static fromJsonMonster(jsonMonster: JsonMonster, monsterId: string, cacheKey: string): CachedMonster {
    return {
      id: monsterId,
      name: jsonMonster.name,
      level: jsonMonster.level,
      health: jsonMonster.health,
      maxHealth: jsonMonster.health,
      attack: jsonMonster.attack,
      defense: jsonMonster.defense,
      exp: jsonMonster.exp,
      coins: jsonMonster.coins,
      drops: jsonMonster.drops,
      description: jsonMonster.description,
      location: jsonMonster.location,
      cacheKey
    };
  }

  static toCombatParticipant(monster: CachedMonster): CombatParticipant {
    return {
      id: monster.id,
      name: monster.name,
      level: monster.level,
      health: monster.health,
      maxHealth: monster.maxHealth,
      attack: monster.attack,
      defense: monster.defense
    };
  }
}

export class CombatantFactory {
  static fromCharacter(character: CharacterWithEquipment): CombatParticipant {
    return {
      id: character.id,
      name: character.name,
      level: character.level,
      health: character.health,
      maxHealth: character.maxHealth,
      attack: character.attack,
      defense: character.defense,
      mentor: character.mentor || undefined,
      speed: character.speed
    };
  }
}

export abstract class BaseCombatService extends BaseService {
  protected characterService: CharacterService;
  protected readonly dataCache: DataCache;
  protected battleStatesCache: Cache<BattleState>;
  private readonly BATTLE_STATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    prisma: PrismaClient,
    characterService: CharacterService,
    dataCache: DataCache
  ) {
    super(prisma);
    this.characterService = characterService;
    this.dataCache = dataCache;
    this.battleStatesCache = new Cache<BattleState>(this.BATTLE_STATE_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.battleStatesCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  protected async initBattleState(characterId: string): Promise<BattleState> {
    try {
      // Check cache first
      const cachedState = this.battleStatesCache.get(characterId);
      if (cachedState) {
        // Verify character still exists
        const character = await this.prisma.character.findUnique({
          where: { id: characterId }
        });

        if (!character) {
          this.battleStatesCache.delete(characterId);
          throw new Error('Character not found');
        }

        return cachedState;
      }

      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      // Initialize with empty effects and buffs
      const newState: BattleState = {
        combo: 0,
        isGearSecond: false,
        gearSecondTurns: 0,
        activeBuffs: { buffs: [] },
        statusEffects: { effects: [] },
        firstStrike: false
      };

      // Cache the new state
      this.battleStatesCache.set(characterId, newState);
      return newState;
    } catch (error) {
      this.logger.error('Error initializing battle state:', error);
      throw error;
    }
  }

  protected async saveBattleState(characterId: string, state: BattleState): Promise<void> {
    try {
      // Verify character exists before updating
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true } // Only select ID for performance
      });

      if (!character) {
        this.logger.error(`Character ${characterId} not found when saving battle state`);
        this.battleStatesCache.delete(characterId);
        return; // Early return if character not found
      }

      // Update cache first
      this.battleStatesCache.set(characterId, state);

      // Update database in transaction
      await this.prisma.$transaction(async (tx) => {
        // Check character again in transaction to ensure it still exists
        const txCharacter = await tx.character.findUnique({
          where: { id: characterId },
          select: { id: true }
        });

        if (!txCharacter) {
          this.logger.error(`Character ${characterId} not found in transaction`);
          throw new Error(`Character ${characterId} not found`);
        }

        // Only attempt update if character exists
        await tx.character.update({
          where: { id: characterId },
          data: {
            combo: state.combo,
            statusEffects: JSON.stringify(state.statusEffects),
            activeBuffs: JSON.stringify(state.activeBuffs)
          }
        });
      });
    } catch (error) {
      this.logger.error('Error saving battle state:', error);
      // Clear cache on error
      this.battleStatesCache.delete(characterId);
      // Don't throw error to prevent combat from breaking
      // Just log it and continue
    }
  }

  protected async applyMentorEffects(character: CombatParticipant, damage: number, isCritical: boolean, battleState: BattleState): Promise<number> {
    try {
      let finalDamage = damage;

      // Skip mentor effects for monsters
      if (!character.mentor) {
        return finalDamage;
      }

      // Skip database check for monster IDs
      if (character.id.startsWith('monster_') || 
          character.id.includes('_monster') || 
          character.id.includes('_beast') || 
          character.id.includes('_bandit') || 
          character.id.includes('_boss')) {
        return finalDamage;
      }

      // For actual characters, verify they exist before applying effects
      const dbCharacter = await this.prisma.character.findUnique({
        where: { id: character.id },
        select: { id: true, mentor: true }
      });

      if (!dbCharacter) {
        this.logger.error(`Character ${character.id} not found when applying mentor effects`);
        this.battleStatesCache.delete(character.id);
        return finalDamage;
      }

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
      return Math.floor(finalDamage);
    } catch (error) {
      this.logger.error('Error applying mentor effects:', error);
      return damage; // Return original damage if error occurs
    }
  }

  protected async processStatusEffects(characterId: string, battleState: BattleState, health: number): Promise<StatusEffectResult> {
    try {
      const messages: string[] = [];
      let currentHealth = health;

      // Verify character exists
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true }
      });

      if (!character) {
        this.logger.error(`Character ${characterId} not found when processing status effects`);
        this.battleStatesCache.delete(characterId);
        return { health: currentHealth, messages };
      }

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
    } catch (error) {
      this.logger.error('Error processing status effects:', error);
      return { health, messages: [] };
    }
  }

  protected calculateDamage(attackerAttack: number, defenderDefense: number, isMonster: boolean = false): DamageResult {
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

    // Calculate base damage
    let damage = Math.floor(attackerAttack * damageMultiplier);

    // Critical hit calculation
    const isCritical = Math.random() < 0.1; // 10% chance
    let critMultiplier = 1;

    if (isCritical) {
      // 1% chance for super critical (within the 10% crit chance)
      critMultiplier = Math.random() < 0.1 ? 3 : 1.5;
      damage = Math.floor(damage * critMultiplier);
    }

    return {
      damage,
      isCritical,
      critMultiplier
    };
  }

  protected getHpBar(percent: number): string {
    const fullChar = '█';
    const emptyChar = '░';
    const barLength = 10;
    const filledLength = Math.round(percent * barLength);
    const emptyLength = barLength - filledLength;
    
    return fullChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
  }

  protected async processCombatTurn(
    attacker: CombatParticipant,
    defender: CombatParticipant,
    attackerHealth: number,
    defenderHealth: number,
    attackerState: BattleState,
    isMonster: boolean = false
  ): Promise<{
    newAttackerHealth: number;
    newDefenderHealth: number;
    turnLog: string[];
  }> {
    const turnLog: string[] = [];
    let newAttackerHealth = attackerHealth;
    let newDefenderHealth = defenderHealth;

    // Calculate damage
    const damage = this.calculateDamage(attacker.attack, defender.defense, isMonster);
    let finalDamage = await this.applyMentorEffects(attacker, damage.damage, damage.isCritical, attackerState);

    // Apply damage
    newDefenderHealth -= finalDamage;
    const defenderHpPercent = Math.max(0, newDefenderHealth) / defender.maxHealth;

    // Log the attack with clean formatting
    turnLog.push(
      `${'```'}\n` +
      `${attacker.name} ➜ ${defender.name} ${damage.isCritical ? '💥 ' : ''}${finalDamage}\n` +
      `${defender.name}: ${Math.max(0, newDefenderHealth)}/${defender.maxHealth}\n` +
      `${'```'}`
    );

    // Process status effects
    if (!isMonster) {
      const statusResult = await this.processStatusEffects(attacker.id, attackerState, newAttackerHealth);
      newAttackerHealth = statusResult.health;
      
      // Only show status effects if they exist
      if (statusResult.messages.length > 0) {
        turnLog.push(
          `${'```'}\n` +
          `${statusResult.messages.join(' ')}\n` +
          `${'```'}`
        );
      }
    }

    return {
      newAttackerHealth,
      newDefenderHealth,
      turnLog
    };
  }

  protected determineTurnOrder(first: CombatParticipant, second: CombatParticipant): {
    faster: CombatParticipant;
    slower: CombatParticipant;
  } {
    const firstSpeed = first.speed || 0;
    const secondSpeed = second.speed || 0;

    // If speeds are equal or neither has speed, maintain original order
    if (firstSpeed === secondSpeed) {
      return { faster: first, slower: second };
    }

    return secondSpeed > firstSpeed
      ? { faster: second, slower: first }
      : { faster: first, slower: second };
  }

  protected async processCombatRound(
    participants: {
      first: CombatParticipant;
      second: CombatParticipant;
    },
    states: {
      firstState: BattleState;
      secondState: BattleState;
    },
    health: {
      firstHealth: number;
      secondHealth: number;
    },
    turn: number,
    isMonster: boolean = false
  ): Promise<{
    newFirstHealth: number;
    newSecondHealth: number;
    roundLog: string[];
  }> {
    const roundLog: string[] = [];
    let { firstHealth, secondHealth } = health;

    // Determine turn order based on speed
    const { faster, slower } = this.determineTurnOrder(participants.first, participants.second);
    const isFasterFirst = faster === participants.first;

    // Faster participant's turn
    const fasterTurn = await this.processCombatTurn(
      faster,
      slower,
      isFasterFirst ? firstHealth : secondHealth,
      isFasterFirst ? secondHealth : firstHealth,
      isFasterFirst ? states.firstState : states.secondState,
      isMonster
    );

    // Update health based on who went first
    if (isFasterFirst) {
      firstHealth = fasterTurn.newAttackerHealth;
      secondHealth = fasterTurn.newDefenderHealth;
    } else {
      secondHealth = fasterTurn.newAttackerHealth;
      firstHealth = fasterTurn.newDefenderHealth;
    }
    roundLog.push(...fasterTurn.turnLog);

    // If slower participant is still alive, they get their turn
    const slowerHealth = isFasterFirst ? secondHealth : firstHealth;
    if (slowerHealth > 0) {
      const slowerTurn = await this.processCombatTurn(
        slower,
        faster,
        slowerHealth,
        isFasterFirst ? firstHealth : secondHealth,
        isFasterFirst ? states.secondState : states.firstState,
        isMonster
      );

      // Update health based on who went second
      if (isFasterFirst) {
        secondHealth = slowerTurn.newAttackerHealth;
        firstHealth = slowerTurn.newDefenderHealth;
      } else {
        firstHealth = slowerTurn.newAttackerHealth;
        secondHealth = slowerTurn.newDefenderHealth;
      }
      roundLog.push(...slowerTurn.turnLog);
    }

    return {
      newFirstHealth: firstHealth,
      newSecondHealth: secondHealth,
      roundLog
    };
  }

  protected async updateCombatResults(
    participants: {
      first: CombatParticipant;
      second: CombatParticipant;
    },
    finalHealth: {
      firstHealth: number;
      secondHealth: number;
    }
  ): Promise<void> {
    await Promise.all([
      this.prisma.character.update({
        where: { id: participants.first.id },
        data: { health: Math.max(0, finalHealth.firstHealth) }
      }),
      this.prisma.character.update({
        where: { id: participants.second.id },
        data: { health: Math.max(0, finalHealth.secondHealth) }
      })
    ]);
  }
} 
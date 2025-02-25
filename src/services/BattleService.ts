import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder, MessageFlags, Message } from 'discord.js';
import { QuestService } from './QuestService';
import { CharacterService } from './CharacterService';
import { StatusEffect, ActiveBuff, StatusEffects, ActiveBuffs } from '@/types/game';
import { BaseService } from './BaseService';
import { MONSTERS, ITEMS, Monster } from '../config/gameData';

interface BattleState {
  combo: number;
  isGearSecond: boolean;
  gearSecondTurns: number;
  activeBuffs: ActiveBuffs;
  statusEffects: StatusEffects;
}

interface DamageResult {
  damage: number;
  isCritical: boolean;
  critMultiplier: number;
}

// Add type guard for Monster
function isMonster(m: unknown): m is Monster {
  return (
    typeof m === 'object' &&
    m !== null &&
    'name' in m &&
    'level' in m &&
    'hp' in m &&
    'attack' in m &&
    'defense' in m &&
    'exp' in m &&
    'drops' in m
  );
}

export class BattleService extends BaseService {
  private battleStates: Map<string, BattleState>;
  private characterService: CharacterService;
  private questService: QuestService;

  constructor(prisma: PrismaClient, characterService?: CharacterService) {
    super(prisma);
    this.battleStates = new Map();
    this.characterService = characterService || new CharacterService(prisma);
    this.questService = new QuestService(prisma, this.characterService);
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
      statusEffects: { effects: [] }
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

  calculateDamage(attackerAttack: number, defenderDefense: number): DamageResult {
    const baseDamage = Math.max(attackerAttack - defenderDefense / 2, CONFIG.BATTLE.MIN_DAMAGE);
    
    // Critical hit check with improved variety
    const critRoll = Math.random();
    let isCritical = false;
    let critMultiplier = 1;

    if (critRoll < 0.01) { // 1% chance super crit
      isCritical = true;
      critMultiplier = 3;
    } else if (critRoll < 0.1) { // 9% chance normal crit
      isCritical = true;
      critMultiplier = 1.5;
    }
    
    const damage = isCritical ? baseDamage * critMultiplier : baseDamage;
    return { damage: Math.floor(damage), isCritical, critMultiplier };
  }

  private getRandomMonster(level: number): Monster {
    // Filter monsters by level range
    const availableMonsters = Object.values(MONSTERS).filter(m => 
      isMonster(m) && Math.abs(m.level - level) <= 2
    );

    if (availableMonsters.length === 0) {
      // Return default monster if no suitable monsters found
      return MONSTERS.bandit_weak;
    }

    // Get random monster from available ones
    const randomIndex = Math.floor(Math.random() * availableMonsters.length);
    const monster = availableMonsters[randomIndex];
    
    if (!isMonster(monster)) {
      return MONSTERS.bandit_weak;
    }

    return monster;
  }

  async processBattle(characterId: string, enemyLevel: number) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Get enemy monster
      const enemy = this.getRandomMonster(enemyLevel);
      let enemyHp = enemy.hp;
      let characterHp = character.health;

      // Initialize battle state
      const battleState: BattleState = {
        combo: 0,
        isGearSecond: false,
        gearSecondTurns: 0,
        activeBuffs: { buffs: [] },
        statusEffects: { effects: [] }
      };

      // Battle log
      const battleLog = [];
      battleLog.push(`⚔️ Pertarungan dimulai!\n${character.name} VS ${enemy.name}`);
      battleLog.push(`${enemy.name} (Level ${enemy.level})\nHP: ${enemyHp}/${enemy.hp}\nAttack: ${enemy.attack}\nDefense: ${enemy.defense}`);

      // Battle loop
      let turn = 1;
      while (enemyHp > 0 && characterHp > 0) {
        // Character's turn
        const characterDamage = this.calculateDamage(character.attack, enemy.defense);
        enemyHp -= characterDamage.damage;
        
        let turnLog = `Turn ${turn} - ${character.name}`;
        if (characterDamage.isCritical) {
          turnLog += ` �� Critical Hit! (x${characterDamage.critMultiplier})`;
        }
        turnLog += `\n⚔️ Damage: ${characterDamage.damage}\n${enemy.name} HP: ${Math.max(0, enemyHp)}/${enemy.hp}`;
        battleLog.push(turnLog);

        // Enemy's turn if still alive
        if (enemyHp > 0) {
          const enemyDamage = this.calculateDamage(enemy.attack, character.defense);
          characterHp -= enemyDamage.damage;
          
          turnLog = `${enemy.name}`;
          if (enemyDamage.isCritical) {
            turnLog += ` 🎯 Critical Hit! (x${enemyDamage.critMultiplier})`;
          }
          turnLog += `\n⚔️ Damage: ${enemyDamage.damage}\n${character.name} HP: ${Math.max(0, characterHp)}/${character.maxHealth}`;
          battleLog.push(turnLog);
        }

        turn++;
      }

      // Determine battle result
      const won = enemyHp <= 0;
      const result = {
        won,
        exp: won ? enemy.exp : 0,
        drops: won ? this.generateDrops(enemy) : [],
        finalHp: characterHp
      };

      // Update character stats
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          health: Math.max(0, characterHp)
        }
      });

      // Create battle record
      await this.prisma.battle.create({
        data: {
          characterId,
          enemyType: enemy.name,
          enemyLevel: enemy.level,
          status: won ? 'WON' : 'LOST',
          turns: JSON.stringify(battleLog),
          finalStats: JSON.stringify({
            characterHp: characterHp,
            enemyHp: enemyHp
          }),
          rewards: JSON.stringify({
            exp: result.exp,
            drops: result.drops
          })
        }
      });

      return {
        won,
        exp: result.exp,
        drops: result.drops,
        battleLog
      };
    } catch (error) {
      this.logger.error('Error in processBattle:', error);
      throw error;
    }
  }

  private createHpBar(percent: number, currentHp: number): string {
    const barLength = 10;
    const filledBars = Math.floor((percent / 100) * barLength);
    const emptyBars = barLength - filledBars;
    
    return `[${'🟩'.repeat(filledBars)}${'⬜'.repeat(emptyBars)}] ${currentHp} HP`;
  }

  private generateDrops(monster: Monster): string[] {
    const drops: string[] = [];
    
    // Base drop rate 20%
    const baseDropRate = 0.2;
    
    for (const itemId of monster.drops) {
      if (Math.random() < baseDropRate) {
        drops.push(itemId);
      }
    }
    
    return drops;
  }
}
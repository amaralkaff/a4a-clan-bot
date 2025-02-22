import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder, MessageFlags, Message } from 'discord.js';
import { QuestService } from './QuestService';
import { CharacterService } from './CharacterService';
import { StatusEffect, ActiveBuff, StatusEffects, ActiveBuffs } from '@/types/game';
import { BaseService } from './BaseService';

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

  async processBattle(characterId: string, enemyLevel: number) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
      });

      if (!character) throw new Error('Character not found');

      // Generate enemy stats based on level
      const enemy = {
        health: 50 + (enemyLevel * 10),
        attack: 5 + (enemyLevel * 2),
        defense: 5 + (enemyLevel * 2),
      };

      // Initialize or get battle state
      let battleState = this.battleStates.get(characterId) || await this.initBattleState(characterId);
      this.battleStates.set(characterId, battleState);

      // Battle simulation
      let characterHealth = character.health;
      let enemyHealth = enemy.health;
      const battleLog = [];
      let criticalHits = 0;

      // Create rich embed for battle start
      const battleEmbed = new EmbedBuilder()
        .setTitle('⚔️ Pertarungan Dimulai!')
        .setColor('#ff0000')
        .addFields(
          { name: '👤 Karakter', value: `${character.name}\n❤️ HP: ${characterHealth}\n💪 ATK: ${character.attack}\n🛡️ DEF: ${character.defense}`, inline: true },
          { name: '👾 Musuh', value: `Level ${enemyLevel}\n❤️ HP: ${enemyHealth}\n💪 ATK: ${enemy.attack}\n🛡️ DEF: ${enemy.defense}`, inline: true }
        );

      battleLog.push({ embeds: [battleEmbed] });

      let turnCount = 0;
      let totalDamageDealt = 0;
      while (characterHealth > 0 && enemyHealth > 0) {
        turnCount++;
        
        // Character attacks
        const { damage: baseDamage, isCritical, critMultiplier } = this.calculateDamage(character.attack, enemy.defense);
        let finalDamage = await this.applyMentorEffects(character, baseDamage, isCritical, battleState);
        enemyHealth -= finalDamage;
        totalDamageDealt += finalDamage;

        if (isCritical) criticalHits++;

        // Create turn embed
        const turnEmbed = new EmbedBuilder()
          .setColor(isCritical ? '#ffd700' : '#0099ff')
          .setTitle(`Turn ${turnCount}`);

        // Add combo indicator if exists
        if (battleState.combo > 0) {
          turnEmbed.setFooter({ text: `🔄 Combo: ${battleState.combo}` });
        }

        // Character attack message
        let attackMessage = `👤 ${character.name} menyerang!`;
        if (isCritical) {
          attackMessage += critMultiplier >= 3 ? 
            ' ⚡⚡⚡ SUPER CRITICAL! ⚡⚡⚡' : 
            ' ⚡ CRITICAL! ⚡';
        }
        if (battleState.isGearSecond) {
          attackMessage += ' 🔥 [GEAR SECOND ACTIVE!]';
        }
        attackMessage += `\n💥 Damage: ${finalDamage}`;

        turnEmbed.addFields({ name: 'Serangan Karakter', value: attackMessage });

        // Process enemy turn if still alive
        if (enemyHealth > 0) {
          const { damage: enemyDamage, isCritical: isEnemyCritical } = this.calculateDamage(enemy.attack, character.defense);
          characterHealth -= enemyDamage;

          turnEmbed.addFields({
            name: 'Serangan Musuh',
            value: `👾 Musuh menyerang!${isEnemyCritical ? ' ⚡ CRITICAL! ⚡' : ''}\n💥 Damage: ${enemyDamage}`
          });
        }

        // Process status effects
        const { health: newHealth, messages: statusMessages } = await this.processStatusEffects(characterId, battleState, characterHealth);
        characterHealth = newHealth;
        if (statusMessages.length > 0) {
          turnEmbed.addFields({
            name: 'Status Effects',
            value: statusMessages.join('\n')
          });
        }

        // Update HP bars
        const characterHpPercent = Math.max(0, Math.min(100, (characterHealth / character.maxHealth) * 100));
        const enemyHpPercent = Math.max(0, Math.min(100, (enemyHealth / enemy.health) * 100));

        turnEmbed.addFields(
          { name: 'HP Karakter', value: this.createHpBar(characterHpPercent, characterHealth), inline: true },
          { name: 'HP Musuh', value: this.createHpBar(enemyHpPercent, enemyHealth), inline: true }
        );

        battleLog.push({ embeds: [turnEmbed] });
      }

      const won = characterHealth > 0;
      const experience = won ? Math.floor(enemyLevel * 10 * (1 + turnCount * 0.1)) : Math.floor(enemyLevel * 2);

      // Update quest progress
      await this.questService.updateQuestProgress(characterId, 'COMBAT', 1);
      
      // Update critical hits progress if using Usopp's weapon
      if (character.mentor === 'LYuka' && criticalHits > 0) {
        await this.questService.updateQuestProgress(characterId, 'CRITICAL_HIT', criticalHits);
      }

      // Update combo progress for Luffy's quests
      if (character.mentor === 'YB' && battleState.combo >= 5) {
        await this.questService.updateQuestProgress(characterId, 'COMBO', 1);
      }

      // Create battle result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle(won ? '🎉 Kemenangan!' : '💀 Kekalahan!')
        .setColor(won ? '#00ff00' : '#ff0000')
        .setDescription(won ? 
          `Selamat! Kamu berhasil mengalahkan musuh level ${enemyLevel}!` :
          'Kamu kalah dalam pertarungan ini...')
        .addFields(
          { name: 'HP Tersisa', value: `❤️ ${Math.max(0, characterHealth)}`, inline: true },
          { name: 'Total Turn', value: `🔄 ${turnCount}`, inline: true },
          { name: 'Experience', value: `✨ +${experience} EXP`, inline: true }
        );

      battleLog.push({ embeds: [resultEmbed] });

      // Update character stats
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          health: Math.max(0, characterHealth),
          experience: { increment: experience }
        }
      });

      // Create battle log
      await this.prisma.battleLog.create({
        data: {
          characterId,
          enemyType: `Level ${enemyLevel} Enemy`,
          enemyLevel,
          damage: totalDamageDealt,
          experience,
          rewards: '{}',
          won
        }
      });

      // Clear battle state if battle is over
      this.battleStates.delete(characterId);

      // Update mentor progress berdasarkan tipe pertarungan
      if (won) {
        switch(character.mentor) {
          case 'YB':
            await this.characterService.updateMentorProgress(characterId, 'YB', 5);
            break;
          case 'Tierison':
            if (criticalHits > 0) {
              await this.characterService.updateMentorProgress(characterId, 'Tierison', 3);
            }
            break;
          case 'LYuka':
            await this.characterService.updateMentorProgress(characterId, 'LYuka', 5);
            break;
          case 'GarryAng':
            await this.characterService.updateMentorProgress(characterId, 'GarryAng', 5);
            break;
        }
      }

      return {
        won,
        battleLog,
        remainingHealth: Math.max(0, characterHealth),
        experience
      };
    } catch (error) {
      logger.error('Error in battle:', error);
      throw error;
    }
  }

  private createHpBar(percent: number, currentHp: number): string {
    const barLength = 10;
    const filledBars = Math.floor((percent / 100) * barLength);
    const emptyBars = barLength - filledBars;
    
    return `[${'🟩'.repeat(filledBars)}${'⬜'.repeat(emptyBars)}] ${currentHp} HP`;
  }
}
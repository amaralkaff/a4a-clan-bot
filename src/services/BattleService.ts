import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder, MessageFlags, Message } from 'discord.js';
import { QuestService } from './QuestService';
import { CharacterService } from './CharacterService';
import { StatusEffect, ActiveBuff, StatusEffects, ActiveBuffs } from '@/types/game';
import { BaseService } from './BaseService';
import { MONSTERS, ITEMS } from '../config/gameData';

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

      // Tambahkan perhitungan coins
      const baseCoins = enemyLevel * 25; // Base 25 coins per level musuh
      const coinMultipliers = {
        winBonus: 1.5,      // Bonus 50% jika menang
        critBonus: 0.2,     // Bonus 20% per critical hit
        comboBonus: 0.1,    // Bonus 10% per combo
        levelDiffBonus: 0.3 // Bonus 30% per level diatas karakter
      };

      let totalCoins = baseCoins;

      if (won) {
        // Bonus menang
        totalCoins *= coinMultipliers.winBonus;
        
        // Bonus critical hits
        totalCoins += baseCoins * (criticalHits * coinMultipliers.critBonus);
        
        // Bonus combo
        if (battleState.combo > 0) {
          totalCoins += baseCoins * (battleState.combo * coinMultipliers.comboBonus);
        }
        
        // Bonus level difference (jika melawan musuh level lebih tinggi)
        const levelDiff = enemyLevel - character.level;
        if (levelDiff > 0) {
          totalCoins += baseCoins * (levelDiff * coinMultipliers.levelDiffBonus);
        }
        
        // Pembulatan ke atas
        totalCoins = Math.ceil(totalCoins);
        
        // Update karakter dengan coins yang didapat
        await this.characterService.addCoins(
          characterId, 
          totalCoins, 
          'BATTLE_REWARD',
          `Battle reward from defeating Level ${enemyLevel} enemy`
        );
      }

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

      // Add experience and check for level up
      const expResult = await this.characterService.addExperience(characterId, experience);

      // Calculate item drops if won
      let droppedItems = [];
      if (won) {
        // Get monster based on level range
        const possibleMonsters = Object.values(MONSTERS).filter(
          m => m.level === enemyLevel
        );
        
        if (possibleMonsters.length > 0) {
          // Randomly select one monster from the level range
          const monster = possibleMonsters[Math.floor(Math.random() * possibleMonsters.length)];
          
          // Calculate drops for the monster
          if (monster.drops) {
            for (const itemId of monster.drops) {
              const item = ITEMS[itemId as keyof typeof ITEMS];
              if (item) {
                // Base drop rate 20%
                const dropChance = 0.20;
                if (Math.random() < dropChance) {
                  droppedItems.push({
                    id: itemId,
                    name: item.name,
                    quantity: 1
                  });

                  // Add item to inventory
                  try {
                    // Pertama, periksa apakah item ada
                    const item = await this.prisma.item.findUnique({
                      where: { id: itemId }
                    });

                    if (!item) {
                      throw new Error(`Item dengan ID ${itemId} tidak ditemukan`);
                    }

                    // Periksa apakah character ada
                    const character = await this.prisma.character.findUnique({
                      where: { id: characterId }
                    });

                    if (!character) {
                      throw new Error(`Character dengan ID ${characterId} tidak ditemukan`);
                    }

                    // Coba temukan inventory yang ada
                    const existingInventory = await this.prisma.inventory.findUnique({
                      where: {
                        characterId_itemId: {
                          characterId,
                          itemId
                        }
                      }
                    });

                    if (existingInventory) {
                      // Update jika sudah ada
                      await this.prisma.inventory.update({
                        where: {
                          characterId_itemId: {
                            characterId,
                            itemId
                          }
                        },
                        data: {
                          quantity: { increment: 1 }
                        }
                      });
                    } else {
                      // Buat baru jika belum ada
                      await this.prisma.inventory.create({
                        data: {
                          characterId,
                          itemId,
                          quantity: 1
                        }
                      });
                    }
                  } catch (error) {
                    this.logger.error('Error adding item to inventory:', error);
                    // Tambahkan logging yang lebih detail
                    this.logger.error('Details:', {
                      characterId,
                      itemId,
                      error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    throw error;
                  }
                }
              }
            }
          }
        }
      }

      // Create battle result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle(won ? '🎉 Kemenangan!' : '💀 Kekalahan!')
        .setColor(won ? '#00ff00' : '#ff0000')
        .setDescription(won ? 
          `Selamat! Kamu berhasil mengalahkan musuh level ${enemyLevel}!` :
          'Kamu kalah dalam pertarungan ini...')
        .addFields(
          { name: '❤️ HP Tersisa', value: `${Math.max(0, characterHealth)}`, inline: true },
          { name: '🔄 Total Turn', value: `${turnCount}`, inline: true },
          { name: '✨ Experience', value: `+${experience} EXP`, inline: true },
          { name: '💰 Coins', value: won ? `+${totalCoins} coins` : '0 coins', inline: true }
        );

      // Jika menang, tambahkan detail bonus
      if (won && (criticalHits > 0 || battleState.combo > 0 || enemyLevel > character.level)) {
        let bonusDetails = ['💰 Bonus Breakdown:'];
        bonusDetails.push(`• Base: ${baseCoins} coins`);
        bonusDetails.push(`• Win Bonus: +${Math.floor(baseCoins * (coinMultipliers.winBonus - 1))} coins`);
        
        if (criticalHits > 0) {
          bonusDetails.push(`• Critical Hits (${criticalHits}x): +${Math.floor(baseCoins * (criticalHits * coinMultipliers.critBonus))} coins`);
        }
        
        if (battleState.combo > 0) {
          bonusDetails.push(`• Combo (${battleState.combo}x): +${Math.floor(baseCoins * (battleState.combo * coinMultipliers.comboBonus))} coins`);
        }
        
        const levelDiff = enemyLevel - character.level;
        if (levelDiff > 0) {
          bonusDetails.push(`• Level Difference (+${levelDiff}): +${Math.floor(baseCoins * (levelDiff * coinMultipliers.levelDiffBonus))} coins`);
        }
        
        resultEmbed.addFields({
          name: '💎 Bonus Details',
          value: bonusDetails.join('\n'),
          inline: false
        });
      }

      // Add dropped items to embed if any
      if (droppedItems.length > 0) {
        resultEmbed.addFields({
          name: '🎁 Item Drop',
          value: droppedItems.map(item => `${item.name} x${item.quantity}`).join('\n'),
          inline: false
        });
      }

      // Add level up notification if leveled up
      if (expResult.leveledUp) {
        const statsGained = expResult.statsGained!;
        resultEmbed.addFields(
          { 
            name: '🎊 LEVEL UP!', 
            value: `Level ${expResult.newLevel! - expResult.levelsGained!} ➔ ${expResult.newLevel!}`,
            inline: false 
          },
          {
            name: '📈 Stat Gains',
            value: `⚔️ Attack +${statsGained.attack}\n🛡️ Defense +${statsGained.defense}\n❤️ Max HP +${statsGained.maxHealth}`,
            inline: false
          }
        );
      }

      battleLog.push({ embeds: [resultEmbed] });

      // Update character stats
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          health: Math.max(0, characterHealth)
        }
      });

      // Create battle log
      await this.prisma.battle.create({
        data: {
          characterId,
          enemyType: `Level ${enemyLevel} Enemy`,
          enemyLevel,
          status: won ? 'COMPLETED' : 'FAILED',
          turns: JSON.stringify([]),
          finalStats: JSON.stringify({
            damage: totalDamageDealt,
            experience,
            criticalHits
          }),
          rewards: JSON.stringify({
            experience,
            items: []
          })
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
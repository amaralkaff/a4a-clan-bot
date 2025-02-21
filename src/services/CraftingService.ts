import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { QuestService } from './QuestService';
import { InventoryService } from './InventoryService';
import { CharacterService } from './CharacterService';
import { BaseService } from './BaseService';
import { EmbedBuilder } from 'discord.js';

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: {
    itemId: string;
    quantity: number;
  }[];
  result: {
    itemId: string;
    quantity: number;
  };
  requiredLevel: number;
  mentor?: string;
}

export class CraftingService extends BaseService {
  private recipes: Map<string, Recipe>;
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
    this.recipes = new Map([
      ['sanji_basic_meal', {
        id: 'sanji_basic_meal',
        name: '🍱 Hidangan Dasar',
        description: 'Masakan sederhana yang menyehatkan',
        ingredients: [
          { itemId: 'meat_raw', quantity: 1 },
          { itemId: 'herbs', quantity: 1 }
        ],
        result: { itemId: 'meat_cooked', quantity: 1 },
        requiredLevel: 1,
        mentor: 'GarryAng'
      }],
      ['sanji_special', {
        id: 'sanji_special',
        name: '👨‍🍳 Masakan Spesial Sanji',
        description: 'Hidangan spesial yang memberikan buff',
        ingredients: [
          { itemId: 'meat_raw', quantity: 2 },
          { itemId: 'fish_fresh', quantity: 2 },
          { itemId: 'herbs', quantity: 3 }
        ],
        result: { itemId: 'sanji_special', quantity: 1 },
        requiredLevel: 5,
        mentor: 'GarryAng'
      }]
    ]);
  }

  async craft(characterId: string, recipeId: string) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const recipe = this.recipes.get(recipeId);
      if (!recipe) throw new Error('Resep tidak ditemukan');

      if (character.level < recipe.requiredLevel) {
        throw new Error(`Level tidak cukup (Required: ${recipe.requiredLevel})`);
      }

      if (recipe.mentor && recipe.mentor !== character.mentor) {
        throw new Error('Resep ini hanya untuk murid Sanji');
      }

      // Check ingredients
      const inventoryService = new InventoryService(this.prisma);
      const inventory = await inventoryService.getInventory(characterId);
      
      for (const ingredient of recipe.ingredients) {
        const item = inventory.find(i => i.id === ingredient.itemId);
        if (!item || item.quantity < ingredient.quantity) {
          throw new Error(`Bahan tidak cukup: ${ingredient.itemId}`);
        }
      }

      // Remove ingredients
      for (const ingredient of recipe.ingredients) {
        await inventoryService.addItem(characterId, ingredient.itemId, -ingredient.quantity);
      }

      // Add result
      await inventoryService.addItem(characterId, recipe.result.itemId, recipe.result.quantity);

      // Update quest progress
      const questService = new QuestService(this.prisma, this.characterService);
      await questService.updateQuestProgress(characterId, 'CRAFTING', 1);

      // Create result embed
      const craftEmbed = new EmbedBuilder()
        .setTitle('🍳 Crafting Berhasil!')
        .setColor('#00ff00')
        .setDescription(`Berhasil membuat ${recipe.name}!`)
        .addFields(
          { name: '📝 Resep', value: recipe.description },
          { name: '✨ Hasil', value: `${recipe.result.quantity}x ${recipe.result.itemId}` }
        );

      if (character.mentor === 'GarryAng') {
        await this.characterService.updateMentorProgress(characterId, 'GarryAng', 5);
      }

      return {
        success: true,
        recipe,
        embed: craftEmbed
      };
    } catch (error) {
      logger.error('Error in crafting:', error);
      throw error;
    }
  }

  async getAvailableRecipes(characterId: string) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const availableRecipes = Array.from(this.recipes.values())
        .filter(recipe => {
          if (recipe.requiredLevel > character.level) return false;
          if (recipe.mentor && recipe.mentor !== character.mentor) return false;
          return true;
        });

      const recipeEmbed = new EmbedBuilder()
        .setTitle('📖 Resep yang Tersedia')
        .setColor('#0099ff');

      if (availableRecipes.length > 0) {
        for (const recipe of availableRecipes) {
          recipeEmbed.addFields({
            name: recipe.name,
            value: `${recipe.description}\n\nBahan:\n${recipe.ingredients.map(i => 
              `• ${i.quantity}x ${i.itemId}`
            ).join('\n')}\n\nHasil: ${recipe.result.quantity}x ${recipe.result.itemId}`
          });
        }
      } else {
        recipeEmbed.setDescription('❌ Tidak ada resep yang tersedia');
      }

      return {
        recipes: availableRecipes,
        embed: recipeEmbed
      };
    } catch (error) {
      logger.error('Error getting available recipes:', error);
      throw error;
    }
  }
} 
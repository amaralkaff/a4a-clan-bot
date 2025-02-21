// src/services/index.ts
import { PrismaClient } from '@prisma/client';
import { CharacterService } from '@/services/CharacterService';
import { BattleService } from '@/services/BattleService';
import { InventoryService } from '@/services/InventoryService';
import { QuestService } from '@/services/QuestService';
import { WeatherService } from '@/services/WeatherService';
import { ExplorationService } from '@/services/ExplorationService';
import { NpcService } from '@/services/NpcService';
import { logger } from '@/utils/logger';

export class ServiceContainer {
  public readonly character: CharacterService;
  public readonly battle: BattleService;
  public readonly inventory: InventoryService;
  public readonly quest: QuestService;
  public readonly weather: WeatherService;
  public readonly exploration: ExplorationService;
  public readonly npc: NpcService;

  public readonly logger = logger;


  constructor(prisma: PrismaClient) {
    this.character = new CharacterService(prisma);
    this.battle = new BattleService(prisma);
    this.inventory = new InventoryService(prisma);
    this.quest = new QuestService(prisma);
    this.weather = new WeatherService();
    this.exploration = new ExplorationService(prisma);
    this.npc = new NpcService(prisma);
  }
}
import { PrismaClient } from '@prisma/client';
import { CharacterService } from './CharacterService';
import { InventoryService } from './InventoryService';
import { LocationService } from './LocationService';
import { ShopService } from './ShopService';
import { HelpService } from './HelpService';
import { LeaderboardService } from './LeaderboardService';
import { DuelService } from './combat/DuelService';
import { MentorService } from './MentorService';
import { QuestService } from './QuestService';
import { GamblingService } from './GamblingService';
import { BattleService } from './combat/BattleService';
import { WeaponService } from './WeaponService';
import { EquipmentService } from './EquipmentService';
import { logger } from '../utils/logger';

export class ServiceContainer {
  private prisma: PrismaClient;
  public character!: CharacterService;
  public inventory!: InventoryService;
  public location!: LocationService;
  public shop!: ShopService;
  public help!: HelpService;
  public leaderboard!: LeaderboardService;
  public duel!: DuelService;
  public mentor!: MentorService;
  public quest!: QuestService;
  public gambling!: GamblingService;
  public battle!: BattleService;
  public weapon!: WeaponService;
  public equipment!: EquipmentService;
  public logger = logger;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async init() {
    try {
      // Initialize Prisma
      await this.prisma.$connect();
      logger.info('Database connected successfully');

      // Initialize base services first
      this.character = new CharacterService(this.prisma);
      this.equipment = new EquipmentService(this.prisma);
      this.weapon = new WeaponService(this.prisma);
      this.battle = new BattleService(this.prisma, this.character);

      // Initialize dependent services
      this.inventory = new InventoryService(this.prisma, this.character);
      this.location = new LocationService(this.prisma, this.character);
      this.shop = new ShopService(this.prisma, this.character, this.inventory);
      this.help = new HelpService(this.prisma);
      this.leaderboard = new LeaderboardService(this.prisma);
      this.duel = new DuelService(this.prisma, this.character);
      this.mentor = new MentorService(this.prisma, this.character);
      this.quest = new QuestService(this.prisma, this.character);
      this.gambling = new GamblingService(this.prisma, this.character);

      // Set up cross-service dependencies
      this.character.setBattleService(this.battle);
      this.duel.setBattleService(this.battle);
      this.inventory.setEquipmentService(this.equipment);
      this.shop.setEquipmentService(this.equipment);

      logger.info('Services initialized successfully');
    } catch (error) {
      logger.error('Error initializing services:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }
} 
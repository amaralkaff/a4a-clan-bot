// src/services/BaseService.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export abstract class BaseService {
  protected prisma: PrismaClient;
  protected logger = logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  protected async handleError(error: unknown, context: string): Promise<never> {
    this.logger.error(`[${context}] Error:`, error);
    throw error;
  }
}
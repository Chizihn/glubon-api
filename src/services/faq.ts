import { PrismaClient, FAQ } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { logger } from "../utils";

export class FAQService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async createFAQ(data: {
    question: string;
    answer: string;
    category: string;
    order?: number;
    isActive?: boolean;
    updatedBy: string;
  }): Promise<FAQ> {
    try {
      const order = data.order ?? (await this.getMaxOrder()) + 1;
      
      const faq = await this.prisma.fAQ.create({
        data: {
          ...data,
          order,
          isActive: data.isActive ?? true,
        },
      });

      await this.createAuditLog({
        userId: data.updatedBy,
        action: 'CREATE',
        resource: 'FAQ',
        resourceId: faq.id,
        newValues: { ...data, order },
      });

      return faq;
    } catch (error) {
      logger.error('Error creating FAQ:', error);
      throw new Error('Failed to create FAQ');
    }
  }

  async updateFAQ(id: string, data: {
    question?: string;
    answer?: string;
    category?: string;
    order?: number;
    isActive?: boolean;
    updatedBy: string;
  }): Promise<FAQ> {
    try {
      const oldFaq = await this.prisma.fAQ.findUnique({ where: { id } });
      
      const updatedFaq = await this.prisma.fAQ.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      await this.createAuditLog({
        userId: data.updatedBy,
        action: 'UPDATE',
        resource: 'FAQ',
        resourceId: id,
        oldValues: oldFaq,
        newValues: updatedFaq,
      });

      return updatedFaq;
    } catch (error) {
      logger.error('Error updating FAQ:', error);
      throw new Error('Failed to update FAQ');
    }
  }

  async deleteFAQ(id: string, userId: string): Promise<boolean> {
    try {
      const oldFaq = await this.prisma.fAQ.findUnique({ where: { id } });
      
      await this.prisma.fAQ.delete({
        where: { id },
      });

      await this.createAuditLog({
        userId,
        action: 'DELETE',
        resource: 'FAQ',
        resourceId: id,
        oldValues: oldFaq,
      });

      return true;
    } catch (error) {
      logger.error('Error deleting FAQ:', error);
      throw new Error('Failed to delete FAQ');
    }
  }

  async getFAQs(category?: string): Promise<FAQ[]> {
    try {
      return await this.prisma.fAQ.findMany({
        where: {
          isActive: true,
          ...(category && { category }),
        },
        orderBy: [
          { category: 'asc' },
          { order: 'asc' },
        ],
      });
    } catch (error) {
      logger.error('Error fetching FAQs:', error);
      throw new Error('Failed to fetch FAQs');
    }
  }

  async getCategories(): Promise<{name: string, count: number}[]> {
    try {
      // First, get all distinct categories
      const categories = await this.prisma.fAQ.groupBy({
        by: ['category'],
        where: { isActive: true },
        orderBy: { category: 'asc' },
        _count: true
      });

      return categories.map(cat => ({
        name: cat.category,
        count: cat._count
      }));
    } catch (error) {
      logger.error('Error fetching FAQ categories:', error);
      throw new Error('Failed to fetch FAQ categories');
    }
  }

  private async getMaxOrder(): Promise<number> {
    const result = await this.prisma.fAQ.aggregate({
      _max: { order: true },
    });
    
    return result._max.order ?? 0;
  }

  private async createAuditLog(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    oldValues?: any;
    newValues?: any;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          ...data,
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : null,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : null,
        },
      });
    } catch (error) {
      logger.error('Error creating audit log:', error);
    }
  }
}
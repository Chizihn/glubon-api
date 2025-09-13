import { PrismaClient, Ad, AdStatus, AdType, AdPosition } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { logger } from "../utils";
import { ServiceResponse } from "../types";

export class AdService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async createAd(data: {
    title: string;
    description?: string;
    imageUrl: string;
    targetUrl: string;
    position: AdPosition;
    type?: AdType;
    startDate: Date;
    endDate: Date;
    budget?: number;
    costPerClick?: number;
    createdBy: string;
  }): Promise<ServiceResponse<Ad>> {
    try {
      const ad = await this.prisma.ad.create({
        data: {
          ...data,
          status: AdStatus.PENDING,
          isActive: false,
        },
      });

      return this.success(ad, 'Ad created successfully');
    } catch (error) {
      return this.handleError(error, 'createAd');
    }
  }

  async getActiveAds(position?: AdPosition): Promise<ServiceResponse<Ad[]>> {
    try {
      const now = new Date();

      const ads = await this.prisma.ad.findMany({
        where: {
          isActive: true,
          status: AdStatus.APPROVED,
          startDate: { lte: now },
          endDate: { gte: now },
          ...(position && { position }),
        },
        orderBy: { createdAt: "desc" },
      });

      return this.success(ads, 'Active ads retrieved successfully');
    } catch (error) {
      return this.handleError(error, 'getActiveAds');
    }
  }

  async updateAdStatus(id: string, status: AdStatus, adminId: string): Promise<ServiceResponse<Ad>> {
    try {
      const ad = await this.prisma.ad.update({
        where: { id },
        data: {
          status,
          isActive: status === AdStatus.APPROVED,
        },
      });

      const auditLogResult = await this.createAuditLog({
        userId: adminId,
        action: "UPDATE",
        resource: "Ad",
        resourceId: id,
        newValues: { status },
      });

      if (!auditLogResult.success) {
        logger.warn('Failed to create audit log for ad status update', { 
          adId: id, 
          status,
          adminId,
          error: auditLogResult.message 
        });
      }

      return this.success(ad, 'Ad status updated successfully');
    } catch (error) {
      return this.handleError(error, 'updateAdStatus');
    }
  }

  async recordAdClick(id: string): Promise<ServiceResponse<{ adId: string; clicks: number }>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await this.prisma.adAnalytics.upsert({
        where: {
          adId_date: {
            adId: id,
            date: today,
          },
        },
        update: {
          clicks: { increment: 1 },
        },
        create: {
          adId: id,
          date: today,
          clicks: 1,
          impressions: 0,
          conversions: 0,
          revenue: 0,
        },
        select: {
          adId: true,
          clicks: true,
        },
      });

      return this.success(result, 'Ad click recorded successfully');
    } catch (error) {
      return this.handleError(error, 'recordAdClick');
    }
  }

  async recordAdImpression(id: string): Promise<ServiceResponse<{ adId: string; impressions: number }>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await this.prisma.adAnalytics.upsert({
        where: {
          adId_date: {
            adId: id,
            date: today,
          },
        },
        update: {
          impressions: { increment: 1 },
        },
        create: {
          adId: id,
          date: today,
          impressions: 1,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        },
        select: {
          adId: true,
          impressions: true,
        },
      });

      return this.success(result, 'Ad impression recorded successfully');
    } catch (error) {
      return this.handleError(error, 'recordAdImpression');
    }
  }

  private async createAuditLog(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ServiceResponse<{ id: string }>> {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId ?? null,
          oldValues: data.oldValues ?? {},
          newValues: data.newValues ?? {},
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
        },
        select: { id: true },
      });

      return this.success(auditLog, 'Audit log created successfully');
    } catch (error) {
      return this.handleError(error, 'createAuditLog');
    }
  }
}

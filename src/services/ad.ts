import { PrismaClient, Ad, AdStatus, AdType, AdPosition } from "@prisma/client";
import { GetAdsFilter } from "../modules/ad/ad.inputs";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { logger } from "../utils";
import { ServiceResponse } from "../types";

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

@Service()
export class AdService extends BaseService {
  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis
  ) {
    super(prisma, redis);
  }

  async getAdById(id: string): Promise<ServiceResponse<Ad | null>> {
    try {
      console.log(`Fetching ad with ID: ${id}`);
      const ad = await this.prisma.ad.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!ad) {
        return { 
          success: false, 
          message: 'Ad not found',
          data: null 
        };
      }

      return { 
        success: true, 
        data: ad, 
        message: 'Ad fetched successfully' 
      };
    } catch (error) {
      console.error(`Error in getAdById: ${error}`);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null
      };
    }
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

  async getAds(
    filter?: GetAdsFilter
  ): Promise<ServiceResponse<{ data: Ad[]; totalItems: number; page: number; limit: number; totalPages: number }>> {
    try {
      console.log('getAds service called with filter:', JSON.stringify(filter, null, 2));
      
      const where: any = {};
      const { pagination = { page: 1, limit: 10 }, sort, search, ...filters } = filter || {};
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(100, Math.max(1, pagination?.limit || 10));
      const skip = (page - 1) * limit;

      // Apply filters
      if (filters.ids?.length) where.id = { in: filters.ids };
      if (filters.statuses?.length) where.status = { in: filters.statuses };
      if (filters.positions?.length) where.position = { in: filters.positions };
      if (filters.types?.length) where.type = { in: filters.types };
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      
      // Date range filters
      if (filters.startDateAfter || filters.startDateBefore) {
        where.startDate = {};
        if (filters.startDateAfter) where.startDate.gte = new Date(filters.startDateAfter);
        if (filters.startDateBefore) where.startDate.lte = new Date(filters.startDateBefore);
      }
      
      if (filters.endDateAfter || filters.endDateBefore) {
        where.endDate = {};
        if (filters.endDateAfter) where.endDate.gte = new Date(filters.endDateAfter);
        if (filters.endDateBefore) where.endDate.lte = new Date(filters.endDateBefore);
      }

      // Search functionality
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      console.log('Constructed Prisma where clause:', JSON.stringify(where, null, 2));

      // Build orderBy
      const orderBy: any[] = [];
      if (sort?.field) {
        orderBy.push({ [sort.field]: sort.order || 'asc' });
      } else {
        orderBy.push({ createdAt: 'desc' }); // Default sort
      }

      // Get total count for pagination
      const total = await this.prisma.ad.count({ where });
      const totalPages = Math.ceil(total / limit);

      console.log(`Found ${total} total ads matching filters`);

      // Get paginated results
      const data = await this.prisma.ad.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return this.success(
        {
          data,
          totalItems: total,
          page,
          limit,
          totalPages,
        },
        'Ads retrieved successfully'
      );
    } catch (error) {
      return this.handleError(error, 'getAds');
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

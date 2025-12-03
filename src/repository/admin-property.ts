import { PrismaClient, PropertyStatus, VerificationStatus } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";
import { AdminPropertyFilters } from "../types/services/admin";
import { logger } from "../utils";

export class AdminPropertyRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async getAllProperties(
    filters: AdminPropertyFilters,
    page: number,
    limit: number
  ): Promise<{ properties: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(page, limit);
    
    const cacheKey = this.generateCacheKey(
      "admin",
      "properties",
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );
    
    const cached = await this.getCache<{ properties: any[]; totalCount: number }>(cacheKey);
    if (cached) return cached;

    const where = this.buildPropertyWhereClause(filters);
    const orderBy: any = filters.sortBy 
      ? { [filters.sortBy]: filters.sortOrder || 'desc' } 
      : { createdAt: 'desc' };

    logger.info("Admin property filters:", filters);
    logger.info("Where clause:", JSON.stringify(where, null, 2));
    logger.info("Order by:", orderBy);

    try {
      const [totalCount, properties] = await Promise.all([
        this.prisma.property.count({ where }),
        this.prisma.property.findMany({
          where,
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                isVerified: true,
              },
            },
          },
          orderBy,
          skip,
          take: validatedLimit,
        }),
      ]);

      // No transformation needed as we're not including stats
      const transformedProperties = [...properties];

      const result = { 
        properties: transformedProperties, 
        totalCount 
      };

      await this.setCache(cacheKey, result, 300);
      return result;
    } catch (error: any) {
      logger.error("Error in getAllProperties:", error);
      throw new Error(`Failed to fetch properties: ${error?.message || 'Unknown error'}`);
    }
  }

  async updatePropertyStatus(propertyId: string, status: PropertyStatus): Promise<void> {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { status },
    });
    await this.deleteCachePattern(`property:${propertyId}:*`);
    await this.deleteCachePattern("properties:*");
  }

  async togglePropertyFeatured(
    propertyId: string
  ): Promise<{ featured: boolean; ownerId: string; title: string }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, featured: true, ownerId: true },
    });

    if (!property) throw new Error("Property not found");

    const newFeaturedStatus = !property.featured;
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { featured: newFeaturedStatus },
    });

    await this.deleteCachePattern(`property:${propertyId}:*`);
    await this.deleteCachePattern("properties:*");
    return {
      featured: newFeaturedStatus,
      ownerId: property.ownerId,
      title: property.title,
    };
  }



  async logAdminAction(adminId: string, action: string, data?: any): Promise<void> {
    try {
      await this.prisma.adminActionLog.create({
        data: { adminId, action, data: data || {} },
      });
    } catch (error) {
      logger.error("Failed to log admin action:", error);
    }
  }

  private buildPropertyWhereClause(filters: AdminPropertyFilters): any {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }
    if (filters.city) {
      where.city = { contains: filters.city, mode: "insensitive" };
    }
    if (filters.state) {
      where.state = { contains: filters.state, mode: "insensitive" };
    }
    if (filters.minAmount || filters.maxAmount) {
      where.amount = {};
      if (filters.minAmount) where.amount.gte = filters.minAmount;
      if (filters.maxAmount) where.amount.lte = filters.maxAmount;
    }

    if (filters.featured !== undefined && filters.featured !== null) {
      where.featured = filters.featured;
    }
    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = filters.createdAfter;
      if (filters.createdBefore) where.createdAt.lte = filters.createdBefore;
    }
    if (filters.sortBy) {
      where.orderBy = { [filters.sortBy]: filters.sortOrder || "desc" };
    }

    return where;
  }
}
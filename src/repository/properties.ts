import {
  PrismaClient,
  Property,
  PropertyStatus,
  RoleEnum,
  User,
} from "@prisma/client";
import { Redis } from "ioredis";
import {
  PropertyFilters,
  PropertySearchOptions,
  PropertyWithDetails,
  PropertySortByEnum,
  SortOrder,
  CreatePropertyInput,
} from "../types/services/properties";
import { BaseRepository } from "./base";
import { logger } from "../utils";
import { Decimal } from "@prisma/client/runtime/library";
import { Service } from "typedi";

@Service()
export class PropertyRepository extends BaseRepository {
  // Constructor removed to use BaseRepository's constructor with injection


  async create(data: any, tx?: any): Promise<Property> {
    const client = tx || this.prisma;
    return client.property.create({ data });
  }

  async findById(id: string, user?: User): Promise<PropertyWithDetails | null> {
    logger.info(
      `Repository: Finding property ${id} for user ${user?.id} with role ${user?.role}`
    );

    const cacheKey = this.generateCacheKey(
      "property",
      id,
      user?.id || "anonymous"
    );
    const cached = await this.getCache<PropertyWithDetails>(cacheKey);
    if (cached) {
      logger.info(`Property ${id} found in cache`);
      // Log if user has already liked the property (from cache)
      if (user?.id && cached.isLiked) {
        logger.info(`User ${user.id} has already liked property ${id}`);
      }
      return cached;
    }

    logger.info(`Property ${id} not in cache, fetching from database`);
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: this.getPropertyInclude(user?.id),
    });

    if (!property) {
      logger.info(`Property ${id} not found in database`);
      return null;
    }

    logger.info(`Property ${id} found in database, owner: ${property.ownerId}`);

    // Record view for authenticated tenants only, and not for property owner
    if (
      user?.id &&
      user.role === RoleEnum.RENTER &&
      property.ownerId !== user.id
    ) {
      logger.info(`Recording view for property ${id} by tenant ${user.id}`);
      try {
        await this.recordView(id, user.id);
        logger.info(
          `✅ View recorded successfully for property ${id} by user ${user.id}`
        );
        // Log the current view count after recording
        const viewCount = await this.prisma.propertyView.count({
          where: { propertyId: id },
        });
        logger.info(`Current view count for property ${id}: ${viewCount}`);
      } catch (error) {
        logger.error(`❌ Failed to record view for property ${id}:`, error);
      }
    } else {
      if (!user?.id) {
        logger.info(`No view recorded - user not authenticated`);
      } else if (user?.role !== RoleEnum.RENTER) {
        logger.info(
          `No view recorded - user ${user?.id} is not a tenant (role: ${user?.role})`
        );
      } else if (property.ownerId === user.id) {
        logger.info(`No view recorded - user ${user.id} is the property owner`);
      }
    }

    const transformed = this.transformProperty(property, user?.id);
    // Log if user has already liked the property (from DB)
    if (user?.id && transformed.isLiked) {
      logger.info(`User ${user.id} has already liked property ${id}`);
    }
    await this.setCache(cacheKey, transformed, 600);
    logger.info(`Property ${id} cached and returning transformed data`);
    return transformed;
  }

  async findMany(
    filters: PropertyFilters,
    options: PropertySearchOptions,
    userId?: string
  ): Promise<{
    properties: PropertyWithDetails[];
    totalCount: number;
  }> {
    const {
      page = 1,
      limit = 10,
      sortBy = PropertySortByEnum.CREATED_AT,
      sortOrder = SortOrder.DESC,
      search,
    } = options;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    const cacheKey = this.generateCacheKey(
      "properties",
      JSON.stringify(filters),
      JSON.stringify(options),
      userId || "anonymous"
    );
    const cached = await this.getCache<{
      properties: PropertyWithDetails[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const where = this.buildWhereClause(filters, search);
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const [totalCount, properties] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        include: this.getPropertyInclude(userId),
        orderBy,
        skip,
        take: validatedLimit,
      }),
    ]);

    let transformedProperties = properties.map((p) =>
      this.transformProperty(p, userId, filters)
    );

    // Apply distance filtering after transformation
    if (filters.radiusKm && filters.latitude && filters.longitude) {
      transformedProperties = transformedProperties.filter(
        (p) => p.distance !== undefined && p.distance <= filters.radiusKm!
      );
    }

    const result = { properties: transformedProperties, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async findByOwner(
    ownerId: string,
    options: PropertySearchOptions
  ): Promise<{
    properties: PropertyWithDetails[];
    totalCount: number;
  }> {
    const {
      page = 1,
      limit = 10,
      sortBy = PropertySortByEnum.CREATED_AT,
      sortOrder = SortOrder.DESC,
      filters,
    } = options;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    const cacheKey = this.generateCacheKey(
      "user",
      ownerId,
      "properties",
      JSON.stringify(options)
    );
    const cached = await this.getCache<{
      properties: PropertyWithDetails[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    // Build the where clause with filters
    const where: any = { ownerId };

    // Apply filters if they exist
    if (filters) {
      if (filters.status) where.status = filters.status;
      if (filters.propertyType) where.propertyType = filters.propertyType;
      if (filters.listingType) where.listingType = filters.listingType;

      // Handle amount range
      if (filters.minAmount || filters.maxAmount) {
        where.amount = {};
        if (filters.minAmount) where.amount.gte = filters.minAmount;
        if (filters.maxAmount) where.amount.lte = filters.maxAmount;
      }

      // Handle location filters
      if (filters.city)
        where.city = { contains: filters.city, mode: "insensitive" };
      if (filters.state)
        where.state = { contains: filters.state, mode: "insensitive" };

      // Handle date filters
      if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
      if (filters.createdBefore) {
        where.createdAt = {
          ...((where.createdAt as object) || {}),
          lte: filters.createdBefore,
        };
      }
      if (filters.updatedAfter) where.updatedAt = { gte: filters.updatedAfter };
    }

    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const [totalCount, properties] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        include: this.getPropertyInclude(),
        orderBy,
        skip,
        take: validatedLimit,
      }),
    ]);

    const transformedProperties = properties.map((p) =>
      this.transformProperty(p)
    );
    const result = { properties: transformedProperties, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async findLikedProperties(
    userId: string,
    options: PropertySearchOptions
  ): Promise<{
    properties: PropertyWithDetails[];
    totalCount: number;
  }> {
    const { page = 1, limit = 10 } = options;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    const cacheKey = this.generateCacheKey(
      "user",
      userId,
      "liked",
      JSON.stringify(options)
    );
    const cached = await this.getCache<{
      properties: PropertyWithDetails[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const [totalCount, likedProperties] = await Promise.all([
      this.prisma.propertyLike.count({ where: { userId } }),
      this.prisma.propertyLike.findMany({
        where: { userId },
        include: {
          property: { include: this.getPropertyInclude() },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: validatedLimit,
      }),
    ]);

    const properties = likedProperties.map((like) =>
      this.transformProperty(like.property, userId, {}, true)
    );
    const result = { properties, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async findAllVisitors(
    ownerId: string,
    options: PropertySearchOptions
  ): Promise<{
    visitors: any[];
    totalCount: number;
  }> {
    const { page = 1, limit = 10 } = options;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    // Get all properties owned by the lister
    const properties = await this.prisma.property.findMany({
      where: { ownerId },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return { visitors: [], totalCount: 0 };
    }

    const [totalCount, views] = await Promise.all([
      this.prisma.propertyView.count({
        where: {
          propertyId: { in: propertyIds },
          user: { role: RoleEnum.RENTER }, // Only count tenant views
        },
      }),
      this.prisma.propertyView.findMany({
        where: {
          propertyId: { in: propertyIds },
          user: { role: RoleEnum.RENTER }, // Only get tenant views
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              profilePic: true,
              role: true,
              status: true,
              address: true,
              city: true,
              state: true,
              country: true,
              createdAt: true,
              updatedAt: true,
              lastLogin: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
            },
          },
        },
        orderBy: { viewedAt: "desc" },
        skip,
        take: validatedLimit,
      }),
    ]);

    const visitors = views.map((view) => ({
      user: {
        ...view.user,
        phoneNumber: view.user.phoneNumber ?? null,
        profilePic: view.user.profilePic ?? null,
        address: view.user.address ?? null,
        city: view.user.city ?? null,
        state: view.user.state ?? null,
        country: view.user.country ?? null,
        lastLogin: view.user.lastLogin ?? null,
      },
      property: {
        id: view.property.id,
        title: view.property.title,
        address: view.property.address,
        city: view.property.city,
        state: view.property.state,
      },
      viewedAt: view.viewedAt,
    }));

    return { visitors, totalCount };
  }

  async findVisitors(
    propertyId: string,
    ownerId: string,
    options: PropertySearchOptions
  ): Promise<{
    visitors: any[];
    totalCount: number;
  }> {
    const { page = 1, limit = 10 } = options;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    // Verify property ownership
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });

    if (!property) {
      throw new Error("Property not found or access denied");
    }

    const [totalCount, views] = await Promise.all([
      this.prisma.propertyView.count({
        where: {
          propertyId,
          user: { role: RoleEnum.RENTER }, // Only count tenant views
        },
      }),
      this.prisma.propertyView.findMany({
        where: {
          propertyId,
          user: { role: RoleEnum.RENTER }, // Only get tenant views
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              profilePic: true,
              role: true,
              status: true,
              address: true,
              city: true,
              state: true,
              country: true,
              createdAt: true,
              updatedAt: true,
              lastLogin: true,
            },
          },
        },
        orderBy: { viewedAt: "desc" },
        skip,
        take: validatedLimit,
      }),
    ]);

    const visitors = views.map((view) => ({
      user: {
        ...view.user,
        phoneNumber: view.user.phoneNumber ?? null,
        profilePic: view.user.profilePic ?? null,
        address: view.user.address ?? null,
        city: view.user.city ?? null,
        state: view.user.state ?? null,
        country: view.user.country ?? null,
        lastLogin: view.user.lastLogin ?? null,
      },
      viewedAt: view.viewedAt,
    }));

    return { visitors, totalCount };
  }

  async update(
    id: string,
    ownerId: string,
    data: any,
    tx?: any
  ): Promise<Property> {
    const client = tx || this.prisma;

    const existingProperty = await client.property.findFirst({
      where: { id, ownerId },
    });

    if (!existingProperty) {
      throw new Error("Property not found or access denied");
    }

    const updatedProperty = await client.property.update({
      where: { id },
      data,
    });

    // Invalidate caches
    await Promise.all([
      this.deleteCachePattern(`property:${id}:*`),
      this.deleteCachePattern("properties:*"),
      this.deleteCachePattern(`user:${ownerId}:properties:*`),
    ]);

    return updatedProperty;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id, ownerId },
    });

    if (!property) {
      throw new Error("Property not found or access denied");
    }

    await this.prisma.property.delete({ where: { id } });

    // Invalidate caches
    await Promise.all([
      this.deleteCachePattern(`property:${id}:*`),
      this.deleteCachePattern("properties:*"),
      this.deleteCachePattern(`user:${ownerId}:properties:*`),
    ]);
  }

  async toggleLike(propertyId: string, userId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new Error("Property not found");
    }

    const existingLike = await this.prisma.propertyLike.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });

    let isLiked: boolean;
    if (existingLike) {
      await this.prisma.propertyLike.delete({
        where: { id: existingLike.id },
      });
      isLiked = false;
    } else {
      await this.prisma.propertyLike.create({
        data: { userId, propertyId },
      });
      isLiked = true;
    }

    // Invalidate relevant caches
    await Promise.all([
      this.deleteCachePattern(`property:${propertyId}:*`),
      this.deleteCachePattern(`user:${userId}:liked:*`),
    ]);

    return isLiked;
  }

  async recordView(propertyId: string, userId: string): Promise<void> {
    try {
      logger.info(
        `Recording view for property ${propertyId} by user ${userId}`
      );

      await this.prisma.propertyView.upsert({
        where: { userId_propertyId: { userId, propertyId } },
        update: { viewedAt: new Date() },
        create: { userId, propertyId, viewedAt: new Date() },
      });

      logger.info(`View recorded successfully for property ${propertyId}`);

      // Invalidate property cache to reflect updated view count
      await this.deleteCachePattern(`property:${propertyId}:*`);
    } catch (error) {
      logger.error(`Failed to record view for property ${propertyId}:`, error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalProperties: number;
    activeProperties: number;
    averagePrice: Decimal | number;
    totalViews: number;
    totalLikes: number;
  }> {
    const cacheKey = this.generateCacheKey("property", "stats");
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const [
      totalProperties,
      activeProperties,
      averagePrice,
      totalViews,
      totalLikes,
    ] = await Promise.all([
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.prisma.property.aggregate({
        _avg: { amount: true },
        where: { status: PropertyStatus.ACTIVE },
      }),
      this.prisma.propertyView.count(),
      this.prisma.propertyLike.count(),
    ]);

    const stats = {
      totalProperties,
      activeProperties,
      averagePrice: averagePrice._avg.amount || 0,
      totalViews,
      totalLikes,
    };

    await this.setCache(cacheKey, stats, 3600);
    return stats;
  }

  async findTrending(
    limit: number,
    userId?: string
  ): Promise<PropertyWithDetails[]> {
    const cacheKey = this.generateCacheKey(
      "trending",
      "properties",
      limit.toString(),
      userId || "anonymous"
    );
    const cached = await this.getCache<PropertyWithDetails[]>(cacheKey);
    if (cached) return cached;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingPropertyIds = await this.prisma.propertyView.groupBy({
      by: ["propertyId"],
      where: { viewedAt: { gte: sevenDaysAgo } },
      _count: { propertyId: true },
      orderBy: { _count: { propertyId: "desc" } },
      take: limit,
    });

    if (trendingPropertyIds.length === 0) {
      return [];
    }

    const propertyIds = trendingPropertyIds.map((item) => item.propertyId);

    const properties = await this.prisma.property.findMany({
      where: { id: { in: propertyIds }, status: PropertyStatus.ACTIVE },
      include: this.getPropertyInclude(userId),
    });

    const transformedProperties = propertyIds
      .map((id) => {
        const property = properties.find((p) => p.id === id);
        return property ? this.transformProperty(property, userId) : null;
      })
      .filter(Boolean) as PropertyWithDetails[];

    await this.setCache(cacheKey, transformedProperties, 3600);
    return transformedProperties;
  }

  async findFeatured(
    limit: number,
    userId?: string
  ): Promise<PropertyWithDetails[]> {
    const cacheKey = this.generateCacheKey(
      "featured",
      "properties",
      limit.toString(),
      userId || "anonymous"
    );
    const cached = await this.getCache<PropertyWithDetails[]>(cacheKey);
    if (cached) return cached;

    const properties = await this.prisma.property.findMany({
      where: { status: PropertyStatus.ACTIVE },
      include: this.getPropertyInclude(userId),
      orderBy: { likes: { _count: "desc" } },
      take: limit,
    });

    const transformedProperties = properties.map((p) =>
      this.transformProperty(p, userId)
    );
    await this.setCache(cacheKey, transformedProperties, 7200);
    return transformedProperties;
  }

  async findSimilar(
    propertyId: string,
    limit: number,
    userId?: string
  ): Promise<PropertyWithDetails[]> {
    const cacheKey = this.generateCacheKey(
      "similar",
      "properties",
      propertyId,
      limit.toString(),
      userId || "anonymous"
    );
    const cached = await this.getCache<PropertyWithDetails[]>(cacheKey);
    if (cached) return cached;

    const referenceProperty = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!referenceProperty) {
      throw new Error("Reference property not found");
    }

    const priceRange = referenceProperty.amount.mul(new Decimal(0.2));
    const minPrice = referenceProperty.amount.sub(priceRange);
    const maxPrice = referenceProperty.amount.add(priceRange);

    const properties = await this.prisma.property.findMany({
      where: {
        id: { not: propertyId },
        status: PropertyStatus.ACTIVE,
        OR: [
          {
            propertyType: referenceProperty.propertyType,
            city: referenceProperty.city,
            amount: { gte: minPrice, lte: maxPrice },
          },
          {
            propertyType: referenceProperty.propertyType,
            state: referenceProperty.state,
            amount: { gte: minPrice, lte: maxPrice },
          },
          {
            roomType: referenceProperty.roomType,
            city: referenceProperty.city,
            amount: { gte: minPrice, lte: maxPrice },
          },
        ],
      },
      include: this.getPropertyInclude(userId),
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const transformedProperties = properties.map((p) =>
      this.transformProperty(p, userId)
    );
    await this.setCache(cacheKey, transformedProperties, 3600);
    return transformedProperties;
  }

  private getPropertyInclude(userId?: string) {
    const baseInclude = {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          profilePic: true,
          isVerified: true,
          role: true,
          status: true,
          address: true,
          city: true,
          state: true,
          country: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      },
      units: {
        select: {
          id: true,
          title: true,
          description: true,
          amount: true,
          rentalPeriod: true,
          sqft: true,
          bedrooms: true,
          bathrooms: true,
          roomType: true,
          amenities: true,
          isFurnished: true,
          isForStudents: true,
          status: true,
          renterId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" } as const,
      },
      _count: {
        select: {
          likes: true,
          views: true,
          units: true,
        },
      },
    };

    if (userId) {
      return {
        ...baseInclude,
        likes: { where: { userId }, select: { id: true } },
        views: { where: { userId }, select: { id: true } },
      };
    }

    return baseInclude;
  }

  private transformProperty(
    property: any,
    userId?: string,
    filters?: PropertyFilters,
    isLiked = false
  ): PropertyWithDetails {
    const { _count, likes = [], views = [], units = [], ...rest } = property;

    // Calculate unit statistics
    const availableUnits = units.filter(
      (unit: any) => unit.status === "AVAILABLE"
    ).length;
    const rentedUnits = units.filter(
      (unit: any) => unit.status === "RENTED"
    ).length;
    const totalUnits = units.length;

    return {
      ...rest,
      units,
      likesCount: _count.likes,
      viewsCount: _count.views,
      unitsCount: _count.units || totalUnits,
      totalUnits,
      availableUnits,
      rentedUnits,
      isLiked: isLiked || likes.length > 0,
      isViewed: views.length > 0,
      ...(filters?.latitude &&
        filters?.longitude &&
        property.latitude &&
        property.longitude && {
          distance: this.calculateDistance(
            filters.latitude,
            filters.longitude,
            property.latitude,
            property.longitude
          ),
        }),
    };
  }

  private buildWhereClause(filters: PropertyFilters, search?: string): any {
    const where: any = { status: filters.status || PropertyStatus.ACTIVE };

    if (filters.minAmount || filters.maxAmount) {
      where.amount = {};
      if (filters.minAmount) where.amount.gte = filters.minAmount;
      if (filters.maxAmount) where.amount.lte = filters.maxAmount;
    }

    if (filters.bedrooms) where.bedrooms = filters.bedrooms;
    if (filters.bathrooms) where.bathrooms = filters.bathrooms;
    if (filters.propertyType) where.propertyType = filters.propertyType;
    if (filters.roomType) where.roomType = filters.roomType;
    if (filters.listingType) where.listingType = filters.listingType;
    if (filters.isFurnished !== undefined)
      where.isFurnished = filters.isFurnished;
    if (filters.isForStudents !== undefined)
      where.isForStudents = filters.isForStudents;
    if (filters.city)
      where.city = { contains: filters.city, mode: "insensitive" };
    if (filters.state)
      where.state = { contains: filters.state, mode: "insensitive" };
    if (filters.amenities && filters.amenities.length > 0) {
      where.amenities = { hasSome: filters.amenities };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  private buildOrderBy(sortBy: PropertySortByEnum, sortOrder: SortOrder): any {
    const orderBy: any = {};
    switch (sortBy) {
      case PropertySortByEnum.AMOUNT:
        orderBy.amount = sortOrder.toLowerCase();
        break;
      case PropertySortByEnum.BEDROOMS:
        orderBy.bedrooms = sortOrder.toLowerCase();
        break;
      case PropertySortByEnum.BATHROOMS:
        orderBy.bathrooms = sortOrder.toLowerCase();
        break;
      case PropertySortByEnum.SQFT:
        orderBy.sqft = sortOrder.toLowerCase();
        break;
      case PropertySortByEnum.UPDATED_AT:
        orderBy.updatedAt = sortOrder.toLowerCase();
        break;
      default:
        orderBy.createdAt = sortOrder.toLowerCase();
    }
    return orderBy;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

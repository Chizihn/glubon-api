import {
  PrismaClient,
  Property,
  PropertyStatus,
  RoleEnum,
  User,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { IBaseResponse } from "../types";
import { logger } from "../utils";
import {
  CreatePropertyInput,
  PropertyFilters,
  PropertySearchOptions,
  PropertyWithDetails,
  UpdatePropertyInput,
} from "../types/services/properties";
import { PropertyRepository } from "../repository/properties";

export class PropertyService extends BaseService {
  private repository: PropertyRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.repository = new PropertyRepository(prisma, redis);
  }

  async createProperty(
    ownerId: string,
    input: CreatePropertyInput
  ): Promise<IBaseResponse<Property>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });

      if (!user || user.role !== RoleEnum.PROPERTY_OWNER) {
        return this.failure("Only property owners can create properties");
      }

      const coordinates = await this.getCoordinatesFromAddress(
        `${input.address}, ${input.city}, ${input.state}, Nigeria`
      );

      const property = await this.repository.create({
        ...input,
        description: input.description ?? null,
        sqft: input.sqft ?? null,
        visitingDays: input.visitingDays ?? [],
        visitingTimeStart: input.visitingTimeStart ?? null,
        visitingTimeEnd: input.visitingTimeEnd ?? null,
        ownerId,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        country: "Nigeria",
        status: PropertyStatus.DRAFT,
      });

      return this.success(property, "Property created successfully");
    } catch (error) {
      return this.handleError(error, "createProperty");
    }
  }

  async getProperties(
    filters: PropertyFilters = {},
    options: PropertySearchOptions = {},
    userId?: string
  ): Promise<
    IBaseResponse<{
      properties: PropertyWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { properties, totalCount } = await this.repository.findMany(
        filters,
        options,
        userId
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { properties, totalCount, pagination },
        "Properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getProperties");
    }
  }

  async getPropertyById(
    id: string,
    user?: User
  ): Promise<IBaseResponse<PropertyWithDetails>> {
    try {
      logger.info(
        `Service: Getting property ${id} for user ${
          user?.id || "anonymous"
        } with role ${user?.role || "none"}`
      );

      const property = await this.repository.findById(id, user);
      if (!property) {
        logger.info(`Service: Property ${id} not found`);
        return this.failure("Property not found");
      }

      logger.info(`Service: Property ${id} retrieved successfully`);
      return this.success(property, "Property retrieved successfully");
    } catch (error) {
      logger.error(`Service: Error getting property ${id}:`, error);
      return this.handleError(error, "getPropertyById");
    }
  }

  async getMyProperties(
    ownerId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{
      properties: PropertyWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { properties, totalCount } = await this.repository.findByOwner(
        ownerId,
        options
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { properties, totalCount, pagination },
        "Properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getMyProperties");
    }
  }

  async togglePropertyLike(
    propertyId: string,
    userId: string
  ): Promise<IBaseResponse<{ isLiked: boolean }>> {
    try {
      const isLiked = await this.repository.toggleLike(propertyId, userId);
      return this.success(
        { isLiked },
        isLiked
          ? "Property liked successfully"
          : "Property unliked successfully"
      );
    } catch (error) {
      return this.handleError(error, "togglePropertyLike");
    }
  }

  async getLikedProperties(
    userId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{
      properties: PropertyWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { properties, totalCount } =
        await this.repository.findLikedProperties(userId, options);
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { properties, totalCount, pagination },
        "Liked properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getLikedProperties");
    }
  }

  async getPropertyVisitors(
    propertyId: string,
    ownerId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{ visitors: any[]; totalCount: number; pagination: any }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { visitors, totalCount } = await this.repository.findVisitors(
        propertyId,
        ownerId,
        options
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { visitors, totalCount, pagination },
        "Property visitors retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getPropertyVisitors");
    }
  }

  async updateProperty(
    id: string,
    ownerId: string,
    input: UpdatePropertyInput
  ): Promise<IBaseResponse<Property>> {
    try {
      let coordinates;
      if (input.address || input.city || input.state) {
        const existingProperty = await this.prisma.property.findFirst({
          where: { id, ownerId },
        });
        if (!existingProperty) {
          return this.failure("Property not found or access denied");
        }
        const address = `${input.address || existingProperty.address}, ${
          input.city || existingProperty.city
        }, ${input.state || existingProperty.state}, Nigeria`;
        coordinates = await this.getCoordinatesFromAddress(address);
      }

      const updateData: any = {
        ...input,
        description: input.description ?? null,
        sqft: input.sqft ?? null,
        visitingTimeStart: input.visitingTimeStart ?? null,
        visitingTimeEnd: input.visitingTimeEnd ?? null,
      };

      if (coordinates) {
        updateData.latitude = coordinates.latitude ?? null;
        updateData.longitude = coordinates.longitude ?? null;
      }

      const updatedProperty = await this.repository.update(
        id,
        ownerId,
        updateData
      );
      return this.success(updatedProperty, "Property updated successfully");
    } catch (error) {
      return this.handleError(error, "updateProperty");
    }
  }

  async deleteProperty(
    id: string,
    ownerId: string
  ): Promise<IBaseResponse<null>> {
    try {
      await this.repository.delete(id, ownerId);
      return this.success(null, "Property deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteProperty");
    }
  }

  async getPropertyStats(): Promise<
    IBaseResponse<{
      totalProperties: number;
      activeProperties: number;
      averagePrice: number;
      totalViews: number;
      totalLikes: number;
    }>
  > {
    try {
      const stats = await this.repository.getStats();
      return this.success(stats, "Property stats retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getPropertyStats");
    }
  }

  async getTrendingProperties(
    limit: number = 10,
    userId?: string
  ): Promise<IBaseResponse<PropertyWithDetails[]>> {
    try {
      const properties = await this.repository.findTrending(limit, userId);
      return this.success(
        properties,
        "Trending properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getTrendingProperties");
    }
  }

  async getFeaturedProperties(
    limit: number = 10,
    userId?: string
  ): Promise<IBaseResponse<PropertyWithDetails[]>> {
    try {
      const properties = await this.repository.findFeatured(limit, userId);
      return this.success(
        properties,
        "Featured properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getFeaturedProperties");
    }
  }

  async getSimilarProperties(
    propertyId: string,
    limit: number = 5,
    userId?: string
  ): Promise<IBaseResponse<PropertyWithDetails[]>> {
    try {
      const properties = await this.repository.findSimilar(
        propertyId,
        limit,
        userId
      );
      return this.success(
        properties,
        "Similar properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getSimilarProperties");
    }
  }

  private async getCoordinatesFromAddress(
    address: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // TODO: Implement actual geocoding service (Google Maps, MapBox, etc.)
      logger.info(`Geocoding address: ${address}`);
      return null; // Placeholder for geocoding logic
    } catch (error) {
      logger.warn("Failed to geocode address:", error);
      return null;
    }
  }
}

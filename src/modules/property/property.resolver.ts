import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
  Args,
  Int,
  Float,
} from "type-graphql";
import {
  GetPropertiesArgs,
  PaginatedPropertiesResponse,
  PaginatedVisitorsResponse,
  Property,
  PropertyStatsResponse,
  GetMyPropertiesArgs, // Added missing import
  // Property,
} from "./property.types";
import { PropertyFilters, UpdatePropertyInput } from "./property.inputs";
import { PropertyStatus, RoleEnum } from "@prisma/client";
import { CreatePropertyInput } from "./property.inputs";
import { PropertyService } from "../../services/property";
import { prisma, redis } from "../../config";
import { Context } from "../../types";
import { AuthMiddleware, RequireRole } from "../../middleware";
import { logger } from "../../utils";
import {
  PropertyFilters as ServicePropertyFilters,
  PropertySearchOptions,
  UpdatePropertyInput as UpdatePropertyInputType,
} from "../../types/services/properties";
import { FileUpload, GraphQLUpload } from "graphql-upload-ts";

@Resolver()
export class PropertyResolver {
  private propertyService: PropertyService;

  constructor() {
    this.propertyService = new PropertyService(prisma, redis);
  }

  private transformPropertyToResponse(property: any): Property {
    return {
      ...property,
    };
  }

  @Query(() => PaginatedPropertiesResponse)
  @UseMiddleware(AuthMiddleware)
  async getProperties(
    @Args() args: GetPropertiesArgs,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const filters: ServicePropertyFilters = {
      minAmount: args.filter?.minAmount,
      maxAmount: args.filter?.maxAmount,
      bedrooms: args.filter?.bedrooms,
      bathrooms: args.filter?.bathrooms,
      propertyType: args.filter?.propertyType,
      roomType: args.filter?.roomType,
      listingType: args.filter?.listingType,
      isFurnished: args.filter?.isFurnished,
      isForStudents: args.filter?.isForStudents,
      city: args.filter?.city,
      state: args.filter?.state,
      amenities: args.filter?.amenities,
      latitude: args.filter?.latitude,
      longitude: args.filter?.longitude,
      radiusKm: args.filter?.radiusKm,
      status: args.filter?.status,
    };

    const options: PropertySearchOptions = {
      page: args.page,
      limit: args.limit,
      sortBy: args.sortBy as any,
      sortOrder: args.sortOrder as any,
      search: args.filter?.search,
    };

    const result = await this.propertyService.getProperties(
      filters,
      options,
      ctx.user?.id
    );
    if (!result.success) throw new Error(result.message);

    const data = result.data!;
    return {
      properties: data.properties.map(
        this.transformPropertyToResponse.bind(this)
      ),
      totalCount: data.totalCount,
      pagination: data.pagination,
    };
  }

  @Query(() => Property)
  @UseMiddleware(AuthMiddleware)
  async getProperty(
    @Arg("id") id: string,
    @Ctx() ctx: Context
  ): Promise<Property> {
    logger.info(
      `Resolver: Getting property ${id} for user ${
        ctx.user?.id || "anonymous"
      } with role ${ctx.user?.role || "none"}`
    );

    const result = await this.propertyService.getPropertyById(id, ctx.user!);

    if (!result.success) {
      logger.error(`Resolver: Failed to get property ${id}: ${result.message}`);
      throw new Error(result.message);
    }

    logger.info(`Resolver: Successfully retrieved property ${id}`);
    return this.transformPropertyToResponse(result.data!);
  }

  @Query(() => PaginatedPropertiesResponse)
  @UseMiddleware(AuthMiddleware)
  async getPropertiesNearby(
    @Arg("latitude") latitude: number,
    @Arg("longitude") longitude: number,
    @Arg("radius", () => Float, { defaultValue: 10 }) radius: number,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const filters: ServicePropertyFilters = {
      latitude,
      longitude,
      radiusKm: radius,
    };
    const options: PropertySearchOptions = { page, limit };

    const result = await this.propertyService.getProperties(
      filters,
      options,
      ctx.user?.id
    );
    if (!result.success) throw new Error(result.message);

    const data = result.data!;
    return {
      properties: data.properties.map(
        this.transformPropertyToResponse.bind(this)
      ),
      totalCount: data.totalCount,
      pagination: data.pagination,
    };
  }

  @Query(() => PaginatedPropertiesResponse)
  @UseMiddleware(AuthMiddleware)
  async getMyProperties(
    @Args() args: GetMyPropertiesArgs,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const options: PropertySearchOptions = {
      page: args.page,
      limit: args.limit,
      filters: args.filter ? {
        status: args.filter.status,
        propertyType: args.filter.propertyType,
        listingType: args.filter.listingType,
        minAmount: args.filter.minAmount,
        maxAmount: args.filter.maxAmount,
        city: args.filter.city,
        state: args.filter.state,
        createdAfter: args.filter.createdAfter,
        createdBefore: args.filter.createdBefore,
        updatedAfter: args.filter.updatedAfter,
      } : undefined,
    };

    const result = await this.propertyService.getMyProperties(
      ctx.user!.id,
      options
    );
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch properties');
    }

    const { properties, totalCount, pagination } = result.data!;
    
    // Transform each property using the existing transform method
    const transformedProperties = properties.map(property => 
      this.transformPropertyToResponse(property)
    );

    return {
      properties: transformedProperties,
      totalCount,
      pagination: {
        ...pagination,
        hasNextPage: pagination.page < pagination.totalPages,
        hasPreviousPage: pagination.page > 1,
      },
    };
  }

  @Query(() => PaginatedPropertiesResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async getLikedProperties(
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const options: PropertySearchOptions = { page, limit };

    const result = await this.propertyService.getLikedProperties(
      ctx.user!.id,
      options
    );
    if (!result.success) throw new Error(result.message);

    const data = result.data!;
    return {
      properties: data.properties.map(
        this.transformPropertyToResponse.bind(this)
      ),
      totalCount: data.totalCount,
      pagination: data.pagination,
    };
  }

  @Query(() => PaginatedVisitorsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getPropertiesVisitors(
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedVisitorsResponse> {
    const options: PropertySearchOptions = { page, limit };

    const result = await this.propertyService.getPropertiesVisitors(
      ctx.user!.id,
      options
    );
    if (!result.success) throw new Error(result.message);

    return result.data!;
  }

  @Query(() => PaginatedVisitorsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getPropertyVisitors(
    @Arg("propertyId") propertyId: string,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedVisitorsResponse> {
    const options: PropertySearchOptions = { page, limit };

    const result = await this.propertyService.getPropertyVisitors(
      propertyId,
      ctx.user!.id,
      options
    );
    if (!result.success) throw new Error(result.message);

    return result.data!;
  }

  @Mutation(() => Property)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async createProperty(
    @Arg("input") input: CreatePropertyInput,
    @Arg("files", () => [GraphQLUpload], { nullable: true })
    files: FileUpload[],
    @Ctx() ctx: Context
  ): Promise<Property> {
    const result = await this.propertyService.createProperty(
      ctx.user!.id,
      input,
      files
    );

    if (!result.success) throw new Error(result.message);

    return this.transformPropertyToResponse(result.data!);
  }

  @Mutation(() => Property)
  @UseMiddleware(AuthMiddleware)
  async updateProperty(
    @Arg("id") id: string,
    @Arg("input") input: UpdatePropertyInput,
    @Arg("files", () => [GraphQLUpload], { nullable: true })
    files: FileUpload[],
    @Ctx() ctx: Context
  ): Promise<Property> {
    const result = await this.propertyService.updateProperty(
      id,
      ctx.user!.id,
      input,
      files
    );
    if (!result.success) throw new Error(result.message);

    return this.transformPropertyToResponse(result.data!);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async deleteProperty(
    @Arg("id") id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.propertyService.deleteProperty(id, ctx.user!.id);
    if (!result.success) throw new Error(result.message);
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async togglePropertyLike(
    @Arg("propertyId") propertyId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.propertyService.togglePropertyLike(
      propertyId,
      ctx.user!.id
    );
    if (!result.success) throw new Error(result.message);
    return result.data!.isLiked;
  }

  @Query(() => PaginatedPropertiesResponse)
  @UseMiddleware(AuthMiddleware)
  async searchProperties(
    @Arg("query") query: string,
    @Arg("filters", () => PropertyFilters, { nullable: true })
    filters: PropertyFilters = {},
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const serviceFilters: ServicePropertyFilters = {
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
      bedrooms: filters.bedrooms ?? undefined,
      bathrooms: filters.bathrooms ?? undefined,
      propertyType: filters.propertyType,
      roomType: filters.roomType,
      isFurnished: filters.isFurnished ?? undefined,
      isForStudents: filters.isForStudents ?? undefined,
      city: filters.city,
      state: filters.state,
      amenities: filters.amenities,
      latitude: filters.latitude,
      longitude: filters.longitude,
      radiusKm: filters.radiusKm,
      status: filters.status,
    };

    const options: PropertySearchOptions = { page, limit, search: query };

    const result = await this.propertyService.getProperties(
      serviceFilters,
      options,
      ctx.user?.id
    );
    if (!result.success) throw new Error(result.message);

    const data = result.data!;
    return {
      properties: data.properties.map(
        this.transformPropertyToResponse.bind(this)
      ),
      totalCount: data.totalCount,
      pagination: data.pagination,
    };
  }

  @Query(() => PropertyStatsResponse)
  @UseMiddleware(AuthMiddleware)
  async getPropertyStats(): Promise<PropertyStatsResponse> {
    const result = await this.propertyService.getPropertyStats();
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Query(() => [Property])
  @UseMiddleware(AuthMiddleware)
  async getTrendingProperties(
    @Arg("limit", () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<Property[]> {
    const result = await this.propertyService.getTrendingProperties(
      limit,
      ctx.user?.id
    );
    if (!result.success) throw new Error(result.message);
    return result.data!.map(this.transformPropertyToResponse.bind(this));
  }

  @Query(() => [Property])
  @UseMiddleware(AuthMiddleware)
  async getFeaturedProperties(
    @Arg("limit", () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<Property[]> {
    const result = await this.propertyService.getFeaturedProperties(
      limit,
      ctx.user?.id
    );
    if (!result.success) throw new Error(result.message);
    return result.data!.map(this.transformPropertyToResponse.bind(this));
  }

  @Query(() => [Property])
  @UseMiddleware(AuthMiddleware)
  async getSimilarProperties(
    @Arg("propertyId") propertyId: string,
    @Arg("limit", () => Int, { defaultValue: 5 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<Property[]> {
    const result = await this.propertyService.getSimilarProperties(
      propertyId,
      limit,
      ctx.user?.id
    );
    if (!result.success) throw new Error(result.message);
    return result.data!.map(this.transformPropertyToResponse.bind(this));
  }
}

//src/modules/property/property.resolver.ts
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
  GetMyPropertiesArgs,
  MapSearchResponse,
} from "./property.types";
import { PropertyFilters, UpdatePropertyInput } from "./property.inputs";
import { MapSearchInput } from "./property.map.inputs";
import { PropertyStatus, RoleEnum } from "@prisma/client";
import { CreatePropertyInput } from "./property.inputs";
import {
  SimpleCreatePropertyInput,
  SimpleUpdatePropertyInput,
} from "./property.simple.inputs";
// import { getContainer } from "../../services";
import { PropertyService } from "../../services/property";
import { Context } from "../../types";
import { logger } from "../../utils";
import {
  PropertySortByEnum, 
  SortOrder, 
  PropertyFilters as ServicePropertyFilters, 
  PropertySearchOptions, 
  UpdatePropertyInput as UpdatePropertyInputType,
} from "../../types/services/properties";
import { FileUpload, GraphQLUpload } from "graphql-upload-ts";
import { 
  createPropertySchema, 
  updatePropertySchema, 
  propertyFiltersSchema,
  propertySearchSchema 
} from "../../validators/property";
import { AuthMiddleware, RequireRole,  } from "../../middleware";
import { graphqlMapSearchRateLimiter } from "../../middleware/rateLimiter";

import { Service } from "typedi";

@Service()
@Resolver()
export class PropertyResolver {
  constructor(
    private propertyService: PropertyService
  ) {}

  private transformPropertyToResponse(property: any): Property {
    return {
      ...property,
    };
  }

  @Query(() => MapSearchResponse)
  @UseMiddleware(AuthMiddleware, graphqlMapSearchRateLimiter.createMiddleware())
  async searchPropertiesOnMap(
    @Arg("input") input: MapSearchInput,
    @Ctx() ctx: Context,
    @Arg("take", () => Int, { nullable: true }) take?: number,
    @Arg("skip", () => Int, { nullable: true }) skip?: number
  ): Promise<MapSearchResponse> {
    try {
      const filters: {
        propertyTypes?: string[];
        amenities?: string[];
        minPrice?: number;
        maxPrice?: number;
        roomTypes?: string[];
      } = {};

      if (input.propertyTypes?.length)
        filters.propertyTypes = input.propertyTypes;
      if (input.amenities?.length) filters.amenities = input.amenities;
      if (input.minPrice !== undefined) filters.minPrice = input.minPrice;
      if (input.maxPrice !== undefined) filters.maxPrice = input.maxPrice;
      if (input.roomTypes?.length) filters.roomTypes = input.roomTypes;

      const options: { take?: number; skip?: number } = {};
      if (take !== undefined) options.take = take;
      if (skip !== undefined) options.skip = skip;

      const result = await this.propertyService.searchPropertiesOnMap(
        input.latitude,
        input.longitude,
        input.radiusInKm || 10,
        filters,
        options
      );

      if (!result.success) {
        throw new Error(result.message || "Failed to search properties on map");
      }

      return result;
    } catch (error) {
      logger.error("Error in searchPropertiesOnMap:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to search properties on map",
      };
    }
  }

  @Query(() => PaginatedPropertiesResponse)
  @UseMiddleware(AuthMiddleware,)
  async getProperties(
    @Args() args: GetPropertiesArgs,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    // Validate filters
    const validatedFilters = propertyFiltersSchema.parse(args.filter || {});
    
    // Validate search options
    const searchOptions = propertySearchSchema.parse({
      page: args.page,
      limit: args.limit,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      filters: {
        status: args.filter?.status,
        propertyType: args.filter?.propertyType,
        listingType: args.filter?.listingType,
        minAmount: args.filter?.minAmount,
        maxAmount: args.filter?.maxAmount,
        city: args.filter?.city,
        state: args.filter?.state,
      },
      search: args.filter?.search,
    });

    const filters = {
      ...validatedFilters,
      search: searchOptions.search,
    } as ServicePropertyFilters;

    const options: PropertySearchOptions = {
      page: searchOptions.page,
      limit: searchOptions.limit,
sortBy: searchOptions.sortBy as PropertySortByEnum | undefined,
      sortOrder: searchOptions.sortOrder as SortOrder | undefined,
      search: searchOptions.search,
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
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getMyProperties(
    @Args() args: GetMyPropertiesArgs,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const options: PropertySearchOptions = {
      page: args.page,
      limit: args.limit,
      filters: args.filter
        ? {
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
          }
        : undefined,
    };

    const result = await this.propertyService.getMyProperties(
      ctx.user!.id,
      options
    );

    if (!result.success) {
      throw new Error(result.message || "Failed to fetch properties");
    }

    const { properties, totalCount, pagination } = result.data!;

    // Transform each property using the existing transform method
    const transformedProperties = properties.map((property) =>
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
    @Arg("input") input: SimpleCreatePropertyInput,
    @Arg("files", () => [GraphQLUpload], { nullable: true })
    files: FileUpload[],
    @Ctx() ctx: Context
  ): Promise<Property> {
    try {
      // Validate input against schema
      const validatedInput = createPropertySchema.parse({
        ...input,
        amount: input.amount ? Number(input.amount) : undefined,
        sqft: input.sqft ? Number(input.sqft) : undefined,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
      });

      // Transform simple input to internal format
      const internalInput: any = {
        ...validatedInput,
        amount: input.amount, // Keep as Decimal for database
        isStandalone: !input.numberOfUnits || input.numberOfUnits === 1,
      };

      if (input.numberOfUnits && input.numberOfUnits > 1) {
        internalInput.bulkUnits = {
          unitTitle: "Unit",
          unitCount: input.numberOfUnits,
          unitDetails: {
            amount: input.amount,
            rentalPeriod: input.rentalPeriod,
            sqft: input.sqft,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            roomType: input.roomType,
            amenities: input.amenities,
            isFurnished: input.isFurnished,
            isForStudents: input.isForStudents,
          },
        };
      }

      const result = await this.propertyService.createProperty(
        ctx.user!.id,
        internalInput,
        ctx.user!.activeRole as RoleEnum,
        files,
      );

      if (!result.success) {
        logger.error('Property creation failed', { 
          error: result.message,
          userId: ctx.user!.id,
          input: { ...input, password: undefined } // Don't log passwords
        });
        throw new Error(result.message);
      }

      logger.info('Property created successfully', { 
        propertyId: result.data?.id,
        userId: ctx.user!.id 
      });

      return this.transformPropertyToResponse(result.data!);
    } catch (error) {
      logger.error('Error in createProperty', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: ctx.user!.id
      });
      throw error;
    }
  }

  @Mutation(() => Property)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async updateProperty(
    @Arg("id") id: string,
    @Arg("input") input: SimpleUpdatePropertyInput,
    @Arg("files", () => [GraphQLUpload], { nullable: true })
    files: FileUpload[],
    @Ctx() ctx: Context
  ): Promise<Property> {
    try {
      // Prepare update data with proper type conversion
      const updateData: any = { ...input };

      // Convert Decimal to number for validation if present
      if (input.amount !== undefined && input.amount !== null) {
        updateData.amount = Number(input.amount);
      }
      if (input.sqft !== undefined && input.sqft !== null) {
        updateData.sqft = Number(input.sqft);
      }

      // Validate input against schema (partial validation for updates)
      const validatedInput = updatePropertySchema.parse(updateData);

      const result = await this.propertyService.updateProperty(
        id,
        ctx.user!.id,
        {
          ...validatedInput,
          amount: input.amount, // Keep as Decimal for database
          sqft: input.sqft,
        } as UpdatePropertyInputType,
        files
      );

      if (!result.success) {
        logger.error('Property update failed', { 
          error: result.message,
          propertyId: id,
          userId: ctx.user!.id
        });
        throw new Error(result.message);
      }

      logger.info('Property updated successfully', { 
        propertyId: id,
        userId: ctx.user!.id 
      });

      return this.transformPropertyToResponse(result.data!);
    } catch (error) {
      logger.error('Error in updateProperty', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        propertyId: id,
        userId: ctx.user!.id
      });
      throw error;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
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
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getPropertyStats(): Promise<PropertyStatsResponse> {
    const result = await this.propertyService.getPropertyStats();
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Query(() => [Property])
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER, RoleEnum.ADMIN))
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

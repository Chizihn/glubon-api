import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
  Args,
  ID,
} from "type-graphql";
import {
  Unit,
  CreateUnitInput,
  UpdateUnitInput,
  PaginatedUnitsResponse,
  UnitCounts,
  GetUnitsArgs,
} from "./unit.types";
import { UnitStatus, RoleEnum } from "@prisma/client";
// import { getContainer } from "../../services";
import { UnitService } from "../../services/unit";
import { Context } from "../../types";
import { AuthMiddleware, RequireRole } from "../../middleware";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient } from "@prisma/client";

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN } from "../../types/di-tokens";

@Service()
@Resolver()
export class UnitResolver {
  constructor(
    private unitService: UnitService,
    @Inject(PRISMA_TOKEN) private prisma: PrismaClient
  ) {}

  // PUBLIC: Property owners can view their units
  @Query(() => PaginatedUnitsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getMyPropertyUnits(
    @Args() args: GetUnitsArgs,
    @Ctx() ctx: Context
  ): Promise<PaginatedUnitsResponse> {
    const options: any = {
      page: args.page,
      limit: args.limit,
    };

    if (args.status) {
      options.status = args.status;
    }

    const result = await this.unitService.getPropertyUnits(
      args.propertyId,
      ctx.user!.id,
      options
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      units: result.data!.units as any,
      totalCount: result.data!.totalCount,
      pagination: result.data!.pagination,
    };
  }

  // PUBLIC: Property owners can get available units for their property
  @Query(() => [Unit])
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getMyAvailableUnits(
    @Arg("propertyId", () => ID) propertyId: string,
    @Ctx() ctx: Context
  ): Promise<Unit[]> {
    // Verify property ownership first
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: ctx.user!.id },
    });

    if (!property) {
      throw new Error("Property not found or access denied");
    }

    const result = await this.unitService.getAvailableUnits(propertyId);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data! as any;
  }

  // PUBLIC: Property owners can get unit counts for their property
  @Query(() => UnitCounts)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getMyUnitCounts(
    @Arg("propertyId", () => ID) propertyId: string,
    @Ctx() ctx: Context
  ): Promise<UnitCounts> {
    // Verify property ownership first
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: ctx.user!.id },
    });

    if (!property) {
      throw new Error("Property not found or access denied");
    }

    const result = await this.unitService.getUnitCounts(propertyId);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data!;
  }

  // PUBLIC: Property owners can create units for their property
  @Mutation(() => Unit)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async createUnit(
    @Arg("propertyId", () => ID) propertyId: string,
    @Arg("input") input: CreateUnitInput,
    @Ctx() ctx: Context
  ): Promise<Unit> {
    const result = await this.unitService.createUnit(propertyId, ctx.user!.id, {
      propertyId,
      title: input.title || null,
      description: input.description || null,
      amount: new Decimal(input.amount),
      rentalPeriod: input.rentalPeriod,
      sqft: input.sqft || null,
      bedrooms: input.bedrooms || null,
      bathrooms: input.bathrooms || null,
      roomType: input.roomType,
      amenities: input.amenities,
      isFurnished: input.isFurnished,
      isForStudents: input.isForStudents,
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data! as any;
  }

  // PUBLIC: Property owners can update their units
  @Mutation(() => Unit)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async updateMyUnit(
    @Arg("id", () => ID) id: string,
    @Arg("propertyId", () => ID) propertyId: string,
    @Arg("input") input: UpdateUnitInput,
    @Ctx() ctx: Context
  ): Promise<Unit> {
    const updateData: any = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.amount !== undefined)
      updateData.amount = new Decimal(input.amount);
    if (input.rentalPeriod !== undefined)
      updateData.rentalPeriod = input.rentalPeriod;
    if (input.sqft !== undefined) updateData.sqft = input.sqft;
    if (input.bedrooms !== undefined) updateData.bedrooms = input.bedrooms;
    if (input.bathrooms !== undefined) updateData.bathrooms = input.bathrooms;
    if (input.roomType !== undefined) updateData.roomType = input.roomType;
    if (input.amenities !== undefined) updateData.amenities = input.amenities;
    if (input.isFurnished !== undefined)
      updateData.isFurnished = input.isFurnished;
    if (input.isForStudents !== undefined)
      updateData.isForStudents = input.isForStudents;

    const result = await this.unitService.updateUnit(
      id,
      propertyId,
      ctx.user!.id,
      updateData
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data! as any;
  }

  // PUBLIC: Property owners can delete their units (if not rented)
  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async deleteMyUnit(
    @Arg("id", () => ID) id: string,
    @Arg("propertyId", () => ID) propertyId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.unitService.deleteUnit(
      id,
      propertyId,
      ctx.user!.id
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return true;
  }

  // INTERNAL: Only admins can update unit status (rented, available, etc.)
  @Mutation(() => Unit)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
  async updateUnitStatus(
    @Arg("id", () => ID) id: string,
    @Arg("status", () => UnitStatus) status: UnitStatus,
    @Arg("renterId", () => ID, { nullable: true }) renterId?: string
  ): Promise<Unit> {
    const result = await this.unitService.updateUnitStatus(
      id,
      status,
      renterId
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data! as any;
  }

  // INTERNAL: Only admins can get any unit by ID
  @Query(() => Unit)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
  async getUnitById(@Arg("id", () => ID) id: string): Promise<Unit> {
    const result = await this.unitService.getUnit(id);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data! as any;
  }
}

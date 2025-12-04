import { PrismaClient, Unit, UnitStatus } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { IBaseResponse } from "../types";
// import { Container } from "../container";
import {
  CreateUnitInput,
  UpdateUnitInput,
  UnitWithDetails,
} from "../repository/units";

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";
import { PropertyRepository } from "../repository/properties";
import { UnitRepository } from "../repository/units";

@Service()
export class UnitService extends BaseService {
  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis,
    private repository: UnitRepository,
    private propertyRepository: PropertyRepository
  ) {
    super(prisma, redis);
  }

  async createUnit(
    propertyId: string,
    ownerId: string,
    input: CreateUnitInput
  ): Promise<IBaseResponse<Unit>> {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      const unit = await this.repository.create({
        ...input,
        propertyId,
      });

      return this.success(unit, "Unit created successfully");
    } catch (error) {
      return this.handleError(error, "createUnit");
    }
  }

  async getUnit(id: string): Promise<IBaseResponse<UnitWithDetails>> {
    try {
      const unit = await this.repository.findById(id);
      if (!unit) {
        return this.failure("Unit not found");
      }

      return this.success(unit, "Unit retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getUnit");
    }
  }

  async getPropertyUnits(
    propertyId: string,
    ownerId: string,
    options: {
      status?: UnitStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<
    IBaseResponse<{
      units: UnitWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      const { page = 1, limit = 20 } = options;
      const { units, totalCount } = await this.repository.findByProperty(
        propertyId,
        options
      );

      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { units, totalCount, pagination },
        "Units retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getPropertyUnits");
    }
  }

  async updateUnit(
    id: string,
    propertyId: string,
    ownerId: string,
    input: UpdateUnitInput
  ): Promise<IBaseResponse<Unit>> {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      const updatedUnit = await this.repository.update(id, propertyId, input);
      return this.success(updatedUnit, "Unit updated successfully");
    } catch (error) {
      return this.handleError(error, "updateUnit");
    }
  }

  async deleteUnit(
    id: string,
    propertyId: string,
    ownerId: string
  ): Promise<IBaseResponse<null>> {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      await this.repository.delete(id, propertyId);
      return this.success(null, "Unit deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteUnit");
    }
  }

  async updateUnitStatus(
    id: string,
    status: UnitStatus,
    renterId?: string
  ): Promise<IBaseResponse<Unit>> {
    try {
      const updatedUnit = await this.repository.updateStatus(
        id,
        status,
        renterId
      );
      return this.success(updatedUnit, "Unit status updated successfully");
    } catch (error) {
      return this.handleError(error, "updateUnitStatus");
    }
  }

  async getAvailableUnits(propertyId: string): Promise<IBaseResponse<Unit[]>> {
    try {
      const units = await this.repository.getAvailableUnits(propertyId);
      return this.success(units, "Available units retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getAvailableUnits");
    }
  }

  async getUnitCounts(propertyId: string): Promise<
    IBaseResponse<{
      total: number;
      available: number;
      rented: number;
      pending: number;
      inactive: number;
    }>
  > {
    try {
      const counts = await this.repository.getUnitCounts(propertyId);
      return this.success(counts, "Unit counts retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getUnitCounts");
    }
  }

  // Bulk operations for property creation/update
  async createUnitsForProperty(
    propertyId: string,
    ownerId: string,
    units: Omit<CreateUnitInput, "propertyId">[]
  ): Promise<IBaseResponse<Unit[]>> {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      const createdUnits: Unit[] = [];

      // Use transaction for bulk creation
      await this.prisma.$transaction(async (tx) => {
        for (const unitInput of units) {
          const unit = await this.repository.create(
            {
              ...unitInput,
              propertyId,
            },
            tx
          );
          createdUnits.push(unit);
        }
      });

      return this.success(createdUnits, "Units created successfully");
    } catch (error) {
      return this.handleError(error, "createUnitsForProperty");
    }
  }

  async updateUnitsForProperty(
    propertyId: string,
    ownerId: string,
    updates: { id: string; data: UpdateUnitInput }[]
  ): Promise<IBaseResponse<Unit[]>> {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      const updatedUnits: Unit[] = [];

      // Use transaction for bulk updates
      await this.prisma.$transaction(async (tx) => {
        for (const update of updates) {
          const unit = await this.repository.update(
            update.id,
            propertyId,
            update.data,
            tx
          );
          updatedUnits.push(unit);
        }
      });

      return this.success(updatedUnits, "Units updated successfully");
    } catch (error) {
      return this.handleError(error, "updateUnitsForProperty");
    }
  }
}

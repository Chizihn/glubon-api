import {
  PrismaClient,
  Unit,
  UnitStatus,
  RoomType,
  RentalPeriod,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";
import { Decimal } from "@prisma/client/runtime/library";

export interface CreateUnitInput {
  propertyId: string;
  title?: string | null;
  description?: string | null;
  amount: Decimal;
  rentalPeriod: RentalPeriod;
  sqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  roomType: RoomType;
  amenities?: string[];
  isFurnished?: boolean;
  isForStudents?: boolean;
}

export interface UpdateUnitInput {
  title?: string;
  description?: string;
  amount?: Decimal;
  rentalPeriod?: RentalPeriod;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  roomType?: RoomType;
  amenities?: string[];
  isFurnished?: boolean;
  isForStudents?: boolean;
  status?: UnitStatus;
}

export interface UnitWithDetails extends Unit {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    state: string;
    ownerId: string;
  };
  renter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string | null;
  } | null;
}

export class UnitRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async create(data: CreateUnitInput, tx?: any): Promise<Unit> {
    const client = tx || this.prisma;

    const unit = await client.unit.create({
      data: {
        ...data,
        amenities: data.amenities || [],
        isFurnished: data.isFurnished || false,
        isForStudents: data.isForStudents || false,
        status: UnitStatus.AVAILABLE,
      },
    });

    // Update property unit counts
    await this.updatePropertyUnitCounts(data.propertyId, client);

    // Invalidate caches
    await this.invalidatePropertyCaches(data.propertyId);

    return unit;
  }

  async findById(id: string): Promise<UnitWithDetails | null> {
    const cacheKey = this.generateCacheKey("unit", id);
    const cached = await this.getCache<UnitWithDetails>(cacheKey);
    if (cached) return cached;

    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true,
            ownerId: true,
          },
        },
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (unit) {
      await this.setCache(cacheKey, unit, 600);
    }

    return unit;
  }

  async findByProperty(
    propertyId: string,
    options: {
      status?: UnitStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    units: UnitWithDetails[];
    totalCount: number;
  }> {
    const { status, page = 1, limit = 20 } = options;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    const cacheKey = this.generateCacheKey(
      "property",
      propertyId,
      "units",
      JSON.stringify(options)
    );
    const cached = await this.getCache<{
      units: UnitWithDetails[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const where: any = { propertyId };
    if (status) where.status = status;

    const [totalCount, units] = await Promise.all([
      this.prisma.unit.count({ where }),
      this.prisma.unit.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
              ownerId: true,
            },
          },
          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: validatedLimit,
      }),
    ]);

    const result = { units, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async update(
    id: string,
    propertyId: string,
    data: UpdateUnitInput,
    tx?: any
  ): Promise<Unit> {
    const client = tx || this.prisma;

    // Verify unit belongs to property
    const existingUnit = await client.unit.findFirst({
      where: { id, propertyId },
    });

    if (!existingUnit) {
      throw new Error("Unit not found or access denied");
    }

    const updatedUnit = await client.unit.update({
      where: { id },
      data,
    });

    // Update property unit counts if status changed
    if (data.status && data.status !== existingUnit.status) {
      await this.updatePropertyUnitCounts(propertyId, client);
    }

    // Invalidate caches
    await Promise.all([
      this.deleteCachePattern(`unit:${id}:*`),
      this.invalidatePropertyCaches(propertyId),
    ]);

    return updatedUnit;
  }

  async delete(id: string, propertyId: string, tx?: any): Promise<void> {
    const client = tx || this.prisma;

    // Verify unit belongs to property and is not rented
    const unit = await client.unit.findFirst({
      where: { id, propertyId },
    });

    if (!unit) {
      throw new Error("Unit not found or access denied");
    }

    if (unit.status === UnitStatus.RENTED) {
      throw new Error("Cannot delete a rented unit");
    }

    await client.unit.delete({ where: { id } });

    // Update property unit counts
    await this.updatePropertyUnitCounts(propertyId, client);

    // Invalidate caches
    await Promise.all([
      this.deleteCachePattern(`unit:${id}:*`),
      this.invalidatePropertyCaches(propertyId),
    ]);
  }

  async updateStatus(
    id: string,
    status: UnitStatus,
    renterId?: string,
    tx?: any
  ): Promise<Unit> {
    const client = tx || this.prisma;

    const unit = await client.unit.findUnique({
      where: { id },
      select: { propertyId: true, status: true },
    });

    if (!unit) {
      throw new Error("Unit not found");
    }

    const updateData: any = { status };

    // Handle renter assignment/removal based on status
    if (status === UnitStatus.RENTED && renterId) {
      updateData.renterId = renterId;
    } else if (status === UnitStatus.AVAILABLE) {
      updateData.renterId = null;
    }

    const updatedUnit = await client.unit.update({
      where: { id },
      data: updateData,
    });

    // Update property unit counts if status changed
    if (status !== unit.status) {
      await this.updatePropertyUnitCounts(unit.propertyId, client);
    }

    // Invalidate caches
    await Promise.all([
      this.deleteCachePattern(`unit:${id}:*`),
      this.invalidatePropertyCaches(unit.propertyId),
    ]);

    return updatedUnit;
  }

  async getAvailableUnits(propertyId: string): Promise<Unit[]> {
    const cacheKey = this.generateCacheKey(
      "property",
      propertyId,
      "available-units"
    );
    const cached = await this.getCache<Unit[]>(cacheKey);
    if (cached) return cached;

    const units = await this.prisma.unit.findMany({
      where: {
        propertyId,
        status: UnitStatus.AVAILABLE,
      },
      orderBy: { createdAt: "asc" },
    });

    await this.setCache(cacheKey, units, 300);
    return units;
  }

  async getUnitCounts(propertyId: string): Promise<{
    total: number;
    available: number;
    rented: number;
    pending: number;
    inactive: number;
  }> {
    const cacheKey = this.generateCacheKey(
      "property",
      propertyId,
      "unit-counts"
    );
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const counts = await this.prisma.unit.groupBy({
      by: ["status"],
      where: { propertyId },
      _count: { status: true },
    });

    const result = {
      total: 0,
      available: 0,
      rented: 0,
      pending: 0,
      inactive: 0,
    };

    counts.forEach((count) => {
      result.total += count._count.status;
      switch (count.status) {
        case UnitStatus.AVAILABLE:
          result.available = count._count.status;
          break;
        case UnitStatus.RENTED:
          result.rented = count._count.status;
          break;
        case UnitStatus.PENDING_BOOKING:
        case UnitStatus.PENDING_REVIEW:
          result.pending += count._count.status;
          break;
        case UnitStatus.INACTIVE:
        case UnitStatus.REJECTED:
        case UnitStatus.SUSPENDED:
          result.inactive += count._count.status;
          break;
      }
    });

    await this.setCache(cacheKey, result, 300);
    return result;
  }

  private async updatePropertyUnitCounts(
    propertyId: string,
    client: any
  ): Promise<void> {
    const counts = await this.getUnitCounts(propertyId);

    await client.property.update({
      where: { id: propertyId },
      data: {
        totalUnits: counts.total,
        availableUnits: counts.available,
      },
    });

    // Clear the cached counts since we just updated them
    await this.deleteCachePattern(`property:${propertyId}:unit-counts`);
  }

  private async invalidatePropertyCaches(propertyId: string): Promise<void> {
    await Promise.all([
      this.deleteCachePattern(`property:${propertyId}:*`),
      this.deleteCachePattern("properties:*"),
    ]);
  }
}

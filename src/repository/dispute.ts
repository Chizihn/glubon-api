// repository/DisputeRepository.ts
import { Dispute, PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";

export class DisputeRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async createDispute(data: any) {
    const dispute = await this.prisma.dispute.create({
      data,
      include: {
        booking: true,
        initiator: true,
        refunds: true,
      },
    });

    await this.deleteCachePattern("disputes:*");
    return dispute;
  }

  async findDisputeById(id: string) {
    const cacheKey = this.generateCacheKey("dispute", id);
    const cached = await this.getCache<Dispute | null>(cacheKey);
    if (cached) return cached;

    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        booking: true,
        initiator: true,
        refunds: true,
      },
    });

    if (dispute) {
      await this.setCache(cacheKey, dispute, 300);
    }

    return dispute;
  }

  async updateDispute(id: string, data: any) {
    const dispute = await this.prisma.dispute.update({
      where: { id },
      data,
      include: {
        booking: true,
        initiator: true,
        refunds: true,
      },
    });

    await this.deleteCachePattern(`dispute:${id}`);
    await this.deleteCachePattern("disputes:*");
    return dispute;
  }

  /**
   * Fetches paginated disputes with optional filtering
   */
  async getPendingDisputes(
    page: number = 1,
    limit: number = 10,
    filters: {
      status?: string;
      initiatorId?: string;
      bookingId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      ...(filters.status && { status: filters.status }),
      ...(filters.initiatorId && { initiatorId: filters.initiatorId }),
      ...(filters.bookingId && { bookingId: filters.bookingId }),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate && { gte: filters.startDate }),
              ...(filters.endDate && { lte: filters.endDate }),
            },
          }
        : {}),
    };

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          booking: {
            include: {
              renter: true,
              property: {
                include: {
                  owner: true,
                  _count: {
                    select: {
                      bookings: true,
                      views: true,
                      likes: true
                    }
                  }
                }
              },
              transactions: true
            }
          },
          initiator: true,
          refunds: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      data: disputes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

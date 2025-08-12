// src/repository/RefundRepository.ts
import { PrismaClient, Refund } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";

export class RefundRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async createRefund(data: any) {
    const refund = await this.prisma.refund.create({
      data,
      include: {
        transaction: { include: { user: true, booking: true } },
        dispute: true,
        processor: true,
      },
    });

    await this.deleteCachePattern("refunds:*");
    return refund;
  }

  async findRefundById(id: string) {
    const cacheKey = this.generateCacheKey("refund", id);
    const cached = await this.getCache<Refund | null>(cacheKey);
    if (cached) return cached;

    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        transaction: { include: { user: true, booking: true } },
        dispute: true,
        processor: true,
      },
    });

    if (refund) {
      await this.setCache(cacheKey, refund, 300);
    }

    return refund;
  }

  async updateRefund(id: string, data: any) {
    const refund = await this.prisma.refund.update({
      where: { id },
      data,
      include: {
        transaction: { include: { user: true, booking: true } },
        dispute: true,
        processor: true,
      },
    });

    await this.deleteCachePattern(`refund:${id}`);
    await this.deleteCachePattern("refunds:*");
    return refund;
  }
}

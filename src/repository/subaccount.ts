import { PrismaClient, Subaccount } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";

export class SubaccountRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async create(data: any) {
    const subaccount = await this.prisma.subaccount.create({
      data,
      include: {
        user: true,
      },
    });

    await this.deleteCachePattern("subaccount:*");
    return subaccount;
  }

  async findById(id: string) {
    const cacheKey = this.generateCacheKey("subaccount", id);
    const cached = await this.getCache<Subaccount | null>(cacheKey);
    if (cached) return cached;

    const subaccount = await this.prisma.subaccount.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (subaccount) {
      await this.setCache(cacheKey, subaccount, 300);
    }

    return subaccount;
  }

  async findByUserId(userId: string) {
    const cacheKey = this.generateCacheKey("subaccount", "user", userId);
    const cached = await this.getCache<Subaccount | null>(cacheKey);
    if (cached) return cached;

    const subaccount = await this.prisma.subaccount.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });

    if (subaccount) {
      await this.setCache(cacheKey, subaccount, 300);
    }

    return subaccount;
  }

  async findBySubaccountCode(subaccountCode: string) {
    const cacheKey = this.generateCacheKey("subaccount", "code", subaccountCode);
    const cached = await this.getCache<Subaccount | null>(cacheKey);
    if (cached) return cached;

    const subaccount = await this.prisma.subaccount.findUnique({
      where: { subaccountCode },
      include: {
        user: true,
      },
    });

    if (subaccount) {
      await this.setCache(cacheKey, subaccount, 300);
    }

    return subaccount;
  }

  async update(id: string, data: any) {
    const subaccount = await this.prisma.subaccount.update({
      where: { id },
      data,
      include: {
        user: true,
      },
    });

    await this.deleteCachePattern(`subaccount:${id}`);
    await this.deleteCachePattern("subaccount:*");
    return subaccount;
  }

  async updateByUserId(userId: string, data: any) {
    const subaccount = await this.prisma.subaccount.update({
      where: { userId },
      data,
      include: {
        user: true,
      },
    });

    await this.deleteCachePattern(`subaccount:user:${userId}`);
    await this.deleteCachePattern("subaccount:*");
    return subaccount;
  }

  async delete(id: string) {
    await this.prisma.subaccount.delete({
      where: { id },
    });

    await this.deleteCachePattern(`subaccount:${id}`);
    await this.deleteCachePattern("subaccount:*");
  }

  async findAll(filters: any = {}) {
    const cacheKey = this.generateCacheKey("subaccounts", JSON.stringify(filters));
    const cached = await this.getCache<Subaccount[]>(cacheKey);
    if (cached) return cached;

    const subaccounts = await this.prisma.subaccount.findMany({
      where: filters,
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    await this.setCache(cacheKey, subaccounts, 300);
    return subaccounts;
  }

  async findManyWithPagination(
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const { skip, limit: validatedLimit } = this.validatePagination(page, limit);

    const [subaccounts, totalCount] = await Promise.all([
      this.prisma.subaccount.findMany({
        where: filters,
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: validatedLimit,
      }),
      this.prisma.subaccount.count({
        where: filters,
      }),
    ]);

    return {
      data: subaccounts,
      pagination: this.buildPagination(page, validatedLimit, totalCount),
    };
  }
}

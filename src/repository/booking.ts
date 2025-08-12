// repository/BookingRepository.ts

import { PrismaClient, BookingStatus, Booking } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";

export class BookingRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async create(data: any) {
    const booking = await this.prisma.booking.create({
      data,
      include: {
        renter: true,
        property: true,
        transactions: true,
        disputes: true,
      },
    });

    await this.deleteCachePattern("bookings:*");
    return booking;
  }

  async findById(id: string) {
    const cacheKey = this.generateCacheKey("booking", id);
    const cached = await this.getCache<Booking>(cacheKey);
    if (cached) return cached;

    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        renter: true,
        property: true,
        transactions: true,
        disputes: true,
      },
    });

    if (booking) {
      await this.setCache(cacheKey, booking, 300);
    }

    return booking;
  }

  async updateStatus(id: string, status: BookingStatus) {
    const booking = await this.prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        renter: true,
        property: true,
        transactions: true,
        disputes: true,
      },
    });

    await this.deleteCachePattern(`booking:${id}`);
    await this.deleteCachePattern("bookings:*");
    return booking;
  }

  async findUserBookings(userId: string, role?: string) {
    const where =
      role === "LISTER"
        ? { property: { ownerId: userId } }
        : { renterId: userId };

    return this.prisma.booking.findMany({
      where,
      include: {
        renter: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        property: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        transactions: true,
        disputes: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

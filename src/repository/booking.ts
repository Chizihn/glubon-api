import { PrismaClient, BookingStatus, Booking, Prisma } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";
import { Decimal } from "@prisma/client/runtime/library";

export class BookingRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async getHostBookingRequests(
    hostId: string,
    page: number = 1,
    limit: number = 10,
    status?: BookingStatus
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {
      property: { ownerId: hostId },
      ...(status && { status })
    };

    const [bookings, totalCount] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          renter: true,
          property: true,
          transactions: true,
          units: { include: { unit: true } }
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, totalCount };
  }

  async getRenterBookingRequests(
    renterId: string,
    page: number = 1,
    limit: number = 10,
    status?: BookingStatus
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {
      renterId,
      ...(status && { status })
    };

    const [bookings, totalCount] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          property: {
            include: {
              owner: true,
            },
          },
          transactions: true,
          units: { include: { unit: true } }
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, totalCount };
  }

  async createRequest(data: Omit<Prisma.BookingCreateInput, 'status' | 'requestedAt'>) {
    const bookingData: Prisma.BookingCreateInput = {
      ...data,
      status: 'PENDING_APPROVAL',
      requestedAt: new Date(),
      amount: data.amount || 0,
      startDate: data.startDate || new Date(),
      endDate: data.endDate || null,
    };

    const booking = await this.prisma.booking.create({
      data: bookingData,
      include: {
        renter: true,
        property: {
          include: {
            owner: true
          }
        },
        transactions: true,
        disputes: true,
        units: { include: { unit: true } }
      }
    });

    await this.deleteCachePattern("bookings:*");
    return booking;
  }

  async create(data: any) {
    const booking = await this.prisma.booking.create({
      data: {
        ...data,
        status: 'PENDING',
      },
      include: {
        renter: true,
        property: true,
        transactions: true,
        disputes: true,
        units: { include: { unit: true } }
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
        property: {
          include: {
            owner: true
          }
        },
        transactions: {
          include: {
            refunds: true
          }
        },
        disputes: true,
        units: { 
          include: { 
            unit: true 
          } 
        }
      },
    });

    if (!booking) return null;

    // Process the booking to ensure all Decimal fields are properly handled
    const processedBooking = this.processBooking(booking);

    // Cache the processed booking
    await this.setCache(cacheKey, processedBooking, 300);

    return processedBooking;
  }

  /**
   * Process a booking to ensure all Decimal fields are properly handled
   * This is public as it needs to be called from the service layer
   */
  public processBooking<T extends any>(booking: T): T {
    if (!booking) return booking;
    
    // Create a deep copy to avoid modifying the original object
    const processed = JSON.parse(JSON.stringify(booking));
    
    // Process amount fields
    if (processed.amount) {
      processed.amount = new Decimal(processed.amount.toString());
    }
    
    // Process transactions
    if (Array.isArray(processed.transactions)) {
      processed.transactions = processed.transactions.map((tx: any) => ({
        ...tx,
        amount: tx.amount ? new Decimal(tx.amount.toString()) : null,
        fee: tx.fee ? new Decimal(tx.fee.toString()) : null,
        refunds: Array.isArray(tx.refunds) 
          ? tx.refunds.map((refund: any) => ({
              ...refund,
              amount: refund.amount ? new Decimal(refund.amount.toString()) : null
            }))
          : []
      }));
    }
    
    // Process units
    if (Array.isArray(processed.units)) {
      processed.units = processed.units.map((unit: any) => ({
        ...unit,
        amount: unit.amount ? new Decimal(unit.amount.toString()) : null,
        unit: unit.unit ? {
          ...unit.unit,
          price: unit.unit.price ? new Decimal(unit.unit.price.toString()) : null,
          deposit: unit.unit.deposit ? new Decimal(unit.unit.deposit.toString()) : null
        } : null
      }));
    }
    
    return processed;
  }

  async respondToRequest(id: string, accepted: boolean, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        property: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.property.ownerId !== userId) {
      throw new Error('Not authorized to respond to this booking request');
    }

    if (booking.status !== BookingStatus.PENDING_APPROVAL) {
      throw new Error('This booking is not awaiting approval');
    }

    const status = accepted ? BookingStatus.PENDING_PAYMENT : BookingStatus.DECLINED;
    
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status,
        respondedAt: new Date(),
      },
      include: {
        renter: true,
        property: true,
        transactions: true,
        units: { include: { unit: true } }
      },
    });

    await this.deleteCachePattern(`bookings:${id}`);
    await this.deleteCachePattern(`bookings:user:${updatedBooking.renterId}`);
    await this.deleteCachePattern(`bookings:property:${updatedBooking.propertyId}`);
    
    return updatedBooking;
  }

  async getProperty(propertyId: string) {
    return this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: true
      }
    });
  }

  async getPendingRequestsForLister(userId: string) {
    return this.prisma.booking.findMany({
      where: {
        property: {
          ownerId: userId
        },
        status: 'PENDING_APPROVAL' as const
      },
      include: {
        renter: true,
        property: true,
        units: { include: { unit: true } }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    });
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
        units: { include: { unit: true } }
      },
    });

    await this.deleteCachePattern(`booking:${id}`);
    await this.deleteCachePattern("bookings:*");
    return booking;
  }

  async findUserBookings(userId: string, page: number = 1, limit: number = 10, status?: BookingStatus) {
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {
      OR: [
        { renterId: userId },
        { property: { ownerId: userId } }
      ],
      ...(status && { status })
    };

    const [bookings, totalCount] = await Promise.all([
      this.prisma.booking.findMany({
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
          units: { include: { unit: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where })
    ]);

    return { bookings, totalCount };
  }
}
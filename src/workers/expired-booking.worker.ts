import { PrismaClient, BookingStatus, TransactionStatus, UnitStatus } from '@prisma/client';
import { ServiceResponse } from '../types/responses';
import { logger } from '../utils/logger';

interface ExpiredBookingResponse {
  expiredCount: number;
}

export class ExpiredBookingWorker {
  private prisma: PrismaClient;
  private checkInterval: number; // in milliseconds
  private intervalId: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, checkIntervalHours: number = 48) {
    this.prisma = prisma;
    this.checkInterval = checkIntervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
  }

  /**
   * Start the worker to check for expired bookings at regular intervals
   */
  public start(): void {
    // Run immediately on start
    this.checkAndExpireBookings().catch(error => {
      logger.error('Error in initial expired bookings check:', error);
    });

    // Then set up the interval
    this.intervalId = setInterval(() => {
      this.checkAndExpireBookings().catch(error => {
        logger.error('Error checking expired bookings:', error);
      });
    }, this.checkInterval);

    // logger.info('ExpiredBookingWorker started');
  }

  /**
   * Stop the worker
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      // logger.info('ExpiredBookingWorker stopped');
    }
  }

  /**
   * Check for bookings with PENDING_PAYMENT status older than 48 hours and expire them
   */
  public async checkAndExpireBookings(): Promise<ServiceResponse<ExpiredBookingResponse>> {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    try {
      // Find all PENDING_PAYMENT bookings older than 48 hours
      const expiredBookings = await this.prisma.booking.findMany({
        where: {
          AND: [
            { status: BookingStatus.PENDING_PAYMENT },
            {
              OR: [
                { updatedAt: { lt: fortyEightHoursAgo } },
                { requestedAt: { lt: fortyEightHoursAgo } } // Fallback to requestedAt if updatedAt is not available
              ]
            }
          ]
        },
        include: {
          transactions: {
            where: {
              status: TransactionStatus.PENDING,
            },
          },
          units: true
        },
      });

      let expiredCount = 0;

      // Update each expired booking and its associated transactions
      for (const booking of expiredBookings) {
        await this.prisma.$transaction(async (tx) => {
          // Update booking status to EXPIRED
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CANCELLED },
          });

          if (booking.units.length > 0) {
             for (const bookingUnit of booking.units) {
                        await tx.unit.update({
                          where: { id: bookingUnit.id },
                          data: { status: UnitStatus.AVAILABLE },
                        });
          }
        }

          // Update all PENDING transactions to CANCELLED
          if (booking.transactions.length > 0) {
            await tx.transaction.updateMany({
              where: {
                id: {
                  in: booking.transactions.map(t => t.id),
                },
              },
              data: {
                status: TransactionStatus.CANCELLED,
              },
            });
          }
        });

        expiredCount++;
        // logger.info(`Expired booking ${booking.id} due to non-payment`);
      }

      return {
        success: true,
        data: { expiredCount },
        message: `Successfully processed ${expiredCount} expired bookings`,
      };
    } catch (error) {
      logger.error('Error expiring bookings:', error);
      return {
        success: false,
        message: 'Failed to process expired bookings',
        // statusCode is not part of ServiceResponse type, so we'll remove it
      };
    }
  }
}

// Export a singleton instance
export let expiredBookingWorker: ExpiredBookingWorker;

export function initializeExpiredBookingWorker(prisma: PrismaClient, checkIntervalHours: number = 48): void {
  if (!expiredBookingWorker) {
    expiredBookingWorker = new ExpiredBookingWorker(prisma, checkIntervalHours);
    expiredBookingWorker.start();
  }
}

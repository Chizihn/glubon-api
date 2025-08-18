import cron from "node-cron";
import { BookingService } from "../services/booking";
import { prisma, redis } from "../config";
import { logger } from "../utils";

// Run every hour to check for bookings to auto-release
cron.schedule("0 * * * *", async () => {
  try {
    const bookingService = new BookingService(prisma, redis);

    // Find completed bookings older than 24 hours
    const completedBookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        updatedAt: {
          lte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        },
      },
      include: { 
        transactions: true,
        property: {
          select: {
            id: true,
            ownerId: true,
            title: true,
          },
        },
      },
    });

    logger.info(`Found ${completedBookings.length} bookings to process for escrow release`);

    for (const booking of completedBookings) {
      try {
        const escrowTx = booking.transactions.find(
          (t) => t.id === booking.escrowTransactionId
        );
        
        if (escrowTx && escrowTx.status === "HELD") {
          logger.info(`Releasing escrow for booking ${booking.id}, property: ${booking.property.title} (${booking.property.id})`);
          await bookingService.releaseEscrow(booking.id, "SYSTEM_AUTO_RELEASE");
          logger.info(`Successfully released escrow for booking ${booking.id}`);
        }
      } catch (error) {
        logger.error(`Error processing booking ${booking.id}:`, error);
        // Continue with the next booking even if one fails
      }
    }
  } catch (error) {
    logger.error("Error in escrow release job:", error);
  }
});

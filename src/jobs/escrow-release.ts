import cron from "node-cron";
import { BookingService } from "../services/booking";
import { prisma, redis } from "../config";

// Run every hour to check for bookings to auto-release
cron.schedule("0 * * * *", async () => {
  const bookingService = new BookingService(prisma, redis);

  // Find completed bookings older than 24 hours
  const completedBookings = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      updatedAt: {
        lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    include: { transactions: true },
  });

  for (const booking of completedBookings) {
    const escrowTx = booking.transactions.find(
      (t) => t.id === booking.escrowTransactionId
    );
    if (escrowTx && escrowTx.status === "HELD") {
      await bookingService.releaseEscrow(booking.id, "SYSTEM_AUTO_RELEASE");
    }
  }
});

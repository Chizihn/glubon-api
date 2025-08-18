import cron from "node-cron";
import { prisma, redis } from "../config";
import { logger } from "../utils";

// Run daily at 2 AM for maintenance tasks
cron.schedule("0 2 * * *", async () => {
  try {
    logger.info("Starting database maintenance job...");
    
    // 1. Clean up old verification tokens (older than 24 hours)
    const { count: verificationTokenCount } = await prisma.verificationToken.deleteMany({
      where: {
        type: 'PASSWORD_RESET',
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours old
        },
      },
    });
    
    logger.info(`Cleaned up ${verificationTokenCount} expired verification tokens`);
    
    // 2. Clean up old used verification tokens (older than 7 days)
    const { count: usedTokenCount } = await prisma.verificationToken.deleteMany({
      where: {
        used: true,
        createdAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days old
        },
      },
    });
    
    logger.info(`Cleaned up ${usedTokenCount} used verification tokens`);
    
    // 3. Clean up old read notifications (older than 90 days)
    const { count: notificationCount } = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old
        },
      },
    });
    
    logger.info(`Cleaned up ${notificationCount} old notifications`);
    
    // 4. Clean up old admin action logs (older than 1 year)
    const { count: adminActionLogCount } = await prisma.adminActionLog.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        },
      },
    });
    
    logger.info(`Cleaned up ${adminActionLogCount} old admin action logs`);
    
    // 5. Update database statistics (example)
    const userCount = await prisma.user.count();
    const bookingCount = await prisma.booking.count();
    const propertyCount = await prisma.property.count();
    
    await redis.hset("statistics", {
      totalUsers: userCount,
      totalBookings: bookingCount,
      totalProperties: propertyCount,
      lastUpdated: new Date().toISOString(),
    });
    
    logger.info("Updated database statistics");
    
    logger.info("Database maintenance job completed successfully");
    
  } catch (error) {
    logger.error("Error in maintenance job:", error);
  }
});

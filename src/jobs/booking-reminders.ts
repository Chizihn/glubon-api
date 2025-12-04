import cron from "node-cron";
import { logger } from "../utils";
import { Container } from "typedi";
import { NotificationService } from "../services/notification";
import { NotificationType, PrismaClient } from "@prisma/client";
import { PRISMA_TOKEN } from "../types/di-tokens";

// Run every hour to check for upcoming bookings
cron.schedule("0 * * * *", async () => {
  try {
    const prisma = Container.get(PRISMA_TOKEN) as PrismaClient;
    const notificationService = Container.get(NotificationService);
    const now = new Date();
    
    // Get all upcoming bookings in the next 24 hours
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        startDate: {
          gte: now,
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Next 24 hours
        },
      },
      include: {
        renter: true,
        property: {
          include: {
            owner: true,
          },
        },
      },
    });

    logger.info(`Found ${upcomingBookings.length} upcoming bookings to process`);

    let reminderCount = 0;

    for (const booking of upcomingBookings) {
      try {
        // Skip if the booking doesn't have required relations
        if (!booking.renter || !booking.property || !booking.property.owner) {
          logger.warn(`Skipping booking ${booking.id} due to missing relations`);
          continue;
        }

        // Check if we've already sent a reminder for this booking
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: booking.renterId,
            type: "BOOKING_REMINDER" as any,
            data: {
              path: ['bookingId'],
              equals: booking.id
            }
          }
        });

        if (existingReminder) {
          // logger.info(`Reminder already sent for booking ${booking.id}`);
          continue;
        }

        // Skip if startDate is not available
        if (!booking.startDate) {
          logger.warn(`Skipping booking ${booking.id} due to missing start date`);
          continue;
        }

        const startDateISO = booking.startDate.toISOString();

        // Create notification record
        await prisma.notification.create({
          data: {
            userId: booking.renterId,
            type: NotificationType.BOOKING_CONFIRMED,
            title: 'Upcoming Booking',
            message: `Your booking for ${booking.property.title} is coming up soon!`,
            data: JSON.stringify({
              type: "BOOKING_CONFIRMED",
              bookingId: booking.id,
              propertyId: booking.propertyId,
              startDate: startDateISO,
            })
          }
        });

        // Send notification to property owner
        await notificationService.createNotification({
          userId: booking.property.owner.id,
          type: NotificationType.BOOKING_REQUEST_RECEIVED,
          title: "Upcoming Booking",
          message: `You have a booking for ${booking.property.title} coming up soon!`,
          data: JSON.stringify({
            type: "BOOKING_REQUEST_RECEIVED",
            bookingId: booking.id,
            propertyId: booking.propertyId,
            startDate: startDateISO,
            renterId: booking.renterId,
          })
        });

        reminderCount++;
      } catch (error) {
        logger.error(`Error processing booking ${booking.id}:`, error);
      }
    }

    if (reminderCount > 0) {
      // logger.info(`Sent ${reminderCount} booking reminders`);
    }
  } catch (error) {
    logger.error("Error in booking reminders job:", error);
  }
});

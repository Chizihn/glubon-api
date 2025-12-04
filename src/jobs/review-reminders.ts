import cron from "node-cron";
import { prisma, redis } from "../config";
import { logger } from "../utils";
import { NotificationService } from "../services/notification";
import { NotificationType, BookingStatus, Prisma } from "@prisma/client";
// import { getContainer } from "../services";

// Define the booking type with relations
interface BookingWithRelations extends Prisma.BookingGetPayload<{
  include: {
    renter: {
      select: {
        id: true;
        email: true;
        firstName: true;
        lastName: true;
      };
    };
    property: {
      select: {
        id: true;
        title: true;
        ownerId: true;
      };
    };
  };
}> {
  // Add any additional custom fields if needed
}


import { Container } from "typedi";

// Run daily at 10 AM to send review reminders
cron.schedule("0 10 * * *", async () => {
  try {
    const notificationService = Container.get(NotificationService);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // Get all completed bookings from 3 days ago
    const allBookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        endDate: {
          lte: threeDaysAgo,
        },
      },
      include: {
        renter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            ownerId: true,
          },
        },
      },
    });

    // We'll use a separate table to track sent reminders
    const bookings = allBookings as unknown as BookingWithRelations[];
    
    // Filter out any bookings that don't have required relations
    const completedBookings = bookings.filter(booking => 
      booking.renter !== null && 
      booking.property !== null
    );

    // logger.info(`Sending review reminders for ${completedBookings.length} completed bookings`);

    for (const booking of completedBookings) {
      try {
        if (!booking.renter || !booking.property) {
          logger.warn(`Skipping booking ${booking.id} due to missing relations`);
          continue;
        }

        // Check if we've already sent a reminder for this booking
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: booking.renterId,
            type: "PROPERTY_INQUIRY",
            data: {
              path: ['type'],
              string_contains: 'REVIEW_REMINDER'
            }
          }
        });

        if (existingReminder) {
          // logger.info(`Skipping booking ${booking.id} - reminder already sent`);
          continue;
        }

        // Send notification to renter
        await notificationService.createNotification({
          userId: booking.renterId,
          type: "PROPERTY_INQUIRY",
          title: "How was your stay?",
          message: `We'd love to hear about your experience at ${booking.property.title}!`,
          data: JSON.stringify({
            type: "REVIEW_REMINDER",
            bookingId: booking.id,
            propertyId: booking.property.id,
            propertyTitle: booking.property.title
          })
        });

        // logger.info(`Sent review reminder for booking ${booking.id}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error sending review reminder for booking ${booking.id}:`, errorMessage);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("Error in review reminders job:", errorMessage);
  }
});

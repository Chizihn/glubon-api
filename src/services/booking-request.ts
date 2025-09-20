import { BookingStatus, NotificationType, PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BookingRepository } from "../repository/booking";
import { NotificationService } from "./notification";

export class BookingRequestService {
  private bookingRepository: BookingRepository;
  private notificationService: NotificationService;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.bookingRepository = new BookingRepository(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
  }

  async createBookingRequest(data: {
    renterId: string;
    propertyId: string;
    startDate: Date;
    endDate: Date | null;
    amount: number;
    units: Array<{ unitId: string }>;
  }) {
    // First get property to get owner ID
    const property = await this.bookingRepository.getProperty(data.propertyId);
    if (!property) {
      throw new Error('Property not found');
    }

    const booking = await this.bookingRepository.createRequest({
      renter: { connect: { id: data.renterId } },
      property: { connect: { id: data.propertyId } },
      startDate: data.startDate,
      endDate: data.endDate || null,
      amount: data.amount,
      units: {
        create: data.units.map(unit => ({
          unit: { connect: { id: unit.unitId } }
        }))
      }
    });

    // Notify property owner
    if (property.owner) {
      await this.notificationService.createNotification({
        userId: property.owner.id,
        title: 'New Booking Request',
        message: `You have a new booking request for ${property.title}`,
        type: 'NEW_MESSAGE',
        data: {referenceId: booking.id, referenceType: 'BOOKING'}
        // referenceType: 'BOOKING'
      });
    }

    return booking;
  }

  async respondToBookingRequest(bookingId: string, listerId: string, accepted: boolean) {
    const updatedBooking = await this.bookingRepository.respondToRequest(
      bookingId,
      accepted,
      listerId
    );

    // Notify renter
    await this.notificationService.createNotification({
      userId: updatedBooking.renterId,
      title: accepted ? 'Booking Request Accepted' : 'Booking Request Declined',
      message: `Your booking request for ${updatedBooking.property.title} has been ${accepted ? 'accepted' : 'declined'}`,
      type: accepted ? 'BOOKING_CONFIRMED' : 'BOOKING_CANCELLED',
      data: {
        bookingId,
        propertyTitle: updatedBooking.property.title,
        status: accepted ? 'ACCEPTED' : 'DECLINED'
      }
    });

    return updatedBooking;
  }

  async getPendingRequests(listerId: string) {
    return this.bookingRepository.getPendingRequestsForLister(listerId);
  }

  async getBookingRequest(bookingId: string, userId: string) {
    const booking = await this.bookingRepository.findById(bookingId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Get property to check ownership
    const property = await this.bookingRepository.getProperty(booking.propertyId);
    if (!property) {
      throw new Error('Property not found');
    }

    // Only the renter or property owner can view the booking request
    if (booking.renterId !== userId && (property.owner?.id !== userId)) {
      throw new Error('Not authorized to view this booking');
    }

    return booking;
  }
}

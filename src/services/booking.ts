//src/services/booking.ts
import {
  Booking,
  BookingStatus,
  NotificationType,
  RentalPeriod,
  Prisma,
  PrismaClient,
  Property,
  PropertyStatus,
  RoleEnum,
  Transaction,
  TransactionStatus,
  TransactionType,
  Unit,
  User,
  UnitStatus,
  PropertyListingType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { BaseService } from "./base";
import { BookingRepository } from "../repository/booking";
import { TransactionService } from "./transaction";
import { PaystackService } from "./payment";
import { NotificationService } from "./notification";
// import { Container } from "../container";
import { PropertyRepository } from "../repository/properties";
import { UserRepository } from "../repository/user";
import { ServiceResponse } from "../types/responses";
import { logger } from "../utils";
import Redis from "ioredis";
import { appConfig, config } from "../config";

interface PaginatedBookingResponse {
  items: Booking[];
  totalCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
  };
}

export interface CreateBookingRequestInput {
  propertyId: string;
  unitIds?: string[]; // Optional for properties with units
}

export interface CreateBookingInput {
  propertyId: string;
  startDate: Date;
  duration: number;
  unitIds?: string[];
  idempotencyKey?: string;
}

export interface UpdateBookingStatusInput {
  bookingId: string;
  status: BookingStatus;
  userId: string;
}

export interface ConfirmBookingPaymentInput {
  reference: string;
  userId: string;
}

export interface GetUserBookingsInput {
  targetUserId: string;
  currentUserRole?: RoleEnum;
  currentUserId?: string;
  page?: number;
  limit?: number;
  status?: BookingStatus;
}

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

@Service()
export class BookingService extends BaseService {
  // Logger is available from BaseService

  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis,
    private bookingRepo: BookingRepository,
    private transactionService: TransactionService,
    private paystackService: PaystackService,
    private notificationService: NotificationService,
    private userRepo: UserRepository,
    private propertyRepo: PropertyRepository
  ) {
    super(prisma, redis);
  }

  /**
   * Step 1: Create a booking request (no payment, just a request to book)
   */
  async createBookingRequest(
    input: CreateBookingRequestInput,
    renterId: string
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: input.propertyId },
        include: {
          owner: true,
          units: true,
        },
      });

      if (!property) {
        return this.failure("Property not found");
      }

      if (property.status !== PropertyStatus.ACTIVE) {
        return this.failure("This property is not available for booking");
      }

      // Validate units based on property type
      let selectedUnits: Unit[] = [];
      if (property.units.length > 0) {
        if (property.isStandalone) {
          // For standalone properties, units are optional
          // Use specified units if provided, but don't require them
          selectedUnits = input.unitIds
            ? property.units.filter(
                (unit) =>
                  input.unitIds!.includes(unit.id) &&
                  (unit.status === UnitStatus.AVAILABLE ||
                    unit.status === UnitStatus.RENTED)
              )
            : [];
        } else {
          // For non-standalone properties, require at least one unit to be selected
          if (!input.unitIds || input.unitIds.length === 0) {
            return this.failure("Please select at least one unit");
          }

          selectedUnits = property.units.filter(
            (unit) =>
              input.unitIds!.includes(unit.id) &&
              unit.status === UnitStatus.AVAILABLE
          );

          if (selectedUnits.length !== input.unitIds.length) {
            return this.failure("One or more selected units are not available");
          }
        }
      }

      // Calculate amount based on property or units
      let totalAmount = new Decimal(0);
      if (selectedUnits.length > 0) {
        // Sum up unit amounts if units are selected
        totalAmount = selectedUnits.reduce(
          (sum, unit) => sum.plus(unit.amount || new Decimal(0)),
          new Decimal(0)
        );
      } else {
        // For standalone properties with no units selected, use the property amount
        totalAmount = property.amount;
      }

      // For booking requests, we set a default start date that can be updated later
      // when the booking is confirmed
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() + 1); // Default to tomorrow

      const booking = await this.prisma.booking.create({
        data: {
          renter: { connect: { id: renterId } },
          property: { connect: { id: input.propertyId } },
          amount: totalAmount,
          status: BookingStatus.PENDING_APPROVAL,
          startDate: defaultStartDate,
          ...(selectedUnits.length > 0 && {
            units: {
              create: selectedUnits.map((unit) => ({
                unit: { connect: { id: unit.id } },
              })),
            },
          }),
        },
        include: {
          property: { include: { owner: true } },
          renter: true,
          units: { include: { unit: true } },
        },
      });

      // Notify property owner
      await this.notificationService.createNotification({
        userId: property.ownerId,
        title: "New Booking Request",
        message: `You have a new booking request for ${property.title}`,
        type: NotificationType.BOOKING_REQUEST,
        data: {
          bookingId: booking.id,
          propertyId: property.id,
          propertyTitle: property.title,
        },
      });

      return this.success({
        booking,
        message:
          "Booking request created successfully. Waiting for host approval.",
      });
    } catch (error) {
      return this.handleError(error, "createBookingRequest");
    }
  }

  /**
   * Step 2: Host responds to booking request
   */
  async respondToBookingRequest(
    bookingId: string,
    hostId: string,
    accept: boolean
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    try {
      // Use a transaction to ensure data consistency
      const [updatedBooking] = await this.prisma.$transaction([
        // First, find and validate the booking
        this.prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            property: { include: { owner: true } },
            renter: true,
            units: { include: { unit: true } },
          },
        }),
      ]);

      if (!updatedBooking) {
        return this.failure("Booking not found");
      }

      if (updatedBooking.property.ownerId !== hostId) {
        return this.failure("Not authorized to respond to this booking");
      }

      if (updatedBooking.status !== BookingStatus.PENDING_APPROVAL) {
        return this.failure(
          "This booking request has already been responded to"
        );
      }

      const status = accept
        ? BookingStatus.PENDING_PAYMENT
        : BookingStatus.REJECTED;

      // Update the booking status within the same transaction
      const [result] = await this.prisma.$transaction([
        this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status,
            respondedAt: new Date(),
            updatedAt: new Date(), // Explicitly set updatedAt
          },
          include: {
            property: { include: { owner: true } },
            renter: true,
            units: { include: { unit: true } },
          },
        }),

        // Create notification in the same transaction
        this.prisma.notification.create({
          data: {
            userId: updatedBooking.renterId,
            title: `Booking Request ${accept ? "Approved" : "Declined"}`,
            message: `Your booking request for ${
              updatedBooking.property.title
            } has been ${
              accept
                ? "approved. You can now proceed with payment."
                : "declined"
            }`,
            type: accept
              ? NotificationType.BOOKING_APPROVED
              : NotificationType.BOOKING_DECLINED,
            data: {
              bookingId: updatedBooking.id,
              propertyId: updatedBooking.propertyId,
              propertyTitle: updatedBooking.property.title,
            },
          },
        }),
      ]);

      // Invalidate cache for affected users
      await Promise.all([
        this.deleteCachePattern(`booking:${bookingId}*`),
        // Invalidate renter's booking list
        this.deleteCachePattern(`bookings:renter:${updatedBooking.renterId}*`),
        // Invalidate host's booking requests
        this.deleteCachePattern(`bookings:host:${hostId}*`),
      ]);

      return this.success({
        booking: result,
        message: `Booking request ${
          accept ? "approved" : "declined"
        } successfully`,
      });
    } catch (error) {
      return this.handleError(error, "respondToBookingRequest");
    }
  }

  /**
   * Step 3: Create actual booking with payment (after approval)
   */
  async createBooking(
    data: CreateBookingInput,
    renterId: string
  ): Promise<ServiceResponse<{ booking: Booking; paymentUrl: string }>> {
    try {
      // Find the approved booking request
      const existingBooking = await this.prisma.booking.findFirst({
        where: {
          renterId,
          propertyId: data.propertyId,
          status: BookingStatus.PENDING_PAYMENT,
        },
        include: {
          property: {
            include: {
              owner: { include: { subaccount: true } },
              units: true,
            },
          },
          units: { include: { unit: true } },
          renter: true,
        },
      });

      if (!existingBooking) {
        return this.failure(
          "No approved booking request found. Please create a booking request first."
        );
      }

      const property = existingBooking.property;

      // Validate based on listing type
      if (property.listingType === "SALE") {
        // For SALE, duration should be 1 and endDate should be same as startDate
        if (data.duration !== 1) {
          return this.failure(
            "For properties listed for sale, duration must be 1"
          );
        }
        if (existingBooking.units.length > 1) {
          return this.failure(
            "Cannot book multiple units for a property listed for sale"
          );
        }
      } else if (
        property.listingType === "LEASE" ||
        property.listingType === "RENT"
      ) {
        // For LEASE and RENT, validate duration and dates
        if (data.duration < 1) {
          return this.failure("Duration must be at least 1");
        }
      }

      // Calculate dates
      const startDate = new Date(data.startDate);
      let endDate: Date | null = null;

      // Only calculate endDate for RENT and LEASE, not for SALE
      if (property.listingType !== "SALE") {
        endDate = this.calculateEndDate(
          startDate,
          data.duration,
          property.rentalPeriod
        );
      }

      // Calculate total amount
      let totalAmount: Decimal;
      if (property.listingType === "SALE") {
        // For SALE, use the full amount without duration multiplier
        totalAmount = existingBooking.amount;
      } else {
        // For RENT and LEASE, multiply by duration
        totalAmount = existingBooking.amount.mul(data.duration);
      }

      return await this.prisma.$transaction(async (tx) => {
        // Update the existing booking with dates and final amount
        const updatedBooking = await tx.booking.update({
          where: { id: existingBooking.id },
          data: {
            startDate,
            endDate,
            amount: totalAmount,
          },
          include: {
            property: { include: { owner: true } },
            renter: true,
            units: { include: { unit: true } },
          },
        });

        // Reserve units if applicable
        if (existingBooking.units.length > 0) {
          for (const bookingUnit of existingBooking.units) {
            await tx.unit.update({
              where: { id: bookingUnit.unit.id },
              data: { status: UnitStatus.PENDING_BOOKING },
            });
          }

          // Update property available units count
          await tx.property.update({
            where: { id: property.id },
            data: {
              availableUnits: {
                decrement: existingBooking.units.length,
              },
            },
          });
        }

        // Determine transaction type based on property listing type
        let transactionType: string;
        switch (property.listingType) {
          case "RENT":
            transactionType = "RENT_PAYMENT";
            break;
          case "LEASE":
            transactionType = "LEASE_PAYMENT";
            break;
          case "SALE":
            transactionType = "SALE_PAYMENT";
            break;
          default:
            transactionType = "RENT_PAYMENT"; // Default fallback
        }

        // Create transaction for payment
        const transactionResult =
          await this.transactionService.createTransaction(
            {
              type: transactionType as any, // Type assertion needed due to Prisma client type issue
              amount: totalAmount,
              currency: "NGN",
              description: `Payment for ${property.listingType.toLowerCase()} booking ${
                updatedBooking.id
              }`,
              userId: renterId,
              propertyId: property.id,
              bookingId: updatedBooking.id,
              metadata: {
                amount: totalAmount.toNumber(),
                subaccountCode: property.owner.subaccount!.subaccountCode,
                splitType: "percentage",
                listingType: property.listingType,
              },
            },
            renterId
          );

        if (!transactionResult.success || !transactionResult.data) {
          throw new Error(transactionResult.message);
        }

        // Create payment with Paystack
        let paymentUrl;
        try {
          // Generate callback URL for payment completion
          const callbackUrl = `${
            process.env.BACKEND_URL || "http://localhost:4000"
          }/payment-callback`;

          const paystackResponse =
            await this.paystackService.createSplitPayment(
              existingBooking.renter.email!,
              totalAmount,
              transactionResult.data.reference,
              property.owner.subaccount!.subaccountCode!,
              property.owner.subaccount!.percentageCharge,
              callbackUrl,
              data.idempotencyKey
            );

          if (!paystackResponse?.data?.status) {
            const errorMessage =
              paystackResponse?.message || "Failed to process payment";
            logger.error("Error creating split payment", {
              message: errorMessage,
              status: paystackResponse?.data?.status,
              reference: transactionResult.data.reference,
            });
            throw new Error(errorMessage);
          }

          paymentUrl = paystackResponse.data?.data?.authorization_url;
          if (!paymentUrl) {
            throw new Error("Failed to get payment URL from payment provider");
          }

          // Update property status
          await tx.property.update({
            where: { id: data.propertyId },
            data: { status: PropertyStatus.PENDING_BOOKING },
          });

          // Send notifications
          await this.sendBookingCreatedNotifications({
            booking: updatedBooking,
            renter: existingBooking.renter,
            property,
            totalAmount: totalAmount.toNumber(),
            paymentUrl,
          });

          // Return the booking with payment URL
          return {
            success: true,
            message: "Booking created successfully. Please complete payment.",
            data: {
              booking: updatedBooking,
              paymentUrl,
            },
          };
        } catch (error) {
          logger.error("Error in createBooking payment process", {
            error: error instanceof Error ? error.message : "Unknown error",
            bookingId: existingBooking.id,
            reference: transactionResult.data.reference,
          });
          throw error; // Re-throw to trigger transaction rollback
        }
      });
    } catch (error) {
      return this.handleError(error, "createBooking");
    }
  }

  /**
   * Verify payment for a booking (used by renter after payment)
   */
  async verifyPayment(
    reference: string,
    userId: string
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    try {
      // Use confirmBookingPayment to handle the payment verification
      const result = await this.confirmBookingPayment({
        reference,
        userId,
      });

      if (!result.success) {
        return this.failure(result.message);
      }

      // Get the updated booking
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
        include: { booking: true },
      });

      if (!transaction?.booking) {
        return this.failure(
          "Failed to retrieve booking after payment verification"
        );
      }

      return this.success({ booking: transaction.booking });
    } catch (error) {
      return this.handleError(error, "verifyPayment");
    }
  }

  /**
   * Confirm payment received (used by lister)
   */
  async confirmFundsReceived(
    bookingId: string,
    hostId: string
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    try {
      // Get booking with units
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          units: {
            include: {
              unit: true,
            },
          },
        },
      });

      if (!booking) {
        return this.failure("Booking not found");
      }

      // Verify the host owns the property
      const property = await this.propertyRepo.findById(booking.propertyId);
      if (!property || property.ownerId !== hostId) {
        return this.failure("Unauthorized");
      }

      // Verify the booking is in PAID status
      if (booking.status !== BookingStatus.PAID) {
        return this.failure("Booking is not in PAID status");
      }

      // Determine the appropriate status based on listing type
      let propertyStatus: PropertyStatus;
      switch (property.listingType) {
        case "SALE":
          propertyStatus = "SOLD" as PropertyStatus;
          break;
        case "LEASE":
          propertyStatus = "LEASED" as PropertyStatus;
          break;
        case "RENT":
        default:
          propertyStatus = "RENTED" as PropertyStatus;
      }

      // Update booking status to CONFIRMED and property status based on listing type
      const [updatedBooking] = await Promise.all([
        this.bookingRepo.update(bookingId, {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
        }),
        // Update property status based on listing type
        this.prisma.property.update({
          where: { id: booking.propertyId },
          data: { status: propertyStatus },
        }),
      ]);

      // Send notifications
      await this.sendStatusUpdateNotifications(
        updatedBooking,
        BookingStatus.CONFIRMED,
        hostId
      );

      // Update units status if applicable
      const bookingWithUnits = booking as Booking & {
        units: Array<{ unit: { id: string } }>;
      };

      if (bookingWithUnits.units && bookingWithUnits.units.length > 0) {
        await this.prisma.unit.updateMany({
          where: {
            id: {
              in: bookingWithUnits.units.map(
                (u: { unit: { id: string } }) => u.unit.id
              ),
            },
            status: UnitStatus.PENDING_BOOKING,
          },
          data: { status: UnitStatus.RENTED },
        });
      }

      return this.success({ booking: updatedBooking });
    } catch (error) {
      return this.handleError(error, "confirmFundsReceived");
    }
  }

  /**
   * Confirm payment (used by payment webhook)
   */
  async confirmBookingPayment(
    input: ConfirmBookingPaymentInput
  ): Promise<ServiceResponse<{ success: boolean }>> {
    const { reference, userId } = input;

    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
        include: {
          booking: {
            include: {
              property: {
                include: { owner: { include: { subaccount: true } } },
              },
              renter: true,
              units: { include: { unit: true } },
            },
          },
          user: true,
        },
      });

      if (
        !transaction ||
        transaction.userId !== userId ||
        transaction.status !== TransactionStatus.PENDING
      ) {
        return this.failure("Invalid transaction");
      }

      // Verify payment with Paystack
      const paystackResponse = await this.paystackService.verifyPayment(
        reference
      );

      if (
        !paystackResponse.data ||
        !paystackResponse.data.data ||
        paystackResponse.data.data.status !== "success"
      ) {
        return this.failure(
          `Payment verification failed: ${paystackResponse.message}`
        );
      }

      const paidAmount = new Decimal(paystackResponse.data.data.amount).div(
        100
      );
      const expectedAmount = new Decimal(transaction.amount);

      if (!paidAmount.equals(expectedAmount)) {
        return this.failure("Payment amount mismatch");
      }

      return await this.prisma.$transaction(async (tx) => {
        // Update transaction status
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.COMPLETED,
            processedAt: new Date(),
          },
        });

        if (!transaction.booking) {
          throw new Error("Booking not found for transaction");
        }

        // Update booking status to PAID after successful payment
        await tx.booking.update({
          where: { id: transaction.bookingId! },
          data: {
            status: BookingStatus.PAID,
            // paidAt: new Date()
          },
        });

        // Keep property status as PENDING_BOOKING until host confirms funds
        // Property will be updated to RENTED in confirmFundsReceived

        // Update units to booked status if applicable
        if (transaction.booking.units.length > 0) {
          for (const bookingUnit of transaction.booking.units) {
            await tx.unit.update({
              where: { id: bookingUnit.unit.id },
              data: { status: UnitStatus.RENTED },
            });
          }
        }

        // Send confirmation notifications
        await this.sendPaymentConfirmedNotifications(transaction);

        return this.success({ success: true });
      });
    } catch (error) {
      return this.handleError(error, "confirmBookingPayment");
    }
  }

  /**
   * Get host's booking requests
   */
  async getHostBookingRequests(
    hostId: string,
    page: number = 1,
    limit: number = 10,
    status?: BookingStatus
  ): Promise<ServiceResponse<PaginatedBookingResponse>> {
    try {
      const { bookings, totalCount } =
        await this.bookingRepo.getHostBookingRequests(
          hostId,
          page,
          limit,
          status
        );

      const totalPages = Math.ceil(totalCount / limit);

      return this.success({
        items: bookings,
        totalCount,
        pagination: {
          currentPage: page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          limit,
        },
      });
    } catch (error) {
      return this.handleError(error, "getHostBookingRequests");
    }
  }

  /**
   * Get renter's bookings
   */
  async getRenterBookings(
    renterId: string,
    page: number = 1,
    limit: number = 10,
    status?: BookingStatus
  ): Promise<ServiceResponse<PaginatedBookingResponse>> {
    try {
      const { bookings, totalCount } =
        await this.bookingRepo.getRenterBookingRequests(
          renterId,
          page,
          limit,
          status
        );

      const totalPages = Math.ceil(totalCount / limit);

      return this.success({
        items: bookings,
        totalCount,
        pagination: {
          currentPage: page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          limit,
        },
      });
    } catch (error) {
      return this.handleError(error, "getRenterBookings");
    }
  }

  /**
   * Get user booking by ID
   */
  async getUserBookingById(
    bookingId: string,
    userId: string
  ): Promise<ServiceResponse<Booking>> {
    try {
      const booking = await this.bookingRepo.findById(bookingId);
      if (!booking) return this.failure("Booking not found");

      const property = await this.propertyRepo.findById(booking.propertyId);
      if (!property) return this.failure("Property not found");

      const user = await this.userRepo.findUserById(userId);
      if (!user) return this.failure("User not found");

      const isOwner = property.ownerId === userId;
      const isRenter = booking.renterId === userId;
      const isAdmin = user.role === RoleEnum.ADMIN;

      if (!isOwner && !isRenter && !isAdmin) {
        return this.failure("Unauthorized");
      }

      const processedBooking = this.bookingRepo.processBooking(booking);
      return this.success(processedBooking, "Booking retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getUserBookingById");
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(
    input: UpdateBookingStatusInput
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    const { bookingId, status, userId } = input;

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          property: { include: { owner: true } },
          renter: true,
          units: { include: { unit: true } },
        },
      });

      if (!booking) {
        return this.failure("Booking not found");
      }

      // Validate permissions
      if (
        status === BookingStatus.CONFIRMED &&
        booking.property.ownerId !== userId
      ) {
        return this.failure("Only the property owner can confirm bookings");
      }

      if (
        status === BookingStatus.CANCELLED &&
        booking.property.ownerId !== userId &&
        booking.renterId !== userId
      ) {
        return this.failure(
          "Only the property owner or renter can cancel bookings"
        );
      }

      const updatedBooking = await this.bookingRepo.updateStatus(
        bookingId,
        status
      );

      // Send appropriate notifications based on status change
      await this.sendStatusUpdateNotifications(booking, status, userId);

      return this.success({ booking: updatedBooking });
    } catch (error) {
      return this.handleError(error, "updateBookingStatus");
    }
  }

  // Helper methods
  private calculateEndDate(
    startDate: Date,
    duration: number,
    rentalPeriod: RentalPeriod
  ): Date {
    const endDate = new Date(startDate);

    switch (rentalPeriod) {
      case RentalPeriod.WEEKLY:
        endDate.setDate(endDate.getDate() + duration * 7);
        break;
      case RentalPeriod.MONTHLY:
        endDate.setMonth(endDate.getMonth() + duration);
        break;
      case RentalPeriod.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + duration * 3);
        break;
      case RentalPeriod.YEARLY:
        endDate.setFullYear(endDate.getFullYear() + duration);
        break;
      default:
        endDate.setDate(endDate.getDate() + duration);
    }

    return endDate;
  }

  private async sendBookingCreatedNotifications(data: {
    booking: Booking;
    renter: User;
    property: Property;
    totalAmount: number;
    paymentUrl: string;
  }) {
    const { booking, renter, property, totalAmount, paymentUrl } = data;

    await Promise.all([
      this.notificationService.createNotification({
        userId: renter.id,
        title: "Complete Your Payment",
        message: `Your booking for ${
          property.title
        } is ready. Complete payment: ₦${totalAmount.toLocaleString()}`,
        type: NotificationType.PAYMENT_REQUIRED,
        data: {
          bookingId: booking.id,
          paymentUrl,
          totalAmount,
        },
      }),
      this.notificationService.createNotification({
        userId: property.ownerId,
        title: "Booking Payment Pending",
        message: `${renter.firstName} ${renter.lastName} is completing payment for ${property.title}`,
        type: NotificationType.BOOKING_REQUEST,
        data: { bookingId: booking.id },
      }),
    ]);
  }

  private async sendPaymentConfirmedNotifications(transaction: any) {
    if (!transaction.booking) return;

    const booking = transaction.booking;

    await Promise.all([
      this.notificationService.createNotification({
        userId: transaction.userId!,
        title: "Payment Confirmed",
        message: `Your payment has been confirmed. Booking is now active.`,
        type: NotificationType.PAYMENT_CONFIRMED,
        data: {
          bookingId: booking.id,
          amount: transaction.amount,
          transactionId: transaction.id,
        },
      }),
      this.notificationService.createNotification({
        userId: booking.property.ownerId,
        title: "Booking Confirmed",
        message: `Payment received for ${booking.property.title}. Booking is now confirmed.`,
        type: NotificationType.BOOKING_CONFIRMED,
        data: {
          bookingId: booking.id,
          amount: transaction.amount,
          transactionId: transaction.id,
        },
      }),
    ]);
  }

  private async sendStatusUpdateNotifications(
    booking: any,
    status: BookingStatus,
    userId: string
  ) {
    const isHostAction = userId === booking.property.ownerId;

    switch (status) {
      case BookingStatus.CANCELLED:
        await this.notificationService.createNotification({
          userId: isHostAction ? booking.renterId : booking.property.ownerId,
          title: isHostAction
            ? "Booking Cancelled"
            : "Booking Cancelled by Guest",
          message: isHostAction
            ? `Your booking for ${booking.property.title} has been cancelled by the host.`
            : `Booking for ${booking.property.title} has been cancelled by the guest.`,
          type: NotificationType.BOOKING_CANCELLED,
          data: {
            bookingId: booking.id,
            propertyId: booking.propertyId,
            propertyTitle: booking.property.title,
            cancelledBy: isHostAction ? "host" : "guest",
          },
        });
        break;

      case BookingStatus.COMPLETED:
        await Promise.all([
          this.notificationService.createNotification({
            userId: booking.renterId,
            title: "Booking Completed",
            message: `Your stay at ${booking.property.title} has been completed.`,
            type: NotificationType.BOOKING_COMPLETED,
            data: { bookingId: booking.id },
          }),
          this.notificationService.createNotification({
            userId: booking.property.ownerId,
            title: "Booking Completed",
            message: `Booking for ${booking.property.title} has been completed.`,
            type: NotificationType.BOOKING_COMPLETED,
            data: { bookingId: booking.id },
          }),
        ]);
        break;
    }
  }
}

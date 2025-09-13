import { 
  Booking, 
  BookingStatus, 
  NotificationType, 
  Prisma, 
  PrismaClient, 
  Property, 
  PropertyStatus, 
  RoleEnum, 
  SubaccountStatus, 
  Transaction, 
  TransactionStatus, 
  TransactionType, 
  Unit, 
  User
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import { BookingNotification } from "../types/services/notification";
import { BaseService } from "./base";
import { BookingRepository } from "../repository/booking";
import { TransactionService } from "./transaction";
import { PaystackService } from "./payment";
import { NotificationService } from "./notification";
import { PlatformFeeService } from "./platform-service";
import { CreateBookingRequestInput } from "../modules/booking/booking.inputs";
import { PropertyRepository } from "../repository/properties";
import { UserRepository } from "../repository/user";
import { ServiceResponse } from "../types/responses";

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

export interface CreateBookingInput {
  propertyId: string;
  startDate: Date;
  endDate?: Date | null;
  specialRequests?: string | null;
  unitIds: string[];
  amount: Decimal | number;
  units: string[];
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



export class BookingService extends BaseService {
  private bookingRepo: BookingRepository;
  private transactionService: TransactionService;
  private paystackService: PaystackService;
  private notificationService: NotificationService;
  private platformFeeService: PlatformFeeService;
  private userRepo: UserRepository;
  private propertyRepo: PropertyRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.bookingRepo = new BookingRepository(prisma, redis);
    this.transactionService = new TransactionService(prisma, redis);
    this.paystackService = new PaystackService(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
    this.platformFeeService = new PlatformFeeService(prisma, redis);
    this.userRepo = new UserRepository(prisma, redis);
    this.propertyRepo = new PropertyRepository(prisma, redis);
  }

  async createBookingRequest(
    input: CreateBookingRequestInput,
    renterId: string
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: input.propertyId },
        include: { owner: true }
      });

      if (!property) {
        return this.failure('Property not found');
      }

      if (property.status !== PropertyStatus.ACTIVE) {
        return this.failure('This property is not available for booking');
      }

      const booking = await this.prisma.booking.create({
        data: {
          renter: { connect: { id: renterId } },
          property: { connect: { id: input.propertyId } },
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          amount: property.amount,
          status: BookingStatus.PENDING_APPROVAL,
          units: {
            create: input.unitIds.map(unitId => ({
              unit: { connect: { id: unitId } }
            }))
          }
        },
        include: {
          property: { include: { owner: true } },
          renter: true,
          transactions: true,
          units: {
            include: { unit: true }
          }
        }
      });

      await this.notificationService.createNotification({
        userId: property.ownerId,
        title: 'New Booking Request',
        message: `You have a new booking request for ${property.title}`,
        type: NotificationType.BOOKING_REQUEST,
        data: { referenceId: booking.id }
      });

      return this.success({
        booking,
        message: 'Booking request created successfully. Waiting for host approval.'
      });
    } catch (error) {
      return this.handleError(error, 'createBookingRequest');
    }
  }

  async respondToBookingRequest(
    bookingId: string,
    listerId: string,
    accept: boolean
  ): Promise<ServiceResponse<{ booking: Booking }>> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          property: { include: { owner: true } },
          renter: true,
          transactions: true,
          units: { include: { unit: true } }
        }
      });

      if (!booking) {
        return this.failure('Booking not found');
      }

      if (booking.property.ownerId !== listerId) {
        return this.failure('Not authorized to respond to this booking');
      }

      const status = accept ? BookingStatus.PENDING : BookingStatus.DECLINED;
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { 
          status,
          respondedAt: new Date()
        },
        include: {
          property: { include: { owner: true } },
          renter: true,
          transactions: true,
          units: {
            include: { unit: true }
          }
        }
      });

      await this.notificationService.createNotification({
        userId: booking.renterId,
        title: `Booking Request ${accept ? 'Approved' : 'Declined'}`,
        message: `Your booking request for ${booking.property.title} has been ${accept ? 'approved' : 'declined'}`,
        type: accept ? NotificationType.BOOKING_APPROVED : NotificationType.BOOKING_DECLINED,
        data: { referenceId: bookingId }
      });

      return this.success({
        booking: updatedBooking,
        message: `Booking request ${accept ? 'approved' : 'declined'} successfully`
      });
    } catch (error) {
      return this.handleError(error, 'respondToBookingRequest');
    }
  }

  async getHostBookingRequests(
    hostId: string,
    page: number = 1,
    limit: number = 10,
    status?: BookingStatus
  ): Promise<ServiceResponse<PaginatedBookingResponse>> {
    try {
      const { bookings, totalCount } = await this.bookingRepo.getHostBookingRequests(
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
          limit
        }
      });
    } catch (error) {
      return this.handleError(error, 'getHostBookingRequests');
    }
  }

  async getRenterBookingRequests(
    renterId: string,
    page: number = 1,
    limit: number = 10,
    status?: BookingStatus
  ): Promise<ServiceResponse<PaginatedBookingResponse>> {
    try {
      const skip = (page - 1) * limit;
      const where: Prisma.BookingWhereInput = { renterId };
      
      if (status) {
        where.status = status;
      }
      
      const [bookings, totalCount] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          include: {
            property: { include: { owner: true } },
            renter: true,
            transactions: true,
            units: {
              include: { unit: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.booking.count({ where })
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return this.success({
        items: bookings,
        totalCount,
        pagination: {
          currentPage: page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          limit
        }
      });
    } catch (error) {
      return this.handleError(error, 'getRenterBookingRequests');
    }
  }

  async createBooking(
    data: CreateBookingInput,
    renterId: string
  ): Promise<ServiceResponse<{ booking: Booking; paymentUrl: string }>> {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: data.propertyId },
        include: {
          owner: {
            include: { subaccount: true }
          }
        },
      });

      if (!property) return this.failure("Property not found");
      if (property.status !== PropertyStatus.ACTIVE) {
        return this.failure("Property not available");
      }

      if (!property.owner.subaccount || 
          property.owner.subaccount.status !== SubaccountStatus.ACTIVE || 
          !property.owner.subaccount.subaccountCode) {
        return this.failure("Property owner payment setup incomplete");
      }

      const days = data.endDate
        ? Math.ceil(
            (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 3600 * 24)
          )
        : 30;

      const baseAmount = new Decimal(property.amount).div(30).mul(days);
      const platformFee = await this.platformFeeService.calculatePlatformFee(baseAmount.toNumber());
      const totalAmount = baseAmount.add(platformFee);

      return await this.prisma.$transaction(async (tx) => {
        const booking = await this.bookingRepo.create({
          renterId,
          propertyId: data.propertyId,
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          amount: baseAmount,
          status: BookingStatus.PENDING,
          units: {
            create: data.units.map(unit => ({
              unit: { connect: { id: unit } }
            }))
          }
        });

        const renter = await tx.user.findUnique({ where: { id: renterId } });
        if (!renter) throw new Error("Renter not found");

        const transactionData = {
          type: TransactionType.RENT_PAYMENT,
          amount: totalAmount,
          currency: "NGN",
          description: `Split payment for booking ${booking.id}`,
          userId: renterId,
          propertyId: data.propertyId,
          bookingId: booking.id,
          metadata: {
            baseAmount: baseAmount.toNumber(),
            platformFee: platformFee,
            subaccountCode: property.owner.subaccount!.subaccountCode,
            ownerPercentage: property.owner.subaccount!.percentageCharge,
            platformPercentage: 100 - property.owner.subaccount!.percentageCharge,
            splitType: "percentage"
          },
        };

        const transactionResult = await this.transactionService.createTransaction(
          transactionData,
          renterId
        );
        if (!transactionResult.success || !transactionResult.data) {
          throw new Error(transactionResult.message);
        }

        const paystackResponse = await this.paystackService.createSplitPayment(
          renter.email,
          totalAmount,
          transactionResult.data.reference,
          property.owner.subaccount!.subaccountCode!,
          property.owner.subaccount!.percentageCharge,
          100 - property.owner.subaccount!.percentageCharge
        );

        if (!paystackResponse.data?.status) {
          throw new Error(paystackResponse.message);
        }

        await tx.property.update({
          where: { id: data.propertyId },
          data: { status: PropertyStatus.PENDING_BOOKING },
        });

        const paymentUrl = paystackResponse.data?.data.authorization_url;
        if (!paymentUrl) throw new Error("Failed to get payment URL");

        await this.sendNotificationsOnBooking({
          booking,
          renter,
          property,
          totalAmount: totalAmount.toNumber(),
          platformFee,
          paymentUrl,
        });

        return this.success({ booking, paymentUrl });
      });
    } catch (error) {
      return this.handleError(error, "createBooking");
    }
  }

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
          transactions: true,
          units: { include: { unit: true } }
        },
      });

      if (!booking) {
        return this.failure("Booking not found");
      }

      if (status === BookingStatus.CONFIRMED && booking.property.ownerId !== userId) {
        return this.failure("Only the property owner can confirm bookings");
      }

      if (status === BookingStatus.CANCELLED && 
          booking.property.ownerId !== userId && 
          booking.renterId !== userId) {
        return this.failure("Only the property owner or renter can cancel bookings");
      }

      if (booking.status !== BookingStatus.PENDING) {
        return this.failure(`Cannot change booking status from ${booking.status} to ${status}`);
      }

      return await this.prisma.$transaction(async (tx) => {
        const updatedBooking = await this.bookingRepo.updateStatus(bookingId, status);

        if (status === BookingStatus.CONFIRMED) {
          await tx.property.update({
            where: { id: booking.propertyId },
            data: { status: PropertyStatus.RENTED },
          });

          await this.notificationService.createNotification({
            userId: booking.renterId,
            title: "Booking Confirmed",
            message: `Your booking for ${booking.property.title} has been confirmed.`,
            type: NotificationType.BOOKING_CONFIRMED,
            data: {
              bookingId: booking.id,
              propertyId: booking.propertyId,
              propertyTitle: booking.property.title
            }
          });
        } else if (status === BookingStatus.CANCELLED) {
          const notification = userId === booking.property.ownerId
            ? {
                userId: booking.renterId,
                title: "Booking Rejected",
                message: `Your booking for ${booking.property.title} has been rejected.`,
                type: NotificationType.BOOKING_CANCELLED,
                data: { bookingId: booking.id }
              }
            : {
                userId: booking.property.ownerId,
                title: "Booking Cancelled",
                message: `A booking for ${booking.property.title} has been cancelled by the renter.`,
                type: NotificationType.BOOKING_CANCELLED,
                data: { bookingId: booking.id }
              };

          await this.notificationService.createNotification(notification);
        }

        return this.success({ booking: updatedBooking });
      });
    } catch (error) {
      return this.handleError(error, "updateBookingStatus");
    }
  }

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
                include: {
                  owner: {
                    include: { subaccount: true }
                  }
                }
              },
              renter: true,
              units: { include: { unit: true } }
            } 
          }, 
          user: true 
        },
      });

      if (
        !transaction ||
        transaction.userId !== userId ||
        transaction.status !== TransactionStatus.PENDING
      ) {
        return this.failure("Invalid transaction");
      }

      const paystackResponse = await this.paystackService.verifyPayment(reference);
      
      if (
        !paystackResponse.data || 
        !paystackResponse.data.data ||
        paystackResponse.data.data.status !== "success"
      ) {
        return this.failure(`Payment verification failed: ${paystackResponse.message}`);
      }

      if (new Decimal(paystackResponse.data?.data.amount).div(100).toNumber() !== new Decimal(transaction.amount).toNumber()) {
        return this.failure("Payment amount mismatch");
      }

      return await this.prisma.$transaction(async (tx) => {
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: { 
            status: TransactionStatus.COMPLETED,
            processedAt: new Date() 
          },
          include: {
            booking: {
              include: {
                property: { include: { owner: true } },
                renter: true,
                units: { include: { unit: true } }
              }
            },
            user: true
          }
        });

        if (!updatedTransaction.booking) {
          throw new Error("Booking not found for transaction");
        }

        const metadata = transaction.metadata as any;
        
        if (metadata?.platformFee > 0) {
          await this.platformFeeService.recordPlatformFeeCollection(
            metadata.baseAmount,
            metadata.platformFee,
            transaction.bookingId!,
            userId,
            metadata.subaccountCode
          );
        }

        await this.bookingRepo.updateStatus(
          transaction.bookingId!,
          BookingStatus.CONFIRMED
        );

        await tx.property.update({
          where: { id: updatedTransaction.booking.propertyId },
          data: { status: PropertyStatus.RENTED },
        });

        if (updatedTransaction.booking) {
          await tx.auditLog.create({
            data: {
              userId: updatedTransaction.booking.property.ownerId,
              action: "PAYMENT_SPLIT_RECEIVED",
              resource: "transactions",
              resourceId: transaction.id,
              oldValues: {},
              newValues: {
                subaccountCode: metadata.subaccountCode,
                ownerAmount: (metadata.baseAmount * metadata.ownerPercentage) / 100,
                platformAmount: (metadata.baseAmount * metadata.platformPercentage) / 100,
                platformFee: metadata.platformFee,
                totalAmount: transaction.amount,
              },
            },
          });
        }

        const notificationPayload = {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          userId: updatedTransaction.userId,
          bookingId: updatedTransaction.bookingId,
          booking: updatedTransaction.booking,
          user: updatedTransaction.user
        };

        await this.sendNotificationsOnPaymentConfirmed(notificationPayload, metadata);

        await this.notificationService.createNotification({
          userId: updatedTransaction.booking.property.ownerId,
          title: "Payment Received",
          message: `Payment of ₦${((metadata.baseAmount * metadata.ownerPercentage) / 100).toLocaleString()} has been automatically transferred to your account for booking ${updatedTransaction.booking.id}`,
          type: NotificationType.PAYMENT_RECEIVED,
          data: {
            bookingId: updatedTransaction.bookingId,
            amount: (metadata.baseAmount * metadata.ownerPercentage) / 100,
            transactionId: transaction.id,
          },
        });

        return this.success({ success: true });
      });
    } catch (error) {
      return this.handleError(error, "confirmBookingPayment");
    }
  }

  async getUserBookings(
    input: GetUserBookingsInput
  ): Promise<ServiceResponse<PaginatedBookingResponse>> {
    const {
      targetUserId,
      currentUserRole,
      currentUserId,
      page = 1,
      limit = 10,
      status
    } = input;

    try {
      if (currentUserRole !== RoleEnum.ADMIN && currentUserId && currentUserId !== targetUserId) {
        return this.failure('Unauthorized: You can only view your own bookings');
      }

      const { bookings, totalCount } = await this.bookingRepo.findUserBookings(
        targetUserId,
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
          limit
        }
      });
    } catch (error) {
      return this.handleError(error, "getUserBookings");
    }
  }

  async getUserBookingById(
    bookingId: string,
    userId: string
  ): Promise<ServiceResponse<Booking>> {
    try {
      const booking = await this.bookingRepo.findById(bookingId);
      if (!booking) return this.failure("Booking not found");

      const property = await this.propertyRepo.findById(booking.propertyId);
      if (!property) return this.failure("Property not found");

      const isOwner = property.ownerId === userId;
      const isRenter = booking.renterId === userId;
      if (!isOwner && !isRenter) {
        return this.failure("Unauthorized");
      }

      return this.success(booking, "Booking retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getBookingById");
    }
  }

  private async sendNotificationsOnBooking(data: BookingNotification) {
    const { booking, renter, property, totalAmount, platformFee, paymentUrl } = data;
    await Promise.all([
      this.notificationService.createNotification({
        userId: renter.id,
        title: "Booking Created",
        message: `Your booking for ${property.title} has been created. Complete payment: ₦${totalAmount}`,
        type: NotificationType.PROPERTY_INQUIRY,
        data: {
          bookingId: booking.id,
          paymentUrl,
          totalAmount,
          platformFee,
        },
      }),
      this.notificationService.createNotification({
        userId: property.ownerId,
        title: "New Booking Request",
        message: `${renter.firstName} ${renter.lastName} has requested to book ${property.title}`,
        type: NotificationType.PROPERTY_INQUIRY,
        data: { bookingId: booking.id },
      })
    ]);
  }

  private async sendNotificationsOnPaymentConfirmed(
    transaction: {
      id: string;
      amount: number;
      userId: string | null;
      bookingId: string | null;
      booking: Booking & { property: Property; renter: User };
      user: User | null;
    },
    metadata: { baseAmount?: number; platformFee?: number } = {}
  ) {
    if (!transaction.bookingId) {
      throw new Error(`No booking ID associated with transaction ${transaction.id}`);
    }

    const userId = transaction.userId || transaction.booking.renterId;
    await Promise.all([
      this.notificationService.createNotification({
        userId,
        title: "Payment Confirmed",
        message: `Your payment of ₦${transaction.amount} has been confirmed. Booking is now active.`,
        type: NotificationType.PAYMENT_CONFIRMED,
        data: { 
          bookingId: transaction.bookingId, 
          amount: transaction.amount,
          transactionId: transaction.id
        },
      }),
      this.notificationService.createNotification({
        userId: transaction.booking.property.ownerId,
        title: "Booking Payment Received",
        message: `Payment of ₦${(metadata?.baseAmount || transaction.amount).toLocaleString()} received for your property "${transaction.booking.property.title}". Payment has been processed and split automatically.`,
        type: NotificationType.PAYMENT_CONFIRMED,
        data: { 
          bookingId: transaction.bookingId, 
          amount: metadata?.baseAmount || transaction.amount,
          transactionId: transaction.id
        },
      })
    ]);
  }

  private async sendNotificationsOnBookingComplete(
    booking: Booking & { property: Property; renter: User }
  ) {
    await Promise.all([
      this.notificationService.createNotification({
        userId: booking.property.ownerId,
        title: "Booking Completed",
        message: `Booking ${booking.id} has been completed. Funds will be released in 24 hours.`,
        type: NotificationType.SYSTEM_UPDATE,
        data: { bookingId: booking.id },
      }),
      this.notificationService.createNotification({
        userId: booking.renterId,
        title: "Booking Completed",
        message: `Your booking for ${booking.property.title} has been completed.`,
        type: NotificationType.SYSTEM_UPDATE,
        data: { bookingId: booking.id },
      })
    ]);
  }

  async handlePaymentWebhook(
    event: { event: string; data: { reference: string } }
  ): Promise<ServiceResponse<{ success: boolean }>> {
    try {
      if (event.event !== "charge.success") {
        return this.success({ success: true, message: "Event ignored" });
      }

      const reference = event.data.reference;
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
        include: { 
          booking: { 
            include: { 
              property: { include: { owner: true } },
              renter: true,
              units: { include: { unit: true } }
            } 
          }, 
          user: true 
        },
      });

      if (!transaction || transaction.status !== TransactionStatus.PENDING) {
        return this.failure("Invalid or already processed transaction");
      }

      const paystackResponse = await this.paystackService.verifyPayment(reference);
      if (
        !paystackResponse.data || 
        !paystackResponse.data.data ||
        paystackResponse.data.data.status !== "success"
      ) {
        return this.failure(`Payment verification failed: ${paystackResponse.message}`);
      }

      if (new Decimal(paystackResponse.data?.data.amount).div(100).toNumber() !== new Decimal(transaction.amount).toNumber()) {
        return this.failure("Payment amount mismatch");
      }

      return await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.PROCESSING },
        });

        await tx.booking.update({
          where: { id: transaction.bookingId! },
          data: { status: BookingStatus.CONFIRMED },
        });

        const booking = await tx.booking.findUnique({
          where: { id: transaction.bookingId! },
          include: { 
            property: { include: { owner: true } },
            renter: true,
            units: { include: { unit: true } }
          },
        });

        await Promise.all([
          this.notificationService.createNotification({
            userId: transaction.userId || transaction.booking!.renterId,
            title: "Payment Confirmed",
            message: `Your payment of ${transaction.amount} NGN for booking ${transaction.bookingId} has been confirmed.`,
            type: NotificationType.PAYMENT_CONFIRMED,
            data: {
              bookingId: transaction.bookingId,
              amount: transaction.amount,
            },
          }),
          booking && this.notificationService.createNotification({
            userId: booking.property.ownerId,
            title: "New Booking Payment",
            message: `A payment of ${transaction.amount} NGN has been confirmed for your property ${booking.property.title}.`,
            type: NotificationType.PAYMENT_CONFIRMED,
            data: {
              bookingId: transaction.bookingId,
              amount: transaction.amount,
            },
          })
        ].filter(Boolean));

        return this.success({ success: true, message: "Webhook processed successfully" });
      });
    } catch (error) {
      return this.handleError(error, "handlePaymentWebhook");
    }
  }
}
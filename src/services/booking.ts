// services/BookingService.ts

import { Booking, BookingStatus, NotificationType, PrismaClient, Property, PropertyStatus, RoleEnum, Transaction, TransactionStatus, TransactionType, User } from "@prisma/client";
import { Redis } from "ioredis";
import { BookingNotification } from "../types/services/notification";
import { BaseService } from "./base";
import { BookingRepository } from "../repository/booking";
import { TransactionService } from "./transaction";
import { WalletService } from "./wallet";
import { PaystackService } from "./payment";
import { NotificationService } from "./notification";
import { PlatformFeeService } from "./platform-service";
import { CreateBookingInput } from "../types/services/booking";
import { WalletRepository } from "../repository/wallet";
import { PropertyRepository } from "../repository/properties";
import { UserRepository } from "../repository/user";

export class BookingService extends BaseService {
  private bookingRepo: BookingRepository;
  private transactionService: TransactionService;
  private walletRepo: WalletRepository;
  private walletService: WalletService;
  private paystackService: PaystackService;
  private notificationService: NotificationService;
  private platformFeeService: PlatformFeeService;
  private userRepo: UserRepository;
  private propertyRepo: PropertyRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.bookingRepo = new BookingRepository(prisma, redis);
    this.transactionService = new TransactionService(prisma, redis);
    this.walletRepo = new WalletRepository(prisma, redis);
    this.walletService = new WalletService(prisma, redis);
    this.paystackService = new PaystackService(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
    this.platformFeeService = new PlatformFeeService(prisma, redis);
    this.userRepo = new UserRepository(prisma, redis);
    this.propertyRepo = new PropertyRepository(prisma, redis);
  }

  async createBooking(data: CreateBookingInput, renterId: string) {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: data.propertyId },
        include: { owner: true },
      });
      if (!property) return this.failure("Property not found");
      if (property.status !== PropertyStatus.ACTIVE)
        return this.failure("Property not available");

      const days = data.endDate
        ? Math.ceil(
            (data.endDate.getTime() - data.startDate.getTime()) /
              (1000 * 3600 * 24)
          )
        : 30;

      const baseAmount = (property.amount / 30) * days;
      const platformFee = await this.platformFeeService.calculatePlatformFee(
        baseAmount
      );
      const totalAmount = baseAmount + platformFee;

      return await this.prisma.$transaction(async (tx) => {
        const booking = await this.bookingRepo.create({
          renterId,
          propertyId: data.propertyId,
          startDate: data.startDate,
          endDate: data.endDate,
          amount: baseAmount,
          status: BookingStatus.PENDING,
        });

        const renter = await tx.user.findUnique({ where: { id: renterId } });
        if (!renter) throw new Error("Renter not found");

        const transactionData = {
          type: TransactionType.RENT_PAYMENT,
          amount: totalAmount,
          currency: "NGN",
          description: `Payment for booking ${booking.id} (includes platform fee)`,
          userId: renterId,
          propertyId: data.propertyId,
          bookingId: booking.id,
          metadata: { baseAmount, platformFee },
        };

        const transactionResult =
          await this.transactionService.createTransaction(
            transactionData,
            renterId
          );
        if (!transactionResult.success)
          throw new Error(transactionResult.message);

        const paystackResponse = await this.paystackService.initializePayment(
          renter.email,
          totalAmount,
          transactionResult.data.reference
        );
        if (!paystackResponse.data?.status) throw new Error(paystackResponse.message);

        await tx.booking.update({
          where: { id: booking.id },
          data: { escrowTransactionId: transactionResult.data.id },
        });

        await tx.property.update({
          where: { id: data.propertyId },
          data: { status: "PENDING_BOOKING" },
        });

        const paymentUrl = paystackResponse.data?.data.authorization_url;

        await this.sendNotificationsOnBooking({
          booking,
          renter,
          property,
          totalAmount,
          platformFee,
          paymentUrl,
        });

        return { booking, paymentUrl };
      });
    } catch (error) {
      return this.handleError(error, "createBooking");
    }
  }

  async confirmBookingPayment(reference: string, userId: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
        include: { booking: { include: { property: true } }, user: true },
      });

      if (
        !transaction ||
        transaction.userId !== userId ||
        transaction.status !== "PENDING"
      ) {
        return this.failure("Invalid transaction");
      }

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

      if (paystackResponse.data?.data.amount / 100 !== transaction.amount) {
        return this.failure("Payment amount mismatch");
      }

      return await this.prisma.$transaction(async (tx) => {
        // First update the transaction status
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "HELD", processedAt: new Date() },
          include: {
            booking: {
              include: {
                property: true,
                renter: true
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
          await this.platformFeeService.chargePlatformFee(
            metadata.baseAmount,
            transaction.bookingId!,
            userId
          );
        }

        await this.bookingRepo.updateStatus(
          transaction.bookingId!,
          "CONFIRMED"
        );

        await tx.property.update({
          where: { id: updatedTransaction.booking.propertyId },
          data: { status: "RENTED" },
        });

        // Prepare the notification payload with proper typing
        const notificationPayload = {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          userId: updatedTransaction.userId,
          bookingId: updatedTransaction.bookingId,
          booking: updatedTransaction.booking,
          user: updatedTransaction.user
        };

        await this.sendNotificationsOnPaymentConfirmed(notificationPayload, metadata);

        return true;
      });
    } catch (error) {
      return this.handleError(error, "confirmBookingPayment");
    }
  }

  async completeBooking(bookingId: string, userId: string) {
    try {
      // Explicitly type the booking with its relations
      type BookingWithRelations = Booking & {
        property: Property;
        renter: User;
      };

      // Fetch the booking with required relations
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          property: true,
          renter: true
        }
      }) as unknown as BookingWithRelations | null;

      if (!booking) {
        return this.failure("Booking not found");
      }

      // Verify required relations exist
      if (!booking.property) {
        return this.failure("Booking property not found");
      }
      
      if (!booking.renter) {
        return this.failure("Booking renter information not found");
      }

      // Authorization check
      if (booking.renterId !== userId && booking.property.ownerId !== userId) {
        return this.failure("Unauthorized");
      }

      if (booking.status !== BookingStatus.CONFIRMED) {
        return this.failure("Booking cannot be completed");
      }

      return await this.prisma.$transaction(async (tx) => {
        // Update booking status
        await this.bookingRepo.updateStatus(bookingId, "COMPLETED");

        // Update property status
        await tx.property.update({
          where: { id: booking.propertyId },
          data: { status: "ACTIVE" },
        });

        // Send notification with properly typed booking object
        await this.sendNotificationsOnBookingComplete(booking);

        return true;
      });
    } catch (error) {
      return this.handleError(error, "completeBooking");
    }
  }

  async getUserBookings(
    targetUserId: string, 
    currentUserRole?: RoleEnum,
    currentUserId?: string
  ) {
    try {
      // If the requester is not an admin and is trying to access someone else's bookings
      if (currentUserRole !== 'ADMIN' && currentUserId && currentUserId !== targetUserId) {
        return this.failure('Unauthorized: You can only view your own bookings');
      }
      
      const bookings = await this.bookingRepo.findUserBookings(targetUserId, currentUserRole);
      return this.success(bookings);
    } catch (error) {
      return this.handleError(error, "getUserBookings");
    }
  }

  async getUserBookingById(bookingId: string, userId: string) {
    try {
      const booking = await this.bookingRepo.findById(bookingId);
      if (!booking) return this.failure("Booking not found");

      // Get property with owner information
      const property = await this.propertyRepo.findById(booking.propertyId);
      if (!property) {
        return this.failure("Property not found");
      }

      // Authorization check
      const isOwner = property.ownerId === userId;
      const isRenter = booking.renterId === userId;
      if (!isOwner && !isRenter) {
        return this.failure("Unauthorized");
      }

      return this.success(booking);
    } catch (error) {
      return this.handleError(error, "getBookingById");
    }
  }

  private async sendNotificationsOnBooking(data: BookingNotification) {
    const { booking, renter, property, totalAmount, platformFee, paymentUrl } =
      data;
    await this.notificationService.createNotification({
      userId: renter.id,
      title: "Booking Created",
      message: `Your booking for ${property.title} has been created. Complete payment: ₦${totalAmount}`,
      type: "PROPERTY_INQUIRY",
      data: {
        bookingId: booking.id,
        paymentUrl,
        totalAmount,
        platformFee,
      },
    });

    await this.notificationService.createNotification({
      userId: property.ownerId,
      title: "New Booking Request",
      message: `${renter.firstName} ${renter.lastName} has requested to book ${property.title}`,
      type: "PROPERTY_INQUIRY",
      data: { bookingId: booking.id },
    });
  }

  private async sendNotificationsOnPaymentConfirmed(
    transaction: {
      id: string;
      amount: number;
      userId: string | null;
      bookingId: string | null;
      booking: Booking & {
        property: Property;
        renter: User;
      };
      user: User | null;
    },
    metadata: { baseAmount?: number; platformFee?: number } = {}
  ) {
    if (!transaction.bookingId) {
      console.error('No booking ID associated with transaction', transaction.id);
      return;
    }

    const userId = transaction.userId || transaction.booking.renterId;
    await this.notificationService.createNotification({
      userId,
      title: "Payment Confirmed",
      message: `Your payment of ₦${transaction.amount} has been confirmed. Booking is now active.`,
      type: "PAYMENT_CONFIRMED",
      data: { 
        bookingId: transaction.bookingId, 
        amount: transaction.amount,
        transactionId: transaction.id
      },
    });

    await this.notificationService.createNotification({
      userId: transaction.booking.property.ownerId,
      title: "Booking Payment Received",
      message: `Payment of ₦${
        metadata?.baseAmount || transaction.amount
      } received for your property "${transaction.booking.property.title}". Funds are currently held in escrow.`,
      type: "PAYMENT_CONFIRMED", // Using PAYMENT_CONFIRMED as it's a valid notification type
      data: { 
        bookingId: transaction.bookingId, 
        amount: metadata?.baseAmount || transaction.amount,
        transactionId: transaction.id
      },
    });
  }

  private async sendNotificationsOnBookingComplete(booking: Booking & { property: Property; renter: User }) {
    await this.notificationService.createNotification({
      userId: booking.property.ownerId,
      title: "Booking Completed",
      message: `Booking ${booking.id} has been completed. Funds will be released in 24 hours.`,
      type: "SYSTEM_UPDATE",
      data: { bookingId: booking.id },
    });

    await this.notificationService.createNotification({
      userId: booking.renterId,
      title: "Booking Completed",
      message: `Your booking for ${booking.property.title} has been completed.`,
      type: "SYSTEM_UPDATE",
      data: { bookingId: booking.id },
    });
  }
  async handlePaymentWebhook(event: { event: string; data: { reference: string } }) {
    try {
      if (event.event !== "charge.success") {
        return { success: true, message: "Event ignored" }; // Handle only successful payments
      }

      const reference = event.data.reference;
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
        include: { booking: true, user: true },
      });
      if (!transaction || transaction.status !== "PENDING") {
        return this.failure("Invalid or already processed transaction");
      }

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

      if (paystackResponse.data?.data.amount / 100 !== transaction.amount) {
        return this.failure("Payment amount mismatch");
      }

      return await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "HELD" },
        });

        await tx.booking.update({
          where: { id: transaction.bookingId! },
          data: { status: "CONFIRMED" },
        });

        await this.notificationService.createNotification({
          userId: transaction.userId || transaction.booking!.renterId,
          title: "Payment Confirmed",
          message: `Your payment of ${transaction.amount} NGN for booking ${transaction.bookingId} has been confirmed.`,
          type: "PAYMENT_CONFIRMED",
          data: {
            bookingId: transaction.bookingId,
            amount: transaction.amount,
          },
        });

        const booking = await tx.booking.findUnique({
          where: { id: transaction.bookingId! },
          include: { property: true },
        });
        if (booking) {
          await this.notificationService.createNotification({
            userId: booking.property.ownerId,
            title: "New Booking Payment",
            message: `A payment of ${transaction.amount} NGN has been confirmed for your property ${booking.property.title}.`,
            type: "PAYMENT_CONFIRMED",
            data: {
              bookingId: transaction.bookingId,
              amount: transaction.amount,
            },
          });
        }

        return { success: true, message: "Webhook processed successfully" };
      });
    } catch (error) {
      return this.handleError(error, "handlePaymentWebhook");
    }
  }

  async releaseEscrow(bookingId: string, adminId: string) {
    type BookingWithTransactions = Booking & { 
      property: Property;
      transactions: Transaction[];
      escrowTransactionId: string | null;
    };
    try {
      const booking = await this.bookingRepo.findById(bookingId);
      const bookingWithTransactions = booking as BookingWithTransactions;
      if (!bookingWithTransactions || bookingWithTransactions.status !== BookingStatus.COMPLETED)
        return this.failure("Invalid booking for release");

      const escrowTx = bookingWithTransactions.transactions.find(
        (t) => t.id === bookingWithTransactions.escrowTransactionId
      );
      if (!escrowTx || escrowTx.status !== TransactionStatus.HELD)
        return this.failure("No held escrow");

      return await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: escrowTx.id },
          data: { status: "RELEASED" },
        });

        const walletResult = await this.walletService.getWallet(
          bookingWithTransactions.property.ownerId
        );
        if (!walletResult.success) throw new Error(walletResult.message);

        await this.walletRepo.updateBalance(
          bookingWithTransactions.property.ownerId,
          bookingWithTransactions.amount,
          "ESCROW_RELEASE",
          `Release for booking ${bookingWithTransactions.id}`,
          escrowTx.id
        );

        await this.notificationService.createNotification({
          userId: bookingWithTransactions.property.ownerId,
          title: "Escrow Released",
          message: `Funds of ${bookingWithTransactions.amount} NGN for booking ${bookingWithTransactions.id} have been released to your wallet.`,
          type: "ESCROW_RELEASED",
          data: { bookingId: bookingWithTransactions.id, amount: bookingWithTransactions.amount },
        });

        return true;
      });
    } catch (error) {
      return this.handleError(error, "releaseEscrow");
    }
  }
}

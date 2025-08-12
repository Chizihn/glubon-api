import {
  PrismaClient,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { NotificationService } from "./notification";

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  userId: string;
  propertyId?: string;
  bookingId?: string;
  metadata?: any;
}

export class TransactionService extends BaseService {
  private notificationService: NotificationService;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
  }

  async createTransaction(data: CreateTransactionInput, userId: string) {
    try {
      const reference = this.generateReference("TXN");
      const transaction = await this.prisma.transaction.create({
        data: {
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          userId,
          propertyId: data.propertyId || "",
          bookingId: data.bookingId || "",
          status: TransactionStatus.PENDING,
          reference,
          metadata: data.metadata,
        },
        include: {
          user: true,
          property: true,
          booking: true,
        },
      });

      await this.deleteCachePattern(`transaction:${reference}`);
      await this.deleteCachePattern(`transactions:user:${userId}`);

      // Notify user based on transaction type
      if (data.type === "RENT_PAYMENT") {
        await this.notificationService.createNotification({
          userId,
          title: "Transaction Initiated",
          message: `A new transaction of ${data.amount} NGN for ${data.description} has been initiated.`,
          type: "BOOKING_CREATED", // Align with booking creation
          data: {
            transactionId: transaction.id,
            bookingId: data.bookingId,
            amount: data.amount,
          },
        });
      } else if (data.type === "WITHDRAWAL") {
        await this.notificationService.createNotification({
          userId,
          title: "Withdrawal Transaction Initiated",
          message: `A withdrawal transaction of ${data.amount} NGN has been initiated.`,
          type: "WITHDRAWAL_REQUESTED",
          data: { transactionId: transaction.id, amount: data.amount },
        });
      }

      return this.success(transaction, "Transaction created successfully");
    } catch (error) {
      return this.handleError(error, "createTransaction");
    }
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    metadata: any = {},
    updatedBy: string
  ) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { user: true, booking: { include: { property: true } } },
      });
      if (!transaction) {
        return this.failure("Transaction not found");
      }

      // Safely handle metadata spreading
      const existingMetadata = transaction.metadata && typeof transaction.metadata === 'object' 
        ? transaction.metadata as Record<string, any>
        : {};
      
      const newMetadata = metadata && typeof metadata === 'object' 
        ? metadata as Record<string, any>
        : {};

      const updatedTransaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status,
          metadata: { ...existingMetadata, ...newMetadata },
          updatedAt: new Date(),
        },
        include: {
          user: true,
          booking: true,
          property: true,
        },
      });

      await this.deleteCachePattern(`transaction:${transaction.reference}`);
      await this.deleteCachePattern(`transactions:user:${transaction.userId}`);

      // Notify user based on status change
      if (status === "HELD" && transaction.type === "RENT_PAYMENT") {
        await this.notificationService.createNotification({
          userId: transaction.userId as string,
          title: "Payment Held in Escrow",
          message: `Your payment of ${transaction.amount} NGN for booking ${transaction.bookingId} is now held in escrow.`,
          type: "PAYMENT_CONFIRMED",
          data: {
            transactionId,
            bookingId: transaction.bookingId,
            amount: transaction.amount,
          },
        });

        if (transaction.booking?.property) {
          await this.notificationService.createNotification({
            userId: transaction.booking.property.ownerId,
            title: "Payment Received",
            message: `A payment of ${transaction.amount} NGN for your property ${transaction.booking.property.title} is now held in escrow.`,
            type: "PAYMENT_CONFIRMED",
            data: {
              transactionId,
              bookingId: transaction.bookingId,
              amount: transaction.amount,
            },
          });
        }
      } else if (
        status === "COMPLETED" &&
        transaction.type === TransactionType.WITHDRAWAL
      ) {
        await this.notificationService.createNotification({
          userId: transaction.userId || "",
          title: "Withdrawal Approved",
          message: `Your withdrawal of ${transaction.amount} NGN has been approved.`,
          type: "WITHDRAWAL_APPROVED",
          data: { transactionId, amount: transaction.amount },
        });
      } else if (status === "REFUNDED") {
        await this.notificationService.createNotification({
          userId: transaction.userId || "",
          title: "Refund Processed",
          message: `A refund of ${transaction.amount} NGN has been processed for transaction ${transactionId}.`,
          type: "REFUND_PROCESSED",
          data: { transactionId, amount: transaction.amount },
        });
      }

      return this.success(
        updatedTransaction,
        "Transaction status updated successfully"
      );
    } catch (error) {
      return this.handleError(error, "updateTransactionStatus");
    }
  }

  private generateReference(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }
}
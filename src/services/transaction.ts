import {
  PrismaClient,
  TransactionStatus,
  TransactionType,
  PaymentGateway,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { NotificationService } from "./notification";

export interface CreateTransactionInput {
  type: TransactionType;
  amount: Decimal | number;
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
          amount: typeof data.amount === 'number' ? new Prisma.Decimal(data.amount) : data.amount,
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
          message: `A new transaction of ${new Decimal(data.amount).toNumber()} NGN for ${data.description} has been initiated.`,
          type: "BOOKING_CREATED", // Align with booking creation
          data: {
            transactionId: transaction.id,
            bookingId: data.bookingId,
            amount: new Decimal(data.amount).toNumber(),
          },
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
      if (status === "COMPLETED" && transaction.type === "RENT_PAYMENT") {
        await this.notificationService.createNotification({
          userId: transaction.userId as string,
          title: "Payment Confirmed",
          message: `Your payment of ${new Decimal(transaction.amount).toNumber()} NGN for booking ${transaction.bookingId} has been confirmed.`,
          type: "PAYMENT_CONFIRMED",
          data: {
            transactionId,
            bookingId: transaction.bookingId,
            amount: new Decimal(transaction.amount).toNumber(),
          },
        });

        if (transaction.booking?.property) {
          await this.notificationService.createNotification({
            userId: transaction.booking.property.ownerId,
            title: "Payment Received",
            message: `A payment of ${new Decimal(transaction.amount).toNumber()} NGN for your property ${transaction.booking.property.title} has been received and split automatically.`,
            type: "PAYMENT_RECEIVED",
            data: {
              transactionId,
              bookingId: transaction.bookingId,
              amount: new Decimal(transaction.amount).toNumber(),
            },
          });
        }
      } else if (status === "REFUNDED") {
        await this.notificationService.createNotification({
          userId: transaction.userId || "",
          title: "Refund Processed",
          message: `A refund of ${new Decimal(transaction.amount).toNumber()} NGN has been processed for transaction ${transactionId}.`,
          type: "REFUND_PROCESSED",
          data: { transactionId, amount: new Decimal(transaction.amount).toNumber() },
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

  /**
   * Notify user about transaction status change
   */
  private async notifyUserAboutTransaction(
    transaction: any,
    additionalMessage: string = ''
  ) {
    if (!transaction.userId) return;

    const amountStr = `${transaction.amount} ${transaction.currency}`;
    let title = 'Transaction Update';
    let message = `Your transaction ${transaction.reference} for ${amountStr} `;
    let type = 'TRANSACTION_UPDATE';

    switch (transaction.status) {
      case 'COMPLETED':
        title = 'Transaction Completed';
        message += 'has been completed successfully.';
        type = 'TRANSACTION_COMPLETED';
        break;
      case 'FAILED':
        title = 'Transaction Failed';
        message += 'has failed.';
        if (transaction.failureReason) {
          message += ` Reason: ${transaction.failureReason}`;
        }
        type = 'TRANSACTION_FAILED';
        break;
      case 'PENDING':
        title = 'Transaction Pending';
        message += 'is pending processing.';
        type = 'TRANSACTION_PENDING';
        break;
      case 'REFUNDED':
        title = 'Refund Processed';
        message = `A refund of ${amountStr} has been processed for transaction ${transaction.reference}.`;
        type = 'TRANSACTION_REFUNDED';
        break;
      default:
        message += `status has been updated to ${transaction.status}.`;
    }

    if (additionalMessage) {
      message += ` ${additionalMessage}`;
    }

    await this.notificationService.createNotification({
      userId: transaction.userId,
      title,
      message,
      type: type as any,
      data: {
        transactionId: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
      },
    });
  }

  /**
   * Get a transaction by ID
   */
  async getTransactionById(transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          property: true,
          booking: true,
        },
      });

      if (!transaction) {
        return this.failure('Transaction not found');
      }

      return this.success(transaction, 'Transaction retrieved successfully');
    } catch (error) {
      return this.handleError(error, 'getTransactionById');
    }
  }

  /**
   * Get all transactions for a user
   */
  async getTransactionsByUser(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const skip = (page - 1) * limit;
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            property: true,
            booking: true,
          },
        }),
        this.prisma.transaction.count({ where: { userId } }),
      ]);

      return this.success(
        {
          transactions,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
        'User transactions retrieved successfully'
      );
    } catch (error) {
      return this.handleError(error, 'getTransactionsByUser');
    }
  }

  /**
   * Get all transactions for a property
   */
  async getTransactionsByProperty(
    propertyId: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const skip = (page - 1) * limit;
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { propertyId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: true,
            booking: true,
          },
        }),
        this.prisma.transaction.count({ where: { propertyId } }),
      ]);

      return this.success(
        {
          transactions,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
        'Property transactions retrieved successfully'
      );
    } catch (error) {
      return this.handleError(error, 'getTransactionsByProperty');
    }
  }

  /**
   * Get all transactions for a booking
   */
  async getTransactionsByBooking(bookingId: string) {
    try {
      const transactions = await this.prisma.transaction.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          property: true,
        },
      });

      return this.success(
        transactions,
        'Booking transactions retrieved successfully'
      );
    } catch (error) {
      return this.handleError(error, 'getTransactionsByBooking');
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(userId?: string) {
    try {
      const where = userId ? { userId } : {};
      
      const [
        total,
        completed,
        pending,
        failed,
        totalAmount,
      ] = await Promise.all([
        this.prisma.transaction.count({ where }),
        this.prisma.transaction.count({
          where: { ...where, status: 'COMPLETED' },
        }),
        this.prisma.transaction.count({
          where: { ...where, status: 'PENDING' },
        }),
        this.prisma.transaction.count({
          where: { ...where, status: 'FAILED' },
        }),
        this.prisma.transaction.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: { amount: true },
        }),
      ]);

      return this.success(
        {
          total,
          completed,
          pending,
          failed,
          totalAmount: totalAmount._sum.amount || 0,
        },
        'Transaction statistics retrieved successfully'
      );
    } catch (error) {
      return this.handleError(error, 'getTransactionStats');
    }
  }

  /**
   * Get transactions with advanced filtering, searching and sorting
   */
  async getTransactions({
    // Pagination
    page = 1,
    limit = 10,
    
    // Filtering
    userId,
    propertyId,
    bookingId,
    adId,
    type,
    status,
    minAmount,
    maxAmount,
    currency,
    gateway,
    paymentMethod,
    startDate,
    endDate,
    
    // Search
    search,
    
    // Sorting
    sortBy = 'createdAt',
    sortOrder = 'desc',
  }: {
    // Pagination
    page?: number;
    limit?: number;
    
    // Filtering
    userId?: string;
    propertyId?: string;
    bookingId?: string;
    adId?: string;
    type?: TransactionType;
    status?: TransactionStatus;
    minAmount?: number;
    maxAmount?: number;
    currency?: string;
    gateway?: PaymentGateway;
    paymentMethod?: string;
    startDate?: Date;
    endDate?: Date;
    
    // Search
    search?: string;
    
    // Sorting
    sortBy?: 'createdAt' | 'updatedAt' | 'amount' | 'type' | 'status';
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      const skip = (page - 1) * limit;
      
      // Build the where clause
      const where: any = {};
      
      // Direct filters
      if (userId) where.userId = userId;
      if (propertyId) where.propertyId = propertyId;
      if (bookingId) where.bookingId = bookingId;
      if (adId) where.adId = adId;
      if (type) where.type = type;
      if (status) where.status = status;
      if (currency) where.currency = currency;
      if (gateway) where.gateway = gateway;
      if (paymentMethod) where.paymentMethod = { contains: paymentMethod, mode: 'insensitive' };
      
      // Amount range
      if (minAmount !== undefined || maxAmount !== undefined) {
        where.amount = {};
        if (minAmount !== undefined && minAmount !== null) where.amount.gte = minAmount;
        if (maxAmount !== undefined && maxAmount !== null) where.amount.lte = maxAmount;
      }
      
      // Date range
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
      
      // Text search
      if (search) {
        where.OR = [
          { reference: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { failureReason: { contains: search, mode: 'insensitive' } },
          { gatewayRef: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      // Build orderBy
      const orderBy = { [sortBy]: sortOrder };
      
      // Execute queries in parallel
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            user: true,
            property: true,
            booking: true,
          },
        }),
        this.prisma.transaction.count({ where }),
      ]);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;
      
      return this.success(
        {
          transactions,
          pagination: {
            total,
            totalPages,
            currentPage: page,
            hasNextPage,
            hasPreviousPage,
            limit,
          },
        },
        'Transactions retrieved successfully'
      );
    } catch (error) {
      return this.handleError(error, 'getTransactions');
    }
  }
  
  /**
   * Verify a transaction with payment gateway
   */
  async verifyTransaction(reference: string) {
    try {
      // Get the transaction
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
      });

      if (!transaction) {
        return this.failure('Transaction not found');
      }

      // If already completed, return the transaction
      if (transaction.status === 'COMPLETED') {
        return this.success(transaction, 'Transaction already verified');
      }

      // In a real implementation, this would call the payment gateway API
      // const gatewayResponse = await paymentGateway.verify(reference);
      
      // Mock response for demonstration
      const gatewayResponse = {
        status: 'success',
        data: {
          status: 'success',
          amount: transaction.amount,
          currency: transaction.currency,
          reference: transaction.reference,
        },
      };

      // Update transaction status based on gateway response
      if (gatewayResponse.status === 'success') {
        const updatedTransaction = await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            metadata: {
              ...(transaction.metadata as object || {}),
              verifiedAt: new Date().toISOString(),
              gatewayResponse,
            },
          },
        });

        // Invalidate caches
        await Promise.all([
          this.deleteCachePattern(`transaction:${reference}`),
          this.deleteCachePattern(`transactions:user:${transaction.userId}`),
        ]);

        return this.success(
          updatedTransaction,
          'Transaction verified and completed successfully'
        );
      }

      return this.failure('Transaction verification failed');
    } catch (error) {
      return this.handleError(error, 'verifyTransaction');
    }
  }
}
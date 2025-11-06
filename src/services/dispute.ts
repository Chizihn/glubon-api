import { BookingStatus, DisputeStatus, PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { NotFoundError } from "../utils";
import { BaseService } from "./base";
import { DisputeRepository } from "../repository/dispute";
import { RefundService } from "./refund";
import { Container } from "../container";
import {
  CreateDisputeInput,
  ResolveDisputeInput,
} from "../types/services/booking";
import { ServiceResponse } from "../types/responses";
import { PaginatedDisputes } from "../modules/dispute/dispute.types";
import { Decimal } from "@prisma/client/runtime/library";

export interface DisputeWithRelations {
  id: string;
  bookingId: string;
  initiatorId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  parentDispute: string | null;
  createdAt: Date;
  updatedAt: Date;
  booking?: any; // Will be populated by the resolver
  initiator?: any; // Will be populated by the resolver
}

export class DisputeService extends BaseService {
  private disputeRepo: DisputeRepository;
  private refundService: RefundService;
  private notificationService: any; // Using any to avoid circular dependency
  
  private logger: Console;

  async getDisputeWithRelations(disputeId: string) {
    try {
      const dispute = await this.prisma.dispute.findUnique({
        where: { id: disputeId },
        include: {
          booking: true,
          initiator: true,
        },
      });

      if (!dispute) {
        throw new NotFoundError('Dispute not found');
      }

      return dispute as unknown as DisputeWithRelations;
    } catch (error) {
      this.logger.error('Error fetching dispute with relations:', error);
      throw error;
    }
  }

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.logger = console;
    this.disputeRepo = new DisputeRepository(prisma, redis);
    this.refundService = new RefundService(prisma, redis);
    const container = Container.getInstance(prisma, redis);
    this.notificationService = container.resolve('notificationService');
  }

  async createDispute(data: CreateDisputeInput, initiatorId: string) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: data.bookingId },
      });
      if (!booking || booking.renterId !== initiatorId)
        return this.failure("Invalid booking");

      if (booking.status === BookingStatus.DISPUTED)
        return this.failure("Booking already disputed");

      return await this.prisma.$transaction(async (tx) => {
        const dispute = await tx.dispute.create({
          data: {
            bookingId: data.bookingId,
            initiatorId,
            reason: data.reason,
            description: data.description,
            status: 'PENDING', // Default status
            resolution: '', // Default empty resolution
            content: '', // Default empty content as it's required
          },
        });

        const property = await this.prisma.property.findUnique({
          where: { id: booking.propertyId },
          include: {
            owner: true,
          },
        });

        if (!property) {
          throw new NotFoundError("Property not found");
        }

        await tx.booking.update({
          where: { id: data.bookingId },
          data: { status: BookingStatus.DISPUTED },
        });

        // Notify initiator
        await this.notificationService.createNotification({
          userId: initiatorId,
          title: "Dispute Created",
          message: `Your dispute for booking ${data.bookingId} has been created.`,
          type: "DISPUTE_CREATED",
          data: { disputeId: dispute.id, bookingId: data.bookingId },
        });

        // Notify other party (renter or lister)
        const otherPartyId =
          booking.renterId === initiatorId
            ? property.ownerId
            : booking.renterId;
        await this.notificationService.createNotification({
          userId: otherPartyId,
          title: "Dispute Initiated",
          message: `A dispute has been initiated for booking ${data.bookingId}.`,
          type: "DISPUTE_CREATED",
          data: { disputeId: dispute.id, bookingId: data.bookingId },
        });

        return dispute;
      });
    } catch (error) {
      return this.handleError(error, "createDispute");
    }
  }

  /**
   * Fetches paginated pending disputes with optional filtering
   */
  async getPendingDisputes(
    page: number = 1,
    limit: number = 10,
    filters: {
      initiatorId?: string;
      bookingId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ServiceResponse<PaginatedDisputes>> {
    try {
      const result = await this.disputeRepo.getPendingDisputes(
        page,
        limit,
        {
          ...filters,
          status: 'PENDING', // Always filter by PENDING status
        }
      );

      return {
        success: true,
        message: 'Pending disputes retrieved successfully',
        data: result as unknown as PaginatedDisputes // Type assertion to handle the complex type
      };
    } catch (error) {
      this.logger.error('Error fetching pending disputes:', error);
      return this.failure('Failed to retrieve pending disputes');
    }
  }


  async resolveDispute(data: ResolveDisputeInput, adminId: string) {
    try {
      const dispute = await this.disputeRepo.findDisputeById(data.disputeId);
      if (!dispute || dispute.status !== DisputeStatus.PENDING)
        return this.failure("Invalid dispute");

      return await this.prisma.$transaction(async (tx) => {
        const updatedDispute = await tx.dispute.update({
          where: { id: data.disputeId },
          data: {
            status: data.status,
            resolution: data.resolution,
            resolvedAt: new Date(),
            resolvedBy: adminId,
          },
        });

        const booking = await tx.booking.findUnique({
          where: { id: dispute.bookingId },
          include: { transactions: true, property: true },
        });
        if (!booking) throw new NotFoundError("Booking not found");

        // Handle refunds if needed - Paystack split is already processed
        if (data.refundAmount && data.status === "RESOLVED") {
          if (new Decimal(data.refundAmount).greaterThan(booking.amount)) {
            throw new Error("Refund amount exceeds booking amount");
          }

          // Find the main payment transaction (check all payment types)
          const paymentTx = booking.transactions.find(
            (t) => ["RENT_PAYMENT", "LEASE_PAYMENT", "SALE_PAYMENT"].includes(t.type) && 
                  t.status === "COMPLETED"
          );
          
          if (!paymentTx) {
            throw new Error("No completed payment transaction found for this booking");
          }

          // Create refund record
          const refundData = {
            transactionId: paymentTx.id,
            amount: data.refundAmount,
            reason: data.resolution,
          };

          const refundResult = await this.refundService.createRefund(
            refundData,
            adminId
          );
          if (!refundResult.success) throw new Error(refundResult.message);

          await this.refundService.processRefund(
            refundResult.data.id,
            "APPROVE",
            adminId
          );

          // Note: With Paystack split payments, refunds should be processed through Paystack's refund API
          // The platform fee portion will be automatically handled by Paystack
          
          // Notify renter
          await this.notificationService.createNotification({
            userId: booking.renterId,
            title: "Refund Processed",
            message: `A refund of ${data.refundAmount} NGN has been processed for dispute ${data.disputeId}.`,
            type: "REFUND_PROCESSED",
            data: { disputeId: data.disputeId, amount: data.refundAmount },
          });

          // Notify lister
          await this.notificationService.createNotification({
            userId: booking.property.ownerId,
            title: "Dispute Refund Processed",
            message: `A refund of ${data.refundAmount} NGN has been processed for dispute ${data.disputeId}. The refund will be handled through Paystack.`,
            type: "REFUND_PROCESSED",
            data: { disputeId: data.disputeId, amount: data.refundAmount },
          });
        }

        await tx.booking.update({
          where: { id: dispute.bookingId },
          data: {
            status: data.status === "RESOLVED" ? "COMPLETED" : "CANCELLED",
          },
        });

        // Notify both parties about dispute resolution
        await this.notificationService.createNotification({
          userId: booking.renterId,
          title: "Dispute Resolved",
          message: `Dispute ${data.disputeId} for booking ${dispute.bookingId} has been resolved: ${data.resolution}`,
          type: "DISPUTE_RESOLVED",
          data: { disputeId: data.disputeId, resolution: data.resolution },
        });

        await this.notificationService.createNotification({
          userId: booking.property.ownerId,
          title: "Dispute Resolved",
          message: `Dispute ${data.disputeId} for booking ${dispute.bookingId} has been resolved: ${data.resolution}`,
          type: "DISPUTE_RESOLVED",
          data: { disputeId: data.disputeId, resolution: data.resolution },
        });

        return updatedDispute;
      });
    } catch (error) {
      return this.handleError(error, "resolveDispute");
    }
  }
}

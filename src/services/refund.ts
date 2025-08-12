// src/services/RefundService.ts
import { NotificationType, PrismaClient, RefundStatus } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { RefundRepository } from "../repository/refund";
import { NotificationService } from "./notification";
import { CreateRefundInput } from "../types/services/booking";

export class RefundService extends BaseService {
  private refundRepo: RefundRepository;
  private notificationService: NotificationService;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.refundRepo = new RefundRepository(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
  }

  async createRefund(data: CreateRefundInput, requestedBy: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: data.transactionId },
        include: { user: true, booking: true },
      });

      if (!transaction) return this.failure("Transaction not found");
      if (transaction.status !== "COMPLETED" && transaction.status !== "HELD") {
        return this.failure("Transaction cannot be refunded");
      }

      const refund = await this.refundRepo.createRefund({
        transactionId: data.transactionId,
        disputeId: data.disputeId,
        amount: data.amount,
        reason: data.reason,
        status: RefundStatus.PENDING,
      });

      await this.notificationService.createNotification({
        userId: transaction.userId!,
        title: "Refund Request Created",
        message: `A refund request of ${data.amount} NGN has been created for transaction ${transaction.reference}`,
        type: NotificationType.REFUND_CREATED,
        data: { refundId: refund.id, transactionId: data.transactionId },
      });

      return this.success(refund, "Refund request created successfully");
    } catch (error) {
      return this.handleError(error, "createRefund");
    }
  }

  async processRefund(
    refundId: string,
    action: "APPROVE" | "REJECT",
    processedBy: string,
    reason?: string
  ) {
    try {
      const refund = await this.refundRepo.findRefundById(refundId);
      if (!refund || refund.status !== RefundStatus.PENDING) {
        return this.failure("Invalid refund request");
      }

      const transaction = await this.prisma.transaction.findUnique({
        where: { id: refund.transactionId },
        include: { user: true, booking: true },
      });

      const status = action === "APPROVE" ? "PROCESSED" : "REJECTED";
      const updatedRefund = await this.refundRepo.updateRefund(refundId, {
        status,
        processedBy,
        processedAt: new Date(),
        rejectionReason: action === "REJECT" ? reason : undefined,
      });

      const notificationTitle =
        action === "APPROVE" ? "Refund Approved" : "Refund Rejected";
      const notificationMessage =
        action === "APPROVE"
          ? `Your refund of ${refund.amount} NGN has been approved and processed`
          : `Your refund request has been rejected. Reason: ${
              reason || "No reason provided"
            }`;

      await this.notificationService.createNotification({
        userId: transaction!.userId!,
        title: notificationTitle,
        message: notificationMessage,
        type: action === "APPROVE" ? "REFUND_APPROVED" : "REFUND_REJECTED",
        data: { refundId, amount: refund.amount },
      });

      return this.success(
        updatedRefund,
        `Refund ${action.toLowerCase()}d successfully`
      );
    } catch (error) {
      return this.handleError(error, "processRefund");
    }
  }
}

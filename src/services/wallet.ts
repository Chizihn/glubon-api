//src/services/payment
import { PrismaClient, TransactionType, WalletTransactionType } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { WalletRepository } from "../repository/wallet";
import { NotificationService } from "./notification";
import { TransactionService } from "./transaction";
import { RequestWithdrawalInput } from "../types/services/wallet-service";

export class WalletService extends BaseService {
  private walletRepo: WalletRepository;
  private transactionService: TransactionService;
  private notificationService: NotificationService;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.walletRepo = new WalletRepository(prisma, redis);
    this.transactionService = new TransactionService(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
  }

  /**
   * Update user's wallet balance and create a transaction record
   * @param userId - ID of the user whose wallet to update
   * @param amount - Amount to update (positive for credit, negative for debit)
   * @param type - Type of transaction
   * @param description - Description of the transaction
   * @param reference - Optional reference ID for the transaction
   */
  async updateBalance(
    userId: string,
    amount: number,
    type: WalletTransactionType,
    description: string,
    reference?: string
  ) {
    try {
      // Update wallet balance
      const result = await this.walletRepo.updateBalance(
        userId,
        amount,
        type,
        description,
        reference
      );

      if (!result || !result.updatedWallet) {
        return this.failure('Failed to update wallet balance');
      }

      const { updatedWallet, walletTransaction } = result;

      // Create transaction record
      const transaction = await this.transactionService.createTransaction(
        {
          type,
          amount: Math.abs(amount),
          currency: updatedWallet.currency,
          description,
          userId,
          metadata: { reference },
        },
        userId
      );

      if (!transaction.success) {
        // Log the error but don't fail the operation
        console.error('Failed to create transaction record:', transaction.message);
      }

      return this.success(updatedWallet);
    } catch (error) {
      console.error('Error updating wallet balance:', error);
      return this.failure('An error occurred while updating wallet balance');
    }
  }

  async requestWithdrawal(data: RequestWithdrawalInput, userId: string) {
    try {
      const wallet = await this.walletRepo.getWalletByUserId(userId);
      if (!wallet) return this.failure("Wallet not found");

      if (wallet.balance < data.amount)
        return this.failure("Insufficient balance");

      const transactionData = {
        type: TransactionType.WITHDRAWAL,
        amount: data.amount,
        currency: wallet.currency,
        description: "Withdrawal request",
        userId,
        metadata: { paymentMethod: data.paymentMethod, details: data.details },
      };

      const transactionResult = await this.transactionService.createTransaction(
        transactionData,
        userId
      );
      if (!transactionResult.success)
        return this.failure(transactionResult.message);

      await this.walletRepo.updateBalance(
        userId,
        data.amount,
        "WITHDRAWAL",
        "Withdrawal request",
        transactionResult.data.id,
        "PENDING"
      );

      // Notify lister
      await this.notificationService.createNotification({
        userId,
        title: "Withdrawal Requested",
        message: `Your withdrawal request of ${data.amount} NGN has been submitted.`,
        type: "WITHDRAWAL_REQUESTED",
        data: { transactionId: transactionResult.data.id, amount: data.amount },
      });

      return this.success(
        transactionResult.data,
        "Withdrawal requested successfully"
      );
    } catch (error) {
      return this.handleError(error, "requestWithdrawal");
    }
  }

  async approveWithdrawal(transactionId: string, adminId: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { user: true },
      });
      if (
        !transaction ||
        transaction.type !== "WITHDRAWAL" ||
        transaction.status !== "PENDING"
      ) {
        return this.failure("Invalid withdrawal transaction");
      }

      const updateResult =
        await this.transactionService.updateTransactionStatus(
          transactionId,
          "COMPLETED",
          {},
          adminId
        );
      if (!updateResult.success) return this.failure(updateResult.message);

      // Notify lister
      await this.notificationService.createNotification({
        userId: transaction.userId as string,
        title: "Withdrawal Approved",
        message: `Your withdrawal of ${transaction.amount} NGN has been approved.`,
        type: "WITHDRAWAL_APPROVED",
        data: { transactionId, amount: transaction.amount },
      });

      return this.success(null, "Withdrawal approved");
    } catch (error) {
      return this.handleError(error, "approveWithdrawal");
    }
  }

  async getWallet(userId: string) {
    const wallet = await this.walletRepo.getWalletByUserId(userId);
    if (!wallet) return this.failure("Wallet not found");
    return this.success(wallet);
  }
}

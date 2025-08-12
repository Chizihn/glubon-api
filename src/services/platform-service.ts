// src/services/PlatformFeeService.ts
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";

export class PlatformFeeService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async calculatePlatformFee(amount: number): Promise<number> {
    // Get platform fee percentage from settings (default 5%)
    const setting = await this.prisma.platformSetting.findFirst({
      where: { key: "PLATFORM_FEE_PERCENTAGE" },
    });

    const feePercentage = setting ? (setting.value as any).percentage : 5;
    return Math.round((amount * feePercentage) / 100);
  }

  async getPlatformAccountId(): Promise<string> {
    const setting = await this.prisma.platformSetting.findFirst({
      where: { key: "PLATFORM_ACCOUNT_ID" },
    });

    if (!setting) {
      // Find super admin user
      const superAdmin = await this.prisma.user.findFirst({
        where: { permissions: { has: "SUPER_ADMIN" } },
      });

      if (!superAdmin) throw new Error("Platform account not configured");
      return superAdmin.id;
    }

    return (setting.value as any).userId;
  }

  async chargePlatformFee(
    transactionAmount: number,
    bookingId: string,
    userId: string
  ) {
    try {
      const platformFee = await this.calculatePlatformFee(transactionAmount);
      if (platformFee <= 0) return { success: true, fee: 0 };

      const platformAccountId = await this.getPlatformAccountId();

      return await this.prisma.$transaction(async (tx) => {
        // Create platform fee transaction
        const feeTransaction = await tx.transaction.create({
          data: {
            type: "PLATFORM_FEE",
            amount: platformFee,
            currency: "NGN",
            status: "COMPLETED",
            reference: this.generateReference("PFEE"),
            description: `Platform fee for booking ${bookingId}`,
            userId: platformAccountId,
            bookingId,
            metadata: {
              originalUserId: userId,
              originalAmount: transactionAmount,
            },
          },
        });

        // Credit platform account wallet
        let platformWallet = await tx.wallet.findUnique({
          where: { userId: platformAccountId },
        });

        if (!platformWallet) {
          platformWallet = await tx.wallet.create({
            data: { userId: platformAccountId, currency: "NGN" },
          });
        }

        await tx.wallet.update({
          where: { id: platformWallet.id },
          data: { balance: { increment: platformFee } },
        });

        // Create wallet transaction
        await tx.walletTransaction.create({
          data: {
            walletId: platformWallet.id,
            amount: platformFee,
            type: "PLATFORM_FEE",
            status: "COMPLETED",
            reference: this.generateReference("WFEE"),
            description: `Platform fee from booking ${bookingId}`,
            relatedTransactionId: feeTransaction.id,
          },
        });

        return {
          success: true,
          fee: platformFee,
          transactionId: feeTransaction.id,
        };
      });
    } catch (error) {
      return this.handleError(error, "chargePlatformFee");
    }
  }

  private generateReference(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }
}

import {
  PrismaClient,
  TransactionStatus,
  Wallet,
  WalletTransactionType,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";

export class WalletRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async getWalletByUserId(userId: string) {
    const cacheKey = this.generateCacheKey("wallet", userId);
    const cached = await this.getCache<Wallet | null>(cacheKey);
    if (cached) return cached;

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: true,
        walletTransactions: true,
      },
    });

    if (wallet) {
      await this.setCache(cacheKey, wallet, 300);
    }

    return wallet;
  }

  async createWalletForUser(userId: string, currency: string = "NGN") {
    const wallet = await this.prisma.wallet.create({
      data: {
        userId,
        currency,
      },
      include: { user: true },
    });

    await this.deleteCachePattern(`wallet:${userId}*`);
    return wallet;
  }

  async updateBalance(
    userId: string,
    amount: number,
    type: WalletTransactionType,
    description: string,
    relatedTransactionId?: string,
    status: TransactionStatus = TransactionStatus.COMPLETED
  ) {
    return await this.prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, currency: "NGN" },
        });
      }

      const increment =
        type === WalletTransactionType.DEPOSIT || type === WalletTransactionType.REFUND ? amount : -amount;
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment } },
      });

      if (updatedWallet.balance < 0) {
        throw new Error("Insufficient balance");
      }

      const reference = this.generateReference("WTX");
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type,
          status,
          reference,
          description,
          relatedTransactionId: relatedTransactionId || "",
        },
      });

      return { updatedWallet, walletTransaction };
    });
  }

  private generateReference(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }
}

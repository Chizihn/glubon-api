import { Prisma, PrismaClient, TransactionStatus, Wallet, WalletTransactionType } from "@prisma/client";
import { Redis } from "ioredis";
import { Decimal } from "@prisma/client/runtime/library";
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
    amount: Decimal | number | string,
    type: WalletTransactionType,
    description: string,
    relatedTransactionId?: string,
    status: TransactionStatus = TransactionStatus.COMPLETED
  ): Promise<{ updatedWallet: Wallet; walletTransaction: any }> {
    return await this.prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, currency: "NGN" },
        });
      }

      const amountValue = new Decimal(amount);
      const increment = type === WalletTransactionType.DEPOSIT || type === WalletTransactionType.REFUND 
        ? amountValue 
        : amountValue.negated();
      // Use Prisma.sql for type-safe raw queries
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Wallet" 
        SET 
          balance = balance + ${increment.toNumber()}::decimal,
          "updatedAt" = NOW()
        WHERE id = ${wallet.id}
      `);

      // Get the updated wallet with the new balance
      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });

      // Verify the balance is not negative
      if (new Decimal(updatedWallet.balance).lessThan(0)) {
        throw new Error("Insufficient balance");
      }

      const reference = this.generateReference("WTX");
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: amountValue.toNumber(),
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

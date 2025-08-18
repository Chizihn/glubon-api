import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { WalletService } from "../../services/wallet";
import {
  Transaction as TransactionType,
  Wallet as WalletType,
} from "@prisma/client";
import { Context } from "../../types";
import { AuthMiddleware } from "../../middleware";
import { 
  RequestWithdrawalInput, 
  PaginatedWalletTransactions, 
  WalletTransactionFilterInput, 
  Wallet
} from "./wallet.types";

import { prisma, redis } from "../../config";
import { MutationRateLimit, QueryRateLimit, SensitiveRateLimit } from "../../graphql/decorators/rateLimit";
import { PaginationInput, Transaction } from "../transaction/transaction.types";

@Resolver()
export class WalletResolver {
  private walletService: WalletService = new WalletService(prisma, redis);

  // 🔍 QUERY: Get wallet - Uses your query rate limit (50 per minute)
  @Query(() => Wallet)
  @UseMiddleware(AuthMiddleware)
  @QueryRateLimit()
  async getMyWallet(@Ctx() ctx: Context): Promise<WalletType | null> {
    const result = await this.walletService.getWallet(ctx.user!.id);
    if (!result.success) throw new Error(result.message);
    return result.data as WalletType;
  }

  @Query(() => PaginatedWalletTransactions)
  @UseMiddleware(AuthMiddleware)
  @QueryRateLimit()
  async getMyWalletTransactions(
    @Ctx() ctx: Context,
    @Arg('filters', () => WalletTransactionFilterInput, { nullable: true }) 
    filters?: WalletTransactionFilterInput,
    @Arg('pagination', () => PaginationInput, { nullable: true })
    pagination?: PaginationInput
  ): Promise<PaginatedWalletTransactions> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    
    // Convert GraphQL enums to strings for the service
    const serviceFilters: Record<string, any> = {};
    
    if (filters?.types) serviceFilters.types = filters.types.map(t => t.toString());
    if (filters?.statuses) serviceFilters.statuses = filters.statuses.map(s => s.toString());
    if (filters?.startDate) serviceFilters.startDate = filters.startDate;
    if (filters?.endDate) serviceFilters.endDate = filters.endDate;
    if (filters?.minAmount !== undefined) serviceFilters.minAmount = filters.minAmount;
    if (filters?.maxAmount !== undefined) serviceFilters.maxAmount = filters.maxAmount;
    
    // Call the service which now handles all data transformation
    const result = await this.walletService.getWalletTransactions(
      ctx.user!.id,
      serviceFilters,
      page,
      limit
    );

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch wallet transactions');
    }

    // The service now returns the data in the correct format
    return result.data as PaginatedWalletTransactions;
  }

  // 💰 MUTATION: Request withdrawal - Uses sensitive rate limit (3 per 5 minutes)
  @Mutation(() => Transaction)
  @UseMiddleware(AuthMiddleware)
  @SensitiveRateLimit()
  async requestWithdrawal(
    @Arg("input") input: RequestWithdrawalInput,
    @Ctx() ctx: Context
  ): Promise<TransactionType> {
    const result = await this.walletService.requestWithdrawal(
      input,
      ctx.user!.id
    );
    if (!result.success) throw new Error(result.message);
    return result.data;
  }


  // ⚙️ MUTATION: Update settings - Mutation rate limit (10 per minute)
  // @Mutation(() => Boolean)
  // @UseMiddleware(AuthMiddleware)
  // @MutationRateLimit()
  // async updateWalletSettings(
  //   @Arg("settings") settings: any,
  //   @Ctx() ctx: Context
  // ): Promise<boolean> {
  //   // Implementation here
  //   return true;
  // }
}

import {
  Resolver,
  Query,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { TransactionService } from "../../services/transaction";
import { Context } from "../../types";
import { AuthMiddleware } from "../../middleware";
import { 
  PaginatedTransactions, 
  TransactionFilterInput, 
  Transaction,
  PaginationInput
} from "./wallet.types";

import { prisma, redis } from "../../config";
import { QueryRateLimit } from "../../graphql/decorators/rateLimit";

@Resolver()
export class TransactionResolver {
  private transactionService: TransactionService = new TransactionService(prisma, redis);

  // 🔍 QUERY: Get user transactions - Uses your query rate limit (50 per minute)
  @Query(() => PaginatedTransactions)
  @UseMiddleware(AuthMiddleware)
  @QueryRateLimit()
  async getMyTransactions(
    @Ctx() ctx: Context,
    @Arg('filters', () => TransactionFilterInput, { nullable: true }) 
    filters?: TransactionFilterInput,
    @Arg('pagination', () => PaginationInput, { nullable: true })
    pagination?: PaginationInput
  ): Promise<PaginatedTransactions> {
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
    const result = await this.transactionService.getTransactions({
      userId: ctx.user!.id,
      page,
      limit,
      ...serviceFilters
    });

    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch transactions');
    }

    // The service now returns the data in the correct format
    return {
      transactions: result.data?.transactions || [],
      totalCount: result.data?.pagination?.total || 0,
      hasMore: result.data?.pagination?.hasNextPage || false,
      page,
      limit
    };
  }
}

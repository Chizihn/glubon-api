import { Resolver, Query, Mutation, Args, ID, Ctx, Arg } from 'type-graphql';
import { Context } from '../../types/context';
import { TransactionService } from '../../services/transaction';
import { 
  Transaction, 
  PaginatedTransactions, 
  TransactionStats,
  TransactionFilterInput,
  TransactionSortInput,
  PaginationInput,
  VerifyTransactionResponse
} from './transaction.types';
import { 
  UpdateTransactionStatusInput,
  VerifyTransactionInput,
  GenerateTransactionReportInput
} from './transaction.inputs';
import { RoleEnum, TransactionStatus, TransactionType } from '@prisma/client';
import { Services } from '../../services';
import { prisma, redis } from '../../config';

@Resolver(() => Transaction)
export class TransactionResolver {
  private transactionService: TransactionService;

constructor() {
  this.transactionService = new TransactionService(prisma, redis);
}

  @Query(() => Transaction, { nullable: true })
  async transaction(
    @Arg('id') id: string,
    @Ctx() context: Context
  ) {
    const result = await this.transactionService.getTransactionById(id);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => PaginatedTransactions)
  async transactions(
    @Ctx() context: Context,
    @Arg('filter', { nullable: true }) filter?: TransactionFilterInput,
    @Arg('sort', { nullable: true }) sort?: TransactionSortInput,
    @Arg('pagination', { nullable: true }) pagination?: PaginationInput
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    
    const query: any = {
      page,
      limit,
      ...(filter || {}),
      ...(sort || {})
    };
    
    // Ensure users can only see their own transactions unless they're admins
    if (context.user?.role !== RoleEnum.ADMIN && context.user?.id) {
      query.userId = context.user.id;
    }
    
    const [transactionsResult, statsResult] = await Promise.all([
      this.transactionService.getTransactions(query),
      this.transactionService.getTransactionStats(query.userId)
    ]);

    if (!transactionsResult.success) {
      throw new Error(transactionsResult.message);
    }

    if (!statsResult.success) {
      console.error('Failed to fetch transaction stats:', statsResult.message);
    }

    return {
      transactions: transactionsResult.data?.transactions || [],
      totalCount: transactionsResult.data?.pagination?.total || 0,
      hasMore: transactionsResult.data?.pagination?.hasNextPage || false,
      stats: statsResult.success ? {
        totalTransactions: statsResult.data?.total || 0,
        totalAmount: statsResult.data?.totalAmount || 0,
        pendingTransactions: statsResult.data?.pending || 0,
        completedTransactions: statsResult.data?.completed || 0,
        failedTransactions: statsResult.data?.failed || 0,
      } : undefined,
    };
  }

  @Query(() => PaginatedTransactions)
  async transactionsByUser(
    @Ctx() context: Context,
    @Arg('userId') userId: string,
    @Arg('status', { nullable: true }) status?: string,
    @Arg('pagination', { nullable: true }) pagination?: PaginationInput
  ) {
    // Normal users can only see their own transactions
    if (context.user?.role !== 'ADMIN' && context.user?.id !== userId) {
      throw new Error('Unauthorized');
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    
    // Build the query
    const query: any = {
      userId,
      page,
      limit,
      ...(status ? { status: status as TransactionStatus } : {})
    };
    
    const result = await this.transactionService.getTransactions(query);
    if (!result.success) {
      throw new Error(result.message);
    }
    
    return {
      transactions: result.data?.transactions || [],
      totalCount: result.data?.pagination?.total || 0,
      hasMore: result.data?.pagination?.hasNextPage || false,
    };
  }

  @Query(() => [Transaction])
  async transactionsByProperty(
    @Ctx() context: Context,
    @Arg('propertyId') propertyId: string
  ) {
    const result = await this.transactionService.getTransactionsByProperty(propertyId);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => [Transaction])
  async transactionsByBooking(
    @Ctx() context: Context,
    @Arg('bookingId') bookingId: string
  ) {
    const result = await this.transactionService.getTransactionsByBooking(bookingId);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => TransactionStats)
  async transactionStats(
    @Ctx() context: Context,
    @Arg('userId', { nullable: true }) userId?: string
  ) {
    // Normal users can only see their own stats
    if (context.user?.role !== 'ADMIN' && userId && userId !== context.user?.id) {
      throw new Error('Unauthorized');
    }

    const result = await this.transactionService.getTransactionStats(
      userId || context.user?.id
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    return {
      totalTransactions: result.data?.total || 0,
      totalAmount: result.data?.totalAmount || 0,
      pendingTransactions: result.data?.pending || 0,
      completedTransactions: result.data?.completed || 0,
      failedTransactions: result.data?.failed || 0,
    };
  }

  @Mutation(() => Transaction)
  async updateTransactionStatus(
    @Arg('input') input: UpdateTransactionStatusInput,
    @Ctx() context: Context
  ) {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const result = await this.transactionService.updateTransactionStatus(
      input.transactionId,
      input.status,
      {
        ...(input.gatewayRef && { gatewayRef: input.gatewayRef }),
        updatedBy: context.user.id,
      },
      context.user.id
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;
  }

  @Mutation(() => VerifyTransactionResponse)
  async verifyTransaction(
    @Arg('input') input: VerifyTransactionInput,
    @Ctx() context: Context
  ) {
    const result = await this.transactionService.verifyTransaction(
      input.reference
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      status: true,
      message: result.message || 'Transaction verified successfully',
      transaction: result.data,
    };
  }

  @Query(() => String)
  async generateTransactionReport(
    @Arg('input') input: GenerateTransactionReportInput,
    @Ctx() context: Context
  ) {
    // Service is available through constructor injection
    
    if (context.user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required');
    }

    // This would typically generate and return a report URL or data
    // For now, we'll return a success message
    return 'Report generation started. You will be notified when it is ready.';
  }
}

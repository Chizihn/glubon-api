import { Resolver, Query, Mutation, Args, ID, Ctx, Arg } from 'type-graphql';
import { TransactionService } from '../../services/transaction';
import { Context } from '../../types/context';
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
import { TransactionStatus, TransactionType } from '@prisma/client';

@Resolver(() => Transaction)
export class TransactionResolver {
  constructor(private readonly transactionService: TransactionService) {}

  @Query(() => Transaction, { nullable: true })
  async transaction(
    @Arg('id') id: string,
    @Ctx() { user }: Context
  ) {
    const result = await this.transactionService.getTransactionById(id);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => PaginatedTransactions)
  async transactions(
    @Ctx() { user }: Context,
    @Arg('filter', { nullable: true }) filter?: TransactionFilterInput,
    @Arg('sort', { nullable: true }) sort?: TransactionSortInput,
    @Arg('pagination', { nullable: true }) pagination?: PaginationInput
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    
    const query: any = {
      page,
      limit,
      // Copy filter properties if they exist
      ...(filter || {}),
      // Override with sort if provided
      ...(sort || {})
    };
    
    // Ensure users can only see their own transactions unless they're admins
    if (user?.role !== 'ADMIN' && user?.id) {
      query.userId = user.id;
    }
    
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

  @Query(() => PaginatedTransactions)
  async transactionsByUser(
    @Ctx() { user }: Context,
    @Arg('userId') userId: string,
    @Arg('status', { nullable: true }) status?: string,
    @Arg('pagination', { nullable: true }) pagination?: PaginationInput
  ) {
    // Normal users can only see their own transactions
    if (user?.role !== 'ADMIN' && user?.id !== userId) {
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
    @Ctx() { user }: Context,
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
    @Ctx() { user }: Context,
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
    @Ctx() { user }: Context,
    @Arg('userId', { nullable: true }) userId?: string
  ) {
    // Normal users can only see their own stats
    if (user?.role !== 'ADMIN' && userId && userId !== user?.id) {
      throw new Error('Unauthorized');
    }

    const result = await this.transactionService.getTransactionStats(
      userId || user?.id
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
    @Ctx() { user }: Context
  ) {
    if (!user) {
      throw new Error('Authentication required');
    }

    const result = await this.transactionService.updateTransactionStatus(
      input.transactionId,
      input.status,
      {
        ...(input.gatewayRef && { gatewayRef: input.gatewayRef }),
        updatedBy: user.id,
      },
      user.id
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;
  }

  @Mutation(() => VerifyTransactionResponse)
  async verifyTransaction(
    @Arg('input') input: VerifyTransactionInput,
    @Ctx() { user }: Context
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
    @Ctx() { user }: Context
  ) {
    if (user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required');
    }

    // This would typically generate and return a report URL or data
    // For now, we'll return a success message
    return 'Report generation started. You will be notified when it is ready.';
  }
}

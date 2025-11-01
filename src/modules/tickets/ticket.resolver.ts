// resolvers/ticket.resolver.ts
import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql';
import { Context } from '../../types';
import { AuthMiddleware, RequirePermission, RequireRole } from '../../middleware';
import { PermissionEnum, RoleEnum } from '@prisma/client';
import { getContainer } from '../../services';
import { TicketService } from '../../services/ticket';
import { PaginatedTickets, Ticket, TicketStats } from './ticket.types';
import { CreateTicketInput, TicketFilterInput, UpdateTicketInput } from './ticket.input';

@Resolver(() => Ticket)
export class TicketResolver {
  private service: TicketService;

  constructor() {
    this.service = getContainer().resolve('ticketService');
  }

  // LIST ALL TICKETS (Support or Admin)
  @Query(() => PaginatedTickets)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
  async getTickets(
    @Ctx() ctx: Context,
    @Arg('filter', () => TicketFilterInput, { nullable: true }) filter?: TicketFilterInput
  ) {
    const sort = filter?.sort || { field: 'createdAt', order: 'desc' };
    const pagination = filter?.pagination || { page: 1, limit: 10 };

    const result = await this.service.getTickets(
      ctx.user!.id,
      true, // isSupportOrAdmin = true (middleware already checked)
      filter || {},
      sort,
      pagination
    );

    if (!result.success || !result.data) {
      return { data: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } };
    }

    return {
      data: result.data.data,
      pagination: {
        page: result.data.page,
        limit: result.data.limit,
        totalItems: result.data.totalItems,
        totalPages: result.data.totalPages,
      },
    };
  }

  // GET SINGLE TICKET (Own or Support)
  @Query(() => Ticket, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async getTicket(@Arg('id') id: string, @Ctx() ctx: Context) {
    const result = await this.service.getTicketById(id, ctx.user!.id);
    return result.success ? result.data : null;
  }

  // GET STATS (Support or Admin)
  @Query(() => TicketStats)
  @UseMiddleware(AuthMiddleware, RequirePermission(PermissionEnum.SUPPORT))
  async getTicketStats(@Ctx() ctx: Context) {
    const result = await this.service.getTicketStats(ctx.user!.id, true);
    return result.success ? result.data : {
      open: 0, inProgress: 0, resolved: 0, closed: 0, reopened: 0, total: 0,
      byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
      byCategory: { ACCOUNT: 0, PAYMENT: 0, TECHNICAL: 0, GENERAL: 0, FEEDBACK: 0, OTHER: 0 },
    };
  }

  // CREATE TICKET (Any Authenticated User)
  @Mutation(() => Ticket)
  @UseMiddleware(AuthMiddleware)
  async createTicket(@Arg('input') input: CreateTicketInput, @Ctx() ctx: Context) {
    const result = await this.service.createTicket(ctx.user!.id, input);
    if (!result.success) throw new Error(result.message || 'Failed to create ticket');
    return result.data;
  }

  // UPDATE TICKET (Own or Support)
  @Mutation(() => Ticket)
  @UseMiddleware(AuthMiddleware)
  async updateTicket(@Arg('input') input: UpdateTicketInput, @Ctx() ctx: Context) {
    const result = await this.service.updateTicket(input.id, input, ctx.user!.id);
    if (!result.success) throw new Error(result.message || 'Failed to update ticket');
    return result.data;
  }

  // CLOSE TICKET (Own or Support)
  @Mutation(() => Ticket)
  @UseMiddleware(AuthMiddleware)
  async closeTicket(@Arg('id') id: string, @Ctx() ctx: Context) {
    const result = await this.service.closeTicket(id, ctx.user!.id);
    if (!result.success) throw new Error(result.message || 'Failed to close ticket');
    return result.data;
  }

  // REOPEN TICKET (Support Only)
  @Mutation(() => Ticket)
  @UseMiddleware(AuthMiddleware, RequirePermission(PermissionEnum.SUPPORT))
  async reopenTicket(@Arg('id') id: string, @Ctx() ctx: Context) {
    const result = await this.service.reopenTicket(id, ctx.user!.id);
    if (!result.success) throw new Error(result.message || 'Failed to reopen ticket');
    return result.data;
  }
}
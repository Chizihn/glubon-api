// import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql';
// import { Context } from '../../types';
// import { Ticket, PaginatedTicketsResponse, TicketStats } from './ticket.types';
// import { CreateTicketInput, UpdateTicketInput, AddMessageInput, TicketFilterInput } from './ticket.inputs';
// import { AuthMiddleware } from '../../middleware';
// import { getContainer } from '../../services';
// import { TicketService } from '../../services/ticket';

// @Resolver(() => Ticket)
// export class TicketResolver {
//   private ticketService: TicketService;

//   constructor() {
//     const container = getContainer();
//     this.ticketService = container.resolve('ticketService');
//   }

//   @Query(() => PaginatedTicketsResponse)
//   @UseMiddleware(AuthMiddleware)
//   async getTickets(
//     @Arg('filter', () => TicketFilterInput, { nullable: true }) filter: TicketFilterInput | null,
//     @Ctx() ctx: Context
//   ): Promise<PaginatedTicketsResponse> {
//     try {
//       console.log('getTickets called with filter:', JSON.stringify(filter, null, 2));
//       console.log('User context:', { userId: ctx.user?.id });

//       const isAdmin = ctx.user?.roles?.includes('ADMIN') || ctx.user?.roles?.includes('SUPPORT_AGENT') || false;
//       const result = await this.ticketService.getTickets(ctx.user!.id, isAdmin, filter || undefined);

//       console.log('Service result:', {
//         success: result.success,
//         hasData: !!result.data,
//         dataLength: result.data?.data?.length,
//         message: result.message,
//       });

//       if (!result.success || !result.data) {
//         console.error('Failed to get tickets:', result.message);
//         return {
//           data: [],
//           pagination: new PaginationInfo(1, 10, 0),
//         };
//       }

//       return {
//         data: result.data.data,
//         pagination: new PaginationInfo(result.data.page, result.data.limit, result.data.totalItems),
//       };
//     } catch (error) {
//       console.error('Error in getTickets:', error);
//       if (error instanceof Error) {
//         console.error('Error details:', {
//           message: error.message,
//           stack: error.stack,
//           name: error.name,
//         });
//       }
//       return {
//         data: [],
//         pagination: new PaginationInfo(1, 10, 0),
//       };
//     }
//   }

//   @Query(() => Ticket, { nullable: true })
//   @UseMiddleware(AuthMiddleware)
//   async getTicket(
//     @Arg('id', () => String) id: string,
//     @Ctx() ctx: Context
//   ): Promise<Ticket | null> {
//     try {
//       const isAdmin = ctx.user?.role?.includes('ADMIN') || ctx.user?.role?.includes('SUPPORT_AGENT') || false;
//       const result = await this.ticketService.getTicketById(id, ctx.user!.id, isAdmin);

//       if (!result.success || !result.data) {
//         console.error(`[getTicket] Failed to fetch ticket: ${result.message}`);
//         return null;
//       }

//       return result.data;
//     } catch (error) {
//       console.error('Error in getTicket:', error);
//       return null;
//     }
//   }

//   @Query(() => TicketStats)
//   @UseMiddleware(AuthMiddleware)
//   async getTicketStats(@Ctx() ctx: Context): Promise<TicketStats> {
//     try {
//       const isAdmin = ctx.user?.role?.includes('ADMIN') || ctx.user?.role?.includes('SUPPORT_AGENT') || false;
//       const result = await this.ticketService.getTicketStats(ctx.user!.id, isAdmin);

//       if (!result.success || !result.data) {
//         console.error('Failed to get ticket stats:', result.message);
//         return {
//           open: 0,
//           inProgress: 0,
//           resolved: 0,
//           closed: 0,
//           total: 0,
//           byPriority: {
//             [TicketPriority.LOW]: 0,
//             [TicketPriority.MEDIUM]: 0,
//             [TicketPriority.HIGH]: 0,
//             [TicketPriority.URGENT]: 0,
//           },
//           byCategory: {
//             [TicketCategory.ACCOUNT]: 0,
//             [TicketCategory.PAYMENT]: 0,
//             [TicketCategory.TECHNICAL]: 0,
//             [TicketCategory.GENERAL]: 0,
//             [TicketCategory.FEEDBACK]: 0,
//             [TicketCategory.OTHER]: 0,
//           },
//         };
//       }

//       return result.data;
//     } catch (error) {
//       console.error('Error in getTicketStats:', error);
//       return {
//         open: 0,
//         inProgress: 0,
//         resolved: 0,
//         closed: 0,
//         total: 0,
//         byPriority: {
//           [TicketPriority.LOW]: 0,
//           [TicketPriority.MEDIUM]: 0,
//           [TicketPriority.HIGH]: 0,
//           [TicketPriority.URGENT]: 0,
//         },
//         byCategory: {
//           [TicketCategory.ACCOUNT]: 0,
//           [TicketCategory.PAYMENT]: 0,
//           [TicketCategory.TECHNICAL]: 0,
//           [TicketCategory.GENERAL]: 0,
//           [TicketCategory.FEEDBACK]: 0,
//           [TicketCategory.OTHER]: 0,
//         },
//       };
//     }
//   }

//   @Mutation(() => Ticket)
//   @UseMiddleware(AuthMiddleware)
//   async createTicket(
//     @Arg('input') input: CreateTicketInput,
//     @Ctx() ctx: Context
//   ): Promise<Ticket> {
//     const result = await this.ticketService.createTicket(ctx.user!.id, input);
//     if (!result.success || !result.data) {
//       throw new Error(result.message || 'Failed to create ticket');
//     }
//     return result.data;
//   }

//   @Mutation(() => Ticket)
//   @UseMiddleware(AuthMiddleware)
//   async updateTicket(
//     @Arg('input') input: UpdateTicketInput,
//     @Ctx() ctx: Context
//   ): Promise<Ticket> {
//     const result = await this.ticketService.updateTicket(input.id!, ctx.user!.id, input);
//     if (!result.success || !result.data) {
//       throw new Error(result.message || 'Failed to update ticket');
//     }
//     return result.data;
//   }

//   @Mutation(() => TicketMessage)
//   @UseMiddleware(AuthMiddleware)
//   async addTicketMessage(
//     @Arg('input') input: AddMessageInput,
//     @Ctx() ctx: Context
//   ): Promise<TicketMessage> {
//     const result = await this.ticketService.addMessage(ctx.user!.id, input);
//     if (!result.success || !result.data) {
//       throw new Error(result.message || 'Failed to add message');
//     }
//     return result.data;
//   }

//   @Mutation(() => Ticket)
//   @UseMiddleware(AuthMiddleware)
//   async closeTicket(
//     @Arg('id') id: string,
//     @Ctx() ctx: Context
//   ): Promise<Ticket> {
//     const isAdmin = ctx.user?.role?.includes('ADMIN') || ctx.user?.role?.includes('SUPPORT_AGENT') || false;
//     const result = await this.ticketService.closeTicket(id, ctx.user!.id, isAdmin);
//     if (!result.success || !result.data) {
//       throw new Error(result.message || 'Failed to close ticket');
//     }
//     return result.data;
//   }

//   @Mutation(() => Ticket)
//   @UseMiddleware(AuthMiddleware)
//   async reopenTicket(
//     @Arg('id') id: string,
//     @Arg('message', { nullable: true }) message: string,
//     @Ctx() ctx: Context
//   ): Promise<Ticket> {
//     const result = await this.ticketService.reopenTicket(id, ctx.user!.id, message);
//     if (!result.success || !result.data) {
//       throw new Error(result.message || 'Failed to reopen ticket');
//     }
//     return result.data;
//   }
// }
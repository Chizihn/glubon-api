// import { PrismaClient, User, Ticket as PrismaTicket, TicketMessage as PrismaTicketMessage, TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
// import { Redis } from 'ioredis';
// import { BaseService } from './base';
// import { CreateTicketInput, UpdateTicketInput, AddMessageInput, TicketFilterInput, TicketSortInput } from '../modules/tickets/ticket.inputs';
// import { logger } from '../utils';
// import { ServiceResponse } from '../types';

// type TicketWithRelations = PrismaTicket & {
//   createdBy: User;
//   assignedTo?: User | null;
//   messages: (PrismaTicketMessage & { sender: User })[];
// };

// export class TicketService extends BaseService {
//   constructor(prisma: PrismaClient, redis: Redis) {
//     super(prisma, redis);
//   }

//   async createTicket(userId: string, input: CreateTicketInput): Promise<ServiceResponse<PrismaTicket>> {
//     try {
//       console.log(`Creating ticket for user: ${userId}`);
//       const user = await this.prisma.user.findUnique({ where: { id: userId } });
//       if (!user) {
//         return { success: false, message: 'User not found', data: null };
//       }

//       const ticket = await this.prisma.ticket.create({
//         data: {
//           subject: input.subject,
//           description: input.description,
//           priority: input.priority || TicketPriority.MEDIUM,
//           category: input.category || TicketCategory.GENERAL,
//           status: TicketStatus.OPEN,
//           createdBy: { connect: { id: userId } },
//           messages: {
//             create: {
//               content: input.description,
//               isInternal: false,
//               sender: { connect: { id: userId } },
//               attachments: input.attachments || [],
//             },
//           },
//           attachments: input.attachments || [],
//         },
//         include: {
//           createdBy: true,
//           assignedTo: true,
//           messages: { include: { sender: true } },
//         },
//       });

//       return this.success(ticket, 'Ticket created successfully');
//     } catch (error) {
//       return this.handleError(error, 'createTicket');
//     }
//   }

//   async updateTicket(ticketId: string, input: UpdateTicketInput, userId: string): Promise<ServiceResponse<PrismaTicket>> {
//     try {
//       console.log(`Updating ticket ID: ${ticketId} by user: ${userId}`);
//       const ticket = await this.prisma.ticket.findUnique({
//         where: { id: ticketId },
//         include: { createdBy: true, assignedTo: true },
//       });

//       if (!ticket) {
//         return { success: false, message: 'Ticket not found', data: null };
//       }

//       if (ticket.createdBy.id !== userId && ticket.assignedTo?.id !== userId) {
//         return { success: false, message: 'Not authorized to update this ticket', data: null };
//       }

//       const updateData: any = {
//         status: input.status,
//         priority: input.priority,
//         category: input.category,
//       };

//       if (input.assignedTo) {
//         const assignedUser = await this.prisma.user.findUnique({ where: { id: input.assignedTo } });
//         if (!assignedUser) {
//           return { success: false, message: 'Assigned user not found', data: null };
//         }
//         updateData.assignedTo = { connect: { id: input.assignedTo } };
//         updateData.assignedAt = new Date();
//       }

//       const updatedTicket = await this.prisma.ticket.update({
//         where: { id: ticketId },
//         data: updateData,
//         include: { createdBy: true, assignedTo: true },
//       });

//       return this.success(updatedTicket, 'Ticket updated successfully');
//     } catch (error) {
//       return this.handleError(error, 'updateTicket');
//     }
//   }

//   async addMessage(userId: string, input: AddMessageInput): Promise<ServiceResponse<PrismaTicketMessage>> {
//     try {
//       console.log(`Adding message to ticket ID: ${input.ticketId} by user: ${userId}`);
//       const ticket = await this.prisma.ticket.findUnique({
//         where: { id: input.ticketId },
//         include: { createdBy: true, assignedTo: true },
//       });

//       if (!ticket) {
//         return { success: false, message: 'Ticket not found', data: null };
//       }

//       if (ticket.status === TicketStatus.CLOSED && !input.isInternal) {
//         return { success: false, message: 'Cannot add message to a closed ticket', data: null };
//       }

//       const message = await this.prisma.ticketMessage.create({
//         data: {
//           content: input.content,
//           isInternal: input.isInternal || false,
//           ticket: { connect: { id: input.ticketId } },
//           sender: { connect: { id: userId } },
//           attachments: input.attachments || [],
//         },
//         include: { sender: true },
//       });

//       await this.prisma.ticket.update({
//         where: { id: input.ticketId },
//         data: {
//           updatedAt: new Date(),
//           ...(ticket.status === TicketStatus.CLOSED && !input.isInternal && { status: TicketStatus.REOPENED }),
//         },
//       });

//       return this.success(message, 'Message added successfully');
//     } catch (error) {
//       return this.handleError(error, 'addMessage');
//     }
//   }

//   async getTicketById(ticketId: string, userId: string, isAdmin: boolean = false): Promise<ServiceResponse<TicketWithRelations>> {
//     try {
//       console.log(`Fetching ticket ID: ${ticketId} for user: ${userId}`);
//       const ticket = await this.prisma.ticket.findUnique({
//         where: { id: ticketId },
//         include: {
//           createdBy: true,
//           assignedTo: true,
//           messages: {
//             where: isAdmin ? {} : { isInternal: false },
//             orderBy: { createdAt: 'asc' },
//             include: { sender: true },
//           },
//         },
//       });

//       if (!ticket) {
//         return { success: false, message: 'Ticket not found', data: null };
//       }

//       if (!isAdmin && ticket.createdById !== userId && ticket.assignedToId !== userId) {
//         return { success: false, message: 'Not authorized to view this ticket', data: null };
//       }

//       return this.success(ticket as TicketWithRelations, 'Ticket fetched successfully');
//     } catch (error) {
//       return this.handleError(error, 'getTicketById');
//     }
//   }

//   async getTickets(
//     userId: string,
//     isAdmin: boolean = false,
//     filter: TicketFilterInput = {},
//     sort: TicketSortInput = { field: 'createdAt', order: 'desc' },
//     pagination: { page?: number; limit?: number } = {}
//   ): Promise<ServiceResponse<{ data: TicketWithRelations[]; totalItems: number; page: number; limit: number; totalPages: number }>> {
//     try {
//       console.log('getTickets called with filter:', JSON.stringify(filter, null, 2));
//       const where: any = {};
//       const page = Math.max(1, pagination.page || 1);
//       const limit = Math.min(100, Math.max(1, pagination.limit || 10));
//       const skip = (page - 1) * limit;

//       // Apply filters
//       if (filter.status?.length) where.status = { in: filter.status };
//       if (filter.priority?.length) where.priority = { in: filter.priority };
//       if (filter.category?.length) where.category = { in: filter.category };
//       if (filter.assignedTo) where.assignedToId = filter.assignedTo;
//       if (filter.createdBy) where.createdById = filter.createdBy;
//       if (filter.dateFrom) where.createdAt = { gte: new Date(filter.dateFrom) };
//       if (filter.dateTo) {
//         const dateTo = new Date(filter.dateTo);
//         dateTo.setHours(23, 59, 59, 999);
//         where.createdAt = { ...where.createdAt, lte: dateTo };
//       }
//       if (filter.search) {
//         where.OR = [
//           { subject: { contains: filter.search, mode: 'insensitive' } },
//           { description: { contains: filter.search, mode: 'insensitive' } },
//           {
//             createdBy: {
//               OR: [
//                 { firstName: { contains: filter.search, mode: 'insensitive' } },
//                 { lastName: { contains: filter.search, mode: 'insensitive' } },
//                 { email: { contains: filter.search, mode: 'insensitive' } },
//               ],
//             },
//           },
//         ];
//       }

//       if (!isAdmin && userId) {
//         where.OR = [
//           { createdById: userId },
//           { assignedToId: userId },
//           ...(where.OR || []),
//         ];
//       }

//       const orderBy: any[] = [];
//       if (sort.field === 'createdBy') {
//         orderBy.push({ createdBy: { firstName: sort.order } });
//       } else if (sort.field === 'assignedTo') {
//         orderBy.push({ assignedTo: { firstName: sort.order } });
//       } else {
//         orderBy.push({ [sort.field]: sort.order });
//       }

//       const total = await this.prisma.ticket.count({ where });
//       const totalPages = Math.ceil(total / limit);

//       console.log(`Found ${total} total tickets matching filters`);

//       const data = await this.prisma.ticket.findMany({
//         where,
//         orderBy,
//         skip,
//         take: limit,
//         include: {
//           createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
//           assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
//         },
//       });

//       return this.success(
//         { data: data as TicketWithRelations[], totalItems: total, page, limit, totalPages },
//         'Tickets retrieved successfully'
//       );
//     } catch (error) {
//       return this.handleError(error, 'getTickets');
//     }
//   }

//   async closeTicket(ticketId: string, userId: string, isAdmin: boolean = false): Promise<ServiceResponse<PrismaTicket>> {
//     try {
//       console.log(`Closing ticket ID: ${ticketId} by user: ${userId}`);
//       const ticket = await this.prisma.ticket.findUnique({
//         where: { id: ticketId },
//         include: { createdBy: true },
//       });

//       if (!ticket) {
//         return { success: false, message: 'Ticket not found', data: null };
//       }

//       if (!isAdmin && ticket.createdById !== userId) {
//         return { success: false, message: 'Not authorized to close this ticket', data: null };
//       }

//       const updatedTicket = await this.prisma.ticket.update({
//         where: { id: ticketId },
//         data: { status: TicketStatus.CLOSED, closedAt: new Date() },
//         include: { createdBy: true, assignedTo: true },
//       });

//       return this.success(updatedTicket, 'Ticket closed successfully');
//     } catch (error) {
//       return this.handleError(error, 'closeTicket');
//     }
//   }

//   async reopenTicket(ticketId: string, userId: string, message?: string): Promise<ServiceResponse<PrismaTicket>> {
//     try {
//       console.log(`Reopening ticket ID: ${ticketId} by user: ${userId}`);
//       const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });

//       if (!ticket) {
//         return { success: false, message: 'Ticket not found', data: null };
//       }

//       if (ticket.status !== TicketStatus.CLOSED) {
//         return { success: false, message: 'Ticket is not closed', data: null };
//       }

//       const data: any = {
//         status: TicketStatus.REOPENED,
//         closedAt: null,
//       };

//       const [updatedTicket] = await this.prisma.$transaction([
//         this.prisma.ticket.update({
//           where: { id: ticketId },
//           data,
//           include: { createdBy: true, assignedTo: true },
//         }),
//         ...(message
//           ? [
//               this.prisma.ticketMessage.create({
//                 data: {
//                   content: message,
//                   isInternal: false,
//                   ticket: { connect: { id: ticketId } },
//                   sender: { connect: { id: userId } },
//                 },
//               }),
//             ]
//           : []),
//       ]);

//       return this.success(updatedTicket, 'Ticket reopened successfully');
//     } catch (error) {
//       return this.handleError(error, 'reopenTicket');
//     }
//   }

//   async getTicketStats(userId: string, isAdmin: boolean = false): Promise<ServiceResponse<TicketStats>> {
//     try {
//       console.log(`Fetching ticket stats for user: ${userId}, isAdmin: ${isAdmin}`);
//       const where: any = isAdmin ? {} : {
//         OR: [
//           { createdById: userId },
//           { assignedToId: userId },
//         ],
//       };

//       const [counts, priorityCounts, categoryCounts, total] = await Promise.all([
//         this.prisma.ticket.groupBy({ by: ['status'], where, _count: true }),
//         this.prisma.ticket.groupBy({ by: ['priority'], where, _count: true }),
//         this.prisma.ticket.groupBy({ by: ['category'], where, _count: true }),
//         this.prisma.ticket.count({ where }),
//       ]);

//       const statusCounts = counts.reduce((acc, { status, _count }) => {
//         acc[status] = _count;
//         return acc;
//       }, {} as Record<string, number>);

//       const priorityStats = priorityCounts.reduce((acc, { priority, _count }) => {
//         acc[priority] = _count;
//         return acc;
//       }, {} as Record<string, number>);

//       const categoryStats = categoryCounts.reduce((acc, { category, _count }) => {
//         acc[category] = _count;
//         return acc;
//       }, {} as Record<string, number>);

//       const stats: TicketStats = {
//         open: statusCounts[TicketStatus.OPEN] || 0,
//         inProgress: statusCounts[TicketStatus.IN_PROGRESS] || 0,
//         resolved: statusCounts[TicketStatus.RESOLVED] || 0,
//         closed: statusCounts[TicketStatus.CLOSED] || 0,
//         total,
//         byPriority: {
//           [TicketPriority.LOW]: priorityStats[TicketPriority.LOW] || 0,
//           [TicketPriority.MEDIUM]: priorityStats[TicketPriority.MEDIUM] || 0,
//           [TicketPriority.HIGH]: priorityStats[TicketPriority.HIGH] || 0,
//           [TicketPriority.URGENT]: priorityStats[TicketPriority.URGENT] || 0,
//         },
//         byCategory: {
//           [TicketCategory.ACCOUNT]: categoryStats[TicketCategory.ACCOUNT] || 0,
//           [TicketCategory.PAYMENT]: categoryStats[TicketCategory.PAYMENT] || 0,
//           [TicketCategory.TECHNICAL]: categoryStats[TicketCategory.TECHNICAL] || 0,
//           [TicketCategory.GENERAL]: categoryStats[TicketCategory.GENERAL] || 0,
//           [TicketCategory.FEEDBACK]: categoryStats[TicketCategory.FEEDBACK] || 0,
//           [TicketCategory.OTHER]: categoryStats[TicketCategory.OTHER] || 0,
//         },
//       };

//       return this.success(stats, 'Ticket stats retrieved successfully');
//     } catch (error) {
//       return this.handleError(error, 'getTicketStats');
//     }
//   }
// }
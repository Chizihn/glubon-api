// services/ticket.service.ts
import { PrismaClient, User, Ticket as PrismaTicket, TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
import { Redis } from 'ioredis';
import { BaseService } from './base';
import { ServiceResponse, SortInput } from '../types';
import { CreateTicketInput, TicketFilterInput, UpdateTicketInput } from '../modules/tickets/ticket.input';

export type TicketStats = {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  reopened: number;
  total: number;
  byPriority: Record<TicketPriority, number>;
  byCategory: Record<TicketCategory, number>;
};

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

@Service()
export class TicketService extends BaseService {
  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis
  ) {
    super(prisma, redis);
  }

  async createTicket(userId: string, input: CreateTicketInput): Promise<ServiceResponse<PrismaTicket>> {
    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          subject: input.subject,
          description: input.description,
          priority: input.priority || TicketPriority.MEDIUM,
          category: input.category || TicketCategory.GENERAL,
          status: TicketStatus.OPEN,
          createdBy: { connect: { id: userId } },
        },
        include: { createdBy: true, assignedTo: true },
      });
      return this.success(ticket, 'Ticket created');
    } catch (error) {
      return this.handleError(error, 'createTicket');
    }
  }

  async updateTicket(ticketId: string, input: UpdateTicketInput, userId: string): Promise<ServiceResponse<PrismaTicket>> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { createdBy: true, assignedTo: true },
      });
      if (!ticket) return this.failure('Ticket not found');

      // Only owner or assigned can update (Support/Admin already allowed by middleware or ownership)
      if (ticket.createdById !== userId && ticket.assignedToId !== userId) {
        return this.failure('Not authorized');
      }

      const data: any = {};
      if (input.status) data.status = input.status;
      if (input.priority) data.priority = input.priority;
      if (input.category) data.category = input.category;
      if (input.assignedTo) {
        const assigned = await this.prisma.user.findUnique({ where: { id: input.assignedTo } });
        if (!assigned) return this.failure('Assigned user not found');
        data.assignedTo = { connect: { id: input.assignedTo } };
        data.assignedAt = new Date();
      }

      const updated = await this.prisma.ticket.update({
        where: { id: ticketId },
        data,
        include: { createdBy: true, assignedTo: true },
      });

      return this.success(updated, 'Ticket updated');
    } catch (error) {
      return this.handleError(error, 'updateTicket');
    }
  }

  async getTicketById(ticketId: string, userId: string): Promise<ServiceResponse<PrismaTicket & { createdBy: User; assignedTo: User | null }>> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { createdBy: true, assignedTo: true },
      });
      if (!ticket) return this.failure('Ticket not found');

      // Owner, assigned, or Support/Admin (middleware may allow)
      if (ticket.createdById !== userId && ticket.assignedToId !== userId) {
        return this.failure('Not authorized');
      }

      return this.success(ticket, 'Ticket fetched');
    } catch (error) {
      return this.handleError(error, 'getTicketById');
    }
  }

  async getTickets(
    userId: string,
    isSupportOrAdmin: boolean,
    filter: TicketFilterInput = {},
    sort: SortInput = { field: 'createdAt', order: 'desc' },
    pagination: { page?: number; limit?: number } = {}
  ) {
    try {
      const page = Math.max(1, pagination.page || 1);
      const limit = Math.min(50, Math.max(1, pagination.limit || 10));
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filter.status?.length) where.status = { in: filter.status };
      if (filter.priority?.length) where.priority = { in: filter.priority };
      if (filter.category?.length) where.category = { in: filter.category };
      if (filter.assignedTo) where.assignedToId = filter.assignedTo;
      if (filter.createdBy) where.createdById = filter.createdBy;

      if (filter.dateFrom || filter.dateTo) {
        where.createdAt = {};
        if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom);
        if (filter.dateTo) {
          const to = new Date(filter.dateTo);
          to.setHours(23, 59, 59, 999);
          where.createdAt.lte = to;
        }
      }

      if (filter.search) {
        where.OR = [
          { subject: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
          { createdBy: { email: { contains: filter.search, mode: 'insensitive' } } },
        ];
      }

      if (!isSupportOrAdmin) {
        where.OR = [{ createdById: userId }, { assignedToId: userId }];
      }

      const orderBy: any = {};
      if (sort.field === 'createdBy') orderBy.createdBy = { firstName: sort.order };
      else if (sort.field === 'assignedTo') orderBy.assignedTo = { firstName: sort.order };
      else orderBy[sort.field || 'createdAt'] = sort.order;

      const [data, total] = await Promise.all([
        this.prisma.ticket.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
        this.prisma.ticket.count({ where }),
      ]);

      return this.success({
        data,
        totalItems: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return this.handleError(error, 'getTickets');
    }
  }

  async closeTicket(ticketId: string, userId: string): Promise<ServiceResponse<PrismaTicket>> {
    try {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return this.failure('Ticket not found');
      if (ticket.createdById !== userId && ticket.assignedToId !== userId) {
        return this.failure('Not authorized');
      }

      const updated = await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.CLOSED, closedAt: new Date() },
        include: { createdBy: true, assignedTo: true },
      });

      return this.success(updated, 'Ticket closed');
    } catch (error) {
      return this.handleError(error, 'closeTicket');
    }
  }

  async reopenTicket(ticketId: string, userId: string): Promise<ServiceResponse<PrismaTicket>> {
    try {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return this.failure('Ticket not found');
      if (ticket.status !== TicketStatus.CLOSED) return this.failure('Ticket not closed');

      const updated = await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.REOPENED, closedAt: null },
        include: { createdBy: true, assignedTo: true },
      });

      return this.success(updated, 'Ticket reopened');
    } catch (error) {
      return this.handleError(error, 'reopenTicket');
    }
  }

  async getTicketStats(userId: string, isSupportOrAdmin: boolean): Promise<ServiceResponse<TicketStats>> {
    try {
      const where = isSupportOrAdmin ? {} : { OR: [{ createdById: userId }, { assignedToId: userId }] };

      const [statusRes, priorityRes, categoryRes, total] = await Promise.all([
        this.prisma.ticket.groupBy({ by: ['status'], where, _count: { status: true } }),
        this.prisma.ticket.groupBy({ by: ['priority'], where, _count: { priority: true } }),
        this.prisma.ticket.groupBy({ by: ['category'], where, _count: { category: true } }),
        this.prisma.ticket.count({ where }),
      ]);

      const statusMap = Object.fromEntries(statusRes.map(s => [s.status, s._count.status]));
      const priorityMap = Object.fromEntries(priorityRes.map(p => [p.priority, p._count.priority]));
      const categoryMap = Object.fromEntries(categoryRes.map(c => [c.category, c._count.category]));

      const stats: TicketStats = {
        open: statusMap[TicketStatus.OPEN] || 0,
        inProgress: statusMap[TicketStatus.IN_PROGRESS] || 0,
        resolved: statusMap[TicketStatus.RESOLVED] || 0,
        closed: statusMap[TicketStatus.CLOSED] || 0,
        reopened: statusMap[TicketStatus.REOPENED] || 0,
        total,
        byPriority: {
          LOW: priorityMap[TicketPriority.LOW] || 0,
          MEDIUM: priorityMap[TicketPriority.MEDIUM] || 0,
          HIGH: priorityMap[TicketPriority.HIGH] || 0,
          URGENT: priorityMap[TicketPriority.URGENT] || 0,
        },
        byCategory: {
          ACCOUNT: categoryMap[TicketCategory.ACCOUNT] || 0,
          PAYMENT: categoryMap[TicketCategory.PAYMENT] || 0,
          TECHNICAL: categoryMap[TicketCategory.TECHNICAL] || 0,
          GENERAL: categoryMap[TicketCategory.GENERAL] || 0,
          FEEDBACK: categoryMap[TicketCategory.FEEDBACK] || 0,
          OTHER: categoryMap[TicketCategory.OTHER] || 0,
        },
      };

      return this.success(stats);
    } catch (error) {
      return this.handleError(error, 'getTicketStats');
    }
  }
}
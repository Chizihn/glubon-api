import { PrismaClient, Prisma, AuditAction, AuditLog, User } from '@prisma/client';
import { Redis } from 'ioredis';
import { BaseService } from './base';
import { logger } from '../utils';

export class AuditLogService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async createLog(data: {
    userId?: string | undefined;
    action: AuditAction;
    resource: string;
    resourceId?: string | undefined;
    oldValues?: any | undefined;
    newValues?: any | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    metadata?: any | undefined;
  }): Promise<{
    id: string;
    userId: string | null;
    action: string; // This will be cast to AuditAction when used
    resource: string;
    resourceId: string | null;
    oldValues: any;
    newValues: any;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: any;
    createdAt: Date;
  } | null> {
    try {
      const logData: any = {
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      };

      if (data.userId) {
        logData.user = { connect: { id: data.userId } };
      }

      if (data.oldValues !== undefined) {
        logData.oldValues = data.oldValues === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(data.oldValues));
      } else {
        logData.oldValues = Prisma.JsonNull;
      }

      if (data.newValues !== undefined) {
        logData.newValues = data.newValues === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(data.newValues));
      } else {
        logData.newValues = Prisma.JsonNull;
      }

      if (data.metadata !== undefined) {
        logData.metadata = data.metadata === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(data.metadata));
      } else {
        logData.metadata = Prisma.JsonNull;
      }

      const log = await this.prisma.auditLog.create({
        data: logData,
        select: {
          id: true,
          userId: true,
          action: true,
          resource: true,
          resourceId: true,
          oldValues: true,
          newValues: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          createdAt: true,
        } as const,
      });

      return log;
    } catch (error) {
      logger.error('Error creating audit log:', error);
      return null;
    }
  }

  async getLogs(filter: {
    userIds?: string[] | undefined;
    actions?: AuditAction[] | undefined;
    resources?: string[] | undefined;
    resourceId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<AuditLog[]> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (filter.userIds && filter.userIds.length > 0) {
        where.userId = { in: filter.userIds };
      }

      if (filter.actions && filter.actions.length > 0) {
        where.action = { in: filter.actions };
      }

      if (filter.resources && filter.resources.length > 0) {
        where.resource = { in: filter.resources };
      }

      if (filter.resourceId) {
        where.resourceId = filter.resourceId;
      }

      if (filter.startDate || filter.endDate) {
        where.createdAt = {};
        if (filter.startDate) where.createdAt.gte = filter.startDate;
        if (filter.endDate) where.createdAt.lte = filter.endDate;
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return logs.map(log => ({
        ...log,
        action: log.action as AuditAction, // Cast to AuditAction to match AuditLogType
        userId: log.user?.id || null,
        user: log.user ? {
          id: log.user.id,
          email: log.user.email,
          firstName: log.user.firstName,
          lastName: log.user.lastName,
        } : null,
      }));
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      throw new Error('Failed to get audit logs');
    }
  }

  async countLogs(filter: {
    userIds?: string[] | undefined;
    actions?: AuditAction[] | undefined;
    resources?: string[] | undefined;
    resourceId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
  }): Promise<number> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (filter.userIds && filter.userIds.length > 0) {
        where.userId = { in: filter.userIds };
      }

      if (filter.actions && filter.actions.length > 0) {
        where.action = { in: filter.actions };
      }

      if (filter.resources && filter.resources.length > 0) {
        where.resource = { in: filter.resources };
      }

      if (filter.resourceId) {
        where.resourceId = filter.resourceId;
      }

      if (filter.startDate || filter.endDate) {
        where.createdAt = {};
        if (filter.startDate) where.createdAt.gte = filter.startDate;
        if (filter.endDate) where.createdAt.lte = filter.endDate;
      }

      return this.prisma.auditLog.count({ where });
    } catch (error) {
      logger.error('Error counting audit logs:', error);
      throw new Error('Failed to count audit logs');
    }
  }

  async logUserActivity(userId: string, action: AuditAction, metadata?: any) {
    return this.createLog({
      userId,
      action,
      resource: 'User',
      resourceId: userId,
      metadata,
    });
  }

  async logEntityChange(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId: string,
    oldValues?: any,
    newValues?: any,
    metadata?: any
  ) {
    return this.createLog({
      userId,
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      metadata,
    });
  }
}
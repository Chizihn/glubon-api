import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Args,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types";
import { AuditLogService } from "../../services/audit-log";
import { AuthMiddleware } from "../../middleware";
import { AuditLogType, AuditLogsResponse, AuditAction } from "./audit-log.types";
import { AuditLogFilter, CreateAuditLogInput } from "./audit-log.inputs";

@Resolver(() => AuditLogType)
export class AuditLogResolver {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Query(() => AuditLogsResponse)
  @UseMiddleware(AuthMiddleware)
  async getAuditLogs(
    @Args() filter: AuditLogFilter,
  ): Promise<AuditLogsResponse> {
    const [logs, total] = await Promise.all([
      this.auditLogService.getLogs({
        userIds: filter.userIds,
        actions: filter.actions as AuditAction[],
        resources: filter.resources,
        resourceId: filter.resourceId,
        startDate: filter.startDate,
        endDate: filter.endDate,
        limit: filter.limit,
        offset: filter.offset,
      }),
      this.auditLogService.countLogs({
        userIds: filter.userIds,
        actions: filter.actions as AuditAction[],
        resources: filter.resources,
        resourceId: filter.resourceId,
        startDate: filter.startDate,
        endDate: filter.endDate,
      }),
    ]);

    // Map the logs to ensure proper typing and handle JSON fields
    const typedLogs = logs.map(log => {
      const typedLog = new AuditLogType();
      typedLog.id = log.id;
      typedLog.userId = log.userId;
      typedLog.action = log.action as AuditAction; // Cast to AuditAction
      typedLog.resource = log.resource;
      typedLog.resourceId = log.resourceId;
      typedLog.ipAddress = log.ipAddress;
      typedLog.userAgent = log.userAgent;
      // Ensure metadata is properly typed as Record<string, any> | null
      typedLog.metadata = log.metadata ? JSON.parse(JSON.stringify(log.metadata)) : null;
      typedLog.createdAt = log.createdAt;
      return typedLog;
    });

    const response = new AuditLogsResponse();
    response.logs = typedLogs;
    response.total = total;
    return response;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async createAuditLog(
    @Args() input: CreateAuditLogInput,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    try {
      const log = await this.auditLogService.createLog({
        userId: input.userId ?? ctx.user?.id,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata ? JSON.parse(input.metadata) : null,
      });

      return !!log;
    } catch (error) {
      console.error('Error creating audit log:', error);
      return false;
    }
  }
}
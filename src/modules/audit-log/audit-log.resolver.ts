import {
  Resolver,
  Query,
  Args,
  UseMiddleware,
} from "type-graphql";
// import { getContainer } from "../../services";
import { AuthMiddleware } from "../../middleware";
import { AuditLogService } from "../../services/audit-log";
import { AuditLogType, AuditLogsResponse, AuditAction } from "./audit-log.types";
import { AuditLogFilter } from "./audit-log.inputs";

import { Service } from "typedi";

@Service()
@Resolver(() => AuditLogType)
export class AuditLogResolver {
  constructor(
    private auditLogService: AuditLogService
  ) {}

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

}
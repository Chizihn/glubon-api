import { PrismaClient, PropertyStatus, NotificationType } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { EmailService } from "./email";
import { NotificationService } from "./notification";
import { IBaseResponse } from "../types";
import {
  AdminPropertyFilters,
  UpdatePropertyStatusInput,
} from "../types/services/admin";
import { NotFoundError } from "../utils";
import { AdminPropertyRepository } from "../repository/admin-property";
import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

@Service()
export class AdminPropertyService extends BaseService {
  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis,
    private notificationService: NotificationService,
    private repository: AdminPropertyRepository,
    private emailService: EmailService
  ) {
    super(prisma, redis);
  }

  async getAllProperties(
    adminId: string,
    filters: AdminPropertyFilters = {},
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{ properties: any[]; totalCount: number; pagination: any }>
  > {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_PROPERTIES", {
        filters,
        page,
        limit,
      });

      const { properties, totalCount } = await this.repository.getAllProperties(
        filters,
        page,
        limit
      );

      const pagination = this.repository.buildPagination(page, limit, totalCount);

      return this.success(
        { properties, totalCount, pagination },
        "Properties retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getAllProperties");
    }
  }

  async updatePropertyStatus(
    adminId: string,
    input: UpdatePropertyStatusInput
  ): Promise<IBaseResponse<null>> {
    try {
      const { propertyId, status, reason } = input;

      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!property) throw new NotFoundError("Property not found");

      await this.repository.updatePropertyStatus(propertyId, status);

      await this.repository.logAdminAction(adminId, "UPDATE_PROPERTY_STATUS", {
        propertyId,
        oldStatus: property.status,
        newStatus: status,
        reason,
      });

      let notificationType: NotificationType;
      let notificationTitle: string;
      let notificationMessage: string;

      switch (status) {
        case PropertyStatus.ACTIVE:
          notificationType = NotificationType.PROPERTY_APPROVED;
          notificationTitle = "Property Approved";
          notificationMessage = `Your property "${property.title}" has been approved and is now live.`;
          break;

        case PropertyStatus.REJECTED:
          notificationType = NotificationType.PROPERTY_REJECTED;
          notificationTitle = "Property Rejected";
          notificationMessage = reason
            ? `Your property "${property.title}" has been rejected. Reason: ${reason}`
            : `Your property "${property.title}" has been rejected.`;
          break;

        case PropertyStatus.SUSPENDED:
          notificationType = NotificationType.PROPERTY_REJECTED; // or create PROPERTY_SUSPENDED if preferred
          notificationTitle = "Property Suspended";
          notificationMessage = reason
            ? `Your property "${property.title}" has been suspended. Reason: ${reason}`
            : `Your property "${property.title}" has been suspended.`;
          break;

        default:
          notificationType = NotificationType.SYSTEM_UPDATE;
          notificationTitle = "Property Status Updated";
          notificationMessage = `Your property "${property.title}" status has been updated to ${status}.`;
      }

      await this.notificationService.createNotification({
        userId: property.ownerId,
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        data: { propertyId, reason, adminId },
      });

      if (status === PropertyStatus.ACTIVE || status === PropertyStatus.REJECTED) {
        await this.emailService.sendPropertyApprovalNotification(
          property.owner.email,
          property.owner.firstName,
          property.title,
          propertyId,
          status === PropertyStatus.ACTIVE
        );
      }

      return this.success(null, `Property status updated to ${status}`);
    } catch (error: unknown) {
      return this.handleError(error, "updatePropertyStatus");
    }
  }

  async togglePropertyFeatured(
    adminId: string,
    propertyId: string
  ): Promise<IBaseResponse<{ featured: boolean }>> {
    try {
      const { featured, ownerId, title } =
        await this.repository.togglePropertyFeatured(propertyId);

      await this.repository.logAdminAction(adminId, "TOGGLE_PROPERTY_FEATURED", {
        propertyId,
        oldFeatured: !featured,
        newFeatured: featured,
      });

      await this.notificationService.createNotification({
        userId: ownerId,
        title: featured ? "Property Featured" : "Property Unfeatured",
        message: featured
          ? `Your property "${title}" has been featured and will get more visibility.`
          : `Your property "${title}" is no longer featured.`,
        type: NotificationType.SYSTEM_UPDATE,
        data: { propertyId, featured, adminId },
      });

      return this.success(
        { featured },
        `Property ${featured ? "featured" : "unfeatured"} successfully`
      );
    } catch (error: unknown) {
      return this.handleError(error, "togglePropertyFeatured");
    }
  }
}
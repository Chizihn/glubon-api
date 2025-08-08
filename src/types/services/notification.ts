import { NotificationType, RoleEnum } from "@prisma/client";

export type EmailNotificationType =
  | "PROPERTY_APPROVED"
  | "PROPERTY_REJECTED"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REJECTED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED";
export interface CreateNotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: any;
}

export interface NotificationFilters {
  userId: string;
  type?: NotificationType;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export interface NotificationResponseData {
  notifications: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  unreadCount: number;
}

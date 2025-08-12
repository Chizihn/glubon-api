import {
  Booking,
  NotificationType,
  Property,
  RoleEnum,
  User,
} from "@prisma/client";

export type EmailNotificationType =
  | "PROPERTY_APPROVED"
  | "PROPERTY_REJECTED"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REJECTED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED"
  | "BOOKING_CREATED"
  | "PAYMENT_CONFIRMED"
  | "ESCROW_RELEASED"
  | "WITHDRAWAL_REQUESTED"
  | "WITHDRAWAL_APPROVED"
  | "DISPUTE_CREATED"
  | "DISPUTE_RESOLVED"
  | "PAYMENT_RECEIVED"
  | "REFUND_PROCESSED";

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

export interface BookingNotification {
  booking: Booking;
  renter: User;
  property: Property;
  totalAmount: number;
  platformFee: number;
  paymentUrl: string;
}

import { NotificationType } from "@prisma/client";
import { ObjectType, Field, Int, registerEnumType, GraphQLISODateTime } from "type-graphql";
import { PaginatedResponse } from "../../types";

registerEnumType(NotificationType, {
  name: "NotificationType",
  description: "Types of notifications (e.g., alert, message, reminder)",
});

// Response Types
@ObjectType()
export class NotificationResponse {
  @Field(() => String)
  id: string;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  message: string;

  @Field(() => NotificationType)
  type: NotificationType;

  @Field(() => String, { nullable: true })
  data?: string; // JSON string

  @Field(() => Boolean)
  isRead: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}

@ObjectType()
export class NotificationStatsResponse {
  @Field(() => Int)
  unreadCount: number;
}

@ObjectType()
export class PaginatedNotificationsResponse extends PaginatedResponse<NotificationResponse> {
  // ...existing code...

  @Field(() => Int)
  unreadCount: number;
}

@ObjectType()
export class BulkNotificationResponse {
  @Field(() => Int)
  count: number;
}

// Subscription Types
@ObjectType()
export class NotificationCreatedPayload {
  @Field(() => NotificationResponse)
  notification: NotificationResponse;

  @Field(() => String)
  userId: string;
}

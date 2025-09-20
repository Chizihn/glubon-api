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
  get data(): string | null {
    try {
      return this._data ? JSON.stringify(this._data) : null;
    } catch (e) {
      console.error('Error serializing notification data:', e);
      return null;
    }
  }
  set data(value: any) {
    if (typeof value === 'string') {
      try {
        this._data = JSON.parse(value);
      } catch (e) {
        console.error('Error parsing notification data:', e);
        this._data = null;
      }
    } else {
      this._data = value;
    }
  }
  private _data: any;

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
  @Field(() => [NotificationResponse], { name: "items" })
  override items: NotificationResponse[];

  @Field(() => Int)
  unreadCount: number;

  constructor(
    items: NotificationResponse[],
    page: number,
    limit: number,
    totalItems: number,
    unreadCount: number = 0
  ) {
    super(items, page, limit, totalItems);
    this.items = items;
    this.unreadCount = unreadCount;
  }
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

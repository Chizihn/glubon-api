import { NotificationType } from "@prisma/client";
import { Field, InputType, registerEnumType } from "type-graphql";

// Input Types
@InputType()
export class NotificationFilters {
  @Field(() => NotificationType, { nullable: true })
  type?: NotificationType;

  @Field(() => Boolean, { nullable: true })
  isRead?: boolean;
}

@InputType()
export class CreateNotificationInput {
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
}

@InputType()
export class BulkNotificationInput {
  @Field(() => [String])
  userIds: string[];

  @Field(() => String)
  title: string;

  @Field(() => String)
  message: string;

  @Field(() => NotificationType)
  type: NotificationType;

  @Field(() => String, { nullable: true })
  data?: string; // JSON string
}

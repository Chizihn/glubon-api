import { ObjectType, Field, Int, GraphQLISODateTime } from "type-graphql";
import { PaginatedResponse, PaginationInfo } from "../../types/responses";
import { User } from "../user/user.types";
import { MessageType, RoleEnum } from "@prisma/client";

import { registerEnumType } from "type-graphql";
import { Property } from "../property/property.types";

registerEnumType(MessageType, {
  name: "MessageType",
  description:
    "The type of message sent in a conversation (e.g., text, image, file, etc.)",
});

@ObjectType()
export class MessageResponse {
  @Field(() => String)
  id: string;

  @Field(() => String)
  conversationId: string;

  @Field(() => String)
  senderId: string;

  @Field(() => String)
  content: string;

  @Field(() => MessageType)
  messageType: MessageType;

  @Field(() => [String])
  attachments: string[];

  @Field(() => Boolean)
  isRead: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => User, { nullable: true })
  sender: User;
  
  @Field(() => User, { nullable: true })
  receiver?: User;
  
  @Field(() => Property, { nullable: true })
  property?: Property;
}

@ObjectType()
export class ConversationResponse {
  @Field(() => String)
  id: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => [User])
  participants: User[];

  @Field(() => MessageResponse, { nullable: true })
  lastMessage?: MessageResponse;

  @Field(() => Int)
  unreadCount: number;
}

@ObjectType()
export class PaginatedConversationsResponse {
  @Field(() => [ConversationResponse])
  items: ConversationResponse[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(
    items: ConversationResponse[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

@ObjectType()
export class PaginatedMessagesResponse {
  @Field(() => [MessageResponse])
  items: MessageResponse[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(
    items: MessageResponse[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

@ObjectType()
export class UnreadCountResponse {
  @Field(() => Int)
  count: number;
}

@ObjectType()
export class MarkAsReadResponse {
  @Field(() => Int)
  updatedCount: number;
}

@ObjectType()
export class MessageSentPayload {
  @Field(() => MessageResponse)
  message: MessageResponse;

  @Field(() => String)
  conversationId: string;

  @Field(() => [String])
  recipientIds: string[];
}

@ObjectType()
export class BroadcastMessageResponse {
  @Field(() => String)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => MessageType)
  messageType: MessageType;

  @Field(() => [RoleEnum])
  recipientRoles: RoleEnum[];

  @Field(() => [String])
  sentToUserIds: string[];

  @Field(() => Int)
  totalRecipients: number;

  @Field(() => [String])
  attachments: string[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => User, { nullable: true })
  sender: User;

  constructor(data: Partial<BroadcastMessageResponse>) {
    Object.assign(this, data);
  }
}

@ObjectType()
export class PaginatedBroadcastMessagesResponse {
  @Field(() => [BroadcastMessageResponse])
  items: BroadcastMessageResponse[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(
    items: BroadcastMessageResponse[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

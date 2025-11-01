import { Field, InputType, GraphQLISODateTime, Int } from "type-graphql";
import { MessageType } from "@prisma/client";

@InputType()
export class CreateConversationInput {
  @Field(() => [String])
  participantIds: string[];

  @Field(() => String, { nullable: true })
  propertyId?: string;

  @Field(() => String, { nullable: true })
  initialMessage?: string;
}

@InputType()
export class SendMessageInput {
  @Field(() => String, { nullable: true })
  conversationId?: string;

  @Field(() => [String], { nullable: true })
  recipientIds?: string[];

  @Field(() => String)
  content: string;

  @Field(() => MessageType, { defaultValue: MessageType.TEXT })
  messageType: MessageType;

  @Field(() => [String], { nullable: true, defaultValue: [] })
  attachments?: string[];

  @Field(() => String, { nullable: true })
  propertyId?: string;
}

@InputType()
export class ConversationFilters {
  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  propertyId?: string;

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => Boolean, { nullable: true })
  hasUnreadMessages?: boolean;
}

@InputType()
export class MessageFilters {
  @Field(() => MessageType, { nullable: true })
  messageType?: MessageType;

  @Field(() => GraphQLISODateTime, { nullable: true })
  fromDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  toDate?: Date;

  @Field(() => String, { nullable: true })
  senderId?: string;

  @Field(() => Boolean, { nullable: true })
  isRead?: boolean;
}

@InputType()
export class TypingStatusInput {
  @Field(() => String)
  conversationId: string;

  @Field(() => Boolean)
  isTyping: boolean;
}

@InputType()
export class MessageSearchInput {
  @Field(() => String)
  query: string;

  @Field(() => String, { nullable: true })
  conversationId?: string;

  @Field(() => MessageType, { nullable: true })
  messageType?: MessageType;

  @Field(() => GraphQLISODateTime, { nullable: true })
  fromDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  toDate?: Date;
}



@InputType()
export class MarkMessagesAsReadInput {
  @Field(() => String)
  conversationId: string;

  @Field(() => [String], { nullable: true })
  messageIds?: string[]; // If provided, only mark these specific messages as read
}

@InputType()
export class UpdateMessageInput {
  @Field(() => String)
  messageId: string;

  @Field(() => String)
  content: string;

  @Field(() => [String], { nullable: true })
  attachments?: string[];
}

@InputType()
export class DeleteMessageInput {
  @Field(() => String)
  messageId: string;

  @Field(() => Boolean, { defaultValue: false })
  deleteForEveryone: boolean; // If true, delete for all participants
}

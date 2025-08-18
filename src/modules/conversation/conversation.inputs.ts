import { Field, GraphQLISODateTime, InputType, registerEnumType } from "type-graphql";
import { MessageType } from "@prisma/client";

registerEnumType(MessageType, {
  name: "MessageType",
  description:
    "The type of message sent in a conversation (e.g., text, image, file, etc.)",
});

@InputType()
export class CreateConversationInput {
  @Field(() => [String])
  participantIds: string[];

  @Field(() => String, { nullable: true })
  propertyId?: string;
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
}

@InputType()
export class MessageFilters {
  @Field(() => MessageType, { nullable: true })
  messageType?: MessageType;

  @Field(() => GraphQLISODateTime, { nullable: true })
  fromDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  toDate?: Date;
}

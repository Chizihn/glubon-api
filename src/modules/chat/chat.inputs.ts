import { Field, InputType, registerEnumType } from "type-graphql";
import { MessageType } from "@prisma/client";

registerEnumType(MessageType, {
  name: "MessageType",
  description:
    "The type of message sent in a conversation (e.g., text, image, file, etc.)",
});

@InputType()
export class CreateConversationInput {
  @Field(() => String)
  propertyId: string;

  @Field(() => String)
  renterId: string;

  @Field(() => String)
  ownerId: string;
}

@InputType()
export class SendMessageInput {
  @Field(() => String)
  conversationId: string;

  @Field(() => String)
  content: string;

  @Field(() => MessageType, { defaultValue: MessageType.TEXT })
  messageType: MessageType;

  @Field(() => [String], { defaultValue: [] })
  attachments: string[];
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

  @Field(() => Date, { nullable: true })
  fromDate?: Date;

  @Field(() => Date, { nullable: true })
  toDate?: Date;
}

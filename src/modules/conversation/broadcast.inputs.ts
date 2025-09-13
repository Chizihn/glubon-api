import { InputType, Field } from "type-graphql";
import { MessageType, RoleEnum } from "@prisma/client";

@InputType()
export class BroadcastMessageInput {
  @Field(() => String)
  content: string;

  @Field(() => MessageType, { defaultValue: "TEXT" })
  messageType: MessageType;

  @Field(() => [RoleEnum])
  recipientRoles: RoleEnum[];

  @Field(() => [String], { nullable: true })
  attachments?: string[];
}

@InputType()
export class BroadcastMessageFilter {
  @Field(() => [RoleEnum], { nullable: true })
  roles?: RoleEnum[];

  @Field({ nullable: true })
  search?: string;

  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;
}

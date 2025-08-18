import { Field, ObjectType, ID } from 'type-graphql';

@ObjectType()
export class UserPresence {
  @Field(() => ID)
  userId: string;

  @Field()
  isOnline: boolean;

  @Field(() => Date, { nullable: true })
  lastSeen?: Date;
}

@ObjectType()
export class TypingStatus {
  @Field(() => ID)
  conversationId: string;

  @Field(() => ID)
  userId: string;

  @Field()
  userName: string;

  @Field()
  isTyping: boolean;
}

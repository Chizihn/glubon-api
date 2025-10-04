import {
  Resolver,
  Query,
  Arg,
  Subscription,
  Root,
  Mutation,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { UserPresence, TypingStatus } from "./presence.types";
import { pubSub, SUBSCRIPTION_EVENTS } from "../../utils/pubsub";
import { Context } from "../../types/context";
import { getContainer } from "../../services";
import { AuthMiddleware } from "../../middleware/auth";
import { PresenceService } from "../../services/presence";

type PubSubPayload = {
  [key: string]: any;
};

@Resolver()
export class PresenceResolver {
  private presenceService: PresenceService;

  constructor() {
        const container = getContainer();
    
    this.presenceService = container.resolve('presenceService');
  }

  @Query(() => UserPresence, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async getOnlineStatus(
    @Arg("userId") userId: string,
    @Ctx() ctx: Context
  ) {
    return this.presenceService.getUserPresence(userId);
  }

  @Query(() => [UserPresence])
  @UseMiddleware(AuthMiddleware)
  async getBatchOnlineStatus(
    @Arg("userIds", () => [String]) userIds: string[],
    @Ctx() ctx: Context
  ) {
    return this.presenceService.getBatchUserPresence(userIds);
  }

  @Subscription(() => UserPresence, {
    topics: SUBSCRIPTION_EVENTS.PRESENCE_CHANGED,
    filter: ({
      payload,
      args,
    }: {
      payload: PubSubPayload;
      args: { userIds: string[] };
    }) => args.userIds.includes(payload.presenceChanged.userId),
  })
  presenceChanged(
    @Root() payload: { presenceChanged: UserPresence },
    @Arg("userIds", () => [String]) userIds: string[]
  ): UserPresence {
    return payload.presenceChanged;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async sendTypingStatus(
    @Arg("conversationId") conversationId: string,
    @Arg("isTyping") isTyping: boolean,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const user = ctx.user!;

    const pubSubTyped = pubSub as unknown as {
      publish: (trigger: string, payload: any) => Promise<void>;
    };

    await pubSubTyped.publish(SUBSCRIPTION_EVENTS.TYPING_STATUS, {
      typingStatus: {
        conversationId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        isTyping,
      },
    });

    return true;
  }

  @Subscription(() => TypingStatus, {
    topics: SUBSCRIPTION_EVENTS.TYPING_STATUS,
    filter: ({
      payload,
      args,
    }: {
      payload: { typingStatus: TypingStatus };
      args: { conversationId: string; userId: string };
    }) =>
      payload.typingStatus.conversationId === args.conversationId &&
      payload.typingStatus.userId !== args.userId,
  })
  typingStatus(
    @Root() payload: { typingStatus: TypingStatus },
    @Arg("conversationId") conversationId: string,
    @Arg("userId") userId: string
  ): TypingStatus {
    return payload.typingStatus;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async heartbeat(@Ctx() ctx: Context): Promise<boolean> {
    if (!ctx.user) {
      throw new Error("User not authenticated");
    }
    try {
      await this.presenceService.userConnected(ctx.user.id, "heartbeat");
      return true;
    } catch (error) {
      console.error('Error in heartbeat mutation:', error);
      throw new Error('Failed to update user presence: ' + (error as Error).message);
    }
  }
}

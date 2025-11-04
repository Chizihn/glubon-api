import { Resolver, Mutation, Arg, Ctx, UseMiddleware } from "type-graphql";
import { ObjectType, Field, InputType } from "type-graphql";
import { AIService } from "../../services/ai";
import { AuthMiddleware } from "../../middleware/auth";

// GraphQL Types
@InputType()
export class AIQueryInputType {
  @Field()
  query: string;

  @Field({ nullable: true })
  context?: string; 
}

@ObjectType()
export class AIResponseType {
  @Field()
  answer: string;

  @Field(() => [String], { nullable: true })
  suggestedProperties?: string[];

  @Field(() => [String], { nullable: true })
  followUpQuestions?: string[];
}

@Resolver()
export class AIResolver {
  @Mutation(() => AIResponseType)
  @UseMiddleware(AuthMiddleware)
  async askAI(
    @Arg("input") input: AIQueryInputType,
    @Ctx() ctx: any
  ): Promise<AIResponseType> {
    const aiService = new AIService(ctx.prisma);

    const contextData = input.context ? JSON.parse(input.context) : undefined;

    const response = await aiService.processQuery({
      query: input.query,
      userId: ctx.user?.id,
      context: contextData,
    });

    return {
      answer: response.answer,
      suggestedProperties:
        response.suggestedProperties?.map((p: any) => p.id) || [],
      followUpQuestions: response.followUpQuestions || [],
    };
  }
}

// src/resolvers/ai/AIResolver.ts
import { 
  Resolver, 
  Mutation, 
  Arg, 
  Ctx, 
  UseMiddleware,
  ObjectType,
  Field,
  InputType
} from "type-graphql";
import { AIService } from "../../services/ai";
import { AuthMiddleware } from "../../middleware/auth";
// import { getContainer } from "../../services";
import { GraphQLError } from "graphql";

// ── INPUT TYPES ───────────────────────────────────────────────────────────
@InputType()
class LocationContextInput {
  @Field({ nullable: true })
  latitude?: number;

  @Field({ nullable: true })
  longitude?: number;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  state?: string;
}

@InputType()
class BudgetContextInput {
  @Field({ nullable: true })
  min?: number;

  @Field({ nullable: true })
  max?: number;
}

@InputType()
class AIContextInput {
  @Field(() => LocationContextInput, { nullable: true })
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
  };

  @Field(() => BudgetContextInput, { nullable: true })
  budget?: {
    min: number;
    max: number;
  };

  @Field(() => [String], { nullable: true })
  preferences?: string[];
}

@InputType()
export class AIQueryInputType {
  @Field()
  query: string;

  @Field(() => AIContextInput, { nullable: true })
  context?: AIContextInput;
}

// ── OUTPUT TYPES ──────────────────────────────────────────────────────────
@ObjectType()
export class AIResponseType {
  @Field()
  answer: string;

  @Field(() => [String], { nullable: true })
  suggestedProperties?: string[];

  @Field(() => [String], { nullable: true })
  followUpQuestions?: string[];
}

// ── RESOLVER ──────────────────────────────────────────────────────────────
import { Service } from "typedi";

@Service()
@Resolver()
export class AIResolver {
  constructor(
    private aiService: AIService
  ) {}

  @Mutation(() => AIResponseType)
  @UseMiddleware(AuthMiddleware)
  async askAI(
    @Arg("input") input: AIQueryInputType,
    @Ctx() ctx: any
  ): Promise<AIResponseType> {
    try {
      // Validate input
      if (!input.query?.trim()) {
        throw new GraphQLError("Query cannot be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (input.query.length > 500) {
        throw new GraphQLError("Query is too long (max 500 characters)", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Convert context to match expected type
      const context = input.context ? {
        ...(input.context.location && {
          location: {
            latitude: input.context.location.latitude!,
            longitude: input.context.location.longitude!,
            ...(input.context.location.city && { city: input.context.location.city })
          }
        }),
        ...(input.context.budget && {
          budget: {
            min: input.context.budget.min!,
            max: input.context.budget.max!
          }
        }),
        ...(input.context.preferences && { preferences: input.context.preferences })
      } : null;

      // Process query
      const response = await this.aiService.processQuery({
        query: input.query.trim(),
        userId: ctx.user?.id,
        context
      });

      return {
        answer: response.answer,
        suggestedProperties: response.suggestedProperties || [],
        followUpQuestions: response.followUpQuestions || [],
      };
    } catch (error) {
      console.error("AI Resolver error:", error);

      // Handle specific errors
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Generic error response
      throw new GraphQLError(
        "Failed to process AI query. Please try again.",
        {
          extensions: { 
            code: "INTERNAL_SERVER_ERROR",
            originalError: error instanceof Error ? error.message : String(error)
          },
        }
      );
    }
  }
}
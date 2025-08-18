import { UseMiddleware } from "type-graphql";
import {
  graphqlAuthRateLimiter,
  graphqlGeneralRateLimiter,
  graphqlMutationRateLimiter,
  graphqlQueryRateLimiter,
  graphqlSensitiveRateLimiter,
  graphqlUploadRateLimiter,
} from "../../middleware/rateLimiter";
import { Context } from "../../types";
import { GraphQLRedisRateLimiter } from "../../utils/graphqlRedisRateLimiter";

// Easy-to-use decorators
export function GeneralRateLimit(): MethodDecorator & PropertyDecorator {
  return UseMiddleware(graphqlGeneralRateLimiter.createMiddleware());
}

export function QueryRateLimit(): MethodDecorator & PropertyDecorator {
  return UseMiddleware(graphqlQueryRateLimiter.createMiddleware());
}

export function MutationRateLimit(): MethodDecorator & PropertyDecorator {
  return UseMiddleware(graphqlMutationRateLimiter.createMiddleware());
}

export function AuthRateLimit(): MethodDecorator & PropertyDecorator {
  return UseMiddleware(graphqlAuthRateLimiter.createMiddleware());
}

export function SensitiveRateLimit(): MethodDecorator & PropertyDecorator {
  return UseMiddleware(graphqlSensitiveRateLimiter.createMiddleware());
}

export function UploadRateLimit(): MethodDecorator & PropertyDecorator {
  return UseMiddleware(graphqlUploadRateLimiter.createMiddleware());
}

// Custom rate limit decorator
export function CustomRateLimit(
  name: string,
  windowMs: number,
  maxRequests: number,
  keyGenerator?: (ctx: Context, operationName?: string) => string
): MethodDecorator & PropertyDecorator {
  const rateLimiter = new GraphQLRedisRateLimiter(name, windowMs, maxRequests, keyGenerator);
  return UseMiddleware(rateLimiter.createMiddleware());
}

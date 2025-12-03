// ============================================================================
// 📁 src/middleware/graphqlRateLimits.ts
// ============================================================================

import { GraphQLRedisRateLimiter } from "../utils/graphqlRedisRateLimiter";

// Convert your existing rate limiters to GraphQL versions
export const graphqlGeneralRateLimiter = new GraphQLRedisRateLimiter(
  "general",
  15 * 60 * 1000, // 15 minutes
  100 // 100 requests per 15 minutes
);

export const graphqlQueryRateLimiter = new GraphQLRedisRateLimiter(
  "query",
  60 * 1000, // 1 minute
  50, // 50 queries per minute
  (ctx, operation) => `query_${operation}_${ctx.user?.id || ctx.req!.ip}`
);

export const graphqlMutationRateLimiter = new GraphQLRedisRateLimiter(
  "mutation",
  60 * 1000, // 1 minute
  10, // 10 mutations per minute
  (ctx, operation) => `mutation_${operation}_${ctx.user?.id || ctx.req!.ip}`
);

export const graphqlAuthRateLimiter = new GraphQLRedisRateLimiter(
  "auth",
  15 * 60 * 1000, // 15 minutes
  10, // 10 auth requests per 15 minutes
  (ctx, operation) => `auth_${operation}_${ctx.req!.ip}` // Use IP for auth (before user is authenticated)
);

export const graphqlSensitiveRateLimiter = new GraphQLRedisRateLimiter(
  "sensitive",
  5 * 60 * 1000, // 5 minutes
  3, // 3 sensitive operations per 5 minutes
  (ctx, operation) => `sensitive_${operation}_${ctx.user?.id}` // Must be authenticated
);

export const graphqlUploadRateLimiter = new GraphQLRedisRateLimiter(
  "upload",
  60 * 60 * 1000, // 1 hour
  20, // 20 uploads per hour
  (ctx, operation) => `upload_${ctx.user?.id || ctx.req!.ip}`
);

export const graphqlMapSearchRateLimiter = new GraphQLRedisRateLimiter(
  "map_search",
  30 * 1000, // 30 seconds cooldown
  1, // 1 request per 30 seconds
  (ctx, operation) => `map_search_${ctx.user?.id || ctx.req!.ip}` // User-specific rate limiting
);

import { Request } from "express";
import { User } from "@prisma/client";
import { Context } from "../types";
import { prisma, redis } from "../config";

export function createGraphQLContext(
  req?: Request,
  user?: Partial<User> | null
): Context {
  const context: Context = {
    user: (user as User) || req?.user || null,
    prisma,
    redis,
    ...(req && { req }),
  };

  return context;
}

import { Request } from "express";
import { Services } from "../services";
import { User } from "@prisma/client";
import { Context } from "../types";
import { prisma, redis } from "../config";

export function createGraphQLContext(
  services: Services,
  req?: Request,
  user?: Partial<User> | null
): Context {
  const context: Context = {
    user: (user as User) || req?.user || null,
    prisma: prisma,
    redis: redis,
    services,
  };

  if (req !== undefined) {
    context.req = req;
  }

  return context;
}

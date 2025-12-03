// src/types/context.ts
import type { PrismaClient, User, RoleEnum } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Request, Response } from "express";
import { Services } from "../services";

export type AuthenticatedUser = Pick<
  User,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "role"
  | "permissions"
  | "isVerified"
  | "isActive"
> & { roles: RoleEnum[] };

export interface Context {
  prisma: PrismaClient;
  redis: Redis;
  user: User | null;
  req?: Request; // Remove | undefined - let TypeScript handle it
  res?: Response;
  services: Services;
}

export interface WebSocketContext {
  user?: Partial<User> | null;
  prisma: PrismaClient;
  redis: Redis;
  services: Services;
  connectionParams?: Record<string, any>; // Remove | undefined - let TypeScript handle it
}

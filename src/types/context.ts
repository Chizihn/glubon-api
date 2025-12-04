// src/types/context.ts
import type { PrismaClient, User, RoleEnum } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Request, Response } from "express";
// import { Services } from "../services";

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
> & { roles: RoleEnum[]; activeRole?: RoleEnum };

export interface Context {
  prisma: PrismaClient;
  redis: Redis;
  user: (User & { activeRole?: RoleEnum }) | null;
  req?: Request; // Remove | undefined - let TypeScript handle it
  res?: Response;
}

export interface WebSocketContext {
  user?: Partial<User> | null;
  prisma: PrismaClient;
  redis: Redis;
  connectionParams?: Record<string, any>; // Remove | undefined - let TypeScript handle it
}

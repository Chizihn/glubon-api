import { Token } from "typedi";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

export const PRISMA_TOKEN = new Token<PrismaClient>("PRISMA");
export const REDIS_TOKEN = new Token<Redis>("REDIS");

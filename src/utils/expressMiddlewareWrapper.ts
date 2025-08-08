// utils/expressMiddlewareWrapper.ts
import type { MiddlewareFn } from "type-graphql";
import type { Request, Response, NextFunction } from "express";
import type { Context } from "../types";

export function wrapExpressMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void
): MiddlewareFn<Context> {
  return async ({ context }, next) => {
    const req = context.req as Request;
    const res = context.res as Response;

    await new Promise<void>((resolve, reject) => {
      middleware(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return next();
  };
}

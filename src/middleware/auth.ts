import type { MiddlewareFn } from "type-graphql";
import jwt from "jsonwebtoken";
import { PermissionEnum, RoleEnum, UserStatus } from "@prisma/client";
import { Context } from "../types";
import { ForbiddenError, logger, UnauthorizedError } from "../utils";
import { jwtConfig } from "../config";

export const AuthMiddleware: MiddlewareFn<Context> = async (
  { context, info },
  next
) => {
  
  if (!context.req) {
    throw new UnauthorizedError("Request object is missing");
  }
  
  const authHeader = context.req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Invalid or missing authorization header");
  }

  const token = authHeader.substring(7);
  // logger.info(`[AuthMiddleware] Token: ${token}`);

  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as any;

    // First get the full user object
    const user = await context.prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      console.error(`[AuthMiddleware] Error: User with ID ${decoded.userId} not found`);
      throw new UnauthorizedError("User not found");
    }

    if (!user.isActive) {
      console.error(`[AuthMiddleware] Error: User ${user.email} account is deactivated`);
      throw new UnauthorizedError("Account has been deactivated");
    }

    context.user = user;
    return next();
  } catch (error) {
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token");
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token expired");
    }
    
    throw error;
  }
};

export const RequireRole = (...roles: RoleEnum[]): MiddlewareFn<Context> => {
  return async ({ context }, next) => {
    if (!context.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const user = context.user as any;
    const userRoles = user.roles || (user.role ? [user.role] : []);

    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenError(
        "You do not have permission to perform this action!"
      );
    }

    return next();
  };
};

export const RequirePermission = (
  ...permissions: PermissionEnum[]
): MiddlewareFn<Context> => {
  return async ({ context }, next) => {
    if (!context.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (context.user.role !== RoleEnum.ADMIN) {
      throw new ForbiddenError("Admin access required");
    }

    // Add null checks for permissions
    if (!context.user.permissions) {
      throw new ForbiddenError("User permissions not available");
    }

    const hasPermission = permissions.some(
      (permission) =>
        context.user!.permissions!.includes(permission) ||
        context.user!.permissions!.includes(PermissionEnum.SUPER_ADMIN)
    );

    if (!hasPermission) {
      throw new ForbiddenError("Insufficient permissions");
    }

    return next();
  };
};

export const RequireEmailVerification: MiddlewareFn<Context> = async (
  { context },
  next
) => {
  if (!context.user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!context.user.isVerified) {
    throw new ForbiddenError("Email verification required");
  }

  return next();
};

export const RequireUserStatus = (
  ...allowedStatuses: UserStatus[]
): MiddlewareFn<Context> => {
  return async ({ context }, next) => {
    const user = context.user;

    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!allowedStatuses.includes(user.status)) {
      if (user.status === UserStatus.BANNED) {
        throw new ForbiddenError("Your account has been banned");
      }
      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenError("Your account is suspended");
      }
      if (user.status === UserStatus.PENDING_VERIFICATION) {
        throw new ForbiddenError("Please complete account verification");
      }
      throw new ForbiddenError("Access denied due to account status");
    }

    return next();
  };
};

export const validateRole = (role: RoleEnum | undefined): RoleEnum => {
  if (role === RoleEnum.ADMIN) {
    throw new Error("You do not have permission to perform this action!");
  }
  return role || RoleEnum.RENTER;
};

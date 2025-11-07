import { Container } from "../container";
import { PropertyRepository } from "./properties";
import { UserRepository } from "./user";
import { UnitRepository } from "./units";

// Import and re-export all repository types
export * from "./base";
export * from "./properties";
export * from "./user";
export * from "./units";

/**
 * Register all repositories with the container
 */
export function registerRepositories(container: Container): void {
  container.register("propertyRepository", 
    (container) => new PropertyRepository(container.getPrisma(), container.getRedis())
  );

  container.register("userRepository", 
    (container) => new UserRepository(container.getPrisma(), container.getRedis())
  );
  
  container.register("unitRepository",
    (container) => new UnitRepository(container.getPrisma(), container.getRedis())
  );
}

// For backward compatibility
export const createRepositories = (prisma: any, redis: any) => {
  return {
    propertyRepository: new PropertyRepository(prisma, redis),
    userRepository: new UserRepository(prisma, redis),
    unitRepository: new UnitRepository(prisma, redis)
  };
};

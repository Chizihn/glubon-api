import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User; // or whatever your user object looks like
    }
  }
}

declare module "express-serve-static-core" {
  interface ParamsDictionary {
    provider?: string;
  }
  interface Query {
    code?: string | string[];
    state?: string | string[];
    redirectUri?: string | string[];
  }
}
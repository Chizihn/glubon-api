import { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User; // or whatever your user object looks like
    }
  }
}

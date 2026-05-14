import "express-serve-static-core";
import type { AuthPayload } from "./auth/types.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthPayload;
  }
}

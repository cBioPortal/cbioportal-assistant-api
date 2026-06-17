import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { getJwtSecret } from "../lib/config.js";
import { AuthError } from "../lib/error-handler.js";
import { logger } from "../lib/logger.js";

export function createAuthMiddleware() {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      next(new AuthError("Missing or malformed Authorization header"));
      return;
    }

    const token = authHeader.slice(7);

    try {
      const secret = new TextEncoder().encode(getJwtSecret());
      await jwtVerify(token, secret);
      next();
    } catch (err) {
      logger.warn("JWT verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      next(new AuthError("Invalid or expired access key"));
    }
  };
}

import type { Request, Response, NextFunction } from "express";
import { handleError } from "../lib/error-handler.js";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const { response, statusCode } = handleError(err);
  res.status(statusCode).json(response);
}

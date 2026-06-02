import { logger } from "./logger.js";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class ServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 503, "SERVICE_ERROR", details);
    this.name = "ServiceError";
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(`Configuration Error: ${message}`, 500, "CONFIGURATION_ERROR", details);
    this.name = "ConfigurationError";
  }
}

interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export function handleError(error: unknown): {
  response: ErrorResponse;
  statusCode: number;
} {
  logger.error("Request error", error);

  if (error instanceof AppError) {
    return {
      response: {
        error: error.message,
        code: error.code,
        details: process.env.NODE_ENV === "development" ? error.details : undefined,
      },
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      response: {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      statusCode: 500,
    };
  }

  return {
    response: { error: "An unexpected error occurred" },
    statusCode: 500,
  };
}

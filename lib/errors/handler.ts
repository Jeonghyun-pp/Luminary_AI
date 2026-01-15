import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public errors?: any) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "인증이 필요합니다.") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "권한이 없습니다.") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "리소스를 찾을 수 없습니다.") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/**
 * Standard error response handler
 */
export function handleError(error: unknown): NextResponse {
  // Zod validation error
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "입력 검증 실패",
        code: "VALIDATION_ERROR",
        details: error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        })),
      },
      { status: 400 }
    );
  }

  // Custom AppError
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code || "APP_ERROR",
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
        }),
      },
      { status: error.statusCode }
    );
  }

  // Unknown error
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  console.error(`Unexpected error: ${errorMessage}`);
  if (errorStack) {
    console.error(`Error stack: ${errorStack}`);
  }
  return NextResponse.json(
    {
      error: "서버 오류가 발생했습니다.",
      code: "INTERNAL_SERVER_ERROR",
      ...(process.env.NODE_ENV === "development" && {
        message: errorMessage,
        stack: errorStack,
      }),
    },
    { status: 500 }
  );
}

/**
 * Async route handler wrapper with error handling
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}


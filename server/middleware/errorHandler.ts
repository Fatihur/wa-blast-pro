import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error handler
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

// Authentication error handler
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
  }
}

// Authorization error handler
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

// Not found error handler
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

// Sanitize error for client response
const sanitizeError = (err: any) => {
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    return {
      success: false,
      error: 'An unexpected error occurred',
      statusCode: 500
    };
  }

  return {
    success: false,
    error: err.message || 'An error occurred',
    statusCode: err.statusCode || 500,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  };
};

// Global error handler middleware
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json(sanitizeError(new ValidationError(err.message)));
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(sanitizeError(new AuthenticationError('Invalid token')));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(sanitizeError(new AuthenticationError('Token expired')));
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json(sanitizeError(new AppError('Duplicate entry', 409)));
  }

  // Default error response
  const sanitized = sanitizeError(err);
  res.status(sanitized.statusCode).json(sanitized);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;

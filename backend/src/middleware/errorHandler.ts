import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;

  const body: Record<string, unknown> = {
    success: false,
    message: err.message || 'Internal server error',
  };

  if (err.errors) {
    body.errors = err.errors;
  }

  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

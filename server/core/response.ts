/**
 * Standard API Response Formatter
 * Guarantees unified JSON envelopes across all endpoints.
 */
import { Response } from 'express';
import { AppError } from './errors.ts';

export interface SuccessEnvelope<T = any> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
  serverTime: string;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId?: string;
  };
  serverTime: string;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    meta?: Record<string, any>,
    statusCode: number = 200
  ): Response {
    const envelope: SuccessEnvelope<T> = {
      success: true,
      data,
      serverTime: new Date().toISOString(),
    };
    if (meta) {
      envelope.meta = meta;
    }
    return res.status(statusCode).json(envelope);
  }

  static paginated<T>(
    res: Response,
    items: T[],
    total: number,
    page: number = 1,
    limit: number = 20
  ): Response {
    return this.success(res, items, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    });
  }

  static error(
    res: Response,
    error: any,
    correlationId?: string
  ): Response {
    const isAppError = error instanceof AppError;
    const statusCode = isAppError ? error.statusCode : (Number(error?.statusCode || error?.status) || 500);
    const code = (error as any)?.code || (isAppError ? error.code : 'INTERNAL_SERVER_ERROR');
    const message = isAppError ? error.message : (error?.message || 'خطای غیرمنتظره سرور');
    const details = isAppError ? error.details : error?.details;
    const conflict = error?.conflict || error?.details?.conflict || undefined;

    const envelope: ErrorEnvelope & { conflict?: any; code?: string } = {
      success: false,
      code,
      ...(conflict ? { conflict } : {}),
      error: {
        code,
        message,
        details: process.env.NODE_ENV !== 'production' ? (details || error?.stack) : details,
        correlationId,
      },
      serverTime: new Date().toISOString(),
    };

    return res.status(statusCode).json(envelope);
  }
}

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.ts';
import { ApiResponse } from '../response.ts';

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = req.correlationId || 'unknown';
  const statusCode = err?.statusCode || err?.status || (err?.name === 'UnauthorizedError' ? 401 : err?.name === 'ForbiddenError' ? 403 : err?.name === 'ValidationError' ? 422 : 500);

  const logPayload = {
    error: err?.message,
    stack: statusCode >= 500 ? err?.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    statusCode,
  };

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - ${err?.message || 'Server Error'}`, logPayload, correlationId);
  } else if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
    logger.info(`[${req.method}] ${req.originalUrl} - (${statusCode}) ${err?.message || 'Access Denied / Not Found'}`, logPayload, correlationId);
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${err?.message || 'Client Warning'}`, logPayload, correlationId);
  }

  if (res.headersSent) {
    return next(err);
  }

  return ApiResponse.error(res, err, correlationId);
}

export function notFoundHandlerMiddleware(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `مسیر درخواستی '${req.method} ${req.originalUrl}' در سرور یافت نشد.`,
      correlationId: req.correlationId,
    },
    serverTime: new Date().toISOString(),
  });
}

import { env } from '../config/env.js';
import { AppError, sendError } from '../utils/response.js';

export function notFoundHandler(_req, res) {
  return sendError(res, 404, 'NOT_FOUND', 'The requested resource was not found.');
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Malformed JSON payload
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return sendError(res, 400, 'MALFORMED_JSON', 'Request body contains invalid JSON.');
  }

  // Request entity too large
  if (err?.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds size limits.');
  }

  // MongoDB duplicate key race fallback
  if (err?.code === 11000) {
    return sendError(
      res,
      409,
      'DUPLICATE_RESOURCE',
      'An account with these details already exists.'
    );
  }

  // Mongoose validation error
  if (err?.name === 'ValidationError') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Submitted data is invalid.');
  }

  // CORS origin rejection
  if (err?.message === 'Not allowed by CORS') {
    return sendError(res, 403, 'CORS_FORBIDDEN', 'Origin not permitted.');
  }

  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled server error:', err);
  }

  return sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'Something went wrong on our side. Please try again shortly.'
  );
}

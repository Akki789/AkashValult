import { sendError } from '../utils/response.js';
import { emptyParamsSchema, emptyQuerySchema } from '../validators/authValidators.js';

export function validateRequest({
  body = null,
  query = emptyQuerySchema,
  params = emptyParamsSchema,
} = {}) {
  return (req, res, next) => {
    const fieldErrors = {};

    if (params) {
      const parsedParams = params.safeParse(req.params || {});
      if (!parsedParams.success) {
        for (const issue of parsedParams.error.issues) {
          const key = `params.${issue.path.join('.') || 'root'}`;
          fieldErrors[key] = issue.message;
        }
      } else {
        req.params = parsedParams.data;
      }
    }

    if (query) {
      const parsedQuery = query.safeParse(req.query || {});
      if (!parsedQuery.success) {
        for (const issue of parsedQuery.error.issues) {
          const key = `query.${issue.path.join('.') || 'root'}`;
          fieldErrors[key] = issue.message;
        }
      } else {
        req.query = parsedQuery.data;
      }
    }

    if (body) {
      const parsedBody = body.safeParse(req.body || {});
      if (!parsedBody.success) {
        for (const issue of parsedBody.error.issues) {
          const key = issue.path.join('.') || 'body';
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
      } else {
        req.body = parsedBody.data;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      const firstMessage = Object.values(fieldErrors)[0];
      return sendError(res, 400, 'VALIDATION_ERROR', firstMessage, {
        fields: fieldErrors,
      });
    }

    return next();
  };
}

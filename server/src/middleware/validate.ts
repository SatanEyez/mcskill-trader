import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { HttpError } from '../utils/http-error.js';

type RequestSource = 'body' | 'query' | 'params';

/**
 * Валидирует часть запроса и кладёт результат в req.validatedBody /
 * req.validatedQuery / req.validatedParams. Исходный req.query не мутируем:
 * в Express 4 это обычный объект, но такой подход безопаснее.
 */
export function validate(schema: ZodTypeAny, source: RequestSource = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new HttpError(422, 'Проверьте правильность заполнения полей', result.error.flatten()),
      );
      return;
    }

    if (source === 'body') req.validatedBody = result.data;
    if (source === 'query') req.validatedQuery = result.data;
    if (source === 'params') req.validatedParams = result.data;

    next();
  };
}

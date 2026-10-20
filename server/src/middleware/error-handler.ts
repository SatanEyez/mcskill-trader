import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';

interface PostgresError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        message: 'Проверьте правильность заполнения полей',
        details: error.flatten(),
      },
    });
    return;
  }

  if ((error as { name?: string }).name === 'MulterError') {
    const code = (error as { code?: string }).code;
    res.status(422).json({
      error: {
        message:
          code === 'LIMIT_FILE_SIZE'
            ? 'Файл больше 25 МБ — уменьшите прайс или спрайт'
            : 'Не удалось принять файлы. Прикрепите JSON прайса и icons.png',
      },
    });
    return;
  }

  const pgError = error as PostgresError;

  if (pgError.code === '23505') {
    const isCategory = pgError.constraint?.includes('categories') ?? false;
    const isAdminUser = pgError.constraint?.includes('admin_users') ?? false;

    res.status(409).json({
      error: {
        message: isAdminUser
          ? 'Такой логин уже занят'
          : isCategory
            ? 'Категория с таким названием уже существует'
            : 'Ресурс с таким названием уже существует',
      },
    });
    return;
  }

  if (pgError.code === '22P02') {
    res.status(400).json({
      error: { message: 'Некорректный идентификатор' },
    });
    return;
  }

  if (pgError.code === '23503') {
    res.status(400).json({
      error: { message: 'Связанная запись не найдена' },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { message: 'Некорректный JSON в теле запроса' },
    });
    return;
  }

  logger.error(`Необработанная ошибка ${req.method} ${req.originalUrl}:`, error);

  res.status(500).json({
    error: {
      message: 'Внутренняя ошибка сервера',
      ...(isProduction ? {} : { details: (error as Error).message }),
    },
  });
};

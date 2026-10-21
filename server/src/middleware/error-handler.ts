import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';

/** Ошибка mysql2: code — символическое имя, errno — числовой код. */
interface MySqlError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

const ER_DUP_ENTRY = 1062;
const ER_NO_REFERENCED_ROW = 1452;
const ER_ROW_IS_REFERENCED = 1451;
const ER_DATA_TOO_LONG = 1406;
const ER_TRUNCATED_WRONG_VALUE = 1366;
const ER_CHECK_CONSTRAINT_VIOLATED = 3819;

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

  const dbError = error as MySqlError;
  const message = dbError.sqlMessage ?? dbError.message ?? '';

  if (dbError.errno === ER_DUP_ENTRY) {
    const isCategory = /categories/i.test(message);
    const isAdminUser = /admin_users/i.test(message);
    const isPrefix = /admin_prefixes/i.test(message);
    const isRole = /admin_roles/i.test(message);

    res.status(409).json({
      error: {
        message: isAdminUser
          ? 'Такой логин уже занят'
          : isCategory
            ? 'Категория с таким названием уже существует'
            : isPrefix
              ? 'Префикс с таким названием уже существует'
              : isRole
                ? 'Роль с таким кодом или названием уже существует'
                : 'Ресурс с таким названием уже существует',
      },
    });
    return;
  }

  if (dbError.errno === ER_NO_REFERENCED_ROW) {
    res.status(400).json({
      error: { message: 'Связанная запись не найдена' },
    });
    return;
  }

  if (dbError.errno === ER_ROW_IS_REFERENCED) {
    res.status(409).json({
      error: { message: 'Запись используется другими данными' },
    });
    return;
  }

  if (dbError.errno === ER_DATA_TOO_LONG || dbError.errno === ER_TRUNCATED_WRONG_VALUE) {
    res.status(400).json({
      error: { message: 'Значение поля слишком длинное или имеет неверный формат' },
    });
    return;
  }

  if (dbError.errno === ER_CHECK_CONSTRAINT_VIOLATED) {
    res.status(400).json({
      error: { message: 'Значение не проходит проверку ограничений' },
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

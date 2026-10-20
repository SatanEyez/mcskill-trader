import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import {
  passwordVersion,
  verifyUserToken,
  type AuthPayload,
} from '../modules/auth/auth.tokens.js';
import { normalizePermissions } from '../modules/rbac/permissions.js';
import { findSessionUser, touchPresence } from '../modules/users/user.service.js';

export type { AuthPayload } from '../modules/auth/auth.tokens.js';

/**
 * Проверяет JWT и актуальность аккаунта в БД:
 * удалённый, отклонённый или сменивший пароль администратор теряет доступ.
 * Права и префикс всегда берутся из БД — токен не является источником истины.
 */
export const requireAdmin: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Для доступа к этому разделу нужна авторизация');
  }

  const payload = verifyUserToken(header.slice('Bearer '.length).trim());
  const user = await findSessionUser(payload.sub);

  if (!user) {
    throw new HttpError(401, 'Сессия истекла. Войдите заново');
  }

  if (user.status !== 'approved') {
    throw new HttpError(403, 'Доступ к админ-панели закрыт');
  }

  if (user.is_system) {
    throw new HttpError(403, 'Системный аккаунт не может входить в панель');
  }

  if (payload.pv !== passwordVersion(user.password_hash)) {
    throw new HttpError(401, 'Пароль изменён. Войдите заново');
  }

  const permissions =
    user.role === 'owner' ? ['*'] : normalizePermissions(user.permissions);

  req.auth = {
    sub: user.id,
    login: user.login,
    role: user.role,
    pv: payload.pv,
    permissions,
    role_code: user.role_code,
    role_name: user.role_name,
    prefix:
      user.prefix_id && user.prefix_name && user.prefix_color
        ? { id: user.prefix_id, name: user.prefix_name, color: user.prefix_color }
        : null,
  };

  // Отметка «в сети» не должна задерживать ответ и ломать запрос.
  void touchPresence(user.id).catch((error) =>
    logger.error('Не удалось обновить присутствие администратора:', error),
  );

  next();
});

import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';
import { canAll, type PermissionKey } from '../modules/rbac/permissions.js';

/**
 * Проверяет права из admin_roles. Требует, чтобы запрос уже прошёл requireAdmin.
 * Владелец имеет "*" и проходит любую проверку.
 */
export function requirePermission(...required: PermissionKey[]): RequestHandler {
  return (req, _res, next) => {
    const permissions = req.auth?.permissions;

    if (!permissions) {
      next(new HttpError(401, 'Для доступа к этому разделу нужна авторизация'));
      return;
    }

    if (!canAll(permissions, required)) {
      next(
        new HttpError(
          403,
          `Недостаточно прав для этого действия (${required.join(', ')})`,
        ),
      );
      return;
    }

    next();
  };
}

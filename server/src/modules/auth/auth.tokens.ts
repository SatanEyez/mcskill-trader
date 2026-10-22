import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { AdminRole } from '../users/user.types.js';

export interface AdminPrefixDto {
  id: string;
  name: string;
  color: string;
  /** «Shiny»-эффект: по тексту бежит светлая полоса. */
  is_shiny: boolean;
}

/**
 * Данные авторизованного администратора в запросе.
 * Роль/права всегда перечитываются из БД в requireAdmin, поэтому смена
 * роли или префикса действует без перелогина.
 */
export interface AuthPayload {
  sub: string;
  login: string;
  role: AdminRole;
  /** Версия пароля: sha256-отпечаток хеша. Меняется вместе с паролем — старые токены гаснут. */
  pv: string;
  permissions: string[];
  role_code: string | null;
  role_name: string | null;
  prefix: AdminPrefixDto | null;
}

export interface TokenUser {
  id: string;
  login: string;
  role: AdminRole;
  password_hash: string;
}

export function passwordVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

export function signUserToken(user: TokenUser): string {
  const payload = {
    sub: user.id,
    login: user.login,
    role: user.role,
    pv: passwordVersion(user.password_hash),
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyUserToken(token: string): AuthPayload {
  let payload: unknown;

  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Сессия истекла. Войдите заново');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new HttpError(401, 'Недействительный токен авторизации');
  }

  const { sub, login, role, pv } = payload as Record<string, unknown>;

  if (
    typeof sub !== 'string' ||
    typeof login !== 'string' ||
    (role !== 'owner' && role !== 'admin') ||
    typeof pv !== 'string'
  ) {
    throw new HttpError(401, 'Недействительный токен авторизации');
  }

  // Права не доверяем токену: их подставляет requireAdmin из admin_roles.
  return {
    sub,
    login,
    role,
    pv,
    permissions: [],
    role_code: null,
    role_name: null,
    prefix: null,
  };
}

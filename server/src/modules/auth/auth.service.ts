import { HttpError } from '../../utils/http-error.js';
import {
  createPendingUser,
  findAuthUserById,
  findAuthUserByLogin,
  getUserById,
  touchLastLogin,
  updatePasswordHash,
} from '../users/user.service.js';
import type { AdminUserDto } from '../users/user.types.js';
import { signUserToken } from './auth.tokens.js';
import { hashPassword, verifyDummyPassword, verifyPassword } from './password.js';

export type LoginFailureReason = 'invalid' | 'pending' | 'rejected';

export type LoginOutcome =
  | { ok: true; token: string; user: AdminUserDto }
  | { ok: false; reason: LoginFailureReason; userId: string | null };

/** Создаёт заявку: пароль сразу хешируется, вход — только после одобрения. */
export async function registerUser(login: string, password: string): Promise<AdminUserDto> {
  const passwordHash = await hashPassword(password);
  return createPendingUser(login, passwordHash);
}

export async function attemptLogin(login: string, password: string): Promise<LoginOutcome> {
  const user = await findAuthUserByLogin(login);

  if (!user) {
    await verifyDummyPassword(password);
    return { ok: false, reason: 'invalid', userId: null };
  }

  // Служебный аккаунт synced_ не предназначен для входа.
  if (user.is_system) {
    await verifyDummyPassword(password);
    return { ok: false, reason: 'invalid', userId: user.id };
  }

  const passwordValid = await verifyPassword(password, user.password_hash);

  if (!passwordValid) {
    return { ok: false, reason: 'invalid', userId: user.id };
  }

  if (user.status === 'pending') {
    return { ok: false, reason: 'pending', userId: user.id };
  }

  if (user.status === 'rejected') {
    return { ok: false, reason: 'rejected', userId: user.id };
  }

  await touchLastLogin(user.id);

  return {
    ok: true,
    token: signUserToken(user),
    user: await getUserById(user.id),
  };
}

export interface ChangePasswordResult {
  token: string;
  user: AdminUserDto;
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new HttpError(401, 'Сессия истекла. Войдите заново');
  }

  const passwordValid = await verifyPassword(currentPassword, user.password_hash);

  if (!passwordValid) {
    throw new HttpError(400, 'Текущий пароль указан неверно');
  }

  await updatePasswordHash(userId, await hashPassword(newPassword));

  const updated = await findAuthUserById(userId);

  if (!updated) {
    throw new HttpError(404, 'Администратор не найден');
  }

  return {
    token: signUserToken(updated),
    user: await getUserById(userId),
  };
}

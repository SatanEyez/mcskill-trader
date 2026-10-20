import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';
import { recordAudit } from '../audit/audit.service.js';
import { getUserById } from '../users/user.service.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schema.js';
import * as authService from './auth.service.js';

const FAILURE_RESPONSE: Record<
  authService.LoginFailureReason,
  { status: number; message: string }
> = {
  invalid: { status: 401, message: 'Неверный логин или пароль' },
  pending: { status: 403, message: 'Заявка ожидает одобрения администратора' },
  rejected: { status: 403, message: 'Заявка отклонена. Обратитесь к администратору' },
};

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { login, password } = req.validatedBody as RegisterInput;
  const user = await authService.registerUser(login, password);

  await recordAudit(req, {
    action: 'user.register',
    actor: { id: user.id, login: user.login },
    entityType: 'user',
    entityId: user.id,
    entityLabel: user.login,
    details: { status: user.status },
  });

  res.status(201).json({
    data: {
      login: user.login,
      status: user.status,
      created_at: user.created_at,
    },
  });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { login, password } = req.validatedBody as LoginInput;
  const outcome = await authService.attemptLogin(login, password);

  if (!outcome.ok) {
    await recordAudit(req, {
      action: outcome.reason === 'invalid' ? 'auth.login_failed' : 'auth.login_blocked',
      actor: { id: outcome.userId, login },
      entityType: 'user',
      entityId: outcome.userId,
      entityLabel: login,
      details: { reason: outcome.reason },
    });

    const failure = FAILURE_RESPONSE[outcome.reason];
    throw new HttpError(failure.status, failure.message);
  }

  await recordAudit(req, {
    action: 'auth.login',
    actor: { id: outcome.user.id, login: outcome.user.login },
    entityType: 'user',
    entityId: outcome.user.id,
    entityLabel: outcome.user.login,
    details: { role: outcome.user.role },
  });

  res.json({
    data: {
      token: outcome.token,
      token_type: 'Bearer',
      expires_in: env.JWT_EXPIRES_IN,
      user: outcome.user,
    },
  });
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  const data = await getUserById(req.auth!.sub);
  res.json({ data });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.validatedBody as ChangePasswordInput;
  const result = await authService.changeOwnPassword(
    req.auth!.sub,
    current_password,
    new_password,
  );

  await recordAudit(req, {
    action: 'user.password_change',
    actor: { id: result.user.id, login: result.user.login },
    entityType: 'user',
    entityId: result.user.id,
    entityLabel: result.user.login,
  });

  res.json({
    data: {
      token: result.token,
      token_type: 'Bearer',
      expires_in: env.JWT_EXPIRES_IN,
      user: result.user,
    },
  });
});

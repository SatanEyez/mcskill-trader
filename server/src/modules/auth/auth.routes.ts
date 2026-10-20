import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { changePassword, login, me, register } from './auth.controller.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Считаем только неудачные попытки, чтобы успешные входы не упирались в лимит.
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: 'Слишком много попыток входа. Попробуйте через 15 минут' },
    });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: 'Слишком много заявок на регистрацию. Попробуйте позже' },
    });
  },
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { message: 'Слишком много попыток смены пароля. Попробуйте через 15 минут' },
    });
  },
});

authRouter.post('/register', registerLimiter, validate(registerSchema), register);
authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.get('/me', requireAdmin, me);
authRouter.post(
  '/password',
  requireAdmin,
  passwordLimiter,
  validate(changePasswordSchema),
  changePassword,
);

import { z } from 'zod';

export const LOGIN_MIN = 3;
export const LOGIN_MAX = 32;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;

const loginField = z
  .string({ required_error: 'Введите логин' })
  .trim()
  .min(LOGIN_MIN, `Логин должен содержать минимум ${LOGIN_MIN} символа`)
  .max(LOGIN_MAX, `Логин должен быть не длиннее ${LOGIN_MAX} символов`)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.-]*$/,
    'Логин: латиница, цифры, точка, дефис или подчёркивание',
  );

const newPasswordField = z
  .string({ required_error: 'Введите пароль' })
  .min(PASSWORD_MIN, `Пароль должен содержать минимум ${PASSWORD_MIN} символов`)
  .max(PASSWORD_MAX, 'Слишком длинный пароль');

export const loginSchema = z
  .object({
    login: z
      .string({ required_error: 'Введите логин' })
      .trim()
      .min(1, 'Введите логин')
      .max(LOGIN_MAX, 'Слишком длинный логин'),
    password: z
      .string({ required_error: 'Введите пароль' })
      .min(1, 'Введите пароль')
      .max(200, 'Слишком длинный пароль'),
  })
  .strict();

export const registerSchema = z
  .object({
    login: loginField,
    password: newPasswordField,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ required_error: 'Введите текущий пароль' })
      .min(1, 'Введите текущий пароль')
      .max(200, 'Слишком длинный пароль'),
    new_password: newPasswordField,
  })
  .strict()
  .refine((data) => data.current_password !== data.new_password, {
    message: 'Новый пароль должен отличаться от текущего',
    path: ['new_password'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

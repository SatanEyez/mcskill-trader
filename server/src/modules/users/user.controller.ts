import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';
import { logAction } from '../audit/audit.service.js';
import {
  UPLOADS_URL_PREFIX,
  deleteUploadedFile,
  detectImageMime,
  saveUploadedFile,
} from '../uploads/upload.storage.js';
import * as userService from './user.service.js';
import type {
  UpdateUserAccessInput,
  UpdateUserRoleInput,
  UserIdParams,
} from './user.schema.js';
import type { ListUsersQuery } from './user.types.js';

function getId(req: Request): string {
  return (req.validatedParams as UserIdParams).id;
}

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery as ListUsersQuery;
  const result = await userService.listUsers(query);

  res.json({ data: result.data, meta: result.meta });
});

/** Полный список администрации с присутствием — отдельная вкладка «Администрация». */
export const listStaff: RequestHandler = asyncHandler(async (_req, res) => {
  const result = await userService.listStaff();

  res.json({ data: result.data, meta: result.meta });
});

export const approveUser: RequestHandler = asyncHandler(async (req, res) => {
  const data = await userService.approveUser(getId(req), req.auth!);

  await logAction(req, {
    action: 'user.approve',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
    details: { login: data.login, role: data.role_name },
  });

  res.json({ data });
});

export const rejectUser: RequestHandler = asyncHandler(async (req, res) => {
  const data = await userService.rejectUser(getId(req), req.auth!);

  await logAction(req, {
    action: 'user.reject',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
    details: { login: data.login },
  });

  res.json({ data });
});

export const deleteUser: RequestHandler = asyncHandler(async (req, res) => {
  const data = await userService.deleteUser(getId(req), req.auth!);

  await logAction(req, {
    action: 'user.delete',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
    details: { login: data.login, status: data.status },
  });

  res.json({ data });
});

/** Аватар своего профиля: файл кладём в базу, в admin_users — только ссылку. */
export const updateAvatar: RequestHandler = asyncHandler(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new HttpError(422, 'Выберите файл изображения');
  }

  const mime = detectImageMime(file.buffer);

  if (!mime) {
    throw new HttpError(422, 'Файл не похож на изображение: нужен PNG, JPG, WebP или GIF');
  }

  const previous = await userService.getUserById(req.auth!.sub);
  const filename = await saveUploadedFile(file.buffer, mime);
  const data = await userService.setUserAvatar(
    req.auth!.sub,
    `${UPLOADS_URL_PREFIX}/${filename}`,
  );

  if (previous.avatar_url) {
    await deleteUploadedFile(previous.avatar_url.replace(`${UPLOADS_URL_PREFIX}/`, ''));
  }

  await logAction(req, {
    action: 'user.avatar_update',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
    details: { mime, size: file.buffer.length },
  });

  res.json({ data });
});

export const deleteAvatar: RequestHandler = asyncHandler(async (req, res) => {
  const previous = await userService.getUserById(req.auth!.sub);
  const data = await userService.setUserAvatar(req.auth!.sub, '');

  if (previous.avatar_url) {
    await deleteUploadedFile(previous.avatar_url.replace(`${UPLOADS_URL_PREFIX}/`, ''));
  }

  await logAction(req, {
    action: 'user.avatar_delete',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
  });

  res.json({ data });
});

export const updateUserRole: RequestHandler = asyncHandler(async (req, res) => {
  const { role } = req.validatedBody as UpdateUserRoleInput;
  const { data, previous } = await userService.changeUserRole(getId(req), role, req.auth!);

  await logAction(req, {
    action: 'user.role_change',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
    details: { login: data.login, from: previous.role, to: data.role },
  });

  res.json({ data });
});

export const updateUserAccess: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.validatedBody as UpdateUserAccessInput;
  const { data, previous } = await userService.updateUserAccess(getId(req), input, req.auth!);

  await logAction(req, {
    action: 'access.user_update',
    entityType: 'user',
    entityId: data.id,
    entityLabel: data.login,
    details: {
      login: data.login,
      role: { from: previous.role_name, to: data.role_name },
      prefix: { from: previous.prefix?.name ?? null, to: data.prefix?.name ?? null },
    },
  });

  res.json({ data });
});

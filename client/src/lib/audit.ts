import type { AuditGroup } from '../types';
import { formatPrice, pluralize } from './format';

export type AuditTone = 'emerald' | 'cyan' | 'amber' | 'rose' | 'fuchsia' | 'slate';

export interface AuditActionMeta {
  /** Что сделал администратор (подлежащее — логин в записи журнала). */
  label: string;
  group: AuditGroup;
  tone: AuditTone;
}

const ACTION_META: Record<string, AuditActionMeta> = {
  'resource.create': { label: 'добавил ресурс', group: 'resources', tone: 'emerald' },
  'resource.update': { label: 'изменил ресурс', group: 'resources', tone: 'cyan' },
  'resource.delete': { label: 'удалил ресурс', group: 'resources', tone: 'rose' },
  'category.create': { label: 'создал категорию', group: 'categories', tone: 'emerald' },
  'category.update': { label: 'переименовал категорию', group: 'categories', tone: 'cyan' },
  'category.delete': { label: 'удалил категорию', group: 'categories', tone: 'rose' },
  'user.register': { label: 'отправил заявку на доступ', group: 'users', tone: 'amber' },
  'user.approve': { label: 'одобрил доступ', group: 'users', tone: 'emerald' },
  'user.reject': { label: 'отклонил заявку', group: 'users', tone: 'amber' },
  'user.delete': { label: 'удалил администратора', group: 'users', tone: 'rose' },
  'user.role_change': { label: 'изменил роль администратора', group: 'users', tone: 'fuchsia' },
  'user.password_change': { label: 'сменил свой пароль', group: 'users', tone: 'fuchsia' },
  'access.user_update': { label: 'изменил доступ администратора', group: 'access', tone: 'fuchsia' },
  'access.role_create': { label: 'создал роль', group: 'access', tone: 'emerald' },
  'access.role_update': { label: 'изменил роль и права', group: 'access', tone: 'cyan' },
  'access.role_delete': { label: 'удалил роль', group: 'access', tone: 'rose' },
  'access.prefix_create': { label: 'создал префикс', group: 'access', tone: 'emerald' },
  'access.prefix_update': { label: 'изменил префикс', group: 'access', tone: 'cyan' },
  'access.prefix_delete': { label: 'удалил префикс', group: 'access', tone: 'rose' },
  'import.prices': { label: 'импортировал прайс', group: 'import', tone: 'cyan' },
  'import.prices_failed': { label: 'не смог импортировать прайс', group: 'import', tone: 'rose' },
  'support.ticket_update': { label: 'обновил обращение', group: 'support', tone: 'emerald' },
  'auth.login': { label: 'вошёл в панель', group: 'auth', tone: 'emerald' },
  'auth.login_failed': { label: 'неудачная попытка входа', group: 'auth', tone: 'rose' },
  'auth.login_blocked': { label: 'вход заблокирован', group: 'auth', tone: 'amber' },
};

export function getAuditActionMeta(action: string): AuditActionMeta {
  return ACTION_META[action] ?? { label: action, group: 'auth', tone: 'slate' };
}

/** Для входа и регистрации логин в названии записи дублировал бы самого актора. */
export function shouldShowEntityLabel(
  action: string,
  entityLabel: string | null,
  userLogin: string,
): boolean {
  if (!entityLabel) return false;
  if (entityLabel !== userLogin) return true;
  return action !== 'user.register' && !action.startsWith('auth.');
}

interface ChangeValue {
  from?: unknown;
  to?: unknown;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'название',
  min_price: 'цена',
  category: 'категория',
  image_url: 'изображение',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'владелец',
  admin: 'администратор',
};

function quote(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return `«${String(value)}»`;
}

function formatMoney(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? `${formatPrice(number)} монет` : '—';
}

function formatFieldValue(field: string, value: unknown): string {
  if (field === 'min_price') return formatMoney(value);
  if (field === 'image_url') return value ? 'новое изображение' : 'без изображения';
  return quote(value);
}

/** Человекочитаемая расшифровка details из журнала. */
export function describeAuditDetails(
  action: string,
  details: Record<string, unknown> | null,
): string[] {
  if (!details) return [];

  const result: string[] = [];
  const changes = details.changes;

  if (changes && typeof changes === 'object') {
    for (const [field, raw] of Object.entries(changes as Record<string, ChangeValue>)) {
      const label = FIELD_LABELS[field] ?? field;

      if (field === 'image_url') {
        result.push(`${label}: обновлено`);
        continue;
      }

      result.push(
        `${label}: ${formatFieldValue(field, raw?.from)} → ${formatFieldValue(field, raw?.to)}`,
      );
    }

    return result;
  }

  if (typeof details.min_price === 'number') {
    result.push(`цена ${formatMoney(details.min_price)}`);
  }

  if (typeof details.category === 'string') {
    result.push(`категория ${quote(details.category)}`);
  }

  if (typeof details.image_url === 'string' && details.image_url) {
    result.push('с изображением');
  }

  if (typeof details.moved_resources === 'number' && details.moved_resources > 0) {
    const count = details.moved_resources;
    result.push(
      `${count} ${pluralize(count, ['ресурс', 'ресурса', 'ресурсов'])} ${
        count === 1 ? 'перешёл' : 'перешли'
      } в «Без категории»`,
    );
  }

  if (action === 'user.register') {
    result.push('ожидает одобрения');
  }

  if (action === 'user.role_change' && details.from && details.to) {
    const from = ROLE_LABELS[String(details.from)] ?? String(details.from);
    const to = ROLE_LABELS[String(details.to)] ?? String(details.to);
    result.push(`роль: ${from} → ${to}`);
  }

  if (action === 'auth.login_failed') {
    result.push('неверный логин или пароль');
  }

  if (action === 'auth.login_blocked') {
    result.push(details.reason === 'rejected' ? 'заявка отклонена' : 'заявка ещё не одобрена');
  }

  if (action.startsWith('import.prices')) {
    if (typeof details.total === 'number') {
      result.push(`всего ${details.total}`);
    }
    if (typeof details.created === 'number') {
      result.push(`создано ${details.created}`);
    }
    if (typeof details.updated === 'number') {
      result.push(`обновлено ${details.updated}`);
    }
    if (typeof details.images === 'number') {
      result.push(`иконок ${details.images}`);
    }
    if (typeof details.error === 'string') {
      result.push(`ошибка: ${details.error}`);
    }
  }

  if (action === 'support.ticket_update') {
    const status = details.status as { from?: string; to?: string } | undefined;

    if (status?.from && status?.to) {
      result.push(`статус: ${status.from} → ${status.to}`);
    }
    if (details.reply) {
      result.push('ответ отправлен');
    }
    if (typeof details.nick === 'string') {
      result.push(`автор ${quote(details.nick)}`);
    }
  }

  if (action === 'access.user_update') {
    const role = details.role as { from?: string | null; to?: string | null } | undefined;
    const prefix = details.prefix as { from?: string | null; to?: string | null } | undefined;

    if (role) {
      result.push(`роль: ${role.from ?? '—'} → ${role.to ?? '—'}`);
    }
    if (prefix) {
      result.push(`префикс: ${prefix.from ?? '—'} → ${prefix.to ?? '—'}`);
    }
  }

  return result;
}

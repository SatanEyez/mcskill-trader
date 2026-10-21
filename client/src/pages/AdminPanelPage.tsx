import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, Info, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminTabs } from '../components/admin/AdminTabs';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, fetchRoles } from '../lib/api';
import {
  ADMIN_SECTIONS,
  SECTION_GROUPS,
  canOpenSection,
  levelCaption,
  sectionRequirement,
  type AdminSection,
} from '../lib/admin-sections';
import type { AdminRoleInfo } from '../types';

/** Цветовая шкала уровней: владелец → администратор → модератор → остальные. */
function levelTone(level: number | null): string {
  if (level === null) return 'border-white/[0.08] bg-white/[0.03] text-slate-500';
  if (level >= 80) return 'border-fuchsia-400/30 bg-fuchsia-400/[0.12] text-fuchsia-200';
  if (level >= 60) return 'border-accent/30 bg-accent/[0.12] text-accent';
  if (level >= 40) return 'border-sky-400/30 bg-sky-400/[0.12] text-sky-200';
  if (level >= 20) return 'border-amber-400/30 bg-amber-400/[0.12] text-amber-200';
  return 'border-white/[0.1] bg-white/[0.05] text-slate-300';
}

function SectionCard({
  section,
  roles,
  available,
  pending,
  myLevel,
}: {
  section: AdminSection;
  roles: AdminRoleInfo[];
  available: boolean;
  pending: boolean;
  myLevel: number;
}) {
  const Icon = section.icon;
  const requirement = sectionRequirement(section, roles);
  const firstRole = requirement.roles[0];
  const extraRoles = requirement.roles.length - 1;
  const roleNames = firstRole
    ? extraRoles > 0
      ? `${firstRole} +${extraRoles}`
      : firstRole
    : 'право не выдано';
  const required = requirement.level;

  /**
   * Три состояния карточки:
   *  - открыта;
   *  - уровня хватает, но праву роли не выдано;
   *  - уровень ниже требуемого.
   */
  const levelShort = required !== null && myLevel < required;
  const badgeTone = available
    ? levelTone(required)
    : levelShort
      ? 'border-amber-400/30 bg-amber-400/[0.1] text-amber-200'
      : 'border-rose-400/30 bg-rose-400/[0.1] text-rose-200';
  const badgeText = pending
    ? '…'
    : available
      ? required === null
        ? 'открыто'
        : levelCaption(required)
      : levelShort
        ? `нужен ур. ${required}`
        : required === null
          ? 'закрыто'
          : 'нет права';

  const lockHint = levelShort
    ? `Раздел откроется с ${required} уровня доступа (у вас ${myLevel})`
    : 'Уровня хватает, но право не выдано вашей роли — попросите владельца добавить его в «Доступ»';

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition',
            available
              ? 'border-accent/25 bg-accent/[0.08] text-accent group-hover:border-accent/45 group-hover:bg-accent/[0.14]'
              : 'border-white/[0.07] bg-white/[0.03] text-slate-600',
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className={clsx('text-sm font-semibold', available ? 'text-white' : 'text-slate-400')}>
            {section.label}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{section.hint}</p>
        </div>

        {available ? (
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-accent"
            aria-hidden
          />
        ) : (
          <Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.05] pt-2.5">
        <span
          className={clsx(
            'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
            pending ? levelTone(null) : badgeTone,
          )}
          title={
            requirement.roles.length > 0
              ? `Право есть у ролей: ${requirement.roles.join(', ')}`
              : 'Право не выдано ни одной роли'
          }
        >
          {badgeText}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-[10px] text-slate-600"
          title={requirement.roles.join(', ')}
        >
          {pending ? 'считаем уровни' : roleNames}
        </span>
      </div>
    </>
  );

  if (!available) {
    return (
      <div className="panel flex flex-col p-4 opacity-70" title={lockHint}>
        {body}
      </div>
    );
  }

  return (
    <Link
      to={section.to}
      className="panel group flex flex-col p-4 transition hover:border-accent/30 hover:bg-panel/95"
    >
      {body}
    </Link>
  );
}

export function AdminPanelPage() {
  const { user, can } = useAuth();
  const [roles, setRoles] = useState<AdminRoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Панель управления — McSkill Trader';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchRoles()
      .then((response) => {
        if (cancelled) return;
        setRoles(response.data);
        setError(null);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          cause instanceof ApiError ? cause.message : 'Не удалось загрузить уровни доступа',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const myLevel = user?.access_level ?? 0;
  const openCount = useMemo(
    () => ADMIN_SECTIONS.filter((section) => canOpenSection(section, can)).length,
    [can],
  );

  const levelScale = useMemo(
    () => [...roles].sort((a, b) => b.access_level - a.access_level),
    [roles],
  );

  if (!user) return null;

  const roleLabel = user.role_name ?? (user.role === 'owner' ? 'Владелец' : 'Администратор');

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminTabs />

      <main className="container-page py-8 sm:py-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Администрирование
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Панель управления</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Все разделы админки в одном месте. У каждой карточки подписан уровень доступа, с
            которого она открывается — уровни настраиваются в разделе «Доступ».
          </p>
        </div>

        {/* Мой уровень + шкала уровней ролей */}
        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span
                className={clsx(
                  'grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-lg font-bold',
                  levelTone(myLevel),
                )}
              >
                {myLevel}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Ваш уровень доступа
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">{roleLabel}</p>
                <p className="text-[11px] text-slate-500">
                  Открыто разделов: {openCount} из {ADMIN_SECTIONS.length}
                </p>
              </div>
            </div>

            {can('roles.manage') && (
              <Link
                to="/admin/access"
                className="btn btn-secondary shrink-0 px-3 py-2 text-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Настроить уровни
              </Link>
            )}
          </div>

          {levelScale.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.05] px-5 py-3">
              {levelScale.map((role) => (
                <span
                  key={role.id}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500"
                  title={`${role.name} · ${role.user_count} чел.`}
                >
                  <span
                    className={clsx(
                      'rounded border px-1 py-0.5 font-semibold',
                      levelTone(role.access_level),
                    )}
                  >
                    {role.access_level}
                  </span>
                  {role.name}
                </span>
              ))}
            </div>
          )}
        </section>

        {loading && (
          <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <Spinner />
            Считаем уровни доступа…
          </p>
        )}

        {error && !loading && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
            <p className="text-[11px] leading-relaxed text-amber-100/80">
              {error}. Карточки показывают только то, что доступно вашей роли.
            </p>
          </div>
        )}

        {SECTION_GROUPS.map((group) => {
          const items = ADMIN_SECTIONS.filter((section) => section.group === group);
          if (items.length === 0) return null;

          return (
            <section key={group} className="mt-8">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group}
              </h2>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((section) => (
                  <SectionCard
                    key={section.key}
                    section={section}
                    roles={roles}
                    available={canOpenSection(section, can)}
                    pending={loading}
                    myLevel={myLevel}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          <p className="text-[11px] leading-relaxed text-slate-500">
            Уровень раздела — это минимальный уровень среди ролей, которым выдано нужное право.
            Меняется он не здесь, а в «Доступ» → роль → уровень доступа. Заблокированная
            карточка означает, что вашей роли не хватает права или уровня.
          </p>
        </div>
      </main>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-white/[0.05] bg-abyss/50">
      <div className="container-page py-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              Трейд-калькулятор для быстрого расчёта обменов по минимальным ценам
              сервера McSkill OneBlock.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Разделы
              </p>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <Link to="/resources" className="transition hover:text-accent">
                    Каталог ресурсов
                  </Link>
                </li>
                <li>
                  <Link to="/trade" className="transition hover:text-accent">
                    Трейд-калькулятор
                  </Link>
                </li>
                <li>
                  <Link to="/exchange" className="transition hover:text-accent">
                    Обменник
                  </Link>
                </li>
                <li>
                  <Link to="/report" className="transition hover:text-accent">
                    Сообщить о проблеме
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="transition hover:text-accent">
                    Админ-панель
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Сервер
              </p>
              <ul className="space-y-2 text-slate-400">
                <li>McSkill OneBlock</li>
                <li>Цены в игровой валюте</li>
                <li>Обновление вручную</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.05] pt-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} McSkill Trader. Неофициальный фанатский проект.</p>
          <p>Цены носят справочный характер и не являются офертой.</p>
        </div>
      </div>
    </footer>
  );
}

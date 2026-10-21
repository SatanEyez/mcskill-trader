import {
  ArrowRight,
  CheckCircle2,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Карточка под превью трейда: объясняем, зачем калькулятор сверяет
 * сделку с правилами экономики — чтобы игрок не получил наказание.
 */

const RULES = [
  {
    icon: Scale,
    title: 'Цены по минималке и потолку',
    desc: 'п. 9.6 — оценка не ниже минимальной цены и не выше ×10 / ×5 / ×2',
  },
  {
    icon: CheckCircle2,
    title: 'Разница до 10% от меньшей стороны',
    desc: 'п. 9.10 — если разница сторон в пределах 10%, обмен считается равноценным',
  },
  {
    icon: ShieldAlert,
    title: 'Запрет на раздачу и нечестные обмены',
    desc: 'п. 9.7 и 9.11 — нельзя раздавать землю/камень/песок и менять лёгкое на труднодоступное',
  },
] as const;

export function TradeRulesPromo() {
  return (
    <div className="mt-5 animate-fade-up rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-b from-panel to-abyss p-1 shadow-card">
      <div className="rounded-[1.05rem] border border-white/[0.05] bg-void/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/[0.08] text-accent">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">
              Проверяем сделку по правилам — чтобы вы не получили наказание
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Калькулятор сверяет каждый обмен с экономическими правилами сервера
              McSkill. Нарушение любого пункта может привести к санкциям от
              состава — от предупреждения до бана.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {RULES.map((rule) => {
            const Icon = rule.icon;

            return (
              <li
                key={rule.title}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
              >
                <Icon
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-200">
                    {rule.title}
                  </p>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    {rule.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <Link
          to="/trade"
          className="btn btn-primary mt-4 flex w-full items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Проверить свою сделку
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

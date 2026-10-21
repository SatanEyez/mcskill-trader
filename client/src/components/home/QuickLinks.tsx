import { ArrowUpRight, Boxes, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { pluralize } from '../../lib/format';

interface QuickLinksProps {
  resourceCount: number;
}

/** Две точки входа внизу главной: каталог и калькулятор. */
export function QuickLinks({ resourceCount }: QuickLinksProps) {
  return (
    <section className="container-page mt-12">
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/resources"
          className="group panel relative overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-[#0d1620]"
        >
          <span
            className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/0 blur-2xl transition duration-300 group-hover:bg-accent/10"
            aria-hidden
          />

          <div className="flex items-start justify-between gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-accent">
              <Boxes className="h-5 w-5" aria-hidden />
            </span>
            <ArrowUpRight
              className="h-4 w-4 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
              aria-hidden
            />
          </div>

          <h2 className="mt-4 text-base font-semibold text-white">Ресурсы</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {resourceCount > 0
              ? `${resourceCount} ${pluralize(resourceCount, ['предмет', 'предмета', 'предметов'])} с минимальными ценами — поиск, категории и сортировка.`
              : 'Каталог предметов с минимальными ценами — поиск, категории и сортировка.'}
          </p>
        </Link>

        <Link
          to="/trade"
          className="group panel relative overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-[#0d1620]"
        >
          <span
            className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/0 blur-2xl transition duration-300 group-hover:bg-accent/10"
            aria-hidden
          />

          <div className="flex items-start justify-between gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-accent">
              <Calculator className="h-5 w-5" aria-hidden />
            </span>
            <ArrowUpRight
              className="h-4 w-4 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
              aria-hidden
            />
          </div>

          <h2 className="mt-4 text-base font-semibold text-white">Трейд-калькулятор</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Соберите обе стороны сделки и узнайте, проходит ли обмен по правилу 9.10 —
            разница до 10% от итоговой суммы.
          </p>
        </Link>
      </div>
    </section>
  );
}

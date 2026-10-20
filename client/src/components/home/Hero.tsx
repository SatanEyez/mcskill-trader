import { ArrowDown, Boxes, Calculator, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../lib/format';

interface HeroProps {
  resourceCount: number;
  categoryCount: number;
  minPrice: number | null;
  loading: boolean;
}

export function Hero({ resourceCount, categoryCount, minPrice, loading }: HeroProps) {
  return (
    <section className="relative overflow-hidden pb-12 pt-14 sm:pb-16 sm:pt-20">
      <div className="bg-grid bg-grid-mask pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-accent/[0.09] blur-[110px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[12%] top-24 hidden h-24 w-24 rotate-12 rounded-3xl border border-accent/10 bg-accent/[0.025] lg:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[10%] top-48 hidden h-16 w-16 -rotate-12 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.02] lg:block"
        aria-hidden
      />

      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            McSkill · OneBlock
            <span className="h-3 w-px bg-white/10" />
            <Sparkles className="h-3 w-3 text-accent" aria-hidden />
            актуальные минималки
          </div>

          <h1 className="mt-6 animate-fade-up text-[2rem] font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Считай выгодный обмен
            <br className="hidden sm:block" />{' '}
            <span className="text-gradient">до сделки</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl animate-fade-up text-sm leading-relaxed text-slate-400 sm:text-base">
            Каталог ресурсов и трейд-калькулятор по минимальным ценам сервера.
            Выбери предметы — узнай точное количество для честного обмена.
          </p>

          <div className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/trade" className="btn btn-primary w-full sm:w-auto">
              <Calculator className="h-4 w-4" aria-hidden />
              Открыть трейд-калькулятор
            </Link>
            <a href="#resources" className="btn btn-secondary w-full sm:w-auto">
              <Boxes className="h-4 w-4" aria-hidden />
              Смотреть ресурсы
            </a>
          </div>

          <dl className="mx-auto mt-12 grid max-w-xl animate-fade-up grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02] px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-5">
            <div className="px-2 text-center">
              <dd className="font-display text-xl font-semibold text-white sm:text-2xl">
                {loading ? '—' : resourceCount}
              </dd>
              <dt className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                ресурсов
              </dt>
            </div>
            <div className="px-2 text-center">
              <dd className="font-display text-xl font-semibold text-white sm:text-2xl">
                {loading ? '—' : categoryCount}
              </dd>
              <dt className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                категорий
              </dt>
            </div>
            <div className="px-2 text-center">
              <dd className="font-display text-xl font-semibold text-white sm:text-2xl">
                {loading || minPrice === null ? '—' : `от ${formatPrice(minPrice)}`}
              </dd>
              <dt className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                монет
              </dt>
            </div>
          </dl>

          <a
            href="#resources"
            className="mx-auto mt-8 hidden w-fit items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-600 transition hover:text-slate-400 sm:flex"
          >
            листай к каталогу
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

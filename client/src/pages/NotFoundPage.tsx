import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Logo } from '../components/layout/Logo';

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="bg-grid bg-grid-mask pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <div className="container-page relative flex flex-1 flex-col">
        <div className="py-6">
          <Logo />
        </div>

        <div className="flex flex-1 items-center justify-center pb-20">
          <div className="text-center">
            <p className="font-pixel text-xs uppercase tracking-widest text-accent">404</p>
            <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">
              Такой страницы нет
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Возможно, ссылка устарела. Вернитесь к каталогу ресурсов или откройте калькулятор.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/" className="btn btn-primary">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                На главную
              </Link>
              <Link to="/#resources" className="btn btn-secondary">
                <Compass className="h-4 w-4" aria-hidden />
                К ресурсам
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

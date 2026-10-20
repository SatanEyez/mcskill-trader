import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} aria-hidden />;
}

export function PageLoader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/5">
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
      </span>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

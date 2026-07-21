import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {back && (
            <Link
              to={back}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-100"
            >
              ‹
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    </header>
  );
}
